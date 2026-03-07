# Content Hub — Arquitetura & Visão de Produto

> Documento vivo. Atualizar sempre que uma decisão arquitetural for tomada.
> Última atualização: 2026-03-06

---

## Visão

O produto evolui de **"gerador de carrosséis para Instagram"** para um **hub de criação de conteúdo para redes sociais**, onde o expert configura uma vez seu DNA e gera qualquer formato para qualquer plataforma, com qualquer IA disponível.

```
[Ideia / Tema / Trend / Notícia]
          ↓
  [Escolher Plataforma]
  Instagram · LinkedIn · Facebook · Twitter/X · Pinterest
          ↓
  [Escolher Formato]
  Carrossel · Post · Story · Thread · Artigo
          ↓
  [Escolher Template]
  X vs Y · Brand Equity · Lista · Storytelling · ...
          ↓
  [Escolher IA]
  Claude · GPT-4o · Gemini Pro · ...
          ↓
  [Gerar → Editar → Publicar]
```

---

## Plataformas & Formatos Planejados

| Plataforma   | Formatos                                         | Aspect Ratios         | Status    |
|-------------|--------------------------------------------------|-----------------------|-----------|
| Instagram   | Carrossel, Post, Story, Reel                     | 4:5 · 1:1 · 9:16     | Carrossel ✅ |
| LinkedIn    | Post, Carrossel (documento), Artigo              | 1:1 · 1.91:1 · 4:5   | Planejado |
| Facebook    | Post, Carrossel, Story                           | 1:1 · 4:5 · 9:16     | Planejado |
| Twitter/X   | Post, Thread                                     | 1:1 · 16:9            | Planejado |
| Pinterest   | Pin                                              | 2:3 · 1:1             | Planejado |
| TikTok      | (vídeo — fora do escopo atual)                   | 9:16                  | Futuro    |

---

## Schema de Banco — Fase 1 (Content Hub)

> Rodar como bloco único no SQL Editor do Supabase.
> Adicionar ao final de `supabase-schema.sql`.

