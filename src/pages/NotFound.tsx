import { Link } from 'react-router-dom'
import { ArrowLeft, FileQuestion, WalletCards } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-fin-sidebar px-5">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-fin-text text-white">
          <WalletCards className="h-5 w-5" />
        </span>
        <div className="fin-card p-8">
          <FileQuestion className="mx-auto h-11 w-11 text-fin-primary" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-fin-primary">
            Erro 404
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="mt-3 text-sm leading-6 text-fin-muted">
            O endereço pode estar incorreto ou a página pode ter sido movida.
          </p>
          <Link to="/" className="btn-primary mt-7 w-full">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  )
}
