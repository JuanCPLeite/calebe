'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, CheckCircle2, Clock, Search, Loader2, Instagram, HelpCircle, X, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MetaAccount {
  igAccountId: string
  igUsername: string
  igName: string
  igPicture: string | null
  pageName: string
}

interface HelpStep {
  text: string
  link?: { label: string; url: string }
}

interface HelpContent {
  title: string
  steps: HelpStep[]
  warning?: string
}

const HELP: Record<string, HelpContent> = {
  anthropic: {
    title: 'Como obter sua chave da Anthropic',
    steps: [
      { text: 'Acesse o Console da Anthropic.', link: { label: 'console.anthropic.com', url: 'https://console.anthropic.com' } },
      { text: 'Faça login ou crie uma conta gratuita.' },
      { text: 'No menu lateral, clique em "API Keys".' },
      { text: 'Clique em "Create Key", dê um nome e confirme.' },
      { text: 'Copie a chave gerada (começa com sk-ant-) e cole aqui.' },
    ],
  },
  google: {
    title: 'Como obter sua chave do Google Gemini',
    steps: [
      { text: 'Acesse o Google AI Studio.', link: { label: 'aistudio.google.com', url: 'https://aistudio.google.com' } },
      { text: 'Faça login com sua conta Google.' },
      { text: 'No menu lateral, clique em "Get API key".' },
      { text: 'Clique em "Create API key in new project".' },
      { text: 'Copie a chave gerada (começa com AIzaSy) e cole aqui.' },
    ],
  },
  exa: {
    title: 'Como obter sua chave da EXA Search',
    steps: [
      { text: 'Acesse o site da EXA.', link: { label: 'exa.ai', url: 'https://exa.ai' } },
      { text: 'Clique em "Sign up" e crie uma conta.' },
      { text: 'No dashboard, vá em "API Keys".' },
      { text: 'Clique em "Create new key".' },
      { text: 'Copie a chave gerada (começa com exa_) e cole aqui.' },
    ],
  },
  meta_token: {
    title: 'Como obter o Meta Graph API Token',
    steps: [
      { text: 'Acesse o Meta for Developers e crie sua conta.', link: { label: 'developers.facebook.com', url: 'https://developers.facebook.com' } },
      { text: 'Clique em "Meus Apps" → "Criar app" → tipo "Empresa".' },
      { text: 'No painel do app, acesse "Ferramentas" → "Graph API Explorer".' },
      { text: 'No topo, selecione seu app no dropdown.' },
      { text: 'Clique em "Gerar token de acesso do usuário" e marque as permissões: instagram_basic, instagram_content_publish, pages_read_engagement e pages_show_list.' },
      { text: 'Clique em "Gerar token", copie o valor e cole aqui.' },
      {
        text: 'Para sua conta Instagram aparecer no seletor, ela precisa estar no modo Profissional e vinculada a uma Página do Facebook.',
        link: { label: 'Fazer isso no Meta Business Suite', url: 'https://business.facebook.com' },
      },
    ],
    warning: 'O token gerado pelo Graph API Explorer expira em ~60 dias. Para produção, gere um token de longa duração via endpoint /oauth/access_token.',
  },
}

const TOKEN_FIELDS = [
  {
    provider: 'anthropic',
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    hint: 'Obrigatório — gera o conteúdo dos slides e faz a busca de tópicos trending.',
  },
  {
    provider: 'google',
    label: 'Google Gemini',
    placeholder: 'AIzaSy...',
    hint: 'Obrigatório — gera as imagens de cada slide via Gemini.',
  },
  {
    provider: 'exa',
    label: 'EXA Search',
    placeholder: 'exa_...',
    hint: 'Opcional — busca neural avançada para tópicos trending. Sem ela, o Claude já faz a busca.',
    optional: true,
  },
]

