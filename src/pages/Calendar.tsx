import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
} from 'lucide-react'

import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { brl, monthBounds, monthTitle, todayInput } from '@/lib/format'
import { listBills } from '@/services/bills'
import type { Bill } from '@/types/finance'
import { cn } from '@/lib/utils'

// Semana começando no domingo (padrão do calendário brasileiro)
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATUS_META = {
  pago: { label: 'Pago', badge: 'fin-badge-success' },
  em_aberto: { label: 'Em aberto', badge: 'fin-badge-primary' },
  atrasado: { label: 'Atrasado', badge: 'fin-badge-danger' },
} as const

interface DayCell {
  key: string
  dayNumber: number | null
  ymd: string | null
}

/** Quebra uma data "YYYY-MM-DD..." em chave de dia (YYYY-MM-DD). */
function toYmd(value: string) {
  return (value || '').slice(0, 10)
}

/** Monta a grade 7 colunas (dom-sáb) do mês exibido, com células vazias iniciais. */
function buildMonthGrid(month: string): DayCell[][] {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  const cells: DayCell[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `empty-${i}`, dayNumber: null, ymd: null })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${month}-${String(day).padStart(2, '0')}`
    cells.push({ key: ymd, dayNumber: day, ymd })
  }
  // completar a última semana com células vazias
  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, dayNumber: null, ymd: null })
  }
  const weeks: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function CalendarPage() {
  const { toast } = useToast()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => todayInput().slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setBills(await listBills())
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível carregar as contas' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  useRealtime<Bill>('bills', () => {
    void reload()
  })

  /** Contas por dia do mês exibido. */
  const billsByDay = useMemo(() => {
    const map = new Map<string, Bill[]>()
    for (const bill of bills) {
      const ymd = toYmd(bill.due_date)
      if (!ymd.startsWith(`${month}-`)) continue
      const list = map.get(ymd) || []
      list.push(bill)
      map.set(ymd, list)
    }
    return map
  }, [bills, month])

  const monthBills = useMemo(() => Array.from(billsByDay.values()).flat(), [billsByDay])

  const summary = useMemo(() => {
    let totalPagar = 0
    let totalReceber = 0
    let emAtraso = 0
    for (const bill of monthBills) {
      if (bill.direction === 'pagar') totalPagar += bill.amount
      else totalReceber += bill.amount
      if (bill.status === 'atrasado') emAtraso += 1
    }
    return { totalPagar, totalReceber, emAtraso }
  }, [monthBills])

  const grid = useMemo(() => buildMonthGrid(month), [month])
  const todayYmd = todayInput()

  const selectedBills = selectedDay ? billsByDay.get(selectedDay) || [] : []

  return (
    <div className="space-y-6 page-container">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <h1 className="page-title">Calendário de vencimentos</h1>
          <p className="page-subtitle">
            Visualize as contas a pagar e a receber de cada dia do mês.
          </p>
        </div>
        <div className="flex items-center gap-2.5 sm:ml-auto">
          <button
            type="button"
            className="btn-secondary !min-h-[38px] px-3"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[170px] text-center">
            <span className="section-title">{monthTitle(month)}</span>
          </div>
          <button
            type="button"
            className="btn-secondary !min-h-[38px] px-3"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-outline !min-h-[38px] px-3 text-xs"
            onClick={() => {
              setMonth(todayInput().slice(0, 7))
              setSelectedDay(null)
            }}
          >
            Hoje
          </button>
        </div>
      </header>

      {/* Resumo do mês */}
      <section className="grid gap-3 sm:grid-cols-3 animate-fade-up stagger-1">
        <div className="fin-card p-4">
          <p className="text-xs font-medium text-fin-muted">Total a pagar</p>
          <p className="mt-1 text-xl font-extrabold text-fin-text">
            {brl.format(summary.totalPagar)}
          </p>
          <span className="fin-badge fin-badge-danger mt-2">A pagar</span>
        </div>
        <div className="fin-card p-4">
          <p className="text-xs font-medium text-fin-muted">Total a receber</p>
          <p className="mt-1 text-xl font-extrabold text-fin-text">
            {brl.format(summary.totalReceber)}
          </p>
          <span className="fin-badge fin-badge-success mt-2">A receber</span>
        </div>
        <div className="fin-card p-4">
          <p className="text-xs font-medium text-fin-muted">Em atraso</p>
          <p className="mt-1 text-xl font-extrabold text-fin-text">{summary.emAtraso}</p>
          <span className="fin-badge fin-badge-danger mt-2">
            {summary.emAtraso === 1 ? 'conta atrasada' : 'contas atrasadas'}
          </span>
        </div>
      </section>

      {loading ? (
        <div className="fin-card grid min-h-96 place-items-center p-8 animate-fade-up stagger-2">
          <div className="flex flex-col items-center gap-3 text-fin-muted">
            <Loader2 className="h-6 w-6 animate-spin text-fin-primary" />
            <p className="text-sm">Carregando vencimentos...</p>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 animate-fade-up stagger-2 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Grade do calendário */}
          <div className="fin-card p-4 sm:p-5">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-fin-muted"
                >
                  {day}
                </div>
              ))}
              {grid.flat().map((cell) => {
                if (!cell.dayNumber || !cell.ymd) {
                  return <div key={cell.key} aria-hidden className="rounded-lg" />
                }
                const dayBills = billsByDay.get(cell.ymd) || []
                const isSelected = selectedDay === cell.ymd
                const isToday = cell.ymd === todayYmd
                const pagar = dayBills.filter((b) => b.direction === 'pagar').length
                const receber = dayBills.length - pagar
                const atrasados = dayBills.filter((b) => b.status === 'atrasado').length

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : cell.ymd)}
                    className={cn(
                      'flex min-h-[72px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition sm:min-h-[86px] sm:p-2',
                      isSelected
                        ? 'border-fin-primary bg-fin-primary/10'
                        : 'border-fin-border-subtle hover:bg-fin-surface',
                      isToday && !isSelected && 'ring-1 ring-fin-primary',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-full text-xs font-bold',
                        isToday ? 'bg-fin-primary text-white' : 'text-fin-text',
                      )}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayBills.length > 0 && (
                      <span className="flex w-full flex-wrap items-center gap-1">
                        {pagar > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
                            <ArrowUpRight className="h-2.5 w-2.5" />
                            {pagar}
                          </span>
                        )}
                        {receber > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <ArrowDownLeft className="h-2.5 w-2.5" />
                            {receber}
                          </span>
                        )}
                        {atrasados > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {atrasados}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Painel do dia selecionado */}
          <aside className="fin-card flex max-h-[560px] flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-fin-border-subtle pb-3">
              <h2 className="section-title flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-fin-primary" />
                {selectedDay
                  ? `${new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`
                  : 'Selecione um dia'}
              </h2>
              {selectedBills.length > 0 && (
                <span className="fin-badge fin-badge-primary">
                  {selectedBills.length} {selectedBills.length === 1 ? 'conta' : 'contas'}
                </span>
              )}
            </div>
            <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto">
              {!selectedDay && (
                <div className="grid place-items-center py-10 text-center">
                  <div>
                    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-fin-muted">
                      Clique em um dia com vencimentos para ver os detalhes.
                    </p>
                  </div>
                </div>
              )}
              {selectedDay && selectedBills.length === 0 && (
                <div className="grid place-items-center py-10 text-center">
                  <div>
                    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
                      <Inbox className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-fin-muted">
                      Nenhuma conta com vencimento neste dia.
                    </p>
                  </div>
                </div>
              )}
              {selectedBills.map((bill) => (
                <BillDayItem key={bill.id} bill={bill} />
              ))}
            </div>
          </aside>
        </section>
      )}
    </div>
  )
}

function BillDayItem({ bill }: { bill: Bill }) {
  const meta = STATUS_META[bill.status] || STATUS_META.em_aberto
  return (
    <article className="rounded-xl border border-fin-border-subtle bg-fin-bg-card-soft p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-fin-text">{bill.description}</h3>
        <span className={`fin-badge ${meta.badge}`}>{meta.label}</span>
      </div>
      <p
        className={cn(
          'mt-1 text-lg font-extrabold',
          bill.direction === 'receber' ? 'text-fin-success' : 'text-fin-text',
        )}
      >
        {bill.direction === 'receber' ? '+' : ''}
        {brl.format(bill.amount)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fin-muted">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold',
            bill.direction === 'receber'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
          )}
        >
          {bill.direction === 'receber' ? (
            <ArrowDownLeft className="h-3 w-3" />
          ) : (
            <ArrowUpRight className="h-3 w-3" />
          )}
          {bill.direction === 'receber' ? 'A receber' : 'A pagar'}
        </span>
        <span className="flex items-center gap-1">
          {bill.expand?.category?.name || 'Sem categoria'}
        </span>
        {bill.expand?.account?.name && <span>{bill.expand.account.name}</span>}
      </div>
    </article>
  )
}
