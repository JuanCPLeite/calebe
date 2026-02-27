export default function PhotosPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Fotos de Referência</h1>
        <p className="text-sm text-zinc-500 mt-1">Até 10 fotos do expert — usadas como referência para gerar imagens</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors">
            <span className="text-xs text-zinc-600">+ foto {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
