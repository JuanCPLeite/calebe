import { useState } from "react";

// ── SAMPLE DATA ──
const SAMPLE_DATA = {
  titulo_capa: "LÍDER BONZINHO VS. LÍDER HUMANO",
  subtitulo_capa: "Qual tipo de liderança você está exercendo hoje?",
  label_esquerda: "Líder Bonzinho",
  label_direita: "Líder Humano",
  slides: [
    {
      numero: 1,
      titulo: "QUANDO O COLABORADOR NÃO BATE A META",
      esquerda: "Aceita qualquer desculpa e diminui a meta no mês seguinte para o colaborador não se frustrar.",
      direita: 'Senta junto, analisa os números, pergunta "o que faltou?" e desenha um plano de ação. Deixa claro que o **resultado é inegociável**, mas oferece ferramentas.',
    },
    {
      numero: 2,
      titulo: "DIANTE DE UM ERRO OPERACIONAL GRAVE",
      esquerda: 'Assume a culpa ou esconde o erro para não "chatear" o colaborador. Diz: "Deixa que eu resolvo, não foi nada".',
      direita: "Aplica o feedback. Mostra o impacto daquele erro no coletivo e no cliente, cobra responsabilidade, mas não humilha. **Foca no fato, não no indivíduo.**",
    },
    {
      numero: 3,
      titulo: "PEDIDO DE AUMENTO SEM MERECIMENTO",
      esquerda: "Fica com pena ou medo de perder o funcionário e dá o aumento, mesmo sem a empresa poder. Cria uma **injustiça com quem performa**.",
      direita: 'É transparente. Mostra que o crescimento é proporcional ao valor gerado. Diz: "Hoje você não está pronto, mas **vamos montar um plano**".',
    },
    {
      numero: 4,
      titulo: "FUNCIONÁRIO COM PROBLEMAS PESSOAIS AFETANDO O TRABALHO",
      esquerda: 'Mantém a pessoa na empresa sem produzir, pagando salário integral, **prejudicando** o caixa e **sobrecarregando** os outros.',
      direita: "Acolhe, ouve, oferece suporte, mas estabelece um **prazo**. Entende a situação, mas toma decisões pensando no coletivo.",
    },
    {
      numero: 5,
      titulo: "CONFLITO ENTRE COLABORADORES",
      esquerda: "Finge que não vê, esperando que se resolva sozinho para não ter que se indispor com ninguém. Permite que a fofoca cresça.",
      direita: 'Chama as partes para uma conversa franca. Deixa claro que "fofoca e intriga são inadmissíveis". Exige profissionalismo.',
    },
  ],
  cta: {
    pergunta: "E VOCÊ, QUAL TIPO DE LÍDER ESTÁ SENDO HOJE?",
    subtexto: "Marque aquele líder que precisa ouvir isso. Salve para reler quando precisar.",
    hashtags: "#liderança #gestãodepessoas #líderhumano",
  },
};

