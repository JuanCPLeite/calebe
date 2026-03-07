import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExpertForContext } from '@/lib/expert-config'

const META_BASE = 'https://graph.facebook.com/v21.0'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const expert = await getExpertForContext(user.id, supabase)
  const token = expert?.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
  if (!token) return NextResponse.json({ error: 'Token não configurado' }, { status: 400 })

  const [me, accounts, businesses, igAccounts] = await Promise.all([
    fetch(`${META_BASE}/me?fields=id,name,instagram_business_account&access_token=${token}`).then(r => r.json()),
    fetch(`${META_BASE}/me/accounts?fields=id,name,instagram_business_account&access_token=${token}`).then(r => r.json()),
    fetch(`${META_BASE}/me/businesses?fields=id,name,instagram_business_accounts{id,name,username}&access_token=${token}`).then(r => r.json()),
    fetch(`${META_BASE}/me/instagram_accounts?fields=id,name,username,profile_picture_url&access_token=${token}`).then(r => r.json()),
  ])

  return NextResponse.json({ me, accounts, businesses, igAccounts })
}
