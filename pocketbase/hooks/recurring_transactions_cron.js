// Cron diário para geração automática de lançamentos recorrentes
// Executa todo dia às 09:00 no fuso de Brasília (UTC-3) -> 12:00 UTC
cronAdd('recurring-transactions-daily', '0 12 * * *', () => {
  const now = new Date()
  // Data e hora de Brasília (America/Sao_Paulo: UTC-3)
  const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const todayYMD = brtTime.toISOString().slice(0, 10) // "YYYY-MM-DD"
  const currentYear = brtTime.getUTCFullYear()
  const currentMonthIdx = brtTime.getUTCMonth() // 0-based
  const currentDayOfMonth = brtTime.getUTCDate()

  console.log('[cron:recurring-transactions-daily] Iniciando processamento para data: ' + todayYMD)

  let recurrings = []
  try {
    recurrings = $app.findRecordsByFilter(
      'recurring_transactions',
      'active = true',
      'created',
      1000,
      0,
    )
  } catch (err) {
    console.log('[cron:recurring-transactions-daily] Erro ao listar recorrências: ' + err.message)
    return
  }

  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0

  const pad = (n) => String(n).padStart(2, '0')

  for (let i = 0; i < recurrings.length; i++) {
    const item = recurrings[i]
    const recId = item.id
    const userId = item.getString('user')

    try {
      const startDateStr = item.getString('start_date')
      const endDateStr = item.getString('end_date')
      const lastRunStr = item.getString('last_run')
      const frequency = item.getString('frequency')
      const dayOfMonth = item.getInt('day_of_month') || 1

      const startYMD = startDateStr ? startDateStr.slice(0, 10) : ''
      const endYMD = endDateStr ? endDateStr.slice(0, 10) : ''
      const lastRunYMD = lastRunStr ? lastRunStr.slice(0, 10) : ''

      // Se ainda não começou
      if (startYMD && todayYMD < startYMD) {
        skippedCount++
        continue
      }

      // Se já passou da data de fim
      if (endYMD && todayYMD > endYMD) {
        skippedCount++
        continue
      }

      // Determinar as datas-alvo que deveriam ter sido geradas até hoje e ainda não foram
      // Frequência mensal:
      let shouldRunToday = false
      let targetDueDateYMD = ''

      if (frequency === 'mensal') {
        // Obter último dia do mês atual (ex.: fevereiro 28 ou 29)
        const daysInMonth = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0)).getUTCDate()
        const effectiveDay = Math.min(dayOfMonth, daysInMonth)

        // Se hoje é no dia ou após o dia da recorrência no mês atual
        if (currentDayOfMonth >= effectiveDay) {
          const currentTargetYMD =
            currentYear + '-' + pad(currentMonthIdx + 1) + '-' + pad(effectiveDay)

          // Se a data de término existir e for antes do vencimento do mês
          if (endYMD && currentTargetYMD > endYMD) {
            skippedCount++
            continue
          }

          // Verificar se já rodou para este mês (ou após)
          if (!lastRunYMD || lastRunYMD < currentTargetYMD) {
            shouldRunToday = true
            targetDueDateYMD = currentTargetYMD
          }
        }
      } else if (frequency === 'semanal') {
        // Se nunca rodou ou rodou há 7 dias ou mais
        if (!lastRunYMD) {
          shouldRunToday = true
          targetDueDateYMD = todayYMD
        } else {
          const lastDate = new Date(lastRunYMD + 'T00:00:00Z')
          const todayDate = new Date(todayYMD + 'T00:00:00Z')
          const diffDays = Math.round(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          )
          if (diffDays >= 7) {
            shouldRunToday = true
            targetDueDateYMD = todayYMD
          }
        }
      } else if (frequency === 'quinzenal') {
        if (!lastRunYMD) {
          shouldRunToday = true
          targetDueDateYMD = todayYMD
        } else {
          const lastDate = new Date(lastRunYMD + 'T00:00:00Z')
          const todayDate = new Date(todayYMD + 'T00:00:00Z')
          const diffDays = Math.round(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          )
          if (diffDays >= 14) {
            shouldRunToday = true
            targetDueDateYMD = todayYMD
          }
        }
      } else if (frequency === 'anual') {
        const startMonthIdx = startDateStr
          ? new Date(startDateStr.replace(' ', 'T')).getUTCMonth()
          : currentMonthIdx
        if (
          currentMonthIdx > startMonthIdx ||
          (currentMonthIdx === startMonthIdx && currentDayOfMonth >= dayOfMonth)
        ) {
          const targetYMD = currentYear + '-' + pad(startMonthIdx + 1) + '-' + pad(dayOfMonth)
          if (!lastRunYMD || lastRunYMD < targetYMD) {
            shouldRunToday = true
            targetDueDateYMD = targetYMD
          }
        }
      }

      if (!shouldRunToday || !targetDueDateYMD) {
        skippedCount++
        continue
      }

      // Suporte a parcelamento inteligente nas parcelas subsequentes
      let txDescription = item.getString('description')
      let txNotes = 'Lançamento gerado automaticamente por recorrência'
      const parcelMatch = txDescription.match(/^(.*?)\s*\(Parcelado\s+(\d+)x\)$/i)
      if (parcelMatch && startYMD) {
        const baseName = parcelMatch[1].trim()
        const totalInst = parseInt(parcelMatch[2], 10)
        const startYear = parseInt(startYMD.slice(0, 4), 10)
        const startMonth = parseInt(startYMD.slice(5, 7), 10)
        const targetYear = parseInt(targetDueDateYMD.slice(0, 4), 10)
        const targetMonth = parseInt(targetDueDateYMD.slice(5, 7), 10)
        const currentInst = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1
        if (currentInst >= 1 && currentInst <= totalInst) {
          txDescription = baseName + ' (' + currentInst + '/' + totalInst + ')'
          txNotes = 'Parcela ' + currentInst + ' de ' + totalInst + ' (gerada automaticamente)'
        }
      }

      // Idempotência adicional: verificar se já existe lançamento idêntico na mesma data para o usuário
      const amount = item.getFloat('amount')
      const txType = item.getString('type')
      const categoryId = item.getString('category')
      const accountId = item.getString('account')

      const safeDesc = txDescription.replace(/'/g, "\\'")
      const existingTxs = $app.findRecordsByFilter(
        'transactions',
        "user = '" +
          userId +
          "' && category = '" +
          categoryId +
          "' && account = '" +
          accountId +
          "' && date >= '" +
          targetDueDateYMD +
          " 00:00:00.000Z' && date <= '" +
          targetDueDateYMD +
          " 23:59:59.999Z' && description = '" +
          safeDesc +
          "'",
        '',
        1,
        0,
      )

      if (existingTxs.length > 0) {
        // Já existe o lançamento, apenas atualiza last_run para evitar ficar tentando
        item.set('last_run', targetDueDateYMD + ' 12:00:00.000Z')
        $app.save(item)
        skippedCount++
        continue
      }

      // Criar o lançamento em transactions
      const txCol = $app.findCollectionByNameOrId('transactions')
      const txRecord = new Record(txCol)
      txRecord.set('user', userId)
      txRecord.set('description', txDescription)
      txRecord.set('amount', amount)
      txRecord.set('type', txType)
      txRecord.set('date', targetDueDateYMD + ' 12:00:00.000Z')
      txRecord.set('category', categoryId)
      txRecord.set('account', accountId)
      txRecord.set('notes', txNotes)
      $app.save(txRecord)

      // Atualizar last_run da recorrência
      item.set('last_run', targetDueDateYMD + ' 12:00:00.000Z')
      $app.save(item)

      createdCount++
      console.log(
        '[cron:recurring-transactions-daily] Lançamento criado para recorrência ' +
          recId +
          ' ("' +
          description +
          '") na data ' +
          targetDueDateYMD,
      )
    } catch (itemErr) {
      errorCount++
      console.log(
        '[cron:recurring-transactions-daily] Erro na recorrência ' + recId + ': ' + itemErr.message,
      )
    }
  }

  console.log(
    '[cron:recurring-transactions-daily] Finalizado. Criados: ' +
      createdCount +
      ', Ignorados: ' +
      skippedCount +
      ', Erros: ' +
      errorCount,
  )
})

