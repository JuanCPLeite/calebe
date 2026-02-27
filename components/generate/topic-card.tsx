'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, Zap, Users, Lightbulb, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface Topic {
  id: string
  title: string
  viralScore: number
  growth: string
  postsToday: number
  avgEngagement: string
  hook: string
  gain: string
  angle: string
  altAngles?: { label: string; hook: string }[]
}

interface TopicCardProps {
  topic: Topic
  rank: number
  onSelect: (topic: Topic, hook: string) => void
}

export function TopicCard({ topic, rank, onSelect }: TopicCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState(0)

  const allAngles = [
    { label: topic.angle, hook: topic.hook },
    ...(topic.altAngles || []),
  ]
  const currentHook = allAngles[selectedAngle]?.hook ?? topic.hook

  const scoreColor =
    topic.viralScore >= 80 ? 'text-orange-400' :
    topic.viralScore >= 60 ? 'text-yellow-400' :
    'text-zinc-400'

  const scoreBg =
    topic.viralScore >= 80 ? 'bg-orange-400' :
    topic.viralScore >= 60 ? 'bg-yellow-400' :
    'bg-zinc-400'

  return (
    <div className={cn(
      'rounded-xl border bg-zinc-900 transition-all',
      expanded ? 'border-violet-500/60' : 'border-zinc-800 hover:border-zinc-700'
    )}>
      {/* Header compacto */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Rank */}
        <span className="text-xs font-bold text-zinc-500 w-4">#{rank}</span>

        {/* Score */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
            <span className={cn('text-xs font-bold', scoreColor)}>{topic.viralScore}</span>
          </div>
        </div>

        {/* Title + stats */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{topic.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-green-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {topic.growth}
            </span>
            <span className="text-xs text-zinc-500">{topic.postsToday} posts hoje</span>
            <span className="text-xs text-zinc-500">avg {topic.avgEngagement}</span>
          </div>
        </div>

        {/* Hook preview */}
        <p className="hidden md:block text-xs text-zinc-400 max-w-48 truncate italic">
          "{topic.hook.slice(0, 55)}..."
        </p>

        <ChevronDown className={cn('w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-4">
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-20">Viralidade</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full">
              <div
                className={cn('h-1.5 rounded-full', scoreBg)}
                style={{ width: `${topic.viralScore}%` }}
              />
            </div>
            <span className={cn('text-xs font-bold', scoreColor)}>{topic.viralScore}/100</span>
          </div>

          {/* Hook */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Zap className="w-3 h-3" /> Hook sugerido
            </div>
            <p className="text-sm text-zinc-100 italic bg-zinc-800/60 rounded-lg px-3 py-2">
              "{currentHook}"
            </p>
          </div>

          {/* Gain */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Target className="w-3 h-3" /> Ganho do carrossel para sua audiência
            </div>
            <p className="text-sm text-zinc-300 bg-zinc-800/60 rounded-lg px-3 py-2">
              {topic.gain}
            </p>
          </div>

          {/* Ângulos alternativos */}
          {allAngles.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Lightbulb className="w-3 h-3" /> Ângulos possíveis
              </div>
              <div className="flex flex-wrap gap-2">
                {allAngles.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedAngle(i)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      selectedAngle === i
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {selectedAngle > 0 && (
                <p className="text-xs text-zinc-400 italic">"{allAngles[selectedAngle]?.hook}"</p>
              )}
            </div>
          )}

          {/* CTA */}
          <Button
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
            onClick={() => onSelect(topic, currentHook)}
          >
            <Zap className="w-4 h-4 mr-2" />
            Gerar carrossel com este tema
          </Button>
        </div>
      )}
    </div>
  )
}