const PROMPT_TEMPLATE = `Você é um especialista em conteúdo viral para Instagram no formato carrossel comparativo.

OBJETIVO: Gerar um carrossel de ALTO VALOR, comparando duas abordagens opostas sobre um tema, no formato "X vs Y". O conteúdo deve ser relevante para o nicho, prático e provocar reflexão.

FORMATO: Instagram carrossel — 1080x1350px (4:5), slides deslizáveis.

ESTRUTURA OBRIGATÓRIA:

SLIDE 0 — CAPA:
- Título principal em letras grandes e impactantes (ex: "X VS. Y")
- Subtítulo com pergunta provocativa que gere curiosidade
- Fundo escuro com imagem desfocada ao fundo

SLIDES 1 a N — CONTEÚDO COMPARATIVO:
Cada slide deve ter:
- Número + título da situação em CAIXA ALTA no topo (centralizado no card inteiro)
- Lado ESQUERDO = abordagem negativa/errada (imagem de fundo full-bleed + texto sobreposto)
- Lado DIREITO = abordagem positiva/correta (imagem de fundo full-bleed + texto sobreposto)
- Label identificando cada lado (esquerda: fundo branco/texto preto | direita: fundo laranja/texto branco)
- Texto curto (2-3 frases max) com palavras-chave em **negrito**
- A imagem cobre TODA a área de cada lado, com gradiente escuro por cima para legibilidade

SLIDE FINAL — CTA:
- Pergunta provocativa em letras grandes que gere comentários
- Subtexto com call-to-action (marcar alguém, salvar, compartilhar)
- Hashtags relevantes ao nicho

FORMATO DE SAÍDA — JSON PURO (sem markdown, sem backticks):
{
  "titulo_capa": "TÍTULO X VS. TÍTULO Y",
  "subtitulo_capa": "Pergunta provocativa aqui?",
  "label_esquerda": "Nome do Perfil Negativo",
  "label_direita": "Nome do Perfil Positivo",
  "slides": [
    {
      "numero": 1,
      "titulo": "SITUAÇÃO EM CAIXA ALTA",
      "esquerda": "Texto do lado negativo com **palavras** em negrito.",
      "direita": "Texto do lado positivo com **palavras** em negrito.",
      "prompt_imagem_esquerda": "Prompt para gerar imagem do lado negativo",
      "prompt_imagem_direita": "Prompt para gerar imagem do lado positivo"
    }
  ],
  "cta": {
    "pergunta": "PERGUNTA PROVOCATIVA EM CAIXA ALTA?",
    "subtexto": "Call-to-action aqui. Marque, salve, compartilhe.",
    "hashtags": "#hashtag1 #hashtag2 #hashtag3"
  }
}

REGRAS DE COPYWRITING:
1. Títulos SEMPRE em caixa alta
2. Máximo 2-3 frases por lado, diretas e impactantes
3. Use aspas para simular falas do personagem quando fizer sentido
4. Palavras-chave em **negrito** (marcadas com **)
5. Tom: direto, assertivo, sem rodeios
6. Lado esquerdo: mostra a DOR, a consequência negativa
7. Lado direito: mostra a SOLUÇÃO, a atitude correta
8. Gere entre 8 e 12 slides de conteúdo
9. Progressão de intensidade (começa leve, termina pesado)
10. CTA final DEVE provocar engajamento (comentário/compartilhamento/marcação)
11. O conteúdo deve ser de ALTO VALOR — prático, aplicável, que a pessoa salve

REGRAS PARA PROMPTS DE IMAGEM (para cada lado):
- Estilo: ilustração digital semi-realista, tons quentes (laranja/marrom)
- Lado esquerdo: pessoa estressada, frustrada, cabeça baixa, expressão de cansaço
- Lado direito: pessoa confiante, postura de liderança, sorriso seguro
- Ambiente: escritório escuro com iluminação cinematográfica
- A imagem deve cobrir todo o espaço (full-bleed), sem bordas

NICHO/TEMA: {TEMA}
PÚBLICO-ALVO: {PUBLICO}
TOM DE VOZ: {TOM}
NÚMERO DE SLIDES: {NUM_SLIDES}`;

