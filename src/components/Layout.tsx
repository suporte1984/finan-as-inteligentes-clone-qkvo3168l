import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FolderTree,
  Home,
  LogOut,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Repeat,
  Bot,
  Search,
  Settings,
  Sparkles,
  Sun,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useTheme } from '@/contexts/ThemeContext'
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
  const { theme, toggleTheme, isDark } = useTheme()
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

  // Estado recolhível da sidebar (persistente no localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('fin_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('fin_sidebar_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Barra superior recolhível no scroll (hide on scroll down, show on scroll up)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY
          const delta = currentY - lastScrollYRef.current

          setIsScrolled(currentY > 12)

          // Só recolhe quando já rolou um pouco da página
          if (currentY > 80) {
            if (delta > 8) {
              // Rolando para baixo
              setHeaderHidden(true)
            } else if (delta < -8) {
              // Rolando para cima
              setHeaderHidden(false)
            }
          } else {
            setHeaderHidden(false)
          }

          lastScrollYRef.current = currentY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-[var(--fin-bg-page)] text-fin-text transition-colors duration-200">
        {/* SIDEBAR FLUTUANTE E RECOLHÍVEL (DESKTOP) */}
        <aside
          aria-label="Menu principal"
          className={`fixed left-3 top-3 bottom-3 z-40 hidden flex-col rounded-2xl border border-fin-border bg-[var(--fin-bg-glass)] backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${
            sidebarCollapsed ? 'w-[72px]' : 'w-64'
          } shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.45)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.09)] dark:hover:shadow-[0_12px_36px_rgb(0,0,0,0.55)]`}
        >
          <Sidebar
            user={user}
            overdue={overdue}
            nextSeven={nextSeven}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onNewTransaction={() => {
              setDefaultType('despesa')
              setTransactionOpen(true)
            }}
            onSupport={() => setSupportOpen(true)}
            onManageUsers={() => navigate('/usuarios')}
            onOpenSettings={() => navigate('/configuracoes')}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        </aside>

        {/* DRAWER RESPONSIVO (MOBILE / TABLET) */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-fin-text/30 backdrop-blur-[2px] transition-opacity"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <aside className="relative m-3 h-[calc(100vh-24px)] w-[86vw] max-w-72 rounded-2xl border border-fin-border bg-[var(--fin-bg-card)] shadow-2xl overflow-hidden flex flex-col">
              <button
                className="absolute right-3.5 top-3.5 z-10 rounded-lg p-2 text-fin-muted hover:bg-fin-surface transition"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar navegação"
              >
                <X className="h-5 w-5" />
              </button>
              <Sidebar
                user={user}
                overdue={overdue}
                nextSeven={nextSeven}
                collapsed={false}
                onNewTransaction={() => {
                  setMenuOpen(false)
                  setDefaultType('despesa')
                  setTransactionOpen(true)
                }}
                onSupport={() => {
                  setMenuOpen(false)
                  setSupportOpen(true)
                }}
                onManageUsers={() => {
                  setMenuOpen(false)
                  navigate('/usuarios')
                }}
                onOpenSettings={() => {
                  setMenuOpen(false)
                  navigate('/configuracoes')
                }}
                isDark={isDark}
                onToggleTheme={toggleTheme}
              />
            </aside>
          </div>
        )}

        {/* BARRA SUPERIOR FLUTUANTE E RECOLHÍVEL (HEADER) */}
        <div
          className={`fixed top-3 right-3 z-30 transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'left-3 lg:left-[96px]' : 'left-3 lg:left-[284px]'
          } ${
            headerHidden
              ? '-translate-y-24 opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}
        >
          <header
            className={`flex h-[66px] items-center gap-3 rounded-2xl border border-fin-border bg-[var(--fin-bg-glass)] px-3 sm:px-5 backdrop-blur-md transition-shadow duration-200 ${
              isScrolled
                ? 'shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
                : 'shadow-[0_4px_18px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_18px_rgba(0,0,0,0.3)]'
            }`}
          >
            <button
              className="rounded-xl border border-fin-border p-2.5 text-fin-text hover:bg-fin-surface transition lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={() => setSearchOpen(true)}
              className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-fin-border bg-[var(--fin-bg-input)] px-3 text-left text-sm text-fin-muted shadow-xs transition hover:border-fin-primary/40 md:max-w-xl"
            >
              <Search className="h-4 w-4 shrink-0 text-fin-muted group-hover:text-fin-primary transition-colors" />
              <span className="truncate">Buscar lançamentos...</span>
              <kbd className="ml-auto hidden rounded-md border border-fin-border bg-fin-surface px-2 py-0.5 text-xs text-fin-muted sm:block">
                ⌘ K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={() => {
                  setDefaultType('despesa')
                  setTransactionOpen(true)
                }}
                className="btn-primary !min-h-[38px] !py-2 hidden md:flex text-xs sm:text-sm font-semibold shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Novo lançamento
              </button>

              {/* SELETOR DE TEMA CLARO/ESCURO COM ÍCONE SOL/LUA */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-transparent bg-fin-surface/80 text-fin-muted transition hover:border-fin-border hover:bg-fin-surface hover:text-fin-primary active:scale-95 cursor-pointer focus:outline-none"
                    aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
                    ) : (
                      <Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isDark ? 'Ativar modo claro' : 'Ativar modo escuro (modelo anexo)'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/contas?status=atrasadas')}
                    className="relative grid h-10 w-10 place-items-center rounded-xl border border-transparent bg-fin-surface/80 text-fin-muted transition hover:border-fin-border hover:bg-fin-surface hover:text-fin-primary"
                    aria-label={`${overdue} notificações`}
                  >
                    <Bell className="h-4 w-4" />
                    {overdue > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-fin-danger px-1 text-[10px] font-bold text-white ring-2 ring-[var(--fin-bg-card)]">
                        {overdue}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {overdue > 0 ? `${overdue} conta(s) em atraso` : 'Notificações'}
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-fin-surface focus:outline-none">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--fin-brand-primary)] text-xs font-bold text-white shadow-xs">
                      {initials}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-fin-muted sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 border-fin-border bg-[var(--fin-bg-card)] shadow-lg"
                >
                  <DropdownMenuLabel>
                    <span className="block text-sm font-semibold text-fin-text">
                      {user?.name || firstName}
                    </span>
                    <span className="block truncate text-xs font-normal text-fin-muted">
                      {user?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme}>
                    {isDark ? (
                      <>
                        <Sun className="mr-2 h-4 w-4 text-amber-400" />
                        Modo claro
                      </>
                    ) : (
                      <>
                        <Moon className="mr-2 h-4 w-4 text-slate-700" />
                        Modo escuro
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/usuarios')}>
                    <Users className="mr-2 h-4 w-4" />
                    Gerenciar usuários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout()
                      navigate('/login')
                    }}
                    className="text-fin-danger focus:text-fin-danger focus:bg-red-50 dark:focus:bg-red-950/30"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        </div>

        {/* CONTEÚDO PRINCIPAL (COM PADDING DINÂMICO PARA SE AJUSTAR À SIDEBAR E HEADER) */}
        <main
          className={`min-h-screen bg-[var(--fin-bg-page)] pt-[90px] transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'lg:pl-[84px]' : 'lg:pl-[276px]'
          }`}
        >
          <div className="mx-auto w-full max-w-[1360px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
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
                Envie uma mensagem para suporte@financasinteligentes.com.br. Respondemos em até um
                dia útil.
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
    </TooltipProvider>
  )
}

function Sidebar({
  user,
  overdue,
  nextSeven,
  collapsed = false,
  onToggleCollapse,
  onNewTransaction,
  onSupport,
  onManageUsers,
  onOpenSettings,
  isDark = false,
  onToggleTheme,
}: {
  user: import('pocketbase').RecordModel | null
  overdue: number
  nextSeven: number
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNewTransaction?: () => void
  onSupport: () => void
  onManageUsers: () => void
  onOpenSettings: () => void
  isDark?: boolean
  onToggleTheme?: () => void
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
    <div
      className={`relative flex h-full flex-col overflow-y-auto overflow-x-hidden no-scrollbar ${
        collapsed ? 'items-center px-2 py-3.5' : 'px-3.5 pb-4 pt-4'
      }`}
    >
      {/* ESTADO RECOLHIDO: Inspirado no design em pílula com ícones em rounded-squares e botão "+" destacado */}
      {collapsed ? (
        <div className="flex h-full w-full flex-col items-center">
          {/* Topo: Logo oficial do sistema idêntico ao modo expandido (quadrado escuro com ícone branco) */}
          <div className="shrink-0 flex flex-col items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/"
                  className="flex items-center justify-center rounded-xl transition hover:opacity-90"
                  aria-label="Finanças Inteligentes"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fin-text text-white shadow-sm">
                    <WalletCards className="h-5 w-5" />
                  </span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold">
                Finanças Inteligentes
              </TooltipContent>
            </Tooltip>

            {/* Botão recolher/expandir abaixo do logotipo (modo recolhido) */}
            {onToggleCollapse && (
              <div className="mt-1 mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-transparent text-[var(--fin-sidebar-chevron)] hover:text-fin-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer focus:outline-none"
                      aria-label="Expandir menu lateral"
                    >
                      <ChevronRight className="h-4 w-4 stroke-[1.65]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expandir menu lateral</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Botão de ação: "+" em destaque */}
          {onNewTransaction && (
            <div className="mb-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewTransaction}
                    className="group grid h-11 w-11 place-items-center rounded-2xl bg-[var(--fin-bg-card)] border border-fin-border/60 text-[var(--fin-sidebar-icon)] transition-all duration-150 hover:border-fin-primary/60 hover:shadow-xs hover:text-fin-text active:scale-95"
                    aria-label="Novo lançamento"
                  >
                    <Plus className="h-5 w-5 stroke-[1.65] transition-transform duration-200 group-hover:rotate-90 text-[var(--fin-sidebar-icon)]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-semibold">
                  Novo lançamento
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Divisor fino */}
          <div className="mb-2 h-px w-8 shrink-0 bg-fin-border" />

          {/* Coluna de navegação: quadrados arredondados com ícone, incluindo Início (Home) */}
          <nav className="flex w-full flex-1 flex-col items-center gap-2 py-0.5">
            {navItems.map((item) => {
              const isContas = item.to === '/contas'
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) =>
                        `group relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-150 ${
                          isActive
                            ? 'bg-fin-primary/15 text-fin-primary shadow-xs font-semibold border border-fin-primary/30'
                            : 'border border-fin-border/60 bg-[var(--fin-bg-card)] text-[var(--fin-sidebar-icon)] shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:bg-fin-surface hover:text-fin-text hover:border-fin-border hover:shadow'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${
                              isActive
                                ? 'stroke-[2] text-fin-primary'
                                : 'stroke-[1.65] text-[var(--fin-sidebar-icon)]'
                            }`}
                          />
                          {/* Badge de contas em atraso no ícone de Contas */}
                          {isContas && overdue > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fin-danger px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-[var(--fin-bg-card)]">
                              {overdue}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                    {isContas && overdue > 0 && ` (${overdue} atrasada${overdue > 1 ? 's' : ''})`}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* Rodapé compacto: Notificações/Contas, Alternar Tema, Configurações, Suporte e Avatar */}
          <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2 border-t border-fin-border pt-3">
            {onToggleTheme && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleTheme}
                    className="grid h-10 w-10 place-items-center rounded-xl text-[var(--fin-sidebar-icon)] transition hover:bg-fin-surface hover:text-fin-text"
                    aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-amber-400 stroke-[1.8]" />
                    ) : (
                      <Moon className="h-4 w-4 stroke-[1.8]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isDark ? 'Modo claro' : 'Modo escuro'}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/contas?status=atrasadas"
                  className="relative grid h-10 w-10 place-items-center rounded-xl text-[var(--fin-sidebar-icon)] transition hover:bg-fin-surface hover:text-fin-danger"
                  aria-label="Contas em atraso"
                >
                  <Bell className="h-4 w-4 stroke-[1.8]" />
                  {overdue > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fin-danger px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-[var(--fin-bg-card)]">
                      {overdue}
                    </span>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                {overdue > 0 ? `${overdue} conta(s) em atraso` : 'Notificações de contas'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="grid h-10 w-10 place-items-center rounded-xl text-[var(--fin-sidebar-icon)] transition hover:bg-fin-surface hover:text-fin-text"
                  aria-label="Configurações"
                >
                  <Settings className="h-4 w-4 stroke-[1.8]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Configurações</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSupport}
                  className="grid h-10 w-10 place-items-center rounded-xl text-[var(--fin-sidebar-icon)] transition hover:bg-fin-surface hover:text-fin-text"
                  aria-label="Ajuda & Suporte"
                >
                  <CircleHelp className="h-4 w-4 stroke-[1.8]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Ajuda & Suporte</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="pt-1">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--fin-brand-primary)] text-xs font-bold text-white shadow-xs cursor-default">
                    {initials}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{name}</p>
                <p className="text-[11px] text-fin-muted">{email}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : (
        /* ESTADO EXPANDIDO: Layout completo e detalhado */
        <>
          {/* Cabeçalho do Menu com Logo e Botão de Recolher abaixo do logotipo */}
          <div className="mb-4 shrink-0 px-1.5">
            <div className="flex items-center justify-between gap-2">
              <NavLink
                to="/"
                className="flex items-center gap-3 rounded-xl transition hover:opacity-90"
                title="Finanças Inteligentes"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fin-text text-white shadow-sm">
                  <WalletCards className="h-5 w-5" />
                </span>
                <span className="max-w-[140px] text-[14px] font-bold leading-tight tracking-tight text-fin-text">
                  Finanças
                  <br />
                  Inteligentes
                </span>
              </NavLink>
            </div>

            {/* Botão recolher abaixo do logotipo (modo expandido) */}
            {onToggleCollapse && (
              <div className="mt-2 pl-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      className="hidden lg:grid h-7 w-7 place-items-center rounded-lg bg-transparent text-[var(--fin-sidebar-chevron)] hover:text-fin-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer focus:outline-none"
                      aria-label="Recolher menu lateral"
                    >
                      <ChevronLeft className="h-4 w-4 stroke-[1.65]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Recolher menu lateral</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Botão de Novo Lançamento em destaque no modo expandido */}
          {onNewTransaction && (
            <div className="mb-4 shrink-0 px-0.5">
              <button onClick={onNewTransaction} className="btn-primary w-full shadow-xs">
                <Plus className="h-4 w-4 stroke-[2.2]" />
                <span>Novo lançamento</span>
              </button>
            </div>
          )}

          {/* Itens de Navegação Principal */}
          <nav className="w-full shrink-0 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-fin-primary/10 text-fin-primary font-semibold shadow-xs ring-1 ring-fin-primary/20'
                      : 'text-fin-muted hover:bg-fin-surface hover:text-fin-text'
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.to === '/contas' && overdue > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-fin-danger px-1.5 text-[10px] font-bold text-white">
                    {overdue}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Divisor */}
          <div className="my-4 h-px shrink-0 bg-fin-border/70 mx-2" />

          {/* Resumo de Contas */}
          <div className="shrink-0 px-1">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-fin-muted/80">
              Resumo
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/contas?status=atrasadas"
                className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-fin-muted hover:bg-fin-surface transition"
              >
                <span>Atrasadas</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                    overdue
                      ? 'bg-red-50 text-fin-danger border border-red-200'
                      : 'bg-fin-surface text-fin-muted'
                  }`}
                >
                  {overdue}
                </span>
              </NavLink>
              <NavLink
                to="/contas?status=em_aberto"
                className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-fin-muted hover:bg-fin-surface transition"
              >
                <span>A vencer (7 dias)</span>
                <span className="rounded-md bg-fin-surface px-1.5 py-0.5 text-[11px] font-bold text-fin-primary">
                  {nextSeven}
                </span>
              </NavLink>
            </div>
          </div>

          {/* Rodapé / Perfil */}
          <div className="mt-auto shrink-0 pt-4 border-t border-fin-border/70">
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-fin-surface/60 p-2 border border-fin-border/60">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--fin-brand-primary)] text-xs font-bold text-white shadow-xs">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-fin-text">{name}</p>
                <p className="truncate text-[10px] text-fin-muted">{email}</p>
              </div>
            </div>
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-fin-muted transition hover:bg-fin-surface hover:text-fin-text"
              >
                <span className="flex items-center gap-2">
                  {isDark ? (
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                  <span>Tema</span>
                </span>
                <span className="rounded-md bg-fin-surface px-1.5 py-0.5 text-[10px] font-semibold text-fin-text">
                  {isDark ? 'Escuro' : 'Claro'}
                </span>
              </button>
            )}
            <button
              onClick={onManageUsers}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-fin-primary hover:bg-fin-surface transition"
            >
              <Users className="h-3.5 w-3.5" />
              Gerenciar usuários
            </button>
            <button
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-fin-muted transition hover:bg-fin-surface hover:text-fin-text"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </button>
            <button
              onClick={onSupport}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-fin-muted transition hover:bg-fin-surface hover:text-fin-text"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Ajuda & Suporte
            </button>
          </div>
        </>
      )}
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
