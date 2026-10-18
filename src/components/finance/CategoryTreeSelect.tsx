import { useMemo, useState } from 'react'
import { Check, ChevronDown, FolderTree, Search, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Category, TransactionType } from '@/types/finance'
import { cn } from '@/lib/utils'

export interface CategoryTreeSelectProps {
  categories: Category[]
  value?: string
  onChange: (categoryId: string) => void
  type?: TransactionType
  placeholder?: string
  disabled?: boolean
  error?: boolean
  allowClear?: boolean
}

interface TreeCategoryItem {
  category: Category
  children: TreeCategoryItem[]
  level: number
  path: string
}

export function CategoryTreeSelect({
  categories,
  value,
  onChange,
  type,
  placeholder = 'Selecione uma categoria...',
  disabled = false,
  error = false,
  allowClear = true,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar categorias pelo tipo (receita / despesa), se informado
  const filteredByType = useMemo(() => {
    if (!type) return categories
    return categories.filter((c) => c.type === type)
  }, [categories, type])

  // Mapeamento id -> categoria
  const categoryMap = useMemo(() => {
    return new Map<string, Category>(filteredByType.map((c) => [c.id, c]))
  }, [filteredByType])

  // Categoria atualmente selecionada
  const selectedCategory = useMemo(() => {
    if (!value) return null
    return categoryMap.get(value) || categories.find((c) => c.id === value) || null
  }, [value, categoryMap, categories])

  // Rótulo completo com caminho da categoria selecionada
  const selectedDisplayPath = useMemo(() => {
    if (!selectedCategory) return ''
    const parts = [selectedCategory.name]
    let current = selectedCategory
    const visited = new Set<string>([current.id])
    while (current.parent && categoryMap.has(current.parent)) {
      if (visited.has(current.parent)) break
      visited.add(current.parent)
      current = categoryMap.get(current.parent)!
      parts.unshift(current.name)
    }
    return parts.join(' › ')
  }, [selectedCategory, categoryMap])

  // Montar árvore hierárquica completa
  const tree = useMemo(() => {
    const roots: Category[] = []
    const childrenByParent = new Map<string, Category[]>()

    filteredByType.forEach((c) => {
      if (!c.parent || !categoryMap.has(c.parent)) {
        roots.push(c)
      } else {
        const list = childrenByParent.get(c.parent) || []
        list.push(c)
        childrenByParent.set(c.parent, list)
      }
    })

    // Ordenar alfabeticamente
    roots.sort((a, b) => a.name.localeCompare(b.name))

    function buildNode(cat: Category, level: number, parentPath: string): TreeCategoryItem {
      const currentPath = parentPath ? `${parentPath} › ${cat.name}` : cat.name
      const kids = (childrenByParent.get(cat.id) || []).sort((a, b) => a.name.localeCompare(b.name))
      return {
        category: cat,
        children: kids.map((kid) => buildNode(kid, level + 1, currentPath)),
        level,
        path: currentPath,
      }
    }

    return roots.map((root) => buildNode(root, 0, ''))
  }, [filteredByType, categoryMap])

  // Aplicação da busca em todos os níveis
  const flattenedFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const result: TreeCategoryItem[] = []

    function traverse(node: TreeCategoryItem): boolean {
      const nameMatches = node.category.name.toLowerCase().includes(term)
      const pathMatches = node.path.toLowerCase().includes(term)
      const isSelfMatch = !term || nameMatches || pathMatches

      // Verifica se algum descendente combina
      let hasMatchingChild = false
      for (const child of node.children) {
        if (traverse(child)) {
          hasMatchingChild = true
        }
      }

      if (isSelfMatch || hasMatchingChild) {
        result.push(node)
        return true
      }
      return false
    }

    // Se houver busca, precisamos garantir ordem correta de exibição
    if (!term) {
      function flatten(node: TreeCategoryItem) {
        result.push(node)
        node.children.forEach(flatten)
      }
      tree.forEach(flatten)
    } else {
      tree.forEach((root) => traverse(root))
    }

    return result
  }, [tree, searchTerm])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm transition',
            error ? 'border-fin-danger' : 'border-fin-border',
            disabled
              ? 'opacity-50 cursor-not-allowed bg-fin-surface'
              : 'hover:border-fin-primary/60 focus:outline-none focus:ring-2 focus:ring-fin-primary/20',
          )}
        >
          <span
            className={cn(
              'flex-1 truncate',
              selectedCategory ? 'font-medium text-fin-text' : 'text-fin-muted',
            )}
          >
            {selectedCategory ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedCategory.color || '#6366F1' }}
                />
                <span className="truncate">{selectedDisplayPath}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>

          <div className="flex items-center gap-1 pl-2 text-fin-muted">
            {allowClear && selectedCategory && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    onChange('')
                  }
                }}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-zinc-100 hover:text-fin-text"
                title="Limpar seleção"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[340px] p-2 border-fin-border bg-white shadow-lg rounded-xl sm:w-[420px]"
      >
        {/* Campo de Busca */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fin-muted" />
          <input
            type="text"
            className="w-full rounded-lg border border-fin-border bg-fin-surface pl-8 pr-3 py-1.5 text-xs placeholder:text-fin-muted focus:border-fin-primary focus:bg-white focus:outline-none"
            placeholder="Buscar por categoria ou subcategoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fin-muted hover:text-fin-text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Lista hierárquica */}
        <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
          {flattenedFiltered.length === 0 ? (
            <div className="py-6 text-center text-xs text-fin-muted">
              Nenhuma categoria encontrada
            </div>
          ) : (
            flattenedFiltered.map((item) => {
              const isSelected = item.category.id === value
              const isRoot = item.level === 0
              const hasKids = item.children.length > 0

              return (
                <button
                  key={item.category.id}
                  type="button"
                  onClick={() => {
                    onChange(item.category.id)
                    setOpen(false)
                    setSearchTerm('')
                  }}
                  style={{
                    paddingLeft: `${Math.max(item.level * 18, 6)}px`,
                  }}
                  className={cn(
                    'group flex w-full items-center justify-between rounded-lg py-1.5 pr-2.5 text-xs transition text-left',
                    isSelected
                      ? 'bg-fin-primary text-white font-semibold'
                      : isRoot
                        ? 'hover:bg-zinc-100 text-fin-text font-semibold'
                        : 'hover:bg-zinc-100 text-zinc-700',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Indicador de hierarquia */}
                    {isRoot ? (
                      <FolderTree
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isSelected ? 'text-white' : 'text-fin-primary',
                        )}
                      />
                    ) : (
                      <span
                        className={cn(
                          'text-xs select-none shrink-0 font-mono',
                          isSelected ? 'text-white/80' : 'text-zinc-400',
                        )}
                      >
                        ↳
                      </span>
                    )}

                    {/* Dot colorido da categoria */}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: item.category.color || '#6366F1',
                      }}
                    />

                    <span className="truncate">
                      {item.category.name}
                      {hasKids && (
                        <span
                          className={cn(
                            'ml-1.5 text-[10px] font-normal opacity-75',
                            isSelected ? 'text-white' : 'text-fin-muted',
                          )}
                        >
                          ({item.children.length} sub)
                        </span>
                      )}
                    </span>
                  </div>

                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white ml-2" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
