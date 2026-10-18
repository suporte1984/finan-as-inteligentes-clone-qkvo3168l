migrate(
  (app) => {
    const ownerRule = 'user = @request.auth.id'
    const categories = app.findCollectionByNameOrId('categories')
    const accounts = app.findCollectionByNameOrId('accounts')

    const recurring = new Collection({
      name: 'recurring_transactions',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        {
          name: 'description',
          type: 'text',
          required: true,
          min: 1,
          max: 180,
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          min: 0.01,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        {
          name: 'frequency',
          type: 'select',
          required: true,
          values: ['mensal', 'semanal', 'quinzenal', 'anual'],
          maxSelect: 1,
        },
        {
          name: 'day_of_month',
          type: 'number',
          min: 1,
          max: 31,
          onlyInt: true,
        },
        {
          name: 'start_date',
          type: 'date',
          required: true,
        },
        {
          name: 'end_date',
          type: 'date',
        },
        {
          name: 'last_run',
          type: 'date',
        },
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: categories.id,
          maxSelect: 1,
        },
        {
          name: 'account',
          type: 'relation',
          required: true,
          collectionId: accounts.id,
          maxSelect: 1,
        },
        {
          name: 'active',
          type: 'bool',
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_recurring_user ON recurring_transactions (user)',
        'CREATE INDEX idx_recurring_active ON recurring_transactions (active)',
      ],
    })
    app.save(recurring)

    // Seed demo para paulo.gabriel@adapta.org
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'paulo.gabriel@adapta.org')
      if (user) {
        // Verificar se já tem recorrências
        const existing = app.findRecordsByFilter(
          'recurring_transactions',
          "user = '" + user.id + "'",
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const findCategory = (name) => {
            const safe = String(name).replace(/'/g, "\\'")
            const rows = app.findRecordsByFilter(
              'categories',
              "user = '" + user.id + "' && name = '" + safe + "'",
              '',
              1,
              0,
            )
            return rows.length ? rows[0] : null
          }

          const findAccount = (name) => {
            const safe = String(name).replace(/'/g, "\\'")
            const rows = app.findRecordsByFilter(
              'accounts',
              "user = '" + user.id + "' && name = '" + safe + "'",
              '',
              1,
              0,
            )
            return rows.length ? rows[0] : null
          }

          const catSalario = findCategory('Salário mensal') || findCategory('Salário')
          const catAluguel = findCategory('Aluguel') || findCategory('Moradia')
          const catNetflix = findCategory('Streaming') || findCategory('Assinaturas')

          const accBanco = findAccount('Conta principal')
          const accCartao = findAccount('Cartão de crédito') || accBanco

          const now = new Date()
          const currentYear = now.getUTCFullYear()
          const currentMonth = now.getUTCMonth() // 0-indexed

          // Formatar data UTC YYYY-MM-DD 12:00:00.000Z
          const pad = (n) => String(n).padStart(2, '0')
          const makeDateStr = (year, monthIdx, day) => {
            return year + '-' + pad(monthIdx + 1) + '-' + pad(day) + ' 12:00:00.000Z'
          }

          // 1. Salário mensal (R$ 6.800,00 dia 1)
          if (catSalario && accBanco) {
            const r1 = new Record(recurring)
            r1.set('user', user.id)
            r1.set('description', 'Salário mensal')
            r1.set('amount', 6800)
            r1.set('type', 'receita')
            r1.set('frequency', 'mensal')
            r1.set('day_of_month', 1)
            r1.set('start_date', makeDateStr(currentYear, currentMonth, 1))
            r1.set('last_run', makeDateStr(currentYear, currentMonth, 1))
            r1.set('category', catSalario.id)
            r1.set('account', accBanco.id)
            r1.set('active', true)
            app.save(r1)
          }

          // 2. Aluguel (R$ 1.850,00 dia 5)
          if (catAluguel && accBanco) {
            const r2 = new Record(recurring)
            r2.set('user', user.id)
            r2.set('description', 'Aluguel do apartamento')
            r2.set('amount', 1850)
            r2.set('type', 'despesa')
            r2.set('frequency', 'mensal')
            r2.set('day_of_month', 5)
            r2.set('start_date', makeDateStr(currentYear, currentMonth, 5))
            r2.set('last_run', makeDateStr(currentYear, currentMonth, 5))
            r2.set('category', catAluguel.id)
            r2.set('account', accBanco.id)
            r2.set('active', true)
            app.save(r2)
          }

          // 3. Netflix (R$ 55,90 dia 10)
          if (catNetflix && (accCartao || accBanco)) {
            const r3 = new Record(recurring)
            r3.set('user', user.id)
            r3.set('description', 'Assinatura Netflix Premium')
            r3.set('amount', 55.9)
            r3.set('type', 'despesa')
            r3.set('frequency', 'mensal')
            r3.set('day_of_month', 10)
            r3.set('start_date', makeDateStr(currentYear, currentMonth, 10))
            r3.set('last_run', makeDateStr(currentYear, currentMonth, 10))
            r3.set('category', catNetflix.id)
            r3.set('account', (accCartao || accBanco).id)
            r3.set('active', true)
            app.save(r3)
          }
        }
      }
    } catch (seedErr) {
      console.log('Seed recurring demo skipped or error: ' + seedErr.message)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('recurring_transactions'))
    } catch (_) {}
  },
)
