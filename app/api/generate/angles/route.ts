import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getAppKeys } from '@/lib/workspace'

export interface AngleOption {
  title: string
  subtitle: string
  description: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { topic } = await req.json()
    if (!topic) return NextResponse.json({ error: 'topic obrigatório' }, { status: 400 })

    const appKeys = await getAppKeys()
    const key = appKeys.anthropicKey || process.env.ANTHROPIC_API_KEY
    if (!key) return NextResponse.json({ error: 'Chave Anthropic não configurada' }, { status: 500 })

    const client = new Anthropic({ apiKey: key })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analise o tema "${topic}" e gere 5 ângulos distintos para um carrossel comparativo "X vs Y" no Instagram.

Cada ângulo deve ser:
- Um contraste claro e impactante entre duas abordagens opostas
- Específico ao tema "${topic}" — não genérico
- Variado: explore comportamentos, mentalidades, resultados, abordagens diferentes

Retorne APENAS JSON válido, sem markdown, sem explicações:
{
  "angles": [
    {
      "title": "OPÇÃO A VS. OPÇÃO B",
      "subtitle": "Uma frase curta que desperta curiosidade sobre este contraste",
      "description": "Uma linha sobre o que será comparado nos slides"
    }
  ]
}`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ angles: [] })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ angles: (parsed.angles || []) as AngleOption[] })
  } catch (err: any) {
    console.error('[angles]', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar ângulos' }, { status: 500 })
  }
}
