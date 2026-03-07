-- ============================================================
-- Carousel Studio — Schema Unificado (fonte única da verdade)
-- Rodar no: Supabase Dashboard > SQL Editor
-- Cole este arquivo inteiro sempre que precisar recriar o banco.
-- ============================================================

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil do expert por usuário (1 por usuário)
create table if not exists experts (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        references auth.users(id) on delete cascade not null unique,
  display_name          text        not null default '',
  handle                text        not null default '',
  niche                 text        default '',
  bio_short             text        default '',
  product_name          text        default '',
  product_cta           text        default '',
  highlight_color       text        default '#9B59FF',
  avatar_url            text        default '',
  author_slide_template text        default '',
  cta_final_template    text        default '',
  style_rules           text[]      default '{}',
  ig_account_id         text        default '',
  audience_profile      jsonb       default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Fotos de referência do expert (max 10)
create table if not exists expert_photos (
  id           uuid        primary key default gen_random_uuid(),
  expert_id    uuid        references experts(id) on delete cascade not null,
  storage_path text        not null,
  url          text        not null,
  order_index  int         default 0,
  created_at   timestamptz default now()
);

-- Tokens de API por usuário
-- provider: 'anthropic' | 'google' | 'exa' | 'meta_token' | 'meta_account_id'
create table if not exists user_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  provider   text        not null,
  value      text        not null,
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- Historico de carrosseis gerados
create table if not exists carousels (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade not null,
  topic        text        not null,
  caption      text        default '',
  slides       jsonb       not null default '[]',
  ig_post_id   text,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table experts       enable row level security;
alter table expert_photos enable row level security;
alter table user_tokens   enable row level security;
alter table carousels     enable row level security;

-- experts: dono acessa tudo
drop policy if exists "own experts" on experts;
create policy "own experts"
  on experts for all
  using (auth.uid() = user_id);

-- expert_photos: acesso via expert do usuario
drop policy if exists "own expert photos" on expert_photos;
create policy "own expert photos"
  on expert_photos for all
  using (
    exists (
      select 1 from experts
      where id = expert_photos.expert_id
        and user_id = auth.uid()
    )
  );

-- user_tokens: dono acessa tudo
drop policy if exists "own tokens" on user_tokens;
create policy "own tokens"
  on user_tokens for all
  using (auth.uid() = user_id);

-- carousels: dono acessa tudo
drop policy if exists "own carousels" on carousels;
create policy "own carousels"
  on carousels for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('expert-photos', 'expert-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('carousel-images', 'carousel-images', false)
on conflict (id) do nothing;

-- ============================================================
-- STORAGE POLICIES — expert-photos
-- ============================================================

drop policy if exists "upload own expert photos" on storage.objects;
create policy "upload own expert photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "read own expert photos" on storage.objects;
create policy "read own expert photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete own expert photos" on storage.objects;
create policy "delete own expert photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- STORAGE POLICIES — carousel-images
-- ============================================================

drop policy if exists "upload own carousel images" on storage.objects;
create policy "upload own carousel images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "read own carousel images" on storage.objects;
create policy "read own carousel images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "update own carousel images" on storage.objects;
create policy "update own carousel images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete own carousel images" on storage.objects;
create policy "delete own carousel images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- CONTENT HUB — PLATAFORMAS, FORMATOS, TEMPLATES E PROMPTS
-- Fase 1: estrutura de dados para escalar para N templates, N IAs, N plataformas.
-- O frontend continua usando fallback hardcoded ate a Fase 2 (Template Engine).
-- ============================================================

-- Plataformas de publicacao
create table if not exists platforms (
  id         text primary key,
  name       text not null,
  slug       text not null unique,
  icon_url   text,
  active     boolean not null default true,
  sort_order int     not null default 0
);

insert into platforms (id, name, slug, active, sort_order) values
  ('instagram', 'Instagram',  'instagram', true, 1),
  ('linkedin',  'LinkedIn',   'linkedin',  true, 2),
  ('facebook',  'Facebook',   'facebook',  true, 3),
  ('twitter',   'Twitter/X',  'twitter',   true, 4),
  ('pinterest', 'Pinterest',  'pinterest', true, 5)
on conflict (id) do nothing;

-- Formatos de conteudo por plataforma
create table if not exists content_formats (
  id           text primary key,
  platform_id  text    not null references platforms(id),
  name         text    not null,
  slug         text    not null,
  aspect_ratio text    not null,
  canvas_w     int     not null default 1080,
  canvas_h     int     not null default 1350,
  max_slides   int,
  description  text,
  active       boolean not null default true,
  sort_order   int     not null default 0,
  unique(platform_id, slug)
);

insert into content_formats (id, platform_id, name, slug, aspect_ratio, canvas_w, canvas_h, max_slides, active, sort_order) values
  ('ig-carousel', 'instagram', 'Carrossel', 'carousel', '4:5',    1080, 1350, 20, true, 1),
  ('ig-post',     'instagram', 'Post',      'post',     '1:1',    1080, 1080,  1, true, 2),
  ('ig-story',    'instagram', 'Story',     'story',    '9:16',   1080, 1920,  1, true, 3),
  ('li-carousel', 'linkedin',  'Carrossel', 'carousel', '1:1',    1080, 1080, 20, true, 1),
  ('li-post',     'linkedin',  'Post',      'post',     '1.91:1', 1200,  628,  1, true, 2),
  ('fb-post',     'facebook',  'Post',      'post',     '1:1',    1080, 1080,  1, true, 1),
  ('tw-post',     'twitter',   'Post',      'post',     '16:9',   1600,  900,  1, true, 1),
  ('tw-thread',   'twitter',   'Thread',    'thread',   '1:1',    1080, 1080, 10, true, 2)
on conflict (platform_id, slug) do nothing;

-- Templates de conteudo
create table if not exists templates (
  id            text primary key,
  format_id     text references content_formats(id),
  name          text    not null,
  description   text,
  layout        text    not null,
  slide_count   int,
  tags          text[],
  thumbnail_url text,
  active        boolean not null default true,
  sort_order    int     not null default 0,
  created_at    timestamptz not null default now()
);

insert into templates (id, format_id, name, description, layout, slide_count, tags, active, sort_order) values
  (
    'frank-costa-10', 'ig-carousel',
    'Brand Equity',
    'Hook poderoso → 8 slides de conteudo educativo → CTA com slide do autor. Constroi autoridade e reconhecimento de marca.',
    'frank', 10, array['educativo', 'autoridade', '10 slides'], true, 1
  ),
  (
    'positivo-negativo', 'ig-carousel',
    'X vs Y',
    'Split layout comparativo: abordagem errada (esquerda) vs abordagem certa (direita). Alto engajamento.',
    'split', 10, array['comparacao', 'split', 'viral'], true, 2
  )
on conflict (id) do nothing;

-- Prompts por template e por provider (step: 'system' | 'user')
-- Variaveis: {{expert.displayName}}, {{expert.niche}}, {{expert.bioShort}},
--            {{expert.handle}}, {{expert.productName}}, {{expert.productCta}},
--            {{expert.styleRules}}, {{expert.authorSlideTemplate}}, {{expert.ctaFinalTemplate}},
--            {{topic}}, {{hook}}, {{date}}, {{year}}, {{textLengthInstruction}}
create table if not exists template_prompts (
  id          uuid primary key default gen_random_uuid(),
  template_id text    not null references templates(id) on delete cascade,
  step        text    not null,
  provider    text    not null default 'any',
  model       text,
  prompt_text text    not null,
  version     int     not null default 1,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(template_id, step, provider, version)
);

-- Prompt: frank-costa-10 / system
insert into template_prompts (template_id, step, provider, model, prompt_text, version) values (
  'frank-costa-10', 'system', 'any', 'claude-opus-4-6',
  $PROMPT$Voce e {{expert.displayName}}, criador de conteudo especialista em {{expert.niche}}.
DATA ATUAL: {{date}} — use SEMPRE este ano ({{year}}) ao mencionar datas, tendencias ou estatisticas. NUNCA mencione anos anteriores como se fossem "agora".

{{expert.bioShort}}

HANDLE: {{expert.handle}}
PRODUTO: {{expert.productName}}
CTA DO PRODUTO: {{expert.productCta}}

━━━ REGRAS DE ESTILO FRANK COSTA (OBRIGATORIAS) ━━━

Tom de voz:
- Direto, sem rodeios. Fala como se estivesse na mesa de bar com o leitor.
- Coloquial brasileiro: "tu", "ne", "bele", "bora", "cara", "mano".
- Autoridade sem arrogancia. Urgencia real — o mercado muda AGORA.
- Humor cortante e ironico quando cabivel, nunca ofensivo.

{{expert.styleRules}}
NUNCA use: "venha conferir", "nao perca", "transforme sua vida", "incrivel", "revolucionario", "clique aqui".
Use no maximo 1-2 emojis por slide, so se natural.

━━━ PADROES OBRIGATORIOS (usar em pelo menos 1 slide cada) ━━━

1. REFRAME DA PERGUNTA (padrao mais viral):
   "A pergunta nao e '[pergunta obvia/errada]'.
   A pergunta e: '[pergunta que muda a perspectiva]'"

2. ANALOGIA CONCRETA (nunca explique abstrato sem imagem mental fisica):
   Ex: processo manual = "digitar CPF no mesmo campo 300 vezes por dia"
   Ex: ferramenta mal usada = "carro de corrida em estrada de terra"
   IMPORTANTE: varie as analogias conforme o tema — nunca repita os mesmos exemplos em carrosseis diferentes.

3. DADOS SEMPRE ESPECIFICOS:
   Nunca "muito caro" → sempre "R$ X" ou "X horas" ou "X vezes mais"

4. LISTA NUMERADA para revelar processo quebrado:
   1. [Passo 1 com dia/horario]
   2. [Passo 2 com friccao real]
   3. [Resultado ruim/lento]

5. COMPARACAO DIRETA (slide 8 obrigatorio):
   Modo Antigo: [passos + tempo + custo]
   Com Automacao: [passos + tempo + custo]

━━━ ESTRUTURA DOS 10 SLIDES ━━━

Slide 1 — hook
  Template: [FRASE PROVOCATIVA 3-8 PALAVRAS — vai contra o senso comum]
  {[Contexto que confirma com dado especifico.]}
  [Reframe: "nao e X, e Y" ou analogia concreta.]
  [Consequencia inevitavel se nao agir.] 👇

Slide 2 — problem
  Situacao concreta que esta acontecendo AGORA (nao teoria).
  {[Custo oculto em R$ ou horas — numero especifico.]}
  [Analogia do mundo real que torna o problema palpavel.]
  *[Frase-chicote: conclusao que doi um pouco.]*

Slide 3 — content
  {[Area/Processo 1: Nome Claro]}
  O processo padrao: lista numerada mostrando o inferno atual.
  [Dado: X dias, R$ Y/mes]
  {[Com IA/Automacao: tempo real. Custo real.]}
  [Conclusao direta — a conta fecha sozinha.]

Slide 4 — content
  {[Area/Processo 2: Nome Claro]}
  Faz a conta rapido: lista com → mostrando antes/depois com dados.
  Custo: {R$ X/mes} para automacao.
  *[Frase de fechamento com urgencia.]*

Slide 5 — cta (FIXO — COPIAR EXATAMENTE):
{{expert.authorSlideTemplate}}

Slide 6 — benefit
  {[Dado/estatistica forte]} — *(Fonte se houver)*
  Usar o REFRAME: "A pergunta nao e *'[errada]'*"
  {A pergunta certa e:} '[que aponta pro produto]'
  [O concorrente ja percebeu. Ele ja ta testando.]

Slide 7 — content
  {[Area/Processo 3: Nome Claro]}
  [Modo manual: X tempo/custo.] {[Modo IA: Y tempo/custo.]}
  [Ironia ou paradoxo que torna a comparacao obvia.]
  *[Frase de fechamento cortante.]*

Slide 8 — comparison
  *Modo Antigo:*
  [Passo] → [Passo] → [Resultado lento]. *[X min/h por operacao.]*
  {Com Automacao de IA:}
  [Passo] → [Resultado rapido]. *[X segundos. Zero erro humano.]*
  Qual dos dois escala quando teu negocio dobra de tamanho?

Slide 9 — proof
  {[Afirmacao contraintuitiva ou erro comum.]}
  [Consequencia de fazer errado — especifica.]
  Anota isso: [analogia concreta e INEDITA — adaptada ao tema]
  [O segredo nao e a ferramenta. E saber qual processo usar.]
  [CTA suave apontando pro conteudo/produto.]

Slide 10 — cta-final (FIXO — COPIAR EXATAMENTE):
{{expert.ctaFinalTemplate}}

━━━ IMAGENS (imagePrompt) ━━━

ATENCAO: imagePrompt e OBRIGATORIO em TODOS os 10 slides.
- Em INGLES, cena fotorrealista, sem texto na imagem
- Situacoes CONCRETAS — nunca abstracoes genericas
- Por tipo de slide:
  hook      → photorealistic scene directly representing the carousel topic
  problem   → messy desk, multiple open tabs, overwhelmed professional
  content   → clean dashboard, automated workflow, organized digital setup
  cta       → warm professional portrait or natural workplace scene
  benefit   → confident professional, upward growth visual
  comparison → split view: left=chaotic manual process, right=clean automated setup
  proof     → skilled expert using specialized tool
  cta-final → person relaxed at desk, business running smoothly$PROMPT$,
  1
) on conflict (template_id, step, provider, version) do nothing;

-- Prompt: frank-costa-10 / user
insert into template_prompts (template_id, step, provider, prompt_text, version) values (
  'frank-costa-10', 'user', 'any',
  $PROMPT$Gere um carrossel de 10 slides no estilo Frank Costa sobre:

"{{topic}}"

{{hookInstruction}}

{{textLengthInstruction}}

REGRAS CRITICAS:
- Slide 1: PRIMEIRA linha = frase de abertura impactante (obrigatorio)
- Slide 5: COPIAR EXATAMENTE o template do autor fornecido no system prompt. NENHUMA alteracao.
- Slide 10: COPIAR EXATAMENTE o template de CTA final. NENHUMA alteracao.
- Dados sempre especificos com numeros reais
- Usar pelo menos 1 reframe ("A pergunta nao e... A pergunta e:")
- Usar pelo menos 1 lista numerada mostrando processo quebrado
- Slide 8 DEVE ter formato Modo Antigo vs Com Automacao com dados de tempo/custo
- imagePrompt e OBRIGATORIO em TODOS os 10 slides (incluindo slides 5 e 10)

RESPONDA SOMENTE com JSON valido, sem markdown, sem explicacoes:

{
  "topic": "{{topic}}",
  "caption": "legenda Instagram: hook de 1 linha + 3 bullets com dados + CTA salvar + quebras visuais (.) + 5-7 hashtags relevantes",
  "slides": [
    {
      "num": 1,
      "type": "hook",
      "text": "texto do slide — use *negrito* para frase-chicote e {destaque} para dados/valores chave",
      "imagePrompt": "detailed photorealistic scene in English, no text in image"
    }
  ]
}

Tipos validos por slide: 1=hook, 2=problem, 3=content, 4=content, 5=cta, 6=benefit, 7=content, 8=comparison, 9=proof, 10=cta-final$PROMPT$,
  1
) on conflict (template_id, step, provider, version) do nothing;

-- Prompt: positivo-negativo / system
insert into template_prompts (template_id, step, provider, model, prompt_text, version) values (
  'positivo-negativo', 'system', 'any', 'claude-opus-4-6',
  $PROMPT$Voce e um especialista em conteudo viral para Instagram no formato carrossel comparativo "X vs Y".
DATA ATUAL: {{date}}

Voce cria conteudo para: {{expert.displayName}} — especialista em {{expert.niche}}.
{{expert.bioShort}}

REGRAS DE COPYWRITING:
1. Titulos de slide SEMPRE em CAIXA ALTA
2. Maximo 2-3 frases por lado, diretas e impactantes
3. Use **negrito** com duplo asterisco para palavras-chave
4. Tom: direto, assertivo, provocativo — sem rodeios
5. Lado esquerdo: mostra a DOR, a abordagem errada/negativa, a consequencia ruim
6. Lado direito: mostra a SOLUCAO, a atitude correta, o resultado positivo
7. Gere entre 8 e 10 slides de conteudo (alem da capa e CTA = 10-12 total)
8. Progressao de intensidade: comeca leve, termina com as situacoes mais impactantes
9. CTA final DEVE provocar comentarios, marcacoes ou compartilhamentos
10. Conteudo deve ser PRATICO e ESPECIFICO — situacoes reais, nao generalidades

Retorne APENAS JSON valido, sem markdown, sem backticks:
{
  "topic": "tema real do carrossel",
  "caption": "Legenda do Instagram com emojis, quebras visuais e 5-7 hashtags relevantes ao nicho",
  "slides": [
    {
      "num": 0,
      "type": "cover",
      "layout": "split-cover",
      "text": "TITULO X VS. Y",
      "subtitulo": "Pergunta provocativa que gera curiosidade?",
      "labelEsquerda": "Nome do perfil negativo",
      "labelDireita": "Nome do perfil positivo",
      "imagePrompt": ""
    },
    {
      "num": 1,
      "type": "content",
      "layout": "split-content",
      "text": "SITUACAO ESPECIFICA EM CAIXA ALTA",
      "esquerda": "Texto do lado negativo com **palavras-chave**. Maximo 3 frases.",
      "direita": "Texto do lado positivo com **palavras-chave**. Maximo 3 frases.",
      "labelEsquerda": "Nome do perfil negativo",
      "labelDireita": "Nome do perfil positivo",
      "imagePrompt": "Prompt em ingles para imagem relacionada ao slide (sem texto na imagem)"
    },
    {
      "num": 11,
      "type": "cta-final",
      "layout": "split-cta",
      "text": "PERGUNTA PROVOCATIVA EM CAIXA ALTA?",
      "subtexto": "Call-to-action: marque alguem que precisa ver isso.",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "imagePrompt": ""
    }
  ]
}$PROMPT$,
  1
) on conflict (template_id, step, provider, version) do nothing;

-- Prompt: positivo-negativo / user
insert into template_prompts (template_id, step, provider, prompt_text, version) values (
  'positivo-negativo', 'user', 'any',
  $PROMPT$Crie um carrossel comparativo "X vs Y" sobre o tema: "{{topic}}"

O carrossel deve ter:
- Capa com titulo impactante mostrando o contraste dos dois perfis
- 8 a 10 slides de conteudo (situacoes praticas, especificas e progressivas)
- Slide final de CTA que provoque comentarios e marcacoes

IMPORTANTE: cada situacao deve ser ESPECIFICA e PRATICA.
Evite generalidades — mostre cenas concretas e reconheciveis do dia a dia.$PROMPT$,
  1
) on conflict (template_id, step, provider, version) do nothing;

-- RLS para tabelas de conteudo hub (leitura publica — sem dados de usuario)
alter table platforms        enable row level security;
alter table content_formats  enable row level security;
alter table templates        enable row level security;
alter table template_prompts enable row level security;

drop policy if exists "public read platforms"        on platforms;
drop policy if exists "public read content_formats"  on content_formats;
drop policy if exists "public read templates"        on templates;
drop policy if exists "public read template_prompts" on template_prompts;

create policy "public read platforms"        on platforms        for select using (true);
create policy "public read content_formats"  on content_formats  for select using (true);
create policy "public read templates"        on templates        for select using (true);
create policy "public read template_prompts" on template_prompts for select using (true);

-- ============================================================
-- CRON NATIVO SUPABASE — publicacao automatica de carrosseis agendados
-- ============================================================
-- Extensoes necessarias (idempotente):
-- create extension if not exists pg_net;
-- create extension if not exists pg_cron;
--
-- Fluxo recomendado:
--   1. Crie a Edge Function `publish-scheduled` no Supabase
--   2. Defina o secret CRON_SECRET na Function
--   3. Habilite as extensoes pg_net e pg_cron
--   4. Agende o job abaixo para chamar a Function a cada 1 minuto
--
-- Precisao de postagem:
--   - Com cron de 1 minuto, o post ocorre normalmente entre 0-60s apos scheduled_at
--   - Exemplo: agendado 17:33 -> publica no ciclo de 17:33 ou 17:34 (dependendo do segundo exato)
--   - Para "segundo exato", cron SQL nao e a ferramenta adequada
--
-- URL padrao de Edge Function:
--   https://<PROJECT_REF>.functions.supabase.co/publish-scheduled
--
-- Headers esperados:
--   Content-Type: application/json
--   x-cron-secret: <CRON_SECRET_DA_FUNCTION>
--
-- Exemplo:
-- SELECT cron.schedule(
--   'publish-scheduled-carousels',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/publish-scheduled',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_DA_FUNCTION>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para verificar: SELECT * FROM cron.job;
-- Para remover:   SELECT cron.unschedule('publish-scheduled-carousels');