```sql
-- ─── Plataformas de publicação ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platforms (
  id          TEXT PRIMARY KEY,          -- 'instagram', 'linkedin', 'facebook', 'twitter'
  name        TEXT NOT NULL,             -- 'Instagram'
  slug        TEXT NOT NULL UNIQUE,
  icon_url    TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0
);

INSERT INTO platforms (id, name, slug, active, sort_order) VALUES
  ('instagram', 'Instagram',  'instagram', true, 1),
  ('linkedin',  'LinkedIn',   'linkedin',  true, 2),
  ('facebook',  'Facebook',   'facebook',  true, 3),
  ('twitter',   'Twitter/X',  'twitter',   true, 4),
  ('pinterest', 'Pinterest',  'pinterest', true, 5)
ON CONFLICT (id) DO NOTHING;

-- ─── Formatos de conteúdo (por plataforma) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS content_formats (
  id            TEXT PRIMARY KEY,         -- 'carousel', 'post', 'story', 'thread'
  platform_id   TEXT NOT NULL REFERENCES platforms(id),
  name          TEXT NOT NULL,            -- 'Carrossel', 'Post', 'Story'
  slug          TEXT NOT NULL,
  aspect_ratio  TEXT NOT NULL,            -- '4:5', '1:1', '9:16'
  canvas_w      INT NOT NULL DEFAULT 1080,
  canvas_h      INT NOT NULL DEFAULT 1350,
  max_slides    INT,                      -- null = sem limite (thread)
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  UNIQUE(platform_id, slug)
);

INSERT INTO content_formats (id, platform_id, name, slug, aspect_ratio, canvas_w, canvas_h, max_slides, active, sort_order) VALUES
  ('ig-carousel',  'instagram', 'Carrossel',  'carousel', '4:5',    1080, 1350, 20,   true, 1),
  ('ig-post',      'instagram', 'Post',        'post',     '1:1',    1080, 1080,  1,   true, 2),
  ('ig-story',     'instagram', 'Story',       'story',    '9:16',   1080, 1920,  1,   true, 3),
  ('li-carousel',  'linkedin',  'Carrossel',   'carousel', '1:1',    1080, 1080, 20,   true, 1),
  ('li-post',      'linkedin',  'Post',        'post',     '1.91:1', 1200,  628,  1,   true, 2),
  ('fb-post',      'facebook',  'Post',        'post',     '1:1',    1080, 1080,  1,   true, 1),
  ('tw-post',      'twitter',   'Post',        'post',     '16:9',   1600,  900,  1,   true, 1),
  ('tw-thread',    'twitter',   'Thread',      'thread',   '1:1',    1080, 1080, 10,   true, 2)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- ─── Templates ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id            TEXT PRIMARY KEY,         -- 'frank-costa-10', 'positivo-negativo'
  format_id     TEXT REFERENCES content_formats(id),
  name          TEXT NOT NULL,
  description   TEXT,
  layout        TEXT NOT NULL,            -- 'frank', 'split', 'minimal', 'listicle', 'quote'
  slide_count   INT,
  tags          TEXT[],
  thumbnail_url TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO templates (id, format_id, name, description, layout, slide_count, tags, active, sort_order) VALUES
  (
    'frank-costa-10', 'ig-carousel',
    'Brand Equity',
    'Hook poderoso → 8 slides de conteúdo educativo → CTA com slide do autor. Constrói autoridade e reconhecimento de marca.',
    'frank', 10, ARRAY['educativo', 'autoridade', '10 slides'], true, 1
  ),
  (
    'positivo-negativo', 'ig-carousel',
    'X vs Y',
    'Split layout comparativo: abordagem errada (esquerda) vs abordagem certa (direita). Alto engajamento.',
    'split', 10, ARRAY['comparação', 'split', 'viral'], true, 2
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Prompts por template e por provider ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  step          TEXT NOT NULL,            -- 'system', 'user', 'image'
  provider      TEXT NOT NULL DEFAULT 'any', -- 'any', 'anthropic', 'openai', 'google'
  model         TEXT,                     -- null = default do provider
  prompt_text   TEXT NOT NULL,            -- variáveis: {{expert.displayName}}, {{topic}}, {{date}}
  version       INT NOT NULL DEFAULT 1,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, step, provider, version)
);
```

---

## Provider Abstraction — Interface Unificada

```typescript
// lib/providers/types.ts

export type ProviderId = 'anthropic' | 'openai' | 'google'

export interface ContentProvider {
  id: ProviderId
  name: string
  defaultModel: string
  /** Streaming de texto — retorna chunks conforme chegam */
  streamText(
    system: string,
    user: string,
    model?: string
  ): AsyncGenerator<string>
}

export interface ImageProvider {
  id: ProviderId
  generateImage(prompt: string, model?: string): Promise<string> // base64
}
```

```
lib/providers/
  types.ts          ← interface unificada
  anthropic.ts      ← Claude (já existe como lógica inline)
  openai.ts         ← GPT-4o (a implementar)
  google.ts         ← Gemini (já existe para imagens)
  registry.ts       ← mapa id → instância
```

---

## Template Engine — Fluxo de Execução

```
1. Recebe: templateId, topic, expert, providerId
2. Busca template + prompts no Supabase (cache 5min)
3. Injeta variáveis no prompt_text:
   {{expert.displayName}} → "Frank Costa"
   {{expert.niche}}       → "automação de vendas"
   {{topic}}              → "CRM vs planilha"
   {{date}}               → "06 de março de 2026"
4. Seleciona provider pelo providerId (fallback: anthropic)
5. Streama resposta em SSE para o cliente
6. Parseia JSON retornado
7. Mapeia slides para o tipo correto (Slide | SplitSlide)
8. Salva rascunho no banco
9. Retorna slides + caption
```

```typescript
// lib/template-engine.ts (a criar — Fase 2)

export async function generateWithTemplate({
  templateId,
  topic,
  expert,
  providerId,
  userApiKeys,
}: GenerateOptions): AsyncGenerator<SSEEvent>
```

