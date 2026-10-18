import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function SignupPage() {
  const { signup } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Informe seu nome.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Informe um e-mail válido.'
    if (form.password.length < 8) next.password = 'A senha deve ter no mínimo 8 caracteres.'
    if (Object.keys(next).length) return setErrors(next)
    setLoading(true)
    setMessage('')
    try {
      await signup(form.name.trim(), form.email.trim(), form.password)
      setSent(true)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  if (sent)
    return (
      <AuthShell title="Confira seu e-mail" subtitle="Enviamos um link para confirmar sua conta.">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50 text-fin-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <p className="mt-5 text-sm leading-6 text-fin-muted">
            Abra a mensagem enviada para <strong className="text-fin-text">{form.email}</strong> e
            clique em “Verificar e-mail”.
          </p>
          <Link to="/login" className="btn-primary mt-7 w-full">
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    )
  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Comece a organizar suas finanças em poucos minutos."
    >
      <form onSubmit={submit} className="space-y-5">
        <InputField label="Nome" error={errors.name} icon={<UserRound className="h-4 w-4" />}>
          <input
            className="field pl-10"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Seu nome completo"
          />
        </InputField>
        <InputField label="E-mail" error={errors.email} icon={<Mail className="h-4 w-4" />}>
          <input
            className="field pl-10"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="voce@exemplo.com"
          />
        </InputField>
        <InputField
          label="Senha"
          error={errors.password}
          icon={<LockKeyhole className="h-4 w-4" />}
        >
          <input
            className="field pl-10"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Mínimo de 8 caracteres"
          />
        </InputField>
        <p className="text-xs leading-5 text-fin-muted">
          Ao criar sua conta, você concorda com os termos de uso e a política de privacidade.
        </p>
        {message && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-fin-danger">{message}</p>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}Criar conta
        </button>
        <p className="text-center text-sm text-fin-muted">
          Já possui uma conta?{' '}
          <Link to="/login" className="font-semibold text-fin-primary hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

function InputField({
  label,
  error,
  icon,
  children,
}: {
  label: string
  error?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-3 text-fin-muted">{icon}</span>
        {children}
      </div>
      {error && <span className="block text-xs text-fin-danger">{error}</span>}
    </label>
  )
}
