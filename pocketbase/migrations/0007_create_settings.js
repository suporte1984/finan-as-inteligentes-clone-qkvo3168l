migrate(
  (app) => {
    // Regras restritas ao dono (user = @request.auth.id)
    const ownerRule = "@request.auth.id != '' && user = @request.auth.id"

    const settings = new Collection({
      name: 'settings',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: "@request.auth.id != '' && user = @request.auth.id",
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        // bool flags não devem ser required (no PB required exige true)
        { name: 'bills_reminder_enabled', type: 'bool' },
        { name: 'bills_reminder_days', type: 'number', min: 1, max: 30, onlyInt: true },
        { name: 'ai_report_auto_enabled', type: 'bool' },
        { name: 'ai_report_notify_email', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_settings_user ON settings (user)'],
    })
    app.save(settings)

    // Semear settings default para usuários existentes (especialmente paulo.gabriel@adapta.org)
    // Usuários demo nascem com bills_reminder_enabled = false
    const users = app.findRecordsByFilter('users', '', '-created', 100, 0)
    for (let i = 0; i < users.length; i++) {
      const u = users[i]
      try {
        app.findFirstRecordByData('settings', 'user', u.id)
      } catch (_) {
        const s = new Record(settings)
        s.set('user', u.id)
        s.set('bills_reminder_enabled', false)
        s.set('bills_reminder_days', 3)
        s.set('ai_report_auto_enabled', true)
        s.set('ai_report_notify_email', false)
        app.save(s)
      }
    }
  },
  (app) => {
    try {
      const settings = app.findCollectionByNameOrId('settings')
      app.delete(settings)
    } catch (_) {}
  },
)
