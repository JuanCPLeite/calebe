# Carousel Studio — Content Hub

Hub de criacao de conteudo para redes sociais com IA. O expert configura seu DNA uma vez e gera qualquer formato para qualquer plataforma com qualquer IA disponivel.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Supabase · Claude · Gemini · Meta Graph API

---

## Visao do produto

```
[Ideia / Tema / Trend / Noticia]
          ↓
  [Escolher Plataforma]
  Instagram · LinkedIn · Facebook · Twitter/X · Pinterest
          ↓
  [Escolher Formato]
  Carrossel · Post · Story · Thread · Artigo
          ↓
  [Escolher Template]
  Brand Equity · X vs Y · Lista · Storytelling · ...
          ↓
  [Escolher IA]
  Claude · GPT-4o · Gemini Pro · ...
          ↓
  [Gerar → Editar → Publicar]
```

---

## Estado atual (06/03/2026)

### Implementado
- Autenticacao com Supabase (rotas privadas + callback)
- Multi-tenant por usuario (RLS no banco)
- Configuracao do expert: DNA, fotos de referencia, perfil e publico
- Tokens por usuario (Anthropic, Google, EXA, Meta)
- Descoberta de topicos (`/api/topics`): EXA → Claude fallback → mock
- Geracao de conteudo com streaming SSE (`/api/generate/content`)
- Geracao de imagens com Gemini (`/api/generate/images`)
- Render de cards (`/api/render/card`)
- Publicacao no Instagram (`/api/publish`)
- Agendamento e cron (`/api/cron/publish-scheduled`)
- Templates de carrossel:
  - **Brand Equity** (Frank Costa 10 slides) — layout `frank`
  - **X vs Y** (split comparativo) — layout `split`
- Editor com coverflow (prev/ativo/next), controle de fonte e highlight por slide
- Dashboard: lista/grid, filtros, busca, metricas, thumbnails ao vivo, duplicar, excluir

### Proximas fases
Ver `ROADMAP.md` para o plano completo e `docs/CONTENT-HUB-ARCHITECTURE.md` para a arquitetura tecnica.

---

## Estrutura principal

```txt
app/
  (app)/
    dashboard/
    expert/
    generate/
    templates/
    tokens/
  api/
    carousels/
    cron/publish-scheduled/
    generate/content/
    generate/images/
    meta/accounts/
    publish/
    render/card/
    save-images/
    topics/
lib/
  content-engine.ts       # system/user prompts por template
  image-generator.ts
  instagram.ts
  expert-config.ts
  templates.ts            # definicao dos templates
  supabase/
components/
  generate/
    frank-card.tsx        # card layout Brand Equity
    split-card.tsx        # card layout X vs Y
    carousel-preview.tsx  # editor com coverflow
  ui/
docs/
  CONTENT-HUB-ARCHITECTURE.md  # arquitetura e roadmap tecnico
```

---

## Rodar local (porta fixa 8080)

```bash
npm install
npm run dev
# http://localhost:8080
```

Scripts:

```bash
npm run dev     # next dev -p 8080
npm run build   # next build
npm run start   # next start -p 8080
```

---

## Banco e infra

- Schema base: `supabase-schema.sql`
- Buckets: `expert-photos`, `carousel-images`
- Politicas RLS por usuario
- Guia setup: `SUPABASE_SETUP.md` / `SUPABASE_SETUP_DASHBOARD_ONLY.md`

Variaveis minimas:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
```

Tokens de provedores sao salvos por usuario na tabela `user_tokens`.

---

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| `ROADMAP.md` | Sprints concluidos e fases planejadas |
| `docs/CONTENT-HUB-ARCHITECTURE.md` | Arquitetura tecnica, schema DB, provider abstraction, template engine |
| `supabase-schema.sql` | Schema completo do banco (fonte unica da verdade) |
