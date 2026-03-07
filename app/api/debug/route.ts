import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppKeys } from '@/lib/workspace'
import { getExpertForContext } from '@/lib/expert-config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null, authError: authError?.message, appSettings: null })
  }

  const [appKeys, expert] = await Promise.all([
    getAppKeys(),
    getExpertForContext(user.id, supabase),
  ])

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    appSettings: {
      anthropic: Boolean(appKeys.anthropicKey),
      google: Boolean(appKeys.googleKey),
      openai: Boolean(appKeys.openaiKey),
      exa: Boolean(appKeys.exaKey),
    },
    expertMeta: {
      hasIgAccountId: Boolean(expert?.igAccountId),
      hasIgAccessToken: Boolean(expert?.igAccessToken),
    },
  })
}
