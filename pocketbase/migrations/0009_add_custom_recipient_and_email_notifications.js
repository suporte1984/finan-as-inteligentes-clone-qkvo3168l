migrate(
  (app) => {
    // 1. Adicionar custom_recipient à coleção settings se ainda não existir
    const settingsCol = app.findCollectionByNameOrId('settings')
    if (!settingsCol.fields.getByName('custom_recipient')) {
      settingsCol.fields.add(
        new EmailField({
          name: 'custom_recipient',
          required: false,
        }),
      )
      app.save(settingsCol)
    }

    // 2. Criar coleção email_notifications para registrar o histórico visível de disparos
    // Regras de acesso restritas ao dono
    const ownerRule = "@request.auth.id != '' && user = @request.auth.id"

    try {
      app.findCollectionByNameOrId('email_notifications')
    } catch (_) {
      const emailNotifications = new Collection({
        name: 'email_notifications',
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
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['lembrete_contas', 'resumo_ia'],
            maxSelect: 1,
          },
          {
            name: 'recipient',
            type: 'email',
            required: true,
          },
          {
            name: 'items_count',
            type: 'number',
            required: false,
            onlyInt: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['enviado', 'falhou', 'pulado'],
            maxSelect: 1,
          },
          {
            name: 'subject',
            type: 'text',
            required: false,
          },
          {
            name: 'error_message',
            type: 'text',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_email_notifications_user ON email_notifications (user)',
          'CREATE INDEX idx_email_notifications_created ON email_notifications (created)',
        ],
      })
      app.save(emailNotifications)
    }
  },
  (app) => {
    try {
      const emailNotifications = app.findCollectionByNameOrId('email_notifications')
      app.delete(emailNotifications)
    } catch (_) {}

    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      if (settingsCol.fields.getByName('custom_recipient')) {
        settingsCol.fields.removeByName('custom_recipient')
        app.save(settingsCol)
      }
    } catch (_) {}
  },
)