function HelpModal({ content, onClose }: { content: HelpContent; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">{content.title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {content.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center mt-0.5">
                <span className="text-[10px] font-bold text-violet-300">{i + 1}</span>
              </div>
              <div className="text-xs text-zinc-300 leading-relaxed">
                {step.text}
                {step.link && (
                  <a
                    href={step.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  >
                    {step.link.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}

          {content.warning && (
            <div className="mt-4 flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              <span className="text-amber-400 text-xs">⚠️</span>
              <p className="text-xs text-amber-300/80">{content.warning}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TokensPage() {
  const supabase = createClient()

  // Tokens genéricos
  const [values, setValues] = useState<Record<string, string>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Meta
  const [metaToken, setMetaToken] = useState('')
  const [showMetaToken, setShowMetaToken] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)

  // Modal de ajuda
  const [helpOpen, setHelpOpen] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('provider, value')
        .eq('user_id', user.id)

      const map: Record<string, string> = {}
      for (const t of tokens || []) map[t.provider] = t.value
      setValues(map)
      setMetaToken(map['meta_token'] || '')
      setSelectedAccountId(map['meta_account_id'] || '')
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const [provider, value] of Object.entries(values)) {
      if (!value.trim()) continue
      await supabase.from('user_tokens').upsert(
        { user_id: user.id, provider, value: value.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,provider' }
      )
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleFetchAccounts() {
    setLoadingAccounts(true)
    setAccountError('')
    setMetaAccounts([])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingAccounts(false); return }

    await supabase.from('user_tokens').upsert(
      { user_id: user.id, provider: 'meta_token', value: metaToken.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' }
    )

    const res = await fetch('/api/meta/accounts')
    const data = await res.json()

    if (data.error) {
      setAccountError(data.error)
      setLoadingAccounts(false)
      return
    }

    setMetaAccounts(data.accounts)

    if (data.accounts.length === 1) {
      await selectAccount(data.accounts[0].igAccountId, user.id)
    }

    setLoadingAccounts(false)
  }

  async function selectAccount(igAccountId: string, userId?: string) {
    setSavingMeta(true)
    setSelectedAccountId(igAccountId)

    let uid = userId
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      uid = user?.id
    }
    if (!uid) { setSavingMeta(false); return }

    await supabase.from('user_tokens').upsert(
      { user_id: uid, provider: 'meta_account_id', value: igAccountId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' }
    )

    setSavingMeta(false)
    setMetaSaved(true)
    setTimeout(() => setMetaSaved(false), 2000)
  }

  const metaTokenFilled = !!(metaToken.trim())

  return (
    <div className="p-8 max-w-2xl">
      {/* Modal de ajuda */}
      {helpOpen && HELP[helpOpen] && (
        <HelpModal content={HELP[helpOpen]} onClose={() => setHelpOpen(null)} />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Tokens & APIs</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Suas chaves são salvas com segurança e acessadas somente por você.
        </p>
      </div>

      {/* Tokens genéricos */}
      <div className="space-y-4">
        {TOKEN_FIELDS.map(({ provider, label, placeholder, hint, optional }) => {
          const filled = !!(values[provider]?.trim())
          return (
            <div key={provider} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-zinc-200">{label}</label>
                  {optional && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">
                      opcional
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setHelpOpen(provider)}
                    className="text-zinc-600 hover:text-violet-400 transition-colors"
                    title="Como obter este token"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${filled ? 'text-green-400' : optional ? 'text-zinc-600' : 'text-zinc-500'}`}>
                  {filled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {filled ? 'Configurado' : optional ? 'Não configurado' : 'Pendente'}
                </div>
              </div>
              {hint && <p className="text-xs text-zinc-500 mb-2.5">{hint}</p>}
              <div className="relative">
                <input
                  type={show[provider] ? 'text' : 'password'}
                  value={values[provider] || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(prev => ({ ...prev, [provider]: !prev[provider] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {show[provider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar tokens'}
      </button>

      {/* Seção Meta / Instagram */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-zinc-200 mb-4">Instagram (Meta)</h2>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-200">Meta Graph API Token</label>
              <button
                type="button"
                onClick={() => setHelpOpen('meta_token')}
                className="text-zinc-600 hover:text-violet-400 transition-colors"
                title="Como obter o token Meta"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`flex items-center gap-1.5 text-xs ${metaTokenFilled ? 'text-green-400' : 'text-zinc-500'}`}>
              {metaTokenFilled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {metaTokenFilled ? 'Configurado' : 'Pendente'}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mb-2.5">
            Necessário para publicar carrosséis direto no Instagram.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showMetaToken ? 'text' : 'password'}
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
                placeholder="EAAp..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowMetaToken(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleFetchAccounts}
              disabled={!metaToken.trim() || loadingAccounts}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {loadingAccounts
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              {loadingAccounts ? 'Buscando...' : 'Buscar contas'}
            </button>
          </div>

          {accountError && (
            <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {accountError}
            </p>
          )}

          {metaAccounts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-zinc-500 mb-2">
                {metaAccounts.length === 1
                  ? 'Conta encontrada — selecionada automaticamente:'
                  : `${metaAccounts.length} contas encontradas — clique para selecionar:`}
              </p>
              {metaAccounts.map((account) => {
                const isSelected = selectedAccountId === account.igAccountId
                return (
                  <button
                    key={account.igAccountId}
                    onClick={() => selectAccount(account.igAccountId)}
                    disabled={savingMeta}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-700 flex-shrink-0 flex items-center justify-center">
                      {account.igPicture
                        ? <img src={account.igPicture} alt={account.igUsername} className="w-full h-full object-cover" />
                        : <Instagram className="w-5 h-5 text-zinc-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100 truncate">
                          @{account.igUsername || account.igName}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-300">
                            Selecionada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{account.pageName}</p>
                      <p className="text-xs text-zinc-600 font-mono">ID: {account.igAccountId}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />}
                  </button>
                )
              })}

              {metaSaved && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conta selecionada salva.
                </p>
              )}
            </div>
          )}

          {selectedAccountId && metaAccounts.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span>Conta ID <span className="font-mono text-zinc-400">{selectedAccountId}</span> configurada. Clique em "Buscar contas" para ver detalhes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
