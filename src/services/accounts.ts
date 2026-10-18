import pb from '@/lib/pocketbase/client'
import type { Account, AccountInput } from '@/types/finance'

export function listAccounts() {
  return pb.collection<Account>('accounts').getFullList({ sort: 'name' })
}

export function createAccount(input: AccountInput) {
  return pb.collection<Account>('accounts').create({ ...input, user: pb.authStore.record!.id })
}

export function updateAccount(id: string, input: AccountInput) {
  return pb.collection<Account>('accounts').update(id, input)
}

export function deleteAccount(id: string) {
  return pb.collection('accounts').delete(id)
}
