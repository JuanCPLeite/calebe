# Roadmap — Carousel Studio SaaS

Data de referência: 06/03/2026

---

## Concluído

### Sprint 1 — Base do produto
- [x] Estrutura Next.js + shadcn + Tailwind
- [x] Sidebar e navegação principal
- [x] Auth com Supabase
- [x] Banco com RLS e storage

### Sprint 2 — Motor de geração
- [x] Geração de tópicos (`/api/topics`) com EXA/Claude/mock
- [x] Geração de conteúdo Claude com streaming SSE
- [x] Geração de imagens Gemini
- [x] Render de cards e preview completo

### Sprint 3 — Expert configurável
- [x] DNA do expert (tom, estilo, CTA, templates fixos)
- [x] Upload e ordenação de fotos de referência
- [x] Perfil e público
- [x] Persistência em Supabase

### Sprint 4 — Publicação e operação
- [x] Persistência de carrosséis
- [x] Publicação no Instagram via Meta Graph API
- [x] Dashboard com filtros, busca, duplicação e exclusão
- [x] Agendamento (`scheduled_at`) e endpoint de cron

### Sprint 5 — Editor e múltiplos templates
- [x] Editor de carrossel com coverflow (prev/ativo/next)
- [x] Layout FrankCard pixel-perfect com controle de fonte e highlight
- [x] Template "X vs Y" (split layout comparativo) — SplitCard
- [x] Dashboard com thumbnails ao vivo via FrankCard (ResizeObserver)
- [x] Dashboard: métricas, filtros por status, busca, view lista/grid

### Sprint 6 — Content Hub Foundation + Template Engine
- [x] Arquitetura Content Hub documentada (`docs/CONTENT-HUB-ARCHITECTURE.md`)
- [x] Tabelas Supabase: platforms, content_formats, templates, template_prompts
- [x] Seed: 5 plataformas, 8 formatos, 2 templates, 4 prompts em {{variable}} syntax
- [x] Provider abstraction: ContentProvider interface, AnthropicProvider, registry
- [x] Template Engine: busca prompt do DB, interpola variáveis, fallback hardcoded
- [x] Route handler simplificado para delegar ao Template Engine

---

## Em andamento / próximo

### Fase 3 — Multi-tenant + Admin Panel
> Objetivo: transformar em SaaS real com owner, clientes e funcionários.
> Documentação: `docs/MULTI-TENANT-ARCHITECTURE.md`, `docs/ADMIN-PANEL.md`

**Schema:**
- [ ] Tabela `profiles` (role: owner/admin/member) com trigger de criação automática
- [ ] Tabela `workspaces` (uma por cliente/time)
- [ ] Tabela `workspace_members` (liga usuário a workspace com role)
- [ ] Tabela `app_settings` (chaves de IA da plataforma — owner only)
- [ ] Tabela `system_logs` (append-only, índices por workspace/level/event)
- [ ] Migrar `experts` e `carousels`: `user_id` → `workspace_id` + `created_by`
- [ ] RLS helpers: `current_workspace_id()`, `is_owner()`, `current_user_role()`
- [ ] Atualizar todas as policies RLS

**Backend:**
- [ ] `lib/logger.ts` — helper fire-and-forget para system_logs
- [ ] `lib/workspace.ts` — resolver workspace do usuário atual
- [ ] `app/api/generate/content` — buscar tokens em `app_settings` em vez de `user_tokens`
- [ ] Middleware de autorização para rotas `/admin/*` e `/team/*`
- [ ] `app/api/admin/settings` — CRUD de app_settings (owner only)
- [ ] `app/api/admin/workspaces` — listar/criar/suspender workspaces

**Frontend — Painel Admin (`/admin`):**
- [ ] `/admin` — dashboard: métricas globais + atividade recente
- [ ] `/admin/settings` — chaves de IA com mascaramento + teste de conexão
- [ ] `/admin/workspaces` — lista de clientes com plano, uso e ações
- [ ] `/admin/workspaces/[id]` — detalhe: membros, uso, logs do workspace
- [ ] `/admin/logs` — viewer com filtros (level, evento, workspace, período)
- [ ] `/admin/users` — todos os usuários com role e workspace

**Frontend — Workspace:**
- [ ] Selector de workspace no header (para quem é membro de múltiplos)
- [ ] `/team` — gerenciar membros (admin only): convidar, alterar role, remover
- [ ] Remover `/tokens` (tokens são da plataforma agora)

### Fase 4 — Multi-Provider UI
> Objetivo: usuário escolhe qual modelo de IA usar para gerar.

- [ ] Selector de modelo na tela de geração
- [ ] Mostrar apenas modelos disponíveis para o plano do workspace
- [ ] `lib/providers/openai.ts` — GPT-4o
- [ ] Persistir `model_used` no carousel para analytics

### Fase 5 — Multi-Plataforma
> Objetivo: gerar conteúdo para Instagram, LinkedIn, Facebook, Twitter/X, Pinterest.

- [ ] Platform selector na geração
- [ ] Format selector por plataforma
- [ ] Preview adaptado por aspect ratio (4:5, 1:1, 9:16, 16:9, 2:3)
- [ ] Adaptar publicação por plataforma (LinkedIn API, Twitter API)

### Fase 6 — Content Hub UI
> Objetivo: nova experiência de criação — fluxo guiado da ideia até a publicação.

- [ ] Nova rota `/create` substituindo `/generate`
- [ ] Fluxo: Ideia → Plataforma → Formato → Template → Modelo → Gerar
- [ ] Dashboard filtrado por plataforma + formato
- [ ] Biblioteca de conteúdo (search, tags, favoritos)

### Fase 7 — Monetização
> Objetivo: billing com Stripe, limites por plano, onboarding de clientes.

- [ ] Integração Stripe (checkout, webhooks, portal do cliente)
- [ ] Limites por plano (carrosséis/mês, membros, modelos disponíveis)
- [ ] Página de planos pública (`/pricing`)
- [ ] Onboarding guiado para novos clientes
- [ ] Emails transacionais (convite de membro, confirmação de plano)

---

## Backlog técnico (qualquer fase)
- [ ] Hardening do cron para execução 100% confiável sem sessão de usuário
- [ ] Idempotência forte em publicação (evitar duplicidade)
- [ ] Migrar `middleware.ts` para `proxy.ts` (Next 16)
- [ ] Fontes locais para build offline
- [ ] Retenção automática de logs (pg_cron deletar logs info > 90 dias)
