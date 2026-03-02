import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null, authError: authError?.message, tokens: [] })
  }

  const { data: tokens, error: tokensError } = await supabase
    .from('user_tokens')
    .select('provider, updated_at')
    .eq('user_id', user.id)

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    tokens: tokens || [],
    tokensError: tokensError?.message,
  })
}
