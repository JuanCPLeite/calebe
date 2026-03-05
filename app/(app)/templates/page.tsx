'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TEMPLATES, type CarouselTemplate } from '@/lib/templates'
import { BookOpen, ShoppingBag, BookHeart, BarChart2, List, ArrowRight, X, Eye } from 'lucide-react'

const TYPE_ICONS = {
  educativo:  BookOpen,
  vendas:     ShoppingBag,
  história:   BookHeart,
  comparação: BarChart2,
  lista:      List,
}

const TYPE_COLORS: Record<string, string> = {
  educativo:  'text-violet-400 bg-violet-500/10 border-violet-500/30',
  vendas:     'text-green-400 bg-green-500/10 border-green-500/30',
  história:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
  comparação: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  lista:      'text-pink-400 bg-pink-500/10 border-pink-500/30',
}

// Exemplos de slides por template — tema fictício, não vinculado a nenhum usuário real
const TEMPLATE_EXAMPLES: Record<string, { topic: string; slides: { label: string; text: string }[] }> = {
  'frank-costa-10': {
    topic: 'Por que você não consegue guardar dinheiro (e como mudar isso)',
    slides: [
      { label: 'Hook',       text: 'Por que você não consegue guardar dinheiro mesmo quando ganha bem?' },
      { label: 'Conteúdo 1', text: 'O problema não é a falta de renda. É a falta de um sistema.' },
      { label: 'Conteúdo 2', text: 'A maioria das pessoas tenta poupar o que sobra no final do mês — esse é o erro.' },
      { label: 'Conteúdo 3', text: 'O método certo: pague a si mesmo primeiro. Separe a reserva antes de gastar.' },
      { label: 'Conteúdo 4', text: 'Automatize a transferência para a reserva no dia do pagamento. Sem depender de força de vontade.' },
      { label: 'Conteúdo 5', text: 'Divida seus gastos em 3 categorias: essencial, qualidade de vida e futuro.' },
      { label: 'Conteúdo 6', text: 'Revise seus gastos fixos uma vez por mês. Um corte de R$ 100/mês vira R$ 15.000 em 10 anos.' },
      { label: 'Conteúdo 7', text: 'Pequenos hábitos compõem grandes resultados. Comece com R$ 50/mês se precisar.' },
      { label: 'Autor',      text: 'Oi, eu sou a [Nome do Expert] — especialista em finanças comportamentais. Já ajudei mais de 3.000 pessoas a organizar o dinheiro sem abrir mão da qualidade de vida.' },
      { label: 'CTA Final',  text: '👆 Me segue para mais conteúdo assim\n🔔 Ativa o sininho\n❤️ Compartilha com quem precisa ver isso\n\nAcesse o link na bio e conheça o [Nome do Produto].' },
    ],
  },
}

function ExampleModal({ template, onClose }: { template: CarouselTemplate; onClose: () => void }) {
  const router = useRouter()
  const example = TEMPLATE_EXAMPLES[template.id]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{template.name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Exemplo de estrutura · {template.slideCount} slides</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-1">
          {example ? (
            <>
              <p className="text-[11px] text-zinc-500 mb-4">
                Tema de exemplo: <span className="text-zinc-300 italic">"{example.topic}"</span>
              </p>
              {example.slides.map((slide, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                    <span className="text-[10px] text-zinc-400 font-medium">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-violet-400 font-medium uppercase tracking-wide">
                      {slide.label}
                    </span>
                    <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed whitespace-pre-line">
                      {slide.text}
                    </p>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-8">Exemplo em breve.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={onClose}>
            Fechar
          </Button>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
            onClick={() => router.push(`/generate?template=${template.id}`)}
          >
            Usar template <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const [preview, setPreview] = useState<CarouselTemplate | null>(null)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Templates</h1>
        <p className="text-sm text-zinc-500 mt-1">Estruturas de carrossel pré-configuradas para cada objetivo</p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-3xl">
        {TEMPLATES.map((tpl) => {
          const Icon = TYPE_ICONS[tpl.type] || BookOpen

          return (
            <div
              key={tpl.id}
              className={`rounded-2xl border p-5 flex gap-5 transition-all ${
                tpl.available
                  ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  : 'border-zinc-800/60 bg-zinc-900/40 opacity-60'
              }`}
            >
              {/* Ícone do tipo */}
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[tpl.type]}`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-zinc-100">{tpl.name}</h2>
                  {tpl.available ? (
                    <Badge className="text-[10px] bg-green-600/20 text-green-400 border border-green-600/30 h-4 px-1.5">
                      Disponível
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-zinc-700/50 text-zinc-500 border border-zinc-700 h-4 px-1.5">
                      Em breve
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{tpl.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-zinc-600">{tpl.slideCount} slides</span>
                  {tpl.tags.map(tag => (
                    <span key={tag} className="text-[10px] text-zinc-600 border border-zinc-800 rounded-full px-1.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 self-center flex-shrink-0">
                {tpl.available ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
                      onClick={() => router.push(`/generate?template=${tpl.id}`)}
                    >
                      Usar <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:text-zinc-200 gap-1.5"
                      onClick={() => setPreview(tpl)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Exemplo
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled className="border-zinc-700 text-zinc-600">
                    Em breve
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {preview && <ExampleModal template={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
