export async function fetchUsdToBrlRate(): Promise<number> {
  // Endpoint público sem chave; usado só no backend/admin para referência de conversão.
  const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
    method: 'GET',
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Falha ao consultar câmbio USD/BRL (HTTP ${res.status})`)
  }
  const data = await res.json().catch(() => null)
  const bid = Number(data?.USDBRL?.bid || 0)
  if (!Number.isFinite(bid) || bid <= 0) {
    throw new Error('Resposta inválida ao consultar câmbio USD/BRL')
  }
  return Number(bid.toFixed(6))
}

