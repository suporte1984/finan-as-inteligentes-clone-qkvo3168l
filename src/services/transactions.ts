import pb from '@/lib/pocketbase/client'
import { escapeFilter } from '@/lib/format'
import type { Transaction, TransactionInput } from '@/types/finance'

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

export function createTransaction(input: TransactionInput) {
  return pb
    .collection<Transaction>('transactions')
    .create(toPayload(input), { expand: 'category,account' })
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
