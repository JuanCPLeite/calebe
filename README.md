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

## Estado atual (06/03/2026)

### Implementado
- Auth Supabase (rotas privadas + callback)
- Template Engine: busca prompts do banco, interpola variáveis, streama SSE
- Templates: **Brand Equity** (frank) e **X vs Y** (split comparativo)
- Editor com coverflow (prev/ativo/next), controle de fonte e highlight
- Geração de imagens com Gemini
- Publicação no Instagram via Meta Graph API
- Agendamento com cron nativo Supabase
- Dashboard: lista/grid, filtros, métricas, thumbnails ao vivo, duplicar, excluir
- Content Hub DB: platforms, content_formats, templates, template_prompts

### Em andamento
- Multi-tenant: workspaces, roles, app_settings (chaves da plataforma)
- Painel admin: métricas, logs, gestão de workspaces e clientes

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

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| `docs/INSTALLATION.md` | Guia completo de instalação do zero |
| `docs/MULTI-TENANT-ARCHITECTURE.md` | Arquitetura multi-tenant: roles, workspaces, RLS |
| `docs/ADMIN-PANEL.md` | Especificação do painel de administração |
| `docs/SYSTEM-LOGS.md` | Sistema de logs: eventos, queries, retenção |
| `docs/CONTENT-HUB-ARCHITECTURE.md` | Content Hub: plataformas, formatos, template engine |
| `ROADMAP.md` | Fases de implementação passadas e futuras |
| `SUPABASE_SETUP_DASHBOARD_ONLY.md` | Setup do Supabase sem terminal |
| `supabase-schema.sql` | Schema completo do banco (fonte única da verdade) |
| `.env.example` | Template de variáveis de ambiente comentado |
