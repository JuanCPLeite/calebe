# Carousel Studio — Content Hub SaaS

Hub de criação de conteúdo para redes sociais com IA. Arquitetura multi-tenant: o owner gerencia as chaves de IA, clientes configuram seu expert DNA, equipes geram e publicam conteúdo.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Supabase · Claude · Gemini · Meta Graph API

---

## Visão do produto

```
[Ideia / Tema / Trend / Notícia]
          ↓
  [Escolher Plataforma]
  Instagram · LinkedIn · Facebook · Twitter/X · Pinterest
          ↓
  [Escolher Formato]
  Carrossel · Post · Story · Thread
          ↓
  [Escolher Template]
  Brand Equity · X vs Y · Lista · Storytelling · ...
          ↓
  [Escolher Modelo de IA]
  Claude Opus · Claude Sonnet · GPT-4o · Gemini · ...
          ↓
  [Gerar → Editar → Publicar]
```

---

## Arquitetura multi-tenant

| Papel | Acesso |
|-------|--------|
| **Owner** (você) | Painel admin, chaves de IA, todos os workspaces, logs |
| **Admin** (cliente) | Seu workspace, expert DNA, membros do time |
| **Member** (funcionário) | Gerar, editar e publicar no workspace do cliente |

Tokens de IA são da plataforma — usuários apenas escolhem o modelo.

---

## Estado atual (15/03/2026)

### Implementado
- Auth Supabase (rotas privadas + callback)
- Template Engine: busca prompts do banco, interpola variáveis, streama SSE
- Templates: **Brand Equity** (frank) e **X vs Y** (split comparativo)
- Editor com coverflow (prev/ativo/next), controle de fonte e highlight
- Geração de imagens com Gemini
- Publicação no Instagram via Meta Graph API
- Agendamento com cron nativo Supabase
- Agendamento validado com Edge Function `publish-scheduled` usando credenciais Meta em `experts` (com fallback env)
- Dashboard: lista/grid, filtros, métricas, thumbnails ao vivo, duplicar, repostar, link direto do post e ocultar/excluir do sistema
- Dashboard: seleção múltipla para ocultar/excluir em lote no sistema
- Dashboard de detalhe agora mostra snapshots de métricas do Instagram com atualização manual
- Admin owner: visão global de postagens em `/admin/carousels` com ações operacionais
- Admin owner: gestão de tipos de plano em `/admin/plans` (planos customizados + limite de experts)
- Planos agora suportam também `memberLimit` e `monthlyPostCredits`
- Base de Cost Intelligence no schema: catálogo de preços + eventos de consumo/custo
- Admin owner: visão de custos em `/admin/costs` (top workspaces, top usuários e modelos)
- Admin owner: catálogo de preços em `/admin/costs` para cálculo de custo real por unidade
- `/admin/costs` com alertas de pico de custo e risco de estouro de créditos
- `/team` com visibilidade de limites (membros e créditos), alerta de consumo e bloqueio de convite ao atingir `memberLimit`
- `/dashboard` com alerta de upgrade quando o consumo mensal de créditos atinge faixa de risco
- Sidebar exibe consumo de créditos do workspace acima do bloco do usuário
- Créditos e métricas de geração no workspace/admin priorizam `usage_events` (ledger), mantendo fallback legado em `carousels`
- Consumo de crédito mensal ponderado por ação: geração de conteúdo, geração de imagem e publicação
- Política de créditos por ação configurável em `Admin > Costs`
- Carrosséis agora usam soft delete (`deleted_at/deleted_by/deleted_reason`) para auditoria sem perder histórico
- Content Hub DB: platforms, content_formats, templates, template_prompts
- UX DNA Expert em duas etapas: lista primeiro; formulário só após selecionar um DNA ou clicar em `Novo`
- UX Fotos de Referência em duas etapas: lista primeiro; detalhes/fotos após selecionar expert
- Em `Fotos de Referência`, botão `Novo` abre modal simples com experts já cadastrados no DNA (sem redirecionar)

