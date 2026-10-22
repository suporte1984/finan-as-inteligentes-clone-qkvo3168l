import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  CalendarClock,
  CalendarDays,
  Check,
  FileText,
  Info,
  Layers,
  Loader2,
  Repeat,
  UploadCloud,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { brl, todayInput, toDateInput } from '@/lib/format'
import {
  createTransactionWithRecurrence,
  updateTransaction,
  type CreateTransactionResult,
} from '@/services/transactions'
import type {
  RecurrencePeriodType,
  RecurringFrequency,
  Transaction,
  TransactionInput,
  TransactionRecurrenceConfig,
  TransactionType,
} from '@/types/finance'
import { CategoryTreeSelect } from '@/components/finance/CategoryTreeSelect'
import { cn } from '@/lib/utils'

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultType?: TransactionType
  onSaved?: (transaction: Transaction, result?: CreateTransactionResult) => void
}

const initialRecurrence = (): TransactionRecurrenceConfig => ({
  enabled: false,
  mode: 'frequencia',
  frequency: 'mensal',
  day_of_month: 5,
  installmentsCount: 2,
  installmentAmountType: 'total',
  endDate: '',
})

const initialInput = (type: TransactionType): TransactionInput => ({
  type,
  description: '',
  amount: 0,
  date: todayInput(),
  category: '',
  account: '',
  notes: '',
  attachment: null,
  recurrence: initialRecurrence(),
})

