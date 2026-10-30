import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Clock,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RecurringModal } from '@/components/finance/RecurringModal'
import { useFinance } from '@/contexts/FinanceContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { brl, formatDate } from '@/lib/format'
import {
  deleteRecurringTransaction,
  listRecurringTransactions,
  toggleRecurringActive,
  triggerProcessRecurring,
} from '@/services/recurring'
import type { RecurringTransaction, TransactionType } from '@/types/finance'
import { cn } from '@/lib/utils'

type Tab = 'todas' | 'receita' | 'despesa'

export default function RecurringPage() {
  const { categories, accounts } = useFinance()
  const { toast } = useToast()
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null)
  const [tab, setTab] = useState<Tab>('todas')
  const [query, setQuery] = useState('')

  const reload = useCallback(async () => {
    try {
      const data = await listRecurringTransactions()
      setRecurrings(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useRealtime<RecurringTransaction>('recurring_transactions', () => {
    void reload()
  })

  // Ação manual para processar lançamentos agora
  async function handleTriggerProcess() {
    setProcessing(true)
    try {
      const res = await triggerProcessRecurring()
      toast({
        title: 'Recorrências processadas!',
        description: `${res.createdCount} lançamento(s) gerado(s). ${res.skippedCount} já em dia.`,
      })
      await reload()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar',
        description: 'Não foi possível rodar o processamento agora.',
      })
    } finally {
      setProcessing(false)
    }
  }

  async function handleToggle(item: RecurringTransaction) {
    try {
      const updated = await toggleRecurringActive(item.id, !item.active)
      setRecurrings((curr) => curr.map((r) => (r.id === updated.id ? updated : r)))
      toast({
        title: updated.active ? 'Recorrência ativada' : 'Recorrência pausada',
        description: updated.active
          ? 'O cron diário voltará a gerar lançamentos automaticamente.'
          : 'Nenhum novo lançamento será gerado enquanto estiver pausada.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
      })
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteRecurringTransaction(deleting.id)
      setRecurrings((curr) => curr.filter((r) => r.id !== deleting.id))
      toast({
        title: 'Recorrência excluída',
        description: 'Os lançamentos já criados no passado não foram afetados.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir',
      })
    } finally {
      setDeleting(null)
    }
  }

  const filtered = useMemo(() => {
    return recurrings.filter((item) => {
      if (tab !== 'todas' && item.type !== tab) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const desc = item.description.toLowerCase()
        const catName = (categories.find((c) => c.id === item.category)?.name || '').toLowerCase()
        if (!desc.includes(q) && !catName.includes(q)) return false
      }
      return true
    })
  }, [recurrings, tab, query, categories])

  const totalMonthlyExpense = useMemo(() => {
    return recurrings
      .filter((r) => r.active && r.type === 'despesa')
      .reduce((sum, r) => {
        if (r.frequency === 'mensal') return sum + r.amount
        if (r.frequency === 'semanal') return sum + r.amount * 4.33
        if (r.frequency === 'quinzenal') return sum + r.amount * 2
        if (r.frequency === 'anual') return sum + r.amount / 12
        return sum + r.amount
      }, 0)
  }, [recurrings])

  const totalMonthlyIncome = useMemo(() => {
    return recurrings
      .filter((r) => r.active && r.type === 'receita')
      .reduce((sum, r) => {
        if (r.frequency === 'mensal') return sum + r.amount
        if (r.frequency === 'semanal') return sum + r.amount * 4.33
        if (r.frequency === 'quinzenal') return sum + r.amount * 2
        if (r.frequency === 'anual') return sum + r.amount / 12
        return sum + r.amount
      }, 0)
  }, [recurrings])

  return (
    <div className="space-y-6 page-container">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Lançamentos Recorrentes</h1>
          </div>
          <p className="page-subtitle">
            Cadastre despesas e receitas fixas uma única vez. O sistema cria os lançamentos sozinho
            via cron diário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
          <button
            onClick={() => void handleTriggerProcess()}
            disabled={processing}
            className="btn-secondary text-xs"
            title="Executa a verificação diária agora mesmo para gerar lançamentos pendentes"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin text-fin-primary" />
            ) : (
              <RefreshCw className="h-4 w-4 text-fin-primary" />
            )}
            {processing ? 'Processando...' : 'Sincronizar agora'}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nova recorrência
          </button>
        </div>
      </header>

      {/* Card informativo de automação */}
      <section className="fin-card p-4 sm:p-5 border-l-4 border-l-fin-primary bg-indigo-50/30 animate-fade-up stagger-1">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-2 text-fin-primary shrink-0 mt-0.5">
            <Zap className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm text-fin-muted">
            <strong className="block text-fin-text font-semibold">
              Automação Diária Ativa (Executa todo dia às 06:15 UTC)
            </strong>
            <p className="text-fin-muted">
              Ao cadastrar uma recorrência (como aluguel, salários ou assinaturas), nosso robô
              inteligente verifica as datas e cria o lançamento correspondente em{' '}
              <strong>Lançamentos</strong> no dia exato do vencimento, com proteção anti-duplicação.
            </p>
          </div>
        </div>
      </section>

      {/* Cards de Resumo / KPIs consistentes */}
      <section className="grid gap-4 sm:grid-cols-3 animate-fade-up stagger-1">
        <div className="fin-card p-5">
          <span className="text-xs font-medium text-fin-muted">Recorrências ativas</span>
          <p className="mt-3 text-[26px] font-bold tracking-tight text-fin-text sm:text-[28px]">
            {recurrings.filter((r) => r.active).length}
            <span className="text-xs font-normal text-fin-muted ml-2">
              de {recurrings.length} cadastradas
            </span>
          </p>
        </div>
        <div className="fin-card p-5">
          <span className="text-xs font-medium text-fin-muted">Entradas fixas estimadas/mês</span>
          <p className="mt-3 text-[26px] font-bold tracking-tight text-fin-success sm:text-[28px]">
            {brl.format(totalMonthlyIncome)}
          </p>
        </div>
        <div className="fin-card p-5">
          <span className="text-xs font-medium text-fin-muted">Despesas fixas estimadas/mês</span>
          <p className="mt-3 text-[26px] font-bold tracking-tight text-fin-danger sm:text-[28px]">
            {brl.format(totalMonthlyExpense)}
          </p>
        </div>
      </section>

      {/* Filtros e Abas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-fin-border pb-3 animate-fade-up stagger-2">
        <div className="flex">
          {(
            [
              ['todas', 'Todas'],
              ['receita', 'Receitas'],
              ['despesa', 'Despesas'],
            ] as [Tab, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTab(val)}
              className={cn(
                'relative px-4 py-2 text-sm font-semibold text-fin-muted transition',
                tab === val &&
                  'text-fin-primary after:absolute after:bottom-[-13px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary',
              )}
            >
              {label}
              <span className="ml-1.5 text-xs font-normal">
                {val === 'todas'
                  ? recurrings.length
                  : recurrings.filter((r) => r.type === val).length}
              </span>
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
          <input
            className="field pl-9 py-1.5 text-sm"
            placeholder="Buscar por descrição..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabela de Recorrências */}
      <section className="fin-card overflow-hidden animate-fade-up stagger-3">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
              <Clock className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-fin-text">
              {query
                ? 'Nenhuma recorrência encontrada para a busca'
                : 'Nenhuma recorrência cadastrada'}
            </h2>
            <p className="mt-1 max-w-md text-xs text-fin-muted">
              {query
                ? `Não encontramos recorrências correspondentes a "${query}". Limpe a busca para ver todas.`
                : 'Cadastre suas contas frequentes para não precisar criá-las manualmente todos os meses.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="btn-outline !min-h-[36px] !py-1.5 !text-xs"
                >
                  Limpar busca
                </button>
              )}
              <button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
                className="btn-primary !min-h-[36px] inline-flex items-center gap-2 !py-1.5 !text-xs"
              >
                <Plus className="h-4 w-4" />
                Criar primeira recorrência
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr className="border-b border-fin-border bg-fin-surface/70 text-left text-[11px] uppercase tracking-[.06em] text-fin-muted">
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Descrição</th>
                  <th className="px-5 py-3 font-semibold">Frequência</th>
                  <th className="px-5 py-3 font-semibold">Categoria / Conta</th>
                  <th className="px-5 py-3 font-semibold">Próximo lançamento</th>
                  <th className="px-5 py-3 font-semibold">Última execução</th>
                  <th className="px-5 py-3 text-right font-semibold">Valor</th>
                  <th className="w-14 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fin-border">
                {filtered.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    accounts={accounts}
                    onToggle={() => void handleToggle(item)}
                    onEdit={() => {
                      setEditing(item)
                      setModalOpen(true)
                    }}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal CRUD */}
      <RecurringModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        recurring={editing}
        defaultType={(tab === 'receita' ? 'receita' : 'despesa') as TransactionType}
        onSaved={(saved) => {
          setRecurrings((curr) =>
            editing ? curr.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...curr],
          )
          toast({
            title: editing ? 'Recorrência atualizada' : 'Recorrência cadastrada',
            description: 'A automação já está ativa para este lançamento.',
          })
          setEditing(null)
        }}
      />

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra automática “{deleting?.description}” será removida e não gerará novos
              lançamentos. Os lançamentos anteriores já gerados em seu histórico continuarão
              preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-fin-danger hover:bg-red-600"
              onClick={() => void confirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RecurringRow({
  item,
  categories,
  accounts,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: RecurringTransaction
  categories: { id: string; name: string; color?: string }[]
  accounts: { id: string; name: string }[]
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const category = categories.find((c) => c.id === item.category) || item.expand?.category
  const account = accounts.find((a) => a.id === item.account) || item.expand?.account

  // Cálculo da próxima execução prevista no frontend
  const nextRun = useMemo(() => {
    if (!item.active) return null

    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonthIdx = now.getUTCMonth()
    const currentDay = now.getUTCDate()
    const day = item.day_of_month || 1

    if (item.frequency === 'mensal') {
      let targetMonthIdx = currentMonthIdx
      let targetYear = currentYear

      // Se já passou o dia deste mês, próxima é no mês que vem
      if (currentDay > day) {
        targetMonthIdx += 1
        if (targetMonthIdx > 11) {
          targetMonthIdx = 0
          targetYear += 1
        }
      }

      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate()
      const effectiveDay = Math.min(day, daysInTargetMonth)

      const d = new Date(Date.UTC(targetYear, targetMonthIdx, effectiveDay, 12, 0, 0))
      // Se a data calculada for posterior à end_date, a recorrência já terminou
      if (item.end_date) {
        const endYMD = item.end_date.slice(0, 10)
        const dYMD = d.toISOString().slice(0, 10)
        if (dYMD > endYMD) return null
      }
      return d.toISOString()
    }
    if (item.frequency === 'semanal') {
      const base = item.last_run ? new Date(item.last_run.replace(' ', 'T')) : new Date()
      base.setUTCDate(base.getUTCDate() + 7)
      return base.toISOString()
    }

    if (item.frequency === 'quinzenal') {
      const base = item.last_run ? new Date(item.last_run.replace(' ', 'T')) : new Date()
      base.setUTCDate(base.getUTCDate() + 14)
      return base.toISOString()
    }

    if (item.frequency === 'anual') {
      const start = new Date(item.start_date.replace(' ', 'T'))
      const startMonth = start.getUTCMonth()
      let targetYear = currentYear
      if (currentMonthIdx > startMonth || (currentMonthIdx === startMonth && currentDay > day)) {
        targetYear += 1
      }
      return new Date(Date.UTC(targetYear, startMonth, day, 12, 0, 0)).toISOString()
    }

    return null
  }, [item])

  return (
    <tr className="group text-sm transition hover:bg-fin-surface/60">
      {/* Toggle de ativo */}
      <td className="px-5 py-4">
        <button
          onClick={onToggle}
          title={item.active ? 'Clique para pausar' : 'Clique para ativar'}
          className={cn(
            'fin-badge cursor-pointer transition',
            item.active
              ? 'fin-badge-success hover:opacity-80'
              : 'fin-badge-neutral hover:opacity-80',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              item.active ? 'bg-emerald-600' : 'bg-zinc-400',
            )}
          />
          {item.active ? 'Ativa' : 'Pausada'}
        </button>
      </td>

      {/* Descrição */}
      <td className="px-5 py-4 max-w-56">
        <span className="font-semibold text-fin-text block truncate">{item.description}</span>
        {item.end_date && (
          <span className="text-[11px] text-fin-muted">Até {formatDate(item.end_date)}</span>
        )}
      </td>

      {/* Frequência */}
      <td className="px-5 py-4 whitespace-nowrap text-fin-muted">
        <span className="capitalize font-medium text-fin-text">{item.frequency}</span>
        {(item.frequency === 'mensal' || item.frequency === 'anual') && (
          <span className="text-xs block text-fin-muted">Todo dia {item.day_of_month || 1}</span>
        )}
      </td>

      {/* Categoria / Conta */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1 items-start">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: `${category?.color || '#71717A'}15`,
              color: category?.color || '#71717A',
            }}
          >
            <i
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: category?.color || '#71717A' }}
            />
            {category?.name || 'Sem categoria'}
          </span>
          <span className="text-xs text-fin-muted">{account?.name || '—'}</span>
        </div>
      </td>

      {/* Próximo lançamento previsto */}
      <td className="px-5 py-4 whitespace-nowrap text-xs">
        {item.active && nextRun ? (
          <span className="inline-flex items-center gap-1 font-medium text-fin-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(nextRun)}
          </span>
        ) : (
          <span className="text-fin-muted italic">Pausada</span>
        )}
      </td>

      {/* Última execução */}
      <td className="px-5 py-4 whitespace-nowrap text-xs text-fin-muted">
        {item.last_run ? formatDate(item.last_run) : 'Ainda não rodou'}
      </td>

      {/* Valor */}
      <td
        className={cn(
          'whitespace-nowrap px-5 py-4 text-right font-bold',
          item.type === 'receita' ? 'text-fin-success' : 'text-fin-danger',
        )}
      >
        {item.type === 'receita' ? '+' : '−'} {brl.format(item.amount)}
      </td>

      {/* Ações */}
      <td className="px-3 py-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg p-2 text-fin-muted transition hover:bg-[var(--fin-bg-surface)] hover:text-fin-text">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-fin-border">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggle}>
              {item.active ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Pausar recorrência
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4 text-fin-success" />
                  Ativar recorrência
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-fin-danger" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}
