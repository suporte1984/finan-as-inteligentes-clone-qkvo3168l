import { useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2, X } from 'lucide-react'

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
import { createBill, updateBill } from '@/services/bills'
import type { Bill, BillDirection, BillInput } from '@/types/finance'
import { CategoryTreeSelect } from '@/components/finance/CategoryTreeSelect'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  bill?: Bill | null
  defaultDirection?: BillDirection
  onSaved?: (bill: Bill) => void
}

export function BillModal({
  open,
  onOpenChange,
  bill,
  defaultDirection = 'pagar',
  onSaved,
}: Props) {
  const { accounts, categories } = useFinance()
  const [form, setForm] = useState<BillInput>({
    description: '',
    amount: 0,
    direction: defaultDirection,
    due_date: todayInput(),
    status: 'em_aberto',
    category: '',
    account: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setMessage('')
    setForm(
      bill
        ? {
            description: bill.description,
            amount: bill.amount,
            direction: bill.direction,
            due_date: toDateInput(bill.due_date),
            status: bill.status,
            category: bill.category || '',
            account: bill.account || '',
          }
        : {
            description: '',
            amount: 0,
            direction: defaultDirection,
            due_date: todayInput(),
            status: 'em_aberto',
            category: '',
            account: '',
          },
    )
  }, [open, bill, defaultDirection])

  function set<K extends keyof BillInput>(key: K, value: BillInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const local: FieldErrors = {}
    if (!form.description.trim()) local.description = 'Informe a descrição.'
    if (!form.amount || form.amount <= 0) local.amount = 'Informe um valor maior que zero.'
    if (!form.due_date) local.due_date = 'Informe o vencimento.'
    if (Object.keys(local).length) return setErrors(local)
    setSaving(true)
    try {
      const saved = bill ? await updateBill(bill.id, form) : await createBill(form)
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
      <DialogContent className="border-fin-border sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{bill ? 'Editar conta' : 'Nova conta a pagar ou receber'}</DialogTitle>
          <DialogDescription>
            Organize compromissos e não perca nenhum vencimento.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={submit}>
          <div className="grid grid-cols-2 rounded-xl bg-fin-surface p-1">
            <button
              type="button"
              onClick={() => {
                set('direction', 'pagar')
                set('category', '')
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold ${form.direction === 'pagar' ? 'bg-white text-fin-danger shadow-sm' : 'text-fin-muted'}`}
            >
              A pagar
            </button>
            <button
              type="button"
              onClick={() => {
                set('direction', 'receber')
                set('category', '')
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold ${form.direction === 'receber' ? 'bg-white text-fin-success shadow-sm' : 'text-fin-muted'}`}
            >
              A receber
            </button>
          </div>
          <Field label="Descrição" error={errors.description}>
            <input
              className="field"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="Ex.: Conta de energia"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor" error={errors.amount}>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount || ''}
                onChange={(event) => set('amount', Number(event.target.value))}
                placeholder="0,00"
              />
            </Field>
            <Field label="Vencimento" error={errors.due_date}>
              <input
                className="field"
                type="date"
                value={form.due_date}
                onChange={(event) => set('due_date', event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" error={errors.category}>
              <CategoryTreeSelect
                categories={categories}
                type={form.direction === 'pagar' ? 'despesa' : 'receita'}
                value={form.category || ''}
                onChange={(categoryId) => set('category', categoryId)}
                placeholder="Opcional (raiz ou subcategoria)..."
                error={Boolean(errors.category)}
              />
            </Field>
            <Field label="Conta prevista" error={errors.account}>
              <select
                className="field"
                value={form.account}
                onChange={(event) => set('account', event.target.value)}
              >
                <option value="">Opcional</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {bill && (
            <Field label="Status" error={errors.status}>
              <select
                className="field"
                value={form.status}
                onChange={(event) => set('status', event.target.value as BillInput['status'])}
              >
                <option value="em_aberto">Em aberto</option>
                <option value="atrasado">Atrasada</option>
                <option value="pago">Paga</option>
              </select>
            </Field>
          )}
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
                  {bill ? 'Salvar alterações' : 'Criar conta'}
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
