import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Durante build/SSG sem credenciais — retorna mock seguro
    // Em produção, as variáveis sempre estarão definidas
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ error: { message: 'Supabase não configurado' } }),
        signUp: async () => ({ error: { message: 'Supabase não configurado' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase não configurado' } }),
        signOut: async () => {},
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
        insert: async () => ({ error: null }),
        upsert: async () => ({ error: null }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
          download: async () => ({ data: null, error: null }),
          createSignedUrl: async () => ({ data: null, error: null }),
        }),
      },
    } as any
  }

  return createBrowserClient(url, key)
}
