'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, X, ImageIcon, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  storage_path: string
  url: string
  order_index: number
}

interface ExpertOption {
  id: string
  display_name: string
  handle: string
  photos_count: number
}

export default function PhotosPage() {
  const supabase = createClient()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [expertId, setExpertId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeExpertId, setActiveExpertId] = useState<string | null>(null)
  const [activeExpertName, setActiveExpertName] = useState('')
  const [experts, setExperts] = useState<ExpertOption[]>([])
  const [showExpertModal, setShowExpertModal] = useState(false)
  const [switchingExpertId, setSwitchingExpertId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadPhotosByExpert(nextExpertId: string) {
    setExpertId(nextExpertId)
    const { data: rows } = await supabase
      .from('expert_photos')
      .select('*')
      .eq('expert_id', nextExpertId)
      .order('order_index')
    setPhotos(rows || [])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const res = await fetch('/api/experts')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) return

      const options = (data.experts || []) as ExpertOption[]
      const currentId = (data.activeExpertId as string | null) || options[0]?.id || null
      setExperts(options)
      setActiveExpertId(currentId)
      const current = options.find((e) => e.id === currentId) || null
      setActiveExpertName(current?.display_name || '')

      if (currentId) {
        await loadPhotosByExpert(currentId)
      }
    }
    load()
  }, [])

  async function selectExpert(nextExpertId: string) {
    if (!nextExpertId || nextExpertId === activeExpertId) {
      setShowExpertModal(false)
      return
    }
    setSwitchingExpertId(nextExpertId)
    try {
      const res = await fetch('/api/experts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeExpertId: nextExpertId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao selecionar expert')

      setActiveExpertId(nextExpertId)
      const current = experts.find((e) => e.id === nextExpertId) || null
      setActiveExpertName(current?.display_name || '')
      await loadPhotosByExpert(nextExpertId)
      setShowExpertModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSwitchingExpertId(null)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !expertId || !userId) return
    if (photos.length + files.length > 10) {
      alert('Máximo de 10 fotos por perfil')
      return
    }

    setUploading(true)
    const newPhotos: Photo[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('expert-photos')
        .upload(storagePath, file)

      if (uploadError) { console.error(uploadError); continue }

      const { data: signedData } = await supabase.storage
        .from('expert-photos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      const { data: row } = await supabase.from('expert_photos').insert({
        expert_id: expertId,
        storage_path: storagePath,
        url: signedData?.signedUrl || '',
        order_index: photos.length + newPhotos.length,
      }).select().single()

      if (row) newPhotos.push(row)
    }

    setPhotos(prev => [...prev, ...newPhotos])
    setUploading(false)
  }

  async function handleDelete(photo: Photo) {
    await supabase.storage.from('expert-photos').remove([photo.storage_path])
    await supabase.from('expert_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  const slots = Array.from({ length: 10 })

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Fotos de Referência</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Até 10 fotos do expert ativo — usadas para gerar imagens com você no fundo
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            Expert atual: <strong className="text-zinc-200">{activeExpertName || 'não selecionado'}</strong>
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            Pré-requisito: primeiro salve o expert em <strong>DNA Expert</strong>, depois envie as fotos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExpertModal(true)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || photos.length >= 10 || !expertId}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Enviando...' : 'Adicionar foto'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="grid grid-cols-5 gap-3">
        {slots.map((_, i) => {
          const photo = photos[i]
          if (photo) {
            return (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {i + 1}
                </div>
              </div>
            )
          }
          return (
            <button
              key={i}
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center gap-1 hover:border-zinc-500 hover:bg-zinc-900 transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-zinc-600" />
              <span className="text-xs text-zinc-600">{i + 1}</span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-zinc-600 mt-4">
        {photos.length}/10 fotos adicionadas. Use fotos com boa iluminação e rostos visíveis.
      </p>

      {showExpertModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowExpertModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Escolher expert para Fotos Referência</p>
              <button className="text-zinc-400 hover:text-zinc-200" onClick={() => setShowExpertModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {experts.map((item) => {
                const isActive = item.id === activeExpertId
                const isSwitching = item.id === switchingExpertId
                return (
                  <button
                    key={item.id}
                    onClick={() => selectExpert(item.id)}
                    disabled={isSwitching}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      isActive
                        ? 'border-violet-500/60 bg-violet-900/20'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm text-zinc-100 font-medium">{item.display_name || 'Sem nome'}</p>
                    <p className="text-xs text-zinc-500">{item.handle || 'sem @'} · {item.photos_count || 0} fotos</p>
                    {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 mt-1" />}
                  </button>
                )
              })}
              {experts.length === 0 && (
                <p className="text-xs text-zinc-500">
                  Nenhum expert criado ainda. Crie primeiro em DNA Expert.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
