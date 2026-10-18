import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  /**
   * 'default' (max-w-[1360px]) para dashboards, relatórios, tabelas densas;
   * 'narrow' (max-w-[1020px]) para formulários longos e telas focadas (ex: Configurações);
   * 'compact' (max-w-[760px]) para fluxos passo a passo ou utilitários;
   * 'full' para layouts sem restrição de largura.
   */
  size?: 'default' | 'narrow' | 'compact' | 'full'
}

export function PageContainer({ children, className, size = 'default' }: PageContainerProps) {
  const sizeClasses = {
    default: 'max-w-[1360px]',
    narrow: 'max-w-[1020px]',
    compact: 'max-w-[760px]',
    full: 'max-w-none',
  }

  return <div className={cn('mx-auto w-full', sizeClasses[size], className)}>{children}</div>
}
