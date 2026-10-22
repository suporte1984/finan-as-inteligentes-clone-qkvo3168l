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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
      <div className="min-h-screen bg-[#f4f5f8] text-fin-text">
        {/* SIDEBAR FLUTUANTE E RECOLHÍVEL (DESKTOP) */}
        <aside
          aria-label="Menu principal"
          className={`fixed left-3 top-3 bottom-3 z-40 hidden flex-col rounded-2xl border border-fin-border bg-white/95 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${
            sidebarCollapsed ? 'w-[72px]' : 'w-64'
          } shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.09)]`}
        >
          {/* Botão de Toggle para Recolher / Expandir Menu (Desktop)
              Estilo da imagem de referência: entalhe em meio-círculo branco na borda direita da pílula
              contendo apenas o chevron fino ">" em grafite escuro sem borda, sem fundo e sem sombra no botão em si. */}
          <div
            className={`absolute z-50 hidden lg:flex items-center justify-center transition-all duration-300 ease-in-out ${
              sidebarCollapsed ? '-right-[11px] top-[74px]' : '-right-[11px] top-7'
            }`}
          >
            {/* O entalhe em meia lua / círculo branco contínuo com o fundo da pílula */}
            <div className="relative flex h-8 w-6 items-center justify-start rounded-r-full border-y border-r border-fin-border bg-white shadow-[2px_1px_4px_rgba(0,0,0,0.03)]">
              {/* Máscara para conectar perfeitamente com o fundo branco da sidebar */}
              <div className="absolute -left-1.5 top-0 bottom-0 w-2 bg-white" />

              <button
                type="button"
                onClick={toggleSidebar}
                className="relative z-10 -ml-1 grid h-7 w-7 place-items-center rounded-full bg-transparent text-[#2c3038] hover:text-[#111322] hover:bg-black/[0.04] active:scale-95 transition-all cursor-pointer focus:outline-none"
                aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4 stroke-[1.65]" />
                ) : (
                  <ChevronLeft className="h-4 w-4 stroke-[1.65]" />
                )}
              </button>
            </div>
          </div>

          <Sidebar
            user={user}
            overdue={overdue}
            nextSeven={nextSeven}
            collapsed={sidebarCollapsed}
            onNewTransaction={() => {
              setDefaultType('despesa')
              setTransactionOpen(true)
            }}
            onSupport={() => setSupportOpen(true)}
            onManageUsers={() => navigate('/usuarios')}
            onOpenSettings={() => navigate('/configuracoes')}
          />
        </aside>

        {/* DRAWER RESPONSIVO (MOBILE / TABLET) */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-fin-text/25 backdrop-blur-[2px] transition-opacity"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <aside className="relative m-3 h-[calc(100vh-24px)] w-[86vw] max-w-72 rounded-2xl border border-fin-border bg-white shadow-2xl overflow-hidden flex flex-col">
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
            className={`flex h-[66px] items-center gap-3 rounded-2xl border border-fin-border bg-white/95 px-3 sm:px-5 backdrop-blur-md transition-shadow duration-200 ${
              isScrolled
                ? 'shadow-[0_10px_30px_rgba(17,24,39,0.08)]'
                : 'shadow-[0_4px_18px_rgba(17,24,39,0.04)]'
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
              className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-fin-border bg-white/80 px-3 text-left text-sm text-fin-muted shadow-[0_1px_2px_rgba(25,25,39,.03)] transition hover:border-fin-primary/40 hover:bg-white md:max-w-xl"
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/contas?status=atrasadas')}
                    className="relative grid h-10 w-10 place-items-center rounded-xl border border-transparent bg-fin-surface/80 text-fin-muted transition hover:border-fin-border hover:bg-fin-surface hover:text-fin-primary"
                    aria-label={`${overdue} notificações`}
                  >
                    <Bell className="h-4 w-4" />
                    {overdue > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-fin-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
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
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-fin-text text-xs font-bold text-white shadow-xs">
                      {initials}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-fin-muted sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-fin-border shadow-lg">
                  <DropdownMenuLabel>
                    <span className="block text-sm font-semibold text-fin-text">
                      {user?.name || firstName}
                    </span>
                    <span className="block truncate text-xs font-normal text-fin-muted">
                      {user?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
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
                    className="text-fin-danger focus:text-fin-danger focus:bg-red-50"
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
          className={`min-h-screen bg-[#f4f5f8] pt-[90px] transition-all duration-300 ease-in-out ${
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
  onNewTransaction,
  onSupport,
  onManageUsers,
  onOpenSettings,
}: {
  user: import('pocketbase').RecordModel | null
  overdue: number
  nextSeven: number
  collapsed?: boolean
  onNewTransaction?: () => void
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
    <div
      className={`relative flex h-full flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        collapsed ? 'items-center px-2 py-3.5' : 'px-3.5 pb-4 pt-4'
      }`}
    >
      {/* ESTADO RECOLHIDO: Inspirado no design em pílula com ícones em rounded-squares e botão "+" destacado */}
      {collapsed ? (
        <div className="flex h-full w-full flex-col items-center">
          {/* Topo: Item Início/Logo como item da navegação (quadrado arredondado com fundo lilás suave quando ativo ou branco com ícone grafite) */}
          <div className="mb-1 shrink-0 pt-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `grid h-11 w-11 place-items-center rounded-2xl transition-all duration-150 ${
                      isActive
                        ? 'bg-[#eef0ff] text-[#4f46e5] border border-[#dce2ff] shadow-xs font-semibold'
                        : 'border border-fin-border/50 bg-white text-[#222530] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-fin-surface/80 hover:text-[#111322] hover:border-fin-border hover:shadow'
                    }`
                  }
                  aria-label="Finanças Inteligentes - Início"
                >
                  {({ isActive }) => (
                    <WalletCards
                      className={`h-5 w-5 shrink-0 transition-transform hover:scale-105 ${
                        isActive ? 'stroke-[2] text-[#4f46e5]' : 'stroke-[1.65] text-[#222530]'
                      }`}
                    />
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold">
                Início
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Espaçamento reservado entre o item de topo e a linha divisória (onde o toggle ">" morde a borda lateral) */}
          <div className="h-8 w-full shrink-0" />

          {/* Divisor fino cinza claro (conforme imagem de referência) */}
          <div className="mb-2 h-px w-8 shrink-0 bg-[#e4e7ec]" />

          {/* Botão de ação: "+" em quadrado arredondado sem fundo cinza forte, estilo limpo */}
          {onNewTransaction && (
            <div className="mb-1.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewTransaction}
                    className="group grid h-11 w-11 place-items-center rounded-2xl bg-white/70 border border-transparent text-[#222530] transition-all duration-150 hover:bg-white hover:border-fin-border/60 hover:shadow-xs hover:text-[#111322] active:scale-95"
                    aria-label="Novo lançamento"
                  >
                    <Plus className="h-5 w-5 stroke-[1.65] transition-transform duration-200 group-hover:rotate-90 text-[#222530]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-semibold">
                  Novo lançamento
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Coluna de navegação: quadrados arredondados brancos com sombra sutil e ícones grafite escuro quase preto */}
          <nav className="flex w-full flex-1 flex-col items-center gap-2 py-0.5">
            {navItems
              .filter((item) => item.to !== '/') // O item Início já está no topo destacado
              .map((item) => {
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
                              ? 'bg-[#eef0ff] text-[#4f46e5] shadow-xs font-semibold border border-[#dce2ff]'
                              : 'border border-fin-border/50 bg-white text-[#222530] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-fin-surface/80 hover:text-[#111322] hover:border-fin-border hover:shadow'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${
                                isActive
                                  ? 'stroke-[2] text-[#4f46e5]'
                                  : 'stroke-[1.65] text-[#222530]'
                              }`}
                            />
                            {/* Badge de contas em atraso no ícone de Contas */}
                            {isContas && overdue > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fin-danger px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-white">
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

          {/* Rodapé compacto: Notificações/Contas, Configurações, Suporte e Avatar */}
          <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2 border-t border-[#e4e7ec] pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/contas?status=atrasadas"
                  className="relative grid h-10 w-10 place-items-center rounded-xl text-[#222530] transition hover:bg-fin-surface hover:text-fin-danger"
                  aria-label="Contas em atraso"
                >
                  <Bell className="h-4 w-4 stroke-[1.8]" />
                  {overdue > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fin-danger px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-white">
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
                  className="grid h-10 w-10 place-items-center rounded-xl text-[#222530] transition hover:bg-fin-surface hover:text-[#111322]"
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
                  className="grid h-10 w-10 place-items-center rounded-xl text-[#222530] transition hover:bg-fin-surface hover:text-[#111322]"
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
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-fin-text text-xs font-bold text-white shadow-xs cursor-default">
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
          {/* Cabeçalho do Menu com Logo */}
          <div className="mb-5 flex shrink-0 items-center gap-3 px-1.5">
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
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-fin-text text-xs font-bold text-white shadow-xs">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-fin-text">{name}</p>
                <p className="truncate text-[10px] text-fin-muted">{email}</p>
              </div>
            </div>
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
