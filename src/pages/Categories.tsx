import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react'

import { CategoryModal } from '@/components/finance/CategoryModal'
import { BudgetModal } from '@/components/finance/BudgetModal'
import { deleteBudget, listBudgets } from '@/services/budgets'
import type { Budget } from '@/types/finance'
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
import { useFinance } from '@/contexts/FinanceContext'
import { useToast } from '@/hooks/use-toast'
import { brl, currentMonth, monthBounds } from '@/lib/format'
import { cn } from '@/lib/utils'
import { deleteCategory } from '@/services/categories'
import { listTransactions } from '@/services/transactions'
import type { Category, Transaction, TransactionType } from '@/types/finance'

type TabMode = 'categorias' | 'metas'
type Filter = 'todas' | TransactionType

interface CategoryCardProps {
  category: Category
  childrenCategories: Category[]
  transactions: Transaction[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

export default function CategoriesPage() {
  const { categories, refreshCategories } = useFinance()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [tabMode, setTabMode] = useState<TabMode>('categorias')
  const [filter, setFilter] = useState<Filter>('todas')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  // Metas de gasto
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null)

  const reloadBudgets = () => {
    listBudgets()
      .then(setBudgets)
      .catch(() => setBudgets([]))
  }

  useEffect(() => {
    const { start, next } = monthBounds(currentMonth())
    Promise.all([listTransactions(`date >= '${start}' && date < '${next}'`), listBudgets()])
      .then(([records, budgetList]) => {
        setTransactions(records)
        setBudgets(budgetList)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredRoots = useMemo(
    () =>
      categories.filter((category) => {
        if (category.parent) return false
        if (filter !== 'todas' && category.type !== filter) return false
        if (!query) return true
        const family = [category, ...categories.filter((child) => child.parent === category.id)]
        return family.some((item) =>
          item.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
        )
      }),
    [categories, filter, query],
  )

  function metrics(category: Category) {
    const ids = [
      category.id,
      ...categories.filter((item) => item.parent === category.id).map((item) => item.id),
    ]
    const records = transactions.filter((transaction) => ids.includes(transaction.category))
    return {
      count: records.length,
      total: records.reduce((sum, transaction) => sum + transaction.amount, 0),
    }
  }

  // Agregação de gastos para uma meta específica no mês corrente
  // Se a meta for numa categoria raiz, soma gastos de todas as suas subcategorias também
  function getBudgetSpent(budgetCategory: Category | undefined): number {
    if (!budgetCategory) return 0
    const subcategoryIds = categories.filter((c) => c.parent === budgetCategory.id).map((c) => c.id)
    const allRelevantIds = [budgetCategory.id, ...subcategoryIds]
    return transactions
      .filter((t) => t.type === 'despesa' && allRelevantIds.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0)
  }

  async function confirmDeleteBudget() {
    if (!deletingBudget) return
    try {
      await deleteBudget(deletingBudget.id)
      reloadBudgets()
      toast({ title: 'Meta excluída com sucesso' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir a meta',
        description: 'Tente novamente em instantes.',
      })
    } finally {
      setDeletingBudget(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const childIds = categories
      .filter((category) => category.parent === deleting.id)
      .map((category) => category.id)
    const linked = transactions.filter(
      (transaction) =>
        transaction.category === deleting.id || childIds.includes(transaction.category),
    ).length

    if (linked > 0) {
      toast({
        variant: 'destructive',
        title: 'Categoria em uso',
        description: 'Reclassifique os lançamentos vinculados antes de excluir esta categoria.',
      })
      setDeleting(null)
      return
    }

    try {
      for (const childId of childIds) await deleteCategory(childId)
      await deleteCategory(deleting.id)
      await refreshCategories()
      toast({ title: 'Categoria excluída' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir',
        description: 'Verifique se a categoria está vinculada a lançamentos ou contas.',
      })
    } finally {
      setDeleting(null)
    }
  }

  const deletingMetrics = deleting ? metrics(deleting) : { count: 0, total: 0 }

  return (
    <div className="space-y-6 page-container">
      <header className="animate-fade-up flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="page-title">Categorias e Metas</h1>
          <p className="page-subtitle">
            Classifique lançamentos e controle limites de gasto por categoria.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {tabMode === 'categorias' ? (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nova categoria
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => {
                setEditingBudget(null)
                setBudgetModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nova meta
            </button>
          )}
        </div>
      </header>

      {/* Navegação entre Categorias e Metas */}
      <div className="flex border-b border-fin-border animate-fade-up stagger-1">
        <button
          onClick={() => setTabMode('categorias')}
          className={cn(
            'relative px-4 py-3 text-sm font-semibold transition',
            tabMode === 'categorias'
              ? 'text-fin-primary after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary'
              : 'text-fin-muted hover:text-fin-text',
          )}
        >
          Categorias ({categories.length})
        </button>
        <button
          onClick={() => setTabMode('metas')}
          className={cn(
            'relative px-4 py-3 text-sm font-semibold transition',
            tabMode === 'metas'
              ? 'text-fin-primary after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary'
              : 'text-fin-muted hover:text-fin-text',
          )}
        >
          Metas de gasto ({budgets.length})
        </button>
      </div>

      {tabMode === 'categorias' ? (
        <>
          <section className="fin-card animate-fade-up stagger-1 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="tab-list">
              {(
                [
                  ['todas', 'Todas'],
                  ['despesa', 'Despesas'],
                  ['receita', 'Receitas'],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  className="tab-button"
                  data-active={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
              <input
                className="field pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar categoria..."
              />
            </label>
          </section>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton h-40" />
              ))}
            </div>
          ) : (
            <section className="animate-fade-up stagger-2 grid items-start gap-4 md:grid-cols-2">
              {filteredRoots.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  childrenCategories={categories.filter((item) => item.parent === category.id)}
                  transactions={transactions}
                  onEdit={(item) => {
                    setEditing(item)
                    setModalOpen(true)
                  }}
                  onDelete={setDeleting}
                />
              ))}
              {filteredRoots.length === 0 && <CategoriesEmptyState />}
            </section>
          )}
        </>
      ) : (
        /* Aba de Metas de Gasto */
        <section className="animate-fade-up stagger-1 space-y-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-fin-border bg-fin-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Acompanhamento das Metas do Mês</h2>
                <p className="text-xs text-fin-muted">
                  Progresso dos gastos acumulados no mês corrente vs. limites definidos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-fin-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#34C759]" />
                &lt; 80% Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFB020]" />
                80–99% Alerta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F4526B]" />≥ 100% Estourada
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-36" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <div className="fin-card col-span-full grid min-h-64 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-fin-surface text-fin-muted">
                  <Target className="h-6 w-6" />
                </span>
                <h2 className="section-title">Nenhuma meta configurada</h2>
                <p className="mt-2 text-sm text-fin-muted max-w-md mx-auto">
                  Defina limites mensais para suas principais categorias de despesa e acompanhe os
                  gastos para não estourar o orçamento.
                </p>
                <button
                  onClick={() => {
                    setEditingBudget(null)
                    setBudgetModalOpen(true)
                  }}
                  className="btn-primary mt-4 inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Criar primeira meta
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {budgets.map((b) => {
                const category = categories.find((c) => c.id === b.category) || b.expand?.category
                const spent = getBudgetSpent(category)
                const limit = b.monthly_limit
                const pct = limit > 0 ? (spent / limit) * 100 : 0
                const isOver = pct >= 100
                const isWarning = pct >= 80 && pct < 100

                const statusColor = isOver ? '#F4526B' : isWarning ? '#FFB020' : '#34C759'

                return (
                  <article key={b.id} className="fin-card fin-card-interactive p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ background: category?.color || '#5B5FEF' }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">
                              {category?.name || 'Categoria desconhecida'}
                            </h3>
                            {category?.parent && (
                              <span className="text-[10px] text-fin-muted bg-fin-surface px-1.5 py-0.5 rounded">
                                Subcategoria
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-fin-muted mt-0.5">
                            Limite mensal: <strong>{brl.format(limit)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOver ? (
                          <span className="fin-badge fin-badge-danger">
                            <AlertTriangle className="h-3 w-3" />
                            Estourada ({pct.toFixed(0)}%)
                          </span>
                        ) : isWarning ? (
                          <span className="fin-badge fin-badge-warning">
                            <AlertTriangle className="h-3 w-3" />
                            Atenção ({pct.toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="fin-badge fin-badge-success">
                            <CheckCircle2 className="h-3 w-3" />
                            No limite ({pct.toFixed(0)}%)
                          </span>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded-lg p-1.5 text-fin-muted hover:bg-fin-surface">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-fin-border">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingBudget(b)
                                setBudgetModalOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar limite
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-fin-danger"
                              onClick={() => setDeletingBudget(b)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir meta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-fin-muted">
                          Gasto no mês: <strong>{brl.format(spent)}</strong>
                        </span>
                        <span className="font-bold" style={{ color: statusColor }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200/90 overflow-hidden border border-slate-300/50">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-2xs"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: statusColor,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1.5 text-[11px] text-fin-muted">
                        <span>
                          {spent > limit
                            ? `Excedido em ${brl.format(spent - limit)}`
                            : `Disponível: ${brl.format(limit - spent)}`}
                        </span>
                        <span>Meta: {brl.format(limit)}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal de Meta */}
      <BudgetModal
        budget={editingBudget}
        existingBudgets={budgets}
        open={budgetModalOpen}
        onOpenChange={setBudgetModalOpen}
        onSaved={() => {
          reloadBudgets()
          toast({
            title: editingBudget ? 'Meta atualizada' : 'Meta criada',
            description: 'Seus limites foram salvos e monitorados no dashboard.',
          })
          setEditingBudget(null)
        }}
      />

      {/* Confirmação de exclusão de Meta */}
      <AlertDialog
        open={Boolean(deletingBudget)}
        onOpenChange={(open) => {
          if (!open) setDeletingBudget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta de gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não receberá mais alertas de limite para esta categoria. Os lançamentos
              continuarão existindo normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-fin-danger hover:bg-red-600"
              onClick={() => void confirmDeleteBudget()}
            >
              Excluir meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryModal
        category={editing}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={() => {
          toast({
            title: editing ? 'Categoria atualizada' : 'Categoria criada',
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
            <AlertDialogTitle>Excluir “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMetrics.count > 0
                ? `Esta categoria e suas subcategorias possuem ${deletingMetrics.count} lançamento(s), totalizando ${brl.format(deletingMetrics.total)} no mês. Para preservar o histórico financeiro, reclassifique esses lançamentos antes da exclusão.`
                : 'A categoria e todas as suas subcategorias serão removidas. Essa ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-fin-danger hover:bg-red-600"
              onClick={() => void confirmDelete()}
            >
              {deletingMetrics.count > 0 ? 'Entendi' : 'Excluir categoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CategoryCard({
  category,
  childrenCategories,
  transactions,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const allIds = [category.id, ...childrenCategories.map((item) => item.id)]
  const records = transactions.filter((transaction) => allIds.includes(transaction.category))
  const total = records.reduce((sum, transaction) => sum + transaction.amount, 0)

  return (
    <article className="fin-card overflow-hidden transition hover:shadow-[0_5px_14px_rgba(25,25,39,.07)]">
      <div className="flex items-center gap-3 p-5">
        <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-fin-text">{category.name}</h2>
            <span
              className={cn(
                'fin-badge',
                category.type === 'receita' ? 'fin-badge-success' : 'fin-badge-danger',
              )}
            >
              {category.type === 'receita' ? 'Receita' : 'Despesa'}
            </span>
          </div>
          <p className="mt-1 text-xs text-fin-muted">
            {records.length} lançamento{records.length === 1 ? '' : 's'} no mês
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-sm font-bold',
              category.type === 'receita' ? 'text-fin-success' : 'text-fin-text',
            )}
          >
            {brl.format(total)}
          </p>
          <p className="mt-1 text-[10px] text-fin-muted">total do mês</p>
        </div>
        <CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} />
      </div>

      {childrenCategories.length > 0 && (
        <div className="border-t border-fin-border bg-fin-surface/55 px-5 py-2">
          {childrenCategories.map((child) => (
            <SubcategoryRow
              key={child.id}
              category={child}
              transactions={transactions}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </article>
  )
}

function SubcategoryRow({
  category,
  transactions,
  onEdit,
  onDelete,
}: {
  category: Category
  transactions: Transaction[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  const records = transactions.filter((transaction) => transaction.category === category.id)
  const total = records.reduce((sum, transaction) => sum + transaction.amount, 0)

  return (
    <div className="flex items-center gap-3 border-b border-fin-border/70 py-3 last:border-0">
      <span className="ml-1 h-5 w-px bg-fin-border" />
      <span className="h-2 w-2 rounded-full" style={{ background: category.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{category.name}</p>
        <p className="mt-0.5 text-[10px] text-fin-muted">
          {records.length} lançamento{records.length === 1 ? '' : 's'}
        </p>
      </div>
      <span className="text-xs font-semibold">{brl.format(total)}</span>
      <CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function CategoryActions({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg p-2 text-fin-muted hover:bg-fin-surface">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-fin-border">
        <DropdownMenuItem onClick={() => onEdit(category)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-fin-danger" onClick={() => onDelete(category)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CategoriesEmptyState() {
  return (
    <div className="fin-card col-span-full flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
        <FolderOpen className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-fin-text">Nenhuma categoria encontrada</h2>
      <p className="mt-1 max-w-sm text-xs text-fin-muted">
        Tente buscar outro termo ou adicione uma nova categoria de receitas ou despesas.
      </p>
    </div>
  )
}
