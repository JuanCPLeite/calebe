'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExpertOption {
  id: string
  display_name: string
  handle: string
}

export function ExpertSwitcher() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [activeExpertId, setActiveExpertId] = useState('')
  const [experts, setExperts] = useState<ExpertOption[]>([])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/experts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar experts')
      const options = (data.experts || []) as ExpertOption[]
      setExperts(options)
      setActiveExpertId(data.activeExpertId || options[0]?.id || '')
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar experts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const showSelector = useMemo(() => experts.length > 0, [experts.length])

  async function handleChange(nextId: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/experts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeExpertId: nextId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao trocar expert')
      setActiveExpertId(nextId)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao trocar expert')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    const displayName = window.prompt('Nome do novo expert:')
    if (!displayName?.trim()) return
    const handle = window.prompt('Handle (opcional):') || ''

    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), handle: handle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao criar expert')
      await load()
      router.push('/expert/dna')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao criar expert')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando expert...
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showSelector && (
        <>
          <span className="text-xs text-zinc-500">Expert</span>
          <select
            value={activeExpertId}
            onChange={(e) => handleChange(e.target.value)}
            disabled={saving || creating}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 min-w-52"
          >
            {experts.map((expert) => (
              <option key={expert.id} value={expert.id}>
                {expert.display_name || 'Sem nome'} {expert.handle ? `(${expert.handle})` : ''}
              </option>
            ))}
          </select>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
        </>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={handleCreate}
        disabled={creating || saving}
        className="h-8 border-zinc-700 text-zinc-200"
      >
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Novo
      </Button>

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
