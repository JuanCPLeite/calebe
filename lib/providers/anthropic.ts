import Anthropic from '@anthropic-ai/sdk'
import type { ContentProvider, StreamOptions } from './types'

export class AnthropicProvider implements ContentProvider {
  readonly id = 'anthropic' as const
  readonly name = 'Claude (Anthropic)'
  readonly defaultModel = 'claude-opus-4-6'

  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async *streamText({ system, user, model, maxTokens = 8192 }: StreamOptions): AsyncGenerator<string> {
    const msgStream = this.client.messages.stream({
      model: model ?? this.defaultModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })

    for await (const event of msgStream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
