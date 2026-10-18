import pb from '@/lib/pocketbase/client'
import type { Category, CategoryInput } from '@/types/finance'

export function listCategories() {
  return pb.collection<Category>('categories').getFullList({ sort: 'type,name' })
}

export function createCategory(input: CategoryInput) {
  return pb
    .collection<Category>('categories')
    .create({ ...input, parent: input.parent || null, user: pb.authStore.record!.id })
}

export function updateCategory(id: string, input: CategoryInput) {
  return pb
    .collection<Category>('categories')
    .update(id, { ...input, parent: input.parent || null })
}

export function deleteCategory(id: string) {
  return pb.collection('categories').delete(id)
}