### Em andamento
- Fase 3 concluída no escopo admin/workspace (tokens centralizados na plataforma)
- Fase 4 em aberto: selector de modelo + suporte multi-provider na UI de geração
- Cost Intelligence em progresso: eventos de custo já instrumentados em geração de conteúdo, imagens e publicação
- Enforcement inicial de limites ativo:
- convite de equipe bloqueado ao atingir `memberLimit`
- geração de conteúdo/imagens/publicação bloqueada ao atingir `monthlyPostCredits`
- `/generate` mostra aviso prévio de créditos via `/api/workspace/limits`
- exclusão de carrossel não reduz histórico de uso/custo já registrado em `usage_events`
- cron/publicação ignoram carrosséis excluídos logicamente
- fluxo `X vs Y` não duplica mais inserts em `carousels`
- fluxo `X vs Y` persiste imagens com o `carouselId` real antes da navegação para o dashboard
- publicação reutiliza URLs já persistidas quando disponíveis, reduzindo upload redundante

### Roadmap
Ver `ROADMAP.md` para o plano completo.

---

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencher com chaves do Supabase
npm run dev
# http://localhost:8080
```

### Mudanças recentes: preciso rodar algo no Supabase?

Não para este pacote de correções.

- É necessário reaplicar `supabase-schema.sql` para criar `carousel_metrics_snapshots`
- Não há novo bucket
- Não há nova Edge Function
- Não há novo secret obrigatório

Se a instância já foi provisionada com `supabase-schema.sql` e já possui os buckets `carousel-images` e `expert-photos`, não é necessário executar nada extra no Supabase para:

- correção do template `X vs Y`
- repost/ocultação no sistema/link direto no dashboard
- exclusão em lote no dashboard
- snapshots de métricas do Instagram

O pré-requisito operacional continua sendo o mesmo para ações do Instagram:

- `ig_account_id` e `ig_access_token` válidos no expert, ou fallback via `.env.local`
- imagens persistidas no bucket `carousel-images`
- para atualização automática das métricas, configurar também o cron `sync-instagram-metrics`

## Fluxo recomendado de Expert (importante)

1. Em `Expert > DNA`, crie/salve o expert primeiro.
2. Em `DNA Expert`, use a lista de experts do workspace para alternar entre perfis.
3. O botão `Novo` no DNA respeita o limite do plano (starter/pro/agency).
4. Em `DNA Expert`, a entrada da tela é sempre lista de DNAs + botão `Novo`.
5. Ao entrar em um DNA (existente ou novo), aparecem os detalhes, o botão `Ver exemplo` e o botão `Voltar`.
6. Depois vá em `Expert > Fotos Referência` para subir fotos desse expert.
7. Em `Fotos Referência`, o botão `Novo` abre um modal com os experts já cadastrados no DNA (sem redirecionar).
8. Ao abrir um expert em `Fotos Referência`, a tela de detalhes mostra upload/grade e botão `Voltar`.
9. O owner pode criar/editar tipos de plano em `Admin > Plans` e definir limite de experts por plano.

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| `docs/INSTALLATION.md` | Guia completo de instalação do zero (inclui Meta, Google Cloud, Playwright) |
| `docs/EXPERT-DNA-GUIDE.md` | Como configurar o expert DNA: campos, exemplos, fotos de referência |
| `docs/MULTI-TENANT-ARCHITECTURE.md` | Arquitetura multi-tenant: roles, workspaces, RLS |
| `docs/ADMIN-PANEL.md` | Especificação do painel de administração |
| `docs/COST-INTELLIGENCE.md` | Estratégia de custos, créditos e telemetria de uso |
| `docs/SYSTEM-LOGS.md` | Sistema de logs: eventos, queries, retenção |
| `docs/CONTENT-HUB-ARCHITECTURE.md` | Content Hub: plataformas, formatos, template engine |
| `docs/SUPABASE_SETUP.md` | Setup Supabase via CLI |
| `docs/SUPABASE_SETUP_DASHBOARD_ONLY.md` | Setup Supabase sem terminal (sem CLI) |
| `ROADMAP.md` | Fases de implementação passadas e futuras |
| `supabase-schema.sql` | Schema completo do banco (fonte única da verdade) |
| `.env.example` | Template de variáveis de ambiente comentado |
