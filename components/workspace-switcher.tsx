'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface WorkspaceOption {
  id: string
  name: string
  slug: string
  active: boolean
  role: 'owner' | 'admin' | 'member'
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('')
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/workspace/context')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar workspaces')

        const options = json.workspaces || []
        setWorkspaces(options)
        setCurrentWorkspaceId(json.currentWorkspaceId || options[0]?.id || '')
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar selector')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const showSelector = useMemo(() => workspaces.length > 1, [workspaces])

  async function handleChange(nextWorkspaceId: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/workspace/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: nextWorkspaceId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao trocar workspace')

      setCurrentWorkspaceId(nextWorkspaceId)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao trocar workspace')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando workspace...
      </div>
    )
  }

  if (!showSelector) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Workspace</span>
      <select
        value={currentWorkspaceId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 min-w-56"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name} ({workspace.slug})
            {!workspace.active ? ' [suspenso]' : ''}
          </option>
        ))}
      </select>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