export function TransactionModal({
  open,
  onOpenChange,
  transaction,
  defaultType = 'despesa',
  onSaved,
}: TransactionModalProps) {
  const { accounts, categories } = useFinance()
  const [form, setForm] = useState<TransactionInput>(() => initialInput(defaultType))
  const [amountStr, setAmountStr] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEditing = Boolean(transaction)
  const isRecurring = Boolean(!isEditing && form.recurrence?.enabled)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setMessage('')
    if (transaction) {
      setForm({
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
        date: toDateInput(transaction.date),
        category: transaction.category,
        account: transaction.account,
        notes: transaction.notes || '',
        attachment: null,
        recurrence: initialRecurrence(),
      })
      setAmountStr(String(transaction.amount))
    } else {
      const today = todayInput()
      const day = parseInt(today.slice(8, 10), 10) || 5
      setForm({
        ...initialInput(defaultType),
        date: today,
        recurrence: {
          ...initialRecurrence(),
          day_of_month: day,
        },
      })
      setAmountStr('')
    }
  }, [open, transaction, defaultType])

  function set<K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  function setRecurrence<K extends keyof TransactionRecurrenceConfig>(
    key: K,
    value: TransactionRecurrenceConfig[K],
  ) {
    setForm((current) => ({
      ...current,
      recurrence: {
        ...(current.recurrence || initialRecurrence()),
        [key]: value,
      },
    }))
  }

  function validateFile(file: File) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      setErrors((current) => ({ ...current, attachment: 'Use um arquivo PDF, PNG ou JPEG.' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, attachment: 'O comprovante deve ter no máximo 5 MB.' }))
      return
    }
    set('attachment', file)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) validateFile(file)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const localErrors: FieldErrors = {}
    if (!form.description.trim()) localErrors.description = 'Informe uma descrição.'
    const numAmount = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) localErrors.amount = 'Informe um valor maior que zero.'
    if (!form.date) localErrors.date = 'Informe a data.'
    if (!form.category) localErrors.category = 'Selecione uma categoria.'
    if (!form.account) localErrors.account = 'Selecione uma conta.'

    if (isRecurring && form.recurrence) {
      if (form.recurrence.mode === 'parcelas') {
        const inst = Number(form.recurrence.installmentsCount)
        if (isNaN(inst) || inst < 2 || inst > 120) {
          localErrors.installmentsCount = 'Informe entre 2 e 120 parcelas.'
        }
      } else {
        if (form.recurrence.frequency === 'mensal' || form.recurrence.frequency === 'anual') {
          const dom = Number(form.recurrence.day_of_month)
          if (isNaN(dom) || dom < 1 || dom > 31) {
            localErrors.day_of_month = 'Informe um dia entre 1 e 31.'
          }
        }
        if (form.recurrence.endDate && form.recurrence.endDate < form.date) {
          localErrors.endDate = 'Data de término deve ser igual ou posterior à data de início.'
        }
      }
    }

    if (Object.keys(localErrors).length) return setErrors(localErrors)

    setSaving(true)
    setMessage('')
    try {
      const payload: TransactionInput = {
        ...form,
        amount: numAmount,
      }

      if (transaction) {
        const saved = await updateTransaction(transaction.id, payload)
        onSaved?.(saved)
      } else {
        const result = await createTransactionWithRecurrence(payload)
        onSaved?.(result.transaction, result)
      }
      onOpenChange(false)
    } catch (error) {
      setErrors(extractFieldErrors(error))
      setMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-fin-border bg-white sm:max-w-[620px] dark:border-white/10 dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-fin-text dark:text-slate-100">
            {transaction ? 'Editar lançamento' : 'Novo lançamento'}
          </DialogTitle>
          <DialogDescription className="text-fin-muted dark:text-slate-300">
            Registre uma entrada ou saída e mantenha seu saldo atualizado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 rounded-xl bg-fin-surface p-1 dark:bg-[#131a29]/90 dark:border dark:border-white/10">
            {(['receita', 'despesa'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  set('type', type)
                  set('category', '')
                }}
                className={cn(
                  'rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition',
                  form.type === type
                    ? type === 'receita'
                      ? 'bg-white text-fin-success shadow-sm dark:bg-[#1f293d] dark:text-emerald-400'
                      : 'bg-white text-fin-danger shadow-sm dark:bg-[#1f293d] dark:text-rose-400'
                    : 'text-fin-muted dark:text-slate-400 hover:text-fin-text dark:hover:text-slate-200',
                )}
              >
                {type}
              </button>
            ))}
          </div>

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
                  onChange={(event) => {
                    setAmountStr(event.target.value)
                    set('amount', parseFloat(event.target.value) || 0)
                  }}
                  placeholder="0,00"
                />
              </div>
            </Field>
            <Field label="Data" error={errors.date}>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                <input
                  className="field pl-10"
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    const newDate = event.target.value
                    set('date', newDate)
                    if (newDate && !transaction) {
                      const day = parseInt(newDate.slice(8, 10), 10)
                      if (day && day >= 1 && day <= 31) {
                        setRecurrence('day_of_month', day)
                      }
                    }
                  }}
                />
              </div>
            </Field>
          </div>

          {/* Seção de Recorrência (disponível na criação do lançamento) */}
          {!isEditing && (
            <div className="rounded-2xl border border-fin-border bg-gradient-to-b from-indigo-50/40 via-white to-white p-4 space-y-4 dark:border-white/10 dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-lg transition-colors',
                      form.recurrence?.enabled
                        ? 'bg-fin-primary text-white shadow-xs'
                        : 'bg-fin-surface text-fin-muted dark:bg-white/5 dark:text-slate-400',
                    )}
                  >
                    <Repeat className="h-4 w-4" />
                  </div>
                  <div>
                    <label
                      htmlFor="tx-recurring-toggle"
                      className="text-sm font-semibold text-fin-text cursor-pointer select-none dark:text-slate-100"
                    >
                      Lançamento recorrente
                    </label>
                    <p className="text-xs text-fin-muted dark:text-slate-400">
                      Cadastre uma regra automática ou parcele este lançamento.
                    </p>
                  </div>
                </div>

                {/* Switch / Toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="tx-recurring-toggle"
                    type="checkbox"
                    className="sr-only peer"
                    checked={form.recurrence?.enabled ?? false}
                    onChange={(e) => setRecurrence('enabled', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fin-primary dark:bg-slate-700 dark:after:border-slate-600" />
                </label>
              </div>

              {form.recurrence?.enabled && (
                <div className="space-y-4 pt-3 border-t border-fin-border/70 animate-fade-in dark:border-white/10">
                  {/* Seleção do Modo: Período/Frequência OU Quantidade de Parcelas */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-fin-surface p-1 dark:bg-[#131a29]/90 dark:border dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setRecurrence('mode', 'frequencia')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                        form.recurrence?.mode === 'frequencia'
                          ? 'bg-white text-fin-primary shadow-xs dark:bg-[#1f293d] dark:text-indigo-300'
                          : 'text-fin-muted hover:text-fin-text dark:text-slate-400 dark:hover:text-slate-200',
                      )}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Período / Frequência
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecurrence('mode', 'parcelas')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                        form.recurrence?.mode === 'parcelas'
                          ? 'bg-white text-fin-primary shadow-xs dark:bg-[#1f293d] dark:text-indigo-300'
                          : 'text-fin-muted hover:text-fin-text dark:text-slate-400 dark:hover:text-slate-200',
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Dividir em Parcelas
                    </button>
                  </div>

                  {/* Modo 1: Período / Frequência contínua */}
                  {form.recurrence?.mode === 'frequencia' && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Frequência" error={errors.frequency}>
                          <select
                            className="field py-1.5 text-sm"
                            value={form.recurrence?.frequency || 'mensal'}
                            onChange={(e) =>
                              setRecurrence('frequency', e.target.value as RecurringFrequency)
                            }
                          >
                            <option value="mensal">Mensal (todo mês)</option>
                            <option value="semanal">Semanal (a cada 7 dias)</option>
                            <option value="quinzenal">Quinzenal (a cada 14 dias)</option>
                            <option value="anual">Anual (uma vez por ano)</option>
                          </select>
                        </Field>

                        {(form.recurrence?.frequency === 'mensal' ||
                          form.recurrence?.frequency === 'anual') && (
                          <Field label="Dia do mês (vencimento)" error={errors.day_of_month}>
                            <input
                              className="field py-1.5 text-sm"
                              type="number"
                              min="1"
                              max="31"
                              value={form.recurrence?.day_of_month || 1}
                              onChange={(e) =>
                                setRecurrence('day_of_month', parseInt(e.target.value, 10) || 1)
                              }
                              placeholder="Ex: 5"
                            />
                          </Field>
                        )}
                      </div>

                      <Field label="Data de término (opcional)" error={errors.endDate}>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                          <input
                            className="field pl-10 py-1.5 text-sm"
                            type="date"
                            value={form.recurrence?.endDate || ''}
                            onChange={(e) => setRecurrence('endDate', e.target.value)}
                            placeholder="Deixe em branco para recorrência contínua"
                          />
                        </div>
                        <span className="text-[11px] text-fin-muted">
                          Deixe em branco para repetir indeterminadamente até pausar.
                        </span>
                      </Field>
                    </div>
                  )}

                  {/* Modo 2: Parcelas */}
                  {form.recurrence?.mode === 'parcelas' && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Quantidade de parcelas" error={errors.installmentsCount}>
                          <select
                            className="field py-1.5 text-sm"
                            value={form.recurrence?.installmentsCount || 2}
                            onChange={(e) =>
                              setRecurrence('installmentsCount', parseInt(e.target.value, 10) || 2)
                            }
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48, 60].map((n) => (
                              <option key={n} value={n}>
                                {n}x parcelas
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field
                          label="O valor informado acima é:"
                          error={errors.installmentAmountType}
                        >
                          <select
                            className="field py-1.5 text-sm"
                            value={form.recurrence?.installmentAmountType || 'total'}
                            onChange={(e) =>
                              setRecurrence(
                                'installmentAmountType',
                                e.target.value as 'total' | 'parcela',
                              )
                            }
                          >
                            <option value="total">Valor Total da Compra / Entrada</option>
                            <option value="parcela">Valor de Cada Parcela</option>
                          </select>
                        </Field>
                      </div>

                      {/* Resumo explicativo do cálculo da parcela */}
                      {(() => {
                        const count = form.recurrence?.installmentsCount || 2
                        const currentVal = parseFloat(amountStr.replace(',', '.')) || 0
                        const isTotal = form.recurrence?.installmentAmountType !== 'parcela'
                        const installmentVal = isTotal ? currentVal / count : currentVal
                        const totalVal = isTotal ? currentVal : currentVal * count

                        return (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-950 dark:border-indigo-500/25 dark:bg-indigo-950/40 dark:text-indigo-200">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-fin-primary dark:text-indigo-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-semibold text-fin-primary dark:text-indigo-300">
                                  Resumo das {count} parcelas:
                                </p>
                                <p>
                                  Serão{' '}
                                  <strong className="dark:text-white">
                                    {count}x de {brl.format(installmentVal)}
                                  </strong>{' '}
                                  (Total:{' '}
                                  <strong className="dark:text-white">
                                    {brl.format(totalVal)}
                                  </strong>
                                  ).
                                </p>
                                <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300/80">
                                  A 1ª parcela será lançada hoje e a regra com as próximas{' '}
                                  {count - 1} parcelas mensais será cadastrada automaticamente em{' '}
                                  <strong className="dark:text-white">Recorrentes</strong>.
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div className="rounded-lg bg-emerald-50/60 p-2.5 text-xs text-emerald-900 flex items-center gap-2 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border dark:border-emerald-500/20">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Ao salvar, este lançamento aparecerá automaticamente na página{' '}
                      <strong className="dark:text-white">Recorrentes</strong> com a frequência e
                      vencimentos definidos.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Field label="Descrição" error={errors.description}>
            <input
              className="field"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="Ex.: Compra no supermercado"
              autoFocus
            />
          </Field>

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

          <Field label="Conta" error={errors.account}>
            <select
              className="field"
              value={form.account}
              onChange={(event) => set('account', event.target.value)}
            >
              <option value="">Selecione a conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notas" error={errors.notes}>
            <textarea
              className="field min-h-20 resize-none"
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="Informações adicionais (opcional)"
            />
          </Field>

          <Field label="Comprovante" error={errors.attachment}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex w-full flex-col items-center rounded-xl border border-dashed px-5 py-5 text-center transition',
                dragging
                  ? 'border-fin-primary bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-400'
                  : 'border-fin-border bg-fin-surface hover:border-fin-primary/50 dark:border-white/10 dark:bg-[#131a29]/80 dark:hover:border-indigo-400/50',
              )}
            >
              {form.attachment ? (
                <FileText className="mb-2 h-6 w-6 text-fin-primary dark:text-indigo-400" />
              ) : (
                <UploadCloud className="mb-2 h-6 w-6 text-fin-muted dark:text-slate-400" />
              )}
              <span className="text-sm font-medium text-fin-text dark:text-slate-200">
                {form.attachment?.name || 'Clique ou arraste um arquivo'}
              </span>
              <span className="mt-1 text-xs text-fin-muted dark:text-slate-400">
                PDF, PNG ou JPEG, até 5 MB
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) validateFile(file)
              }}
            />
          </Field>

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-fin-danger dark:bg-rose-950/40 dark:border dark:border-rose-500/30 dark:text-rose-300">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-fin-border pt-4 dark:border-white/10">
            <button
              type="button"
              className="btn-secondary dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
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
                  {transaction ? 'Salvar alterações' : 'Criar lançamento'}
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
      <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">{label}</span>
      {children}
      {error && <span className="block text-xs text-fin-danger dark:text-rose-400">{error}</span>}
    </label>
  )
}
