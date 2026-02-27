# Roadmap — Carousel Studio

## Sprint 1 — Motor funcionando ✅ (hoje)
- [x] Shell Next.js 14 + shadcn na porta 8080
- [x] Sidebar com todas as seções
- [x] Página Gerar: topic discovery + cards de análise viral
- [x] Carousel Preview: editor inline + aprovação por slide
- [x] Modo voz (Web Speech API)
- [x] GitHub repo criado

## Sprint 2 — Geração real (próximo)
- [ ] Conectar `/api/generate/content` → `content-engine.js` (Claude real)
- [ ] Conectar `/api/generate/images` → `image-generator.js` (Gemini real)
- [ ] Renderizar cards PNG via `tweet-card-renderer.js`
- [ ] Botão "Publicar" → `instagram-autopost.js`
- [ ] Busca de trends reais via EXA API

## Sprint 3 — Expert configurável
- [ ] Página DNA Expert — editar tom, estilo, frases padrão
- [ ] Upload de fotos de referência (max 10) + preview
- [ ] Página Perfil & Público — nicho, dores, desejos
- [ ] Salvar configurações em arquivo local (depois: Supabase)

## Sprint 4 — Autenticação + multi-expert
- [ ] Auth com NextAuth (GitHub / Google)
- [ ] Supabase para armazenar usuários e perfis
- [ ] Trocar entre experts (dropdown no sidebar)
- [ ] Isolamento de dados por usuário

## Sprint 5 — Agendamento + Dashboard
- [ ] Calendário de agendamento de posts
- [ ] Dashboard com histórico de carrosséis gerados
- [ ] Métricas de engajamento (via Instagram Insights API)
- [ ] Status de publicação (publicado, agendado, rascunho)

## Sprint 6 — Polimento e lançamento
- [ ] Deploy na Vercel
- [ ] Domínio próprio
- [ ] Página de landing
- [ ] Onboarding (wizard de configuração do expert)
- [ ] Planos e pagamento (Stripe)
