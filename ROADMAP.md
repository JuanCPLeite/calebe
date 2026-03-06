# Roadmap — Carousel Studio

Data de referencia: 06/03/2026

## Sprint 1 — Base do produto ✅
- [x] Estrutura Next.js + shadcn + Tailwind
- [x] Sidebar e navegacao principal
- [x] Auth com Supabase
- [x] Banco com RLS e storage

## Sprint 2 — Motor de geracao ✅
- [x] Geracao de topicos (`/api/topics`) com EXA/Claude/mock
- [x] Geracao de conteudo Claude com streaming SSE
- [x] Geracao de imagens Gemini
- [x] Render de cards e preview completo

## Sprint 3 — Expert configuravel ✅
- [x] DNA do expert (tom, estilo, templates)
- [x] Upload e ordenacao de fotos de referencia
- [x] Perfil e publico
- [x] Persistencia em Supabase

## Sprint 4 — Publicacao e operacao ✅
- [x] Persistencia de carrosseis
- [x] Publicacao no Instagram via Meta Graph API
- [x] Dashboard com filtros, busca, duplicacao e exclusao
- [x] Agendamento (`scheduled_at`) e endpoint de cron

## Sprint 5 — Endurecimento tecnico (proximo)
- [ ] Hardening do cron para execucao 100% confiavel sem sessao de usuario
- [ ] Idempotencia forte em publicacao (evitar duplicidade)
- [ ] Retry/politica de falha por etapa (save, publish)
- [ ] Logs estruturados e rastreabilidade por `carousel_id`

## Sprint 6 — Produto e crescimento
- [ ] Migrar `middleware.ts` para `proxy.ts` (Next 16)
- [ ] Melhorar build offline (fontes locais ou fallback)
- [ ] Landing + onboarding
- [ ] Planos/pagamento (Stripe)
- [ ] Metricas de performance e conversao
