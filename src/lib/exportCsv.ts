import type { Account, Category, Transaction } from '@/types/finance'
import { getCategoryPath } from '@/lib/categories'
import { formatDate } from '@/lib/format'

/**
 * Escapa uma célula de CSV delimitada por ponto e vírgula (;).
 * Envolve em aspas se contiver ponto e vírgula, quebra de linha ou aspas.
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Formata número com vírgula decimal pt-BR para o Excel (ex: 1250,50 ou -320,00)
 */
function formatCsvAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

/**
 * Exporta lançamentos como CSV real com BOM UTF-8 e download direto via Blob.
 * Colunas: Data, Descrição, Categoria (caminho completo tipo "Alimentação > Mercado"), Conta, Tipo, Valor, Notas.
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  filename = 'lancamentos.csv',
) {
  const accountsMap = new Map<string, string>(accounts.map((a) => [a.id, a.name]))

  const headers = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor', 'Notas']

  const rows = transactions.map((t) => {
    const dateFormatted = formatDate(t.date)
    const categoryPath = getCategoryPath(t.category, categories)
    const accountName = accountsMap.get(t.account) || t.expand?.account?.name || 'Sem conta'
    const typeLabel = t.type === 'receita' ? 'Receita' : 'Despesa'
    const valueFormatted = formatCsvAmount(t.amount)
    const notes = t.notes || ''

    return [
      escapeCsvCell(dateFormatted),
      escapeCsvCell(t.description),
      escapeCsvCell(categoryPath),
      escapeCsvCell(accountName),
      escapeCsvCell(typeLabel),
      escapeCsvCell(valueFormatted),
      escapeCsvCell(notes),
    ].join(';')
  })

  // BOM UTF-8 (\uFEFF) para que Excel no Windows abra corretamente com acentos pt-BR
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
