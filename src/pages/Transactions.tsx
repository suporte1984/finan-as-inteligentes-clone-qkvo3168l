import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'

import { TransactionModal } from '@/components/finance/TransactionModal'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFinance } from '@/contexts/FinanceContext'
import { useToast } from '@/hooks/use-toast'
import { getCategoryDescendantIds, isTransactionInCategory } from '@/lib/categories'
import { brl, currentMonth, formatDate } from '@/lib/format'
import { exportTransactionsToCsv } from '@/lib/exportCsv'
import {
  deleteTransaction,
  listTransactions,
  transactionAttachmentUrl,
} from '@/services/transactions'
import type { Transaction, TransactionType } from '@/types/finance'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

type Tab = 'todas' | 'receita' | 'despesa'

export default function TransactionsPage() {
  const { accounts, categories } = useFinance()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [previewing, setPreviewing] = useState<Transaction | null>(null)

  const tab = (params.get('tipo') as Tab) || 'todas'
  const query = params.get('q') || ''
  const category = params.get('category') || ''
  const account = params.get('account') || ''
  const month = params.get('month') || ''
  const start = params.get('inicio') || ''
  const end = params.get('fim') || ''
  const sort = params.get('ordem') || '-date'
  const page = Math.max(1, Number(params.get('pagina') || '1'))
  const parentFilter = params.get('parent') || ''

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTransactions(await listTransactions('', sort))
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => {
    void reload()
  }, [reload])

  const roots = useMemo(() => categories.filter((item) => !item.parent), [categories])
  const subcategories = useMemo(
    () => categories.filter((item) => item.parent === parentFilter),
    [categories, parentFilter],
  )

  // Mapeamento rápido de categorias para busca textual por nome de categoria
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    // Quando parentFilter está selecionado e category não está definida,
    // busca todos os IDs descendentes da categoria raiz recursivamente.
    const parentAllowedIds =
      parentFilter && !category ? new Set(getCategoryDescendantIds(parentFilter, categories)) : null

    // Quando category direta é passada (ou via URL), também resolve os descendentes
    // para o caso de a categoria selecionada ter subcategorias filhas.
    const categoryAllowedIds = category
      ? new Set(getCategoryDescendantIds(category, categories))
      : null

    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')

    return transactions.filter((transaction) => {
      if (tab !== 'todas' && transaction.type !== tab) return false

      if (normalizedQuery) {
        const descMatch = transaction.description
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedQuery)
        const notesMatch = transaction.notes
          ? transaction.notes.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
          : false

        // Também verifica se a busca textual corresponde ao nome da categoria ou de suas categorias ancestrais
        const cat = categoryMap.get(transaction.category)
        const catNameMatch = cat
          ? cat.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
          : false
        const parentCat = cat?.parent ? categoryMap.get(cat.parent) : null
        const parentCatNameMatch = parentCat
          ? parentCat.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
          : false

        if (!descMatch && !notesMatch && !catNameMatch && !parentCatNameMatch) {
          return false
        }
      }

      if (categoryAllowedIds && !categoryAllowedIds.has(transaction.category)) {
        return false
      }

      if (parentAllowedIds && !parentAllowedIds.has(transaction.category)) {
        return false
      }

      if (account && transaction.account !== account) return false
      const date = transaction.date.slice(0, 10)
      if (month && !date.startsWith(month)) return false
      if (start && date < start) return false
      if (end && date > end) return false
      return true
    })
  }, [
    transactions,
    tab,
    query,
    category,
    parentFilter,
    categories,
    categoryMap,
    account,
    month,
    start,
    end,
  ])

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === 'amount') return a.amount - b.amount
        if (sort === '-amount') return b.amount - a.amount
        if (sort === 'date') return a.date.localeCompare(b.date)
        return b.date.localeCompare(a.date)
      }),
    [filtered, sort],
  )
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const visible = sorted.slice(
    (Math.min(page, pages) - 1) * PAGE_SIZE,
    Math.min(page, pages) * PAGE_SIZE,
  )

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'pagina') next.delete('pagina')
    setParams(next)
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (tab !== 'todas') next.set('tipo', tab)
    setParams(next)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteTransaction(deleting.id)
      setTransactions((current) => current.filter((item) => item.id !== deleting.id))
      toast({ title: 'Lançamento excluído', description: 'O saldo foi recalculado.' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir',
        description: 'Tente novamente.',
      })
    } finally {
      setDeleting(null)
    }
  }

  const hasFilters = Boolean(query || category || parentFilter || account || month || start || end)

  return (
    <div className="space-y-6 page-container">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <h1 className="page-title">Lançamentos</h1>
          <p className="page-subtitle">Consulte e organize todas as entradas e saídas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print sm:ml-auto">
          <button
            className="btn-secondary"
            onClick={() => {
              if (sorted.length === 0) {
                toast({
                  title: 'Nenhum lançamento para exportar',
                  description: 'Ajuste os filtros para exibir lançamentos antes de exportar.',
                })
                return
              }
              exportTransactionsToCsv(
                sorted,
                categories,
                accounts,
                `lancamentos_${month || 'filtrados'}.csv`,
              )
              toast({
                title: 'CSV exportado',
                description: `${sorted.length} lançamentos filtrados foram exportados.`,
              })
            }}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
        </div>
      </header>

      <div className="flex border-b border-fin-border animate-fade-up stagger-1">
        {(
          [
            ['todas', 'Todas'],
            ['receita', 'Receitas'],
            ['despesa', 'Despesas'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => updateParam('tipo', value === 'todas' ? '' : value)}
            className={cn(
              'relative px-4 py-3 text-sm font-semibold text-fin-muted transition',
              tab === value &&
                'text-fin-primary after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary',
            )}
          >
            {label}
            <span className="ml-2 text-xs font-normal">
              {value === 'todas'
                ? transactions.length
                : transactions.filter((item) => item.type === value).length}
            </span>
          </button>
        ))}
      </div>

      <section className="fin-card animate-fade-up stagger-2 p-4 no-print">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
            <input
              className="field pl-10"
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="Buscar descrição..."
            />
          </label>
          <select
            className="field"
            value={parentFilter}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              if (event.target.value) next.set('parent', event.target.value)
              else next.delete('parent')
              next.delete('category')
              next.delete('pagina')
              setParams(next)
            }}
          >
            <option value="">Todas as categorias</option>
            {roots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={category}
            onChange={(event) => updateParam('category', event.target.value)}
            disabled={!parentFilter || subcategories.length === 0}
          >
            <option value="">
              {subcategories.length ? 'Todas as subcategorias' : 'Sem subcategorias'}
            </option>
            {subcategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={account}
            onChange={(event) => updateParam('account', event.target.value)}
          >
            <option value="">Todas as contas</option>
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={sort}
            onChange={(event) => updateParam('ordem', event.target.value)}
          >
            <option value="-date">Mais recentes</option>
            <option value="date">Mais antigas</option>
            <option value="-amount">Maior valor</option>
            <option value="amount">Menor valor</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-fin-border pt-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-fin-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Período
          </span>
          <input
            className="field min-h-9 w-auto py-1.5 text-xs"
            type="month"
            value={month}
            onChange={(event) => updateParam('month', event.target.value)}
          />
          <span className="text-xs text-fin-muted">ou</span>
          <input
            className="field min-h-9 w-auto py-1.5 text-xs"
            type="date"
            value={start}
            onChange={(event) => updateParam('inicio', event.target.value)}
          />
          <span className="text-xs text-fin-muted">até</span>
          <input
            className="field min-h-9 w-auto py-1.5 text-xs"
            type="date"
            value={end}
            onChange={(event) => updateParam('fim', event.target.value)}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-fin-primary"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="fin-card animate-fade-up stagger-3 overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-fin-border bg-fin-surface/70 text-left text-[11px] uppercase tracking-[.06em] text-fin-muted">
                <th className="px-5 py-3 font-semibold">Data</th>
                <th className="px-5 py-3 font-semibold">Descrição</th>
                <th className="px-5 py-3 font-semibold">Categoria</th>
                <th className="px-5 py-3 font-semibold">Conta</th>
                <th className="px-5 py-3 text-right font-semibold">Valor</th>
                <th className="w-14 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-fin-border">
              {visible.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={() => {
                    setEditing(transaction)
                    setModalOpen(true)
                  }}
                  onDelete={() => setDeleting(transaction)}
                  onPreview={() => setPreviewing(transaction)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-fin-border md:hidden">
          {visible.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              onEdit={() => {
                setEditing(transaction)
                setModalOpen(true)
              }}
              onDelete={() => setDeleting(transaction)}
              onPreview={() => setPreviewing(transaction)}
            />
          ))}
        </div>
        {!loading && visible.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
              <FileText className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-fin-text">
              {hasFilters
                ? 'Nenhum lançamento encontrado com esses filtros'
                : 'Nenhum lançamento cadastrado'}
            </h2>
            <p className="mt-1 max-w-sm text-xs text-fin-muted">
              {hasFilters
                ? 'Tente alterar ou limpar os filtros de busca, categoria, conta ou período.'
                : 'Cadastre sua primeira receita ou despesa para acompanhar seu fluxo financeiro.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-outline !min-h-[36px] !py-1.5 !text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
                className="btn-primary !min-h-[36px] !py-1.5 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro lançamento
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="space-y-3 p-5">
            <div className="skeleton h-10 w-full rounded-lg" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && sorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-fin-border px-5 py-4 text-xs text-fin-muted">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} de{' '}
              {sorted.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-fin-border p-2 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => updateParam('pagina', String(page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Página {Math.min(page, pages)} de {pages}
              </span>
              <button
                className="rounded-lg border border-fin-border p-2 disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => updateParam('pagina', String(page + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        transaction={editing}
        defaultType={(tab === 'receita' ? 'receita' : 'despesa') as TransactionType}
        onSaved={(saved) => {
          setTransactions((current) =>
            editing
              ? current.map((item) => (item.id === saved.id ? saved : item))
              : [saved, ...current],
          )
          toast({
            title: editing ? 'Lançamento atualizado' : 'Lançamento criado',
            description: 'As informações já estão refletidas no dashboard.',
          })
          setEditing(null)
        }}
      />
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.description}” será removido permanentemente e o saldo da conta será
              recalculado. Esta ação não pode ser desfeita.
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
      <AttachmentPreview
        transaction={previewing}
        open={Boolean(previewing)}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null)
        }}
      />
    </div>
  )
}

function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  onPreview,
}: {
  transaction: Transaction
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
}) {
  const category = transaction.expand?.category
  return (
    <tr className="group text-sm transition hover:bg-fin-surface/60">
      <td className="whitespace-nowrap px-5 py-4 text-fin-muted">{formatDate(transaction.date)}</td>
      <td className="max-w-64 px-5 py-4">
        <span className="flex items-center gap-2 font-medium">
          <span className="truncate">{transaction.description}</span>
          {transaction.attachment && (
            <button onClick={onPreview} className="text-fin-primary" title="Ver comprovante">
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        {transaction.notes && (
          <span className="mt-1 block truncate text-xs text-fin-muted">{transaction.notes}</span>
        )}
      </td>
      <td className="px-5 py-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            background: `${category?.color || '#71717A'}14`,
            color: category?.color || '#71717A',
          }}
        >
          <i
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: category?.color || '#71717A' }}
          />
          {category?.name || 'Sem categoria'}
        </span>
      </td>
      <td className="px-5 py-4 text-fin-muted">{transaction.expand?.account?.name || '—'}</td>
      <td
        className={`whitespace-nowrap px-5 py-4 text-right font-extrabold ${transaction.type === 'receita' ? 'text-emerald-800' : 'text-rose-800'}`}
      >
        {transaction.type === 'receita' ? '+' : '−'} {brl.format(transaction.amount)}
      </td>
      <td className="px-3 py-4">
        <ActionMenu onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  )
}

