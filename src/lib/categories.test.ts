import { describe, expect, it } from 'vitest'
import {
  getCategoryDescendantIds,
  getCategoryPath,
  getRootCategory,
  isTransactionInCategory,
} from './categories'
import type { Category } from '@/types/finance'

const baseCategory = {
  user: 'user-1',
  collectionId: 'categories',
  collectionName: 'categories',
  created: '2026-01-01',
  updated: '2026-01-01',
}

const mockCategories: Category[] = [
  // Raiz 1: Moradia
  {
    ...baseCategory,
    id: 'moradia',
    name: 'Moradia',
    type: 'despesa',
    color: '#5B5FEF',
    parent: '',
  },
  {
    ...baseCategory,
    id: 'aluguel',
    name: 'Aluguel',
    type: 'despesa',
    color: '#5B5FEF',
    parent: 'moradia',
  },
  {
    ...baseCategory,
    id: 'condominio',
    name: 'Condomínio',
    type: 'despesa',
    color: '#5B5FEF',
    parent: 'moradia',
  },

  // Raiz 2: Assinaturas com subcategorias e sub-subcategorias (teste recursivo multi-nível)
  {
    ...baseCategory,
    id: 'assinaturas',
    name: 'Assinaturas',
    type: 'despesa',
    color: '#F4526B',
    parent: '',
  },
  {
    ...baseCategory,
    id: 'streaming',
    name: 'Streaming',
    type: 'despesa',
    color: '#F4526B',
    parent: 'assinaturas',
  },
  {
    ...baseCategory,
    id: 'netflix',
    name: 'Netflix 4K',
    type: 'despesa',
    color: '#F4526B',
    parent: 'streaming',
  },
  {
    ...baseCategory,
    id: 'software',
    name: 'Software',
    type: 'despesa',
    color: '#F4526B',
    parent: 'assinaturas',
  },

  // Raiz 3: Educação
  {
    ...baseCategory,
    id: 'educacao',
    name: 'Educação',
    type: 'despesa',
    color: '#FFB020',
    parent: '',
  },
  {
    ...baseCategory,
    id: 'cursos',
    name: 'Cursos',
    type: 'despesa',
    color: '#FFB020',
    parent: 'educacao',
  },
  {
    ...baseCategory,
    id: 'livros',
    name: 'Livros',
    type: 'despesa',
    color: '#FFB020',
    parent: 'educacao',
  },
]

describe('categories utils', () => {
  it('getRootCategory retorna a raiz correta subindo a cadeia', () => {
    expect(getRootCategory('aluguel', mockCategories)?.id).toBe('moradia')
    expect(getRootCategory('netflix', mockCategories)?.id).toBe('assinaturas')
    expect(getRootCategory('moradia', mockCategories)?.id).toBe('moradia')
    expect(getRootCategory('inexistente', mockCategories)).toBeUndefined()
    expect(getRootCategory('', mockCategories)).toBeUndefined()
  })

  it('getCategoryPath retorna a trilha hierárquica legível', () => {
    expect(getCategoryPath('moradia', mockCategories)).toBe('Moradia')
    expect(getCategoryPath('aluguel', mockCategories)).toBe('Moradia > Aluguel')
    expect(getCategoryPath('netflix', mockCategories)).toBe('Assinaturas > Streaming > Netflix 4K')
    expect(getCategoryPath(null, mockCategories)).toBe('Sem categoria')
  })

  it('getCategoryDescendantIds retorna todos os IDs da subárvore recursivamente', () => {
    // Raiz com múltiplos níveis
    const assinaturasDescendants = getCategoryDescendantIds('assinaturas', mockCategories)
    expect(assinaturasDescendants).toContain('assinaturas')
    expect(assinaturasDescendants).toContain('streaming')
    expect(assinaturasDescendants).toContain('netflix')
    expect(assinaturasDescendants).toContain('software')
    expect(assinaturasDescendants.length).toBe(4)

    // Categoria intermediária (Streaming) deve incluir apenas a si e seus filhos (Netflix)
    const streamingDescendants = getCategoryDescendantIds('streaming', mockCategories)
    expect(streamingDescendants).toEqual(['streaming', 'netflix'])

    // Folha (Netflix) deve conter apenas seu próprio id
    const netflixDescendants = getCategoryDescendantIds('netflix', mockCategories)
    expect(netflixDescendants).toEqual(['netflix'])

    // Raiz Educação
    const educacaoDescendants = getCategoryDescendantIds('educacao', mockCategories)
    expect(educacaoDescendants).toEqual(expect.arrayContaining(['educacao', 'cursos', 'livros']))
    expect(educacaoDescendants.length).toBe(3)

    // Categoria inexistente ou vazia
    expect(getCategoryDescendantIds('', mockCategories)).toEqual([])
    expect(getCategoryDescendantIds(null, mockCategories)).toEqual([])
  })

  it('isTransactionInCategory verifica se lançamento pertence à categoria ou subcategorias', () => {
    // Ao filtrar por Assinaturas (raiz), deve incluir Netflix (filho de Streaming)
    expect(isTransactionInCategory('netflix', 'assinaturas', mockCategories)).toBe(true)
    expect(isTransactionInCategory('streaming', 'assinaturas', mockCategories)).toBe(true)
    expect(isTransactionInCategory('software', 'assinaturas', mockCategories)).toBe(true)
    expect(isTransactionInCategory('assinaturas', 'assinaturas', mockCategories)).toBe(true)

    // Não deve incluir Moradia quando filtrar por Assinaturas
    expect(isTransactionInCategory('moradia', 'assinaturas', mockCategories)).toBe(false)
    expect(isTransactionInCategory('aluguel', 'assinaturas', mockCategories)).toBe(false)

    // Ao filtrar especificamente por uma subcategoria (Streaming), inclui netflix mas não software ou assinaturas
    expect(isTransactionInCategory('netflix', 'streaming', mockCategories)).toBe(true)
    expect(isTransactionInCategory('streaming', 'streaming', mockCategories)).toBe(true)
    expect(isTransactionInCategory('software', 'streaming', mockCategories)).toBe(false)
    expect(isTransactionInCategory('assinaturas', 'streaming', mockCategories)).toBe(false)

    // Quando não há filtro de categoria, deve aceitar qualquer categoria
    expect(isTransactionInCategory('netflix', '', mockCategories)).toBe(true)
    expect(isTransactionInCategory('netflix', null, mockCategories)).toBe(true)
  })
})
