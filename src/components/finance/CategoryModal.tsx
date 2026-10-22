import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFinance } from '@/contexts/FinanceContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { createCategory, updateCategory } from '@/services/categories'
import type { Category, CategoryInput, TransactionType } from '@/types/finance'

const colors = ['#5B5FEF', '#34C759', '#FFB020', '#F4526B', '#8B5CF6', '#06B6D4', '#F97316']

export function CategoryModal({
  category,
  open,
  onOpenChange,
  onSaved,
}: {
  category?: Category | null
  open: boolean
  onOpenChange: (value: boolean) => void
  onSaved?: (category: Category) => void
}) {
  const { categories, refreshCategories } = useFinance()
  const [form, setForm] = useState<CategoryInput>({
    name: '',
    type: 'despesa',
    color: colors[0],
    parent: '',
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const parents = useMemo(
    () =>
      categories.filter(
        (item) => !item.parent && item.type === form.type && item.id !== category?.id,
      ),
    [categories, form.type, category],
  )
  useEffect(() => {
    if (open) {
      setMessage('')
      setForm(
        category
          ? {
              name: category.name,
              type: category.type,
              color: category.color,
              parent: category.parent || '',
            }
          : { name: '', type: 'despesa', color: colors[0], parent: '' },
      )
    }
  }, [open, category])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return setMessage('Informe o nome da categoria.')
    setSaving(true)
    try {
      const saved = category ? await updateCategory(category.id, form) : await createCategory(form)
      await refreshCategories()
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-fin-border sm:max-w-md dark:border-white/10 dark:bg-gradient-to-br dark:from-indigo-950/35 dark:via-[#111726] dark:to-[#0c121e] dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-fin-text dark:text-slate-100">
            {category ? 'Editar categoria' : 'Nova categoria'}
          </DialogTitle>
          <DialogDescription className="text-fin-muted dark:text-slate-400">
            Use categorias e subcategorias para entender para onde vai seu dinheiro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">Nome</span>
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: Alimentação"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">
                Tipo
              </span>
              <select
                className="field"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as TransactionType, parent: '' })
                }
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">
                Categoria-mãe
              </span>
              <select
                className="field"
                value={form.parent}
                onChange={(event) => setForm({ ...form, parent: event.target.value })}
              >
                <option value="">Nenhuma</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="text-[13px] font-medium text-fin-text dark:text-slate-200">Cor</span>
            <div className="mt-2 flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className="grid h-8 w-8 place-items-center rounded-full"
                  style={{ background: color }}
                >
                  {form.color === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-fin-danger dark:bg-rose-950/40 dark:border dark:border-rose-500/30 dark:text-rose-300">
              {message}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar categoria'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
