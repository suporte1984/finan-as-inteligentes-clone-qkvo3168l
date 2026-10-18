import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage('Informe um e-mail válido.')
    setLoading(true)
    setMessage('')
    try {
      await pb.collection('users').requestPasswordReset(email)
      setSent(true)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }
  return (
    <AuthShell
      title={sent ? 'Verifique sua caixa de entrada' : 'Recupere sua senha'}
      subtitle={
        sent
          ? 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'
          : 'Informe seu e-mail e enviaremos as instruções.'
      }
    >
      {sent ? (
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50 text-fin-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <p className="mt-5 text-sm leading-6 text-fin-muted">
            Enviamos as instruções para <strong className="text-fin-text">{email}</strong>.
          </p>
          <Link to="/login" className="btn-primary mt-7 w-full">
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">E-mail</span>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
              <input
                className="field pl-10"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                autoFocus
              />
            </div>
          </label>
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-fin-danger">{message}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Enviar link de recuperação
          </button>
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-sm font-medium text-fin-muted hover:text-fin-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
