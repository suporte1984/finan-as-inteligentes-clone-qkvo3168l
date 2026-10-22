import type { RecordModel } from 'pocketbase'

export type TransactionType = 'receita' | 'despesa'
export type AccountType = 'carteira' | 'banco' | 'cartao'
export type BillDirection = 'pagar' | 'receber'
export type BillStatus = 'em_aberto' | 'pago' | 'atrasado'

export interface Account extends RecordModel {
  name: string
  type: AccountType
  initial_balance: number
  color: string
  user: string
}

export interface Category extends RecordModel {
  name: string
  type: TransactionType
  color: string
  parent?: string
  user: string
}

export interface Transaction extends RecordModel {
  description: string
  amount: number
  type: TransactionType
  date: string
  category: string
  account: string
  attachment?: string
  notes?: string
  user: string
  expand?: {
    category?: Category
    account?: Account
  }
}

export interface Bill extends RecordModel {
  description: string
  amount: number
  direction: BillDirection
  due_date: string
  status: BillStatus
  category?: string
  account?: string
  transaction?: string
  user: string
  expand?: {
    category?: Category
    account?: Account
    transaction?: Transaction
  }
}

export interface RecurringExpense {
  description: string
  alternativeDescriptions?: string[]
  amount: number
  months: string[]
  occurrences?: number
  category?: string
}

export interface CategoryVariation {
  category: string
  current: number
  average: number
  diff: number
  percentChange: number
}

export interface BudgetStatusInsight {
  category: string
  limit: number
  spent: number
  percent: number
  status: 'normal' | 'alerta_80' | 'estourada'
  overAmount: number
}

export interface AiInsights {
  recurring?: RecurringExpense[]
  suggestions?: string[]
  comparison?: {
    previousMonth?: string
    priorMonths?: string[]
    income?: number
    expenses?: number
    expenseVariationPercent?: number
    incomeAverage?: number
    expensesAverage?: number
    incomeVariationPercent?: number
    topIncreases?: CategoryVariation[]
  }
  budgets?: BudgetStatusInsight[]
  categoryTotals?: Record<string, number>
  avgCategoryExpenses?: Record<string, number>
}

export type AiReportSource = 'manual' | 'auto'

export interface AiReport extends RecordModel {
  month: string
  summary: string
  insights: AiInsights
  user: string
  source?: AiReportSource
  cached?: boolean
  skipped?: boolean
  message?: string
}

export type RecurrencePeriodType = 'frequencia' | 'parcelas'

export interface TransactionRecurrenceConfig {
  enabled: boolean
  mode: RecurrencePeriodType // 'frequencia' (contínuo/período) ou 'parcelas' (quantidade fixa)
  frequency: RecurringFrequency // 'mensal' | 'semanal' | 'quinzenal' | 'anual'
  day_of_month?: number
  installmentsCount?: number // ex: 2 a 96 parcelas
  installmentAmountType?: 'total' | 'parcela' // se o valor informado no form é o total ou o valor de cada parcela
  endDate?: string // opcional para modo frequência
}

export interface TransactionInput {
  description: string
  amount: number
  type: TransactionType
  date: string
  category: string
  account: string
  notes?: string
  attachment?: File | null
  recurrence?: TransactionRecurrenceConfig
}

export interface BillInput {
  description: string
  amount: number
  direction: BillDirection
  due_date: string
  status: BillStatus
  category?: string
  account?: string
}

export interface Budget extends RecordModel {
  category: string
  monthly_limit: number
  user: string
  expand?: {
    category?: Category
  }
}

export interface BudgetInput {
  category: string
  monthly_limit: number
}

export type RecurringFrequency = 'mensal' | 'semanal' | 'quinzenal' | 'anual'

export interface RecurringTransaction extends RecordModel {
  description: string
  amount: number
  type: TransactionType
  frequency: RecurringFrequency
  day_of_month?: number
  start_date: string
  end_date?: string
  last_run?: string
  category: string
  account: string
  active: boolean
  user: string
  expand?: {
    category?: Category
    account?: Account
  }
}

export interface RecurringTransactionInput {
  description: string
  amount: number
  type: TransactionType
  frequency: RecurringFrequency
  day_of_month?: number
  start_date: string
  end_date?: string
  category: string
  account: string
  active?: boolean
}

export interface CategoryInput {
  name: string
  type: TransactionType
  color: string
  parent?: string
}

export interface AccountInput {
  name: string
  type: AccountType
  initial_balance: number
  color: string
}

export interface UserProfile extends RecordModel {
  user: string
  name: string
  email: string
  active: boolean
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
}

export interface UpdateUserInput {
  profileId: string
  name: string
  email: string
  active?: boolean
  password?: string
}

export type EmailNotificationType = 'lembrete_contas' | 'resumo_ia'
export type EmailNotificationStatus = 'enviado' | 'falhou' | 'pulado'

export interface EmailNotification extends RecordModel {
  user: string
  type: EmailNotificationType
  recipient: string
  items_count?: number
  status: EmailNotificationStatus
  subject?: string
  error_message?: string
}

export interface UserSettings extends RecordModel {
  user: string
  bills_reminder_enabled: boolean
  bills_reminder_days: number
  bills_reminder_hour?: number
  ai_report_auto_enabled: boolean
  ai_report_notify_email: boolean
  ai_report_hour?: number
  custom_recipient?: string
}

export interface UserSettingsInput {
  bills_reminder_enabled?: boolean
  bills_reminder_days?: number
  bills_reminder_hour?: number
  ai_report_auto_enabled?: boolean
  ai_report_notify_email?: boolean
  ai_report_hour?: number
  custom_recipient?: string
}