// ── Render bold text with ** markers ──
function RenderBoldText({ text, fontSize = 9, color = "#fff", align = "center" }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p style={{ color, fontSize, lineHeight: 1.45, margin: 0, textAlign: align, textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5)" }}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

// ── SLIDE: COVER ──
function CoverSlide({ title, subtitle, scale = 1 }) {
  const w = 270 * scale;
  const h = 337 * scale;
  return (
    <div style={{
      width: w, height: h, borderRadius: 8 * scale, position: "relative", overflow: "hidden", flexShrink: 0,
      background: "#0c0c0c",
    }}>
      {/* Full-bleed BG image simulation */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 60% 40%, rgba(180,100,30,0.25) 0%, transparent 55%), radial-gradient(ellipse at 35% 65%, rgba(120,70,20,0.2) 0%, transparent 50%)",
        filter: "blur(2px)",
      }} />
      {/* Person silhouette in bg */}
      <div style={{
        position: "absolute", top: "15%", left: "55%", transform: "translateX(-50%)",
        width: "50%", height: "60%",
        background: "radial-gradient(ellipse at 50% 40%, rgba(200,130,50,0.15) 0%, transparent 70%)",
      }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />

      <div style={{
        position: "relative", zIndex: 1, height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: w * 0.08,
      }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
          fontSize: w * 0.155,
          fontWeight: 400,
          color: "#fff",
          lineHeight: 0.95,
          margin: 0,
          letterSpacing: 1.5 * scale,
        }}>
          {title}
        </h2>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: w * 0.045,
          color: "#ccc",
          marginTop: h * 0.05,
          fontStyle: "italic",
          lineHeight: 1.4,
        }}>
          Qual <span style={{ fontWeight: 700, color: "#fff" }}>tipo de liderança</span> você está exercendo hoje?
        </p>
      </div>
    </div>
  );
}

