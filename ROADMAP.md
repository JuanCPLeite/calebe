# Roadmap — Carousel Studio SaaS

Data de referência: 07/03/2026

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

**Schema:** ✅ concluído — rodar `supabase-schema.sql` no Supabase
- [x] Tabela `profiles` (role: owner/admin/member) com trigger de criação automática
- [x] Tabela `workspaces` (uma por cliente/time)
- [x] Tabela `workspace_members` (liga usuário a workspace com role)
- [x] Tabela `app_settings` (chaves de IA da plataforma — owner only, linha única)
- [x] Tabela `system_logs` (append-only, índices por workspace/level/event)
- [x] `experts` e `carousels`: colunas `workspace_id` + `created_by` adicionadas
- [x] RLS helpers: `is_owner()`, `current_workspace_id()`, `user_workspace_role()`
- [x] Trigger `handle_new_user` cria profile automaticamente no cadastro
- [x] Todas as policies RLS atualizadas para considerar workspace

**Backend:**
- [x] `lib/logger.ts` — helper fire-and-forget para system_logs
- [x] `lib/workspace.ts` — resolver workspace do usuário atual
- [x] `app/api/generate/content` — buscar tokens em `app_settings` em vez de `user_tokens`
- [x] Middleware de autorização para rotas `/admin/*` e `/team/*`
- [x] `app/api/admin/settings` — CRUD de app_settings (owner only)
- [x] `app/api/admin/workspaces` — listar/criar/suspender workspaces
- [ ] Migrar rotas restantes de `user_tokens` para `app_settings`/workspace
  - [x] `app/api/topics`
  - [x] `app/api/generate/images`
  - [x] `app/api/publish`
  - [x] `app/api/meta/*`
  - [x] `app/api/cron/publish-scheduled`
  - [x] `app/api/debug`
  - [x] `app/(app)/tokens` removida (fluxo legado encerrado)

**Frontend — Painel Admin (`/admin`):**
- [x] `/admin` — dashboard: métricas globais + atividade recente
- [x] `/admin/settings` — chaves de IA com mascaramento + teste de conexão
- [x] `/admin/workspaces` — lista de clientes com plano, uso e ações
- [x] `/admin/workspaces/[id]` — detalhe: membros, uso, logs do workspace
- [x] `/admin/logs` — viewer com filtros (level, evento, workspace, período)
- [x] `/admin/users` — todos os usuários com role e workspace

**Frontend — Workspace:**
- [x] Selector de workspace no header (para quem é membro de múltiplos)
- [x] `/team` — gerenciar membros (admin only): convidar, alterar role, remover
- [x] Remover `/tokens` (tokens são da plataforma agora)

### Fase 4 — Multi-Provider UI
> Objetivo: usuário escolhe qual modelo de IA usar para gerar.

- [x] Selector de modelo na tela de geração
- [x] Mostrar apenas modelos disponíveis para o plano do workspace
- [x] `lib/providers/openai.ts` — GPT-4o
- [x] Persistir `model_used` no carousel para analytics

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

### Fase 8 — Cost Intelligence e Créditos
> Objetivo: medir custo real por geração e controlar consumo por plano/workspace.

- [x] Expandir `Admin Plans` com limites adicionais por plano:
- [x] limite de usuários/membros
- [x] limite de créditos de postagem (mensal)
- [ ] políticas de excedente (bloquear e alertar entregues; cobrança extra pendente)
- [ ] Medição de custo por geração/publicação:
- [ ] custo por provider/modelo (input/output tokens, imagens, publicação)
- [ ] custo por carrossel salvo/publicado
- [ ] Custo por workspace e por usuário:
- [ ] dashboard `/admin/costs` com filtros por período, workspace e usuário
- [ ] ranking de workspaces mais caros
- [ ] ranking de usuários com maior consumo
- [ ] Analytics de modelos:
- [ ] modelo mais usado por período
- [ ] custo médio por modelo
- [ ] efetividade por modelo (publicado x gerado, quando aplicável)
- [ ] Alertas operacionais:
- [ ] alerta de estouro de orçamento mensal
- [ ] alerta de uso anômalo (picos de custo)
- [ ] Base para precificação:
- [ ] simulação de margem por plano
- [ ] recomendação automática de upgrade de plano por uso

---

## Backlog técnico (qualquer fase)
- [ ] Hardening do cron para execução 100% confiável sem sessão de usuário
- [ ] Idempotência forte em publicação (evitar duplicidade)
- [x] Migrar `middleware.ts` para `proxy.ts` (Next 16)
- [ ] Fontes locais para build offline
- [ ] Retenção automática de logs (pg_cron deletar logs info > 90 dias)

---

## Checkpoint de execução

