export interface CarouselTemplate {
  id: string
  name: string
  description: string
  slideCount: number
  type: 'educativo' | 'vendas' | 'história' | 'comparação' | 'lista'
  tags: string[]
  available: boolean
}

export interface TemplatePreset {
  textLength: 'short' | 'medium' | 'long'
  useFixedSlides: boolean
}

export const TEMPLATES: CarouselTemplate[] = [
  {
    id: 'frank-costa-10',
    name: 'Brand Equity',
    description: 'Hook poderoso → 8 slides de conteúdo educativo → CTA com slide do autor. Constrói autoridade e reconhecimento de marca a cada carrossel.',
    slideCount: 10,
    type: 'educativo',
    tags: ['educativo', 'autoridade', '10 slides'],
    available: true,
  },
  {
    id: 'storytelling-5',
    name: 'Storytelling em 5 Atos',
    description: 'Conta uma história pessoal ou de cliente: situação → conflito → virada → resultado → moral.',
    slideCount: 5,
    type: 'história',
    tags: ['história', 'engajamento', '5 slides'],
    available: false,
  },
  {
    id: 'comparacao-antes-depois',
    name: 'Antes e Depois',
    description: 'Compara o estado anterior com o posterior de forma visual e impactante. Perfeito para resultados e transformações.',
    slideCount: 6,
    type: 'comparação',
    tags: ['comparação', 'resultado', '6 slides'],
    available: false,
  },
  {
    id: 'lista-rapida',
    name: 'Lista Rápida',
    description: '7 dicas, erros, ferramentas ou segredos. Formato escaneável que gera salvamentos e compartilhamentos.',
    slideCount: 9,
    type: 'lista',
    tags: ['lista', 'tips', '9 slides'],
    available: false,
  },
]

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  'frank-costa-10': {
    textLength: 'medium',
    useFixedSlides: true,
  },
}
