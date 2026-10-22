import pb from '@/lib/pocketbase/client'
import { escapeFilter } from '@/lib/format'
import { createRecurringTransaction } from '@/services/recurring'
import type { RecurringTransaction, Transaction, TransactionInput } from '@/types/finance'

export interface CreateTransactionResult {
  transaction: Transaction
  recurringTransaction?: RecurringTransaction
  futureTransactionsCreated?: number
}

export function listTransactions(filter = '', sort = '-date') {
  return pb.collection<Transaction>('transactions').getFullList({
    filter: filter || undefined,
    sort,
    expand: 'category,account',
  })
}

function toPayload(input: TransactionInput) {
  const form = new FormData()
  form.set('description', input.description)
  form.set('amount', String(input.amount))
  form.set('type', input.type)
  form.set('date', `${input.date} 12:00:00.000Z`)
  form.set('category', input.category)
  form.set('account', input.account)
  form.set('notes', input.notes || '')
  form.set('user', pb.authStore.record!.id)
  if (input.attachment) form.set('attachment', input.attachment)
  return form
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const result = await createTransactionWithRecurrence(input)
  return result.transaction
}

export async function createTransactionWithRecurrence(
  input: TransactionInput,
): Promise<CreateTransactionResult> {
  const recurrence = input.recurrence

  // Se NÃO for recorrente, cria simplesmente o lançamento único tradicional
  if (!recurrence || !recurrence.enabled) {
    const transaction = await pb
      .collection<Transaction>('transactions')
      .create(toPayload(input), { expand: 'category,account' })
    return { transaction }
  }

  const baseDateStr = input.date // 'YYYY-MM-DD'
  const [baseY, baseM, baseD] = baseDateStr.split('-').map(Number)
  const dayOfMonth = recurrence.day_of_month || baseD || 1

  // 1. MODO PARCELAS
  if (recurrence.mode === 'parcelas') {
    const totalInstallments = Math.max(2, recurrence.installmentsCount || 2)
    // Se o valor digitado for o total, divide pelo número de parcelas; se for valor da parcela, usa direto
    const installmentAmount =
      recurrence.installmentAmountType === 'total'
        ? Number((input.amount / totalInstallments).toFixed(2))
        : input.amount

    // Ajuste de centavos na primeira parcela se for valor total dividido
    const remainder =
      recurrence.installmentAmountType === 'total'
        ? Number((input.amount - installmentAmount * totalInstallments).toFixed(2))
        : 0

    const firstAmount = Number((installmentAmount + remainder).toFixed(2))

    // Calcula a data final (data da última parcela)
    const lastDate = new Date(Date.UTC(baseY, baseM - 1 + (totalInstallments - 1), 1))
    const daysInLastMonth = new Date(
      Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1, 0),
    ).getUTCDate()
    const lastDay = Math.min(dayOfMonth, daysInLastMonth)
    const pad = (n: number) => String(n).padStart(2, '0')
    const endDateStr = `${lastDate.getUTCFullYear()}-${pad(lastDate.getUTCMonth() + 1)}-${pad(lastDay)}`

    // Cria a regra na coleção 'recurring_transactions' para aparecer na página Recorrentes
    const recurringRecord = await createRecurringTransaction({
      description: `${input.description} (Parcelado ${totalInstallments}x)`,
      amount: installmentAmount,
      type: input.type,
      frequency: recurrence.frequency || 'mensal',
      day_of_month: dayOfMonth,
      start_date: baseDateStr,
      end_date: endDateStr,
      category: input.category,
      account: input.account,
      active: true,
    })

    // Cria o 1º lançamento imediatamente
    const firstInput: TransactionInput = {
      ...input,
      description: `${input.description} (1/${totalInstallments})`,
      amount: firstAmount,
      notes: input.notes
        ? `${input.notes} • Parcela 1 de ${totalInstallments}`
        : `Parcela 1 de ${totalInstallments}`,
    }

    const firstTransaction = await pb
      .collection<Transaction>('transactions')
      .create(toPayload(firstInput), { expand: 'category,account' })

    // Atualiza last_run da recorrência com a data do 1º lançamento para o cron não duplicar hoje
    await pb
      .collection('recurring_transactions')
      .update(recurringRecord.id, {
        last_run: `${baseDateStr} 12:00:00.000Z`,
      })
      .catch(() => null)

    return {
      transaction: firstTransaction,
      recurringTransaction: recurringRecord,
      futureTransactionsCreated: 0,
    }
  }

  // 2. MODO FREQUÊNCIA CONTÍNUA (mensal, semanal, quinzenal, anual)
  const recurringRecord = await createRecurringTransaction({
    description: input.description,
    amount: input.amount,
    type: input.type,
    frequency: recurrence.frequency,
    day_of_month: dayOfMonth,
    start_date: baseDateStr,
    end_date: recurrence.endDate || undefined,
    category: input.category,
    account: input.account,
    active: true,
  })

  // Cria o primeiro lançamento imediatamente para a data inicial informada
  const firstInput: TransactionInput = {
    ...input,
    notes: input.notes
      ? `${input.notes} • Lançamento recorrente (${recurrence.frequency})`
      : `Lançamento recorrente (${recurrence.frequency})`,
  }

  const firstTransaction = await pb
    .collection<Transaction>('transactions')
    .create(toPayload(firstInput), { expand: 'category,account' })

  // Marca last_run na recorrência para registrar que o primeiro já foi executado
  await pb
    .collection('recurring_transactions')
    .update(recurringRecord.id, {
      last_run: `${baseDateStr} 12:00:00.000Z`,
    })
    .catch(() => null)

  return {
    transaction: firstTransaction,
    recurringTransaction: recurringRecord,
  }
}

export function updateTransaction(id: string, input: TransactionInput) {
  return pb
    .collection<Transaction>('transactions')
    .update(id, toPayload(input), { expand: 'category,account' })
}

export function deleteTransaction(id: string) {
  return pb.collection('transactions').delete(id)
}

export function transactionAttachmentUrl(transaction: Transaction) {
  if (!transaction.attachment) return ''
  return pb.files.getURL(transaction, transaction.attachment)
}

export function countTransactionsForCategory(categoryId: string) {
  return pb.collection<Transaction>('transactions').getList(1, 1, {
    filter: `category = '${escapeFilter(categoryId)}'`,
  })
}
