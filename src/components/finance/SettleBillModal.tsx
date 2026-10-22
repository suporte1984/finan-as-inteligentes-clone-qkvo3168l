import { useEffect, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { todayInput } from '@/lib/format'
import { settleBill } from '@/services/bills'
import type { Bill } from '@/types/finance'

export function SettleBillModal({
  bill,
  open,
  onOpenChange,
  onSettled,
}: {
  bill: Bill | null
  open: boolean
  onOpenChange: (value: boolean) => void
  onSettled?: (bill: Bill) => void
}) {
  const { accounts } = useFinance()
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(todayInput())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAccount(bill?.account || accounts[0]?.id || '')
    setDate(todayInput())
    setMessage('')
  }, [open, bill, accounts])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!bill || !account) return setMessage('Selecione a conta usada na liquidação.')
    setSaving(true)
    try {
      const saved = await settleBill(bill, account, date)
      onSettled?.(saved)
      onOpenChange(false)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-fin-border sm:max-w-md dark:border-white/10 dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-fin-text dark:text-slate-100">
            {bill?.direction === 'receber' ? 'Registrar recebimento' : 'Marcar como pago'}
          </DialogTitle>
          <DialogDescription className="text-fin-muted dark:text-slate-400">
            Isso criará um lançamento e vinculará a liquidação à conta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">Conta</span>
            <select
              className="field"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            >
              <option value="">Selecione</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">Data</span>
            <input
              className="field"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-fin-danger dark:bg-rose-950/40 dark:border dark:border-rose-500/30 dark:text-rose-300">
              {message}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Liquidando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {bill?.direction === 'receber' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              </>
            )}
          </button>{' '}
        </form>
      </DialogContent>
    </Dialog>
  )
}
