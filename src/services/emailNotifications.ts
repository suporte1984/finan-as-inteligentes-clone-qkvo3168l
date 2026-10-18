import pb from '@/lib/pocketbase/client'
import type { EmailNotification } from '@/types/finance'

export interface ListEmailNotificationsOptions {
  limit?: number
}

/**
 * Lista os disparos de e-mails registrados para o usuário logado (mais recentes primeiro).
 */
export async function listEmailNotifications(
  options: ListEmailNotificationsOptions = {},
): Promise<EmailNotification[]> {
  const userId = pb.authStore.record?.id
  if (!userId) return []

  const limit = options.limit || 20

  const res = await pb.collection<EmailNotification>('email_notifications').getList(1, limit, {
    filter: `user = '${userId}'`,
    sort: '-created',
  })

  return res.items
}