---

## Variáveis de Prompt — Sintaxe Padrão

```
{{expert.displayName}}    → Nome do expert
{{expert.handle}}         → @handle
{{expert.niche}}          → nicho do expert
{{expert.bioShort}}       → bio curta
{{expert.productName}}    → produto principal
{{expert.productCta}}     → CTA do produto
{{expert.styleRules}}     → regras de estilo (lista)
{{topic}}                 → tema/assunto gerado
{{hook}}                  → frase de abertura (opcional)
{{date}}                  → data atual em pt-BR
{{year}}                  → ano atual
{{slideCount}}            → número de slides (quando configurável)
{{textLength}}            → curto | médio | longo
```

---

## Layouts de Card — Catálogo

| layout      | Componente          | Status     | Plataformas       |
|------------|---------------------|------------|-------------------|
| `frank`    | `FrankCard`         | Produção   | Instagram         |
| `split`    | `SplitCard`         | Produção   | Instagram         |
| `minimal`  | `MinimalCard`       | Planejado  | LinkedIn, Twitter |
| `listicle` | `ListicleCard`      | Planejado  | Instagram, LinkedIn |
| `quote`    | `QuoteCard`         | Planejado  | Todas             |
| `data`     | `DataCard`          | Planejado  | LinkedIn, Twitter |
| `story`    | `StoryCard`         | Planejado  | Stories (9:16)    |

---

## Roadmap de Implementação

### Fase 1 — Foundation DB (próxima sprint)
- [ ] Criar tabelas `platforms`, `content_formats`, `templates`, `template_prompts`
- [ ] Popular com os 2 templates existentes + seus prompts atuais
- [ ] Adicionar ao `supabase-schema.sql`
- [ ] Nenhuma mudança de comportamento no frontend (fallback hardcoded mantido)

### Fase 2 — Template Engine
- [ ] `lib/providers/types.ts` — interface unificada
- [ ] `lib/providers/anthropic.ts` — extrair lógica atual
- [ ] `lib/providers/registry.ts` — mapa de providers
- [ ] `lib/template-engine.ts` — busca prompt do DB, injeta variáveis, streama
- [ ] `app/api/generate/content/route.ts` — delegar ao TemplateEngine
- [ ] Cache de prompts (SWR ou Map com TTL 5min)

### Fase 3 — Multi-Provider UI
- [ ] Selector de IA na tela de geração (Claude / GPT / Gemini)
- [ ] Validação: mostrar apenas providers com chave configurada
- [ ] `lib/providers/openai.ts` — GPT-4o
- [ ] Persistir `provider_used` no carousel para analytics

### Fase 4 — Multi-Plataforma
- [ ] Platform selector na geração
- [ ] Format selector (carrossel, post, story)
- [ ] Adaptar preview por aspect ratio
- [ ] Adaptar publicação por plataforma (LinkedIn API, Twitter API)

### Fase 5 — Content Hub UI
- [ ] Nova tela: `/generate` vira `/create`
- [ ] Fluxo: Idea → Plataforma → Formato → Template → IA → Gerar
- [ ] Dashboard filtrado por plataforma + formato
- [ ] Biblioteca de conteúdo (search, tags, favoritos)

---

## Decisões Técnicas Registradas

| Data       | Decisão | Motivo |
|-----------|---------|--------|
| 2026-03-06 | Templates e prompts vão para o Supabase (não hardcoded) | Escala para 15+ templates sem deploy |
| 2026-03-06 | Provider abstraction antes de adicionar GPT | Evita if/else em todo lugar |
| 2026-03-06 | Variáveis de prompt com sintaxe `{{chave}}` | Simples, legível, fácil de editar no banco |
| 2026-03-06 | Cache de prompts (5min TTL) | Performance — evita hit no DB a cada geração |
| 2026-03-06 | Fallback hardcoded durante migração | Zero downtime — não quebra o que funciona |
| 2026-03-06 | Layouts como componentes React separados | Isolamento — novo layout = novo arquivo |
