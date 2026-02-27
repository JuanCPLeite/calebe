export default function TokensPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Tokens & APIs</h1>
        <p className="text-sm text-zinc-500 mt-1">Chaves de API para Meta, Google, Anthropic e EXA</p>
      </div>
      <div className="space-y-3">
        {[
          { name: 'Anthropic (Claude)', env: 'ANTHROPIC_API_KEY', status: 'Configurado' },
          { name: 'Google Gemini', env: 'GOOGLE_API_KEY', status: 'Configurado' },
          { name: 'Meta Graph API', env: 'IG_TOKEN_JUANCARLOS', status: 'Configurado' },
          { name: 'EXA Search', env: 'EXA_API_KEY', status: 'Pendente' },
        ].map(token => (
          <div key={token.name} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">{token.name}</p>
              <p className="text-xs text-zinc-500 font-mono">{token.env}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${token.status === 'Configurado' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
              {token.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
