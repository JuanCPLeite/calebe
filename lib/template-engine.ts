import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExpertConfig } from './expert-config'
import type { ProviderId, TokenUsage } from './providers/types'
import { createProvider } from './providers/registry'
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildSplitSystemPrompt,
  buildSplitUserPrompt,
  type ContentOptions,
} from './content-engine'

// ─── Cache de prompts (5 min TTL) ────────────────────────────────────────────

interface CachedPrompts {
  system: string | null
  user: string | null
  model: string | null
  expiresAt: number
}

const promptCache = new Map<string, CachedPrompts>()
const CACHE_TTL_MS = 5 * 60 * 1000

async function fetchPrompts(
  templateId: string,
  providerId: ProviderId,
  supabase: SupabaseClient
): Promise<{ system: string | null; user: string | null; model: string | null }> {
  const cacheKey = `${templateId}:${providerId}`
  const cached = promptCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { system: cached.system, user: cached.user, model: cached.model }
  }

  const { data } = await supabase
    .from('template_prompts')
    .select('step, prompt_text, model')
    .eq('template_id', templateId)
    .eq('active', true)
    .in('provider', [providerId, 'any'])
    .order('provider', { ascending: false }) // provider-específico vem antes de 'any'

  const systemRow = data?.find(r => r.step === 'system')
  const userRow   = data?.find(r => r.step === 'user')

  const result = {
    system: systemRow?.prompt_text ?? null,
    user:   userRow?.prompt_text ?? null,
    model:  systemRow?.model ?? userRow?.model ?? null,
  }

  promptCache.set(cacheKey, { ...result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}

// ─── Interpolação de variáveis {{chave}} ──────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => vars[key] ?? '')
}

