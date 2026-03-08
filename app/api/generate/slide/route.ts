import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getExpertForContext } from '@/lib/expert-config'
import { getAppKeys } from '@/lib/workspace'

// ─── Opções de tipo de prova e estilo de CTA ──────────────────────────────────

const PROOF_TYPE_INSTRUCTIONS: Record<string, string> = {
  A: 'Resultado de cliente real: descreva um cliente com perfil especifico do tema que fez algo e saiu de X para Y em Z semanas',
  B: 'Teste proprio com dado: mostre um teste com volume/escala real e a diferenca em numero especifico',
  C: 'Erro que custou caro: mostre alguem do publico que perdeu R$ X ou X horas por fazer algo errado ligado ao tema',
  D: 'Antes/depois de processo: retome uma rotina do tema e mostre o resultado com dado concreto',
  E: 'Benchmark do setor: compare a media do mercado com quem usa a abordagem do tema — numeros reais',
  F: 'Observacao de campo: nas ultimas X semanas analisando o tema, mostre um padrao ou insight encontrado',
}

const CTA_STYLE_INSTRUCTIONS: Record<string, string> = {
  urgente:     'Tom urgente — o leitor precisa agir agora ou vai perder algo concreto. Use dados e prazo.',
  suave:       'Tom suave e acolhedor — convide sem pressao, mostre o beneficio de forma amigavel.',
  provocativo: 'Tom provocativo — desafie o leitor, faca uma pergunta que o incomoda, gere reflexao.',
  humor:       'Tom com humor cortante — use ironia ou auto-depreciacao inteligente, sem ser ofensivo.',
  direto:      'Tom ultra-direto — sem enrolacao, sem metafora. So o CTA e o beneficio. Menos de 3 frases.',
}

// ─── Interpolação de variáveis {{chave}} ──────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ─── Busca prompt no Supabase ─────────────────────────────────────────────────

async function fetchSlidePrompt(
  templateId: string,
  step: string,
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never
): Promise<string | null> {
  const { data } = await supabase
    .from('template_prompts')
    .select('prompt_text')
    .eq('template_id', templateId)
    .eq('step', step)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.prompt_text ?? null
}

// ─── Fallbacks hardcoded ──────────────────────────────────────────────────────

function fallbackSlide5(vars: Record<string, string>): string {
  return `Voce e ${vars['expert.displayName']} (@${vars['expert.handle']}), especialista em ${vars['expert.niche']}.
${vars['expert.bioShort']}

Gere um slide de apresentacao do autor adaptado ao tema do carrossel: "${vars['topic']}"

O slide deve:
- Apresentar quem voce e e sua credencial relevante para este tema
- Conectar sua expertise ao problema abordado no carrossel
- Tom pessoal, coloquial brasileiro, terminar com CTA para seguir
- Maximo 180 caracteres

Use *negrito* para frases-chicote e {destaque} para dados/valores.

Responda APENAS com JSON valido:
{
  "text": "texto do slide",
  "imagePrompt": "photorealistic warm professional portrait or natural workplace scene related to ${vars['topic']}, no text in image"
}`
}

function fallbackSlide9(vars: Record<string, string>): string {
  return `Voce e ${vars['expert.displayName']}, especialista em ${vars['expert.niche']}.

Gere o slide 9 (prova) de um carrossel sobre: "${vars['topic']}"
${vars['contextExtraLine']}
TIPO DE PROVA: ${vars['proofTypeInstruction']}

Regras: prova ligada ao tema, numero especifico, fechamento sobre processo+execucao, CTA suave, max 240 chars.
Tom coloquial brasileiro. Se usar analogia, escolha do nicho do tema.

Responda APENAS com JSON valido:
{
  "text": "texto do slide",
  "imagePrompt": "photorealistic scene of skilled expert using specialized tool fitting the topic '${vars['topic']}', no text in image"
}`
}

function fallbackSlide10(vars: Record<string, string>): string {
  return `Voce e ${vars['expert.displayName']} (@${vars['expert.handle']}).

Gere CTA final para carrossel sobre: "${vars['topic']}"
Produto: ${vars['expert.productName']} | CTA: ${vars['expert.productCta']}
Estilo: ${vars['ctaStyleInstruction']}
${vars['ctaActionsLine']}
Sem cliches. Max 200 chars. Use *negrito* e {destaque}.

Responda APENAS com JSON valido:
{
  "text": "texto do slide",
  "imagePrompt": "photorealistic scene of person relaxed at desk, business running smoothly, laptop and coffee, warm lighting, no text in image"
}`
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { slideNum, topic, proofType, contextExtra, ctaStyle, ctaActions } = await req.json()
    if (!slideNum || !topic) {
      return NextResponse.json({ error: 'slideNum e topic sao obrigatorios' }, { status: 400 })
    }
    const num = Number(slideNum)
    if (![5, 9, 10].includes(num)) {
      return NextResponse.json({ error: 'slideNum deve ser 5, 9 ou 10' }, { status: 400 })
    }

    const [appKeys, expert] = await Promise.all([
      getAppKeys(),
      getExpertForContext(user.id, supabase),
    ])

    if (!expert) {
      return NextResponse.json({ error: 'Perfil de expert nao encontrado.' }, { status: 400 })
    }

    const apiKey = appKeys.anthropicKey || process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'Chave Anthropic nao configurada.' }, { status: 400 })
    }

    // Variáveis para interpolação
    const proofTypeKey = proofType || 'A'
    const ctaStyleKey  = ctaStyle  || 'direto'
    const actions: string[] = Array.isArray(ctaActions) && ctaActions.length > 0 ? ctaActions : ['Salvar']

    const vars: Record<string, string> = {
      'expert.displayName':        expert.displayName,
      'expert.handle':             expert.handle,
      'expert.niche':              expert.niche,
      'expert.bioShort':           expert.bioShort,
      'expert.productName':        expert.productName,
      'expert.productCta':         expert.productCta,
      topic,
      proofTypeInstruction:  PROOF_TYPE_INSTRUCTIONS[proofTypeKey] || PROOF_TYPE_INSTRUCTIONS['A'],
      contextExtraLine:      contextExtra ? `\nContexto adicional: ${contextExtra}` : '',
      ctaStyleInstruction:   CTA_STYLE_INSTRUCTIONS[ctaStyleKey] || CTA_STYLE_INSTRUCTIONS['direto'],
      ctaActionsLine:        `Acoes de CTA escolhidas (use TODAS no slide, de forma natural): ${actions.join(' + ')}`,
    }

    // Busca prompt do Supabase; fallback para hardcoded
    const step = `slide-${num}`
    const dbPrompt = await fetchSlidePrompt('frank-costa-10', step, supabase)

    let prompt: string
    if (dbPrompt) {
      prompt = interpolate(dbPrompt, vars)
    } else {
      prompt = num === 5 ? fallbackSlide5(vars)
             : num === 9 ? fallbackSlide9(vars)
             :             fallbackSlide10(vars)
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude nao retornou JSON valido' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ text: parsed.text, imagePrompt: parsed.imagePrompt })
  } catch (err: any) {
    console.error('[generate/slide]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
