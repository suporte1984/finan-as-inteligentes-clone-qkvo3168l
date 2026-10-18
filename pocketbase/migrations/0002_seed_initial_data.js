migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'paulo.gabriel@adapta.org')
    } catch (_) {
      user = new Record(users)
      user.setEmail('paulo.gabriel@adapta.org')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Paulo Gabriel')
      app.save(user)
    }

    const findOwned = (collection, field, value) => {
      const safe = String(value).replace(/'/g, "\\'")
      const rows = app.findRecordsByFilter(
        collection,
        "user = '" + user.id + "' && " + field + " = '" + safe + "'",
        '',
        1,
        0,
      )
      return rows.length ? rows[0] : null
    }

    const createOwned = (collectionName, values) => {
      const record = new Record(app.findCollectionByNameOrId(collectionName))
      const keys = Object.keys(values)
      for (let i = 0; i < keys.length; i++) record.set(keys[i], values[keys[i]])
      record.set('user', user.id)
      app.save(record)
      return record
    }

    const accountDefinitions = [
      { name: 'Conta principal', type: 'banco', initial_balance: 4800, color: '#5B5FEF' },
      { name: 'Carteira', type: 'carteira', initial_balance: 350, color: '#FFB020' },
      { name: 'Cartão de crédito', type: 'cartao', initial_balance: 0, color: '#F4526B' },
      { name: 'Reserva', type: 'banco', initial_balance: 12000, color: '#34C759' },
    ]
    const accountMap = {}
    for (let i = 0; i < accountDefinitions.length; i++) {
      const item = accountDefinitions[i]
      accountMap[item.name] =
        findOwned('accounts', 'name', item.name) || createOwned('accounts', item)
    }

    const categoryDefinitions = [
      { name: 'Moradia', type: 'despesa', color: '#5B5FEF', children: ['Aluguel', 'Condomínio'] },
      {
        name: 'Alimentação',
        type: 'despesa',
        color: '#F97316',
        children: ['Mercado', 'Restaurantes'],
      },
      {
        name: 'Transporte',
        type: 'despesa',
        color: '#06B6D4',
        children: ['Combustível', 'Aplicativos'],
      },
      { name: 'Saúde', type: 'despesa', color: '#E5484D', children: ['Farmácia', 'Consultas'] },
      { name: 'Lazer', type: 'despesa', color: '#8B5CF6', children: ['Viagens', 'Entretenimento'] },
      {
        name: 'Assinaturas',
        type: 'despesa',
        color: '#F4526B',
        children: ['Streaming', 'Software'],
      },
      { name: 'Educação', type: 'despesa', color: '#FFB020', children: ['Cursos', 'Livros'] },
      { name: 'Impostos', type: 'despesa', color: '#D97706', children: ['Tributos'] },
      { name: 'Salário', type: 'receita', color: '#16A34A', children: ['Salário mensal'] },
      { name: 'Freelance', type: 'receita', color: '#34C759', children: ['Projetos'] },
      { name: 'Investimentos', type: 'receita', color: '#06B6D4', children: ['Rendimentos'] },
      { name: 'Vendas', type: 'receita', color: '#5B5FEF', children: ['Produtos'] },
    ]
    const categoryMap = {}
    for (let i = 0; i < categoryDefinitions.length; i++) {
      const item = categoryDefinitions[i]
      let root = findOwned('categories', 'name', item.name)
      if (!root)
        root = createOwned('categories', { name: item.name, type: item.type, color: item.color })
      categoryMap[item.name] = root
      for (let j = 0; j < item.children.length; j++) {
        const childName = item.children[j]
        let child = findOwned('categories', 'name', childName)
        if (!child)
          child = createOwned('categories', {
            name: childName,
            type: item.type,
            color: item.color,
            parent: root.id,
          })
        categoryMap[childName] = child
      }
    }

    const pad = (value) => String(value).padStart(2, '0')
    const dateForMonth = (offset, day) => {
      const now = new Date()
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, day, 12, 0, 0),
      )
      return date.toISOString().replace('T', ' ')
    }
    const relativeDate = (days) => {
      const date = new Date()
      date.setUTCHours(12, 0, 0, 0)
      date.setUTCDate(date.getUTCDate() + days)
      return date.toISOString().replace('T', ' ')
    }

    const existingTransactions = app.findRecordsByFilter(
      'transactions',
      "user = '" + user.id + "'",
      '',
      1,
      0,
    )
    if (existingTransactions.length === 0) {
      const transactionDefinitions = [
        [-2, 5, 'Salário mensal', 6800, 'receita', 'Salário mensal', 'Conta principal'],
        [-2, 7, 'Aluguel', 1850, 'despesa', 'Aluguel', 'Conta principal'],
        [-2, 8, 'Netflix', 55.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [-2, 9, 'Spotify', 21.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [-2, 10, 'Supermercado Pão de Açúcar', 642.35, 'despesa', 'Mercado', 'Cartão de crédito'],
        [-2, 12, 'Posto de combustível', 280, 'despesa', 'Combustível', 'Cartão de crédito'],
        [-2, 15, 'Livro de finanças', 74.9, 'despesa', 'Livros', 'Cartão de crédito'],
        [-1, 5, 'Salário mensal', 6800, 'receita', 'Salário mensal', 'Conta principal'],
        [-1, 7, 'Aluguel', 1850, 'despesa', 'Aluguel', 'Conta principal'],
        [-1, 8, 'Netflix', 55.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [-1, 9, 'Spotify', 21.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [-1, 10, 'Supermercado Pão de Açúcar', 598.72, 'despesa', 'Mercado', 'Cartão de crédito'],
        [-1, 11, 'Jantar com amigos', 164.8, 'despesa', 'Restaurantes', 'Cartão de crédito'],
        [-1, 13, 'Posto de combustível', 260, 'despesa', 'Combustível', 'Cartão de crédito'],
        [-1, 15, 'Cinema', 68, 'despesa', 'Entretenimento', 'Carteira'],
        [0, 5, 'Salário mensal', 6800, 'receita', 'Salário mensal', 'Conta principal'],
        [0, 7, 'Aluguel', 1850, 'despesa', 'Aluguel', 'Conta principal'],
        [0, 8, 'Netflix', 55.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [0, 9, 'Spotify', 21.9, 'despesa', 'Streaming', 'Cartão de crédito'],
        [0, 10, 'Supermercado Pão de Açúcar', 714.28, 'despesa', 'Mercado', 'Cartão de crédito'],
        [0, 11, 'Almoço no centro', 79.6, 'despesa', 'Restaurantes', 'Cartão de crédito'],
        [0, 12, 'Corrida por aplicativo', 38.5, 'despesa', 'Aplicativos', 'Cartão de crédito'],
        [0, 13, 'Farmácia', 126.45, 'despesa', 'Farmácia', 'Cartão de crédito'],
        [0, 14, 'Curso de Excel', 249, 'despesa', 'Cursos', 'Cartão de crédito'],
        [0, 15, 'Projeto de identidade visual', 1450, 'receita', 'Projetos', 'Conta principal'],
        [0, 16, 'Rendimento da reserva', 118.32, 'receita', 'Rendimentos', 'Reserva'],
      ]
      for (let i = 0; i < transactionDefinitions.length; i++) {
        const item = transactionDefinitions[i]
        createOwned('transactions', {
          date: dateForMonth(item[0], item[1]),
          description: item[2],
          amount: item[3],
          type: item[4],
          category: categoryMap[item[5]].id,
          account: accountMap[item[6]].id,
          notes: '',
        })
      }
    }

    const existingBills = app.findRecordsByFilter('bills', "user = '" + user.id + "'", '', 1, 0)
    if (existingBills.length === 0) {
      const billDefinitions = [
        {
          description: 'Internet residencial',
          amount: 119.9,
          direction: 'pagar',
          due_date: relativeDate(3),
          status: 'em_aberto',
          category: categoryMap['Moradia'].id,
          account: accountMap['Conta principal'].id,
        },
        {
          description: 'Conta de energia',
          amount: 238.4,
          direction: 'pagar',
          due_date: relativeDate(6),
          status: 'em_aberto',
          category: categoryMap['Moradia'].id,
          account: accountMap['Conta principal'].id,
        },
        {
          description: 'Cliente Projeto Aurora',
          amount: 2200,
          direction: 'receber',
          due_date: relativeDate(2),
          status: 'em_aberto',
          category: categoryMap['Projetos'].id,
          account: accountMap['Conta principal'].id,
        },
        {
          description: 'Condomínio',
          amount: 520,
          direction: 'pagar',
          due_date: relativeDate(-5),
          status: 'atrasado',
          category: categoryMap['Condomínio'].id,
          account: accountMap['Conta principal'].id,
        },
        {
          description: 'Fatura do cartão',
          amount: 1940.2,
          direction: 'pagar',
          due_date: relativeDate(-3),
          status: 'pago',
          category: categoryMap['Assinaturas'].id,
          account: accountMap['Conta principal'].id,
        },
        {
          description: 'Mensalidade do curso',
          amount: 249,
          direction: 'pagar',
          due_date: dateForMonth(-1, 12),
          status: 'pago',
          category: categoryMap['Cursos'].id,
          account: accountMap['Conta principal'].id,
        },
      ]
      for (let i = 0; i < billDefinitions.length; i++) createOwned('bills', billDefinitions[i])
    }
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'paulo.gabriel@adapta.org')
      app.delete(user)
    } catch (_) {}
  },
)
