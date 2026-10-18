import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, Sparkles } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const DEMO_EMAIL = 'videos@adapta.org'
const DEMO_PASSWORD = 'Skip@123456'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [filledFeedback, setFilledFeedback] = useState(false)

  function fillDemoCredentials() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setErrors({})
    setMessage('')
    setFilledFeedback(true)
    setTimeout(() => setFilledFeedback(false), 2200)

    // Foco imediato no campo de e-mail para affordance natural
    setTimeout(() => {
      emailInputRef.current?.focus()
      emailInputRef.current?.select()
    }, 50)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Informe um e-mail válido.'
    if (!password) nextErrors.password = 'Informe sua senha.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    setLoading(true)
    setMessage('')
    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from || '/'
      navigate(from, { replace: true })
    } catch (error) {
      const raw = getErrorMessage(error)
      setMessage(raw.includes('Failed to authenticate') ? 'E-mail ou senha incorretos.' : raw)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para acompanhar suas finanças e fechar o mês com clareza."
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="E-mail" error={errors.email}>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
            <input
              ref={emailInputRef}
              className="field pl-10"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((prev) => ({ ...prev, email: '' }))
              }}
              autoComplete="username"
            />
          </div>
        </Field>
        <Field
          label="Senha"
          error={errors.password}
          extra={
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-fin-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          }
        >
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
            <input
              className="field px-10"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((prev) => ({ ...prev, password: '' }))
              }}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-2.5 p-0.5 text-fin-muted"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {message && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-fin-danger">{message}</p>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Entrar
        </button>
        <p className="text-center text-sm text-fin-muted">
          Ainda não tem uma conta?{' '}
          <Link to="/signup" className="font-semibold text-fin-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </form>

      {/* Botão compacto de preenchimento com dados demo */}
      <div className="mt-6">
        <button
          type="button"
          onClick={fillDemoCredentials}
          className="group w-full rounded-xl border border-fin-border bg-[#fbfbfe] px-3.5 py-2.5 text-left transition-all duration-150 hover:border-fin-primary/40 hover:bg-indigo-50/40 hover:shadow-xs active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-fin-primary/30"
          title="Clique para preencher as credenciais de demonstração"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fin-text group-hover:text-fin-primary transition-colors">
              <KeyRound className="h-3.5 w-3.5 text-fin-primary shrink-0" />
              <span>Usar acesso de demonstração</span>
            </span>
            {filledFeedback ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-fin-success">
                <Check className="h-3 w-3" />
                Preenchido!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fin-primary opacity-80 group-hover:opacity-100 transition-opacity">
                <Sparkles className="h-3 w-3" />
                Preencher campos
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-fin-muted">
            Demo:{' '}
            <span className="font-mono text-fin-text selection:bg-indigo-100">
              {DEMO_EMAIL}
            </span> ·{' '}
            <span className="font-mono text-fin-text selection:bg-indigo-100">{DEMO_PASSWORD}</span>{' '}
            — clique para preencher
          </p>
        </button>
      </div>
    </AuthShell>
  )
}

function Field({
  label,
  error,
  extra,
  children,
}: {
  label: string
  error?: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-[13px] font-medium text-fin-text">
        <span>{label}</span>
        {extra}
      </span>
      {children}
      {error && <span className="block text-xs text-fin-danger">{error}</span>}
    </label>
  )
}
