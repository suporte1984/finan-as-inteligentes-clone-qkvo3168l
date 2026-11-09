import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, BarChart3, TrendingUp } from 'lucide-react'

import { brl, monthBounds, monthTitle } from '@/lib/format'
import type { Category, Transaction } from '@/types/finance'
import { cn } from '@/lib/utils'

const fallbackColors = ['#4338CA', '#047857', '#D97706', '#BE123C', '#6D28D9', '#0E7490', '#C2410C']

const tooltipStyle = {
  backgroundColor: 'var(--fin-bg-card)',
  borderColor: 'var(--fin-border-color)',
  color: 'var(--fin-text-primary)',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  fontWeight: 600,
} as const

const axisTick = { fill: 'var(--fin-text-secondary)', fontSize: 11, fontWeight: 500 } as const

type MonthlyPoint = {
  month: string
  label: string
  receitas: number
  despesas: number
}

type TopCategory = {
  id: string
  name: string
  color: string
  value: number
}

/**
 * Resolve a categoria raiz de um lançamento, subindo a cadeia de "parent"
 * (mesma lógica usada em Reports.tsx e no card "Por categoria").
 */
function resolveRootCategory(
  categoryId: string,
  categories: Category[],
): { id: string; name: string; color: string } | null {
  let current = categories.find((category) => category.id === categoryId)
  if (!current) return null
  const visited = new Set<string>()
  while (current?.parent) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    const parent = categories.find((category) => category.id === current!.parent)
    if (!parent) break
    current = parent
  }
  return current ? { id: current.id, name: current.name, color: current.color } : null
}

export function DashboardCharts({
  transactions,
  categories,
  month,
}: {
  transactions: Transaction[]
  categories: Category[]
  month: string
}) {
  const navigate = useNavigate()

  // Últimos 6 meses terminando no mês selecionado (mesma janela de Reports.tsx)
  const monthly = useMemo<MonthlyPoint[]>(() => {
    const [year, monthNumber] = month.split('-').map(Number)
    const months = Array.from({ length: 6 }, (_, index) => {
      return new Date(Date.UTC(year, monthNumber - 1 - (5 - index), 1)).toISOString().slice(0, 7)
    })
    return months.map((key) => {
      const { start, next } = monthBounds(key)
      const records = transactions.filter(
        (transaction) => transaction.date >= start && transaction.date < next,
      )
      return {
        month: key,
        label: monthTitle(key).split(' ')[0].slice(0, 3),
        receitas: records
          .filter((transaction) => transaction.type === 'receita')
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        despesas: records
          .filter((transaction) => transaction.type === 'despesa')
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      }
    })
  }, [transactions, month])

  const topCategories = useMemo<TopCategory[]>(() => {
    const { start, next } = monthBounds(month)
    const totals = new Map<string, { name: string; color: string; value: number }>()
    transactions
      .filter(
        (transaction) =>
          transaction.type === 'despesa' &&
          transaction.date >= start &&
          transaction.date < next &&
          transaction.amount > 0,
      )
      .forEach((transaction) => {
        const root = resolveRootCategory(transaction.category, categories)
        const id = root?.id ?? 'sem_categoria'
        const current = totals.get(id) ?? {
          name: root?.name ?? 'Sem categoria',
          color: root?.color || fallbackColors[totals.size % fallbackColors.length],
          value: 0,
        }
        current.value += transaction.amount
        totals.set(id, current)
      })
    return Array.from(totals.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [transactions, categories, month])

  const hasMonthlyData = monthly.some((point) => point.receitas > 0 || point.despesas > 0)

  function openCategoryTransactions(categoryId: string) {
    if (categoryId === 'sem_categoria') {
      navigate(`/lancamentos?month=${month}`)
    } else {
      navigate(`/lancamentos?parent=${categoryId}&month=${month}`)
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <article className="fin-card animate-fade-up stagger-1 p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-fin-primary dark:bg-indigo-500/15">
                <TrendingUp className="h-4 w-4" />
              </span>
              <h2 className="section-title">Evolução mensal</h2>
            </div>
            <p className="mt-1 text-xs text-fin-muted">Receitas x despesas nos últimos 6 meses</p>
          </div>
          <div className="hidden gap-4 text-xs text-fin-muted sm:flex">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-fin-primary" />
              Receitas
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-fin-danger" />
              Despesas
            </span>
          </div>
        </div>
        {hasMonthlyData ? (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashIncomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4338CA" stopOpacity={0.28} />
                    <stop offset="1" stopColor="#4338CA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashExpenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#BE123C" stopOpacity={0.24} />
                    <stop offset="1" stopColor="#BE123C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--fin-chart-grid)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: 'var(--fin-border-color)' }}
                  tickLine={false}
                  tick={axisTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tick={{ fill: 'var(--fin-text-secondary)', fontSize: 10, fontWeight: 500 }}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    brl.format(Number(value)),
                    name === 'receitas' ? 'Receitas' : 'Despesas',
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="receitas"
                  stroke="#4338CA"
                  strokeWidth={3}
                  fill="url(#dashIncomeFill)"
                  animationDuration={800}
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  stroke="#BE123C"
                  strokeWidth={3}
                  fill="url(#dashExpenseFill)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid h-[260px] place-items-center text-sm text-fin-muted">
            Sem lançamentos nos últimos 6 meses.
          </div>
        )}
      </article>

      <article className="fin-card animate-fade-up stagger-2 p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-fin-primary dark:bg-indigo-500/15">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h2 className="section-title">Top categorias</h2>
            </div>
            <p className="mt-1 text-xs text-fin-muted">
              Maiores despesas em {monthTitle(month).toLowerCase()}
            </p>
          </div>
          <button
            onClick={() => navigate(`/lancamentos?month=${month}`)}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-fin-primary hover:underline"
          >
            Ver lançamentos <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {topCategories.length ? (
          <>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCategories}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--fin-chart-grid)" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--fin-text-secondary)', fontSize: 11, fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(value) => [brl.format(Number(value)), 'Total']}
                    cursor={{ fill: 'var(--fin-chart-grid)' }}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                    animationDuration={800}
                    onClick={(data: unknown) => {
                      const payload = data as { id?: string }
                      if (payload?.id) openCategoryTransactions(payload.id)
                    }}
                  >
                    {topCategories.map((item, index) => (
                      <Cell
                        key={item.id}
                        fill={item.color || fallbackColors[index % fallbackColors.length]}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5">
              {topCategories.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openCategoryTransactions(item.id)}
                  className="flex w-full items-center gap-2 text-xs transition hover:translate-x-0.5"
                >
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: item.color || fallbackColors[0] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-left font-medium text-fin-text">
                    {item.name}
                  </span>
                  <strong className="shrink-0 font-semibold text-fin-text">
                    {brl.format(item.value)}
                  </strong>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid h-[240px] place-items-center text-sm text-fin-muted">
            Nenhuma despesa registrada neste mês.
          </div>
        )}
      </article>
    </section>
  )
}

export default DashboardCharts
