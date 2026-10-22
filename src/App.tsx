import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import Layout from '@/components/Layout'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { FinanceProvider, useFinance } from '@/contexts/FinanceContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Index from '@/pages/Index'
import OnboardingPage from '@/pages/Onboarding'
import TransactionsPage from '@/pages/Transactions'
import BillsPage from '@/pages/Bills'
import CategoriesPage from '@/pages/Categories'
import ReportsPage from '@/pages/Reports'
import RecurringPage from '@/pages/Recorrentes'
import AssistantPage from '@/pages/Assistant'
import UsersPage from '@/pages/Users'
import SettingsPage from '@/pages/Settings'
import LoginPage from '@/pages/auth/Login'
import SignupPage from '@/pages/auth/Signup'
import VerifyEmailPage from '@/pages/auth/VerifyEmail'
import ForgotPasswordPage from '@/pages/auth/ForgotPassword'
import ResetPasswordPage from '@/pages/auth/ResetPassword'
import ConfirmEmailChangePage from '@/pages/auth/ConfirmEmailChange'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'

function ProtectedLayout() {
  const { user, ready } = useAuth()
  const { onboardingStatus, loadingOnboarding } = useFinance()
  const location = useLocation()

  if (!ready) return <AppLoader />
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  // Aguardar carregamento da checagem real de onboarding
  if (loadingOnboarding) return <AppLoader />

  // Se onboarding estiver incompleto, bloqueia acesso a qualquer tela protegida e joga para /onboarding
  if (onboardingStatus && !onboardingStatus.isComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return <Layout />
}

function OnboardingGuard() {
  const { user, ready } = useAuth()
  const { onboardingStatus, loadingOnboarding } = useFinance()

  if (!ready) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />

  if (loadingOnboarding) return <AppLoader />

  // Se o usuário já concluiu o onboarding com dados reais, redireciona para o dashboard
  if (onboardingStatus && onboardingStatus.isComplete) {
    return <Navigate to="/" replace />
  }

  return <OnboardingPage />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <AppLoader />
  return user ? <Navigate to="/" replace /> : children
}

function AppLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-fin-sidebar">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-fin-text text-lg font-bold text-white">
          FI
        </div>
        <p className="text-sm text-fin-muted">Organizando suas finanças...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FinanceProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnly>
                  <SignupPage />
                </PublicOnly>
              }
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/forgot-password"
              element={
                <PublicOnly>
                  <ForgotPasswordPage />
                </PublicOnly>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicOnly>
                  <ResetPasswordPage />
                </PublicOnly>
              }
            />
            <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
            <Route path="/onboarding" element={<OnboardingGuard />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Index />} />
              <Route path="lancamentos" element={<TransactionsPage />} />
              <Route path="contas" element={<BillsPage />} />
              <Route path="recorrentes" element={<RecurringPage />} />
              <Route path="categorias" element={<CategoriesPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="assistente" element={<AssistantPage />} />
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </FinanceProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
