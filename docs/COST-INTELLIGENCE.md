# Cost Intelligence — Especificação Inicial

> Objetivo: medir custo real de geração/publicação e suportar limites por plano (usuários, créditos, orçamento).
> Status: schema + instrumentação inicial + dashboard owner de custos (`/admin/costs`) + alertas de crédito em telas de workspace.
> Data: 2026-03-07

---

## Escopo desta fase

- Definir catálogo de preços por provider/modelo/unidade.
- Registrar eventos granulares de consumo e custo.
- Habilitar consultas por workspace, usuário, provider e modelo.
- Preparar base para dashboards e billing (fase seguinte).

---

## Tabelas

### `provider_price_catalog`

Catálogo versionado de preço unitário em USD.

- `provider`: `anthropic` | `openai` | `google` | `meta` | `internal`
- `model`: ex. `claude-sonnet-4-5`, `gpt-4o`
- `unit`: `token_in` | `token_out` | `image` | `publish` | `render`
- `price_per_unit`
- `effective_from`

Uso típico:
- atualizar preços de token/modelo sem alterar código;
- manter histórico de mudanças de preço no tempo.

### `usage_events`

Evento granular de consumo/custo por ação.

- `workspace_id`, `user_id`, `carousel_id`
- `provider`, `model`
- `event_type`: `content.generate` | `image.generate` | `publish` | `render`
- `unit`, `quantity`
- `unit_cost_usd`, `total_cost_usd`
- `metadata` (jsonb)

Uso típico:
- custo por carrossel;
- custo por workspace/usuário;
- modelo mais usado e custo médio por modelo.

---

## RLS

- `provider_price_catalog`: owner gerencia (leitura/escrita).
- `usage_events`: owner vê tudo; workspace vê somente o próprio (`select`).
- inserções de telemetria continuam sendo responsabilidade das rotas server-side com contexto seguro.

---

## Entregas já implementadas

1. Instrumentação de `usage_events` em:
   - `/api/generate/content` (eventos `render`, `token_in`, `token_out` estimados)
   - `/api/generate/images` (evento `image`)
   - `/api/publish` (evento `publish`)
2. Endpoint owner `/api/admin/costs` com agregados por período/workspace.
3. Tela owner `/admin/costs` com top workspaces, top usuários e top modelos.
4. Gestão de preços em `/api/admin/costs/prices` integrada à tela `/admin/costs`.
5. Enforcement inicial de créditos mensais em `/api/generate/content`, `/api/generate/images` e `/api/publish`.
6. Seed opcional de baseline em `/api/admin/costs/prices/seed` (valores estimados).
7. Alertas no `/admin/costs` para pico de custo e workspaces perto/estourados no crédito.
8. Projeção mensal de custo por workspace no `/admin/costs`.
9. Endpoint `/api/workspace/limits` para a UI informar crédito disponível antes da geração.
10. `/team` agora mostra uso de créditos/membros e bloqueia convite ao atingir `memberLimit`.
11. `/dashboard` agora mostra alerta de risco/esgotamento de créditos com indicação de upgrade.
12. Cálculo de crédito mensal (`/api/workspace/limits`) agora prioriza `usage_events` (`content.generate` + `render`) com fallback legado.
13. Métricas de geração em `/api/admin/workspaces` e `/api/admin/workspaces/[id]` também priorizam ledger de `usage_events`.
14. `supabase-schema.sql` inclui backfill idempotente de `carousels.workspace_id` para bases legadas.

---

## Próximas entregas

1. Refinar cálculo de custo real por provider/modelo com telemetria de tokens nativos por API (reduzir estimativa).
2. Evoluir regra de excedente por plano (cobrança extra/overage) além do bloqueio/alerta atual.
3. Entregar painel admin com custo por usuário e tendência temporal comparativa por modelo.
4. Avaliar soft delete de carrossel para retenção operacional sem perder histórico visual.
