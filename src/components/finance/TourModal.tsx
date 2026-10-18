import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  FileSpreadsheet,
  Info,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { todayInput } from '@/lib/format'

interface TourModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACCOUNT_COLORS = ['#5B5FEF', '#34C759', '#FFB020', '#F4526B', '#8B5CF6', '#06B6D4', '#F97316']

export function TourModal({ open, onOpenChange }: TourModalProps) {
  const { user } = useAuth()
  const { accounts, categories, onboardingStatus } = useFinance()

  const [activeStep, setActiveStep] = useState<number>(1) // 1, 2, 3 ou 4 (conclusão)

  // Amostras para exibição demonstrativa
  const firstBank = accounts.find((a) => a.type === 'banco')
  const firstCard = accounts.find((a) => a.type === 'cartao')

  // Estados demonstrativos (pré-populados com dados reais se existirem ou exemplos amigáveis)
  const [bankName, setBankName] = useState('')
  const [bankBalance, setBankBalance] = useState<number>(1500)
  const [bankColor, setBankColor] = useState(ACCOUNT_COLORS[0])

  const [cardName, setCardName] = useState('')
  const [cardColor, setCardColor] = useState('#F4526B')

  const [txType, setTxType] = useState<'receita' | 'despesa'>('despesa')
  const [txDescription, setTxDescription] = useState('Supermercado Semanal')
  const [txAmount, setTxAmount] = useState<number>(184.5)
  const [txDate, setTxDate] = useState<string>(todayInput())
  const [txCategoryName, setTxCategoryName] = useState('Alimentação / Mercado')
  const [txAccountName, setTxAccountName] = useState('')

  // Sincronizar dados quando o modal abre
  useEffect(() => {
    if (open) {
      setActiveStep(1)
      setBankName(firstBank ? firstBank.name : 'Ex.: Nubank Conta Principal')
      setBankBalance(firstBank?.initial_balance ?? 2500)
      setBankColor(firstBank?.color || ACCOUNT_COLORS[0])

      setCardName(firstCard ? firstCard.name : 'Ex.: Cartão Ultravioleta')
      setCardColor(firstCard?.color || '#F4526B')

      setTxType('despesa')
      setTxDescription('Supermercado Mensal')
      setTxAmount(184.5)
      setTxDate(todayInput())
      setTxCategoryName(categories[0]?.name || 'Alimentação')
      setTxAccountName(firstBank?.name || firstCard?.name || 'Conta Bancária')
    }
  }, [open, firstBank, firstCard, categories])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleRestart = () => {
    setActiveStep(1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden border-slate-300 shadow-2xl [&>button:last-child]:hidden">
        {/* Topo do Modal com aviso de Modo Demonstração */}
        <div className="bg-[#1C1F2E] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white font-bold text-xs tracking-tight">
                FI
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <span>Tour Guiado de Apresentação</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    <Eye className="h-3 w-3" />
                    Modo Demonstração
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-white/70 mt-0.5">
                  Reviva as 3 etapas de inicialização do app. Nenhum dado real é modificado.
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition"
              title="Fechar tour"
              aria-label="Fechar tour guiado"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper com status real */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition',
                activeStep === 1
                  ? 'bg-white text-fin-text shadow-sm'
                  : 'bg-white/10 text-white/80 hover:bg-white/20',
              )}
            >
              <CheckCircle2
                className={cn('h-3.5 w-3.5', onboardingStatus?.hasBank ? 'text-emerald-400' : '')}
              />
              <span>1. Banco</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition',
                activeStep === 2
                  ? 'bg-white text-fin-text shadow-sm'
                  : 'bg-white/10 text-white/80 hover:bg-white/20',
              )}
            >
              <CheckCircle2
                className={cn('h-3.5 w-3.5', onboardingStatus?.hasCard ? 'text-emerald-400' : '')}
              />
              <span>2. Cartão</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition',
                activeStep === 3
                  ? 'bg-white text-fin-text shadow-sm'
                  : 'bg-white/10 text-white/80 hover:bg-white/20',
              )}
            >
              <CheckCircle2
                className={cn(
                  'h-3.5 w-3.5',
                  onboardingStatus?.hasTransaction ? 'text-emerald-400' : '',
                )}
              />
              <span>3. Lançamento</span>
            </button>
          </div>
        </div>

        {/* Faixa explicativa do status seguro */}
        <div className="bg-amber-50/70 border-b border-amber-200/80 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <span className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              Suas etapas reais estão <strong>concluídas</strong> e seus lançamentos continuam
              intactos.
            </span>
          </span>
          <span className="text-[11px] font-semibold bg-amber-100/80 text-amber-800 px-2 py-0.5 rounded-md">
            Somente Leitura
          </span>
        </div>

        {/* Corpo das Etapas */}
        <div className="p-6 sm:p-7 max-h-[60vh] overflow-y-auto">
          {/* ETAPA 1: BANCO */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                  Etapa 1 de 3 • Conta Bancária
                </span>
                <h3 className="text-xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-fin-primary" />
                  Como funciona a Conta Bancária
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-fin-muted leading-relaxed">
                  No onboarding inicial, você informa sua conta principal ou carteira. Ela define
                  seu saldo de abertura e abriga os recebimentos do mês.
                </p>
              </div>

              {/* Status Real */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  Você já possui {onboardingStatus?.bankCount || 1} conta(s) bancária(s)
                  cadastrada(s).
                </span>
                <span className="text-emerald-700 font-bold">Concluído no sistema</span>
              </div>

              {/* Formulário Demonstrativo / Somente Leitura */}
              <div className="space-y-4 rounded-xl border border-fin-border bg-fin-surface/40 p-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                    Nome da instituição ou banco
                  </span>
                  <input
                    type="text"
                    value={bankName}
                    readOnly
                    className="field bg-white/80 cursor-default text-fin-text"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                      Saldo inicial demonstrativo
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-fin-muted font-medium">
                        R$
                      </span>
                      <input
                        type="text"
                        value={bankBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        readOnly
                        className="field pl-9 bg-white/80 cursor-default font-medium"
                      />
                    </div>
                  </label>

                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-fin-text mb-1">
                      Cor de identificação
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      {ACCOUNT_COLORS.map((c) => (
                        <div
                          key={c}
                          className="grid h-7 w-7 place-items-center rounded-full"
                          style={{ backgroundColor: c }}
                        >
                          {bankColor === c && (
                            <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 text-fin-primary" />
                  Dica de Boas Práticas:
                </p>
                <p className="leading-relaxed">
                  Para gerenciar ou adicionar novas contas reais (poupança, investimentos, etc.),
                  você pode acessar a tela principal de Dashboard a qualquer momento.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA 2: CARTÃO */}
          {activeStep === 2 && (
            <div className="space-y-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                  Etapa 2 de 3 • Cartão de Crédito
                </span>
                <h3 className="text-xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-fin-primary" />
                  Como funciona o Cartão de Crédito
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-fin-muted leading-relaxed">
                  Cadastrar o cartão permite agrupar suas faturas mensais, separar despesas à vista
                  de gastos a prazo e alimentar os alertas automáticos de vencimento.
                </p>
              </div>

              {/* Status Real */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  Você já possui {onboardingStatus?.cardCount || 1} cartão(ões) cadastrado(s).
                </span>
                <span className="text-emerald-700 font-bold">Concluído no sistema</span>
              </div>

              {/* Formulário Demonstrativo */}
              <div className="space-y-4 rounded-xl border border-fin-border bg-fin-surface/40 p-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                    Nome ou bandeira do cartão
                  </span>
                  <input
                    type="text"
                    value={cardName}
                    readOnly
                    className="field bg-white/80 cursor-default text-fin-text"
                  />
                </label>

                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-fin-text mb-1">
                    Cor de identificação
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    {ACCOUNT_COLORS.map((c) => (
                      <div
                        key={c}
                        className="grid h-7 w-7 place-items-center rounded-full"
                        style={{ backgroundColor: c }}
                      >
                        {cardColor === c && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 text-fin-primary" />
                  Dica de Boas Práticas:
                </p>
                <p className="leading-relaxed">
                  Os gastos no cartão entram automaticamente nos lembretes de fatura e ajudam a
                  prever seu fluxo de caixa na aba <strong>Contas a Pagar</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA 3: LANÇAMENTO */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fin-primary uppercase tracking-wider mb-1">
                  Etapa 3 de 3 • Primeiro Lançamento
                </span>
                <h3 className="text-xl font-bold tracking-tight text-fin-text flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-fin-primary" />
                  Como funciona o Primeiro Lançamento
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-fin-muted leading-relaxed">
                  O registro de transações alimenta o motor de categorização automática e os
                  relatórios mensais gerados por Inteligência Artificial.
                </p>
              </div>

              {/* Status Real */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  Você já registrou {onboardingStatus?.transactionCount || 1} movimentação(ões).
                </span>
                <span className="text-emerald-700 font-bold">Concluído no sistema</span>
              </div>

              {/* Formulário Demonstrativo */}
              <div className="space-y-3.5 rounded-xl border border-fin-border bg-fin-surface/40 p-4">
                <div className="grid grid-cols-2 rounded-lg bg-fin-surface p-1 border border-fin-border">
                  <div
                    className={cn(
                      'py-1.5 text-center text-xs font-semibold rounded-md transition',
                      txType === 'receita'
                        ? 'bg-white text-fin-success shadow-sm'
                        : 'text-fin-muted',
                    )}
                  >
                    + Receita (Entrada)
                  </div>
                  <div
                    className={cn(
                      'py-1.5 text-center text-xs font-semibold rounded-md transition',
                      txType === 'despesa'
                        ? 'bg-white text-fin-danger shadow-sm'
                        : 'text-fin-muted',
                    )}
                  >
                    - Despesa (Saída)
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                      Valor demonstrativo
                    </span>
                    <input
                      type="text"
                      value={`R$ ${txAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      readOnly
                      className="field bg-white/80 cursor-default font-semibold text-fin-danger"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                      Data
                    </span>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-fin-muted" />
                      <input
                        type="date"
                        value={txDate}
                        readOnly
                        className="field pl-10 bg-white/80 cursor-default"
                      />
                    </div>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                    Descrição
                  </span>
                  <input
                    type="text"
                    value={txDescription}
                    readOnly
                    className="field bg-white/80 cursor-default"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                      Categoria
                    </span>
                    <input
                      type="text"
                      value={txCategoryName}
                      readOnly
                      className="field bg-white/80 cursor-default"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-fin-text">
                      Conta
                    </span>
                    <input
                      type="text"
                      value={txAccountName}
                      readOnly
                      className="field bg-white/80 cursor-default"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: CONCLUSÃO */}
          {activeStep === 4 && (
            <div className="text-center py-2 space-y-5">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
                <CheckCircle2 className="h-8 w-8 stroke-[2.2]" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 mb-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tour finalizado com sucesso!
                </span>
                <h3 className="text-xl font-bold tracking-tight text-fin-text">
                  Você concluiu a revisão do Onboarding
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-fin-muted max-w-md mx-auto leading-relaxed">
                  Seu ambiente de trabalho em <strong>Finanças Inteligentes</strong> continua
                  completamente configurado e suas automações estão operando normalmente.
                </p>
              </div>

              {/* Resumo visual seguro */}
              <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-4 text-left max-w-md mx-auto space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-2 text-emerald-700">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    Contas Bancárias
                  </span>
                  <span className="text-fin-muted">{onboardingStatus?.bankCount || 1} ativas</span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-2 text-emerald-700">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    Cartões de Crédito
                  </span>
                  <span className="text-fin-muted">
                    {onboardingStatus?.cardCount || 1} configurados
                  </span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-2 text-emerald-700">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    Lançamentos Reais
                  </span>
                  <span className="text-fin-muted">
                    {onboardingStatus?.transactionCount || 1} registros
                  </span>
                </div>
              </div>

              {/* Resumo de automações ativas */}
              <div className="rounded-xl border border-indigo-100 bg-[#F4F4FD] p-3.5 text-left max-w-md mx-auto text-xs text-indigo-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-fin-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Automações ativas na sua conta ({user?.email}):
                </p>
                <p className="text-fin-muted leading-relaxed text-[11px]">
                  • Lembretes diários de contas matinais com antecedência configurada.
                  <br />• Fechamento financeiro inteligente com modelo de IA todo dia 1º.
                  <br />• Relatórios analíticos e balanços em tempo real.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal com Navegação */}
        <div className="border-t border-fin-border bg-fin-surface/40 px-6 py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Sair do tour
            </button>

            {activeStep > 1 && (
              <button
                type="button"
                onClick={handleRestart}
                className="text-xs text-fin-muted hover:text-fin-text inline-flex items-center gap-1 px-2 py-1"
                title="Reiniciar tour do início"
              >
                <RotateCcw className="h-3 w-3" />
                Reiniciar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeStep > 1 && activeStep < 4 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => prev - 1)}
                className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
            )}

            {activeStep < 3 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => prev + 1)}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                Próxima etapa
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {activeStep === 3 && (
              <button
                type="button"
                onClick={() => setActiveStep(4)}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                Finalizar revisão
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {activeStep === 4 && (
              <button
                type="button"
                onClick={handleClose}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Fechar tour
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
