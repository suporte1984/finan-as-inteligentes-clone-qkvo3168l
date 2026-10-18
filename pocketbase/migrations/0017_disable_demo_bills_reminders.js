migrate(
  (app) => {
    const demoEmails = ['videos@adapta.org', 'paulo.gabriel@adapta.org']

    for (let i = 0; i < demoEmails.length; i++) {
      const email = demoEmails[i]
      try {
        const user = app.findAuthRecordByEmail('_pb_users_auth_', email)
        const userId = user.id

        try {
          const settingsRec = app.findFirstRecordByData('settings', 'user', userId)
          settingsRec.set('bills_reminder_enabled', false)
          app.save(settingsRec)
          console.log('[migration:0017] bills_reminder_enabled desativado para: ' + email)
        } catch (_) {
          console.log('[migration:0017] Registro de settings não encontrado para: ' + email)
        }
      } catch (_) {
        console.log('[migration:0017] Usuário demo não encontrado: ' + email)
      }
    }
  },
  (app) => {},
)
