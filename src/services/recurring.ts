import pb from '@/lib/pocketbase/client'
import type { RecurringTransaction, RecurringTransactionInput } from '@/types/finance'

export async function listRecurringTransactions(
  filter = '',
  sort = '-created',
): Promise<RecurringTransaction[]> {
  const records = await pb.collection('recurring_transactions').getFullList<RecurringTransaction>({
    filter,
    sort,
    expand: 'category,account',
  })
  return records
}

export async function createRecurringTransaction(
  data: RecurringTransactionInput,
): Promise<RecurringTransaction> {
  const user = pb.authStore.record?.id
  const payload = {
    ...data,
    user,
    active: data.active ?? true,
    day_of_month: data.day_of_month || 1,
    start_date:
      data.start_date.includes(' ') || data.start_date.includes('T')
        ? data.start_date
        : `${data.start_date} 12:00:00.000Z`,
    end_date: data.end_date
      ? data.end_date.includes(' ') || data.end_date.includes('T')
        ? data.end_date
        : `${data.end_date} 12:00:00.000Z`
      : '',
  }
  return pb
    .collection('recurring_transactions')
    .create<RecurringTransaction>(payload, { expand: 'category,account' })
}

export async function updateRecurringTransaction(
  id: string,
  data: Partial<RecurringTransactionInput>,
): Promise<RecurringTransaction> {
  const payload: Record<string, unknown> = { ...data }
  if (data.start_date) {
    payload.start_date =
      data.start_date.includes(' ') || data.start_date.includes('T')
        ? data.start_date
        : `${data.start_date} 12:00:00.000Z`
  }
  if (data.end_date !== undefined) {
    payload.end_date = data.end_date
      ? data.end_date.includes(' ') || data.end_date.includes('T')
        ? data.end_date
        : `${data.end_date} 12:00:00.000Z`
      : ''
  }
  return pb
    .collection('recurring_transactions')
    .update<RecurringTransaction>(id, payload, { expand: 'category,account' })
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<RecurringTransaction> {
  return pb
    .collection('recurring_transactions')
    .update<RecurringTransaction>(id, { active }, { expand: 'category,account' })
}

export async function deleteRecurringTransaction(id: string): Promise<boolean> {
  return pb.collection('recurring_transactions').delete(id)
}

export async function triggerProcessRecurring(): Promise<{
  success: boolean
  createdCount: number
  skippedCount: number
  message: string
}> {
  return pb.send('/backend/v1/recurring/process', {
    method: 'POST',
  })
}
