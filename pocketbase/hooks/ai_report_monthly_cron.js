// Cron mensal automático: roda todo dia 1º de cada mês de hora em hora
// Gera o fechamento com IA do mês anterior para os usuários cuja hora configurada (ai_report_hour) coincide com a hora de Brasília
cronAdd('ai-report-monthly-close', '0 * 1 * *', () => {
  const now = new Date()
  // Data e hora em Brasília (America/Sao_Paulo: UTC-3)
  const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const currentBrtHour = brtTime.getUTCHours()
  const currentBrtDay = brtTime.getUTCDate()
  const currentYear = brtTime.getUTCFullYear()
  const currentMonthIdx = brtTime.getUTCMonth() // 0-based

  // Garantir que no fuso de Brasília ainda seja dia 1º
  if (currentBrtDay !== 1) {
    return
  }

  // Mês anterior alvo
  const targetDate = new Date(Date.UTC(currentYear, currentMonthIdx - 1, 1))
  const targetYear = targetDate.getUTCFullYear()
  const targetMonthIdx = targetDate.getUTCMonth()
  const targetMonthStr = targetDate.toISOString().slice(0, 7) // "YYYY-MM"

  console.log(
    '[cron:ai-report-monthly-close] Verificando fechamento para hora de Brasília ' +
      currentBrtHour +
      'h no mês: ' +
      targetMonthStr,
  )

  // Normalização de descrição inline
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

  // Limites do mês anterior alvo
  const currentStartDate = new Date(Date.UTC(targetYear, targetMonthIdx, 1))
  const nextMonthStartDate = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 1))
  const currentStart = currentStartDate.toISOString().replace('T', ' ')
  const nextStart = nextMonthStartDate.toISOString().replace('T', ' ')

  // Limite dos 3 meses anteriores ao mês alvo
  const prev3StartDate = new Date(Date.UTC(targetYear, targetMonthIdx - 3, 1))
  const prev3Start = prev3StartDate.toISOString().replace('T', ' ')

  const priorMonths = []
  for (let offset = 3; offset >= 1; offset--) {
    const d = new Date(Date.UTC(targetYear, targetMonthIdx - offset, 1))
    priorMonths.push(d.toISOString().slice(0, 7))
  }

  // Buscar todos os usuários
  let users = []
  try {
    users = $app.findRecordsByFilter('users', '', 'created', 1000, 0)
  } catch (err) {
    console.log('[cron:ai-report-monthly-close] Erro ao listar usuários: ' + err.message)
    return
  }

  let processedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (let u = 0; u < users.length; u++) {
    const user = users[u]
    const userId = user.id
    const userEmail = user.getString('email')
    const userName = user.getString('name') || 'Usuário'

    // Pular usuário se não tiver concluído o onboarding mínimo obrigatório
    // (pelo menos 1 conta banco, 1 conta cartao, 1 lançamento)
    try {
      const userBankAccounts = $app.findRecordsByFilter(
        'accounts',
        "user = '" + userId + "' && type = 'banco'",
        '',
        1,
        0,
      )
      const userCardAccounts = $app.findRecordsByFilter(
        'accounts',
        "user = '" + userId + "' && type = 'cartao'",
        '',
        1,
        0,
      )
      const userTransactions = $app.findRecordsByFilter(
        'transactions',
        "user = '" + userId + "'",
        '',
        1,
        0,
      )

      if (
        userBankAccounts.length === 0 ||
        userCardAccounts.length === 0 ||
        userTransactions.length === 0
      ) {
        skippedCount++
        continue
      }
    } catch (checkErr) {
      console.log(
        '[cron:ai-report-monthly-close] Erro ao verificar onboarding do usuário ' +
          userId +
          ': ' +
          checkErr.message,
      )
    }

    try {
      // Consultar preferências de IA do usuário e destinatário customizado
      let aiReportAutoEnabled = true
      let aiReportNotifyEmail = false
      let aiReportHour = 9 // default 9h horário de Brasília
      let customRecipient = ''

      try {
        const userSettings = $app.findFirstRecordByData('settings', 'user', userId)
        aiReportAutoEnabled = userSettings.getBool('ai_report_auto_enabled')
        aiReportNotifyEmail = userSettings.getBool('ai_report_notify_email')
        const hourVal = userSettings.get('ai_report_hour')
        if (hourVal !== null && hourVal !== undefined && hourVal !== '') {
          aiReportHour = userSettings.getInt('ai_report_hour')
        }
        const custRec = userSettings.getString('custom_recipient')
        if (custRec && custRec.trim()) {
          customRecipient = custRec.trim()
        }
      } catch (_) {
        // Defaults: ai_report_auto_enabled = true, ai_report_notify_email = false, ai_report_hour = 9
      }

      if (!aiReportAutoEnabled) {
        skippedCount++
        continue
      }

      // Disparar somente se a hora atual de Brasília coincidir com o ai_report_hour configurado
      if (currentBrtHour !== aiReportHour) {
        skippedCount++
        continue
      }

      // Destinatário alvo
      const targetEmail = customRecipient || userEmail

      // Verificar se o usuário possui transações no mês alvo
      const targetMonthTxs = $app.findRecordsByFilter(
        'transactions',
        "user = '" + userId + "' && date >= '" + currentStart + "' && date < '" + nextStart + "'",
        '',
        1,
        0,
      )

      if (targetMonthTxs.length === 0) {
        skippedCount++
        continue
      }

      // Mapear categorias para raiz ancestral
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

      // Buscar transações dos 4 meses (3 anteriores + mês alvo)
      const transactions = $app.findRecordsByFilter(
        'transactions',
        "user = '" + userId + "' && date >= '" + prev3Start + "' && date < '" + nextStart + "'",
        'date',
        2000,
        0,
      )

      let currentIncome = 0
      let currentExpense = 0
      const currentCategoryTotals = {}
      const currentExpensesList = []

      const priorMonthlyTotals = {}
      for (let p = 0; p < priorMonths.length; p++) {
        priorMonthlyTotals[priorMonths[p]] = { income: 0, expense: 0, categories: {} }
      }

      const allExpenses = []

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

        if (txMonth === targetMonthStr) {
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
              month: targetMonthStr,
              category: rootCategoryName,
              subCategory: rawCategoryName,
            })
            allExpenses.push({
              description: description,
              normDesc: normalizeDescription(description),
              amount: amount,
              month: targetMonthStr,
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

      // Média dos 3 meses anteriores
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

      const expenseVariationPercent =
        avgPriorExpense > 0 ? ((currentExpense - avgPriorExpense) / avgPriorExpense) * 100 : 0
      const incomeVariationPercent =
        avgPriorIncome > 0 ? ((currentIncome - avgPriorIncome) / avgPriorIncome) * 100 : 0

      // Variações de categoria
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
      categoryVariations.sort((a, b) => b.diff - a.diff)
      const topExpenseIncreases = categoryVariations.filter((item) => item.diff > 0).slice(0, 5)

      // Detecção de recorrentes tolerante
      const recurringGroups = []
      for (let i = 0; i < allExpenses.length; i++) {
        const item = allExpenses[i]
        if (!item.normDesc || item.amount <= 0) continue

        let matchedGroup = null
        for (let g = 0; g < recurringGroups.length; g++) {
          const group = recurringGroups[g]
          const descMatch =
            group.normDesc === item.normDesc ||
            (group.normDesc.length >= 4 &&
              item.normDesc.length >= 4 &&
              (group.normDesc.includes(item.normDesc) || item.normDesc.includes(group.normDesc)))

          if (descMatch) {
            const groupAvgAmount = group.totalAmount / group.items.length
            const tolerance = Math.max(groupAvgAmount * 0.1, 1.0)
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

      const detectedRecurring = []
      for (let g = 0; g < recurringGroups.length; g++) {
        const group = recurringGroups[g]
        if (group.months.length >= 2) {
          group.months.sort()
          const avgAmt = group.totalAmount / group.items.length
          detectedRecurring.push({
            description: group.descriptions[0],
            alternativeDescriptions: group.descriptions,
            amount: Math.round(avgAmt * 100) / 100,
            months: group.months,
            occurrences: group.items.length,
            category: group.category,
          })
        }
      }
      detectedRecurring.sort((a, b) => b.amount - a.amount)

      // Buscar metas de gasto do usuário no cron
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
            const subCatNames = []
            for (let c = 0; c < allUserCategories.length; c++) {
              if (allUserCategories[c].getString('parent') === catId) {
                subCatNames.push(allUserCategories[c].getString('name'))
              }
            }

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
              status: status,
              overAmount: spent > limit ? Math.round((spent - limit) * 100) / 100 : 0,
            })
          }
        }
      } catch (bErr) {
        console.log('[cron:ai-report-monthly-close] Erro metas: ' + bErr.message)
      }

      const payload = {
        month: targetMonthStr,
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
      } catch (aiErr) {
        console.log(
          '[cron:ai-report-monthly-close] IA indisponível para o usuário ' +
            userId +
            ': ' +
            aiErr.message,
        )
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

      // Upsert relatório
      const reports = $app.findRecordsByFilter(
        'ai_reports',
        "user = '" + userId + "' && month = '" + targetMonthStr + "'",
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
        report.set('month', targetMonthStr)
      }
      report.set('summary', summary)
      report.set('insights', insights)
      report.set('source', 'auto')
      $app.save(report)

      // Se ai_report_notify_email estiver ativado, envia e-mail com resumo gerado
      if (aiReportNotifyEmail && targetEmail) {
        let sendSuccess = false
        let sendErrMsg = ''

        try {
          const siteUrl = $os.getenv('SITE_URL') || 'https://financas-inteligentes.skip.app'

          // Formatar mês para exibição (ex: 2026-08 -> Agosto/2026)
          const monthNamesPt = [
            'Janeiro',
            'Fevereiro',
            'Março',
            'Abril',
            'Maio',
            'Junho',
            'Julho',
            'Agosto',
            'Setembro',
            'Outubro',
            'Novembro',
            'Dezembro',
          ]
          const monthDisplay = monthNamesPt[targetMonthIdx] + ' de ' + targetYear

          const suggestionsHtmlList = suggestions
            .map(function (s) {
              return (
                '<li style="margin-bottom: 8px; color: #374151; font-size: 14px; line-height: 1.5;">' +
                s +
                '</li>'
              )
            })
            .join('')

          const emailSubject =
            '🤖 Fechamento Mensal IA (' + monthDisplay + ') - Finanças Inteligentes'

          let senderAddress = 'contato@financas.local'
          let senderName = 'Finanças Inteligentes'
          try {
            const meta = $app.settings().meta
            if (meta && meta.senderAddress) senderAddress = meta.senderAddress
            if (meta && meta.senderName) senderName = meta.senderName
          } catch (_) {}

          const unsubscribeUrl = siteUrl + '/configuracoes'

          const emailHtml =
            '<!DOCTYPE html>' +
            '<html>' +
            '<head><meta charset="utf-8"></head>' +
            '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; padding: 24px; margin: 0; color: #111827;">' +
            '<div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">' +
            '  <div style="background-color: #5B5FEF; padding: 24px; text-align: left; color: #FFFFFF;">' +
            '    <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Finanças Inteligentes</h1>' +
            '    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Fechamento Mensal com Inteligência Artificial • ' +
            monthDisplay +
            '</p>' +
            '  </div>' +
            '  <div style="padding: 24px;">' +
            '    <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Olá, <strong>' +
            userName +
            '</strong>!</p>' +
            '    <p style="font-size: 14px; line-height: 1.5; color: #4B5563;">' +
            '      O seu relatório financeiro automático de <strong>' +
            monthDisplay +
            '</strong> acabou de ser gerado com sucesso pela nossa IA. Confira os principais números:' +
            '    </p>' +
            '    <div style="display: flex; gap: 12px; margin-top: 16px; margin-bottom: 20px; background-color: #F9FAFB; border-radius: 8px; padding: 14px; border: 1px solid #E5E7EB;">' +
            '      <div style="flex: 1; text-align: center;">' +
            '        <div style="font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Receitas</div>' +
            '        <div style="font-size: 15px; font-weight: 700; color: #059669; margin-top: 4px;">R$ ' +
            currentIncome.toFixed(2).replace('.', ',') +
            '</div>' +
            '      </div>' +
            '      <div style="flex: 1; text-align: center; border-left: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB;">' +
            '        <div style="font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Despesas</div>' +
            '        <div style="font-size: 15px; font-weight: 700; color: #DC2626; margin-top: 4px;">R$ ' +
            currentExpense.toFixed(2).replace('.', ',') +
            '</div>' +
            '      </div>' +
            '      <div style="flex: 1; text-align: center;">' +
            '        <div style="font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Resultado</div>' +
            '        <div style="font-size: 15px; font-weight: 700; color: ' +
            (currentIncome >= currentExpense ? '#059669' : '#DC2626') +
            '; margin-top: 4px;">R$ ' +
            (currentIncome - currentExpense).toFixed(2).replace('.', ',') +
            '</div>' +
            '      </div>' +
            '    </div>' +
            '    <div style="background-color: #EEF2FF; border-left: 4px solid #5B5FEF; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px;">' +
            '      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1E1B4B;">' +
            summary +
            '</p>' +
            '    </div>' +
            (suggestions.length > 0
              ? '    <div style="margin-bottom: 20px;">' +
                '      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #111827;">💡 Recomendações práticas para o seu bolso:</h3>' +
                '      <ul style="margin: 0; padding-left: 20px;">' +
                suggestionsHtmlList +
                '      </ul>' +
                '    </div>'
              : '') +
            '    <div style="text-align: center; margin-top: 28px; margin-bottom: 20px;">' +
            '      <a href="' +
            siteUrl +
            '/relatorios" style="background-color: #5B5FEF; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block;">Ver análise completa com gráficos</a>' +
            '    </div>' +
            '    <div style="border-top: 1px solid #F3F4F6; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #6B7280; line-height: 1.5;">' +
            '      💡 <strong>Dica importante para não perder notificações:</strong> adicione o remetente <code>' +
            senderAddress +
            '</code> aos seus contatos confiáveis e marque este e-mail como "Não é spam".' +
            '    </div>' +
            '  </div>' +
            '  <div style="padding: 16px 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.6;">' +
            '    <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque ativou a notificação automática de relatórios de IA no <a href="' +
            siteUrl +
            '" style="color: #5B5FEF; text-decoration: underline;">Finanças Inteligentes</a>.</p>' +
            '    <p style="margin: 0;">Para alterar suas preferências, horário ou cancelar este resumo, acesse <a href="' +
            unsubscribeUrl +
            '" style="color: #5B5FEF; text-decoration: underline;">Configurações do app</a>.</p>' +
            '  </div>' +
            '</div>' +
            '</body>' +
            '</html>'

          const emailText =
            'Finanças Inteligentes - Fechamento Mensal IA (' +
            monthDisplay +
            ')\n\n' +
            'Olá, ' +
            userName +
            '!\n\n' +
            'O relatório financeiro de ' +
            monthDisplay +
            ' foi gerado com sucesso:\n\n' +
            '- Receitas: R$ ' +
            currentIncome.toFixed(2).replace('.', ',') +
            '\n' +
            '- Despesas: R$ ' +
            currentExpense.toFixed(2).replace('.', ',') +
            '\n' +
            '- Resultado: R$ ' +
            (currentIncome - currentExpense).toFixed(2).replace('.', ',') +
            '\n\n' +
            'Resumo da IA:\n' +
            summary +
            '\n\n' +
            (suggestions.length > 0
              ? 'Recomendações:\n' +
                suggestions
                  .map(function (s) {
                    return '• ' + s
                  })
                  .join('\n') +
                '\n\n'
              : '') +
            'Ver análise completa: ' +
            siteUrl +
            '/relatorios\n\n' +
            '----------------------------------------\n' +
            'Dica: Adicione ' +
            senderAddress +
            ' aos seus contatos e marque esta mensagem como "Não é spam".\n\n' +
            'Gerenciar preferências ou cancelar: ' +
            unsubscribeUrl +
            '\n'

          try {
            const message = new MailerMessage({
              from: {
                address: senderAddress,
                name: senderName,
              },
              to: [{ address: targetEmail }],
              subject: emailSubject,
              html: emailHtml,
              text: emailText,
              headers: {
                'List-Unsubscribe':
                  '<' + unsubscribeUrl + '>, <mailto:' + senderAddress + '?subject=unsubscribe>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'X-Entity-Ref-ID': 'ai-report-monthly-' + userId + '-' + targetMonthStr,
              },
            })
            $app.newMailClient().send(message)
            sendSuccess = true
            console.log(
              '[cron:ai-report-monthly-close] E-mail de fechamento mensal enviado com sucesso para ' +
                targetEmail,
            )
          } catch (sendErr) {
            sendErrMsg = sendErr.message
            console.log(
              '[cron:ai-report-monthly-close] Erro no cliente de e-mail para ' +
                targetEmail +
                ': ' +
                sendErr.message,
            )
          }

          // Registrar histórico do disparo de resumo_ia
          try {
            const notifCol = $app.findCollectionByNameOrId('email_notifications')
            const notif = new Record(notifCol)
            notif.set('user', userId)
            notif.set('type', 'resumo_ia')
            notif.set('recipient', targetEmail)
            notif.set('items_count', 1)
            notif.set('status', sendSuccess ? 'enviado' : 'falhou')
            notif.set('subject', emailSubject)
            if (!sendSuccess && sendErrMsg) {
              notif.set('error_message', sendErrMsg)
            }
            $app.save(notif)
          } catch (histErr) {
            console.log(
              '[cron:ai-report-monthly-close] Erro ao gravar histórico: ' + histErr.message,
            )
          }
        } catch (mailErr) {
          console.log(
            '[cron:ai-report-monthly-close] Erro ao preparar e-mail para usuário ' +
              userId +
              ': ' +
              mailErr.message,
          )
        }
      }

      processedCount++
      console.log(
        '[cron:ai-report-monthly-close] Relatório gerado com sucesso para usuário ' +
          userId +
          ' (' +
          targetMonthStr +
          ')',
      )
    } catch (userErr) {
      errorCount++
      console.log(
        '[cron:ai-report-monthly-close] Erro ao processar usuário ' +
          userId +
          ': ' +
          userErr.message,
      )
    }
  }

  console.log(
    '[cron:ai-report-monthly-close] Concluído. Processados: ' +
      processedCount +
      ', Ignorados (sem dados): ' +
      skippedCount +
      ', Erros: ' +
      errorCount,
  )
})
