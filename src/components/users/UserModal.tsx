import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { createUser, updateUser } from '@/services/users'
import type { UserProfile } from '@/types/finance'

interface UserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: UserProfile | null
  onSaved: (saved: UserProfile) => void
}

export function UserModal({ open, onOpenChange, profile, onSaved }: UserModalProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = Boolean(profile)

  useEffect(() => {
    if (open) {
      if (profile) {
        setName(profile.name || '')
        setEmail(profile.email || '')
        setActive(profile.active !== false)
      } else {
        setName('')
        setEmail('')
        setActive(true)
      }
      setPassword('')
      setConfirmPassword('')
      setErrors({})
    }
  }, [open, profile])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) {
      nextErrors.name = 'Informe o nome completo.'
    }
    if (!email.trim() || !email.includes('@')) {
      nextErrors.email = 'Informe um e-mail válido.'
    }
    if (!isEditing) {
      if (!password) {
        nextErrors.password = 'A senha é obrigatória.'
      } else if (password.length < 8) {
        nextErrors.password = 'A senha deve conter no mínimo 8 caracteres.'
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'As senhas não coincidem.'
      }
    } else if (password) {
      if (password.length < 8) {
        nextErrors.password = 'A nova senha deve ter no mínimo 8 caracteres.'
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'As senhas não coincidem.'
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      if (isEditing && profile) {
        const result = await updateUser({
          profileId: profile.id,
          name: name.trim(),
          email: email.trim(),
          active,
          password: password ? password : undefined,
        })
        toast({
          title: 'Usuário atualizado',
          description: 'Os dados do usuário foram salvos com sucesso.',
        })
        onSaved(result)
        onOpenChange(false)
      } else {
        const result = await createUser({
          name: name.trim(),
          email: email.trim(),
          password,
        })
        toast({
          title: 'Usuário criado',
          description: 'O novo usuário foi cadastrado com sucesso.',
        })
        onSaved(result)
        onOpenChange(false)
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar o usuário. Verifique os dados.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-fin-border bg-white text-fin-text sm:max-w-md dark:border-white/10 dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-fin-text dark:text-slate-100">
            {isEditing ? 'Editar usuário' : 'Novo usuário'}
          </DialogTitle>
          <DialogDescription className="text-fin-muted dark:text-slate-400">
            {isEditing
              ? 'Altere os dados de identificação, acesso ou redefina a senha.'
              : 'Preencha os dados do novo membro para liberar o acesso ao sistema.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fin-text dark:text-slate-200">
              Nome completo
            </label>
            <input
              type="text"
              className="field"
              placeholder="Ex.: Maria Souza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-fin-danger dark:text-rose-400">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fin-text dark:text-slate-200">
              E-mail
            </label>
            <input
              type="email"
              className="field"
              placeholder="maria@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />
            {errors.email && (
              <p className="text-xs text-fin-danger dark:text-rose-400">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fin-text dark:text-slate-200">
              {isEditing ? 'Nova senha (opcional)' : 'Senha'}
            </label>
            <input
              type="password"
              className="field"
              placeholder={
                isEditing ? 'Deixe em branco para não alterar' : 'Mínimo de 8 caracteres'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
            />
            {errors.password && (
              <p className="text-xs text-fin-danger dark:text-rose-400">{errors.password}</p>
            )}
          </div>

          {(password || !isEditing) && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-fin-text dark:text-slate-200">
                Confirmar senha
              </label>
              <input
                type="password"
                className="field"
                placeholder="Repita a senha digitada"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-fin-danger dark:text-rose-400">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {isEditing && (
            <div className="flex items-center justify-between rounded-xl border border-fin-border bg-fin-surface p-3.5 dark:border-white/10 dark:bg-[#131a29]/90">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-fin-text dark:text-slate-200">
                    Status da conta
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/40'
                        : 'bg-amber-500 text-white ring-1 ring-amber-600'
                    }`}
                  >
                    {active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-fin-muted dark:text-slate-400">
                  Usuários desativados não conseguem realizar novas ações no sistema.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5">
                <span className="text-xs font-semibold text-fin-text dark:text-slate-200">
                  {active ? 'Ativado' : 'Desativado'}
                </span>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-zinc-300 dark:bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 dark:after:border-slate-600 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                </div>
              </label>
            </div>
          )}

          <DialogFooter className="pt-2 sm:justify-end">
            <button
              type="button"
              className="btn-outline dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar usuário'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
