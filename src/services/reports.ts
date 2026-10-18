import pb from '@/lib/pocketbase/client'
import { escapeFilter } from '@/lib/format'
import type { AiReport } from '@/types/finance'

export async function getSavedReport(month: string) {
  try {
    return await pb
      .collection<AiReport>('ai_reports')
      .getFirstListItem(`month = '${escapeFilter(month)}'`)
  } catch {
    return null
  }
}

export function generateMonthlyReport(month: string, regenerate = false) {
  return pb.send<AiReport>(
    `/backend/v1/ai/monthly-report/${month}${regenerate ? '?regenerar=true' : ''}`,
    {
      method: 'POST',
    },
  )
}
