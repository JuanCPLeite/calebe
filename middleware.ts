import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublicPath = pathname.startsWith('/login') || pathname.startsWith('/auth/callback')
  const isApiRoute = pathname.startsWith('/api/')
  const isAdminRoute = pathname.startsWith('/admin')
  const isTeamRoute = pathname.startsWith('/team')
  const isLegacyTokensRoute = pathname === '/tokens'

  // Nao autenticado -> login (exceto rotas publicas e API)
  if (!user && !isPublicPath && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Ja logado tentando acessar /login -> redireciona para /generate
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/generate'
    return NextResponse.redirect(url)
  }

  // /tokens foi removido: owner vai para admin settings, demais para generate
  if (user && isLegacyTokensRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'owner' ? '/admin/settings' : '/generate'
    return NextResponse.redirect(url)
  }

  // Rotas /admin/* e /team/* -> autorizacao por role
  if (user && (isAdminRoute || isTeamRoute) && !isApiRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (isAdminRoute && profile?.role !== 'owner') {
      const url = request.nextUrl.clone()
      url.pathname = '/generate'
      return NextResponse.redirect(url)
    }

    if (isTeamRoute && profile?.role !== 'owner' && profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/generate'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
