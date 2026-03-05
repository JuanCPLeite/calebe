'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  storage_path: string
  url: string
  order_index: number
}

export default function PhotosPage() {
  const supabase = createClient()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [expertId, setExpertId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: expert } = await supabase
        .from('experts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!expert) return
      setExpertId(expert.id)

      const { data: rows } = await supabase
        .from('expert_photos')
        .select('*')
        .eq('expert_id', expert.id)
        .order('order_index')

      setPhotos(rows || [])
    }
    load()
  }, [])

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
            Até 10 fotos do expert — usadas para gerar imagens com você no fundo
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || photos.length >= 10}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Enviando...' : 'Adicionar foto'}
        </button>
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
    </div>
  )
}
