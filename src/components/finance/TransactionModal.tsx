import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { CalendarDays, Check, FileText, Loader2, UploadCloud, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { todayInput, toDateInput } from '@/lib/format'
import { createTransaction, updateTransaction } from '@/services/transactions'
import type { Transaction, TransactionInput, TransactionType } from '@/types/finance'
import { CategoryTreeSelect } from '@/components/finance/CategoryTreeSelect'
import { cn } from '@/lib/utils'

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultType?: TransactionType
  onSaved?: (transaction: Transaction) => void
}

const initialInput = (type: TransactionType): TransactionInput => ({
  type,
  description: '',
  amount: 0,
  date: todayInput(),
  category: '',
  account: '',
  notes: '',
  attachment: null,
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
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      })
    } else {
      setForm(initialInput(defaultType))
    }
  }, [open, transaction, defaultType])

  function set<K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
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
    if (!form.amount || form.amount <= 0) localErrors.amount = 'Informe um valor maior que zero.'
    if (!form.date) localErrors.date = 'Informe a data.'
    if (!form.category) localErrors.category = 'Selecione uma categoria.'
    if (!form.account) localErrors.account = 'Selecione uma conta.'
    if (Object.keys(localErrors).length) return setErrors(localErrors)

    setSaving(true)
    setMessage('')
    try {
      const saved = transaction
        ? await updateTransaction(transaction.id, form)
        : await createTransaction(form)
      onSaved?.(saved)
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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-fin-border bg-white sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
          <DialogDescription>
            Registre uma entrada ou saída e mantenha seu saldo atualizado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 rounded-xl bg-fin-surface p-1">
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
                      ? 'bg-white text-fin-success shadow-sm'
                      : 'bg-white text-fin-danger shadow-sm'
                    : 'text-fin-muted',
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
                  value={form.amount || ''}
                  onChange={(event) => set('amount', Number(event.target.value))}
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
                  onChange={(event) => set('date', event.target.value)}
                />
              </div>
            </Field>
          </div>

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
                  ? 'border-fin-primary bg-indigo-50'
                  : 'border-fin-border bg-fin-surface hover:border-fin-primary/50',
              )}
            >
              {form.attachment ? (
                <FileText className="mb-2 h-6 w-6 text-fin-primary" />
              ) : (
                <UploadCloud className="mb-2 h-6 w-6 text-fin-muted" />
              )}
              <span className="text-sm font-medium text-fin-text">
                {form.attachment?.name || 'Clique ou arraste um arquivo'}
              </span>
              <span className="mt-1 text-xs text-fin-muted">PDF, PNG ou JPEG, até 5 MB</span>
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
      <span className="text-[13px] font-medium text-fin-text">{label}</span>
      {children}
      {error && <span className="block text-xs text-fin-danger">{error}</span>}
    </label>
  )
}
