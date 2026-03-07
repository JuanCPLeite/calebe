import type { ContentProvider, StreamOptions } from './types'

type OpenAIChunk = {
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  choices?: Array<{
    delta?: { content?: string }
  }>
}

export class OpenAIProvider implements ContentProvider {
  readonly id = 'openai' as const
  readonly name = 'OpenAI'
  readonly defaultModel = 'gpt-4o'

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *streamText({ system, user, model, maxTokens = 8192, onUsage }: StreamOptions): AsyncGenerator<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? this.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 300) || 'request failed'}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data: ')) continue

        const payload = line.slice(6).trim()
        if (!payload || payload === '[DONE]') continue

        let chunk: OpenAIChunk | null = null
        try {
          chunk = JSON.parse(payload)
        } catch {
          continue
        }

        if (chunk?.usage && onUsage) {
          const inputTokens = Number(chunk.usage.prompt_tokens || 0)
          const outputTokens = Number(chunk.usage.completion_tokens || 0)
          if (inputTokens > 0 || outputTokens > 0) {
            onUsage({ inputTokens, outputTokens })
          }
        }

        const text = chunk?.choices?.[0]?.delta?.content
        if (text) yield text
      }
    }
  }
}
