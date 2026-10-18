import pb from '@/lib/pocketbase/client'
import type { UserSettings, UserSettingsInput } from '@/types/finance'

export const DEFAULT_SETTINGS: Omit<UserSettingsInput, 'user'> = {
  bills_reminder_enabled: true,
  bills_reminder_days: 3,
  bills_reminder_hour: 9,
  ai_report_auto_enabled: true,
  ai_report_notify_email: false,
  ai_report_hour: 9,
  custom_recipient: '',
}

/**
 * Busca as configurações do usuário autenticado.
 * Se ainda não existir registro em `settings`, cria um sob demanda com os valores padrão.
 */
export async function getUserSettings(): Promise<UserSettings> {
  const userId = pb.authStore.record?.id
  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  try {
    const list = await pb.collection<UserSettings>('settings').getList(1, 1, {
      filter: `user = '${userId}'`,
    })
    if (list.items.length > 0) {
      return list.items[0]
    }
  } catch (err: unknown) {
    // Se não encontrou, tentamos criar a seguir
    const status = (err as { status?: number })?.status
    if (status !== 404) {
      // continua para a tentativa de criação
    }
  }

  // Criar on-demand se não existir
  return pb.collection<UserSettings>('settings').create({
    user: userId,
    bills_reminder_enabled: DEFAULT_SETTINGS.bills_reminder_enabled ?? true,
    bills_reminder_days: DEFAULT_SETTINGS.bills_reminder_days ?? 3,
    bills_reminder_hour: DEFAULT_SETTINGS.bills_reminder_hour ?? 9,
    ai_report_auto_enabled: DEFAULT_SETTINGS.ai_report_auto_enabled ?? true,
    ai_report_notify_email: DEFAULT_SETTINGS.ai_report_notify_email ?? false,
    ai_report_hour: DEFAULT_SETTINGS.ai_report_hour ?? 9,
    custom_recipient: '',
  })
}

/**
 * Atualiza as configurações do usuário autenticado.
 */
export async function updateUserSettings(
  settingsId: string,
  input: UserSettingsInput,
): Promise<UserSettings> {
  return pb.collection<UserSettings>('settings').update(settingsId, input)
}
