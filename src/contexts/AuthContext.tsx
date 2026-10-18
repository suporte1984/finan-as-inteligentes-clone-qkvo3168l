import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RecordModel } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

interface AuthContextValue {
  user: RecordModel | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record)
    }, true)
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setReady(true))
    } else {
      setReady(true)
    }
    return unsubscribe
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true,
    })
    await pb.collection('users').requestVerification(email)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, signup, logout }),
    [user, ready, login, signup, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
