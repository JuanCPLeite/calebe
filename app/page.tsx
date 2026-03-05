import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verifica se o usuário já tem perfil configurado
  const { data: expert } = await supabase
    .from('experts')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!expert?.display_name) {
    redirect('/expert/dna?onboarding=1')
  }

  redirect('/generate')
}
