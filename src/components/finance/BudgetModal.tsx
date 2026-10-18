import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { getCategoryDescendantIds } from '@/lib/categories'
import { brl, currentMonth, monthBounds } from '@/lib/format'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { createBudget, updateBudget } from '@/services/budgets'
import { listTransactions } from '@/services/transactions'
import type { Budget, BudgetInput, Transaction } from '@/types/finance'

interface BudgetModalProps {
  budget?: Budget | null
  existingBudgets: Budget[]
  open: boolean
  onOpenChange: (value: boolean) => void
  onSaved?: (budget: Budget) => void
}

export function BudgetModal({
  budget,
  existingBudgets,
  open,
  onOpenChange,
  onSaved,
}: BudgetModalProps) {
  const { categories } = useFinance()
  const [form, setForm] = useState<BudgetInput>({
    category: '',
    monthly_limit: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [limitStr, setLimitStr] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // Apenas categorias de despesa são elegíveis para meta de gastos
  const expenseCategories = useMemo(() => {
    return categories.filter((cat) => cat.type === 'despesa')
  }, [categories])

  // Organizar opções hierárquicas: Raiz com indentação de subcategorias
  const categoryOptions = useMemo(() => {
    const roots = expenseCategories.filter((cat) => !cat.parent)
    const options: { id: string; label: string; isChild: boolean; disabled: boolean }[] = []

    // IDs de categorias que já possuem meta (exceto a que está sendo editada)
    const usedCategoryIds = new Set(
      existingBudgets.filter((b) => !budget || b.id !== budget.id).map((b) => b.category),
    )

    roots.forEach((root) => {
      options.push({
        id: root.id,
        label: root.name,
        isChild: false,
        disabled: usedCategoryIds.has(root.id),
      })
      const children = expenseCategories.filter((cat) => cat.parent === root.id)
      children.forEach((child) => {
        options.push({
          id: child.id,
          label: `— ${child.name} (${root.name})`,
          isChild: true,
          disabled: usedCategoryIds.has(child.id),
        })
      })
    })

    return options
  }, [expenseCategories, existingBudgets, budget])

  useEffect(() => {
    if (open) {
      setMessage('')
      if (budget) {
        setForm({
          category: budget.category,
          monthly_limit: budget.monthly_limit,
        })
        setLimitStr(String(budget.monthly_limit))
      } else {
        // Encontrar a primeira categoria disponível
        const firstAvailable = categoryOptions.find((opt) => !opt.disabled)?.id || ''
        setForm({
          category: firstAvailable,
          monthly_limit: 0,
        })
        setLimitStr('')
      }

      // Carregar transações dos últimos 3 meses para cálculo de sugestão automática
      setLoadingTransactions(true)
      const thisMonth = currentMonth()
      const [year, monthNum] = thisMonth.split('-').map(Number)
      // Limite inferior: 3 meses atrás (dia 1)
      const threeMonthsAgoDate = new Date(Date.UTC(year, monthNum - 1 - 3, 1))
      const startFilter = threeMonthsAgoDate.toISOString().replace('T', ' ')
      // Limite superior: início do próximo mês
      const { next: endFilter } = monthBounds(thisMonth)

      listTransactions(`type = 'despesa' && date >= '${startFilter}' && date < '${endFilter}'`)
        .then((records) => setRecentTransactions(records))
        .catch(() => setRecentTransactions([]))
        .finally(() => setLoadingTransactions(false))
    }
  }, [open, budget, categoryOptions])

  // Cálculo da sugestão com base nos últimos 3 meses:
  // Considera a consolidação de subcategorias se a categoria selecionada for raiz,
  // ou os descendentes diretos. Divide a soma pelo número de meses (3)
  const suggestedLimit = useMemo(() => {
    if (!form.category || recentTransactions.length === 0) return null

    const targetCategoryIds = getCategoryDescendantIds(form.category, categories)
    const matchingExpenses = recentTransactions.filter(
      (t) => t.type === 'despesa' && targetCategoryIds.includes(t.category),
    )

    const totalSpent = matchingExpenses.reduce((sum, t) => sum + t.amount, 0)
    if (totalSpent <= 0) return null

    // Média dos 3 meses
    const average = totalSpent / 3
    // Arredondar para duas casas decimais
    return Math.round(average * 100) / 100
  }, [form.category, recentTransactions, categories])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.category) {
      return setMessage('Selecione uma categoria de despesa.')
    }
    const val = parseFloat(limitStr.replace(',', '.'))
    if (isNaN(val) || val <= 0) {
      return setMessage('Informe um limite mensal válido e maior que zero.')
    }

    // Validação extra anti-duplicação
    const duplicate = existingBudgets.find(
      (b) => b.category === form.category && (!budget || b.id !== budget.id),
    )
    if (duplicate) {
      return setMessage('Já existe uma meta definida para esta categoria.')
    }

    setSaving(true)
    try {
      const payload: BudgetInput = {
        category: form.category,
        monthly_limit: val,
      }
      const saved = budget ? await updateBudget(budget.id, payload) : await createBudget(payload)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-fin-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar meta de gasto' : 'Nova meta de gasto'}</DialogTitle>
          <DialogDescription>
            Defina o limite mensal para acompanhar seus gastos e receber alertas preventivos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Categoria</span>
            <select
              className="field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={Boolean(budget)} // Ao editar, bloqueia trocar de categoria para manter integridade
            >
              <option value="" disabled>
                Selecione uma categoria...
              </option>
              {categoryOptions.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                  {opt.label} {opt.disabled ? '(Já possui meta)' : ''}
                </option>
              ))}
            </select>
            {budget && (
              <p className="text-[11px] text-fin-muted">
                A categoria não pode ser alterada na edição. Para mudar de categoria, exclua e crie
                uma nova.
              </p>
            )}
          </label>

          <div className="space-y-1.5">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium">Limite mensal (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="field"
                placeholder="Ex.: 1200,00"
                value={limitStr}
                onChange={(e) => setLimitStr(e.target.value)}
                autoFocus={!budget}
              />
            </label>

            {/* Sugestão automática baseada nos últimos 3 meses */}
            {suggestedLimit !== null && suggestedLimit > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/70 p-2.5 text-xs text-fin-text animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-100 text-fin-primary shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="text-fin-muted">Sugestão com base nos últimos 3 meses:</span>{' '}
                    <strong className="font-semibold text-fin-primary">
                      {brl.format(suggestedLimit)}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLimitStr(suggestedLimit.toFixed(2))}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-fin-primary shadow-xs border border-indigo-200 hover:bg-indigo-50 transition"
                >
                  Usar sugestão
                </button>
              </div>
            )}
            {loadingTransactions && (
              <p className="text-[11px] text-fin-muted flex items-center gap-1.5 pt-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculando média dos últimos 3 meses...
              </p>
            )}
          </div>

          {message && <p className="rounded-lg bg-red-50 p-3 text-sm text-fin-danger">{message}</p>}

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Salvando...' : budget ? 'Salvar alterações' : 'Criar meta'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
