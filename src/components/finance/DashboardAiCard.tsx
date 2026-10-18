import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, BrainCircuit, CornerDownLeft, FileText, Sparkles } from 'lucide-react'
import type { AiReport, Bill, Category, Transaction } from '@/types/finance'
import { brl, daysUntil, monthTitle } from '@/lib/format'

interface DashboardAiCardProps {
  currentMonthKey: string
  transactions: Transaction[]
  bills: Bill[]
  categories: Category[]
  aiReport: AiReport | null
  loadingReport?: boolean
}

interface ContextualSuggestion {
  label: string
  prompt: string
}

export function DashboardAiCard({
  currentMonthKey,
  transactions,
  bills,
  categories,
  aiReport,
  loadingReport,
}: DashboardAiCardProps) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')

  const handleAsk = (promptText?: string) => {
    const text = (promptText ?? question).trim()
    if (!text) {
      navigate('/assistente')
      return
    }
    navigate(`/assistente?q=${encodeURIComponent(text)}`)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleAsk()
  }

  // Gera 2 a 3 sugestões contextuais baseadas em dados reais do usuário
  const suggestions: ContextualSuggestion[] = []

  // 1. Maior categoria de despesa do mês corrente
  const categoryTotals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type === 'despesa') {
      const cat = categories.find((c) => c.id === t.category) || t.expand?.category
      const catName = cat?.name || 'Geral'
      categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + t.amount)
    }
  }

  const sortedCategories = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])
  if (sortedCategories.length > 0 && sortedCategories[0][1] > 0) {
    const [topCat, topVal] = sortedCategories[0]
    suggestions.push({
      label: `Como reduzir gastos em ${topCat}? (${brl.format(topVal)})`,
      prompt: `Minha maior despesa neste mês é em "${topCat}" totalizando ${brl.format(topVal)}. Como posso otimizar ou reduzir esse gasto?`,
    })
  }

  // 2. Contas a vencer na semana ou em atraso
  const pendingBills = bills.filter((b) => b.status === 'em_aberto' || b.status === 'atrasado')
  const overdueBills = pendingBills.filter(
    (b) => b.status === 'atrasado' || daysUntil(b.due_date) < 0,
  )
  const weekBills = pendingBills.filter((b) => {
    const d = daysUntil(b.due_date)
    return d >= 0 && d <= 7
  })

  if (overdueBills.length > 0) {
    const totalOverdue = overdueBills.reduce((acc, b) => acc + b.amount, 0)
    suggestions.push({
      label: `${overdueBills.length} conta(s) atrasada(s) (${brl.format(totalOverdue)})`,
      prompt: `Tenho ${overdueBills.length} conta(s) em atraso somando ${brl.format(totalOverdue)}. Me dê um plano para regularizar meus pagamentos prioritários.`,
    })
  } else if (weekBills.length > 0) {
    const totalWeek = weekBills.reduce((acc, b) => acc + b.amount, 0)
    suggestions.push({
      label: `Contas a vencer nos próximos 7 dias (${brl.format(totalWeek)})`,
      prompt: `Quais são minhas contas a vencer nesta semana (total de ${brl.format(totalWeek)}) e terei saldo suficiente para cobri-las?`,
    })
  }

  // 3. Comparação com mês anterior / média ou visão de economia
  if (suggestions.length < 3) {
    suggestions.push({
      label: 'Comparar gastos deste mês com mês anterior',
      prompt:
        'Compare minhas receitas e despesas deste mês com o mês passado e aponte os desvios mais relevantes.',
    })
  }

  if (suggestions.length < 3) {
    suggestions.push({
      label: 'Onde posso economizar nos próximos 30 dias?',
      prompt:
        'Com base no meu histórico de despesas e contas recorrentes, onde posso cortar despesas para economizar neste mês?',
    })
  }

  const finalSuggestions = suggestions.slice(0, 3)
  const currentMonthPretty = monthTitle(currentMonthKey)

  return (
    <article className="fin-card animate-fade-up stagger-1 relative overflow-hidden border border-fin-border/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-5 shadow-sm transition hover:shadow-md sm:p-6">
      {/* Detalhe estético sutil estilo Mercury */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-200/20 to-purple-200/20 blur-2xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Bloco esquerdo: título, badge e input */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fin-primary text-white shadow-xs">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-fin-text sm:text-lg">
                  Pergunte à IA
                </h2>
                <span className="fin-badge fin-badge-primary text-[10px] py-0 px-2 font-semibold">
                  Inteligência Nativa
                </span>
              </div>
              <p className="text-xs text-fin-muted">
                Tire dúvidas sobre seus lançamentos, fluxo de caixa, contas e receba dicas
                personalizadas.
              </p>
            </div>
          </div>

          {/* Campo de Pergunta Rápida */}
          <form onSubmit={onSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex: Quanto gastei com Alimentação? Ou peça uma análise..."
                className="field h-11 bg-white/90 pr-10 text-sm shadow-2xs focus:bg-white"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-fin-muted transition hover:bg-fin-surface hover:text-fin-primary"
                title="Perguntar ao Assistente"
              >
                <CornerDownLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              type="submit"
              className="btn-primary h-11 shrink-0 px-4 text-xs font-semibold sm:text-sm"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Perguntar</span>
            </button>
          </form>

          {/* Sugestões Rápidas Contextuais com Dados Reais */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fin-muted">
              Sugestões personalizadas com base nos seus dados:
            </p>
            <div className="flex flex-wrap gap-2">
              {finalSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAsk(s.prompt)}
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-fin-border/80 bg-white/90 px-3 py-1.5 text-xs text-fin-text shadow-2xs transition hover:border-fin-primary/40 hover:bg-indigo-50/50 hover:text-fin-primary"
                  title={s.prompt}
                >
                  <Sparkles className="h-3 w-3 text-fin-primary shrink-0" />
                  <span className="truncate max-w-[280px] sm:max-w-none">{s.label}</span>
                  <ArrowRight className="h-3 w-3 text-fin-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bloco direito: Teaser de Fechamento / Relatório Mensal de IA */}
        <div className="w-full shrink-0 rounded-2xl border border-fin-border/70 bg-white p-4 shadow-2xs lg:w-80">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fin-muted">
              <FileText className="h-3.5 w-3.5 text-fin-primary" />
              Fechamento com IA
            </span>
            <span className="text-[11px] font-medium text-fin-muted">{currentMonthPretty}</span>
          </div>

          {loadingReport ? (
            <div className="space-y-2 py-2">
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-4/5" />
              <div className="skeleton h-8 w-full rounded-xl mt-3" />
            </div>
          ) : aiReport && aiReport.summary ? (
            <div className="space-y-3">
              <p className="line-clamp-3 text-xs leading-relaxed text-fin-muted">
                {aiReport.summary}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/relatorios?month=${currentMonthKey}`)}
                className="group flex w-full items-center justify-between rounded-xl bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-fin-primary transition hover:bg-indigo-100/80"
              >
                <span>Ver fechamento completo</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed text-fin-muted">
                Feche o mês com Inteligência Artificial: balanço consolidado, detecção de padrões e
                sugestões de corte.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/relatorios?month=${currentMonthKey}`)}
                className="btn-secondary flex w-full items-center justify-center gap-2 !py-2 !text-xs font-medium text-fin-primary"
              >
                <Sparkles className="h-3.5 w-3.5 text-fin-primary" />
                Fechar mês com IA
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
