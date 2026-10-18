import type { Category } from '@/types/finance'

/**
 * Retorna a categoria raiz de uma dada categoria subindo a cadeia de `parent`.
 * Se a categoria já for raiz ou não for encontrada, retorna a própria (ou null).
 */
export function getRootCategory(
  categoryId: string | undefined | null,
  categories: Category[],
): Category | undefined {
  if (!categoryId) return undefined
  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]))
  let current = catMap.get(categoryId)
  if (!current) return undefined

  const visited = new Set<string>()
  while (current.parent && catMap.has(current.parent)) {
    if (visited.has(current.id)) break // proteção contra ciclos acidentais
    visited.add(current.id)
    current = catMap.get(current.parent)!
  }

  return current
}

/**
 * Retorna o caminho completo legível de uma categoria, ex: "Alimentação > Mercado"
 */
export function getCategoryPath(
  categoryId: string | undefined | null,
  categories: Category[],
): string {
  if (!categoryId) return 'Sem categoria'
  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]))
  let current = catMap.get(categoryId)
  if (!current) return 'Sem categoria'

  const pathParts: string[] = [current.name]
  const visited = new Set<string>([current.id])

  while (current.parent && catMap.has(current.parent)) {
    if (visited.has(current.parent)) break
    visited.add(current.parent)
    current = catMap.get(current.parent)!
    pathParts.unshift(current.name)
  }

  return pathParts.join(' > ')
}

/**
 * Retorna todos os IDs da subárvore iniciada em `rootCategoryId` (incluindo o próprio ID).
 * Busca recursivamente todos os níveis de subcategorias filhas.
 */
export function getCategoryDescendantIds(
  rootCategoryId: string | undefined | null,
  categories: Category[],
): string[] {
  if (!rootCategoryId) return []

  const result = new Set<string>([rootCategoryId])
  const queue = [rootCategoryId]

  while (queue.length > 0) {
    const parentId = queue.shift()!
    for (const cat of categories) {
      if (cat.parent === parentId && !result.has(cat.id)) {
        result.add(cat.id)
        queue.push(cat.id)
      }
    }
  }

  return Array.from(result)
}

/**
 * Verifica se uma transação pertence a uma determinada categoria,
 * aceitando tanto correspondência exata quanto pertencente à subárvore de subcategorias.
 */
export function isTransactionInCategory(
  transactionCategoryId: string | undefined | null,
  filterCategoryId: string | undefined | null,
  categories: Category[],
): boolean {
  if (!filterCategoryId) return true
  if (!transactionCategoryId) return false
  if (transactionCategoryId === filterCategoryId) return true

  const familyIds = getCategoryDescendantIds(filterCategoryId, categories)
  return familyIds.includes(transactionCategoryId)
}
