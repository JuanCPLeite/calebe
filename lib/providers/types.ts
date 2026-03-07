export type ProviderId = 'anthropic' | 'openai' | 'google'

export interface StreamOptions {
  system: string
  user: string
  model?: string
  maxTokens?: number
}

export interface ContentProvider {
  id: ProviderId
  name: string
  defaultModel: string
  /** Streama texto em chunks conforme chegam da API */
  streamText(options: StreamOptions): AsyncGenerator<string>
}