### 2026-03-06 — ponto atual
- Schema multi-tenant executado no Supabase.
- Backend principal migrado de `user_tokens` para `app_settings`/workspace.
- Publicação Meta agora usa `experts.ig_access_token` + `experts.ig_account_id` (fallback `.env`).
- API de workspaces do admin implementada (`GET/POST/PATCH` em `/api/admin/workspaces`).
- UI inicial do admin entregue: `/admin`, `/admin/settings`, `/admin/workspaces` (MVP funcional).
- `/admin/logs` implementado (API + UI com filtros e busca local em payload).
- `/admin/logs` refinado com modal de detalhe por linha e copy JSON.
- `/admin/users` implementado (API + UI para listar/filtrar/editar role/workspace).
- `/admin/workspaces/[id]` implementado (API + UI de detalhe com membros, uso e logs).
- `/admin` agora consome métricas reais via `/api/admin/metrics`.
- `/admin/settings` refinado com reveal seguro e teste de conexão por provider.
- `/admin/workspaces` evoluído para versão final: colunas de uso/membros/atividade, KPIs e confirmação de suspensão/reativação.
- Selector de workspace no header implementado (troca segura via `/api/workspace/context`).
- `/team` implementado com API `/api/team/members` (listar, convidar, alterar role e remover).
- Hardening de onboarding no schema: `profiles.role` não nulo + primeiro usuário vira `owner` automaticamente.
- Próximo passo direto: remover `/tokens` (fluxo legado de chaves por usuário).

### 2026-03-07 — revisão técnica do projeto
- Build de produção executado com sucesso (`npm run build`) sem erros de compilação.
- Rotas admin e team confirmadas no build: `/admin/*`, `/team`, `/api/team/members`, `/api/workspace/context`.
- Repositório local com branch `master` 9 commits à frente de `calebe/master`.
- Script `lint` adicionado no `package.json` (`tsc --noEmit`) e validado com sucesso.
- Migração Next.js 16 concluída: `middleware.ts` substituído por `proxy.ts`.
- `turbopack.root` configurado no `next.config.ts` para fixar a raiz correta do workspace.
- Fluxo legado `/tokens` removido (rota, pagina e links da UI).
- Multi-expert iniciado: selector de expert no header + API `/api/experts` (listar/criar/trocar ativo).
- Schema atualizado para `profiles.active_expert_id` e `carousels.expert_id`.
- Onboarding automático reforçado no schema: novo usuário já recebe workspace padrão + membership admin.
- Painel owner ampliado com módulo global de postagens `/admin/carousels` (filtros por status/workspace/período).
- `/admin/carousels` recebeu ações operacionais: detalhe, duplicar, cancelar agendamento, reenfileirar, excluir.
- Fluxo de experts refinado: criação centralizada no DNA; Fotos Referência agora seleciona expert existente via modal.
- UX de expert refinada: `DNA Expert` abre na lista e só mostra formulário após seleção.
- UX de Fotos refinada: `Fotos de Referência` abre na lista, botão `Novo` abre modal de experts do DNA, sem redirecionar.
- Owner ganhou `Admin Plans` para cadastrar tipos de plano e limites de experts via `app_settings.plan_configs`.
- Planejada Fase 8 de Cost Intelligence: limites de usuários/créditos + custos por token/modelo/workspace/usuário.
- Schema recebeu base de Cost Intelligence: tabelas `provider_price_catalog` e `usage_events` com RLS.
- MVP de custos entregue: instrumentação de `usage_events` em content/images/publish + `/api/admin/costs` + `/admin/costs`.
- Catálogo de preços entregue: `/api/admin/costs/prices` + gestão no `/admin/costs`.
- Enforcement inicial entregue: `memberLimit` em `/api/team/members` e `monthlyPostCredits` em `/api/generate/content`.
- Alertas iniciais de custo/crédito entregues em `/admin/costs` + seed estimado de preços.
- Enforcement de crédito expandido para `/api/generate/images` e `/api/publish`.
- Projeção mensal por workspace entregue no `/admin/costs`.
- `/generate` agora consulta `/api/workspace/limits` e alerta crédito antes de tentar gerar.
- `/admin/workspaces` agora exibe uso de créditos mensais por workspace.
- `/team` agora exibe uso de membros/créditos e desabilita convite ao atingir `memberLimit`.
- `/dashboard` agora exibe alerta de risco/esgotamento de créditos para orientar upgrade.
- Métricas de geração/créditos passaram a priorizar `usage_events` (ledger) com fallback legado em `carousels`.
- Soft delete de carrossel implementado (auditoria preservada; usuário não vê item excluído).
- Agendamento Supabase alinhado ao modelo atual de credenciais (`experts.ig_access_token`/`ig_account_id`).
- Régua inicial de créditos por ação entregue (texto/imagem/publicação) via `usage_events`.
- Política de créditos por ação agora configurável no admin (`/api/admin/costs/credit-policy` + UI em `/admin/costs`).
- `/admin/costs` ampliado com breakdown de créditos por usuário e por tipo de ação.
