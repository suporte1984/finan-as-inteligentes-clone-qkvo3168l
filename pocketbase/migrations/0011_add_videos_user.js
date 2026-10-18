migrate(
  (app) => {
    const email = 'videos@adapta.org'
    const name = 'Vídeos Adapta'
    const password = 'Skip@123456'

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    let userRec

    // 1. Criar ou carregar o registro na coleção auth users
    try {
      userRec = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      userRec = new Record(usersCol)
      userRec.setEmail(email)
      userRec.setPassword(password)
      userRec.setVerified(true)
      userRec.set('name', name)
      app.save(userRec)
    }

    const userId = userRec.id

    // 2. Criar perfil na coleção profiles (se ainda não existir)
    try {
      const profilesCol = app.findCollectionByNameOrId('profiles')
      try {
        app.findFirstRecordByData('profiles', 'user', userId)
      } catch (_) {
        const profileRec = new Record(profilesCol)
        profileRec.set('user', userId)
        profileRec.set('name', name)
        profileRec.set('email', email)
        profileRec.set('active', true)
        app.save(profileRec)
      }
    } catch (err) {
      console.log('[migration:0011] Erro ao criar perfil: ' + err.message)
    }

    // 3. Criar configurações na coleção settings com os defaults sensatos
    // Usuários demo nascem com bills_reminder_enabled = false
    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      try {
        app.findFirstRecordByData('settings', 'user', userId)
      } catch (_) {
        const settingsRec = new Record(settingsCol)
        settingsRec.set('user', userId)
        settingsRec.set('bills_reminder_enabled', false)
        settingsRec.set('bills_reminder_days', 3)
        settingsRec.set('bills_reminder_hour', 9)
        settingsRec.set('ai_report_auto_enabled', true)
        settingsRec.set('ai_report_notify_email', false)
        settingsRec.set('ai_report_hour', 9)
        settingsRec.set('custom_recipient', '')
        app.save(settingsRec)
      }
    } catch (err) {
      console.log('[migration:0011] Erro ao criar settings: ' + err.message)
    }
  },
  (app) => {
    const email = 'videos@adapta.org'
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', email)
      app.delete(user)
    } catch (_) {}
  },
)
