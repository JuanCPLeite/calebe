'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, X, Copy, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type LogLevel = 'info' | 'warn' | 'error'

interface LogItem {
  id: string
  workspace_id: string | null
  user_id: string | null
  event: string
  level: LogLevel
  payload: Record<string, unknown>
  created_at: string
  workspace: { name: string; slug: string } | null
}

export default function AdminLogsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogItem[]>([])
  const [level, setLevel] = useState<'all' | LogLevel>('all')
  const [event, setEvent] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [days, setDays] = useState<'1' | '7' | '30'>('7')
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (level !== 'all') params.set('level', level)
      if (event.trim()) params.set('event', event.trim())
      if (workspaceId.trim()) params.set('workspaceId', workspaceId.trim())
      params.set('days', days)
      params.set('limit', '200')

      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar logs')
      setLogs(data.logs || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter((l) => {
      const payloadText = JSON.stringify(l.payload || {}).toLowerCase()
      return (
        l.event.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q) ||
        (l.workspace?.name || '').toLowerCase().includes(q) ||
        payloadText.includes(q)
      )
    })
  }, [logs, search])

  function levelBadge(lvl: LogLevel) {
    if (lvl === 'error') return 'bg-red-700/30 text-red-300'
    if (lvl === 'warn') return 'bg-amber-700/30 text-amber-300'
    return 'bg-blue-700/30 text-blue-300'
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedLog(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleCopyPayload() {
    if (!selectedLog) return
    await navigator.clipboard.writeText(JSON.stringify(selectedLog.payload || {}, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">System Logs</h1>
          <p className="text-sm text-zinc-500 mt-1">Eventos da plataforma (owner only)</p>
        </div>
        <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'all' | LogLevel)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Nível: todos</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>

          <Input
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder="Evento exato (ex: publish.error)"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xs"
          />

          <Input
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="workspace_id (opcional)"
            className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xs"
          />

          <select
            value={days}
            onChange={(e) => setDays(e.target.value as '1' | '7' | '30')}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="1">Últimas 24h</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>

          <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
            Aplicar filtros
          </Button>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Busca local em evento/payload/workspace..."
          className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xl"
        />

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
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Nível</th>
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Workspace</th>
                  <th className="py-2 pr-3">Payload</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-900 align-top hover:bg-zinc-900/40 cursor-pointer"
                    onClick={() => setSelectedLog(item)}
                  >
                    <td className="py-3 pr-3 text-zinc-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge className={levelBadge(item.level)}>{item.level}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-zinc-100">{item.event}</td>
                    <td className="py-3 pr-3 text-zinc-300">
                      {item.workspace ? item.workspace.name : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-xs text-zinc-400 max-w-[560px] truncate">
                        {JSON.stringify(item.payload || {})}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 text-zinc-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLog(item)
                        }}
                      >
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      Nenhum log encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-zinc-700 bg-zinc-900 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{selectedLog.event}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(selectedLog.created_at).toLocaleString('pt-BR')} · {selectedLog.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={levelBadge(selectedLog.level)}>{selectedLog.level}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-200"
                  onClick={handleCopyPayload}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Copiar JSON'}
                </Button>
                <button
                  className="text-zinc-400 hover:text-zinc-100"
                  onClick={() => setSelectedLog(null)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 space-y-2 overflow-y-auto">
              <p className="text-xs text-zinc-500">
                Workspace: {selectedLog.workspace?.name || '—'} ({selectedLog.workspace_id || 'sem id'})
              </p>
              <p className="text-xs text-zinc-500">User ID: {selectedLog.user_id || '—'}</p>
              <pre className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3 whitespace-pre-wrap break-words">
                {JSON.stringify(selectedLog.payload || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
