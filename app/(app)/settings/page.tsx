'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function UserSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/user/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar configurações')
        setForm((prev) => ({
          ...prev,
          email: data.email || '',
          displayName: data.displayName || '',
        }))
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar configurações')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function saveProfile() {
    setSavingProfile(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar perfil')
      setSuccess('Perfil atualizado com sucesso.')
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    setSavingPassword(true)
    setError('')
    setSuccess('')
    try {
      if (!form.newPassword || form.newPassword.length < 8) {
        throw new Error('A nova senha deve ter pelo menos 8 caracteres.')
      }
      if (form.newPassword !== form.confirmPassword) {
        throw new Error('A confirmação de senha não confere.')
      }

      const { error: authError } = await supabase.auth.updateUser({ password: form.newPassword })
      if (authError) throw authError

      setForm((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }))
      setSuccess('Senha atualizada com sucesso.')
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando configurações...
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">Dados da conta e segurança</p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100">Perfil</h2>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500">E-mail</label>
          <Input value={form.email} disabled className="bg-zinc-800/60 border-zinc-700 text-zinc-400" />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500">Nome de exibição</label>
          <Input
            value={form.displayName}
            onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            placeholder="Seu nome"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
        </div>

        <Button onClick={saveProfile} disabled={savingProfile} className="bg-violet-600 hover:bg-violet-500">
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar perfil
        </Button>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100">Segurança</h2>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500">Nova senha</label>
          <Input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            placeholder="Mínimo 8 caracteres"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500">Confirmar nova senha</label>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Repita a nova senha"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
        </div>

        <Button onClick={savePassword} disabled={savingPassword} variant="outline" className="border-zinc-700 text-zinc-100">
          {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Atualizar senha
        </Button>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}
    </div>
  )
}
