import { AnthropicProvider } from './anthropic'
import type { ContentProvider, ProviderId } from './types'

/** Cria uma instância do provider com a API key fornecida */
export function createProvider(id: ProviderId, apiKey: string): ContentProvider {
  switch (id) {
    case 'anthropic':
      return new AnthropicProvider(apiKey)
    default:
      throw new Error(`Provider '${id}' ainda não implementado`)
  }
}
