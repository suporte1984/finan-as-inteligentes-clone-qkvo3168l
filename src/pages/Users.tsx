import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Mail,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  UserCheck,
  Users as UsersIcon,
  UserX,
} from 'lucide-react'

import { UserModal } from '@/components/users/UserModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'
import { listProfiles, toggleUserActive } from '@/services/users'
import type { UserProfile } from '@/types/finance'
import { cn } from '@/lib/utils'

type FilterStatus = 'todos' | 'ativos' | 'inativos'

export default function UsersPage() {
  const { user: currentAuthUser } = useAuth()
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [toggleConfirm, setToggleConfirm] = useState<UserProfile | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('todos')
  const [actionLoading, setActionLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listProfiles()
      setProfiles(data)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: 'Tente novamente em alguns instantes.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter((p) => {
      const matchesSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q))
      const matchesStatus =
        statusFilter === 'todos'
          ? true
          : statusFilter === 'ativos'
            ? p.active !== false
            : p.active === false
      return matchesSearch && matchesStatus
    })
  }, [profiles, search, statusFilter])

  const counts = useMemo(
    () => ({
      todos: profiles.length,
      ativos: profiles.filter((p) => p.active !== false).length,
      inativos: profiles.filter((p) => p.active === false).length,
    }),
    [profiles],
  )

  async function handleToggleStatus() {
    if (!toggleConfirm) return
    const isCurrentActive = toggleConfirm.active !== false
    setActionLoading(true)
    try {
      const updated = await toggleUserActive(toggleConfirm.id, isCurrentActive)
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      toast({
        title: updated.active ? 'Usuário ativado' : 'Usuário desativado',
        description: `O status de ${updated.name} foi atualizado com sucesso.`,
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível alterar o status do usuário.'
      toast({
        variant: 'destructive',
        title: 'Erro na alteração',
        description: message,
      })
    } finally {
      setActionLoading(false)
      setToggleConfirm(null)
    }
  }

  return (
    <div className="space-y-6 page-container">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
        <div>
          <h1 className="page-title">Gerenciar usuários</h1>
          <p className="page-subtitle">
            Cadastre novos membros e gerencie o acesso de quem utiliza o sistema.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            className="btn-primary"
            onClick={() => {
              setEditingProfile(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Novo usuário
          </button>
        </div>
      </header>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-up stagger-1">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fin-muted" />
          <input
            type="text"
            className="field pl-9"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex overflow-x-auto rounded-xl border border-fin-border bg-fin-surface p-1">
          {(
            [
              ['todos', 'Todos'],
              ['ativos', 'Ativos'],
              ['inativos', 'Inativos'],
            ] as [FilterStatus, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                statusFilter === val
                  ? 'bg-[var(--fin-bg-card)] text-fin-text shadow-sm'
                  : 'text-fin-muted hover:text-fin-text',
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px]',
                  statusFilter === val ? 'bg-fin-surface text-fin-text' : 'text-fin-muted',
                )}
              >
                {counts[val]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Usuários */}
      <section className="space-y-3 animate-fade-up stagger-2">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)}

        {!loading &&
          filtered.map((profile) => {
            const isSelf = profile.user === currentAuthUser?.id
            const isActive = profile.active !== false
            const initials = String(profile.name || profile.email || 'U')
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()

            return (
              <article
                key={profile.id}
                className={cn(
                  'fin-card group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5',
                  isActive
                    ? 'fin-card-interactive'
                    : 'bg-zinc-50/90 border-dashed border-amber-300/80 opacity-60 grayscale-[40%] hover:opacity-85 hover:grayscale-0',
                )}
              >
                <div className="relative flex shrink-0 items-center justify-center">
                  <span
                    className={cn(
                      'grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold shadow-sm transition-colors',
                      isActive
                        ? 'bg-fin-text text-white'
                        : 'bg-amber-100 text-amber-900 ring-2 ring-amber-300/60',
                    )}
                  >
                    {initials}
                  </span>
                  {isActive ? (
                    <span
                      title="Ativo"
                      className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-fin-success"
                    />
                  ) : (
                    <span
                      title="Inativo"
                      className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-amber-600"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className={cn(
                        'truncate text-sm font-semibold sm:text-[15px]',
                        !isActive && 'text-zinc-600 line-through decoration-zinc-400 decoration-1',
                      )}
                    >
                      {profile.name}
                    </h2>
                    {isSelf && (
                      <span className="fin-badge fin-badge-primary">
                        <ShieldCheck className="h-3 w-3" />
                        Você
                      </span>
                    )}
                    <span
                      className={cn(
                        'fin-badge',
                        isActive ? 'fin-badge-success' : 'fin-badge-warning',
                      )}
                    >
                      {isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fin-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-fin-muted" />
                      {profile.email}
                    </span>
                    <span>Criado em {formatDate(profile.created)}</span>
                    {!isActive && (
                      <span className="font-semibold text-amber-700">• Acesso suspenso</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  {/* Toggle inline com rótulo textual explícito */}
                  <button
                    type="button"
                    disabled={isSelf || actionLoading}
                    onClick={() => setToggleConfirm(profile)}
                    title={
                      isSelf
                        ? 'Você não pode desativar seu próprio usuário'
                        : isActive
                          ? 'Clique para desativar este usuário'
                          : 'Clique para reativar este usuário'
                    }
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition shadow-2xs',
                      isSelf && 'opacity-50 cursor-not-allowed',
                      isActive
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                        : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold',
                    )}
                  >
                    <span
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                        isActive ? 'bg-emerald-600' : 'bg-zinc-400',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                          isActive ? 'translate-x-3' : 'translate-x-0',
                        )}
                      />
                    </span>
                    <span>{isActive ? 'Ativado' : 'Desativado'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingProfile(profile)
                      setModalOpen(true)
                    }}
                    className="btn-outline min-h-9 px-3 py-1.5 text-xs"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="rounded-lg border border-fin-border p-2 text-fin-muted hover:bg-fin-surface"
                        aria-label="Mais opções"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-fin-border bg-[var(--fin-bg-card)]"
                    >
                      <DropdownMenuItem
                        disabled={isSelf}
                        onClick={() => setToggleConfirm(profile)}
                        className={isActive ? 'text-fin-danger' : 'text-fin-success font-semibold'}
                      >
                        {isActive ? (
                          <>
                            <UserX className="mr-2 h-4 w-4" />
                            Desativar acesso
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Ativar acesso
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            )
          })}

        {!loading && filtered.length === 0 && (
          <div className="fin-card flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-fin-surface text-fin-muted">
              <UsersIcon className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-fin-text">
              {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </h2>
            <p className="mt-1 max-w-sm text-xs text-fin-muted">
              {search
                ? `Não encontramos usuários correspondentes a "${search}".`
                : 'Comece cadastrando os membros que terão acesso ao sistema financeiro.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="btn-outline !min-h-[36px] !py-1.5 !text-xs"
                >
                  Limpar busca
                </button>
              ) : (
                <button
                  className="btn-primary !min-h-[36px] !py-1.5 !text-xs"
                  onClick={() => {
                    setEditingProfile(null)
                    setModalOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro usuário
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Modal de Criação / Edição */}
      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        profile={editingProfile}
        onSaved={(saved) => {
          setProfiles((current) => {
            const index = current.findIndex((p) => p.id === saved.id)
            if (index >= 0) {
              const next = [...current]
              next[index] = saved
              return next
            }
            return [saved, ...current]
          })
          setEditingProfile(null)
        }}
      />

      {/* Confirmação de ativação/desativação */}
      <AlertDialog
        open={Boolean(toggleConfirm)}
        onOpenChange={(open) => {
          if (!open) setToggleConfirm(null)
        }}
      >
        <AlertDialogContent className="border-fin-border bg-[var(--fin-bg-card)] text-fin-text sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.active !== false
                ? 'Desativar este usuário?'
                : 'Reativar este usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.active !== false
                ? `Ao desativar “${toggleConfirm?.name}”, o usuário não poderá acessar o sistema nem registrar lançamentos até ser reativado.`
                : `Ao reativar “${toggleConfirm?.name}”, o acesso ao sistema será liberado novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className={
                toggleConfirm?.active !== false
                  ? 'bg-fin-danger hover:bg-red-600'
                  : 'bg-fin-success hover:bg-emerald-600'
              }
              onClick={() => void handleToggleStatus()}
            >
              {actionLoading
                ? 'Atualizando...'
                : toggleConfirm?.active !== false
                  ? 'Sim, desativar'
                  : 'Sim, ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
