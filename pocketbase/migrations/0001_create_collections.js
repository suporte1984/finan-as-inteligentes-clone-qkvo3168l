migrate(
  (app) => {
    const ownerRule = 'user = @request.auth.id'

    const accounts = new Collection({
      name: 'accounts',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        { name: 'name', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['carteira', 'banco', 'cartao'],
          maxSelect: 1,
        },
        { name: 'initial_balance', type: 'number' },
        { name: 'color', type: 'text', max: 20 },
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
      indexes: ['CREATE INDEX idx_accounts_user ON accounts (user)'],
    })
    app.save(accounts)

    const categories = new Collection({
      name: 'categories',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        { name: 'name', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'color', type: 'text', max: 20 },
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
        'CREATE INDEX idx_categories_user ON categories (user)',
        'CREATE INDEX idx_categories_type ON categories (type)',
      ],
    })
    app.save(categories)

    const transactions = new Collection({
      name: 'transactions',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        { name: 'description', type: 'text', required: true, min: 1, max: 180 },
        { name: 'amount', type: 'number', required: true, min: 0.01 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'date', type: 'date', required: true },
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
          name: 'attachment',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
        },
        { name: 'notes', type: 'text', max: 5000 },
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
        'CREATE INDEX idx_transactions_user ON transactions (user)',
        'CREATE INDEX idx_transactions_date ON transactions (date)',
        'CREATE INDEX idx_transactions_type ON transactions (type)',
        'CREATE INDEX idx_transactions_category ON transactions (category)',
        'CREATE INDEX idx_transactions_account ON transactions (account)',
      ],
    })
    app.save(transactions)

    const bills = new Collection({
      name: 'bills',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        { name: 'description', type: 'text', required: true, min: 1, max: 180 },
        { name: 'amount', type: 'number', required: true, min: 0.01 },
        {
          name: 'direction',
          type: 'select',
          required: true,
          values: ['pagar', 'receber'],
          maxSelect: 1,
        },
        { name: 'due_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['em_aberto', 'pago', 'atrasado'],
          maxSelect: 1,
        },
        { name: 'category', type: 'relation', collectionId: categories.id, maxSelect: 1 },
        { name: 'account', type: 'relation', collectionId: accounts.id, maxSelect: 1 },
        { name: 'transaction', type: 'relation', collectionId: transactions.id, maxSelect: 1 },
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
        'CREATE INDEX idx_bills_user ON bills (user)',
        'CREATE INDEX idx_bills_status ON bills (status)',
        'CREATE INDEX idx_bills_due_date ON bills (due_date)',
      ],
    })
    app.save(bills)

    const reports = new Collection({
      name: 'ai_reports',
      type: 'base',
      listRule: ownerRule,
      viewRule: ownerRule,
      createRule: ownerRule,
      updateRule: ownerRule,
      deleteRule: ownerRule,
      fields: [
        { name: 'month', type: 'text', required: true, pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        { name: 'summary', type: 'text', max: 12000 },
        { name: 'insights', type: 'json', maxSize: 1048576 },
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
      indexes: ['CREATE UNIQUE INDEX idx_ai_reports_user_month ON ai_reports (user, month)'],
    })
    app.save(reports)

    const savedCategories = app.findCollectionByNameOrId('categories')
    savedCategories.fields.add(
      new RelationField({
        name: 'parent',
        collectionId: savedCategories.id,
        maxSelect: 1,
      }),
    )
    savedCategories.addIndex('idx_categories_parent', false, 'parent', '')
    app.save(savedCategories)
  },
  (app) => {
    const names = ['ai_reports', 'bills', 'transactions', 'categories', 'accounts']
    for (let i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
