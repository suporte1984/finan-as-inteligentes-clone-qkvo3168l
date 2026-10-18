import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Loader2, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { toDateInput, todayInput } from '@/lib/format'
import { createRecurringTransaction, updateRecurringTransaction } from '@/services/recurring'
import type {
  RecurringFrequency,
  RecurringTransaction,
  RecurringTransactionInput,
  TransactionType,
} from '@/types/finance'
import { CategoryTreeSelect } from '@/components/finance/CategoryTreeSelect'
import { cn } from '@/lib/utils'

interface RecurringModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurring?: RecurringTransaction | null
  defaultType?: TransactionType
  onSaved?: (saved: RecurringTransaction) => void
}

const initialInput = (type: TransactionType = 'despesa'): RecurringTransactionInput => ({
  description: '',
  amount: 0,
  type,
  frequency: 'mensal',
  day_of_month: 5,
  start_date: todayInput(),
  end_date: '',
  category: '',
  account: '',
  active: true,
})

export function RecurringModal({
  open,
  onOpenChange,
  recurring,
  defaultType = 'despesa',
  onSaved,
}: RecurringModalProps) {
  const { accounts, categories } = useFinance()
  const [form, setForm] = useState<RecurringTransactionInput>(() => initialInput(defaultType))
  const [amountStr, setAmountStr] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setMessage('')
    if (recurring) {
      setForm({
        description: recurring.description,
        amount: recurring.amount,
        type: recurring.type,
        frequency: recurring.frequency,
        day_of_month: recurring.day_of_month || 1,
        start_date: toDateInput(recurring.start_date),
        end_date: recurring.end_date ? toDateInput(recurring.end_date) : '',
        category: recurring.category,
        account: recurring.account,
        active: recurring.active,
      })
      setAmountStr(String(recurring.amount))
    } else {
      setForm(initialInput(defaultType))
      setAmountStr('')
    }
  }, [open, recurring, defaultType])

  function set<K extends keyof RecurringTransactionInput>(
    key: K,
    value: RecurringTransactionInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const localErrors: FieldErrors = {}
    if (!form.description.trim()) localErrors.description = 'Informe a descrição.'
    const numAmount = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) localErrors.amount = 'Informe um valor maior que zero.'
    if (!form.start_date) localErrors.start_date = 'Informe a data de início.'
    if (!form.account) localErrors.account = 'Selecione uma conta.'
    if (!form.category) localErrors.category = 'Selecione uma categoria.'

    if (form.frequency === 'mensal' || form.frequency === 'anual') {
      const day = Number(form.day_of_month)
      if (isNaN(day) || day < 1 || day > 31) {
        localErrors.day_of_month = 'Informe um dia entre 1 e 31.'
      }
    }

    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      localErrors.end_date = 'A data de término não pode ser anterior ao início.'
    }

    if (Object.keys(localErrors).length) {
      setErrors(localErrors)
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const payload: RecurringTransactionInput = {
        ...form,
        amount: numAmount,
        day_of_month:
          form.frequency === 'mensal' || form.frequency === 'anual' ? Number(form.day_of_month) : 1,
      }
      const saved = recurring
        ? await updateRecurringTransaction(recurring.id, payload)
        : await createRecurringTransaction(payload)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      setMessage(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-fin-border sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>{recurring ? 'Editar recorrência' : 'Nova recorrência'}</DialogTitle>
          <DialogDescription>
            Configure uma transação automática que o sistema lançará todo mês ou período programado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          {/* Alternador Receita / Despesa */}
          <div className="grid grid-cols-2 rounded-xl bg-fin-surface p-1">
            {(['receita', 'despesa'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  set('type', t)
                  set('category', '')
                }}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition',
                  form.type === t
                    ? t === 'receita'
                      ? 'bg-white text-fin-success shadow-sm'
                      : 'bg-white text-fin-danger shadow-sm'
                    : 'text-fin-muted',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <Field label="Descrição" error={errors.description}>
            <input
              className="field"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex.: Aluguel, Netflix, Salário mensal..."
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor" error={errors.amount}>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-fin-muted">R$</span>
                <input
                  className="field pl-10"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value)
                    set('amount', parseFloat(e.target.value) || 0)
                  }}
                  placeholder="0,00"
                />
              </div>
            </Field>

            <Field label="Frequência" error={errors.frequency}>
              <select
                className="field"
                value={form.frequency}
                onChange={(e) => set('frequency', e.target.value as RecurringFrequency)}
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          </div>

          {(form.frequency === 'mensal' || form.frequency === 'anual') && (
            <Field label="Dia do mês para vencimento / lançamento" error={errors.day_of_month}>
              <input
                type="number"
                min="1"
                max="31"
                className="field"
                value={form.day_of_month || 1}
                onChange={(e) => set('day_of_month', parseInt(e.target.value, 10) || 1)}
                placeholder="Ex.: 5"
              />
              <span className="text-[11px] text-fin-muted">
                Em meses com menos dias, o lançamento ocorrerá no último dia útil do mês.
              </span>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de início" error={errors.start_date}>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                <input
                  className="field pl-10"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                />
              </div>
            </Field>

            <Field label="Data de término (opcional)" error={errors.end_date}>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                <input
                  className="field pl-10"
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => set('end_date', e.target.value)}
                  placeholder="Sem data final"
                />
              </div>
            </Field>
          </div>

          <Field label="Categoria (raiz ou subcategoria)" error={errors.category}>
            <CategoryTreeSelect
              categories={categories}
              type={form.type}
              value={form.category}
              onChange={(categoryId) => set('category', categoryId)}
              placeholder={`Selecione a categoria de ${form.type}...`}
              error={Boolean(errors.category)}
            />
          </Field>

          <Field label="Conta de destino / débito" error={errors.account}>
            <select
              className="field"
              value={form.account}
              onChange={(e) => set('account', e.target.value)}
            >
              <option value="">Selecione a conta...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-3 rounded-xl border border-fin-border bg-fin-surface/40 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-fin-border text-fin-primary focus:ring-fin-primary"
              checked={form.active ?? true}
              onChange={(e) => set('active', e.target.checked)}
            />
            <div>
              <span className="text-sm font-semibold text-fin-text">Recorrência ativa</span>
              <p className="text-xs text-fin-muted">
                O cron diário gerará lançamentos automaticamente enquanto esta opção estiver
                marcada.
              </p>
            </div>
          </label>

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-fin-danger">{message}</p>
          )}

          <div className="flex justify-end gap-3 border-t border-fin-border pt-4">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {recurring ? 'Salvar alterações' : 'Criar recorrência'}
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-fin-text">{label}</span>
      {children}
      {error && <span className="block text-xs text-fin-danger">{error}</span>}
    </label>
  )
}
