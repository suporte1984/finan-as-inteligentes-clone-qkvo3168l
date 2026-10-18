import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import pb from '@/lib/pocketbase/client'

type State = 'loading' | 'success' | 'error'
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<State>('loading')
  useEffect(() => {
    const token = params.get('token')
    if (!token) return setState('error')
    pb.collection('users')
      .confirmVerification(token)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [params])
  const title =
    state === 'loading'
      ? 'Confirmando seu e-mail'
      : state === 'success'
        ? 'E-mail confirmado'
        : 'Não foi possível confirmar'
  const subtitle =
    state === 'loading'
      ? 'Aguarde enquanto validamos seu link.'
      : state === 'success'
        ? 'Sua conta está pronta para uso.'
        : 'O link pode ter expirado ou já ter sido utilizado.'
  return (
    <AuthShell title={title} subtitle={subtitle}>
      <div className="text-center">
        {state === 'loading' ? (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-fin-primary" />
        ) : state === 'success' ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-fin-success" />
        ) : (
          <AlertCircle className="mx-auto h-14 w-14 text-fin-danger" />
        )}
        {state !== 'loading' && (
          <Link to="/login" className="btn-primary mt-8 w-full">
            Ir para o login
          </Link>
        )}
      </div>
    </AuthShell>
  )
}