// ── SLIDE: CONTENT (Full-bleed images + text overlay) ──
function ContentSlide({ slide, labelLeft, labelRight, scale = 1 }) {
  const w = 270 * scale;
  const h = 337 * scale;
  const fs = (v) => v * scale;

  return (
    <div style={{
      width: w, height: h, borderRadius: 8 * scale, position: "relative", overflow: "hidden", flexShrink: 0,
      display: "flex", flexDirection: "column", background: "#111",
    }}>
      {/* ── Title bar (centered across entire card) ── */}
      <div style={{
        background: "#111",
        padding: `${fs(7)}px ${fs(8)}px`,
        textAlign: "center",
        zIndex: 10,
        position: "relative",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <h3 style={{
          fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
          fontSize: fs(12),
          fontWeight: 400,
          color: "#fff",
          margin: 0,
          letterSpacing: fs(0.8),
          lineHeight: 1.15,
        }}>
          {slide.numero}. {slide.titulo}
        </h3>
      </div>

      {/* ── Split content area ── */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>

        {/* ──── LEFT SIDE (Full-bleed image + overlay + text) ──── */}
        <div style={{
          flex: 1, position: "relative", overflow: "hidden",
          borderRight: `1px solid rgba(255,255,255,0.08)`,
        }}>
          {/* FULL-BLEED background image */}
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(155deg, #5a3a1e 0%, #3d2815 25%, #2a1a0d 55%, #1a100a 100%)`,
          }} />
          {/* Person figure (stressed) */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8%" }}>
            <div style={{ position: "relative", width: "75%", height: "55%" }}>
              {/* Head */}
              <div style={{
                width: fs(28), height: fs(28), borderRadius: "50%",
                background: "radial-gradient(circle at 45% 40%, #c49060 0%, #8a6035 60%, #5a3d20 100%)",
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }} />
              {/* Hair */}
              <div style={{
                width: fs(30), height: fs(16), borderRadius: "50% 50% 0 0",
                background: "linear-gradient(180deg, #3d2510 0%, #5a3515 100%)",
                position: "absolute", top: fs(-2), left: "50%", transform: "translateX(-50%)",
              }} />
              {/* Body/shoulders */}
              <div style={{
                width: fs(50), height: fs(40),
                background: "linear-gradient(180deg, #c47a30 0%, #a86520 50%, #8a5218 100%)",
                borderRadius: `${fs(6)}px ${fs(6)}px 0 0`,
                position: "absolute", top: fs(24), left: "50%", transform: "translateX(-50%)",
              }} />
              {/* Hand on head (stress gesture) */}
              <div style={{
                width: fs(10), height: fs(10), borderRadius: "50%",
                background: "#c49060",
                position: "absolute", top: fs(4), right: "15%",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
          {/* Dark gradient overlay (bottom heavy for text) */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.88) 80%, rgba(0,0,0,0.95) 100%)",
          }} />

          {/* Label + Text (overlaid on image) */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: `0 ${fs(6)}px ${fs(10)}px`,
          }}>
            <div style={{
              background: "#fff", padding: `${fs(3)}px ${fs(10)}px`,
              borderRadius: fs(3), marginBottom: fs(7),
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: fs(8.5), fontWeight: 800, color: "#111" }}>
                {labelLeft}
              </span>
            </div>
            <RenderBoldText text={slide.esquerda} fontSize={fs(8)} />
          </div>
        </div>

        {/* ──── RIGHT SIDE (Full-bleed image + overlay + text) ──── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* FULL-BLEED background image */}
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(155deg, #35363d 0%, #282830 25%, #1e1e28 55%, #141418 100%)`,
          }} />
          {/* Person figure (confident) */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "6%" }}>
            <div style={{ position: "relative", width: "75%", height: "55%" }}>
              {/* Head */}
              <div style={{
                width: fs(28), height: fs(28), borderRadius: "50%",
                background: "radial-gradient(circle at 50% 40%, #d4a070 0%, #a07040 60%, #705030 100%)",
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }} />
              {/* Hair */}
              <div style={{
                width: fs(30), height: fs(16), borderRadius: "50% 50% 0 0",
                background: "linear-gradient(180deg, #2a1808 0%, #3d2510 100%)",
                position: "absolute", top: fs(-2), left: "50%", transform: "translateX(-50%)",
              }} />
              {/* Blazer/body */}
              <div style={{
                width: fs(52), height: fs(44),
                background: "linear-gradient(180deg, #2a2a32 0%, #222228 50%, #1a1a20 100%)",
                borderRadius: `${fs(6)}px ${fs(6)}px 0 0`,
                position: "absolute", top: fs(24), left: "50%", transform: "translateX(-50%)",
              }} />
              {/* Orange inner top */}
              <div style={{
                width: fs(20), height: fs(12),
                background: "#D97706",
                borderRadius: `0 0 ${fs(3)}px ${fs(3)}px`,
                position: "absolute", top: fs(25), left: "50%", transform: "translateX(-50%)",
              }} />
              {/* Pointing hand */}
              <div style={{
                width: fs(12), height: fs(6),
                background: "#d4a070",
                borderRadius: fs(3),
                position: "absolute", top: fs(18), right: "5%",
                transform: "rotate(-30deg)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
          {/* Warm accent glow */}
          <div style={{
            position: "absolute", top: "10%", left: "30%",
            width: "50%", height: "30%",
            background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)",
          }} />
          {/* Dark gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.88) 80%, rgba(0,0,0,0.95) 100%)",
          }} />

          {/* Label + Text (overlaid on image) */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: `0 ${fs(6)}px ${fs(10)}px`,
          }}>
            <div style={{
              background: "#F59E0B", padding: `${fs(3)}px ${fs(10)}px`,
              borderRadius: fs(3), marginBottom: fs(7),
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: fs(8.5), fontWeight: 800, color: "#fff" }}>
                {labelRight}
              </span>
            </div>
            <RenderBoldText text={slide.direita} fontSize={fs(8)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SLIDE: CTA ──
function CtaSlide({ cta, scale = 1 }) {
  const w = 270 * scale;
  const h = 337 * scale;
  const fs = (v) => v * scale;
  return (
    <div style={{
      width: w, height: h, borderRadius: 8 * scale, position: "relative", overflow: "hidden", flexShrink: 0,
      background: "#0c0c0c",
    }}>
      {/* BG glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 45%, rgba(245,158,11,0.12) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "relative", zIndex: 1, height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: fs(20), textAlign: "center",
      }}>
        {/* Question mark icon */}
        <div style={{
          width: fs(48), height: fs(48), borderRadius: "50%",
          border: `2px solid #F59E0B`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: fs(18),
        }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: fs(26), color: "#F59E0B" }}>?</span>
        </div>

        <h2 style={{
          fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
          fontSize: fs(19),
          fontWeight: 400,
          color: "#fff",
          lineHeight: 1.1,
          margin: 0,
          letterSpacing: fs(0.5),
        }}>
          {cta?.pergunta}
        </h2>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: fs(9.5),
          color: "#999",
          marginTop: fs(14),
          lineHeight: 1.5,
        }}>
          {cta?.subtexto}
        </p>

        {/* CTA Button */}
        <div style={{
          marginTop: fs(18),
          background: "#F59E0B",
          padding: `${fs(7)}px ${fs(22)}px`,
          borderRadius: fs(24),
          boxShadow: "0 4px 15px rgba(245,158,11,0.25)",
        }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: fs(10), fontWeight: 800, color: "#000", letterSpacing: 0.5 }}>
            COMENTE ABAIXO
          </span>
        </div>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: fs(7.5),
          color: "#444",
          marginTop: fs(14),
          letterSpacing: 0.3,
        }}>
          {cta?.hashtags}
        </p>
      </div>
    </div>
  );
}