function buildVars(
  expert: ExpertConfig,
  topic: string,
  hook?: string,
  options: ContentOptions = {}
): Record<string, string> {
  const { textLength = 'medium' } = options
  const now = new Date()
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const year = String(now.getFullYear())

  const textLengthInstruction: Record<string, string> = {
    short:  'LIMITE OBRIGATÓRIO: máximo 130 caracteres por slide. Ultra-conciso — apenas a ideia central.',
    medium: 'LIMITE DE TEXTO: máximo 240 caracteres por slide. Conciso e direto ao ponto.',
    long:   'Sem limite fixo — use o espaço necessário para desenvolver bem cada ideia.',
  }

  const hookInstruction = hook
    ? `━━━ HOOK OBRIGATÓRIO — SLIDE 1 ━━━\nO slide 1 DEVE COMEÇAR com exatamente esta frase:\n"${hook}"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : ''

  const styleRulesFormatted = expert.styleRules.length > 0
    ? `Regras específicas do expert:\n${expert.styleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : ''

  return {
    'expert.displayName':        expert.displayName,
    'expert.handle':             expert.handle,
    'expert.niche':              expert.niche,
    'expert.bioShort':           expert.bioShort,
    'expert.productName':        expert.productName,
    'expert.productCta':         expert.productCta,
    'expert.styleRules':         styleRulesFormatted,
    'expert.authorSlideTemplate': expert.authorSlideTemplate,
    'expert.ctaFinalTemplate':   expert.ctaFinalTemplate,
    topic,
    hook:                        hook ?? '',
    hookInstruction,
    textLengthInstruction:       textLengthInstruction[textLength],
    date,
    year,
  }
}

function frankAntiClicheRules(): string {
  return `
REGRAS ANTI-REPETIÇÃO (OBRIGATÓRIAS):
- Slide 9 ("proof") deve usar prova contextual ao tema/público, com situação real.
- Evite analogias prontas e repetidas.
- PROIBIDO usar como "prova genérica": Ferrari, avião, médico/cirurgião, foguete.
- Se citar analogia, ela deve nascer do contexto do nicho e do tópico deste carrossel.
`.trim()
}

// ─── SSE events ───────────────────────────────────────────────────────────────

export type SSEEvent =
  | { chunk: string; slidesGenerated: number }
  | { retrying: true; waitSeconds: number; attempt: number }
  | { done: true; topic: string; caption: string; slides: unknown[]; modelUsed: string; tokenUsage?: TokenUsage }
  | { error: string }

// ─── Função principal ─────────────────────────────────────────────────────────

export interface GenerateOptions {
  templateId: string
  topic: string
  hook?: string
  splitTitle?: string
  splitSubtitle?: string
  expert: ExpertConfig
  providerId: ProviderId
  apiKey: string
  supabase: SupabaseClient
  contentOptions?: ContentOptions
  modelOverride?: string
}

function extractFirstJsonBlock(input: string): string | null {
  const match = input.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

async function repairJsonWithProvider(
  provider: ReturnType<typeof createProvider>,
  model: string,
  raw: string
): Promise<any> {
  const repairSystem = `You are a strict JSON repair tool.
Return only valid JSON.
Do not add commentary, markdown, or code fences.
Preserve the original meaning and fields.`

  const repairUser = `Fix the following malformed JSON output to valid JSON.
Rules:
- Keep the same schema and keys.
- Ensure all strings are properly escaped.
- Remove trailing commas.
- Output only a single valid JSON object.

MALFORMED_JSON_START
${raw}
MALFORMED_JSON_END`

  let repaired = ''
  for await (const chunk of provider.streamText({
    system: repairSystem,
    user: repairUser,
    model,
  })) {
    repaired += chunk
  }

  const repairedJson = extractFirstJsonBlock(repaired)
  if (!repairedJson) throw new Error('Falha ao reparar JSON: bloco não encontrado')
  return JSON.parse(repairedJson)
}

export async function* generateWithTemplate({
  templateId,
  topic,
  hook,
  splitTitle,
  splitSubtitle,
  expert,
  providerId,
  apiKey,
  supabase,
  contentOptions = {},
  modelOverride,
}: GenerateOptions): AsyncGenerator<SSEEvent> {
  // Busca prompts no DB; se não encontrar, usa fallback hardcoded
  const { system: systemTemplate, user: userTemplate, model } =
    await fetchPrompts(templateId, providerId, supabase)

  const isSplit = templateId === 'positivo-negativo'
  const vars = buildVars(expert, topic, hook, contentOptions)

  const systemPrompt = systemTemplate
    ? interpolate(systemTemplate, vars)
    : isSplit
      ? buildSplitSystemPrompt(expert)
      : buildSystemPrompt(expert, contentOptions)

  const userPrompt = userTemplate
    ? interpolate(userTemplate, vars)
    : isSplit
      ? buildSplitUserPrompt(topic, splitTitle || hook, splitSubtitle)
      : buildUserPrompt(topic, hook, contentOptions)

  const isFrankTemplate = templateId === 'frank-costa-10'
  const guardedSystemPrompt = isFrankTemplate
    ? `${systemPrompt}\n\n${frankAntiClicheRules()}`
    : systemPrompt
  const guardedUserPrompt = isFrankTemplate
    ? `${userPrompt}\n\n${frankAntiClicheRules()}`
    : userPrompt

  const provider = createProvider(providerId, apiKey)
  const resolvedModel = modelOverride?.trim() || model || provider.defaultModel

  let accumulated = ''
  let tokenUsage: TokenUsage | undefined

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      accumulated = ''
      tokenUsage = undefined

      for await (const chunk of provider.streamText({
        system: guardedSystemPrompt,
        user: guardedUserPrompt,
        model: resolvedModel,
        onUsage: (usage) => {
          tokenUsage = usage
        },
      })) {
        accumulated += chunk
        const slidesGenerated = (accumulated.match(/"num"\s*:/g) || []).length
        yield { chunk, slidesGenerated }
      }

      const jsonMatch = extractFirstJsonBlock(accumulated)
      if (!jsonMatch) throw new Error('A IA não retornou JSON válido')

      let parsed: any
      try {
        parsed = JSON.parse(jsonMatch)
      } catch {
        // Fallback: tenta reparar automaticamente quando a IA quebra JSON (aspas/trailing comma/etc.)
        parsed = await repairJsonWithProvider(provider, resolvedModel, jsonMatch)
      }

      yield {
        done: true,
        topic: parsed.topic || topic,
        caption: parsed.caption || '',
        slides: (parsed.slides || []).map((s: unknown) => ({ ...(s as object), approved: false })),
        modelUsed: resolvedModel,
        tokenUsage,
      }
      return

    } catch (err: unknown) {
      const e = err as { status?: number; error?: { type?: string }; message?: string }
      const isOverloaded = e?.status === 529 || e?.error?.type === 'overloaded_error'

      if (!isOverloaded || attempt === 2) {
        yield { error: e?.message || 'Erro ao gerar conteúdo' }
        return
      }

      const wait = (attempt + 1) * 8
      yield { retrying: true, waitSeconds: wait, attempt: attempt + 1 }
      await new Promise(r => setTimeout(r, wait * 1000))
    }
  }
}
