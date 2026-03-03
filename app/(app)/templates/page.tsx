'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TEMPLATES } from '@/lib/templates'
import { BookOpen, ShoppingBag, BookHeart, BarChart2, List, ArrowRight } from 'lucide-react'

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

export default function TemplatesPage() {
  const router = useRouter()

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

              {/* Ação */}
              {tpl.available ? (
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5 self-center flex-shrink-0"
                  onClick={() => router.push(`/generate?template=${tpl.id}`)}
                >
                  Usar <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="border-zinc-700 text-zinc-600 self-center flex-shrink-0"
                >
                  Em breve
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
