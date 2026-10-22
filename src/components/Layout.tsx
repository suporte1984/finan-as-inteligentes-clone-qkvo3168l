import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FolderTree,
  Home,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Repeat,
  Bot,
  Search,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { FinanceProvider, useFinance } from '@/contexts/FinanceContext'
import { getCategoryDescendantIds } from '@/lib/categories'
import { daysUntil, escapeFilter } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { listBills } from '@/services/bills'
import { listTransactions } from '@/services/transactions'
import type { Bill, Transaction, TransactionType } from '@/types/finance'
import { TransactionModal } from '@/components/finance/TransactionModal'

const navItems = [
  { to: '/', label: 'Início', icon: Home, exact: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: ReceiptText },
  { to: '/contas', label: 'Contas', icon: CreditCard },
  { to: '/recorrentes', label: 'Recorrentes', icon: Repeat },
  { to: '/categorias', label: 'Categorias', icon: FolderTree },
  { to: '/assistente', label: 'Assistente IA', icon: Bot },
  { to: '/relatorios', label: 'Relatórios', icon: Sparkles },
  { to: '/usuarios', label: 'Usuários', icon: Users },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function openGlobalTransaction(type: TransactionType = 'despesa') {
  window.dispatchEvent(new CustomEvent('finance:new-transaction', { detail: { type } }))
}

export default function Layout() {
  return <AppShell />
}

function AppShell() {
  const { user, logout } = useAuth()
  const { categories } = useFinance()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [defaultType, setDefaultType] = useState<TransactionType>('despesa')
  const [bills, setBills] = useState<Bill[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Transaction[]>([])
  const [searching, setSearching] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileName, setProfileName] = useState(String(user?.name || ''))

  const reloadBills = () =>
    listBills()
      .then(setBills)
      .catch(() => setBills([]))
  useEffect(() => {
    void reloadBills()
  }, [])
  useRealtime<Bill>('bills', () => {
    void reloadBills()
  })

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: TransactionType }>).detail
      setDefaultType(detail?.type || 'despesa')
      setTransactionOpen(true)
    }
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('finance:new-transaction', handler)
    window.addEventListener('keydown', keyboard)
    return () => {
      window.removeEventListener('finance:new-transaction', handler)
      window.removeEventListener('keydown', keyboard)
    }
  }, [])

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      const safe = escapeFilter(query.trim())
      try {
        // Encontra categorias cujo nome combine com o termo digitado
        const matchingCategories = categories.filter((c) =>
          c.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
        )
        // Coleta todos os IDs descendentes das categorias coincidentes
        const relevantCategoryIds = new Set<string>()
        for (const cat of matchingCategories) {
          for (const id of getCategoryDescendantIds(cat.id, categories)) {
            relevantCategoryIds.add(id)
          }
        }

        // Constrói filtro PocketBase combinando busca por descrição, notas e IDs de categorias
        const filterParts = [`description ~ '${safe}'`, `notes ~ '${safe}'`]
        if (relevantCategoryIds.size > 0) {
          const categoryFilter = Array.from(relevantCategoryIds)
            .map((id) => `category = '${escapeFilter(id)}'`)
            .join(' || ')
          filterParts.push(`(${categoryFilter})`)
        }

        setResults((await listTransactions(`(${filterParts.join(' || ')})`)).slice(0, 8))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, searchOpen, categories])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const overdue = bills.filter(
    (bill) =>
      bill.status === 'atrasado' || (bill.status === 'em_aberto' && daysUntil(bill.due_date) < 0),
  ).length
  const nextSeven = bills.filter(
    (bill) =>
      bill.status === 'em_aberto' && daysUntil(bill.due_date) >= 0 && daysUntil(bill.due_date) <= 7,
  ).length
  const firstName = String(user?.name || user?.email || 'Usuário').split(' ')[0]
  const initials = String(user?.name || user?.email || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  async function saveProfile() {
    if (!user || !profileName.trim()) return
    try {
      await pb.collection('users').update(user.id, { name: profileName.trim() })
      await pb.collection('users').authRefresh()
      setSettingsOpen(false)
      toast({ title: 'Perfil atualizado', description: 'Seu nome foi salvo com sucesso.' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar',
        description: 'Tente novamente em instantes.',
      })
    }
  }

  const sidebar = (
    <Sidebar
      user={user}
      overdue={overdue}
      nextSeven={nextSeven}
      onSupport={() => setSupportOpen(true)}
      onManageUsers={() => navigate('/usuarios')}
      onOpenSettings={() => navigate('/configuracoes')}
    />
  )

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-fin-text">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-fin-border bg-[#f8f9fb] lg:block shadow-xs">
        {sidebar}
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-fin-text/25 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative h-full w-[86vw] max-w-72 border-r border-fin-border bg-fin-sidebar shadow-xl">
            <button
              className="absolute right-4 top-5 rounded-lg p-2 text-fin-muted hover:bg-white"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="fixed left-0 right-0 top-0 z-30 flex h-[76px] items-center gap-3 border-b border-fin-border bg-white/95 px-4 backdrop-blur md:px-7 lg:left-64">
        <button
          className="rounded-xl border border-fin-border p-2.5 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="group flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-fin-border bg-white px-3 text-left text-sm text-fin-muted shadow-[0_1px_2px_rgba(25,25,39,.03)] transition hover:border-fin-primary/40 md:max-w-xl"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Buscar lançamentos...</span>
          <kbd className="ml-auto hidden rounded-md border border-fin-border bg-fin-surface px-2 py-0.5 text-xs text-fin-muted sm:block">
            ⌘ K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => {
              setDefaultType('despesa')
              setTransactionOpen(true)
            }}
            className="btn-primary hidden md:flex"
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
          <button
            onClick={() => navigate('/contas?status=atrasadas')}
            className="relative rounded-full bg-fin-surface p-3 text-fin-muted transition hover:text-fin-primary"
            aria-label={`${overdue} notificações`}
          >
            <Bell className="h-5 w-5" />
            {overdue > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-fin-danger px-1 text-[10px] font-bold text-white">
                {overdue}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 transition hover:bg-fin-surface">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-fin-text text-xs font-bold text-white">
                  {initials}
                </span>
                <ChevronDown className="hidden h-4 w-4 text-fin-muted sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-fin-border">
              <DropdownMenuLabel>
                <span className="block text-sm">{user?.name || firstName}</span>
                <span className="block truncate text-xs font-normal text-fin-muted">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigate('/usuarios')
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Gerenciar usuários
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigate('/configuracoes')
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setProfileName(String(user?.name || ''))
                  setSettingsOpen(true)
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Editar perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="text-fin-danger"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="min-h-screen bg-[#f4f5f8] pt-[76px] lg:pl-64">
        <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <button
        onClick={() => {
          setDefaultType('despesa')
          setTransactionOpen(true)
        }}
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-fin-primary text-white shadow-[0_8px_24px_rgba(91,95,239,.35)] md:hidden"
        aria-label="Novo lançamento"
      >
        <Plus className="h-6 w-6" />
      </button>

      <TransactionModal
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        defaultType={defaultType}
        onSaved={(_saved, result) => {
          if (result?.recurringTransaction) {
            toast({
              title: 'Lançamento e recorrência criados!',
              description: 'O lançamento foi registrado e adicionado à lista de Recorrentes.',
            })
          } else {
            toast({
              title: 'Lançamento salvo',
              description: 'Seu saldo foi atualizado em tempo real.',
            })
          }
        }}
      />
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={query}
        setQuery={setQuery}
        results={results}
        searching={searching}
        onSelect={(result) => {
          setSearchOpen(false)
          navigate(`/lancamentos?q=${encodeURIComponent(result.description)}`)
        }}
      />
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="border-fin-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuda & Suporte</DialogTitle>
            <DialogDescription>Precisa de ajuda para organizar suas finanças?</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-fin-surface p-4 text-sm leading-6 text-fin-muted">
            <p className="font-medium text-fin-text">Atendimento Finanças Inteligentes</p>
            <p>
              Envie uma mensagem para suporte@financasinteligentes.com.br. Respondemos em até um dia
              útil.
            </p>
          </div>
          <a className="btn-primary w-full" href="mailto:suporte@financasinteligentes.com.br">
            <CircleHelp className="h-4 w-4" />
            Falar com o suporte
          </a>
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border-fin-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do perfil</DialogTitle>
            <DialogDescription>Atualize como seu nome aparece no sistema.</DialogDescription>
          </DialogHeader>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium">Nome</span>
            <input
              className="field"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium">E-mail</span>
            <input className="field bg-fin-surface" value={String(user?.email || '')} disabled />
          </label>
          <button className="btn-primary w-full" onClick={() => void saveProfile()}>
            Salvar configurações
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Sidebar({
  user,
  overdue,
  nextSeven,
  onSupport,
  onManageUsers,
  onOpenSettings,
}: {
  user: import('pocketbase').RecordModel | null
  overdue: number
  nextSeven: number
  onSupport: () => void
  onManageUsers: () => void
  onOpenSettings: () => void
}) {
  const name = String(user?.name || user?.email || 'Usuário')
  const email = String(user?.email || '')
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-6 [scrollbar-width:thin] [scrollbar-color:#E5E7EB_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-fin-border">
      <NavLink to="/" className="mb-6 flex shrink-0 items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-fin-text text-white shadow-sm">
          <WalletCards className="h-5 w-5" />
        </span>
        <span className="max-w-[150px] text-[15px] font-bold leading-tight tracking-tight">
          Finanças
          <br />
          Inteligentes
        </span>
      </NavLink>
      <nav className="shrink-0 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-[#EEEEF8] text-fin-primary' : 'text-fin-muted hover:bg-white hover:text-fin-text'}`
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mx-2 my-5 h-px shrink-0 bg-fin-border" />
      <div className="shrink-0">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.12em] text-fin-muted">
          Resumo
        </p>
        <NavLink
          to="/contas?status=atrasadas"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-fin-muted hover:bg-white"
        >
          <span>Atrasadas</span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${overdue ? 'bg-red-50 text-fin-danger' : 'bg-white text-fin-muted'}`}
          >
            {overdue}
          </span>
        </NavLink>
        <NavLink
          to="/contas?status=em_aberto"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-fin-muted hover:bg-white"
        >
          <span>A vencer (7 dias)</span>
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-fin-primary">
            {nextSeven}
          </span>
        </NavLink>
      </div>
      {/* Card do Usuário Conectado */}
      <div className="mt-auto shrink-0 pt-5 border-t border-fin-border">
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm border border-fin-border/60">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-fin-text text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-fin-text">{name}</p>
            <p className="truncate text-[11px] text-fin-muted">{email}</p>
          </div>
        </div>
        <button
          onClick={onManageUsers}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-fin-primary hover:bg-white transition"
        >
          <Users className="h-4 w-4" />
          Gerenciar usuários
        </button>
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-fin-muted transition hover:bg-white hover:text-fin-text"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </button>
        <button
          onClick={onSupport}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-fin-muted transition hover:bg-white hover:text-fin-text"
        >
          <CircleHelp className="h-4 w-4" />
          Ajuda & Suporte
        </button>
      </div>
    </div>
  )
}

function SearchDialog({
  open,
  onOpenChange,
  query,
  setQuery,
  results,
  searching,
  onSelect,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  query: string
  setQuery: (value: string) => void
  results: Transaction[]
  searching: boolean
  onSelect: (transaction: Transaction) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden border-fin-border p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <div className="relative flex items-center border-b border-fin-border pl-4 pr-12">
          <Search className="mr-3 h-5 w-5 shrink-0 text-fin-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            className="h-14 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar por descrição..."
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {searching && (
            <div className="space-y-2 p-3">
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
            </div>
          )}
          {!searching && query.length < 2 && (
            <div className="py-8 text-center">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-fin-surface text-fin-muted">
                <Search className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-fin-text">Buscar no seu histórico</p>
              <p className="mt-1 text-xs text-fin-muted">
                Digite ao menos 2 caracteres para encontrar lançamentos por descrição ou categoria.
              </p>
            </div>
          )}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-fin-surface text-fin-muted">
                <ReceiptText className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-fin-text">Nenhum lançamento encontrado</p>
              <p className="mt-1 text-xs text-fin-muted">
                Não encontramos transações correspondentes a &ldquo;{query}&rdquo;.
              </p>
            </div>
          )}
          {!searching &&
            results.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelect(result)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-fin-surface"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    result.type === 'receita'
                      ? 'fin-badge-success !border-0'
                      : 'fin-badge-danger !border-0'
                  }`}
                >
                  <ReceiptText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fin-text">
                    {result.description}
                  </span>
                  <span className="text-xs text-fin-muted">
                    {result.expand?.category?.name || 'Lançamento'}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
