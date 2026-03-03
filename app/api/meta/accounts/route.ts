import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MetaAccount {
  igAccountId: string
  igUsername: string
  igName: string
  igPicture: string | null
  pageName: string
}

const META_VERSION = 'v21.0'
const META_BASE = `https://graph.facebook.com/${META_VERSION}`

function metaErrorMessage(err: any): string {
  const msg: string = err?.error?.message || err?.message || 'Erro desconhecido'
  if (msg.includes('Invalid OAuth') || msg.includes('OAuthException')) {
    return 'Token Meta inválido ou expirado. Gere um novo token no Meta for Developers.'
  }
  if (msg.includes('permission') || msg.includes('Permission')) {
    return 'Token sem permissão suficiente. Verifique as permissões pages_read_engagement e instagram_basic.'
  }
  return `Erro do Meta: ${msg}`
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('value')
      .eq('user_id', user.id)
      .eq('provider', 'meta_token')
      .single()

    if (!tokenRow?.value) {
      return NextResponse.json(
        { error: 'Token Meta não configurado. Salve o token primeiro.' },
        { status: 400 }
      )
    }

    const token = tokenRow.value

    const accounts: MetaAccount[] = []
    const seen = new Set<string>()

    // 1. Conta Instagram diretamente vinculada ao dono do token (perfil pessoal/do usuário)
    const meRes = await fetch(
      `${META_BASE}/me?fields=name,instagram_business_account&access_token=${token}`
    )
    const meData = await meRes.json()

    if (!meData.error) {
      const igId = meData.instagram_business_account?.id
      if (igId && !seen.has(igId)) {
        const igRes = await fetch(
          `${META_BASE}/${igId}?fields=name,username,profile_picture_url&access_token=${token}`
        )
        const igData = await igRes.json()
        if (!igData.error) {
          seen.add(igId)
          accounts.push({
            igAccountId: igId,
            igUsername: igData.username || '',
            igName: igData.name || '',
            igPicture: igData.profile_picture_url || null,
            pageName: meData.name || 'Conta do usuário',
          })
        }
      }
    }

    // 2. Contas Instagram vinculadas às Páginas do Facebook gerenciadas pelo token
    const pagesRes = await fetch(
      `${META_BASE}/me/accounts?fields=instagram_business_account,name&access_token=${token}`
    )
    const pagesData = await pagesRes.json()

    if (!pagesData.error) {
      for (const page of (pagesData.data || []) as any[]) {
        const igId = page.instagram_business_account?.id
        if (!igId || seen.has(igId)) continue

        const igRes = await fetch(
          `${META_BASE}/${igId}?fields=name,username,profile_picture_url&access_token=${token}`
        )
        const igData = await igRes.json()
        if (igData.error) continue

        seen.add(igId)
        accounts.push({
          igAccountId: igId,
          igUsername: igData.username || '',
          igName: igData.name || '',
          igPicture: igData.profile_picture_url || null,
          pageName: page.name || '',
        })
      }
    } else if (accounts.length === 0) {
      // Só retorna erro do Meta se não encontrou nada na etapa 1 também
      return NextResponse.json({ error: metaErrorMessage(pagesData) }, { status: 400 })
    }

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta Instagram de negócios encontrada para este token. Certifique-se de que sua conta está configurada como Conta Profissional no Instagram e vinculada ao Meta.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ accounts })
  } catch (err: any) {
    console.error('[meta/accounts]', err.message)
    return NextResponse.json({ error: `Erro interno: ${err.message}` }, { status: 500 })
  }
}
