import { Activity, ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react'
import { brl } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface StatKpiCardProps {
  title: string
  value: number
  variation?: number
  subtitle?: string
  positiveGood?: boolean
  type?: 'income' | 'expense' | 'result' | 'neutral'
  className?: string
}

export function StatKpiCard({
  title,
  value,
  variation,
  subtitle = 'vs. média dos 3 meses',
  positiveGood = true,
  type = 'neutral',
  className,
}: StatKpiCardProps) {
  const isPositiveResult = type === 'result' ? value >= 0 : true
  const effectiveType = type === 'result' ? (isPositiveResult ? 'income' : 'expense') : type

  const visualPositive =
    variation !== undefined ? (variation >= 0 ? positiveGood : !positiveGood) : true

  const styles = {
    income: {
      cardClass:
        'border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 via-white to-white shadow-xs dark:bg-gradient-to-br dark:from-emerald-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:border-emerald-500/25',
      titleClass: 'text-emerald-900/80 dark:text-emerald-200/90',
      valueClass: 'text-emerald-900 dark:text-emerald-300',
      iconBoxClass:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border dark:border-emerald-500/25',
      icon: type === 'result' ? Scale : ArrowUpRight,
    },
    expense: {
      cardClass:
        'border-rose-200/80 bg-gradient-to-b from-rose-50/70 via-white to-white shadow-xs dark:bg-gradient-to-br dark:from-rose-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:border-rose-500/25',
      titleClass: 'text-rose-900/80 dark:text-rose-200/90',
      valueClass: 'text-rose-900 dark:text-rose-300',
      iconBoxClass:
        'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 dark:border dark:border-rose-500/25',
      icon: type === 'result' ? Scale : ArrowDownRight,
    },
    neutral: {
      cardClass:
        'border-indigo-200/80 bg-gradient-to-b from-indigo-50/60 via-white to-white shadow-xs dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:border-indigo-500/25',
      titleClass: 'text-indigo-950/80 dark:text-indigo-200/90',
      valueClass: 'text-indigo-950 dark:text-indigo-100',
      iconBoxClass:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border dark:border-indigo-500/25',
      icon: Activity,
    },
  }[effectiveType]

  const Icon = styles.icon

  return (
    <article
      className={cn(
        'fin-card relative overflow-hidden p-4 sm:p-5 transition-shadow hover:shadow-md',
        styles.cardClass,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold uppercase tracking-wider', styles.titleClass)}>
          {title}
        </span>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-2xs',
            styles.iconBoxClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p
        className={cn(
          'mt-3 text-2xl font-extrabold tracking-tight sm:text-[26px]',
          styles.valueClass,
        )}
      >
        {type === 'result' && value > 0 ? '+' : ''}
        {brl.format(value)}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-fin-muted dark:text-slate-400">
        <span>{subtitle}</span>
        {typeof variation === 'number' && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border shadow-2xs',
              visualPositive
                ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                : 'bg-rose-100/80 text-rose-900 border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
            )}
          >
            {variation >= 0 ? (
              <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="h-3 w-3 stroke-[2.5]" />
            )}
            {variation >= 0 ? '+' : ''}
            {variation.toFixed(1)}%
          </span>
        )}
      </div>
    </article>
  )
}
