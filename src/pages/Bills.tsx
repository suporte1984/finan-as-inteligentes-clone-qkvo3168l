import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react'

import { BillModal } from '@/components/finance/BillModal'
import { SettleBillModal } from '@/components/finance/SettleBillModal'
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
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { brl, daysUntil, formatDate } from '@/lib/format'
import { deleteBill, listBills, sendBillsDueReminders } from '@/services/bills'
import type { Bill } from '@/types/finance'
import { cn } from '@/lib/utils'

type ViewStatus = 'em_aberto' | 'atrasadas' | 'pagas'

export default function BillsPage() {
  const [params, setParams] = useSearchParams()
  const { toast } = useToast()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [deleting, setDeleting] = useState<Bill | null>(null)
  const [settling, setSettling] = useState<Bill | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const rawStatus = params.get('status') || 'em_aberto'
  const status: ViewStatus =
    rawStatus === 'atrasado' || rawStatus === 'atrasadas'
      ? 'atrasadas'
      : rawStatus === 'pago' || rawStatus === 'pagas'
        ? 'pagas'
        : 'em_aberto'

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setBills(await listBills())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  useRealtime<Bill>('bills', () => {
    void reload()
  })

  const computedStatus = (bill: Bill): ViewStatus => {
    if (bill.status === 'pago') return 'pagas'
    if (bill.status === 'atrasado' || daysUntil(bill.due_date) < 0) return 'atrasadas'
    return 'em_aberto'
  }
  const counts = useMemo(
    () => ({
      em_aberto: bills.filter((bill) => computedStatus(bill) === 'em_aberto').length,
      atrasadas: bills.filter((bill) => computedStatus(bill) === 'atrasadas').length,
      pagas: bills.filter((bill) => computedStatus(bill) === 'pagas').length,
    }),
    [bills],
  )
  const visible = bills.filter((bill) => computedStatus(bill) === status)

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteBill(deleting.id)
      setBills((current) => current.filter((bill) => bill.id !== deleting.id))
      toast({ title: 'Conta excluída' })
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível excluir a conta' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleSendEmailReminders() {
    // Verificar se o usuário possui contas a vencer nos próximos 3 dias ou atrasadas
    const now = new Date()
    const todayYMD = now.toISOString().slice(0, 10)
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const maxDueYMD = in3Days.toISOString().slice(0, 10)

    const eligibleBills = bills.filter((b) => {
      if (b.status !== 'em_aberto' && b.status !== 'atrasado') return false
      const dueYMD = (b.due_date || '').slice(0, 10)
      if (!dueYMD) return false
      return dueYMD <= maxDueYMD
    })

    if (eligibleBills.length === 0) {
      toast({
        title: 'Nenhuma conta a vencer',
        description:
          'Você não possui contas em aberto ou atrasadas com vencimento nos próximos 3 dias.',
      })
      return
    }

    setSendingEmail(true)
    try {
      const result = await sendBillsDueReminders()
      if (result.emailsSent > 0) {
        toast({
          title: 'Lembrete enviado!',
          description: `Enviamos o resumo de ${result.billsCount || eligibleBills.length} conta(s) a vencer para o seu e-mail.`,
        })
      } else {
        toast({
          title: 'Nenhuma conta a vencer',
          description: 'Nenhuma conta a vencer nos próximos 3 dias encontrada.',
        })
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível enviar o e-mail',
        description: err?.message || 'Ocorreu um erro ao processar o envio de lembretes.',
      })
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="space-y-6 page-container">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <h1 className="page-title">Contas a pagar e receber</h1>
          <p className="page-subtitle">Acompanhe vencimentos, pagamentos e recebimentos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
          <button
            type="button"
            className="btn-secondary text-xs sm:text-sm"
            onClick={() => void handleSendEmailReminders()}
            disabled={sendingEmail}
            title="Enviar resumo por e-mail das contas a vencer nos próximos 3 dias"
          >
            {sendingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin text-fin-primary" />
            ) : (
              <Mail className="h-4 w-4 text-fin-primary" />
            )}
            {sendingEmail ? 'Enviando lembrete...' : 'Enviar lembretes por e-mail'}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nova conta
          </button>
        </div>
      </header>

      <div className="flex overflow-x-auto border-b border-fin-border animate-fade-up stagger-1">
        {(
          [
            ['em_aberto', 'Em aberto'],
            ['atrasadas', 'Atrasadas'],
            ['pagas', 'Pagas'],
          ] as [ViewStatus, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setParams({ status: value })}
            className={cn(
              'relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition',
              status === value
                ? 'text-fin-primary font-bold after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-fin-primary'
                : 'text-fin-muted hover:text-fin-text',
            )}
          >
            {label}
            <span
              className={cn(
                'ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold border',
                value === 'atrasadas' && counts.atrasadas > 0
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-slate-200/90 text-slate-800 border-slate-300',
              )}
            >
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      <section className="space-y-3 animate-fade-up stagger-2">
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="fin-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-48 rounded" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-4">
                <div className="skeleton h-4 w-28 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            </div>
          ))}
        {!loading &&
          visible.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              computedStatus={computedStatus(bill)}
              onEdit={() => {
                setEditing(bill)
                setModalOpen(true)
              }}
              onDelete={() => setDeleting(bill)}
              onSettle={() => setSettling(bill)}
            />
          ))}
        {!loading && visible.length === 0 && (
          <div className="fin-card grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-fin-surface text-fin-muted">
                {status === 'pagas' ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : status === 'atrasadas' ? (
                  <AlertCircle className="h-6 w-6" />
                ) : (
                  <CalendarClock className="h-6 w-6" />
                )}
              </span>
              <h2 className="section-title">
                {status === 'pagas'
                  ? 'Nenhuma conta paga'
                  : status === 'atrasadas'
                    ? 'Tudo em dia'
                    : 'Nenhuma conta em aberto'}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-fin-muted">
                {status === 'atrasadas'
                  ? 'Você não possui contas vencidas. Continue assim!'
                  : 'Crie uma nova conta para acompanhar seus compromissos.'}
              </p>
              {status !== 'atrasadas' && (
                <button className="btn-primary mt-5" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nova conta
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <BillModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        bill={editing}
        onSaved={(saved) => {
          setBills((current) =>
            editing
              ? current.map((bill) => (bill.id === saved.id ? saved : bill))
              : [...current, saved],
          )
          toast({
            title: editing ? 'Conta atualizada' : 'Conta criada',
            description: 'O vencimento já está sendo acompanhado.',
          })
          setEditing(null)
        }}
      />
      <SettleBillModal
        bill={settling}
        open={Boolean(settling)}
        onOpenChange={(open) => {
          if (!open) setSettling(null)
        }}
        onSettled={(saved) => {
          setBills((current) => current.map((bill) => (bill.id === saved.id ? saved : bill)))
          toast({
            title:
              saved.direction === 'receber' ? 'Recebimento registrado' : 'Pagamento registrado',
            description: 'O lançamento foi criado automaticamente.',
          })
          setSettling(null)
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
            <AlertDialogTitle>Excluir esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.description}” será removida da agenda de vencimentos. Um lançamento já
              criado por liquidação não será excluído.
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

function BillCard({
  bill,
  computedStatus,
  onEdit,
  onDelete,
  onSettle,
}: {
  bill: Bill
  computedStatus: ViewStatus
  onEdit: () => void
  onDelete: () => void
  onSettle: () => void
}) {
  const days = daysUntil(bill.due_date)
  const status = computedStatus
  const badge =
    status === 'pagas'
      ? { label: 'Paga', className: 'fin-badge-success' }
      : status === 'atrasadas'
        ? { label: `Atrasada ${Math.abs(days)}d`, className: 'fin-badge-danger' }
        : days <= 3
          ? {
              label: days === 0 ? 'Vence hoje' : `Vence em ${days}d`,
              className: 'fin-badge-warning',
            }
          : { label: 'Em aberto', className: 'fin-badge-neutral' }
  return (
    <article className="fin-card fin-card-interactive group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
          bill.direction === 'receber'
            ? 'fin-badge-success !border-0'
            : 'fin-badge-danger !border-0'
        }`}
      >
        {bill.direction === 'receber' ? (
          <ArrowDownLeft className="h-5 w-5" />
        ) : (
          <ArrowUpRight className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-fin-text sm:text-[15px]">
            {bill.description}
          </h2>
          <span className={`fin-badge ${badge.className}`}>{badge.label}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fin-muted">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(bill.due_date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            {bill.expand?.category?.name || 'Sem categoria'}
          </span>
          {bill.expand?.account?.name && <span>{bill.expand.account.name}</span>}
        </div>
      </div>
      <div className="sm:text-right">
        <p
          className={`text-lg font-extrabold ${bill.direction === 'receber' ? 'text-emerald-800' : 'text-fin-text'}`}
        >
          {bill.direction === 'receber' ? '+' : ''}
          {brl.format(bill.amount)}
        </p>
        <span
          className={cn(
            'mt-1 inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border',
            bill.direction === 'receber'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-700 border-slate-200',
          )}
        >
          {bill.direction === 'receber' ? 'A receber' : 'A pagar'}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:ml-2">
        {status !== 'pagas' && (
          <button
            onClick={onSettle}
            className="btn-primary !min-h-[36px] flex-1 px-3.5 py-1.5 text-xs sm:flex-none"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {bill.direction === 'receber' ? 'Registrar recebimento' : 'Marcar como pago'}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg border border-fin-border p-2.5 text-fin-muted hover:bg-fin-surface">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-fin-border">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-fin-danger">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}
