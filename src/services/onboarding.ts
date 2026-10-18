import pb from '@/lib/pocketbase/client'
import { createCategory, listCategories } from '@/services/categories'
import type { Category } from '@/types/finance'

export interface OnboardingStatus {
  hasBank: boolean
  hasCard: boolean
  hasTransaction: boolean
  isComplete: boolean
  currentStep: number // 1: Banco, 2: Cartão, 3: Lançamento, 4: Concluído
  completedStepsCount: number
  bankCount: number
  cardCount: number
  transactionCount: number
}

export interface CompleteOnboardingResult {
  success: boolean
  emailSent?: boolean
  message?: string
}

/**
 * Consulta em tempo real os dados reais do usuário (contas e lançamentos)
 * para calcular o progresso exato do onboarding.
 */
export async function checkOnboardingStatus(explicitUserId?: string): Promise<OnboardingStatus> {
  const userId = explicitUserId || pb.authStore.record?.id
  if (!userId) {
    return {
      hasBank: false,
      hasCard: false,
      hasTransaction: false,
      isComplete: false,
      currentStep: 1,
      completedStepsCount: 0,
      bankCount: 0,
      cardCount: 0,
      transactionCount: 0,
    }
  }

  // Busca paralela com limites mínimos de performance
  const [bankAccounts, cardAccounts, transactions] = await Promise.all([
    pb.collection('accounts').getList(1, 1, {
      filter: `user = '${userId}' && type = 'banco'`,
    }),
    pb.collection('accounts').getList(1, 1, {
      filter: `user = '${userId}' && type = 'cartao'`,
    }),
    pb.collection('transactions').getList(1, 1, {
      filter: `user = '${userId}'`,
    }),
  ])

  const hasBank = bankAccounts.totalItems > 0
  const hasCard = cardAccounts.totalItems > 0
  const hasTransaction = transactions.totalItems > 0

  let completedStepsCount = 0
  if (hasBank) completedStepsCount++
  if (hasCard) completedStepsCount++
  if (hasTransaction) completedStepsCount++

  let currentStep = 1
  if (!hasBank) {
    currentStep = 1
  } else if (!hasCard) {
    currentStep = 2
  } else if (!hasTransaction) {
    currentStep = 3
  } else {
    currentStep = 4 // Tudo concluído
  }

  const isComplete = hasBank && hasCard && hasTransaction

  return {
    hasBank,
    hasCard,
    hasTransaction,
    isComplete,
    currentStep,
    completedStepsCount,
    bankCount: bankAccounts.totalItems,
    cardCount: cardAccounts.totalItems,
    transactionCount: transactions.totalItems,
  }
}

/**
 * Categorias essenciais padrão para inicializar o usuário caso ele ainda não tenha nenhuma
 */
export const DEFAULT_INITIAL_CATEGORIES = [
  {
    name: 'Alimentação',
    type: 'despesa' as const,
    color: '#F97316',
    children: ['Mercado', 'Restaurantes'],
  },
  {
    name: 'Moradia',
    type: 'despesa' as const,
    color: '#5B5FEF',
    children: ['Aluguel', 'Contas e Energia'],
  },
  {
    name: 'Transporte',
    type: 'despesa' as const,
    color: '#06B6D4',
    children: ['Combustível', 'Aplicativos'],
  },
  {
    name: 'Lazer & Assinaturas',
    type: 'despesa' as const,
    color: '#8B5CF6',
    children: ['Streaming', 'Lazer'],
  },
  {
    name: 'Saúde',
    type: 'despesa' as const,
    color: '#E5484D',
    children: ['Farmácia', 'Consultas'],
  },
  {
    name: 'Salário & Renda',
    type: 'receita' as const,
    color: '#16A34A',
    children: ['Salário', 'Freelance / Extras'],
  },
]

/**
 * Garante que o usuário possua ao menos um conjunto de categorias básicas para classificar despesas e receitas.
 * Se já possuir categorias, não duplica e retorna as existentes.
 */
export async function ensureDefaultCategories(): Promise<Category[]> {
  const existing = await listCategories()
  if (existing.length > 0) {
    return existing
  }

  // Cria as categorias padrão de forma sequencial para manter as relações pai-filho
  const created: Category[] = []
  for (const group of DEFAULT_INITIAL_CATEGORIES) {
    const parentCat = await createCategory({
      name: group.name,
      type: group.type,
      color: group.color,
    })
    created.push(parentCat)

    for (const childName of group.children) {
      const childCat = await createCategory({
        name: childName,
        type: group.type,
        color: group.color,
        parent: parentCat.id,
      })
      created.push(childCat)
    }
  }

  return created
}

/**
 * Conclui o onboarding chamando o endpoint do backend que ativa automações e dispara e-mail de boas-vindas.
 */
export async function completeOnboarding(): Promise<CompleteOnboardingResult> {
  const res = await pb.send<CompleteOnboardingResult>('/backend/v1/onboarding/complete', {
    method: 'POST',
  })
  return res
}
