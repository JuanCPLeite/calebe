'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TopicCard, type Topic } from '@/components/generate/topic-card'
import { CarouselPreview, type Slide } from '@/components/generate/carousel-preview'
import { Sparkles, Mic, TrendingUp, Search, Globe, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock trending topics — será substituído pela API EXA
const MOCK_TOPICS: Topic[] = [
  {
    id: '1',
    title: 'IA que responde WhatsApp por você',
    viralScore: 82,
    growth: '+520%',
    postsToday: 201,
    avgEngagement: '4.2%',
    hook: 'Seu WhatsApp pode responder clientes enquanto você dorme — e custa menos de R$ 50/mês.',
    gain: 'Empresários vão saber exatamente como montar um atendimento automático sem contratar ninguém.',
    angle: 'Custo oculto',
    altAngles: [
      { label: 'Medo de perder', hook: 'Seu concorrente já automatizou o WhatsApp. Você ainda não sabe.' },
      { label: 'Revelação técnica', hook: '5 passos para o WhatsApp responder por você — sem programar nada.' },
    ],
  },
  {
    id: '2',
    title: 'n8n vs Make: qual usar em 2026',
    viralScore: 71,
    growth: '+180%',
    postsToday: 89,
    avgEngagement: '3.8%',
    hook: 'Errei gastando R$ 1.200 no Make antes de descobrir o n8n. Vou te poupar esse erro.',
    gain: 'Profissionais vão escolher a ferramenta certa para o seu nível e economizar tempo e dinheiro.',
    angle: 'Erro pessoal',
    altAngles: [
      { label: 'Comparação direta', hook: 'n8n e Make fazem a mesma coisa. A diferença está em quem paga a conta.' },
    ],
  },
  {
    id: '3',
    title: 'ChatGPT Canvas está eliminando designers',
    viralScore: 68,
    growth: '+340%',
    postsToday: 127,
    avgEngagement: '5.1%',
    hook: 'Rasguei um contrato de R$ 3.000/mês com designer depois de testar o Canvas por 1 semana.',
    gain: 'Donos de negócio vão saber como produzir material visual profissional sem agência ou freelancer.',
    angle: 'Choque de custo',
    altAngles: [
      { label: 'Tutorial prático', hook: '3 tipos de material que o ChatGPT Canvas faz em 10 minutos.' },
    ],
  },
  {
    id: '4',
    title: 'Agente IA para e-commerce que vende no automático',
    viralScore: 61,
    growth: '+95%',
    postsToday: 74,
    avgEngagement: '3.5%',
    hook: 'Minha loja vende sem eu estar online. O agente de IA cuida de tudo — da pergunta ao pagamento.',
    gain: 'Lojistas vão entender como configurar um agente que opera 24/7 sem intervenção humana.',
    angle: 'Resultado real',
  },
  {
    id: '5',
    title: 'Automação que se paga em menos de 30 dias',
    viralScore: 54,
    growth: '+72%',
    postsToday: 58,
    avgEngagement: '3.2%',
    hook: 'Em 11 dias o sistema pagou o próprio custo. Hoje é puro lucro operacional.',
    gain: 'Empreendedores vão calcular o ROI real de automações e saber por onde começar.',
    angle: 'ROI rápido',
  },
]

type Mode = 'topics' | 'search' | 'explore'
type Stage = 'discovery' | 'generating' | 'editing'

export default function GeneratePage() {
  const [mode, setMode] = useState<Mode>('topics')
  const [searchQuery, setSearchQuery] = useState('')
  const [stage, setStage] = useState<Stage>('discovery')
  const [generating, setGenerating] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [slides, setSlides] = useState<Slide[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [voiceActive, setVoiceActive] = useState(false)
  const [customTopic, setCustomTopic] = useState('')

  async function handleGenerate(topic: Topic, hook: string) {
    setSelectedTopic(topic.title)
    setGenerating(true)
    setStage('generating')

    try {
      const res = await fetch('/api/generate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.title, hook }),
      })
      const data = await res.json()
      setSlides(data.slides.map((s: Slide) => ({ ...s, approved: false })))
      setStage('editing')
    } catch (err) {
      console.error(err)
      setStage('discovery')
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateFromCustom() {
    if (!customTopic.trim()) return
    const mockTopic: Topic = {
      id: 'custom',
      title: customTopic,
      viralScore: 0,
      growth: '—',
      postsToday: 0,
      avgEngagement: '—',
      hook: customTopic,
      gain: '',
      angle: 'Personalizado',
    }
    await handleGenerate(mockTopic, customTopic)
  }

  function handleVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Seu navegador não suporta reconhecimento de voz.'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.onstart = () => setVoiceActive(true)
    recognition.onend = () => setVoiceActive(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setCustomTopic(transcript)
      setMode('search')
    }
    recognition.start()
  }

  async function handleGenerateImages() {
    setGeneratingImages(true)
    await new Promise(r => setTimeout(r, 3000)) // placeholder — vai chamar /api/generate/images
    setGeneratingImages(false)
  }

  // ── Tela de edição ─────────────────────────────────────────────────────────
  if (stage === 'editing') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
          <Button variant="ghost" size="sm" className="text-zinc-400" onClick={() => setStage('discovery')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
          <h1 className="text-sm font-medium text-zinc-300 flex-1 truncate">{selectedTopic}</h1>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white">
            Publicar no Instagram
          </Button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <CarouselPreview
            slides={slides}
            onSlidesChange={setSlides}
            onGenerateImages={handleGenerateImages}
            generatingImages={generatingImages}
          />
        </div>
      </div>
    )
  }

  // ── Tela de geração em andamento ───────────────────────────────────────────
  if (stage === 'generating') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">Gerando carrossel com Claude...</p>
            <p className="text-xs text-zinc-500 mt-1">Criando 10 slides no seu estilo</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Discovery ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Gerar Carrossel</h1>
        <p className="text-sm text-zinc-500 mt-1">Escolha um tema viral ou escreva o seu próprio</p>
      </div>

      {/* Input livre + voz */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerateFromCustom()}
            placeholder="Digite ou fale um tema..."
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 pr-10"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className={cn('border-zinc-700', voiceActive ? 'bg-red-500/20 border-red-500 text-red-400' : 'text-zinc-400 hover:bg-zinc-800')}
          onClick={handleVoice}
        >
          <Mic className="w-4 h-4" />
        </Button>
        <Button
          className="bg-violet-600 hover:bg-violet-500 text-white"
          onClick={handleGenerateFromCustom}
          disabled={!customTopic.trim() || generating}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Gerar
        </Button>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl w-fit border border-zinc-800">
        {([
          { id: 'topics', label: '🔥 Trending no meu nicho', icon: TrendingUp },
          { id: 'search', label: '🔍 Busca livre', icon: Search },
          { id: 'explore', label: '🌐 Explorar', icon: Globe },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              mode === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Topic list */}
      {mode === 'topics' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Atualizado agora · Nicho: Automações com IA</p>
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">5 temas</Badge>
          </div>
          {MOCK_TOPICS.map((topic, i) => (
            <TopicCard key={topic.id} topic={topic} rank={i + 1} onSelect={handleGenerate} />
          ))}
        </div>
      )}

      {mode === 'search' && (
        <div className="space-y-4">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar tendências sobre qualquer assunto..."
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
          />
          <p className="text-sm text-zinc-500 text-center py-8">
            Digite um assunto para buscar o que está viral agora
          </p>
        </div>
      )}

      {mode === 'explore' && (
        <div className="grid grid-cols-4 gap-3">
          {['💰 Finanças', '🤖 IA & Tech', '💪 Saúde', '📱 Marketing',
            '🏠 Negócios', '🎓 Educação', '✈️ Lifestyle', '🔧 Produtividade'].map(cat => (
            <button key={cat}
              className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-sm text-zinc-400 hover:text-zinc-100 transition-colors text-left">
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
