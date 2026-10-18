import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react'

import { AuthShell } from '@/components/auth/AuthShell'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return setMessage('O link de recuperação é inválido ou está incompleto.')
    if (password.length < 8) return setMessage('A senha deve ter no mínimo 8 caracteres.')
    if (password !== confirm) return setMessage('As senhas não coincidem.')
    setLoading(true)
    setMessage('')
    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirm)
      setSuccess(true)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }
  return (
    <AuthShell
      title={success ? 'Senha alterada' : 'Defina uma nova senha'}
      subtitle={
        success
          ? 'Sua nova senha já pode ser usada.'
          : 'Escolha uma senha segura com pelo menos 8 caracteres.'
      }
    >
      {success ? (
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50 text-fin-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <Link to="/login" className="btn-primary mt-7 w-full">
            Entrar com a nova senha
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <PasswordInput label="Nova senha" value={password} setValue={setPassword} />
          <PasswordInput label="Confirmar nova senha" value={confirm} setValue={setConfirm} />
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-fin-danger">{message}</p>}
          <button className="btn-primary w-full" disabled={loading || !token}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Salvar nova senha
          </button>
        </form>
      )}
    </AuthShell>
  )
}

function PasswordInput({
  label,
  value,
  setValue,
}: {
  label: string
  value: string
  setValue: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="relative">
        <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-fin-muted" />
        <input
          className="field pl-10"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </label>
  )
}
