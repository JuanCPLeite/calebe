'use client'

import Link from 'next/link'
import { Building2, Settings } from 'lucide-react'

export default function AdminHomePage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">Painel operacional da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/admin/workspaces"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Workspaces</h2>
          </div>
          <p className="text-xs text-zinc-500">Listar, criar e suspender clientes.</p>
        </Link>

        <Link
          href="/admin/settings"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          </div>
          <p className="text-xs text-zinc-500">Gerenciar chaves globais de IA da plataforma.</p>
        </Link>
      </div>
    </div>
  )
}
