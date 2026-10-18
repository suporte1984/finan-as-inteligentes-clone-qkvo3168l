import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  History,
  Info,
  Loader2,
  Mail,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getUserSettings, updateUserSettings } from '@/services/settings'
import { sendBillsDueReminders } from '@/services/bills'
import { listEmailNotifications } from '@/services/emailNotifications'
import { TourModal } from '@/components/finance/TourModal'
import type { EmailNotification, UserSettings } from '@/types/finance'

const DUE_DAYS_OPTIONS = [
  {
    days: 1,
    title: '1 dia de antecedência',
    desc: 'Alerta na véspera do vencimento (ideal para pagamentos rápidos via Pix)',
  },
  {
    days: 3,
    title: '3 dias de antecedência (recomendado)',
    desc: 'Tempo hábil para agendar boletos e transferências sem risco de atraso',
  },
  {
    days: 5,
    title: '5 dias de antecedência',
    desc: 'Maior folga para planejamento financeiro antes do vencimento',
  },
  {
    days: 7,
    title: '7 dias de antecedência',
    desc: 'Visão semanal antecipada de todos os compromissos futuros',
  },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)

  // Estados locais do formulário
  const [billsReminderEnabled, setBillsReminderEnabled] = useState(true)
  const [billsReminderDays, setBillsReminderDays] = useState(3)
  const [billsReminderHour, setBillsReminderHour] = useState(9)
  const [aiReportAutoEnabled, setAiReportAutoEnabled] = useState(true)
  const [aiReportNotifyEmail, setAiReportNotifyEmail] = useState(false)
  const [aiReportHour, setAiReportHour] = useState(9)
  const [customRecipient, setCustomRecipient] = useState('')
  const [customRecipientError, setCustomRecipientError] = useState('')

  // Histórico de disparos
  const [historyList, setHistoryList] = useState<EmailNotification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Feedback de cópia DNS
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Controle de exibição do Tour Guiado (Modo Demonstração)
  const [tourOpen, setTourOpen] = useState(false)

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast({
      title: 'Copiado para a área de transferência',
      description: text,
    })
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr))
    }, 2000)
  }

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true)
      const data = await listEmailNotifications({ limit: 15 })
      setHistoryList(data)
    } catch {
      // Falha silenciosa no refresh de histórico
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const data = await getUserSettings()
        if (!mounted) return
        setSettings(data)
        setBillsReminderEnabled(data.bills_reminder_enabled ?? true)
        setBillsReminderDays(data.bills_reminder_days || 3)
        setBillsReminderHour(
          data.bills_reminder_hour !== undefined && data.bills_reminder_hour !== null
            ? data.bills_reminder_hour
            : 9,
        )
        setAiReportAutoEnabled(data.ai_report_auto_enabled ?? true)
        setAiReportHour(
          data.ai_report_hour !== undefined && data.ai_report_hour !== null
            ? data.ai_report_hour
            : 9,
        )
        setAiReportNotifyEmail(data.ai_report_notify_email ?? false)
        setCustomRecipient(data.custom_recipient || '')

        // Carregar histórico
        const historyData = await listEmailNotifications({ limit: 15 })
        if (mounted) {
          setHistoryList(historyData)
        }
      } catch (err: unknown) {
        if (!mounted) return
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar configurações',
          description:
            (err as { message?: string })?.message ||
            'Não foi possível obter suas configurações atuais.',
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [toast])

  const validateEmail = (val: string): boolean => {
    if (!val || !val.trim()) return true
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(val.trim())
  }

  const handleCustomRecipientChange = (val: string) => {
    setCustomRecipient(val)
    if (val && !validateEmail(val)) {
      setCustomRecipientError('Formato de e-mail inválido (exemplo: usuario@dominio.com)')
    } else {
      setCustomRecipientError('')
    }
  }

  const handleSave = async () => {
    if (!settings) return

    const trimmedRecipient = customRecipient.trim()
    if (trimmedRecipient && !validateEmail(trimmedRecipient)) {
      setCustomRecipientError('Por favor, informe um e-mail válido antes de salvar.')
      toast({
        variant: 'destructive',
        title: 'E-mail inválido',
        description: 'Verifique o e-mail alternativo digitado no campo "Enviar para".',
      })
      return
    }

    try {
      setSaving(true)
      const updated = await updateUserSettings(settings.id, {
        bills_reminder_enabled: billsReminderEnabled,
        bills_reminder_days: billsReminderDays,
        bills_reminder_hour: billsReminderHour,
        ai_report_auto_enabled: aiReportAutoEnabled,
        ai_report_notify_email: aiReportNotifyEmail,
        ai_report_hour: aiReportHour,
        custom_recipient: trimmedRecipient,
      })
      setSettings(updated)
      setCustomRecipient(updated.custom_recipient || '')
      setCustomRecipientError('')
      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências de destinatário, automação e e-mails foram atualizadas.',
      })
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description:
          (err as { message?: string })?.message || 'Não foi possível salvar suas preferências.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestReminders = async () => {
    try {
      setTestingEmail(true)
      const res = await sendBillsDueReminders()
      toast({
        title: 'Disparo executado',
        description: res.message || 'Verificação executada com sucesso.',
      })
      // Atualiza o histórico após disparo manual
      setTimeout(() => {
        void loadHistory()
      }, 800)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Falha no teste',
        description:
          (err as { message?: string })?.message || 'Não foi possível enviar o e-mail de teste.',
      })
    } finally {
      setTestingEmail(false)
    }
  }

  // Formatar data/hora no fuso de Brasília
  const formatDateTimeBR = (isoStr: string) => {
    if (!isoStr) return '-'
    try {
      const d = new Date(isoStr.replace(' ', 'T'))
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(d)
    } catch {
      return isoStr.slice(0, 16)
    }
  }

  const defaultAccountEmail = user?.email || 'seu-email-de-cadastro'
  const effectiveRecipient = customRecipient.trim() || defaultAccountEmail

  return (
    <div className="space-y-8 pb-12 page-container-narrow">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-fin-text sm:text-3xl">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-fin-text text-white">
              <SettingsIcon className="h-5 w-5" />
            </span>
            Configurações
          </h1>
          <p className="mt-1 text-sm text-fin-muted">
            Personalize destinatários, disparos automáticos por e-mail, relatórios com IA e regras
            anti-spam.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => void handleSave()}
            disabled={loading || saving}
            className="btn-primary self-start sm:self-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-[300px] place-items-center fin-card p-8">
          <div className="flex flex-col items-center gap-3 text-fin-muted">
            <Loader2 className="h-8 w-8 animate-spin text-fin-primary" />
            <p className="text-sm">Carregando preferências...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* SEÇÃO AJUDA & TOUR DO SISTEMA */}
          <div className="fin-card p-6 sm:p-7 border-indigo-100 bg-gradient-to-r from-white via-white to-indigo-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
                  <Compass className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                      Ajuda & Tour do Sistema
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      <Sparkles className="h-3 w-3" />
                      Modo Demonstração
                    </span>
                  </div>
                  <p className="text-sm text-fin-muted mt-0.5">
                    Reviva o passo a passo inicial de 3 etapas (banco, cartão e primeiro lançamento)
                    sem alterar seus dados já cadastrados.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTourOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-fin-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-fin-primary/90 transition shrink-0"
              >
                <PlayCircle className="h-4 w-4" />
                Refazer tour de apresentação
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-fin-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-fin-muted">
              <span>
                💡 Ideal para relembrar como o fluxo foi pensado ou apresentar o Finanças
                Inteligentes para outra pessoa.
              </span>
              <span className="font-medium text-fin-text">100% seguro • Somente leitura</span>
            </div>
          </div>

          {/* SEÇÃO DESTINATÁRIO PERSONALIZADO (ITEM 5) */}
          <div className="fin-card p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserCheck className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                  Destinatário dos e-mails
                </h2>
                <p className="text-sm text-fin-muted">
                  Defina para quem os lembretes de contas e resumos mensais de IA devem ser
                  enviados.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-fin-border pt-5">
              <div className="max-w-xl space-y-3">
                <label
                  htmlFor="custom-recipient-input"
                  className="block text-sm font-semibold text-fin-text"
                >
                  Enviar para (e-mail personalizado)
                </label>
                <div className="space-y-1.5">
                  <input
                    id="custom-recipient-input"
                    type="email"
                    value={customRecipient}
                    onChange={(e) => handleCustomRecipientChange(e.target.value)}
                    placeholder={`Deixe vazio para usar o e-mail de cadastro (${defaultAccountEmail})`}
                    className={`field font-medium ${
                      customRecipientError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                        : ''
                    }`}
                  />
                  {customRecipientError ? (
                    <p className="flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {customRecipientError}
                    </p>
                  ) : (
                    <p className="text-xs text-fin-muted leading-relaxed">
                      Opcional. Útil para encaminhar os lembretes para um contador, cônjuge ou caixa
                      corporativa. Se vazio, o sistema envia para o e-mail principal da sua conta.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-fin-surface p-3.5 border border-fin-border text-xs text-fin-muted flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fin-text">
                      Destinatário ativo nos disparos:
                    </span>
                    <span className="inline-flex items-center rounded-md bg-white px-2 py-1 font-mono text-[12px] font-semibold text-fin-primary border border-fin-border">
                      {effectiveRecipient}
                    </span>
                  </div>
                  {customRecipient.trim() && (
                    <button
                      type="button"
                      onClick={() => handleCustomRecipientChange('')}
                      className="text-xs text-fin-muted hover:text-fin-text underline"
                    >
                      Restaurar padrão
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: E-mails automáticos (Lembretes de contas a vencer) */}
          <div className="fin-card p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                    Lembretes diários de contas a vencer
                  </h2>
                  <p className="text-sm text-fin-muted">
                    Lembretes automáticos das suas contas pendentes e em atraso direto na caixa de
                    entrada.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 divide-y divide-fin-border border-t border-fin-border">
              {/* Toggle Principal de Contas */}
              <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fin-text">
                      Lembrete diário de contas a vencer
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-fin-primary">
                      <Clock className="h-3 w-3" />
                      Horário de Brasília: {String(billsReminderHour).padStart(2, '0')}:00
                    </span>
                  </div>
                  <p className="text-xs text-fin-muted leading-relaxed">
                    Quando ativado, o sistema envia diariamente um e-mail com a lista detalhada de
                    todas as contas a pagar e receber que estão atrasadas ou prestes a vencer.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={billsReminderEnabled}
                    onCheckedChange={setBillsReminderEnabled}
                    aria-label="Ativar lembrete diário de contas"
                  />
                  <span className="text-xs font-medium text-fin-muted sm:hidden">
                    {billsReminderEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Seletor de Horário do Lembrete de Contas */}
              <div
                className={`py-5 border-t border-fin-border transition-opacity ${
                  billsReminderEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-fin-text flex items-center gap-2">
                      <Clock className="h-4 w-4 text-fin-primary" />
                      Horário do disparo diário (fuso de Brasília, UTC−3)
                    </span>
                    <p className="text-xs text-fin-muted">
                      Escolha o melhor horário para receber o aviso matinal com suas contas do dia e
                      a vencer.
                    </p>
                  </div>
                  <div className="w-full sm:w-56">
                    <select
                      className="field font-medium"
                      value={billsReminderHour}
                      onChange={(e) => setBillsReminderHour(Number(e.target.value))}
                      disabled={!billsReminderEnabled}
                    >
                      <option value={7}>07:00 (Início da manhã)</option>
                      <option value={8}>08:00 (Manhã cedo)</option>
                      <option value={9}>09:00 (Padrão recomendado)</option>
                      <option value={10}>10:00 (Meio da manhã)</option>
                      <option value={12}>12:00 (Almoço)</option>
                      <option value={14}>14:00 (Início da tarde)</option>
                      <option value={18}>18:00 (Fim de tarde)</option>
                      <option value={20}>20:00 (Noite)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seletor de Antecedência em Dias */}
              <div
                className={`py-5 border-t border-fin-border transition-opacity ${
                  billsReminderEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
                }`}
              >
                <div className="mb-3 space-y-1">
                  <span className="text-sm font-semibold text-fin-text">
                    Antecedência do lembrete
                  </span>
                  <p className="text-xs text-fin-muted">
                    Defina quantos dias antes da data de vencimento uma conta começará a aparecer no
                    e-mail.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {DUE_DAYS_OPTIONS.map((opt) => {
                    const isSelected = billsReminderDays === opt.days
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setBillsReminderDays(opt.days)}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                          isSelected
                            ? 'border-fin-primary bg-[#F4F4FD] shadow-sm'
                            : 'border-fin-border bg-white hover:border-fin-primary/40'
                        }`}
                      >
                        <div
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                            isSelected
                              ? 'border-fin-primary bg-fin-primary text-white'
                              : 'border-fin-border bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold ${
                              isSelected ? 'text-fin-primary' : 'text-fin-text'
                            }`}
                          >
                            {opt.title}
                          </p>
                          <p className="mt-0.5 text-xs text-fin-muted leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ação de Teste Manual */}
              <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-fin-text">
                    Testar envio de lembretes agora
                  </span>
                  <p className="text-xs text-fin-muted">
                    Dispara uma verificação imediata para <strong>{effectiveRecipient}</strong> e
                    registra a notificação no histórico abaixo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleTestReminders()}
                  disabled={testingEmail}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-fin-border bg-white px-3.5 py-2 text-xs font-medium text-fin-text transition hover:bg-fin-surface hover:text-fin-primary disabled:opacity-50"
                >
                  {testingEmail ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando teste...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Enviar lembrete agora
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Relatório de IA (Fechamento mensal e notificações) */}
          <div className="fin-card p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                    Fechamento financeiro com IA
                  </h2>
                  <p className="text-sm text-fin-muted">
                    Análise inteligente de hábitos, metas estouradas, variações de categorias e
                    sugestões de economia geradas automaticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 divide-y divide-fin-border border-t border-fin-border">
              {/* Toggle Fechamento Automático Mensal */}
              <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fin-text">
                      Fechamento automático mensal
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                      <Clock className="h-3 w-3" />
                      Dia 1º às {String(aiReportHour).padStart(2, '0')}:00 (BRT)
                    </span>
                  </div>
                  <p className="text-xs text-fin-muted leading-relaxed">
                    Todo dia 1º, a Inteligência Artificial compila o fechamento do mês anterior,
                    compara com a média dos últimos 3 meses e salva o relatório na aba Relatórios.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={aiReportAutoEnabled}
                    onCheckedChange={setAiReportAutoEnabled}
                    aria-label="Ativar fechamento automático mensal com IA"
                  />
                  <span className="text-xs font-medium text-fin-muted sm:hidden">
                    {aiReportAutoEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Seletor de Horário do Fechamento de IA */}
              <div
                className={`py-5 border-t border-fin-border transition-opacity ${
                  aiReportAutoEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-fin-text flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      Horário do fechamento mensal no dia 1º (BRT, UTC−3)
                    </span>
                    <p className="text-xs text-fin-muted">
                      Horário em que o modelo de IA processará seus lançamentos do mês anterior.
                    </p>
                  </div>
                  <div className="w-full sm:w-56">
                    <select
                      className="field font-medium"
                      value={aiReportHour}
                      onChange={(e) => setAiReportHour(Number(e.target.value))}
                      disabled={!aiReportAutoEnabled}
                    >
                      <option value={7}>07:00 (Início da manhã)</option>
                      <option value={8}>08:00 (Manhã cedo)</option>
                      <option value={9}>09:00 (Padrão recomendado)</option>
                      <option value={10}>10:00 (Meio da manhã)</option>
                      <option value={12}>12:00 (Almoço)</option>
                      <option value={14}>14:00 (Início da tarde)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Toggle Notificação por E-mail do Relatório */}
              <div
                className={`flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between transition-opacity ${
                  aiReportAutoEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
                }`}
              >
                <div className="max-w-xl space-y-1">
                  <span className="text-sm font-semibold text-fin-text">
                    Receber resumo por e-mail
                  </span>
                  <p className="text-xs text-fin-muted leading-relaxed">
                    Assim que o relatório mensal for gerado pela IA no dia 1º, envia um e-mail para{' '}
                    <strong>{effectiveRecipient}</strong> com o balanço do mês (receitas, despesas,
                    resultado), o texto de análise da IA e as recomendações práticas sugeridas.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={aiReportNotifyEmail}
                    onCheckedChange={setAiReportNotifyEmail}
                    disabled={!aiReportAutoEnabled}
                    aria-label="Receber resumo do relatório de IA por e-mail"
                  />
                  <span className="text-xs font-medium text-fin-muted sm:hidden">
                    {aiReportNotifyEmail ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: HISTÓRICO DE DISPAROS (ITEM 6) */}
          <div className="fin-card p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fin-surface text-fin-primary">
                  <History className="h-5 w-5" />{' '}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                    Histórico de disparos de e-mail
                  </h2>
                  <p className="text-sm text-fin-muted">
                    Registro detalhado dos últimos envios automáticos e manuais disparados pelo
                    sistema.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={loadingHistory}
                className="inline-flex items-center gap-2 rounded-xl border border-fin-border bg-white px-3 py-1.5 text-xs font-medium text-fin-text hover:bg-fin-surface disabled:opacity-50 self-start sm:self-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                Atualizar histórico
              </button>
            </div>

            <div className="mt-6 border-t border-fin-border pt-4">
              {loadingHistory && historyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-fin-muted">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-fin-primary mb-2" />
                  Carregando registros de envio...
                </div>
              ) : historyList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-fin-border bg-fin-surface/50 p-8 text-center">
                  <Mail className="mx-auto h-8 w-8 text-fin-muted/60" />
                  <p className="mt-2 text-sm font-medium text-fin-text">
                    Nenhum envio registrado até o momento
                  </p>
                  <p className="mt-1 text-xs text-fin-muted max-w-sm mx-auto">
                    Assim que o cron diário rodar ou você clicar em "Enviar lembrete agora", os
                    comprovantes de entrega aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-fin-border text-[11px] font-semibold text-fin-muted uppercase tracking-wider">
                        <th className="py-2.5 px-3">Data / Hora (BRT)</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Destinatário</th>
                        <th className="py-2.5 px-3">Qtd. / Detalhe</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fin-border">
                      {historyList.map((item) => {
                        const isSuccess = item.status === 'enviado'
                        const isSkipped = item.status === 'pulado'
                        const typeLabel =
                          item.type === 'lembrete_contas' ? 'Lembrete de Contas' : 'Resumo IA'
                        const typeBg =
                          item.type === 'lembrete_contas'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-purple-50 text-purple-700'

                        return (
                          <tr key={item.id} className="hover:bg-fin-surface/40 transition">
                            <td className="py-3 px-3 font-medium text-fin-text whitespace-nowrap">
                              {formatDateTimeBR(item.created)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md font-medium text-[11px] ${typeBg}`}
                              >
                                {typeLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-fin-muted font-mono whitespace-nowrap">
                              {item.recipient}
                            </td>
                            <td className="py-3 px-3 text-fin-text whitespace-nowrap">
                              {item.type === 'lembrete_contas'
                                ? `${item.items_count ?? 0} conta(s) incluída(s)`
                                : 'Fechamento mensal'}
                              {item.error_message && (
                                <p
                                  className="text-[11px] text-red-500 font-normal truncate max-w-xs"
                                  title={item.error_message}
                                >
                                  Erro: {item.error_message}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {isSuccess ? (
                                <span className="fin-badge fin-badge-success">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Enviado
                                </span>
                              ) : isSkipped ? (
                                <span className="fin-badge fin-badge-neutral">Pulado</span>
                              ) : (
                                <span
                                  className="fin-badge fin-badge-danger"
                                  title={item.error_message}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Falhou
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 4: DIAGNÓSTICO ANTI-SPAM & DNS (SPF / DKIM / DMARC) (ITEM 4) */}
          <div className="fin-card p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-fin-primary">
                <ShieldCheck className="h-5 w-5" />{' '}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-fin-text sm:text-lg">
                    Diagnóstico Anti-Spam & Configuração DNS (SPF / DKIM / DMARC)
                  </h2>
                </div>
                <p className="text-sm text-fin-muted mt-1 leading-relaxed">
                  Entenda por que e-mails transacionais podem cair na caixa de spam (Gmail/Outlook)
                  e como as medidas técnicas implementadas protegem seus envios.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-fin-border pt-5 space-y-6">
              {/* O que já foi aplicado nos e-mails */}
              <div>
                <h3 className="text-sm font-semibold text-fin-text mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Mitigações anti-spam automáticas ativas no backend
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-3.5 space-y-1">
                    <p className="font-semibold text-fin-text">Cabeçalho List-Unsubscribe</p>
                    <p className="text-fin-muted leading-relaxed">
                      Adicionado aos cabeçalhos com mailto e URL de cancelamento. Provedores como
                      Gmail e Yahoo exigem este cabeçalho para não classificar mensagens como spam.
                    </p>
                  </div>
                  <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-3.5 space-y-1">
                    <p className="font-semibold text-fin-text">
                      Versão alternativa em texto puro (multipart/alternative)
                    </p>
                    <p className="text-fin-muted leading-relaxed">
                      Mensagens com apenas código HTML têm pontuação alta em filtros bayesianos.
                      Nossos envios agora geram versão completa em texto simples sincronizada.
                    </p>
                  </div>
                  <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-3.5 space-y-1">
                    <p className="font-semibold text-fin-text">Remetente (FROM) consistente</p>
                    <p className="text-fin-muted leading-relaxed">
                      Remetente padronizado em todas as rotas e crons, evitando divergência de
                      domínio entre o envelope de envio e os cabeçalhos.
                    </p>
                  </div>
                  <div className="rounded-xl border border-fin-border bg-fin-surface/50 p-3.5 space-y-1">
                    <p className="font-semibold text-fin-text">
                      Rodapé informativo e aviso aos usuários
                    </p>
                    <p className="text-fin-muted leading-relaxed">
                      Link visível para o app e orientação expressa para adicionar o e-mail aos
                      contatos confiáveis e marcar como "Não é spam".
                    </p>
                  </div>
                </div>
              </div>

              {/* Instruções DNS para domínios próprios */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-3 text-xs leading-relaxed text-amber-900">
                    <div>
                      <p className="font-semibold text-sm text-amber-950">
                        Configuração de DNS no seu Provedor de Domínio (SPF, DKIM e DMARC)
                      </p>
                      <p className="mt-1 text-amber-800">
                        Se você conectar um servidor SMTP personalizado com seu próprio domínio no
                        PocketBase, adicione os seguintes registros TXT na zona de DNS (ex.:
                        Cloudflare, GoDaddy, Registro.br, Hostinger):
                      </p>
                    </div>

                    {/* Registros DNS recomendados */}
                    <div className="space-y-3 font-mono text-[11px] text-gray-800">
                      {/* SPF */}
                      <div className="rounded-lg bg-white p-3 border border-amber-200">
                        <div className="flex items-center justify-between mb-1 font-sans">
                          <span className="font-semibold text-fin-text text-xs">
                            1. Registro SPF (TXT na raiz @)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard('v=spf1 include:_spf.mx.yourprovider.com ~all', 'spf')
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-fin-primary hover:underline"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedKey === 'spf' ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-gray-600 font-sans mb-1 text-[11px]">
                          Autoriza o servidor SMTP a enviar em nome do seu domínio:
                        </p>
                        <code className="block bg-gray-50 p-2 rounded text-emerald-800 break-all select-all">
                          v=spf1 include:_spf.mx.yourprovider.com ~all
                        </code>
                      </div>

                      {/* DKIM */}
                      <div className="rounded-lg bg-white p-3 border border-amber-200">
                        <div className="flex items-center justify-between mb-1 font-sans">
                          <span className="font-semibold text-fin-text text-xs">
                            2. Assinatura DKIM (TXT com chave pública)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...',
                                'dkim',
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-fin-primary hover:underline"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedKey === 'dkim' ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-gray-600 font-sans mb-1 text-[11px]">
                          Gerado pelo seu serviço de e-mail (Resend, SendGrid, Amazon SES, Google
                          Workspace) para autenticar a assinatura digital criptográfica no seletor
                          (ex.: <code>default._domainkey</code>).
                        </p>
                        <code className="block bg-gray-50 p-2 rounded text-emerald-800 break-all select-all">
                          default._domainkey TXT "v=DKIM1; k=rsa; p=&lt;sua-chave-publica&gt;"
                        </code>
                      </div>

                      {/* DMARC */}
                      <div className="rounded-lg bg-white p-3 border border-amber-200">
                        <div className="flex items-center justify-between mb-1 font-sans">
                          <span className="font-semibold text-fin-text text-xs">
                            3. Política DMARC (TXT no subdomínio _dmarc)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@seudominio.com; pct=100',
                                'dmarc',
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-fin-primary hover:underline"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedKey === 'dmarc' ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-gray-600 font-sans mb-1 text-[11px]">
                          Instrui provedores de destino a quarentenar e-mails não assinados e envia
                          relatórios de conformidade:
                        </p>
                        <code className="block bg-gray-50 p-2 rounded text-emerald-800 break-all select-all">
                          _dmarc TXT "v=DMARC1; p=quarantine;
                          rua=mailto:dmarc-reports@seudominio.com; pct=100"
                        </code>
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-800 pt-1">
                      ⚠️ <strong>Atenção para o usuário final:</strong> Enquanto estiver no ambiente
                      padrão do PocketBase, lembre-se de clicar em <em>"Não é spam"</em> ou
                      adicionar o remetente aos contatos na primeira mensagem recebida. Esse sinal
                      de engajamento do leitor treina positivamente o filtro do Gmail e Outlook para
                      entregas futuras na Caixa de Entrada.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão inferior de salvar */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => void handleSave()}
              disabled={loading || saving}
              className="btn-primary w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando configurações...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar configurações
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal do Tour Guiado */}
      <TourModal open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  )
}
