migrate(
  (app) => {
    const email = 'videos@adapta.org'

    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      console.log('[migration:0012] Usuário videos@adapta.org não encontrado. Pulando seed.')
      return
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
      for (let i = 0; i < keys.length; i++) {
        record.set(keys[i], values[keys[i]])
      }
      record.set('user', user.id)
      app.save(record)
      return record
    }

    // 1. Contas
    const accountDefinitions = [
      { name: 'Conta Principal (PJ)', type: 'banco', initial_balance: 7500, color: '#5B5FEF' },
      { name: 'Carteira de Produção', type: 'carteira', initial_balance: 450, color: '#FFB020' },
      { name: 'Cartão Corporativo', type: 'cartao', initial_balance: 0, color: '#F4526B' },
      { name: 'Reserva Equipamentos', type: 'banco', initial_balance: 15000, color: '#34C759' },
    ]

    const accountMap = {}
    for (let i = 0; i < accountDefinitions.length; i++) {
      const item = accountDefinitions[i]
      accountMap[item.name] =
        findOwned('accounts', 'name', item.name) || createOwned('accounts', item)
    }

    // 2. Categorias (8 despesas com subcategorias, 4 receitas com subcategorias)
    const categoryDefinitions = [
      {
        name: 'Equipamentos',
        type: 'despesa',
        color: '#8B5CF6',
        children: ['Câmeras e Lentes', 'Iluminação e Áudio'],
      },
      {
        name: 'Moradia e Estúdio',
        type: 'despesa',
        color: '#5B5FEF',
        children: ['Aluguel do Estúdio', 'Condomínio e Energia'],
      },
      {
        name: 'Alimentação',
        type: 'despesa',
        color: '#F97316',
        children: ['Mercado e Café', 'Refeições em Gravação'],
      },
      {
        name: 'Transporte',
        type: 'despesa',
        color: '#06B6D4',
        children: ['Combustível', 'Aplicativos e Deslocamentos'],
      },
      {
        name: 'Assinaturas e Software',
        type: 'despesa',
        color: '#F4526B',
        children: ['Creative Cloud', 'Bancos de Trilha e Vídeo'],
      },
      {
        name: 'Lazer',
        type: 'despesa',
        color: '#EC4899',
        children: ['Cinema e Eventos', 'Descanso'],
      },
      {
        name: 'Saúde',
        type: 'despesa',
        color: '#E5484D',
        children: ['Farmácia', 'Consultas'],
      },
      {
        name: 'Educação',
        type: 'despesa',
        color: '#FFB020',
        children: ['Workshops', 'Livros Técnicos'],
      },
      // Receitas
      {
        name: 'Produção de Vídeos',
        type: 'receita',
        color: '#16A34A',
        children: ['Vídeos Institucionais', 'Contratos Mensais'],
      },
      {
        name: 'Edição e Pós-produção',
        type: 'receita',
        color: '#34C759',
        children: ['Projetos de Edição', 'Color Grading'],
      },
      {
        name: 'Rendimentos',
        type: 'receita',
        color: '#06B6D4',
        children: ['Rendimento da Reserva'],
      },
      {
        name: 'Vendas e Locação',
        type: 'receita',
        color: '#5B5FEF',
        children: ['Locação de Equipamentos'],
      },
    ]

    const categoryMap = {}
    for (let i = 0; i < categoryDefinitions.length; i++) {
      const item = categoryDefinitions[i]
      let root = findOwned('categories', 'name', item.name)
      if (!root) {
        root = createOwned('categories', {
          name: item.name,
          type: item.type,
          color: item.color,
        })
      }
      categoryMap[item.name] = root

      for (let j = 0; j < item.children.length; j++) {
        const childName = item.children[j]
        let child = findOwned('categories', 'name', childName)
        if (!child) {
          child = createOwned('categories', {
            name: childName,
            type: item.type,
            color: item.color,
            parent: root.id,
          })
        }
        categoryMap[childName] = child
      }
    }

    // Datas utilitárias
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

    // 3. Transações (26 lançamentos realistas distribuídos nos últimos 3 meses)
    const existingTransactions = app.findRecordsByFilter(
      'transactions',
      "user = '" + user.id + "'",
      '',
      1,
      0,
    )

    if (existingTransactions.length === 0) {
      const transactionDefinitions = [
        // Mês -2 (2 meses atrás)
        [
          -2,
          5,
          'Contrato Mensal - Produtora Alpha',
          8500,
          'receita',
          'Contratos Mensais',
          'Conta Principal (PJ)',
        ],
        [
          -2,
          6,
          'Aluguel do Estúdio',
          2200,
          'despesa',
          'Aluguel do Estúdio',
          'Conta Principal (PJ)',
        ],
        [-2, 8, 'Adobe Creative Cloud', 189.9, 'despesa', 'Creative Cloud', 'Cartão Corporativo'],
        [
          -2,
          9,
          'Artlist Trilha Sonora',
          119.5,
          'despesa',
          'Bancos de Trilha e Vídeo',
          'Cartão Corporativo',
        ],
        [
          -2,
          11,
          'Supermercado e Café da Produtora',
          580.4,
          'despesa',
          'Mercado e Café',
          'Cartão Corporativo',
        ],
        [-2, 13, 'Combustível para externa', 240, 'despesa', 'Combustível', 'Cartão Corporativo'],
        [
          -2,
          16,
          'Manutenção de Microfones',
          320,
          'despesa',
          'Iluminação e Áudio',
          'Conta Principal (PJ)',
        ],
        [
          -2,
          20,
          'Projeto de Edição Comercial',
          2100,
          'receita',
          'Projetos de Edição',
          'Conta Principal (PJ)',
        ],

        // Mês -1 (mês passado)
        [
          -1,
          5,
          'Contrato Mensal - Produtora Alpha',
          8500,
          'receita',
          'Contratos Mensais',
          'Conta Principal (PJ)',
        ],
        [
          -1,
          6,
          'Aluguel do Estúdio',
          2200,
          'despesa',
          'Aluguel do Estúdio',
          'Conta Principal (PJ)',
        ],
        [-1, 8, 'Adobe Creative Cloud', 189.9, 'despesa', 'Creative Cloud', 'Cartão Corporativo'],
        [
          -1,
          9,
          'Artlist Trilha Sonora',
          119.5,
          'despesa',
          'Bancos de Trilha e Vídeo',
          'Cartão Corporativo',
        ],
        [
          -1,
          10,
          'Supermercado e Café da Produtora',
          624.15,
          'despesa',
          'Mercado e Café',
          'Cartão Corporativo',
        ],
        [
          -1,
          12,
          'Almoço da equipe de gravação',
          185.6,
          'despesa',
          'Refeições em Gravação',
          'Cartão Corporativo',
        ],
        [-1, 14, 'Combustível para externas', 260, 'despesa', 'Combustível', 'Cartão Corporativo'],
        [
          -1,
          18,
          'Cabos XLR e Baterias extras',
          380,
          'despesa',
          'Iluminação e Áudio',
          'Carteira de Produção',
        ],
        [
          -1,
          22,
          'Locação de Iluminação LED',
          650,
          'receita',
          'Locação de Equipamentos',
          'Conta Principal (PJ)',
        ],

        // Mês 0 (mês atual)
        [
          0,
          5,
          'Contrato Mensal - Produtora Alpha',
          8500,
          'receita',
          'Contratos Mensais',
          'Conta Principal (PJ)',
        ],
        [0, 6, 'Aluguel do Estúdio', 2200, 'despesa', 'Aluguel do Estúdio', 'Conta Principal (PJ)'],
        [0, 8, 'Adobe Creative Cloud', 189.9, 'despesa', 'Creative Cloud', 'Cartão Corporativo'],
        [
          0,
          9,
          'Artlist Trilha Sonora',
          119.5,
          'despesa',
          'Bancos de Trilha e Vídeo',
          'Cartão Corporativo',
        ],
        [
          0,
          10,
          'Supermercado e Café da Produtora',
          645.8,
          'despesa',
          'Mercado e Café',
          'Cartão Corporativo',
        ],
        [
          0,
          11,
          'Almoço com cliente corporativo',
          142.3,
          'despesa',
          'Refeições em Gravação',
          'Cartão Corporativo',
        ],
        [
          0,
          12,
          'Corrida de aplicativo com tripés',
          48.9,
          'despesa',
          'Aplicativos e Deslocamentos',
          'Cartão Corporativo',
        ],
        [
          0,
          14,
          'Farmácia - Kit primeiros socorros estúdio',
          86.4,
          'despesa',
          'Farmácia',
          'Cartão Corporativo',
        ],
        [
          0,
          15,
          'Vídeo Institucional Tech Summit',
          4500,
          'receita',
          'Vídeos Institucionais',
          'Conta Principal (PJ)',
        ],
        [
          0,
          16,
          'Rendimento CDI Reserva',
          148.75,
          'receita',
          'Rendimento da Reserva',
          'Reserva Equipamentos',
        ],
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

    // 4. Contas a pagar/receber (bills)
    const existingBills = app.findRecordsByFilter('bills', "user = '" + user.id + "'", '', 1, 0)
    if (existingBills.length === 0) {
      const billDefinitions = [
        {
          description: 'Internet Fibra 1GB Estúdio',
          amount: 199.9,
          direction: 'pagar',
          due_date: relativeDate(4),
          status: 'em_aberto',
          category: categoryMap['Moradia e Estúdio'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
        {
          description: 'Energia Elétrica Estúdio',
          amount: 385.6,
          direction: 'pagar',
          due_date: relativeDate(7),
          status: 'em_aberto',
          category: categoryMap['Moradia e Estúdio'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
        {
          description: 'Recebimento Vídeo Institucional Tech Summit',
          amount: 4500,
          direction: 'receber',
          due_date: relativeDate(3),
          status: 'em_aberto',
          category: categoryMap['Vídeos Institucionais'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
        {
          description: 'Condomínio Comercial do Estúdio',
          amount: 780,
          direction: 'pagar',
          due_date: relativeDate(-4),
          status: 'atrasado',
          category: categoryMap['Condomínio e Energia'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
        {
          description: 'Fatura do Cartão Corporativo',
          amount: 1720.5,
          direction: 'pagar',
          due_date: relativeDate(-2),
          status: 'pago',
          category: categoryMap['Assinaturas e Software'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
        {
          description: 'Seguro de Câmeras e Lentes',
          amount: 320,
          direction: 'pagar',
          due_date: dateForMonth(-1, 15),
          status: 'pago',
          category: categoryMap['Câmeras e Lentes'].id,
          account: accountMap['Conta Principal (PJ)'].id,
        },
      ]
      for (let i = 0; i < billDefinitions.length; i++) {
        createOwned('bills', billDefinitions[i])
      }
    }

    // 5. Metas (budgets)
    // No mês atual:
    // Alimentação: Mercado e Café (645.80) + Refeições em Gravação (142.30) = 788.10.
    // -> Limite de 900.00 resulta em 788.10 / 900 = 87.6% (Alerta ~80-99%)
    //
    // Transporte: Aplicativos e Deslocamentos (48.90).
    // -> Limite de 45.00 resulta em 48.90 / 45 = 108.7% (Estourada >100%)
    //
    // Lazer: 0.00 gasto no mês atual.
    // -> Limite de 400.00 resulta em 0% (Tranquila / Saudável <80%)
    try {
      const budgetsCol = app.findCollectionByNameOrId('budgets')
      const existingBudgets = app.findRecordsByFilter(
        'budgets',
        "user = '" + user.id + "'",
        '',
        1,
        0,
      )

      if (existingBudgets.length === 0) {
        const seedBudgets = [
          { catName: 'Alimentação', limit: 900 },
          { catName: 'Transporte', limit: 45 },
          { catName: 'Lazer', limit: 400 },
        ]

        for (let i = 0; i < seedBudgets.length; i++) {
          const item = seedBudgets[i]
          const cat = categoryMap[item.catName]
          if (cat) {
            const bRecord = new Record(budgetsCol)
            bRecord.set('user', user.id)
            bRecord.set('category', cat.id)
            bRecord.set('monthly_limit', item.limit)
            app.save(bRecord)
          }
        }
      }
    } catch (budgetErr) {
      console.log('[migration:0012] Seed budgets error: ' + budgetErr.message)
    }

    // 6. Recorrências (recurring_transactions)
    try {
      const recurringCol = app.findCollectionByNameOrId('recurring_transactions')
      const existingRecurring = app.findRecordsByFilter(
        'recurring_transactions',
        "user = '" + user.id + "'",
        '',
        1,
        0,
      )

      if (existingRecurring.length === 0) {
        const now = new Date()
        const currentYear = now.getUTCFullYear()
        const currentMonth = now.getUTCMonth() // 0-indexed

        const pad = (n) => String(n).padStart(2, '0')
        const makeDateStr = (year, monthIdx, day) => {
          return year + '-' + pad(monthIdx + 1) + '-' + pad(day) + ' 12:00:00.000Z'
        }

        const catContratos = categoryMap['Contratos Mensais'] || categoryMap['Produção de Vídeos']
        const catAluguel = categoryMap['Aluguel do Estúdio'] || categoryMap['Moradia e Estúdio']
        const catCreativeCloud =
          categoryMap['Creative Cloud'] || categoryMap['Assinaturas e Software']

        const accBanco = accountMap['Conta Principal (PJ)']
        const accCartao = accountMap['Cartão Corporativo'] || accBanco

        // 1. Contrato Mensal de Produção (R$ 8.500,00 dia 5)
        if (catContratos && accBanco) {
          const r1 = new Record(recurringCol)
          r1.set('user', user.id)
          r1.set('description', 'Contrato Mensal - Produtora Alpha')
          r1.set('amount', 8500)
          r1.set('type', 'receita')
          r1.set('frequency', 'mensal')
          r1.set('day_of_month', 5)
          r1.set('start_date', makeDateStr(currentYear, currentMonth, 5))
          r1.set('last_run', makeDateStr(currentYear, currentMonth, 5))
          r1.set('category', catContratos.id)
          r1.set('account', accBanco.id)
          r1.set('active', true)
          app.save(r1)
        }

        // 2. Aluguel do Estúdio (R$ 2.200,00 dia 6)
        if (catAluguel && accBanco) {
          const r2 = new Record(recurringCol)
          r2.set('user', user.id)
          r2.set('description', 'Aluguel do Estúdio de Gravação')
          r2.set('amount', 2200)
          r2.set('type', 'despesa')
          r2.set('frequency', 'mensal')
          r2.set('day_of_month', 6)
          r2.set('start_date', makeDateStr(currentYear, currentMonth, 6))
          r2.set('last_run', makeDateStr(currentYear, currentMonth, 6))
          r2.set('category', catAluguel.id)
          r2.set('account', accBanco.id)
          r2.set('active', true)
          app.save(r2)
        }

        // 3. Adobe Creative Cloud (R$ 189,90 dia 8)
        if (catCreativeCloud && (accCartao || accBanco)) {
          const r3 = new Record(recurringCol)
          r3.set('user', user.id)
          r3.set('description', 'Assinatura Adobe Creative Cloud')
          r3.set('amount', 189.9)
          r3.set('type', 'despesa')
          r3.set('frequency', 'mensal')
          r3.set('day_of_month', 8)
          r3.set('start_date', makeDateStr(currentYear, currentMonth, 8))
          r3.set('last_run', makeDateStr(currentYear, currentMonth, 8))
          r3.set('category', catCreativeCloud.id)
          r3.set('account', (accCartao || accBanco).id)
          r3.set('active', true)
          app.save(r3)
        }
      }
    } catch (recErr) {
      console.log('[migration:0012] Seed recurring error: ' + recErr.message)
    }
  },
  (app) => {
    // Reverter os dados semeados para videos@adapta.org
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'videos@adapta.org')
      if (user) {
        const collections = [
          'recurring_transactions',
          'budgets',
          'bills',
          'transactions',
          'categories',
          'accounts',
        ]
        for (let i = 0; i < collections.length; i++) {
          try {
            const rows = app.findRecordsByFilter(
              collections[i],
              "user = '" + user.id + "'",
              '',
              500,
              0,
            )
            for (let j = 0; j < rows.length; j++) {
              app.delete(rows[j])
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  },
)
