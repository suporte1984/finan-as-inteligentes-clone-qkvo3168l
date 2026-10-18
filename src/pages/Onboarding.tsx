import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  Lock,
  LogOut,
  Sparkles,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useFinance } from '@/contexts/FinanceContext'
import { createAccount, listAccounts } from '@/services/accounts'
import { createTransaction } from '@/services/transactions'
import {
  checkOnboardingStatus,
  completeOnboarding,
  ensureDefaultCategories,
  type OnboardingStatus,
} from '@/services/onboarding'
import { CategoryTreeSelect } from '@/components/finance/CategoryTreeSelect'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { todayInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account, Category, TransactionType } from '@/types/finance'

const ACCOUNT_COLORS = ['#5B5FEF', '#34C759', '#FFB020', '#F4526B', '#8B5CF6', '#06B6D4', '#F97316']

export default function OnboardingPage() {
  const { user, logout } = useAuth()
  const { refreshAll } = useFinance()
  const navigate = useNavigate()

  const [loadingStatus, setLoadingStatus] = useState(true)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [activeStep, setActiveStep] = useState<number>(1) // 1, 2, 3 ou 4 (sucesso)

  // Submissão & feedback
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState('')

  // Lista de contas e categorias atualizadas para os formulários das etapas
  const [userAccounts, setUserAccounts] = useState<Account[]>([])
  const [categoriesList, setCategoriesList] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // ETAPA 1: Formulário Banco
  const [bankName, setBankName] = useState('')
  const [bankBalance, setBankBalance] = useState<number>(0)
  const [bankColor, setBankColor] = useState(ACCOUNT_COLORS[0])

  // ETAPA 2: Formulário Cartão
  const [cardName, setCardName] = useState('')
  const [cardColor, setCardColor] = useState('#F4526B')

  // ETAPA 3: Formulário Lançamento
  const [txType, setTxType] = useState<TransactionType>('despesa')
  const [txDescription, setTxDescription] = useState('')
  const [txAmount, setTxAmount] = useState<number>(0)
  const [txDate, setTxDate] = useState<string>(todayInput())
  const [txCategory, setTxCategory] = useState<string>('')
  const [txAccount, setTxAccount] = useState<string>('')
  const [txNotes, setTxNotes] = useState<string>('')

  // ETAPA 4: Conclusão
  const [completingSystem, setCompletingSystem] = useState(false)
  const [welcomeMailSent, setWelcomeMailSent] = useState<boolean | null>(null)

  // Carregar status inicial e posicionar na etapa correta
  const fetchStatus = async () => {
    try {
      const current = await checkOnboardingStatus(user?.id)
      setStatus(current)

      // Se todas as 3 etapas reais já estiverem prontas, redireciona imediatamente ao dashboard
      if (current.isComplete) {
        navigate('/', { replace: true })
        return
      }

      // Atualizar lista de contas locais para seleção na Etapa 3
      const accs = await listAccounts()
      setUserAccounts(accs)

      // Posicionar na primeira etapa ainda não concluída
      setActiveStep(current.currentStep)
    } catch (err) {
      setGlobalError(getErrorMessage(err))
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [user?.id])

  // Quando entrar na etapa 3, garantir categorias padrão e selecionar conta padrão se não selecionada
  useEffect(() => {
    if (activeStep === 3) {
      let active = true
      setLoadingCategories(true)
      ensureDefaultCategories()
        .then((cats) => {
          if (active) setCategoriesList(cats)
        })
        .finally(() => {
          if (active) setLoadingCategories(false)
        })

      // Se houver contas cadastradas e nenhuma conta selecionada, seleciona a primeira conta banco/carteira
      if (userAccounts.length > 0 && !txAccount) {
        setTxAccount(userAccounts[0].id)
      }

      return () => {
        active = false
      }
    }
  }, [activeStep, userAccounts, txAccount])

  // SUBMIT ETAPA 1 — BANCO
  const handleSubmitBank = async (e: FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    setGlobalError('')

    if (!bankName.trim()) {
      setFormErrors({ bankName: 'Informe o nome do seu banco ou conta (ex: Nubank, Itaú).' })
      return
    }

    setSubmitting(true)
    try {
      await createAccount({
        name: bankName.trim(),
        type: 'banco',
        initial_balance: Number(bankBalance) || 0,
        color: bankColor,
      })

      const updatedAccounts = await listAccounts()
      setUserAccounts(updatedAccounts)

      const updatedStatus = await checkOnboardingStatus(user?.id)
      setStatus(updatedStatus)

      // Avançar para a próxima etapa pendente
      if (!updatedStatus.hasCard) {
        setActiveStep(2)
      } else if (!updatedStatus.hasTransaction) {
        setActiveStep(3)
      } else {
        setActiveStep(4)
      }
    } catch (err) {
      setFormErrors(extractFieldErrors(err))
      setGlobalError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // SUBMIT ETAPA 2 — CARTÃO
  const handleSubmitCard = async (e: FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    setGlobalError('')

    if (!cardName.trim()) {
      setFormErrors({
        cardName: 'Informe o nome do cartão de crédito (ex: Cartão Nubank, Visa XP).',
      })
      return
    }

    setSubmitting(true)
    try {
      await createAccount({
        name: cardName.trim(),
        type: 'cartao',
        initial_balance: 0,
        color: cardColor,
      })

      const updatedAccounts = await listAccounts()
      setUserAccounts(updatedAccounts)

      const updatedStatus = await checkOnboardingStatus(user?.id)
      setStatus(updatedStatus)

      // Avançar para Etapa 3 (ou 4 se já tiver transação)
      if (!updatedStatus.hasTransaction) {
        setActiveStep(3)
      } else {
        setActiveStep(4)
      }
    } catch (err) {
      setFormErrors(extractFieldErrors(err))
      setGlobalError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // SUBMIT ETAPA 3 — LANÇAMENTO
  const handleSubmitTransaction = async (e: FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    setGlobalError('')

    const errs: FieldErrors = {}
    if (!txDescription.trim()) {
      errs.description = 'Informe uma descrição para o lançamento.'
    }
    if (!txAmount || txAmount <= 0) {
      errs.amount = 'Informe um valor maior que zero.'
    }
    if (!txDate) {
      errs.date = 'Informe a data do lançamento.'
    }
    if (!txCategory) {
      errs.category = 'Selecione uma categoria.'
    }
    if (!txAccount) {
      errs.account = 'Selecione a conta de movimentação.'
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      await createTransaction({
        type: txType,
        description: txDescription.trim(),
        amount: Number(txAmount),
        date: txDate,
        category: txCategory,
        account: txAccount,
        notes: txNotes.trim(),
        attachment: null,
      })

      // Atualizar status final
      const updatedStatus = await checkOnboardingStatus(user?.id)
      setStatus(updatedStatus)
      setActiveStep(4)
    } catch (err) {
      setFormErrors(extractFieldErrors(err))
      setGlobalError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // FINALIZAR ONBOARDING (ETAPA 4: Tela de sucesso → ativa automações no backend)
  const handleFinishOnboarding = async () => {
    setCompletingSystem(true)
    setGlobalError('')
    try {
      const res = await completeOnboarding()
      setWelcomeMailSent(Boolean(res.emailSent))
      // Atualizar contexto financeiro e redirecionar
      await refreshAll()
      navigate('/', { replace: true })
    } catch (err) {
      setGlobalError(getErrorMessage(err))
      // Se falhar o backend, ainda permite navegar se o status real já estiver completo
      if (status?.isComplete) {
        await refreshAll()
        navigate('/', { replace: true })
      }
    } finally {
      setCompletingSystem(false)
    }
  }

  if (loadingStatus) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-fin-primary" />
          <p className="text-sm font-medium text-fin-muted">
            Verificando o cadastro da sua conta...
          </p>
        </div>
      </div>
    )
  }

  // Quantidade de passos reais concluídos (0 a 3)
  const completedCount = status?.completedStepsCount ?? 0
  const progressPercent = Math.min(Math.round((completedCount / 3) * 100), 100)

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-fin-text flex flex-col justify-between">
      {/* Topo estilo Mercury: Header minimalista */}
      <header className="border-b border-[#E5E7EB] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-fin-text text-white font-bold text-sm tracking-tight shadow-sm">
              FI
            </span>
            <div>
              <span className="text-sm font-bold tracking-tight text-fin-text block leading-none">
                Finanças Inteligentes
              </span>
              <span className="text-[11px] text-fin-muted font-medium mt-0.5 block">
                Configuração inicial obrigatória
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-fin-muted font-medium bg-fin-surface px-3 py-1.5 rounded-full border border-fin-border">
              <Lock className="h-3 w-3 text-fin-muted" />
              Etapas obrigatórias
            </span>
            <button
              onClick={() => logout()}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-fin-muted hover:text-fin-danger transition"
              title="Sair da conta"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal Centralizado */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full page-container-compact">
          {/* Card Principal Mercury */}
          <div className="fin-card overflow-hidden shadow-sm border-slate-300">
            {/* Barra de Progresso Superior Persistente */}
            <div className="border-b border-[#E5E7EB] bg-[#FDFDFE] px-6 py-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-fin-text">Progresso do cadastro</span>
                <span className="text-fin-primary">
                  {completedCount} de 3 etapas concluídas ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full bg-fin-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Indicadores das 3 etapas */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded-md transition',
                    activeStep === 1
                      ? 'bg-fin-primary/10 text-fin-primary'
                      : status?.hasBank
                        ? 'text-fin-success'
                        : 'text-fin-muted',
                  )}
                >
                  {status?.hasBank ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px]">
                      1
                    </span>
                  )}
                  <span>1. Banco</span>
                </button>

                <button
                  type="button"
                  onClick={() => status?.hasBank && setActiveStep(2)}
                  disabled={!status?.hasBank}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded-md transition disabled:opacity-40',
                    activeStep === 2
                      ? 'bg-fin-primary/10 text-fin-primary'
                      : status?.hasCard
                        ? 'text-fin-success'
                        : 'text-fin-muted',
                  )}
                >
                  {status?.hasCard ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px]">
                      2
                    </span>
                  )}
                  <span>2. Cartão</span>
                </button>

                <button
                  type="button"
                  onClick={() => status?.hasBank && status?.hasCard && setActiveStep(3)}
                  disabled={!status?.hasBank || !status?.hasCard}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded-md transition disabled:opacity-40',
                    activeStep === 3
                      ? 'bg-fin-primary/10 text-fin-primary'
                      : status?.hasTransaction
                        ? 'text-fin-success'
                        : 'text-fin-muted',
                  )}
                >
                  {status?.hasTransaction ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px]">
                      3
                    </span>
                  )}
                  <span>3. Lançamento</span>
                </button>
              </div>
            </div>

            {/* Corpo da Etapa Ativa */}
            <div className="p-6 sm:p-8">
              {globalError && (
                <div className="mb-6 rounded-xl bg-red-50 p-3.5 text-xs font-medium text-fin-danger border border-red-200">
                  {globalError}
                </div>
              )}

              {/* ETAPA 1 — BANCO */}
              {activeStep === 1 && (
                <form onSubmit={handleSubmitBank} className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                      Etapa 1 de 3 • Obrigatória
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-fin-primary" />
                      Sua conta bancária
                    </h2>
                    <p className="mt-1.5 text-sm text-fin-muted leading-relaxed">
                      Cadastre a conta corrente ou poupança onde você recebe seus rendimentos ou
                      mantém seu saldo principal.
                    </p>
                  </div>

                  {status?.hasBank && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Você já possui {status.bankCount} conta(s) bancária(s) cadastrada(s).
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="text-xs font-bold underline hover:text-emerald-950"
                      >
                        Avançar para Cartão &rarr;
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                        Nome da instituição ou banco
                      </span>
                      <input
                        type="text"
                        className={cn(
                          'field',
                          formErrors.bankName && 'border-red-400 focus:border-red-500',
                        )}
                        placeholder="Ex.: Itaú Personnalité, Nubank, Banco do Brasil..."
                        value={bankName}
                        onChange={(e) => {
                          setBankName(e.target.value)
                          setFormErrors((prev) => ({ ...prev, bankName: '' }))
                        }}
                        autoFocus
                      />
                      {formErrors.bankName && (
                        <span className="text-xs text-fin-danger font-medium">
                          {formErrors.bankName}
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                          Saldo inicial (R$)
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-fin-muted font-medium">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="field pl-10"
                            placeholder="0,00"
                            value={bankBalance || ''}
                            onChange={(e) => setBankBalance(Number(e.target.value))}
                          />
                        </div>
                        <span className="text-[11px] text-fin-muted">
                          Saldo atual em conta hoje.
                        </span>
                      </label>

                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-fin-text mb-1.5">
                          Cor de identificação
                        </span>
                        <div className="flex items-center gap-2 pt-1">
                          {ACCOUNT_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setBankColor(c)}
                              className="grid h-8 w-8 place-items-center rounded-full transition hover:scale-105"
                              style={{ backgroundColor: c }}
                            >
                              {bankColor === c && (
                                <Check className="h-4 w-4 text-white stroke-[3]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                    <span className="text-xs text-fin-muted">
                      Próxima: <strong>Seu cartão</strong>
                    </span>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando conta...
                        </>
                      ) : (
                        <>
                          Salvar e Continuar
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ETAPA 2 — CARTÃO */}
              {activeStep === 2 && (
                <form onSubmit={handleSubmitCard} className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                      Etapa 2 de 3 • Obrigatória
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                      <CreditCard className="h-6 w-6 text-fin-primary" />
                      Seu cartão de crédito
                    </h2>
                    <p className="mt-1.5 text-sm text-fin-muted leading-relaxed">
                      Cadastre seu cartão principal para acompanhar faturas e manter os alertas de
                      vencimento sempre precisos.
                    </p>
                  </div>

                  {status?.hasCard && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Você já possui {status.cardCount} cartão(ões) cadastrado(s).
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="text-xs font-bold underline hover:text-emerald-950"
                      >
                        Avançar para Lançamento &rarr;
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                        Nome ou bandeira do cartão
                      </span>
                      <input
                        type="text"
                        className={cn(
                          'field',
                          formErrors.cardName && 'border-red-400 focus:border-red-500',
                        )}
                        placeholder="Ex.: Cartão Nubank Ultravioleta, Black Itaú, C6..."
                        value={cardName}
                        onChange={(e) => {
                          setCardName(e.target.value)
                          setFormErrors((prev) => ({ ...prev, cardName: '' }))
                        }}
                        autoFocus
                      />
                      {formErrors.cardName && (
                        <span className="text-xs text-fin-danger font-medium">
                          {formErrors.cardName}
                        </span>
                      )}
                    </label>

                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-fin-text mb-1.5">
                        Cor de identificação
                      </span>
                      <div className="flex items-center gap-2 pt-1">
                        {ACCOUNT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCardColor(c)}
                            className="grid h-8 w-8 place-items-center rounded-full transition hover:scale-105"
                            style={{ backgroundColor: c }}
                          >
                            {cardColor === c && <Check className="h-4 w-4 text-white stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar etapa
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando cartão...
                        </>
                      ) : (
                        <>
                          Salvar e Continuar
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ETAPA 3 — LANÇAMENTO */}
              {activeStep === 3 && (
                <form onSubmit={handleSubmitTransaction} className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                      Etapa 3 de 3 • Obrigatória
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                      <FileSpreadsheet className="h-6 w-6 text-fin-primary" />
                      Primeiro lançamento
                    </h2>
                    <p className="mt-1.5 text-sm text-fin-muted leading-relaxed">
                      Registre sua primeira despesa ou receita para inaugurar seu extrato e
                      alimentar o motor de inteligência artificial.
                    </p>
                  </div>

                  {/* Seletor Receita / Despesa */}
                  <div className="grid grid-cols-2 rounded-xl bg-fin-surface p-1 border border-fin-border">
                    {(['receita', 'despesa'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTxType(t)
                          setTxCategory('')
                        }}
                        className={cn(
                          'rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold capitalize transition',
                          txType === t
                            ? t === 'receita'
                              ? 'bg-white text-fin-success shadow-sm'
                              : 'bg-white text-fin-danger shadow-sm'
                            : 'text-fin-muted',
                        )}
                      >
                        {t === 'receita' ? '+ Receita (Entrada)' : '- Despesa (Saída)'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                          Valor (R$)
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-fin-muted font-medium">
                            R$
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className={cn(
                              'field pl-10 font-medium',
                              formErrors.amount && 'border-red-400 focus:border-red-500',
                            )}
                            placeholder="0,00"
                            value={txAmount || ''}
                            onChange={(e) => {
                              setTxAmount(Number(e.target.value))
                              setFormErrors((prev) => ({ ...prev, amount: '' }))
                            }}
                            autoFocus
                          />
                        </div>
                        {formErrors.amount && (
                          <span className="text-xs text-fin-danger font-medium">
                            {formErrors.amount}
                          </span>
                        )}
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                          Data
                        </span>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                          <input
                            type="date"
                            className={cn(
                              'field pl-10',
                              formErrors.date && 'border-red-400 focus:border-red-500',
                            )}
                            value={txDate}
                            onChange={(e) => {
                              setTxDate(e.target.value)
                              setFormErrors((prev) => ({ ...prev, date: '' }))
                            }}
                          />
                        </div>
                        {formErrors.date && (
                          <span className="text-xs text-fin-danger font-medium">
                            {formErrors.date}
                          </span>
                        )}
                      </label>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                        Descrição
                      </span>
                      <input
                        type="text"
                        className={cn(
                          'field',
                          formErrors.description && 'border-red-400 focus:border-red-500',
                        )}
                        placeholder="Ex.: Supermercado, Aluguel, Salário, Compra online..."
                        value={txDescription}
                        onChange={(e) => {
                          setTxDescription(e.target.value)
                          setFormErrors((prev) => ({ ...prev, description: '' }))
                        }}
                      />
                      {formErrors.description && (
                        <span className="text-xs text-fin-danger font-medium">
                          {formErrors.description}
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-fin-text mb-1.5">
                          Categoria
                        </span>
                        {loadingCategories ? (
                          <div className="field flex items-center gap-2 text-xs text-fin-muted">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando categorias...
                          </div>
                        ) : (
                          <CategoryTreeSelect
                            categories={categoriesList}
                            type={txType}
                            value={txCategory}
                            onChange={(catId) => {
                              setTxCategory(catId)
                              setFormErrors((prev) => ({ ...prev, category: '' }))
                            }}
                            placeholder={`Selecione categoria de ${txType}...`}
                            error={Boolean(formErrors.category)}
                          />
                        )}
                        {formErrors.category && (
                          <span className="text-xs text-fin-danger font-medium mt-1 block">
                            {formErrors.category}
                          </span>
                        )}
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                          Conta utilizada
                        </span>
                        <select
                          className={cn(
                            'field',
                            formErrors.account && 'border-red-400 focus:border-red-500',
                          )}
                          value={txAccount}
                          onChange={(e) => {
                            setTxAccount(e.target.value)
                            setFormErrors((prev) => ({ ...prev, account: '' }))
                          }}
                        >
                          <option value="">Selecione uma conta</option>
                          {userAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.type === 'cartao' ? 'Cartão' : 'Banco/Carteira'})
                            </option>
                          ))}
                        </select>
                        {formErrors.account && (
                          <span className="text-xs text-fin-danger font-medium">
                            {formErrors.account}
                          </span>
                        )}
                      </label>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                        Observações (opcional)
                      </span>
                      <textarea
                        rows={2}
                        className="field resize-none"
                        placeholder="Alguma nota sobre esse lançamento..."
                        value={txNotes}
                        onChange={(e) => setTxNotes(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar etapa
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registrando lançamento...
                        </>
                      ) : (
                        <>
                          Concluir etapa
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ETAPA 4 — TELA DE SUCESSO & ATIVAÇÃO */}
              {activeStep === 4 && (
                <div className="text-center py-4 space-y-6">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
                    <CheckCircle2 className="h-9 w-9 stroke-[2.2]" />
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 mb-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Configuração concluída com sucesso!
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight text-fin-text">
                      Parabéns, {user?.name || 'você'} está pronto!
                    </h2>
                    <p className="mt-2 text-sm text-fin-muted max-w-md mx-auto leading-relaxed">
                      Sua conta bancária, cartão e primeiro lançamento foram registrados. As
                      automações inteligentes agora estão aptas para operar em seu benefício.
                    </p>
                  </div>

                  {/* Resumo visual do que foi cadastrado */}
                  <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-4 text-left max-w-md mx-auto space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-fin-text">
                      <span className="flex items-center gap-2 text-emerald-700">
                        <Check className="h-4 w-4 stroke-[3]" />
                        Conta Bancária ativa
                      </span>
                      <span className="text-fin-muted">{status?.bankCount || 1} cadastrada(s)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-fin-text">
                      <span className="flex items-center gap-2 text-emerald-700">
                        <Check className="h-4 w-4 stroke-[3]" />
                        Cartão de Crédito configurado
                      </span>
                      <span className="text-fin-muted">{status?.cardCount || 1} cadastrado(s)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-fin-text">
                      <span className="flex items-center gap-2 text-emerald-700">
                        <Check className="h-4 w-4 stroke-[3]" />
                        Lançamento inicial registrado
                      </span>
                      <span className="text-fin-muted">Extrato iniciado</span>
                    </div>
                  </div>

                  {/* Aviso sobre as automações */}
                  <div className="rounded-xl border border-indigo-100 bg-[#F4F4FD] p-4 text-left max-w-md mx-auto text-xs text-indigo-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-fin-primary">
                      <Sparkles className="h-4 w-4" />
                      Automações que acabam de ser ativadas:
                    </p>
                    <p className="leading-relaxed text-fin-muted">
                      • Lembrete diário de contas às 09:00 com 3 dias de antecedência.
                      <br />• Fechamento financeiro com IA todo dia 1º do mês.
                      <br />• E-mail de boas-vindas com confirmação enviado para{' '}
                      <strong>{user?.email}</strong>.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => void handleFinishOnboarding()}
                      disabled={completingSystem}
                      className="btn-primary w-full max-w-md py-3 text-sm font-semibold shadow-md inline-flex items-center justify-center gap-2"
                    >
                      {completingSystem ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Ativando automações e entrando no app...
                        </>
                      ) : (
                        <>
                          Ir para o dashboard
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé Mercury */}
      <footer className="py-4 text-center text-xs text-fin-muted">
        Finanças Inteligentes &bull; Seus dados e automações protegidos com alta segurança.
      </footer>
    </div>
  )
}
