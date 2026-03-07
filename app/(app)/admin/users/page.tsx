'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type UserRole = 'owner' | 'admin' | 'member'

interface UserRow {
  id: string
  role: UserRole
  workspace_id: string | null
  created_at: string | null
  email: string
  auth_created_at: string | null
  workspace: { name: string; slug: string } | null
}

interface Workspace {
  id: string
  name: string
  slug: string
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | string>('all')

  async function loadWorkspaces() {
    const res = await fetch('/api/admin/workspaces')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Falha ao listar workspaces')
    setWorkspaces(data.workspaces || [])
  }

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (workspaceFilter !== 'all') params.set('workspaceId', workspaceFilter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao listar usuários')
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  async function loadAll() {
    await Promise.all([loadWorkspaces(), loadUsers()])
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function updateUser(id: string, payload: Record<string, unknown>) {
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Falha ao atualizar usuário')
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, role: data.profile.role, workspace_id: data.profile.workspace_id }
          : u
      )
    )
  }

  async function handleRoleChange(user: UserRow, role: UserRole) {
    try {
      await updateUser(user.id, { role })
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar role')
    }
  }

  async function handleWorkspaceChange(user: UserRow, workspaceId: string) {
    try {
      await updateUser(user.id, { workspaceId: workspaceId || null })
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar workspace')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerenciamento de roles e workspace padrão</p>
        </div>
        <Button onClick={loadAll} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xs"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Role: todos</option>
            <option value="owner">owner</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Workspace: todos</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <Button onClick={loadUsers} variant="outline" className="border-zinc-700 text-zinc-200">
            Filtrar
          </Button>
        </div>

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
                  <th className="py-2 pr-3">Workspace</th>
                  <th className="py-2 pr-3">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-900">
                    <td className="py-3 pr-3">
                      <p className="text-zinc-100 font-medium">{u.email || '(sem email)'}</p>
                      <p className="text-xs text-zinc-500">{u.id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={u.workspace_id || ''}
                        onChange={(e) => handleWorkspaceChange(u, e.target.value)}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100"
                      >
                        <option value="">Sem workspace</option>
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-zinc-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-500">
                      Nenhum usuário encontrado.
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
