'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type MemberRole = 'admin' | 'member'

interface WorkspaceInfo {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
}

interface TeamLimits {
  memberLimit: number
  expertLimit: number
  monthlyPostCredits: number
  usedCredits: number
  remainingCredits: number
  usagePercent: number
}

interface MemberRow {
  id: string
  user_id: string
  role: MemberRole
  invited_by: string | null
  created_at: string
  email: string
  isCurrentUser: boolean
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [limits, setLimits] = useState<TeamLimits | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/team/members')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar equipe')
      setWorkspace(json.workspace || null)
      setLimits(json.limits || null)
      setMembers(json.members || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar equipe')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      setError('Informe o email para convidar')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao convidar membro')

      setInviteEmail('')
      setInviteRole('member')
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao convidar membro')
    } finally {
      setSaving(false)
    }
  }

  async function updateRole(member: MemberRow, role: MemberRole) {
    setError('')
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao atualizar role')
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar role')
    }
  }

  async function removeMember(member: MemberRow) {
    const confirmed = window.confirm(`Remover ${member.email || member.user_id} da equipe?`)
    if (!confirmed) return

    setError('')
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao remover membro')
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao remover membro')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Equipe</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie membros do workspace atual</p>
        </div>
        <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {workspace && (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-zinc-200">
              Workspace: <span className="font-semibold">{workspace.name}</span> ({workspace.slug})
            </p>
            <Badge className={workspace.active ? 'bg-green-700/30 text-green-300' : 'bg-red-700/30 text-red-300'}>
              {workspace.active ? 'Ativo' : 'Suspenso'}
            </Badge>
            <Badge className="bg-zinc-800 text-zinc-200">Plano: {workspace.plan}</Badge>
            {limits && (
              <>
                <Badge className="bg-zinc-800 text-zinc-200">Membros: {members.length}/{limits.memberLimit}</Badge>
                <Badge className={limits.usagePercent >= 100 ? 'bg-red-700/30 text-red-300' : limits.usagePercent >= 80 ? 'bg-amber-700/30 text-amber-300' : 'bg-zinc-800 text-zinc-200'}>
                  Créditos: {limits.usedCredits}/{limits.monthlyPostCredits} ({limits.usagePercent}%)
                </Badge>
              </>
            )}
          </div>
        </div>
      )}

      {limits && limits.usagePercent >= 80 && (
        <div className={`rounded-xl border px-4 py-3 ${limits.usagePercent >= 100 ? 'border-red-700/40 bg-red-950/20' : 'border-amber-700/40 bg-amber-950/20'}`}>
          <p className={`text-xs font-medium ${limits.usagePercent >= 100 ? 'text-red-300' : 'text-amber-300'}`}>
            {limits.usagePercent >= 100 ? 'Créditos do mês esgotados.' : 'Uso de créditos alto para este mês.'}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {limits.usedCredits}/{limits.monthlyPostCredits} usados. Considere upgrade de plano para evitar bloqueio.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 max-w-4xl">
        <p className="text-sm font-medium text-zinc-100">Convidar membro</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@empresa.com"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 md:col-span-2"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as MemberRole)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button
          onClick={inviteMember}
          disabled={saving || (limits ? members.length >= limits.memberLimit : false)}
          className="bg-violet-600 hover:bg-violet-500"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Convidar
        </Button>
        {limits && members.length >= limits.memberLimit && (
          <p className="text-xs text-amber-400">
            Limite de membros do plano atingido ({members.length}/{limits.memberLimit}).
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Entrou em</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-zinc-900">
                    <td className="py-3 pr-3">
                      <p className="text-zinc-100 font-medium">{member.email || '(sem email)'}</p>
                      <p className="text-xs text-zinc-500">{member.user_id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member, e.target.value as MemberRole)}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100"
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-zinc-400">
                      {new Date(member.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 text-zinc-200"
                        onClick={() => removeMember(member)}
                        disabled={member.isCurrentUser}
                      >
                        <Trash2 className="w-4 h-4" /> Remover
                      </Button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-500">
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
