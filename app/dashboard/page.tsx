export default function DashboardPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Carrosséis gerados', value: '0', sub: 'este mês' },
          { label: 'Publicados', value: '0', sub: 'no Instagram' },
          { label: 'Engajamento médio', value: '—', sub: 'últimos 30 dias' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="text-3xl font-bold text-zinc-100 mt-1">{card.value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-500 text-sm">Histórico de posts aparecerá aqui</p>
      </div>
    </div>
  )
}
