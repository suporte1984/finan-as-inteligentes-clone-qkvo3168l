import type { ReactNode } from 'react'
import { BarChart3, BrainCircuit, CheckCircle2, WalletCards } from 'lucide-react'

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#171727] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-fin-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-fin-text">
            <WalletCards className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold leading-tight">
            Finanças
            <br />
            Inteligentes
          </span>
        </div>
        <div className="relative my-auto max-w-lg">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
            <BrainCircuit className="h-3.5 w-3.5" />
            Seu fechamento mensal, simplificado
          </span>
          <h2 className="text-4xl font-semibold leading-[1.15] tracking-[-.04em]">
            Entenda seu dinheiro.
            <br />
            <span className="text-[#AEB0FF]">Decida com inteligência.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
            Consolide lançamentos, acompanhe vencimentos e receba análises claras sobre onde você
            pode economizar.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Feature icon={<BarChart3 className="h-4 w-4" />} text="Dashboard em tempo real" />
            <Feature icon={<CheckCircle2 className="h-4 w-4" />} text="Contas sempre em dia" />
            <Feature icon={<BrainCircuit className="h-4 w-4" />} text="Análise mensal com IA" />
            <Feature icon={<WalletCards className="h-4 w-4" />} text="Tudo em um só lugar" />
          </div>
        </div>
        <p className="relative text-xs text-white/35">
          © {new Date().getFullYear()} Finanças Inteligentes
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-fin-text text-white">
              <WalletCards className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold leading-tight">
              Finanças
              <br />
              Inteligentes
            </span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-.035em] text-fin-text">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-fin-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}

function Feature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.06] px-3 py-3 text-xs text-white/75">
      <span className="text-[#AEB0FF]">{icon}</span>
      {text}
    </div>
  )
}
