import pb from '@/lib/pocketbase/client'
import type { Budget, BudgetInput } from '@/types/finance'

export async function listBudgets(): Promise<Budget[]> {
  return pb.collection('budgets').getFullList<Budget>({
    sort: 'created',
    expand: 'category',
  })
}

export async function createBudget(data: BudgetInput): Promise<Budget> {
  const user = pb.authStore.record?.id
  return pb.collection('budgets').create<Budget>(
    {
      ...data,
      user,
    },
    {
      expand: 'category',
    },
  )
}

export async function updateBudget(id: string, data: Partial<BudgetInput>): Promise<Budget> {
  return pb.collection('budgets').update<Budget>(id, data, {
    expand: 'category',
  })
}

export async function deleteBudget(id: string): Promise<boolean> {
  return pb.collection('budgets').delete(id)
}
