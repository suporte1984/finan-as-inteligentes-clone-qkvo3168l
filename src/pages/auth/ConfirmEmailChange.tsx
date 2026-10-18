import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

type State = 'form' | 'loading' | 'success' | 'error'

export default function ConfirmEmailChangePage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [state, setState] = useState<State>(token ? 'form' : 'error')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) {
      setMessage('Informe sua senha atual para confirmar a alteração.')
      return
    }
    setState('loading')
    setMessage('')
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      pb.authStore.clear()
      setState('success')
    } catch (error) {
      setMessage(getErrorMessage(error))
      setState('form')
    }
  }

  const title =
    state === 'success'
      ? 'E-mail atualizado'
      : state === 'error'
        ? 'Link inválido'
        : 'Confirme seu novo e-mail'
  const subtitle =
    state === 'success'
      ? 'Entre novamente usando o novo endereço de e-mail.'
      : state === 'error'
        ? 'O link pode ter expirado ou estar incompleto.'
        : 'Por segurança, informe sua senha atual para concluir a alteração.'

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {state === 'success' || state === 'error' ? (
        <div className="text-center">
          {state === 'success' ? (
            <CheckCircle2 className="mx-auto h-14 w-14 text-fin-success" />
          ) : (
            <AlertCircle className="mx-auto h-14 w-14 text-fin-danger" />
          )}
          <Link to="/login" className="btn-primary mt-8 w-full">
            Ir para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Senha atual</span>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
              <input
                className="field pl-10"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </div>
          </label>
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-fin-danger">{message}</p>}
          <button className="btn-primary w-full" disabled={state === 'loading'}>
            {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar alteração
          </button>
        </form>
      )}
    </AuthShell>
  )
}
