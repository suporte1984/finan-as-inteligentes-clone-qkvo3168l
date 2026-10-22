import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Download,
  Lightbulb,
  Loader2,
  RefreshCw,
  Repeat2,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
} from 'lucide-react'

import { useFinance } from '@/contexts/FinanceContext'
import { useToast } from '@/hooks/use-toast'
import { brl, currentMonth, monthBounds, monthTitle, percentageChange } from '@/lib/format'
import { generateMonthlyReport, getSavedReport } from '@/services/reports'
import { exportTransactionsToCsv } from '@/lib/exportCsv'
import { listTransactions } from '@/services/transactions'
import type { AiReport, Transaction } from '@/types/finance'
import { cn } from '@/lib/utils'
import { StatKpiCard } from '@/components/finance/StatKpiCard'

type ReportTab = 'geral' | 'comparativos'
const colors = ['#4338CA', '#047857', '#D97706', '#BE123C', '#6D28D9', '#0E7490', '#C2410C']

export default function ReportsPage() {
  const { accounts, categories } = useFinance()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const selectedMonth = params.get('month') || currentMonth()
  const tab = (params.get('tab') as ReportTab) || 'geral'
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [report, setReport] = useState<AiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([listTransactions(), getSavedReport(selectedMonth)])
      .then(([records, saved]) => {
        setTransactions(records)
        setReport(saved)
      })
      .finally(() => setLoading(false))
  }, [selectedMonth])

  const months = useMemo(() => {
    const [year, monthNumber] = selectedMonth.split('-').map(Number)
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(year, monthNumber - 1 - (5 - index), 1))
      return date.toISOString().slice(0, 7)
    })
  }, [selectedMonth])

  const monthly = useMemo(
    () =>
      months.map((month) => {
        const { start, next } = monthBounds(month)
        const records = transactions.filter(
          (transaction) => transaction.date >= start && transaction.date < next,
        )
        return {
          month,
          label: monthTitle(month).split(' ')[0].slice(0, 3),
          receitas: records
            .filter((transaction) => transaction.type === 'receita')
            .reduce((sum, transaction) => sum + transaction.amount, 0),
          despesas: records
            .filter((transaction) => transaction.type === 'despesa')
            .reduce((sum, transaction) => sum + transaction.amount, 0),
        }
      }),
    [months, transactions],
  )
  const selected = monthly[monthly.length - 1] || { receitas: 0, despesas: 0 }
  const previous = monthly[monthly.length - 2] || { receitas: 0, despesas: 0 }
  const result = selected.receitas - selected.despesas

  // Média dos 3 meses anteriores no frontend para manter consistência nos cards e comparativos
  const prior3MonthsData = useMemo(() => {
    // monthly tem 6 meses, o último é o selecionado. Os 3 imediatamente anteriores são os índices length-4, length-3, length-2
    const prevSlice = monthly.slice(Math.max(0, monthly.length - 4), monthly.length - 1)
    const count = prevSlice.length || 1
    const totalReceitas = prevSlice.reduce((sum, item) => sum + item.receitas, 0)
    const totalDespesas = prevSlice.reduce((sum, item) => sum + item.despesas, 0)
    const avgReceitas = totalReceitas / count
    const avgDespesas = totalDespesas / count
    const avgResultado = avgReceitas - avgDespesas
    return {
      count,
      receitas: avgReceitas,
      despesas: avgDespesas,
      resultado: avgResultado,
      months: prevSlice.map((m) => m.month),
    }
  }, [monthly])

  const resultVariationVsAvg = percentageChange(result, prior3MonthsData.resultado)
  const expenseVariationVsAvg = percentageChange(selected.despesas, prior3MonthsData.despesas)
  const incomeVariationVsAvg = percentageChange(selected.receitas, prior3MonthsData.receitas)

  const byCategory = useMemo(() => {
    const { start, next } = monthBounds(selectedMonth)
    const expenses = transactions.filter(
      (transaction) =>
        transaction.type === 'despesa' && transaction.date >= start && transaction.date < next,
    )

    // Agrupamento na categoria raiz
    const totals = new Map<
      string,
      {
        id: string
        name: string
        color: string
        value: number
        subcategories: Map<string, { name: string; value: number }>
      }
    >()

    expenses.forEach((transaction) => {
      const rawCategory =
        categories.find((c) => c.id === transaction.category) || transaction.expand?.category
      let root = rawCategory
      const visited = new Set<string>()
      while (root?.parent) {
        if (visited.has(root.id)) break
        visited.add(root.id)
        const parentCat = categories.find((c) => c.id === root!.parent)
        if (parentCat) {
          root = parentCat
        } else {
          break
        }
      }

      const rootId = root?.id || 'sem_categoria'
      const rootName = root?.name || 'Sem categoria'
      const rootColor = root?.color || colors[totals.size % colors.length]

      const current = totals.get(rootId) || {
        id: rootId,
        name: rootName,
        color: rootColor,
        value: 0,
        subcategories: new Map<string, { name: string; value: number }>(),
      }

      current.value += transaction.amount

      if (rawCategory && rawCategory.id !== rootId) {
        const subCurrent = current.subcategories.get(rawCategory.id) || {
          name: rawCategory.name,
          value: 0,
        }
        subCurrent.value += transaction.amount
        current.subcategories.set(rawCategory.id, subCurrent)
      }

      totals.set(rootId, current)
    })

    return Array.from(totals.values())
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        subcategoriesList: Array.from(item.subcategories.values()).sort(
          (a, b) => b.value - a.value,
        ),
      }))
  }, [transactions, categories, selectedMonth])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  async function generate(regenerate = false) {
    setGenerating(true)
    try {
      const nextReport = await generateMonthlyReport(selectedMonth, regenerate)
      if (nextReport?.skipped) {
        toast({
          title: 'Nenhum lançamento no mês',
          description:
            nextReport.message || 'Adicione transações neste mês para gerar a análise com IA.',
        })
        return
      }
      setReport(nextReport)
      toast({
        title: regenerate ? 'Resumo atualizado' : 'Resumo do mês pronto',
        description: 'A análise foi salva para você consultar depois.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível gerar o resumo',
        description: 'Tente novamente em alguns instantes.',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6 page-container print:p-0">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] text-fin-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fechamento inteligente
          </p>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Compare períodos e descubra onde economizar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print sm:ml-auto">
          <label className="relative">
            <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
            <input
              type="month"
              className="field pl-10"
              value={selectedMonth}
              onChange={(event) => updateParam('month', event.target.value)}
            />
          </label>
          <button
            className="btn-secondary"
            onClick={() => {
              const { start, next } = monthBounds(selectedMonth)
              const periodTransactions = transactions.filter(
                (t) => t.date >= start && t.date < next,
              )
              if (periodTransactions.length === 0) {
                toast({
                  title: 'Nenhum lançamento no período',
                  description: 'Não há transações para exportar neste mês.',
                })
                return
              }
              exportTransactionsToCsv(
                periodTransactions,
                categories,
                accounts,
                `relatorio_lancamentos_${selectedMonth}.csv`,
              )
              toast({
                title: 'CSV exportado com sucesso',
                description: `${periodTransactions.length} lançamentos salvos no arquivo CSV.`,
              })
            }}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </header>

      <div className="flex border-b border-fin-border animate-fade-up stagger-1 no-print">
        <button
          onClick={() => updateParam('tab', '')}
          className={cn(
            'relative px-4 py-3 text-sm font-semibold text-fin-muted',
            tab === 'geral' &&
              'text-fin-primary after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary',
          )}
        >
          Visão geral
        </button>
        <button
          onClick={() => updateParam('tab', 'comparativos')}
          className={cn(
            'relative px-4 py-3 text-sm font-semibold text-fin-muted',
            tab === 'comparativos' &&
              'text-fin-primary after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary',
          )}
        >
          Comparativos
        </button>
      </div>

      <div className="hidden print:block">
        <p className="text-sm text-fin-muted">Fechamento mensal</p>
        <h2 className="mt-1 text-3xl font-bold">{monthTitle(selectedMonth)}</h2>
      </div>

      {loading ? (
        <ReportSkeleton />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-fade-up stagger-1">
            <StatKpiCard
              className="print-card"
              title="Receitas do mês"
              value={selected.receitas}
              variation={incomeVariationVsAvg}
              subtitle="vs. média dos 3 meses"
              positiveGood
              type="income"
            />
            <StatKpiCard
              className="print-card"
              title="Despesas do mês"
              value={selected.despesas}
              variation={expenseVariationVsAvg}
              subtitle="vs. média dos 3 meses"
              positiveGood={false}
              type="expense"
            />
            <StatKpiCard
              className="print-card"
              title="Resultado"
              value={result}
              variation={resultVariationVsAvg}
              subtitle="vs. média dos 3 meses"
              positiveGood
              type="result"
            />
            <StatKpiCard
              className="print-card"
              title="Variação vs. média (3m)"
              value={Math.abs(result - prior3MonthsData.resultado)}
              variation={resultVariationVsAvg}
              subtitle="vs. média dos 3 meses"
              positiveGood
              type="neutral"
            />
          </section>

          <section
            className={cn(
              'grid gap-5',
              tab === 'geral' ? 'xl:grid-cols-[1.55fr_1fr]' : 'grid-cols-1',
            )}
          >
            <article className="fin-card print-card animate-fade-up stagger-2 p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="section-title">Receitas x despesas</h2>
                  <p className="mt-1 text-xs text-fin-muted">Evolução nos últimos 6 meses</p>
                </div>
                <div className="flex gap-4 text-xs text-fin-muted">
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
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly}>
                    <defs>
                      <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#4338CA" stopOpacity={0.25} />
                        <stop offset="1" stopColor="#4338CA" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#BE123C" stopOpacity={0.22} />
                        <stop offset="1" stopColor="#BE123C" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={true} stroke="#e2e5ec" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      axisLine={{ stroke: '#cbcfda' }}
                      tickLine={false}
                      tick={{ fill: '#404352', fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#626678', fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        brl.format(Number(value)),
                        name === 'receitas' ? 'Receitas' : 'Despesas',
                      ]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#c4c8d4',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontWeight: 600,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      stroke="#4338CA"
                      strokeWidth={3}
                      fill="url(#incomeFill)"
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      stroke="#BE123C"
                      strokeWidth={3}
                      fill="url(#expenseFill)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {tab === 'geral' && (
              <article className="fin-card print-card animate-fade-up stagger-3 p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="section-title">Despesas por categoria</h2>
                  <p className="mt-1 text-xs text-fin-muted">
                    Maiores gastos em {monthTitle(selectedMonth).toLowerCase()}
                  </p>
                </div>
                {byCategory.length ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byCategory}
                        layout="vertical"
                        margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={80}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#71717A', fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(value, _name, item) => {
                            const payload = item?.payload as
                              | { subcategoriesList?: Array<{ name: string; value: number }> }
                              | undefined
                            const subDetails = payload?.subcategoriesList?.length
                              ? ' (' +
                                payload.subcategoriesList
                                  .slice(0, 3)
                                  .map((s) => `${s.name}: ${brl.format(s.value)}`)
                                  .join(', ') +
                                (payload.subcategoriesList.length > 3 ? '...' : '') +
                                ')'
                              : ''
                            return [`${brl.format(Number(value))}${subDetails}`, 'Total']
                          }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[0, 5, 5, 0]}
                          maxBarSize={20}
                          animationDuration={800}
                        >
                          {byCategory.map((item, index) => (
                            <Cell
                              key={item.id}
                              fill={item.color || colors[index % colors.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="grid h-[300px] place-items-center text-sm text-fin-muted">
                    Sem despesas no mês selecionado.
                  </div>
                )}
              </article>
            )}
          </section>

          {tab === 'comparativos' && (
            <section className="grid gap-5 lg:grid-cols-2 animate-fade-up stagger-3">
              <ComparisonCard
                title="Receitas"
                current={selected.receitas}
                average={prior3MonthsData.receitas}
                previousSingle={previous.receitas}
              />
              <ComparisonCard
                title="Despesas"
                current={selected.despesas}
                average={prior3MonthsData.despesas}
                previousSingle={previous.despesas}
              />
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <article className="fin-card print-card animate-fade-up stagger-3 overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-fin-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
                    <BrainCircuit className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="section-title">Fechamento do mês</h2>
                      {report && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            report.source === 'auto'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-indigo-50 text-fin-primary',
                          )}
                        >
                          {report.source === 'auto' ? (
                            <>
                              <Bot className="h-3 w-3" />
                              Fechamento automático
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              Gerado manualmente
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-fin-muted">
                      Comparação com a média dos 3 meses anteriores e detecção inteligente de
                      padrões
                    </p>
                  </div>
                </div>
                <button
                  disabled={generating}
                  onClick={() => void generate(Boolean(report))}
                  className={report ? 'btn-secondary no-print' : 'btn-primary no-print'}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : report ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {report ? 'Regenerar' : 'Gerar resumo'}
                </button>
              </div>
              <div className="p-5 sm:p-6">
                {generating ? (
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-[93%]" />
                    <div className="skeleton h-4 w-[87%]" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                ) : report ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-fin-muted">{report.summary}</p>

                    {/* Metas analisadas pela IA */}
                    {report?.insights?.budgets && report.insights.budgets.length > 0 && (
                      <div className="rounded-xl border border-fin-border bg-fin-surface/60 p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fin-muted">
                          <Target className="h-3.5 w-3.5 text-fin-primary" />
                          Status das metas de gasto no mês
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {report.insights.budgets.map((b) => (
                            <div
                              key={b.category}
                              className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-xs border border-fin-border/50"
                            >
                              <div>
                                <span className="font-semibold">{b.category}</span>
                                <div className="text-[10px] text-fin-muted">
                                  {brl.format(b.spent)} de {brl.format(b.limit)}
                                </div>
                              </div>
                              <div>
                                {b.status === 'estourada' ? (
                                  <span className="fin-badge fin-badge-danger">
                                    <AlertCircle className="h-3 w-3" />
                                    Estourada ({b.percent}%)
                                  </span>
                                ) : b.status === 'alerta_80' ? (
                                  <span className="fin-badge fin-badge-warning">
                                    <AlertTriangle className="h-3 w-3" />
                                    Atenção ({b.percent}%)
                                  </span>
                                ) : (
                                  <span className="fin-badge fin-badge-success">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {b.percent}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {report?.insights?.comparison?.topIncreases &&
                      report.insights.comparison.topIncreases.length > 0 && (
                        <div className="rounded-xl border border-fin-border bg-fin-surface/60 p-4">
                          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fin-muted">
                            <TrendingUp className="h-3.5 w-3.5 text-fin-danger" />
                            Categorias com maior aumento vs. média de 3 meses
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {report.insights.comparison.topIncreases.slice(0, 4).map((item) => (
                              <div
                                key={item.category}
                                className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-xs border border-fin-border/50"
                              >
                                <div>
                                  <span className="font-semibold">{item.category}</span>
                                  <div className="text-[10px] text-fin-muted">
                                    Média: {brl.format(item.average)} → Atual:{' '}
                                    {brl.format(item.current)}
                                  </div>
                                </div>
                                <span className="font-bold text-fin-danger">
                                  +{brl.format(item.diff)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-fin-primary">
                      <Sparkles className="h-6 w-6" />
                    </span>
                    <h3 className="text-base font-semibold text-fin-text">
                      Nenhum fechamento com IA gerado para este mês
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-fin-muted">
                      Clique em <strong>“Gerar resumo”</strong> para a IA comparar seus números com
                      a <strong>média dos últimos 3 meses</strong>, apontar metas em risco e indicar
                      onde economizar.
                    </p>
                    <button
                      disabled={generating}
                      onClick={() => void generate(false)}
                      className="btn-primary mt-4 inline-flex items-center gap-2 !py-2 !text-xs"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Gerar primeiro resumo com IA
                    </button>
                  </div>
                )}
              </div>
            </article>

            <article className="fin-card print-card animate-fade-up stagger-4 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-fin-warning">
                  <Repeat2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="section-title">Despesas recorrentes</h2>
                  <p className="text-xs text-fin-muted">
                    Identificadas por similaridade de descrição e valor
                  </p>
                </div>
              </div>
              {report?.insights?.recurring?.length ? (
                <div className="space-y-2">
                  {report.insights.recurring.map((item, index) => (
                    <div
                      key={`${item.description}-${index}`}
                      className="rounded-xl border border-fin-border bg-fin-surface p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.description}</p>
                          {item.category && (
                            <span className="text-[11px] text-fin-muted">{item.category}</span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <strong className="text-sm text-fin-danger">
                            {brl.format(item.amount)}
                          </strong>
                          <p className="text-[10px] text-fin-muted">valor médio</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-fin-border/50 pt-2 text-[11px] text-fin-muted">
                        <span>
                          {item.occurrences
                            ? `${item.occurrences} lançamentos em ${item.months.length} meses`
                            : `Repetida em ${item.months.length} meses`}
                        </span>
                        <span className="truncate pl-2">
                          {item.months.map((m) => monthTitle(m).split(' ')[0]).join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-fin-surface p-4 text-sm leading-6 text-fin-muted">
                  {report
                    ? 'Nenhuma despesa recorrente detectada com base no período recente.'
                    : 'Gere o resumo para detectar cobranças recorrentes e assinaturas.'}
                </div>
              )}
            </article>
          </section>

          <article className="fin-card print-card animate-fade-up stagger-4 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-fin-success">
                <Lightbulb className="h-5 w-5" />
              </span>
              <div>
                <h2 className="section-title">Onde economizar</h2>
                <p className="text-xs text-fin-muted">Sugestões práticas para o próximo mês</p>
              </div>
            </div>
            {report?.insights?.suggestions?.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {report.insights.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-xl border border-fin-border bg-fin-surface p-4"
                  >
                    <span className="absolute right-3 top-2 text-3xl font-bold text-fin-primary/10">
                      0{index + 1}
                    </span>
                    <p className="relative pr-4 text-sm leading-6 text-fin-muted">{suggestion}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-fin-surface p-4 text-sm text-fin-muted">
                <AlertTriangle className="h-5 w-5 shrink-0 text-fin-warning" />
                As recomendações personalizadas aparecerão aqui após a geração do resumo.
              </div>
            )}
          </article>
        </>
      )}
    </div>
  )
}

function ComparisonCard({
  title,
  current,
  average,
  previousSingle,
}: {
  title: string
  current: number
  average: number
  previousSingle?: number
}) {
  const max = Math.max(current, average, previousSingle || 0, 1)
  return (
    <article className="fin-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Comparativo de {title.toLowerCase()}</h2>
        <span className="text-xs text-fin-muted">Mês vs. Média de 3 meses</span>
      </div>
      <div className="mt-6 space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-fin-muted">{title} do mês atual</span>
            <strong className="font-semibold">{brl.format(current)}</strong>
          </div>
          <div className="h-3 rounded-full bg-slate-200/90 overflow-hidden border border-slate-300/50">
            <div
              className="h-3 rounded-full bg-fin-primary transition-all duration-700 shadow-2xs"
              style={{ width: `${(current / max) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-fin-muted">Média dos 3 meses anteriores</span>
            <strong>{brl.format(average)}</strong>
          </div>
          <div className="h-3 rounded-full bg-slate-200/90 overflow-hidden border border-slate-300/50">
            <div
              className="h-3 rounded-full bg-[#059669] transition-all duration-700 shadow-2xs"
              style={{ width: `${(average / max) * 100}%` }}
            />
          </div>
        </div>
        {typeof previousSingle === 'number' && (
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-fin-muted">Último mês anterior individual</span>
              <span>{brl.format(previousSingle)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200/90 overflow-hidden border border-slate-300/50">
              <div
                className="h-2.5 rounded-full bg-[#818CF8] transition-all duration-700 shadow-2xs"
                style={{ width: `${(previousSingle / max) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="fin-card-soft p-5 space-y-3">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-8 w-36 rounded" />
            <div className="skeleton h-3 w-32 rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="fin-card p-6 space-y-4">
          <div className="skeleton h-6 w-48 rounded" />
          <div className="skeleton h-56 w-full rounded-xl" />
        </div>
        <div className="fin-card p-6 space-y-4">
          <div className="skeleton h-6 w-48 rounded" />
          <div className="skeleton h-56 w-full rounded-xl" />
        </div>
      </div>
      <div className="fin-card p-6 space-y-3">
        <div className="skeleton h-6 w-60 rounded" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}