// Rota HTTP protegida para acionar manualmente o processamento de recorrências
// Útil para testes, QA ou para o próprio usuário forçar a sincronização de recorrências se desejar
routerAdd(
  'POST',
  '/backend/v1/recurring/process',
  (e) => {
    const authRecord = e.auth
    const specificUserId = authRecord ? authRecord.id : ''

    const now = new Date()
    const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const todayYMD = brtTime.toISOString().slice(0, 10)
    const currentYear = brtTime.getUTCFullYear()
    const currentMonthIdx = brtTime.getUTCMonth()
    const currentDayOfMonth = brtTime.getUTCDate()

    let filter = 'active = true'
    if (specificUserId) {
      filter += " && user = '" + specificUserId + "'"
    }

    const recurrings = $app.findRecordsByFilter(
      'recurring_transactions',
      filter,
      'created',
      1000,
      0,
    )
    let createdCount = 0
    let skippedCount = 0
    const pad = (n) => String(n).padStart(2, '0')

    for (let i = 0; i < recurrings.length; i++) {
      const item = recurrings[i]
      const userId = item.getString('user')

      try {
        const startDateStr = item.getString('start_date')
        const endDateStr = item.getString('end_date')
        const lastRunStr = item.getString('last_run')
        const frequency = item.getString('frequency')
        const dayOfMonth = item.getInt('day_of_month') || 1

        const startYMD = startDateStr ? startDateStr.slice(0, 10) : ''
        const endYMD = endDateStr ? endDateStr.slice(0, 10) : ''
        const lastRunYMD = lastRunStr ? lastRunStr.slice(0, 10) : ''

        if (startYMD && todayYMD < startYMD) {
          skippedCount++
          continue
        }
        if (endYMD && todayYMD > endYMD) {
          skippedCount++
          continue
        }

        let shouldRunToday = false
        let targetDueDateYMD = ''

        if (frequency === 'mensal') {
          const daysInMonth = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0)).getUTCDate()
          const effectiveDay = Math.min(dayOfMonth, daysInMonth)

          if (currentDayOfMonth >= effectiveDay) {
            const currentTargetYMD =
              currentYear + '-' + pad(currentMonthIdx + 1) + '-' + pad(effectiveDay)
            if (endYMD && currentTargetYMD > endYMD) {
              skippedCount++
              continue
            }
            if (!lastRunYMD || lastRunYMD < currentTargetYMD) {
              shouldRunToday = true
              targetDueDateYMD = currentTargetYMD
            }
          }
        } else if (frequency === 'semanal') {
          if (!lastRunYMD) {
            shouldRunToday = true
            targetDueDateYMD = todayYMD
          } else {
            const lastDate = new Date(lastRunYMD + 'T00:00:00Z')
            const todayDate = new Date(todayYMD + 'T00:00:00Z')
            const diffDays = Math.round(
              (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
            )
            if (diffDays >= 7) {
              shouldRunToday = true
              targetDueDateYMD = todayYMD
            }
          }
        } else if (frequency === 'quinzenal') {
          if (!lastRunYMD) {
            shouldRunToday = true
            targetDueDateYMD = todayYMD
          } else {
            const lastDate = new Date(lastRunYMD + 'T00:00:00Z')
            const todayDate = new Date(todayYMD + 'T00:00:00Z')
            const diffDays = Math.round(
              (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
            )
            if (diffDays >= 14) {
              shouldRunToday = true
              targetDueDateYMD = todayYMD
            }
          }
        } else if (frequency === 'anual') {
          const startMonthIdx = startDateStr
            ? new Date(startDateStr.replace(' ', 'T')).getUTCMonth()
            : currentMonthIdx
          if (
            currentMonthIdx > startMonthIdx ||
            (currentMonthIdx === startMonthIdx && currentDayOfMonth >= dayOfMonth)
          ) {
            const targetYMD = currentYear + '-' + pad(startMonthIdx + 1) + '-' + pad(dayOfMonth)
            if (!lastRunYMD || lastRunYMD < targetYMD) {
              shouldRunToday = true
              targetDueDateYMD = targetYMD
            }
          }
        }

        if (!shouldRunToday || !targetDueDateYMD) {
          skippedCount++
          continue
        }

        let txDescription = item.getString('description')
        let txNotes = 'Lançamento gerado automaticamente por recorrência'
        const parcelMatch = txDescription.match(/^(.*?)\s*\(Parcelado\s+(\d+)x\)$/i)
        if (parcelMatch && startYMD) {
          const baseName = parcelMatch[1].trim()
          const totalInst = parseInt(parcelMatch[2], 10)
          const startYear = parseInt(startYMD.slice(0, 4), 10)
          const startMonth = parseInt(startYMD.slice(5, 7), 10)
          const targetYear = parseInt(targetDueDateYMD.slice(0, 4), 10)
          const targetMonth = parseInt(targetDueDateYMD.slice(5, 7), 10)
          const currentInst = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1
          if (currentInst >= 1 && currentInst <= totalInst) {
            txDescription = baseName + ' (' + currentInst + '/' + totalInst + ')'
            txNotes = 'Parcela ' + currentInst + ' de ' + totalInst + ' (gerada automaticamente)'
          }
        }

        const amount = item.getFloat('amount')
        const txType = item.getString('type')
        const categoryId = item.getString('category')
        const accountId = item.getString('account')

        const safeDesc = txDescription.replace(/'/g, "\\'")
        const existingTxs = $app.findRecordsByFilter(
          'transactions',
          "user = '" +
            userId +
            "' && category = '" +
            categoryId +
            "' && account = '" +
            accountId +
            "' && date >= '" +
            targetDueDateYMD +
            " 00:00:00.000Z' && date <= '" +
            targetDueDateYMD +
            " 23:59:59.999Z' && description = '" +
            safeDesc +
            "'",
          '',
          1,
          0,
        )

        if (existingTxs.length > 0) {
          item.set('last_run', targetDueDateYMD + ' 12:00:00.000Z')
          $app.save(item)
          skippedCount++
          continue
        }

        const txCol = $app.findCollectionByNameOrId('transactions')
        const txRecord = new Record(txCol)
        txRecord.set('user', userId)
        txRecord.set('description', txDescription)
        txRecord.set('amount', amount)
        txRecord.set('type', txType)
        txRecord.set('date', targetDueDateYMD + ' 12:00:00.000Z')
        txRecord.set('category', categoryId)
        txRecord.set('account', accountId)
        txRecord.set('notes', txNotes)
        $app.save(txRecord)

        item.set('last_run', targetDueDateYMD + ' 12:00:00.000Z')
        $app.save(item)

        createdCount++
      } catch (err) {
        console.log('[recurring:process] Erro: ' + err.message)
      }
    }

    return e.json(200, {
      success: true,
      createdCount: createdCount,
      skippedCount: skippedCount,
      message: 'Processamento de recorrências executado com sucesso.',
    })
  },
  $apis.requireAuth(),
)
