# Carousel Studio

Micro-SaaS para gerar, editar, renderizar e publicar carrosseis de Instagram com IA.

**Stack atual:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Supabase · Claude · Gemini · Meta Graph API

---

## Estado atual (marco: 06/03/2026)

### Implementado
- Autenticacao com Supabase (rotas privadas + callback)
- Multi-tenant por usuario (RLS no banco)
- Configuracao do expert:
  - DNA (tom, estilo, CTA, templates fixos)
  - Fotos de referencia
  - Perfil e publico
- Tokens por usuario (Anthropic, Google, EXA, Meta)
- Descoberta de topicos (`/api/topics`):
  - EXA quando chave existe
  - fallback Claude
  - fallback mock
- Geracao de conteudo com streaming SSE (`/api/generate/content`)
- Geracao de imagens com Gemini (`/api/generate/images`)
- Render de cards (`/api/render/card`)
- Fluxo de salvar imagens em storage (`/api/save-images`)
- Publicacao no Instagram (`/api/publish`)
- Agendamento e cron (`/api/cron/publish-scheduled`)
- Dashboard:
  - lista/grid
  - filtros e busca
  - duplicar/excluir
  - detalhe por carousel
  - fallback visual do thumbnail com `FrankCard`

### Em andamento / atencao
- Build local pode falhar sem internet por fontes Google (`Inter`, `DM Sans`)
- Aviso de deprecacao do `middleware.ts` no Next 16 (migrar para `proxy.ts`)
- Fluxo de cron/publish ainda precisa hardening final para execucao totalmente robusta em server-side sem sessao

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
  content-engine.ts
  image-generator.ts
  instagram.ts
  expert-config.ts
  supabase/
components/
  generate/
  ui/
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
- Guia setup CLI: `SUPABASE_SETUP.md`
- Guia setup Dashboard-only (sem terminal local): `SUPABASE_SETUP_DASHBOARD_ONLY.md`

Cron nativo Supabase (recomendado para postagem):
- Edge Function: `publish-scheduled`
- Agendamento: `* * * * *` (a cada 1 minuto)
- Precisao real: normalmente ate ~60s apos `scheduled_at`

Variaveis minimas esperadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

Tokens de provedores sao salvos por usuario na tabela `user_tokens`.
