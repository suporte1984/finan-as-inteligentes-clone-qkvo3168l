import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
  ReceiptText,
  Repeat,
  Target,
  WalletCards,
} from 'lucide-react'

import { AccountModal } from '@/components/finance/AccountModal'
import { BillModal } from '@/components/finance/BillModal'
import { SettleBillModal } from '@/components/finance/SettleBillModal'
import { openGlobalTransaction } from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useFinance } from '@/contexts/FinanceContext'
import { useCountUp } from '@/hooks/use-count-up'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { brl, currentMonth, daysUntil, formatDate, monthBounds } from '@/lib/format'
import { listBills } from '@/services/bills'
import { listBudgets } from '@/services/budgets'
import { listRecurringTransactions } from '@/services/recurring'
import { listTransactions } from '@/services/transactions'
import type {
  Account,
  AiReport,
  Bill,
  BillDirection,
  Budget,
  Category,
  RecurringTransaction,
  Transaction,
} from '@/types/finance'
import { getSavedReport } from '@/services/reports'
import { DashboardAiCard } from '@/components/finance/DashboardAiCard'

const chartColors = ['#4338CA', '#047857', '#D97706', '#BE123C', '#6D28D9', '#0E7490', '#C2410C']

export default function Index() {
  const { user } = useAuth()
  const { accounts, categories } = useFinance()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [aiReport, setAiReport] = useState<AiReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(true)
  const [loading, setLoading] = useState(true)
  const [accountModal, setAccountModal] = useState(false)
  const [accountModalDefaultType, setAccountModalDefaultType] = useState<Account['type']>('banco')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [billModal, setBillModal] = useState(false)
  const [billDirection, setBillDirection] = useState<BillDirection>('pagar')
  const [settling, setSettling] = useState<Bill | null>(null)
  const [showAllAccounts, setShowAllAccounts] = useState(false)

  const month = currentMonth()

  const reload = useCallback(async () => {
    try {
      const [nextTransactions, nextBills, nextBudgets, nextRecurrings, report] = await Promise.all([
        listTransactions(),
        listBills(),
        listBudgets(),
        listRecurringTransactions().catch(() => []),
        getSavedReport(month).catch(() => null),
      ])
      setTransactions(nextTransactions)
      setBills(nextBills)
      setBudgets(nextBudgets)
      setRecurrings(nextRecurrings)
      setAiReport(report)
    } finally {
      setLoading(false)
      setLoadingReport(false)
    }
  }, [month])

  useEffect(() => {
    void reload()
  }, [reload])
  useRealtime<Transaction>('transactions', () => {
    void reload()
  })
  useRealtime<Bill>('bills', () => {
    void reload()
  })
  useRealtime<Budget>('budgets', () => {
    void reload()
  })
  useRealtime<RecurringTransaction>('recurring_transactions', () => {
    void reload()
  })
  useRealtime<AiReport>('ai_reports', () => {
    void reload()
  })

  const { start, next } = monthBounds(month)
  const monthTransactions = useMemo(
    () =>
      transactions.filter((transaction) => transaction.date >= start && transaction.date < next),
    [transactions, start, next],
  )
  const income = monthTransactions
    .filter((transaction) => transaction.type === 'receita')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const expense = monthTransactions
    .filter((transaction) => transaction.type === 'despesa')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const accountBalances = useMemo(
    () =>
      accounts.map((account) => {
        const movement = transactions
          .filter((transaction) => transaction.account === account.id)
          .reduce(
            (sum, transaction) =>
              sum + (transaction.type === 'receita' ? transaction.amount : -transaction.amount),
            0,
          )
        return { ...account, balance: account.initial_balance + movement }
      }),
    [accounts, transactions],
  )
  const totalBalance = accountBalances.reduce((sum, account) => sum + account.balance, 0)
  const animatedBalance = useCountUp(totalBalance)

  const balanceSeries = useMemo(() => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const initialTotal = accounts.reduce((sum, account) => sum + account.initial_balance, 0)
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (29 - index))
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      const balance =
        initialTotal +
        transactions
          .filter((transaction) => new Date(transaction.date.replace(' ', 'T')) <= end)
          .reduce(
            (sum, transaction) =>
              sum + (transaction.type === 'receita' ? transaction.amount : -transaction.amount),
            0,
          )
      return {
        label:
          index % 6 === 0
            ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
            : '',
        value: balance,
      }
    })
  }, [accounts, transactions])

  const weeklyCashFlow = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((week) => {
        const records = monthTransactions.filter(
          (transaction) =>
            Math.min(5, Math.ceil(Number(transaction.date.slice(8, 10)) / 7)) === week,
        )
        return {
          name: week === 5 ? 'Fim do mês' : `${week}ª sem.`,
          receitas: records
            .filter((transaction) => transaction.type === 'receita')
            .reduce((sum, transaction) => sum + transaction.amount, 0),
          despesas: records
            .filter((transaction) => transaction.type === 'despesa')
            .reduce((sum, transaction) => sum + transaction.amount, 0),
        }
      }),
    [monthTransactions],
  )

  const byCategory = useMemo(() => {
    // Consolidação de subcategorias na raiz para o gráfico donut
    const totals = new Map<
      string,
      {
        id: string
        name: string
        value: number
        color: string
        subcategories: Map<string, { name: string; value: number }>
      }
    >()

    monthTransactions
      .filter((transaction) => transaction.type === 'despesa')
      .forEach((transaction) => {
        // Encontrar categoria raiz navegando a cadeia de parent
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
        const rootColor = root?.color || chartColors[totals.size % chartColors.length]

        const current = totals.get(rootId) || {
          id: rootId,
          name: rootName,
          value: 0,
          color: rootColor,
          subcategories: new Map<string, { name: string; value: number }>(),
        }

        current.value += transaction.amount

        // Detalhamento secundário por subcategoria (se for subcategoria)
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
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        subcategoriesList: Array.from(item.subcategories.values()).sort(
          (a, b) => b.value - a.value,
        ),
      }))
  }, [monthTransactions, categories])

  // Metas do mês calculadas com agregação de subcategorias
  const budgetProgressList = useMemo(() => {
    return budgets.map((b) => {
      const category = categories.find((c) => c.id === b.category) || b.expand?.category
      const subcategoryIds = categories
        .filter((c) => category && c.parent === category.id)
        .map((c) => c.id)
      const allIds = category ? [category.id, ...subcategoryIds] : [b.category]

      const spent = monthTransactions
        .filter((t) => t.type === 'despesa' && allIds.includes(t.category))
        .reduce((sum, t) => sum + t.amount, 0)

      const limit = b.monthly_limit
      const pct = limit > 0 ? (spent / limit) * 100 : 0
      const isOver = pct >= 100
      const isWarning = pct >= 80 && pct < 100

      const color = isOver ? '#BE123C' : isWarning ? '#D97706' : '#047857'

      return {
        budget: b,
        category,
        spent,
        limit,
        pct,
        isOver,
        isWarning,
        color,
      }
    })
  }, [budgets, categories, monthTransactions])

  const upcoming = bills
    .filter((bill) => bill.status !== 'pago')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
  const firstName = String(user?.name || 'Usuário').split(' ')[0]

  function openBill(direction: BillDirection) {
    setBillDirection(direction)
    setBillModal(true)
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 page-container">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-fin-muted">
            Visão geral
          </p>
          <h1 className="page-title">Olá, {firstName}</h1>
          <p className="page-subtitle">Aqui está um resumo das suas finanças hoje.</p>
          {recurrings.filter((r) => r.active).length > 0 && (
            <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-fin-border bg-fin-surface px-3 py-1 text-xs text-fin-muted">
              <Repeat className="h-3.5 w-3.5 text-fin-primary" />
              <span>
                <strong className="text-fin-text font-semibold">
                  {recurrings.filter((r) => r.active).length}
                </strong>{' '}
                recorrência(s) automática(s) ativa(s)
              </span>
              <button
                onClick={() => navigate('/recorrentes')}
                className="font-semibold text-fin-primary hover:underline ml-1"
              >
                Ver todas →
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 no-print sm:ml-auto">
          <button
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] bg-emerald-600 px-4 py-[9px] text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
            onClick={() => openGlobalTransaction('despesa')}
          >
            <Plus className="h-4 w-4" />
            Lançamento
          </button>
          <button className="btn-secondary" onClick={() => openBill('pagar')}>
            <ArrowUpRight className="h-4 w-4" />
            Pagar conta
          </button>
          <button className="btn-secondary" onClick={() => openBill('receber')}>
            <ArrowDownRight className="h-4 w-4" />
            Receber
          </button>
        </div>
      </section>

      {/* Card 'Pergunte à IA' estilo Mercury */}
      <DashboardAiCard
        currentMonthKey={month}
        transactions={monthTransactions}
        bills={bills}
        categories={categories}
        aiReport={aiReport}
        loadingReport={loadingReport}
      />

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <article className="fin-card animate-fade-up stagger-1 overflow-hidden bg-gradient-to-b from-indigo-50/40 via-[var(--fin-bg-card)] to-[var(--fin-bg-card)] dark:from-indigo-950/20 border-indigo-100 dark:border-white/10 shadow-sm">
          <div className="flex items-start justify-between gap-4 p-6 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-600 text-white shadow-xs">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-fin-muted">
                  Saldo total
                </h2>
              </div>
              <p className="mt-2 text-[34px] font-extrabold tracking-[-.035em] text-fin-text sm:text-[42px]">
                {brl.format(animatedBalance)}
              </p>
            </div>
            <select className="rounded-lg border border-fin-border bg-[var(--fin-bg-card)] px-3 py-2 text-xs font-semibold text-fin-text shadow-2xs">
              <option>Últimos 30 dias</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3 px-6 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-600 dark:text-emerald-400 shadow-2xs">
              ↗ {brl.format(income)}{' '}
              <span className="text-xs font-medium opacity-80">entradas</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
              ↘ {brl.format(expense)} <span className="text-xs font-medium opacity-80">saídas</span>
            </span>
          </div>
          <div className="mt-4 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceSeries} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4F46E5" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--fin-text-secondary)', fontSize: 11, fontWeight: 500 }}
                  interval={0}
                />
                <YAxis hide domain={['dataMin - 800', 'dataMax + 500']} />
                <Tooltip
                  formatter={(value) => [brl.format(Number(value)), 'Saldo']}
                  labelFormatter={() => ''}
                  contentStyle={{
                    backgroundColor: 'var(--fin-bg-card)',
                    borderColor: 'var(--fin-border-color)',
                    color: 'var(--fin-text-primary)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#4F46E5"
                  strokeWidth={3}
                  fill="url(#balanceGradient)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="fin-card animate-fade-up stagger-2 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="section-title">Contas</h2>
              <p className="mt-0.5 text-xs text-fin-muted">Bancos, carteiras e cartões</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditingAccount(null)
                  setAccountModalDefaultType('cartao')
                  setAccountModal(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-fin-border bg-fin-surface/70 px-2.5 py-1.5 text-xs font-semibold text-fin-text transition hover:border-fin-primary/40 hover:bg-fin-surface hover:text-fin-primary"
                title="Adicionar novo cartão de crédito"
              >
                <CreditCard className="h-3.5 w-3.5 text-rose-500" />
                <span>+ Cartão</span>
              </button>
              <button
                onClick={() => {
                  setEditingAccount(null)
                  setAccountModalDefaultType('banco')
                  setAccountModal(true)
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-fin-surface text-fin-muted transition hover:text-fin-primary"
                aria-label="Adicionar conta"
                title="Adicionar conta"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {accountBalances.slice(0, showAllAccounts ? undefined : 4).map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onClick={() => {
                  setEditingAccount(account)
                  setAccountModal(true)
                }}
              />
            ))}
            {accountBalances.length === 0 && (
              <EmptyState icon={Landmark} text="Adicione sua primeira conta financeira." />
            )}
          </div>
          {accountBalances.length > 4 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setShowAllAccounts((value) => !value)}
                className="flex items-center gap-2 text-sm font-semibold text-fin-primary"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-50">
                  +{accountBalances.length - 4}
                </span>
                {showAllAccounts ? 'Mostrar menos' : 'Ver todas'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/configuracoes')}
                className="text-xs font-medium text-fin-muted hover:text-fin-primary hover:underline"
              >
                Gerenciar em Configurações
              </button>
            </div>
          )}
        </article>
      </section>

      {/* Seção de Metas do Mês com Alertas de 80% e 100% */}
      <article className="fin-card animate-fade-up stagger-2 overflow-hidden">
        <div className="flex items-center justify-between border-b border-fin-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h2 className="section-title">Metas do mês</h2>
              <p className="mt-0.5 text-xs text-fin-muted">
                Controle de limites por categoria e alertas preventivos
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/categorias')}
            className="flex items-center gap-1 text-sm font-semibold text-fin-primary hover:underline"
          >
            Gerenciar metas <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {budgetProgressList.length > 0 ? (
          <div className="divide-y divide-fin-border">
            {/* Banner de alerta se houver metas estouradas ou próximas */}
            {budgetProgressList.some((bp) => bp.isOver || bp.isWarning) && (
              <div className="bg-amber-50/60 px-5 py-3 sm:px-6 flex flex-wrap items-center gap-3 text-xs">
                {budgetProgressList.filter((bp) => bp.isOver).length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-fin-danger">
                    <AlertCircle className="h-4 w-4" />
                    {budgetProgressList.filter((bp) => bp.isOver).length} meta(s) estourada(s)!
                  </span>
                )}
                {budgetProgressList.filter((bp) => bp.isWarning).length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4 text-fin-warning" />
                    {budgetProgressList.filter((bp) => bp.isWarning).length} meta(s) em atenção
                    (≥80%)
                  </span>
                )}
              </div>
            )}

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              {budgetProgressList.map((item) => (
                <div
                  key={item.budget.id}
                  className="rounded-2xl border border-fin-border bg-fin-surface/40 p-4 transition hover:bg-[var(--fin-bg-card)] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ background: item.category?.color || '#5B5FEF' }}
                      />
                      <span className="truncate text-sm font-semibold">
                        {item.category?.name || 'Categoria'}
                      </span>
                    </div>

                    {item.isOver ? (
                      <span className="fin-badge fin-badge-danger">
                        <AlertCircle className="h-3 w-3" />
                        100%+
                      </span>
                    ) : item.isWarning ? (
                      <span className="fin-badge fin-badge-warning">
                        <AlertTriangle className="h-3 w-3" />
                        80%+
                      </span>
                    ) : (
                      <span className="fin-badge fin-badge-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Normal
                      </span>
                    )}
                  </div>

                  {/* Valor gasto / Limite em R$ */}
                  <div className="mt-3 flex items-baseline justify-between text-xs">
                    <span className="text-fin-muted">
                      <strong className="text-sm font-bold text-fin-text">
                        {brl.format(item.spent)}
                      </strong>{' '}
                      / {brl.format(item.limit)}
                    </span>
                    <span className="font-bold text-xs" style={{ color: item.color }}>
                      {item.pct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Barra de progresso com cores dinâmicas */}
                  <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200/90 overflow-hidden border border-slate-300/50">
                    <div
                      className="h-full rounded-full transition-all duration-700 shadow-2xs"
                      style={{
                        width: `${Math.min(item.pct, 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-fin-muted">
                    {item.spent > item.limit ? (
                      <span className="text-fin-danger font-medium">
                        Ultrapassou em {brl.format(item.spent - item.limit)}
                      </span>
                    ) : (
                      <span>Resta {brl.format(item.limit - item.spent)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-fin-muted">Nenhuma meta configurada ainda.</p>
            <button
              onClick={() => navigate('/categorias')}
              className="btn-secondary mt-3 inline-flex items-center gap-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar metas de gasto
            </button>
          </div>
        )}
      </article>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="fin-card animate-fade-up stagger-2 p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="section-title">Fluxo de caixa do mês</h2>
            <p className="mt-1 text-xs text-fin-muted">Receitas e despesas por semana</p>
          </div>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCashFlow} barGap={6}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--fin-chart-grid)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: 'var(--fin-border-color)' }}
                  tickLine={false}
                  tick={{ fill: 'var(--fin-text-secondary)', fontSize: 11, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--fin-text-secondary)', fontSize: 10, fontWeight: 500 }}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    brl.format(Number(value)),
                    name === 'receitas' ? 'Receitas' : 'Despesas',
                  ]}
                  contentStyle={{
                    backgroundColor: 'var(--fin-bg-card)',
                    borderColor: 'var(--fin-border-color)',
                    color: 'var(--fin-text-primary)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    fontWeight: 600,
                  }}
                />
                <Bar
                  dataKey="receitas"
                  fill="#059669"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={28}
                  animationDuration={800}
                />
                <Bar
                  dataKey="despesas"
                  fill="#E11D48"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={28}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-center gap-5 text-xs text-fin-muted">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-fin-success" />
              Receitas
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-fin-danger" />
              Despesas
            </span>
          </div>
        </article>

        <article className="fin-card animate-fade-up stagger-3 p-5 sm:p-6">
          <div className="mb-3">
            <h2 className="section-title">Por categoria</h2>
            <p className="mt-1 text-xs text-fin-muted">Distribuição das despesas no mês</p>
          </div>
          {byCategory.length ? (
            <div className="grid min-h-[295px] items-center gap-3 sm:grid-cols-[45%_55%]">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(value, name, item) => {
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
                        return [`${brl.format(Number(value))}${subDetails}`, String(name)]
                      }}
                      contentStyle={{
                        backgroundColor: 'var(--fin-bg-card)',
                        borderColor: 'var(--fin-border-color)',
                        color: 'var(--fin-text-primary)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        fontWeight: 600,
                      }}
                    />
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={2}
                      stroke="var(--fin-bg-card)"
                      strokeWidth={3}
                      animationDuration={800}
                      onClick={(_, index) => {
                        const item = byCategory[index]
                        if (item && item.id !== 'sem_categoria') {
                          navigate(`/lancamentos?parent=${item.id}&month=${month}`)
                        }
                      }}
                    >
                      {byCategory.map((item, index) => (
                        <Cell
                          key={item.id}
                          fill={item.color || chartColors[index % chartColors.length]}
                          className="cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {byCategory.slice(0, 6).map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id !== 'sem_categoria') {
                        navigate(`/lancamentos?parent=${item.id}&month=${month}`)
                      } else {
                        navigate(`/lancamentos?month=${month}`)
                      }
                    }}
                    className="flex w-full flex-col gap-0.5 text-left text-xs transition hover:translate-x-0.5"
                  >
                    <div className="flex w-full items-center gap-2">
                      <i
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          background: item.color || chartColors[index % chartColors.length],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-fin-text">
                        {item.name}
                      </span>
                      <strong className="font-semibold text-fin-text shrink-0">
                        {brl.format(item.value)}
                      </strong>
                    </div>
                    {item.subcategoriesList && item.subcategoriesList.length > 0 && (
                      <span className="pl-4.5 text-[10px] text-fin-muted truncate">
                        inclui {item.subcategoriesList.map((s) => s.name).join(', ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={ReceiptText} text="Nenhuma despesa registrada neste mês." />
          )}
        </article>
      </section>

      <article className="fin-card animate-fade-up stagger-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-fin-border px-5 py-5 sm:px-6">
          <div>
            <h2 className="section-title">Contas a vencer</h2>
            <p className="mt-1 text-xs text-fin-muted">Próximos compromissos e recebimentos</p>
          </div>
          <button
            onClick={() => navigate('/contas?status=em_aberto')}
            className="flex items-center gap-1 text-sm font-semibold text-fin-primary"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-fin-border">
          {upcoming.map((bill) => {
            const days = daysUntil(bill.due_date)
            return (
              <div
                key={bill.id}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-fin-surface/60 sm:flex-row sm:items-center sm:px-6"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    days < 0
                      ? 'fin-badge-danger !border-0'
                      : bill.direction === 'receber'
                        ? 'fin-badge-success !border-0'
                        : 'fin-badge-warning !border-0'
                  }`}
                >
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-fin-text">
                      {bill.description}
                    </p>
                    {days < 0 ? (
                      <span className="fin-badge fin-badge-danger">Atrasada</span>
                    ) : days === 0 ? (
                      <span className="fin-badge fin-badge-warning">Hoje</span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-1 text-xs ${days < 0 ? 'font-medium text-fin-danger' : 'text-fin-muted'}`}
                  >
                    {days < 0
                      ? `Vencida há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
                      : days === 0
                        ? 'Vence hoje'
                        : `Vence em ${days} dias`}{' '}
                    · {formatDate(bill.due_date)}
                  </p>
                </div>
                <p
                  className={`text-sm font-bold ${bill.direction === 'receber' ? 'text-fin-success' : 'text-fin-text'}`}
                >
                  {bill.direction === 'receber' ? '+' : ''}
                  {brl.format(bill.amount)}
                </p>
                <button
                  onClick={() => setSettling(bill)}
                  className="btn-secondary !min-h-[34px] !py-1.5 !text-xs shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {bill.direction === 'receber' ? 'Registrar recebimento' : 'Marcar como pago'}
                </button>
              </div>
            )
          })}
          {upcoming.length === 0 && (
            <div className="p-6">
              <EmptyState icon={CheckCircle2} text="Tudo em dia. Nenhuma conta pendente." />
            </div>
          )}
        </div>
      </article>

      <AccountModal
        account={editingAccount}
        defaultType={accountModalDefaultType}
        open={accountModal}
        onOpenChange={(open) => {
          setAccountModal(open)
          if (!open) setEditingAccount(null)
        }}
        onSaved={(acc) =>
          toast({
            title: editingAccount ? 'Conta atualizada' : 'Conta adicionada',
            description: `"${acc.name}" agora faz parte do seu saldo consolidado.`,
          })
        }
      />
      <BillModal
        open={billModal}
        onOpenChange={setBillModal}
        defaultDirection={billDirection}
        onSaved={(bill) => {
          setBills((current) => [...current, bill])
          toast({
            title: bill.direction === 'pagar' ? 'Conta a pagar criada' : 'Conta a receber criada',
          })
        }}
      />
      <SettleBillModal
        bill={settling}
        open={Boolean(settling)}
        onOpenChange={(open) => {
          if (!open) setSettling(null)
        }}
        onSettled={() => {
          void reload()
          toast({
            title: 'Conta liquidada',
            description: 'O lançamento correspondente foi criado.',
          })
        }}
      />
    </div>
  )
}

function AccountRow({
  account,
  onClick,
}: {
  account: Account & { balance: number }
  onClick?: () => void
}) {
  const Icon =
    account.type === 'cartao' ? CreditCard : account.type === 'carteira' ? WalletCards : Landmark
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-fin-surface active:scale-[0.99] focus:outline-hidden focus:ring-2 focus:ring-fin-primary/30"
      title="Clique para editar esta conta"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition group-hover:scale-105"
        style={{ background: `${account.color}16`, color: account.color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fin-text group-hover:text-fin-primary transition-colors">
            {account.name}
          </span>
          <span className="rounded-full bg-fin-surface px-1.5 py-0.2 text-[10px] font-semibold text-fin-muted capitalize">
            {account.type}
          </span>
        </div>
        <p className="text-[11px] text-fin-muted">Clique para editar</p>
      </div>
      <strong className="text-sm font-semibold shrink-0">{brl.format(account.balance)}</strong>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  text,
  actionText,
  onAction,
}: {
  icon: typeof Banknote
  text: string
  actionText?: string
  onAction?: () => void
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-fin-surface text-fin-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-fin-text">{text}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-secondary mt-3 !min-h-[34px] !py-1.5 !text-xs">
          <Plus className="h-3.5 w-3.5" />
          {actionText}
        </button>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-8 w-44" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-10 w-32 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="fin-card p-6">
          <div className="space-y-3">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-10 w-48" />
            <div className="skeleton mt-6 h-52 w-full rounded-xl" />
          </div>
        </div>
        <div className="fin-card p-6 space-y-4">
          <div className="skeleton h-5 w-24" />
          <div className="space-y-3">
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
      <div className="fin-card p-6">
        <div className="skeleton h-5 w-32 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="fin-card p-6">
          <div className="skeleton h-5 w-40 mb-2" />
          <div className="skeleton h-4 w-32 mb-6" />
          <div className="skeleton h-60 w-full rounded-xl" />
        </div>
        <div className="fin-card p-6">
          <div className="skeleton h-5 w-40 mb-2" />
          <div className="skeleton h-4 w-32 mb-6" />
          <div className="skeleton h-60 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
