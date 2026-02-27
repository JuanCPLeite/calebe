'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sparkles, LayoutDashboard, Dna, ImageIcon, Users,
  Key, LayoutTemplate, ChevronRight, Zap, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { label: 'Gerar',            href: '/generate',        icon: Sparkles,       accent: true },
  { label: 'Dashboard',        href: '/dashboard',       icon: LayoutDashboard },
  { label: 'DNA Expert',       href: '/expert/dna',      icon: Dna },
  { label: 'Fotos Referência', href: '/expert/photos',   icon: ImageIcon },
  { label: 'Perfil & Público', href: '/expert/audience', icon: Users },
  { label: 'Tokens & APIs',    href: '/tokens',          icon: Key },
  { label: 'Templates',        href: '/templates',       icon: LayoutTemplate },
]

interface UserInfo {
  email: string
  displayName: string
  handle: string
  initials: string
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Busca perfil expert do DB
      const { data: expert } = await supabase
        .from('experts')
        .select('display_name, handle')
        .eq('user_id', user.id)
        .single()

      const displayName = expert?.display_name || user.email?.split('@')[0] || 'Usuário'
      const handle = expert?.handle || ''
      const initials = displayName
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

      setUserInfo({ email: user.email || '', displayName, handle, initials })
    }
    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-56 min-w-56 h-screen bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-600">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-zinc-100">
          Carousel Studio
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ label, href, icon: Icon, accent }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
                active
                  ? accent
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
            {userInfo?.initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-100 truncate">
              {userInfo?.displayName || 'Carregando...'}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {userInfo?.handle || userInfo?.email || ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
