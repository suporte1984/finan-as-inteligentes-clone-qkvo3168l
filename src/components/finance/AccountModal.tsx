import { useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { createAccount, updateAccount } from '@/services/accounts'
import type { Account, AccountInput, AccountType } from '@/types/finance'

const colors = ['#5B5FEF', '#34C759', '#FFB020', '#F4526B', '#8B5CF6', '#06B6D4', '#F97316']

export function AccountModal({
  account,
  open,
  onOpenChange,
  onSaved,
}: {
  account?: Account | null
  open: boolean
  onOpenChange: (value: boolean) => void
  onSaved?: (account: Account) => void
}) {
  const { refreshAccounts } = useFinance()
  const [form, setForm] = useState<AccountInput>({
    name: '',
    type: 'banco',
    initial_balance: 0,
    color: colors[0],
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setMessage('')
      setForm(
        account
          ? {
              name: account.name,
              type: account.type,
              initial_balance: account.initial_balance,
              color: account.color,
            }
          : { name: '', type: 'banco', initial_balance: 0, color: colors[0] },
      )
    }
  }, [open, account])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return setMessage('Informe o nome da conta.')
    setSaving(true)
    try {
      const saved = account ? await updateAccount(account.id, form) : await createAccount(form)
      await refreshAccounts()
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
      <DialogContent className="border-fin-border bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar conta financeira' : 'Nova conta financeira'}</DialogTitle>
          <DialogDescription>
            Adicione bancos, carteiras e cartões ao saldo consolidado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Nome</span>
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: Conta principal"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium">Tipo</span>
              <select
                className="field"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
              >
                <option value="banco">Banco</option>
                <option value="carteira">Carteira</option>
                <option value="cartao">Cartão</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium">Saldo inicial</span>
              <input
                className="field"
                type="number"
                step="0.01"
                value={form.initial_balance}
                onChange={(event) =>
                  setForm({ ...form, initial_balance: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <div>
            <span className="text-[13px] font-medium">Cor</span>
            <div className="mt-2 flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className="grid h-8 w-8 place-items-center rounded-full"
                  style={{ background: color }}
                >
                  {form.color === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          {message && <p className="rounded-lg bg-red-50 p-3 text-sm text-fin-danger">{message}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar conta'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
