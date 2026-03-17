# Guia do Expert DNA — Como configurar um expert

> Este guia explica cada campo do Expert DNA e como preenchê-los corretamente para que o sistema gere conteúdo de qualidade.
> Rota: `/expert/dna`

---

## O que é o Expert DNA

O Expert DNA é o perfil do criador de conteúdo. Todos os carrosséis gerados usam esses dados para personalizar o tom de voz, o nicho, o produto e os slides fixos (autor e CTA final).

**Regra importante:** salve o DNA antes de acessar `/expert/photos`. O expert precisa existir no banco para receber fotos de referência.

---

## Campos do Formulário

### Campos Básicos

| Campo | O que é | Exemplo |
|-------|---------|---------|
| **Nome de Exibição** (`display_name`) | Nome público do expert — como aparece nos slides | `Frank Costa` |
| **Handle** (`handle`) | @usuário do Instagram — sem o @ | `frankcostaoficial` |
| **Nicho** (`niche`) | Área de especialidade — usado para personalizar tom e analogias | `automação de processos e IA para negócios` |
| **Bio Curta** (`bio_short`) | Frase de autoridade — aparece no system prompt da IA | `Especialista em automação que já ajudou mais de 500 empresas a cortar custos com IA.` |
| **Nome do Produto** (`product_name`) | Produto/serviço principal que será mencionado no CTA | `Mentoria Automação Lucrativa` |
| **CTA do Produto** (`product_cta`) | Chamada para ação do produto | `Acesse automatizacaolucrativa.com.br e entre na lista VIP` |
| **Cor de Destaque** (`highlight_color`) | Cor em hex usada para destacar texto entre `{chaves}` nos cards | `#9B59FF` |

---

### Campos Críticos — Slides Fixos

Estes dois campos controlam os slides que **não são gerados pela IA** — são copiados literalmente no carrossel Brand Equity. Use exatamente o texto que vai aparecer no card.

#### `author_slide_template` — Slide 5 (Apresentação do Autor)

O conteúdo exato do slide 5. A IA copia este texto sem alterar nada.

**Formato recomendado:**
```
Sou {Frank Costa}.
Especialista em {automação e IA} para negócios.

Já ajudei +500 empresas a cortar *custos operacionais* com automação inteligente.

Segue o perfil pra não perder os próximos drops 👇
@frankcostaoficial
```

**Regras de markup:**
- `*texto*` → negrito (cor principal)
- `{texto}` → destaque com a cor do expert
- Parágrafos separados por linha em branco
- Máximo ~200 caracteres para caber bem no card

#### `cta_final_template` — Slide 10 (CTA Final)

O conteúdo exato do slide 10. Também é copiado literalmente.

**Formato recomendado:**
```
*Para de perder tempo* fazendo na mão o que a IA faz em segundos.

{Mentoria Automação Lucrativa} — próxima turma abrindo em breve.

Acesse automatizacaolucrativa.com.br e entra na lista VIP 🔗
```

**Dica:** seja direto. Slide 10 é o fechamento — não repita o que já foi dito, só a ação final.

---

### `style_rules` — Regras de Estilo Específicas

Array de strings. Cada item é uma regra extra que a IA deve seguir além das regras padrão do template Frank Costa.

**Quando usar:** quando o expert tem peculiaridades de tom ou restrições que diferem do padrão.

**Exemplos:**
```
[
  "Nunca mencionar concorrentes pelo nome",
  "Sempre usar dados do mercado brasileiro, nunca americano",
  "Preferir exemplos do setor de varejo físico",
  "Evitar termos técnicos — o público é leigo em tecnologia"
]
```

**Quando deixar vazio:** se o expert segue o tom padrão Frank Costa, deixe o array vazio. O template já tem regras suficientes.

---

### Campos de Publicação (Instagram)