function TransactionCard({
  transaction,
  onEdit,
  onDelete,
  onPreview,
}: {
  transaction: Transaction
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-9 w-9 place-items-center rounded-full ${transaction.type === 'receita' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
        >
          <span className="text-base font-bold">{transaction.type === 'receita' ? '↗' : '↘'}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-fin-text">{transaction.description}</p>
              <p className="mt-1 text-xs text-fin-muted">
                {formatDate(transaction.date)} ·{' '}
                {transaction.expand?.category?.name || 'Sem categoria'}
              </p>
            </div>
            <strong
              className={`whitespace-nowrap text-sm font-extrabold ${transaction.type === 'receita' ? 'text-emerald-800' : 'text-rose-800'}`}
            >
              {transaction.type === 'receita' ? '+' : '−'} {brl.format(transaction.amount)}
            </strong>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {transaction.attachment && (
              <button
                onClick={onPreview}
                className="flex items-center gap-1 text-xs font-medium text-fin-primary"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Comprovante
              </button>
            )}
            <div className="ml-auto">
              <ActionMenu onEdit={onEdit} onDelete={onDelete} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg p-2 text-fin-muted transition hover:bg-white hover:text-fin-text">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-fin-border">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-fin-danger" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AttachmentPreview({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  if (!transaction) return null
  const url = transactionAttachmentUrl(transaction)
  const isPdf = transaction.attachment?.toLowerCase().endsWith('.pdf')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-fin-border">
        <DialogHeader>
          <DialogTitle>Comprovante · {transaction.description}</DialogTitle>
        </DialogHeader>
        <div className="grid min-h-[55vh] place-items-center overflow-hidden rounded-xl bg-fin-surface">
          {isPdf ? (
            <iframe title="Comprovante em PDF" src={url} className="h-[65vh] w-full" />
          ) : (
            <img
              src={url}
              alt={`Comprovante de ${transaction.description}`}
              className="max-h-[65vh] max-w-full object-contain"
            />
          )}
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">
          Abrir em nova aba
        </a>
      </DialogContent>
    </Dialog>
  )
}
