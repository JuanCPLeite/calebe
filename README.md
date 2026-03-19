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

## Funcionalidades

### Plataforma
- Auth Google OAuth via Supabase (login seguro, sem senha)
- Multi-tenant: owner, admins de workspace, membros de equipe
- Painel admin: workspaces, usuários, chaves de IA, custos, logs

### Geração de conteúdo
- Template Engine: prompts no banco Supabase, variáveis interpoladas, streaming SSE
- Template **Brand Equity** (frank) — 10 slides estilo Frank Costa
- Template **X vs Y** (split comparativo) — 10-12 slides
- Geração de imagens com Google Gemini (foto do expert como referência)
- Regeneração individual de slides (5, 9, 10) com opções contextuais

### Dashboard e editor
- Editor com strip de slides, controle de fonte, highlight por slide
- Thumbnails ao vivo, duplicar, repostar, link direto do post
- Exclusão em lote, soft delete com auditoria
- Métricas do Instagram (snapshots, atualização manual)

### Publicação
- Instagram via Meta Graph API (Business ou Creator account)
- Agendamento com cron nativo Supabase (pg_cron + Edge Function)
- Upload paralelo de imagens para Supabase Storage

### Cost Intelligence
- Catálogo de preços por provider/modelo
- Ledger de uso (`usage_events`) por workspace
- Alertas de estouro de crédito, política de pesos por ação configurável

### Roadmap
Ver `ROADMAP.md` para fases planejadas.

---

## Nova instância / setup do zero

Para subir uma nova instância do projeto (novo Supabase, novo domínio, novo cliente):

→ **[NOVA-INSTANCIA.md](./NOVA-INSTANCIA.md)** — checklist completo e condensado

Para instruções detalhadas:

→ **[docs/INSTALLATION.md](./docs/INSTALLATION.md)** — guia passo a passo com Google OAuth, Meta, Google Cloud

## Rodar local

```bash
npm install                  # instala deps + Chromium do Playwright
cp .env.example .env.local   # preencher com chaves do Supabase
npm run dev
# http://localhost:8080
```

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
| `NOVA-INSTANCIA.md` | **Checklist rápido** para nova instância — começo aqui |
| `docs/INSTALLATION.md` | Guia detalhado: Google OAuth, Meta, Google Cloud, Vercel |
| `docs/EXPERT-DNA-GUIDE.md` | Como configurar o expert DNA: campos, exemplos, fotos |
| `docs/MULTI-TENANT-ARCHITECTURE.md` | Arquitetura multi-tenant: roles, workspaces, RLS |
| `docs/ADMIN-PANEL.md` | Especificação do painel de administração |
| `docs/COST-INTELLIGENCE.md` | Custos, créditos e telemetria de uso |
| `docs/SYSTEM-LOGS.md` | Sistema de logs: eventos, queries, retenção |
| `docs/CONTENT-HUB-ARCHITECTURE.md` | Content Hub: plataformas, formatos, template engine |
| `docs/SUPABASE_SETUP_DASHBOARD_ONLY.md` | Setup Supabase sem terminal (alternativa ao INSTALLATION.md) |
| `ROADMAP.md` | Fases de implementação passadas e futuras |
| `supabase-schema.sql` | Schema completo do banco (fonte única da verdade) |
| `.env.example` | Template de variáveis de ambiente comentado |
