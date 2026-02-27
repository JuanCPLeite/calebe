# Carousel Studio

Micro-SaaS para geração de carrosséis virais para Instagram com IA.

**Stack:** Next.js 14 · TypeScript · Tailwind · shadcn/ui · Claude AI · Gemini Image · Meta Graph API

---

## O que é

Plataforma que transforma tendências em carrosséis prontos para publicar no Instagram em 1 clique — com o DNA, tom e estilo do expert configurado.

**Fluxo completo:**
```
Trend discovery (EXA)
  → Análise viral (score, hook sugerido, ganho da audiência)
    → Geração de texto (Claude AI — 10 slides no estilo do expert)
      → Editor inline (bold, italic, destaque, aprovar por slide)
        → Geração de imagens (Gemini — expert como figurante ao fundo)
          → Publicação automática (Meta Graph API)
```

---

## Status

### ✅ Implementado
- Layout com sidebar completa (DNA Expert, Fotos, Perfil, Tokens, Templates, Dashboard, Gerar)
- Topic Discovery — temas trending com análise de viralidade, hook, ganho e ângulos alternativos
- Modo voz — Web Speech API em português
- Carousel Preview — thumbnails dos 10 slides, editor inline
- Formatação: `*negrito*` · `_itálico_` · `{destaque}`
- Aprovação slide a slide antes de gerar imagens
- API route `/api/generate/content` (mock)

### 🔜 Próximo (ver ROADMAP.md)
- Conectar content-engine.js — geração real via Claude AI
- Busca de trends via EXA API
- Geração de imagens via Gemini
- Publicação direta no Instagram
- Autenticação e multi-expert

---

## Arquitetura

```
carousel-studio/              ← este repo (frontend + API routes)
  app/
    generate/                 ← página principal de geração
    expert/dna|photos|audience← configuração do expert
    dashboard/                ← histórico e métricas
    tokens/                   ← chaves de API
    templates/                ← templates reutilizáveis
    api/generate/content/     ← POST → chama content-engine
  components/
    generate/
      topic-card.tsx          ← card de análise viral
      carousel-preview.tsx    ← editor de slides
    sidebar.tsx

aios/squads/traffic/          ← repo AIOS (motor de geração)
  scripts/lib/
    content-engine.js         ← Claude SDK → 10 slides no DNA do expert
    image-generator.js        ← Gemini → imagens por slide
    tweet-card-renderer.js    ← Playwright → PNG dos cards
    instagram-autopost.js     ← Meta Graph API → publicação
  experts/
    juan-carlos/
      profile.yaml            ← DNA do expert (tom, estilo, CTAs)
      style-guide.md          ← guia de escrita
```

---

## Configuração local

```bash
git clone https://github.com/JuanCPLeite/carousel-studio
cd carousel-studio
npm install
npm run dev   # → http://localhost:8080
```

---

## Modelo de negócio

| Plano | Preço | Limites |
|-------|-------|---------|
| Free | R$ 0 | 3 carrosséis/mês · 1 expert |
| Pro | R$ 97/mês | Ilimitado · 3 experts · agendamento |
| Agency | R$ 297/mês | Ilimitado · 10 experts · multi-conta IG |
