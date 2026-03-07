# Roadmap — Carousel Studio → Content Hub

Data de referencia: 06/03/2026

---

## Concluido

### Sprint 1 — Base do produto
- [x] Estrutura Next.js + shadcn + Tailwind
- [x] Sidebar e navegacao principal
- [x] Auth com Supabase
- [x] Banco com RLS e storage

### Sprint 2 — Motor de geracao
- [x] Geracao de topicos (`/api/topics`) com EXA/Claude/mock
- [x] Geracao de conteudo Claude com streaming SSE
- [x] Geracao de imagens Gemini
- [x] Render de cards e preview completo

### Sprint 3 — Expert configuravel
- [x] DNA do expert (tom, estilo, CTA, templates fixos)
- [x] Upload e ordenacao de fotos de referencia
- [x] Perfil e publico
- [x] Persistencia em Supabase

### Sprint 4 — Publicacao e operacao
- [x] Persistencia de carrosseis
- [x] Publicacao no Instagram via Meta Graph API
- [x] Dashboard com filtros, busca, duplicacao e exclusao
- [x] Agendamento (`scheduled_at`) e endpoint de cron

### Sprint 5 — Editor e multiplos templates
- [x] Editor de carrossel com coverflow (prev/ativo/next)
- [x] Layout FrankCard pixel-perfect com controle de fonte e highlight
- [x] Template "X vs Y" (split layout comparativo) — SplitCard
- [x] Dashboard com thumbnails ao vivo via FrankCard (ResizeObserver)
- [x] Dashboard: metricas, filtros por status, busca, view lista/grid
- [x] Arquitetura Content Hub documentada (`docs/CONTENT-HUB-ARCHITECTURE.md`)

---

## Em andamento / proximo

### Fase 1 — Foundation DB (Content Hub)
> Objetivo: mover templates e prompts do hardcode para o Supabase, sem mudar comportamento no frontend.

- [ ] Criar tabelas `platforms`, `content_formats`, `templates`, `template_prompts` no Supabase
- [ ] Popular com os 2 templates existentes (frank-costa-10, positivo-negativo) e seus prompts atuais
- [ ] Adicionar SQL ao `supabase-schema.sql`
- [ ] Validar fallback hardcoded funcionando enquanto DB nao esta em uso

### Fase 2 — Template Engine
> Objetivo: sistema de geracao dinamico — busca prompt no DB, injeta variaveis, streama via provider.

- [ ] `lib/providers/types.ts` — interface `ContentProvider` unificada
- [ ] `lib/providers/anthropic.ts` — extrair logica atual do route handler
- [ ] `lib/providers/registry.ts` — mapa `providerId → instancia`
- [ ] `lib/template-engine.ts` — busca prompt do DB, interpola `{{variaveis}}`, streama SSE
- [ ] `app/api/generate/content/route.ts` — delegar ao TemplateEngine
- [ ] Cache de prompts (Map com TTL 5min para evitar hit no DB por geracao)

### Fase 3 — Multi-Provider UI
> Objetivo: usuario escolhe qual IA usar para gerar (Claude, GPT-4o, Gemini).

- [ ] Selector de IA na tela de geracao
- [ ] Mostrar apenas providers com chave configurada em `user_tokens`
- [ ] `lib/providers/openai.ts` — GPT-4o
- [ ] Persistir `provider_used` no carousel para analytics

### Fase 4 — Multi-Plataforma
> Objetivo: gerar conteudo para Instagram, LinkedIn, Facebook, Twitter/X, Pinterest.

- [ ] Platform selector na tela de geracao
- [ ] Format selector por plataforma (carrossel, post, story, thread)
- [ ] Preview adaptado por aspect ratio (4:5, 1:1, 9:16, 16:9, 2:3)
- [ ] Adaptar fluxo de publicacao por plataforma (LinkedIn API, Twitter API)

### Fase 5 — Content Hub UI
> Objetivo: nova experiencia de criacao — fluxo guiado da ideia ate a publicacao.

- [ ] Nova rota `/create` substituindo `/generate`
- [ ] Fluxo: Ideia → Plataforma → Formato → Template → IA → Gerar
- [ ] Dashboard filtrado por plataforma + formato
- [ ] Biblioteca de conteudo (search, tags, favoritos)

---

## Backlog tecnico (qualquer sprint)
- [ ] Hardening do cron para execucao 100% confiavel sem sessao de usuario
- [ ] Idempotencia forte em publicacao (evitar duplicidade)
- [ ] Logs estruturados e rastreabilidade por `carousel_id`
- [ ] Migrar `middleware.ts` para `proxy.ts` (Next 16)
- [ ] Melhorar build offline (fontes locais ou fallback)
- [ ] Landing + onboarding
- [ ] Planos/pagamento (Stripe)