// ── INFO COMPONENTS ──
function SectionCard({ title, children, accent }) {
  return (
    <div style={{
      background: "#121212", border: "1px solid #1e1e1e", borderRadius: 10,
      padding: 20, marginBottom: 16,
      borderLeft: accent ? `3px solid ${accent}` : undefined,
    }}>
      {title && (
        <h3 style={{
          fontFamily: "'Bebas Neue', 'Oswald', sans-serif", fontSize: 17, fontWeight: 400,
          color: "#fff", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 2,
        }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 9, fontSize: 13, lineHeight: 1.55 }}>
      <span style={{ color: "#555", minWidth: 155, flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <span style={{ color: "#ccc" }}>{value}</span>
    </div>
  );
}

function PipelineStep({ num, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
      <span style={{
        background: "#F59E0B", color: "#000", fontWeight: 800, borderRadius: 6,
        padding: "3px 10px", fontSize: 13, flexShrink: 0, fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: 1,
      }}>{num}</span>
      <span style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>
        <strong style={{ color: "#fff" }}>{title}</strong> — {desc}
      </span>
    </div>
  );
}

// ── MAIN APP ──
export default function CarouselTemplateBuilder() {
  const [activeTab, setActiveTab] = useState("preview");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: "preview", label: "Preview Visual" },
    { id: "analise", label: "Análise do Layout" },
    { id: "prompt", label: "Prompt de Automação" },
    { id: "specs", label: "Specs Técnicas" },
  ];

  const totalSlides = SAMPLE_DATA.slides.length + 2;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#090909", color: "#e0e0e0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&family=Oswald:wght@400;700&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 2 }}>
          <div style={{
            width: 38, height: 38, background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#000",
          }}>C</div>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#fff", letterSpacing: 2.5 }}>
              CARROSSEL TEMPLATE BUILDER
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#444" }}>Análise completa + Protótipo + Prompt de automação</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 0, marginTop: 14, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? "#121212" : "transparent",
              border: "none", borderBottom: activeTab === t.id ? "2px solid #F59E0B" : "2px solid transparent",
              color: activeTab === t.id ? "#F59E0B" : "#555",
              padding: "10px 16px", fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: 20 }}>

        {/* ═══ PREVIEW ═══ */}
        {activeTab === "preview" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Array.from({ length: totalSlides }).map((_, i) => {
                const label = i === 0 ? "Capa" : i === totalSlides - 1 ? "CTA" : `${i}`;
                return (
                  <button key={i} onClick={() => setCurrentSlide(i)} style={{
                    padding: "6px 12px", borderRadius: 6,
                    border: currentSlide === i ? "2px solid #F59E0B" : "1px solid #1e1e1e",
                    background: currentSlide === i ? "rgba(245,158,11,0.08)" : "#0f0f0f",
                    color: currentSlide === i ? "#F59E0B" : "#555",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              {currentSlide === 0 && <CoverSlide title={SAMPLE_DATA.titulo_capa} subtitle={SAMPLE_DATA.subtitulo_capa} scale={1.4} />}
              {currentSlide > 0 && currentSlide < totalSlides - 1 && (
                <ContentSlide slide={SAMPLE_DATA.slides[currentSlide - 1]} labelLeft={SAMPLE_DATA.label_esquerda} labelRight={SAMPLE_DATA.label_direita} scale={1.4} />
              )}
              {currentSlide === totalSlides - 1 && <CtaSlide cta={SAMPLE_DATA.cta} scale={1.4} />}
            </div>

            <p style={{ textAlign: "center", fontSize: 11, color: "#333", marginBottom: 20 }}>
              {currentSlide === 0 ? "Capa" : currentSlide === totalSlides - 1 ? "CTA Final" : `Slide ${currentSlide}`} de {totalSlides}
              &nbsp;•&nbsp;Escala reduzida (real: 1080×1350px)
            </p>

            <SectionCard title="Carrossel Completo">
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10 }}>
                <CoverSlide title={SAMPLE_DATA.titulo_capa} subtitle={SAMPLE_DATA.subtitulo_capa} />
                {SAMPLE_DATA.slides.map((s, i) => (
                  <ContentSlide key={i} slide={s} labelLeft={SAMPLE_DATA.label_esquerda} labelRight={SAMPLE_DATA.label_direita} />
                ))}
                <CtaSlide cta={SAMPLE_DATA.cta} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══ ANÁLISE ═══ */}
        {activeTab === "analise" && (
          <div>
            <SectionCard title="Estrutura Geral" accent="#F59E0B">
              <InfoRow label="Total de Slides" value="Capa + 8-12 conteúdo + CTA final" />
              <InfoRow label="Formato" value="1080 × 1350px (4:5 Instagram)" />
              <InfoRow label="Tipo" value="Comparativo lado a lado (Split Layout)" />
              <InfoRow label="Narrativa" value="Progressão de intensidade" />
            </SectionCard>

            <SectionCard title="Layout — Como funciona cada camada" accent="#F59E0B">
              <div style={{
                background: "#0a0a0a", borderRadius: 8, padding: 16, border: "1px solid #1a1a1a",
                fontSize: 12, color: "#999", lineHeight: 1.9,
              }}>
                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 4px", fontSize: 11 }}>CAMADA 1 — Imagem Full-Bleed</p>
                <p style={{ margin: "0 0 14px" }}>Cada lado tem uma imagem AI que cobre TODO o espaço — de cima a baixo, sem margens. A imagem É o fundo.</p>

                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 4px", fontSize: 11 }}>CAMADA 2 — Gradiente Overlay</p>
                <p style={{ margin: "0 0 14px" }}>Gradiente de transparente (topo) para preto ~90% (base). Permite ver a imagem no topo e ler o texto embaixo.</p>

                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 4px", fontSize: 11 }}>CAMADA 3 — Título (Topo Centralizado)</p>
                <p style={{ margin: "0 0 14px" }}>Barra com fundo #111 no topo do card inteiro. Número + situação em caixa alta. Centralizado nos dois lados.</p>

                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 4px", fontSize: 11 }}>CAMADA 4 — Labels + Texto (Sobreposto)</p>
                <p style={{ margin: 0 }}>Label (pill) + texto descritivo na parte inferior de cada lado, sobreposto à imagem escurecida. Text-shadow para contraste.</p>
              </div>
            </SectionCard>

            <SectionCard title="Identidade Visual" accent="#F59E0B">
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { color: "#111111", label: "BG Título", border: "#333" },
                  { color: "#F59E0B", label: "Destaque" },
                  { color: "#FFFFFF", label: "Texto" },
                  { color: "#5a3a1e", label: "BG Img Negativo" },
                  { color: "#35363d", label: "BG Img Positivo" },
                ].map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 18, height: 18, background: c.color, borderRadius: 4, border: `1px solid ${c.border || "#333"}` }} />
                    <span style={{ fontSize: 11, color: "#666" }}>{c.label}</span>
                  </div>
                ))}
              </div>
              <InfoRow label="Font Títulos" value="Bebas Neue / Oswald, caixa alta" />
              <InfoRow label="Font Corpo" value="DM Sans, centralizado, text-shadow" />
              <InfoRow label="Label Esquerda" value="Pill branca, texto preto, bold" />
              <InfoRow label="Label Direita" value="Pill laranja (#F59E0B), texto branco, bold" />
            </SectionCard>

            <SectionCard title="Slide CTA Final (Novo)" accent="#F59E0B">
              <InfoRow label="Objetivo" value="Engajamento — comentários, compartilhamentos, salvamentos" />
              <InfoRow label="Layout" value="Fundo escuro, glow laranja sutil, pergunta grande, botão CTA" />
              <InfoRow label="Pergunta" value="Provocativa, pessoal, em caixa alta" />
              <InfoRow label="CTA" value="Marcar alguém, salvar, compartilhar" />
              <InfoRow label="Hashtags" value="3-5 hashtags relevantes ao nicho" />
            </SectionCard>
          </div>
        )}

        {/* ═══ PROMPT ═══ */}
        {activeTab === "prompt" && (
          <div>
            <SectionCard title="Prompt Principal — Geração de Conteúdo + CTA" accent="#F59E0B">
              <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6, margin: "0 0 12px" }}>
                Gera todo o conteúdo do carrossel (texto + prompts de imagem + CTA). Basta trocar os placeholders pelo tema desejado.
              </p>
              <div style={{ position: "relative" }}>
                <pre style={{
                  background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8,
                  padding: 16, fontSize: 10.5, lineHeight: 1.55, color: "#888",
                  overflow: "auto", maxHeight: 420, whiteSpace: "pre-wrap",
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                }}>
                  {PROMPT_TEMPLATE}
                </pre>
                <button onClick={() => handleCopy(PROMPT_TEMPLATE)} style={{
                  position: "absolute", top: 8, right: 8,
                  background: copied ? "#166534" : "#1a1a1a", border: "1px solid #333",
                  borderRadius: 6, padding: "6px 14px", color: "#fff", fontSize: 11,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                }}>
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Prompt de Imagem" accent="#F59E0B">
              <div style={{
                background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8,
                padding: 16, fontSize: 12, lineHeight: 1.7, color: "#888",
              }}>
                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 6px", fontSize: 11 }}>LADO ESQUERDO (Negativo):</p>
                <p style={{ margin: "0 0 14px", fontStyle: "italic" }}>
                  Professional digital illustration, semi-realistic. [Man/Woman] in orange shirt, stressed at desk, head in hands. Dark moody office. Warm brown/orange tones. Cinematic lighting. Full body from waist up. --ar 1:1
                </p>
                <p style={{ color: "#F59E0B", fontWeight: 700, margin: "0 0 6px", fontSize: 11 }}>LADO DIREITO (Positivo):</p>
                <p style={{ margin: 0, fontStyle: "italic" }}>
                  Professional digital illustration, semi-realistic. Confident [Man/Woman] in dark blazer over orange top, speaking to team. Strong posture, warm smile. Dark office, accent lighting. Full body from waist up. --ar 1:1
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Pipeline de Automação" accent="#F59E0B">
              <PipelineStep num="1" title="Input" desc="Defina nicho, tema, público e tom." />
              <PipelineStep num="2" title="Texto + CTA" desc="LLM gera JSON com conteúdo dos slides + CTA final + prompts de imagem." />
              <PipelineStep num="3" title="Imagens" desc="Gere 2 imagens por slide (neg/pos) via Flux, DALL-E ou Midjourney." />
              <PipelineStep num="4" title="Composição" desc="Python (Pillow) ou Node (Canvas) monta cada slide: imagem full-bleed + overlay + título + labels + texto." />
              <PipelineStep num="5" title="Publicação" desc="Exporte JPGs → publique via Meta API, Buffer ou Publer." />
            </SectionCard>
          </div>
        )}

        {/* ═══ SPECS ═══ */}
        {activeTab === "specs" && (
          <div>
            <SectionCard title="Especificações de Produção" accent="#F59E0B">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {[
                  { label: "Canvas", value: "1080 × 1350px" },
                  { label: "Formato", value: "JPG 95% / PNG" },
                  { label: "Cor Destaque", value: "#F59E0B" },
                  { label: "Font Títulos", value: "Bebas Neue ~64-80px" },
                  { label: "Font Corpo", value: "DM Sans ~36-42px" },
                  { label: "Font Labels", value: "DM Sans 800 ~32px" },
                  { label: "Split", value: "50/50, divider 1px" },
                  { label: "Imagem/lado", value: "540×full height, full-bleed" },
                  { label: "Overlay", value: "gradient → 90% opacity" },
                  { label: "Título BG", value: "#111, height ~120px" },
                  { label: "Label Esq", value: "#FFF bg, #111 text" },
                  { label: "Label Dir", value: "#F59E0B bg, #FFF text" },
                  { label: "Text Shadow", value: "0 2px 8px rgba(0,0,0,0.9)" },
                  { label: "CTA Slide", value: "Pergunta + botão + hashtags" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#0d0d0d", borderRadius: 6, padding: 12, border: "1px solid #1a1a1a" }}>
                    <p style={{ color: "#444", fontSize: 10, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</p>
                    <p style={{ color: "#ddd", fontSize: 13, margin: 0, fontWeight: 600 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="JSON Completo (Template + Content)" accent="#F59E0B">
              <pre style={{
                background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8,
                padding: 16, fontSize: 11, lineHeight: 1.5, color: "#888",
                overflow: "auto", maxHeight: 400,
                fontFamily: "'Fira Code', 'Courier New', monospace",
              }}>
{`{
  "template_config": {
    "canvas": { "width": 1080, "height": 1350 },
    "cover": {
      "bg": "blurred_full_bleed_image",
      "overlay": "rgba(0,0,0,0.55)",
      "title": { "font": "Bebas Neue", "size": 120 },
      "subtitle": { "font": "DM Sans Italic", "size": 40 }
    },
    "content_slide": {
      "title_bar": { "bg": "#111", "font": "Bebas Neue", "size": 64 },
      "each_side": {
        "image": "FULL-BLEED (cobre toda a área)",
        "overlay": "gradient transparent → rgba(0,0,0,0.9)",
        "label": { "type": "pill", "font": "DM Sans 800", "size": 32 },
        "text": { "font": "DM Sans", "size": 38, "shadow": true }
      }
    },
    "cta_slide": {
      "bg": "#0C0C0C",
      "glow": "radial amber 12%",
      "question": { "font": "Bebas Neue", "size": 80 },
      "cta_button": { "bg": "#F59E0B", "font": "DM Sans 800" },
      "hashtags": { "font": "DM Sans", "size": 28, "color": "#444" }
    }
  },
  "content": {
    "titulo_capa": "...",
    "subtitulo_capa": "...",
    "slides": [ { "numero": 1, "titulo": "...", "esquerda": "...", "direita": "..." } ],
    "cta": { "pergunta": "...", "subtexto": "...", "hashtags": "..." }
  }
}`}
              </pre>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
