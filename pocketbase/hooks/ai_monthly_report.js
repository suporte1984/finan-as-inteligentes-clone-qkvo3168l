routerAdd(
  'POST',
  '/backend/v1/ai/monthly-report/{month}',
  (e) => {
    const month = e.request.pathValue('month')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return e.badRequestError('Mês inválido. Use o formato AAAA-MM.')
    }

    const info = e.requestInfo()
    const regenerate = String((info.query && info.query.regenerar) || '').toLowerCase()
    const shouldRegenerate = regenerate === '1' || regenerate === 'true'
    const userId = e.auth.id

    if (!shouldRegenerate) {
      const existing = $app.findRecordsByFilter(
        'ai_reports',
        "user = '" + userId + "' && month = '" + month + "'",
        '-updated',
        1,
        0,
      )
      if (existing.length > 0) {
        return e.json(200, {
          id: existing[0].id,
          month: existing[0].getString('month'),
          summary: existing[0].getString('summary'),
          insights: existing[0].get('insights'),
          source: existing[0].getString('source') || 'manual',
          cached: true,
        })
      }
    }

    // Helper: normalizar descrição (lowercase, remove acentos, remove dígitos, pontuação e trim)
    function normalizeDescription(str) {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[0-9]+/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Datas do período analisado: mês atual + 3 meses anteriores
    const targetYear = Number(month.slice(0, 4))
    const targetMonthIdx = Number(month.slice(5, 7)) - 1 // 0-based

    // Limites do mês alvo
    const currentStartDate = new Date(Date.UTC(targetYear, targetMonthIdx, 1))
    const nextMonthStartDate = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 1))
    const currentStart = currentStartDate.toISOString().replace('T', ' ')
    const nextStart = nextMonthStartDate.toISOString().replace('T', ' ')

    // Limite dos 3 meses anteriores
    const prev3StartDate = new Date(Date.UTC(targetYear, targetMonthIdx - 3, 1))
    const prev3Start = prev3StartDate.toISOString().replace('T', ' ')

    // Meses anteriores específicos (ex: para 2026-09 -> 2026-08, 2026-07, 2026-06)
    const priorMonths = []
    for (let offset = 3; offset >= 1; offset--) {
      const d = new Date(Date.UTC(targetYear, targetMonthIdx - offset, 1))
      priorMonths.push(d.toISOString().slice(0, 7))
    }

    // Buscar todas as categorias do usuário para mapear qualquer subcategoria à sua raiz ancestral
    const allCategoriesRecords = $app.findRecordsByFilter(
      'categories',
      "user = '" + userId + "'",
      '',
      1000,
      0,
    )
    const categoryMapById = {}
    for (let c = 0; c < allCategoriesRecords.length; c++) {
      categoryMapById[allCategoriesRecords[c].id] = {
        id: allCategoriesRecords[c].id,
        name: allCategoriesRecords[c].getString('name'),
        parent: allCategoriesRecords[c].getString('parent'),
      }
    }

    // Helper: obter o nome da categoria raiz subindo os pais
    function getRootCategoryName(catId) {
      if (!catId || !categoryMapById[catId]) return 'Sem categoria'
      let current = categoryMapById[catId]
      const visited = {}
      while (current && current.parent && categoryMapById[current.parent]) {
        if (visited[current.id]) break
        visited[current.id] = true
        current = categoryMapById[current.parent]
      }
      return current ? current.name : 'Sem categoria'
    }

    // Buscar transações dos 4 meses (3 anteriores + mês atual)
    const transactions = $app.findRecordsByFilter(
      'transactions',
      "user = '" + userId + "' && date >= '" + prev3Start + "' && date < '" + nextStart + "'",
      'date',
      2000,
      0,
    )

    // Agrupamento por mês e por categoria consolidada na raiz
    let currentIncome = 0
    let currentExpense = 0
    const currentCategoryTotals = {}
    const currentExpensesList = []

    const priorMonthlyTotals = {}
    for (let p = 0; p < priorMonths.length; p++) {
      priorMonthlyTotals[priorMonths[p]] = { income: 0, expense: 0, categories: {} }
    }

    const allExpenses = [] // para detecção de recorrências

    for (let i = 0; i < transactions.length; i++) {
      const record = transactions[i]
      const txDate = record.getString('date')
      const txMonth = txDate.slice(0, 7)
      const txType = record.getString('type')
      const amount = record.getFloat('amount')
      const description = record.getString('description')
      const catId = record.getString('category')
      const rootCategoryName = getRootCategoryName(catId)
      const rawCategoryName =
        catId && categoryMapById[catId] ? categoryMapById[catId].name : 'Sem categoria'

      if (txMonth === month) {
        if (txType === 'receita') {
          currentIncome += amount
        } else {
          currentExpense += amount
          currentCategoryTotals[rootCategoryName] =
            (currentCategoryTotals[rootCategoryName] || 0) + amount
          currentExpensesList.push({
            description: description,
            normDesc: normalizeDescription(description),
            amount: amount,
            month: month,
            category: rootCategoryName,
            subCategory: rawCategoryName,
          })
          allExpenses.push({
            description: description,
            normDesc: normalizeDescription(description),
            amount: amount,
            month: month,
            category: rootCategoryName,
          })
        }
      } else if (priorMonthlyTotals[txMonth]) {
        if (txType === 'receita') {
          priorMonthlyTotals[txMonth].income += amount
        } else {
          priorMonthlyTotals[txMonth].expense += amount
          priorMonthlyTotals[txMonth].categories[rootCategoryName] =
            (priorMonthlyTotals[txMonth].categories[rootCategoryName] || 0) + amount
          allExpenses.push({
            description: description,
            normDesc: normalizeDescription(description),
            amount: amount,
            month: txMonth,
            category: rootCategoryName,
          })
        }
      }
    }

    // Se o usuário não tiver transações no mês atual, tratar pulando a geração
    const hasCurrentTransactions =
      currentIncome > 0 || currentExpense > 0 || currentExpensesList.length > 0
    if (!hasCurrentTransactions) {
      return e.json(200, {
        skipped: true,
        month: month,
        message: 'Nenhuma transação encontrada no mês analisado.',
      })
    }

    // Calcular média dos 3 meses anteriores
    let sumPriorIncome = 0
    let sumPriorExpense = 0
    const priorCategorySums = {}

    for (let p = 0; p < priorMonths.length; p++) {
      const mData = priorMonthlyTotals[priorMonths[p]]
      sumPriorIncome += mData.income
      sumPriorExpense += mData.expense
      const catKeys = Object.keys(mData.categories)
      for (let k = 0; k < catKeys.length; k++) {
        const cName = catKeys[k]
        priorCategorySums[cName] = (priorCategorySums[cName] || 0) + mData.categories[cName]
      }
    }

    const priorMonthsCount = priorMonths.length || 3
    const avgPriorIncome = sumPriorIncome / priorMonthsCount
    const avgPriorExpense = sumPriorExpense / priorMonthsCount
    const avgCategoryExpenses = {}
    const allCatNames = Object.keys(Object.assign({}, currentCategoryTotals, priorCategorySums))
    for (let c = 0; c < allCatNames.length; c++) {
      const cName = allCatNames[c]
      avgCategoryExpenses[cName] = (priorCategorySums[cName] || 0) / priorMonthsCount
    }

    // Variações percentuais vs. média dos 3 meses
    const expenseVariationPercent =
      avgPriorExpense > 0 ? ((currentExpense - avgPriorExpense) / avgPriorExpense) * 100 : 0
    const incomeVariationPercent =
      avgPriorIncome > 0 ? ((currentIncome - avgPriorIncome) / avgPriorIncome) * 100 : 0

    // Top categorias com maior variação positiva (aumento) vs média dos 3 meses
    const categoryVariations = []
    for (let c = 0; c < allCatNames.length; c++) {
      const cName = allCatNames[c]
      const currentVal = currentCategoryTotals[cName] || 0
      const avgVal = avgCategoryExpenses[cName] || 0
      if (currentVal > 0 || avgVal > 0) {
        const diff = currentVal - avgVal
        const pct = avgVal > 0 ? (diff / avgVal) * 100 : currentVal > 0 ? 100 : 0
        categoryVariations.push({
          category: cName,
          current: currentVal,
          average: avgVal,
          diff: diff,
          percentChange: pct,
        })
      }
    }
    // Ordenar por maior aumento absoluto em reais
    categoryVariations.sort((a, b) => b.diff - a.diff)
    const topExpenseIncreases = categoryVariations.filter((item) => item.diff > 0).slice(0, 5)

    // Detecção tolerante de despesas recorrentes
    // Agrupar transações de despesa por descrição normalizada e valor com tolerância (±10%),
    // considerando recorrente se aparecer em >= 2 meses distintos no período (mês atual + anteriores).
    const recurringGroups = []

    for (let i = 0; i < allExpenses.length; i++) {
      const item = allExpenses[i]
      if (!item.normDesc || item.amount <= 0) continue

      let matchedGroup = null
      for (let g = 0; g < recurringGroups.length; g++) {
        const group = recurringGroups[g]
        // Comparação de descrição normalizada
        const descMatch =
          group.normDesc === item.normDesc ||
          (group.normDesc.length >= 4 &&
            item.normDesc.length >= 4 &&
            (group.normDesc.includes(item.normDesc) || item.normDesc.includes(group.normDesc)))

        if (descMatch) {
          // Tolerância de valor ±10% em relação à média do grupo
          const groupAvgAmount = group.totalAmount / group.items.length
          const tolerance = Math.max(groupAvgAmount * 0.1, 1.0) // pelo menos R$ 1,00 de tolerância
          if (Math.abs(item.amount - groupAvgAmount) <= tolerance) {
            matchedGroup = group
            break
          }
        }
      }

      if (matchedGroup) {
        matchedGroup.items.push(item)
        matchedGroup.totalAmount += item.amount
        if (!matchedGroup.months.includes(item.month)) {
          matchedGroup.months.push(item.month)
        }
        if (!matchedGroup.descriptions.includes(item.description)) {
          matchedGroup.descriptions.push(item.description)
        }
      } else {
        recurringGroups.push({
          normDesc: item.normDesc,
          descriptions: [item.description],
          items: [item],
          totalAmount: item.amount,
          months: [item.month],
          category: item.category,
        })
      }
    }

    // Filtrar grupos presentes em >= 2 meses distintos
    const detectedRecurring = []
    for (let g = 0; g < recurringGroups.length; g++) {
      const group = recurringGroups[g]
      if (group.months.length >= 2) {
        group.months.sort()
        const avgAmt = group.totalAmount / group.items.length
        detectedRecurring.push({
          description: group.descriptions[0], // descrição principal mais limpa
          alternativeDescriptions: group.descriptions,
          amount: Math.round(avgAmt * 100) / 100,
          months: group.months,
          occurrences: group.items.length,
          category: group.category,
        })
      }
    }
    detectedRecurring.sort((a, b) => b.amount - a.amount)

    // Buscar metas de gasto do usuário e calcular status com agregação de subcategorias
    const budgetStatusList = []
    try {
      const userBudgets = $app.findRecordsByFilter(
        'budgets',
        "user = '" + userId + "'",
        'created',
        500,
        0,
      )

      if (userBudgets.length > 0) {
        // Carregar todas as categorias para mapear parent -> children
        const allUserCategories = $app.findRecordsByFilter(
          'categories',
          "user = '" + userId + "'",
          '',
          1000,
          0,
        )
        const catMapById = {}
        for (let c = 0; c < allUserCategories.length; c++) {
          catMapById[allUserCategories[c].id] = allUserCategories[c]
        }

        for (let b = 0; b < userBudgets.length; b++) {
          const bRecord = userBudgets[b]
          const catId = bRecord.getString('category')
          const limit = bRecord.getFloat('monthly_limit')
          const targetCat = catMapById[catId]
          if (!targetCat) continue

          const catName = targetCat.getString('name')
          // Encontrar subcategorias se for raiz
          const subCatNames = []
          for (let c = 0; c < allUserCategories.length; c++) {
            if (allUserCategories[c].getString('parent') === catId) {
              subCatNames.push(allUserCategories[c].getString('name'))
            }
          }

          // Calcular gasto acumulado no mês corrente para esta meta
          let spent = currentCategoryTotals[catName] || 0
          for (let s = 0; s < subCatNames.length; s++) {
            spent += currentCategoryTotals[subCatNames[s]] || 0
          }

          const percent = limit > 0 ? (spent / limit) * 100 : 0
          let status = 'normal'
          if (percent >= 100) status = 'estourada'
          else if (percent >= 80) status = 'alerta_80'

          budgetStatusList.push({
            category: catName,
            limit: limit,
            spent: Math.round(spent * 100) / 100,
            percent: Math.round(percent * 10) / 10,
            status: status, // "normal" | "alerta_80" | "estourada"
            overAmount: spent > limit ? Math.round((spent - limit) * 100) / 100 : 0,
          })
        }
      }
    } catch (bErr) {
      console.log('Erro ao calcular metas no relatório de IA: ' + bErr.message)
    }

    // Payload estruturado para envio à IA
    const payload = {
      month: month,
      totals: {
        income: currentIncome,
        expenses: currentExpense,
        result: currentIncome - currentExpense,
      },
      prior3MonthsAverage: {
        months: priorMonths,
        incomeAverage: avgPriorIncome,
        expensesAverage: avgPriorExpense,
        expenseVariationPercent: expenseVariationPercent,
        incomeVariationPercent: incomeVariationPercent,
        expensesByCategoryAverage: avgCategoryExpenses,
      },
      expensesByCategoryCurrent: currentCategoryTotals,
      topIncreasesVsAverage: topExpenseIncreases,
      recurringExpenses: detectedRecurring,
      categoryBudgets: budgetStatusList,
    }

    // Resumo padrão de fallback
    let summary =
      'O mês registrou receitas de R$ ' +
      currentIncome.toFixed(2) +
      ' e despesas de R$ ' +
      currentExpense.toFixed(2) +
      '. O resultado foi de R$ ' +
      (currentIncome - currentExpense).toFixed(2) +
      (avgPriorExpense > 0
        ? ', com variação de ' +
          (expenseVariationPercent >= 0 ? '+' : '') +
          expenseVariationPercent.toFixed(1) +
          '% nas despesas em relação à média dos últimos 3 meses.'
        : '.')

    let suggestions = [
      'Revise as maiores categorias de despesa e estabeleça um limite mensal.',
      'Avalie assinaturas e serviços recorrentes que podem ser renegociados ou cancelados.',
    ]

    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um analista financeiro pessoal brasileiro, objetivo, cuidadoso e não julgador. Analise somente os dados fornecidos. Responda exclusivamente em JSON válido, sem markdown, no formato {"summary":"resumo do mês em 3 a 4 frases","suggestions":["sugestão prática 1","sugestão prática 2","sugestão prática 3"]}. Use português do Brasil, valores em reais e destaque comparação com a MÉDIA DOS 3 MESES ANTERIORES, variações relevantes de categorias, o status das METAS DE GASTO DO MÊS (destacando com atenção as metas que atingiram 80% ou estouraram 100%), cobranças recorrentes e oportunidades reais de economia.',
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      })
      const raw = reply.choices[0].message.content || ''
      const firstBrace = raw.indexOf('{')
      const lastBrace = raw.lastIndexOf('}')
      const parsed = JSON.parse(
        firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw,
      )
      if (parsed.summary && typeof parsed.summary === 'string') summary = parsed.summary
      if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0)
        suggestions = parsed.suggestions.slice(0, 3)
    } catch (error) {
      console.log('Falha ao gerar análise financeira com IA: ' + error.message)
    }

    const insights = {
      recurring: detectedRecurring,
      suggestions: suggestions,
      comparison: {
        priorMonths: priorMonths,
        incomeAverage: avgPriorIncome,
        expensesAverage: avgPriorExpense,
        expenseVariationPercent: expenseVariationPercent,
        incomeVariationPercent: incomeVariationPercent,
        topIncreases: topExpenseIncreases,
      },
      budgets: budgetStatusList,
      categoryTotals: currentCategoryTotals,
      avgCategoryExpenses: avgCategoryExpenses,
    }

    const reports = $app.findRecordsByFilter(
      'ai_reports',
      "user = '" + userId + "' && month = '" + month + "'",
      '',
      1,
      0,
    )
    let report
    if (reports.length > 0) {
      report = reports[0]
    } else {
      report = new Record($app.findCollectionByNameOrId('ai_reports'))
      report.set('user', userId)
      report.set('month', month)
    }
    report.set('summary', summary)
    report.set('insights', insights)
    report.set('source', 'manual')
    $app.save(report)

    return e.json(200, {
      id: report.id,
      month: month,
      summary: summary,
      insights: insights,
      source: 'manual',
      cached: false,
    })
  },
  $apis.requireAuth(),
)
