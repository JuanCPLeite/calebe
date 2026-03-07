import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getExpertForContext } from '@/lib/expert-config'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verifica se já existe expert ativo/configurado no contexto atual
  const expert = await getExpertForContext(user.id, supabase)

  if (!expert?.displayName) {
    redirect('/expert/dna?onboarding=1')
  }

  redirect('/generate')
}
