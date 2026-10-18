import pb from '@/lib/pocketbase/client'
import type { Bill, BillInput, Transaction } from '@/types/finance'

export function listBills() {
  return pb
    .collection<Bill>('bills')
    .getFullList({ sort: 'due_date', expand: 'category,account,transaction' })
}

export function createBill(input: BillInput) {
  return pb.collection<Bill>('bills').create(
    {
      ...input,
      category: input.category || null,
      account: input.account || null,
      user: pb.authStore.record!.id,
    },
    { expand: 'category,account' },
  )
}

export function updateBill(id: string, input: BillInput) {
  return pb
    .collection<Bill>('bills')
    .update(
      id,
      { ...input, category: input.category || null, account: input.account || null },
      { expand: 'category,account,transaction' },
    )
}

export function deleteBill(id: string) {
  return pb.collection('bills').delete(id)
}

export async function settleBill(bill: Bill, accountId: string, date: string) {
  const categoryId = bill.category || bill.expand?.category?.id
  if (!categoryId) throw new Error('Selecione uma categoria antes de liquidar esta conta.')
  const transaction = await pb.collection<Transaction>('transactions').create({
    description: bill.description,
    amount: bill.amount,
    type: bill.direction === 'pagar' ? 'despesa' : 'receita',
    date: `${date} 12:00:00.000Z`,
    category: categoryId,
    account: accountId,
    notes: `Liquidação da conta ${bill.description}`,
    user: pb.authStore.record!.id,
  })
  try {
    return await pb.collection<Bill>('bills').update(
      bill.id,
      {
        status: 'pago',
        account: accountId,
        transaction: transaction.id,
      },
      { expand: 'category,account,transaction' },
    )
  } catch (error) {
    await pb
      .collection('transactions')
      .delete(transaction.id)
      .catch(() => undefined)
    throw error
  }
}

export interface SendDueRemindersResult {
  success: boolean
  emailsSent: number
  usersSkipped: number
  billsCount: number
  message: string
}

export async function sendBillsDueReminders(): Promise<SendDueRemindersResult> {
  return pb.send<SendDueRemindersResult>('/backend/v1/bills/send-due-reminders', {
    method: 'POST',
  })
}
