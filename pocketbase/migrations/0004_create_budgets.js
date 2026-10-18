migrate(
  (app) => {
    const ownerRule = 'user = @request.auth.id'
    const categories = app.findCollectionByNameOrId('categories')

    const budgets = new Collection({
      name: 'budgets',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: categories.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'monthly_limit',
          type: 'number',
          required: true,
          min: 0.01,
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
        'CREATE UNIQUE INDEX idx_budgets_user_category ON budgets (user, category)',
        'CREATE INDEX idx_budgets_user ON budgets (user)',
      ],
    })
    app.save(budgets)

    // Seed de metas demo para paulo.gabriel@adapta.org
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'paulo.gabriel@adapta.org')
      if (user) {
        // Encontrar categorias do usuário
        const findCat = (catName) => {
          const safe = String(catName).replace(/'/g, "\\'")
          const rows = app.findRecordsByFilter(
            'categories',
            "user = '" + user.id + "' && name = '" + safe + "'",
            '',
            1,
            0,
          )
          return rows.length ? rows[0] : null
        }

        const seedBudgets = [
          // Alimentação (Mercado R$ 714,28 + Restaurantes R$ 79,60 = R$ 793,88 no mês atual) -> Limite R$ 900 (88,2% -> Alerta 80-99%)
          { catName: 'Alimentação', limit: 900 },
          // Transporte (Aplicativos R$ 38,50 no mês atual) -> Limite R$ 35 (110% -> Estourada >=100%)
          { catName: 'Transporte', limit: 35 },
          // Lazer (R$ 0 no mês atual) -> Limite R$ 300 (<80% -> Saudável)
          { catName: 'Lazer', limit: 300 },
        ]

        for (let i = 0; i < seedBudgets.length; i++) {
          const item = seedBudgets[i]
          const cat = findCat(item.catName)
          if (cat) {
            const existing = app.findRecordsByFilter(
              'budgets',
              "user = '" + user.id + "' && category = '" + cat.id + "'",
              '',
              1,
              0,
            )
            if (existing.length === 0) {
              const bRecord = new Record(budgets)
              bRecord.set('user', user.id)
              bRecord.set('category', cat.id)
              bRecord.set('monthly_limit', item.limit)
              app.save(bRecord)
            }
          }
        }
      }
    } catch (err) {
      console.log('Seed budgets demo skipped or error: ' + err.message)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('budgets'))
    } catch (_) {}
  },
)
