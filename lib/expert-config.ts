// Configuração do expert
// Sprint 1: hardcoded para Juan Carlos
// Sprint 3 (atual): multi-tenant via Supabase

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ExpertConfig {
  id: string
  displayName: string
  handle: string
  igAccountId: string
  igAccessToken: string
  igTokenEnv: string
  highlightColor: string
  bioShort: string
  niche: string
  productName: string
  productCta: string
  authorSlideTemplate: string
  ctaFinalTemplate: string
  styleRules: string[]
}

// Template padrão de onboarding (base Juan Carlos)
export const JUAN_CARLOS_TEMPLATE: ExpertConfig = {
  id: 'juancarlos',
  displayName: 'Juan Carlos',
  handle: '@juancarlos.ai',
  igAccountId: '17841401220225117',
  igAccessToken: '',
  igTokenEnv: 'IG_TOKEN_JUANCARLOS',
  highlightColor: '#9B59FF',

  bioShort: 'Ajudo empresários e profissionais a automatizarem processos com IA pra trabalhar MENOS, vender MAIS e escalar o negócio sem contratar mais gente.',

  niche: 'Automações com IA para negócios brasileiros',

  productName: 'Automações na Prática',
  productCta: 'Clica no link da bio e bora automatizar.',

  authorSlideTemplate: `Opa, segura aí rapidão...

Se você tá gostando desse conteúdo, muito prazer...
EU SOU O JUAN CARLOS.

Ajudo empresários e profissionais a automatizarem
processos com IA pra trabalhar MENOS, vender MAIS
e escalar o negócio sem contratar mais gente.

Me segue aí pra não perder a próxima, belé?
@juancarlos.ai

Bora para o próximo slide...`,

  ctaFinalTemplate: `Se tu chegou até aqui, já saiu na frente de *90% dos empresários*.

A maioria [o que a maioria fez/pensou sobre o tema].
Tu entendeu o mecanismo.

Se isso foi útil pra ti:

{↗️ Compartilha} com um empresário que precisa ver isso

{👆 Me segue} pra não perder a próxima

Conteúdo assim toda semana — sem enrolação.

@juancarlos.ai`,

  styleRules: [
    'USE SEMPRE "tu" para falar com o leitor — nunca "você" (exceto no Slide 5)',
    'Tom: direto, coloquial brasileiro, urgente, com autoridade',
    'Expressões: "bora", "cara", "né", "belé", "tá"',
    'Dados SEMPRE específicos — nunca "muito caro", sempre "R$ X" ou "X horas"',
    'Padrão obrigatório em pelo menos 1 slide: "A pergunta não é X. A pergunta é Y."',
    'NUNCA use: "venha conferir", "não perca", "incrível", "revolucionário"',
  ],
}

// Converte row do DB para ExpertConfig
export function toExpertConfig(row: Record<string, unknown>): ExpertConfig {
  return {
    id: (row.id as string) || '',
    displayName: (row.display_name as string) || '',
    handle: (row.handle as string) || '',
    igAccountId: (row.ig_account_id as string) || '',
    igAccessToken: (row.ig_access_token as string) || '',
    igTokenEnv: '',
    highlightColor: (row.highlight_color as string) || '#9B59FF',
    bioShort: (row.bio_short as string) || '',
    niche: (row.niche as string) || '',
    productName: (row.product_name as string) || '',
    productCta: (row.product_cta as string) || '',
    authorSlideTemplate: (row.author_slide_template as string) || '',
    ctaFinalTemplate: (row.cta_final_template as string) || '',
    styleRules: (row.style_rules as string[]) || [],
  }
}

export async function getActiveExpertRow(
  userId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id, active_expert_id')
    .eq('id', userId)
    .maybeSingle()

  const activeExpertId = (profile as Record<string, unknown> | null)?.active_expert_id as string | null | undefined
  if (activeExpertId) {
    const { data: activeExpert, error: activeError } = await supabase
      .from('experts')
      .select('*')
      .eq('id', activeExpertId)
      .maybeSingle()
    if (!activeError && activeExpert) return activeExpert as Record<string, unknown>
  }

  const workspaceId = (profile as Record<string, unknown> | null)?.workspace_id as string | null | undefined
  if (!workspaceId) return null

  const { data: fallback, error } = await supabase
    .from('experts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !fallback) return null
  return fallback as Record<string, unknown>
}

// Compatibilidade: retorna o expert ativo no contexto atual
export async function getExpertFromDB(
  userId: string,
  supabase: SupabaseClient
): Promise<ExpertConfig | null> {
  const row = await getActiveExpertRow(userId, supabase)
  if (!row) return null
  return toExpertConfig(row)
}

// Busca expert do workspace atual quando não há expert ligado diretamente ao usuário
export async function getExpertForContext(
  userId: string,
  supabase: SupabaseClient
): Promise<ExpertConfig | null> {
  const row = await getActiveExpertRow(userId, supabase)
  if (!row) return null
  return toExpertConfig(row)
}

// Compatibilidade legada (sem auth)
export function getExpertBySlug(_slug: string): ExpertConfig {
  return JUAN_CARLOS_TEMPLATE
}

export function getIgToken(expert: ExpertConfig): string {
  if (expert.igTokenEnv) {
    return process.env[expert.igTokenEnv] || ''
  }
  return ''
}