| Campo | O que é | Como obter |
|-------|---------|------------|
| `ig_account_id` | ID numérico da conta Instagram Business/Creator | Ver `INSTALLATION.md` — Passo 9.1 |
| `ig_access_token` | Token de acesso Meta Graph API | Ver `INSTALLATION.md` — Passo 9.1 |

> Em instâncias com múltiplos experts, cada expert tem seu próprio `ig_account_id` e `ig_access_token`. A publicação usa as credenciais do expert ativo.

---

## Fotos de Referência (`/expert/photos`)

O sistema envia uma foto do expert como referência para o Google Gemini ao gerar imagens. Isso garante consistência visual — o rosto do expert aparece nas imagens dos cards.

**Regras:**
- Máximo 10 fotos por expert
- Formatos aceitos: JPG, PNG, WebP
- Recomendado: fotos em alta resolução, fundo simples, boa iluminação
- A primeira foto da lista é usada como referência principal

**Fluxo:**
1. Salve o DNA do expert primeiro em `/expert/dna`
2. Acesse `/expert/photos`
3. Clique em **Novo** e selecione o expert
4. Faça upload das fotos

---

## Exemplo Completo de Expert DNA

```json
{
  "display_name": "Maria Oliveira",
  "handle": "mariaoliveira.financas",
  "niche": "educação financeira para autônomos e pequenos empresários",
  "bio_short": "CFP® com 12 anos de mercado. Já ajudei mais de 800 clientes a sair do vermelho e construir patrimônio do zero.",
  "product_name": "Método Finanças Blindadas",
  "product_cta": "Acesse financasblindadas.com.br e baixe o diagnóstico gratuito",
  "highlight_color": "#00B894",
  "author_slide_template": "Sou {Maria Oliveira}, CFP® e educadora financeira.\n\nAjudei +800 autônomos e pequenos empresários a *sair do vermelho* e construir patrimônio real.\n\nSegue pra não perder as próximas dicas 👇\n@mariaoliveira.financas",
  "cta_final_template": "*Chega de improvisar* com o dinheiro do negócio.\n\n{Método Finanças Blindadas} — diagnóstico gratuito disponível agora.\n\nAcesse financasblindadas.com.br e descobre onde tá vazando 🔗",
  "style_rules": [
    "Usar exemplos com valores em reais (R$), nunca em dólar",
    "Público-alvo: autônomos e MEIs com faturamento entre R$5k e R$30k/mês",
    "Evitar termos como 'ações', 'renda variável' — foco é gestão de fluxo de caixa"
  ]
}
```

---

## Múltiplos Experts no Mesmo Workspace

Um workspace pode ter múltiplos experts (limitado pelo plano: Starter=1, Pro=3, Agency=ilimitado).

**Como alternar:**
- No header do app, há um seletor de expert ativo
- O expert ativo é usado em todas as gerações e publicações
- Cada expert tem seu próprio DNA, fotos e credenciais Instagram

**Como gerenciar:**
- `/expert/dna` — lista todos os experts do workspace; clique para editar
- Botão **Novo** cria um expert adicional (se o plano permitir)
- O owner pode configurar o limite em `/admin/plans`

---

## Troubleshooting

### "Perfil de expert não encontrado" ao gerar conteúdo

- Verifique se há pelo menos um expert salvo em `/expert/dna`
- Confirme qual expert está ativo no seletor do header
- Em workspaces com múltiplos experts, o `active_expert_id` precisa estar setado em `profiles`

### Slides 5 e 10 aparecem com texto errado

- Os slides 5 e 10 do template Brand Equity são copiados literalmente do `author_slide_template` e `cta_final_template`
- Se aparecerem com texto genérico, é porque esses campos estão vazios — preencha e gere novamente

### Imagens geradas sem o rosto do expert

- Verifique se há fotos cadastradas em `/expert/photos`
- O expert precisa estar salvo no DNA antes de cadastrar fotos
- A foto de referência é enviada ao Gemini junto com o prompt de cada slide
