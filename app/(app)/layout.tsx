import { Sidebar } from '@/components/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DM_Sans } from 'next/font/google'

export const dynamic = 'force-dynamic'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {/* --font-dm-sans disponível para os cards Frank */}
      <div className={`flex h-screen overflow-hidden ${dmSans.variable}`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </TooltipProvider>
  )
}
