// Cron diário para envio de e-mail de contas a vencer (e vencidas pendentes)
// Roda de hora em hora (no minuto 0) e dispara para usuários cujo bills_reminder_hour coincide com a hora atual de Brasília (UTC-3)
cronAdd('bills-due-email-daily', '0 * * * *', () => {
  const now = new Date()
  // Hora atual em Brasília (America/Sao_Paulo: UTC-3)
  const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const currentBrtHour = brtTime.getUTCHours()
  const todayYMD = brtTime.toISOString().slice(0, 10)

  console.log(
    '[cron:bills-due-email] Executando verificação de horário para hora de Brasília: ' +
      currentBrtHour +
      'h (hoje: ' +
      todayYMD +
      ')',
  )

  let users = []
  try {
    users = $app.findRecordsByFilter('users', '', 'created', 1000, 0)
  } catch (err) {
    console.log('[cron:bills-due-email] Erro ao listar usuários: ' + err.message)
    return
  }

  let emailsSent = 0
  let usersSkipped = 0
  let errorsCount = 0

  for (let u = 0; u < users.length; u++) {
    const user = users[u]
    const userId = user.id
    const userEmail = user.getString('email')
    const userName = user.getString('name') || 'Usuário'

    if (!userEmail) {
      usersSkipped++
      continue
    }

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
        usersSkipped++
        continue
      }
    } catch (checkErr) {
      console.log(
        '[cron:bills-due-email] Erro ao verificar onboarding do usuário ' +
          userId +
          ': ' +
          checkErr.message,
      )
    }

    try {
      // Consultar configurações do usuário para envio de lembretes, antecedência em dias, horário de disparo e destinatário customizado
      let billsReminderEnabled = true
      let reminderDays = 3
      let reminderHour = 9 // default 9h horário de Brasília
      let customRecipient = ''

      try {
        const userSettings = $app.findFirstRecordByData('settings', 'user', userId)
        billsReminderEnabled = userSettings.getBool('bills_reminder_enabled')
        const days = userSettings.getInt('bills_reminder_days')
        if (days > 0) {
          reminderDays = days
        }
        const hourVal = userSettings.get('bills_reminder_hour')
        if (hourVal !== null && hourVal !== undefined && hourVal !== '') {
          reminderHour = userSettings.getInt('bills_reminder_hour')
        }
        const custRec = userSettings.getString('custom_recipient')
        if (custRec && custRec.trim()) {
          customRecipient = custRec.trim()
        }
      } catch (_) {
        // Sem registro em settings: mantém defaults (ligado, 3 dias, 9h)
      }

      if (!billsReminderEnabled) {
        usersSkipped++
        continue
      }

      // Disparar somente se a hora atual de Brasília coincidir com a hora configurada pelo usuário
      if (currentBrtHour !== reminderHour) {
        usersSkipped++
        continue
      }

      // Calcular data limite individual baseada em reminderDays do usuário
      const userCutoffDate = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000)
      const userCutoffYMD = userCutoffDate.toISOString().slice(0, 10)
      const userCutoff = userCutoffYMD + ' 23:59:59.999Z'

      // Buscar contas em aberto ou atrasadas que vencem até userCutoff
      const bills = $app.findRecordsByFilter(
        'bills',
        "user = '" +
          userId +
          "' && (status = 'em_aberto' || status = 'atrasado') && due_date <= '" +
          userCutoff +
          "'",
        'due_date',
        200,
        0,
      )

      if (bills.length === 0) {
        usersSkipped++
        continue
      }

      // Destinatário efetivo: personalizado ou padrão do usuário
      const targetEmail = customRecipient || userEmail

      // Separar contas por status ou proximidade
      let overdueCount = 0
      let dueTodayCount = 0
      let upcomingCount = 0

      const billsTableRows = []
      const billsTextLines = []

      for (let b = 0; b < bills.length; b++) {
        const item = bills[b]
        const desc = item.getString('description')
        const amount = item.getFloat('amount')
        const direction = item.getString('direction') // 'pagar' | 'receber'
        const rawDueDate = item.getString('due_date')
        const dueYMD = rawDueDate ? rawDueDate.slice(0, 10) : ''
        const status = item.getString('status') // 'em_aberto' | 'atrasado'

        let formattedDate = dueYMD
        if (dueYMD.length === 10) {
          const parts = dueYMD.split('-')
          formattedDate = parts[2] + '/' + parts[1] + '/' + parts[0]
        }

        let statusBadge = ''
        let badgeColor = '#5B5FEF'
        let badgeBg = '#EEF2FF'

        if (dueYMD < todayYMD || status === 'atrasado') {
          overdueCount++
          statusBadge = 'Atrasada'
          badgeColor = '#DC2626'
          badgeBg = '#FEE2E2'
        } else if (dueYMD === todayYMD) {
          dueTodayCount++
          statusBadge = 'Vence HOJE'
          badgeColor = '#D97706'
          badgeBg = '#FEF3C7'
        } else {
          upcomingCount++
          statusBadge = 'Vence em breve'
          badgeColor = '#2563EB'
          badgeBg = '#DBEAFE'
        }

        const typeLabel = direction === 'receber' ? 'A Receber' : 'A Pagar'
        const amountFormatted = 'R$ ' + amount.toFixed(2).replace('.', ',')

        billsTableRows.push(
          '<tr>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #1F2937;"><strong>' +
            desc +
            '</strong><br><span style="font-size: 11px; color: #6B7280;">' +
            typeLabel +
            '</span></td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; font-weight: 600; color: #1F2937;">' +
            amountFormatted +
            '</td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #374151;">' +
            formattedDate +
            '</td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; text-align: right;">' +
            '<span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-weight: 600; background-color: ' +
            badgeBg +
            '; color: ' +
            badgeColor +
            ';">' +
            statusBadge +
            '</span>' +
            '</td>' +
            '</tr>',
        )

        billsTextLines.push(
          '- ' +
            desc +
            ' (' +
            typeLabel +
            '): ' +
            amountFormatted +
            ' | Vencimento: ' +
            formattedDate +
            ' [' +
            statusBadge +
            ']',
        )
      }

      const totalBills = bills.length
      const siteUrl = $os.getenv('SITE_URL') || 'https://financas-inteligentes.skip.app'

      const emailSubject =
        overdueCount > 0
          ? '⚠️ Atenção: Você tem ' + totalBills + ' conta(s) a vencer ou atrasadas'
          : '🔔 Lembrete: Você tem ' + totalBills + ' conta(s) a vencer nos próximos dias'

      let senderAddress = 'contato@financas.local'
      let senderName = 'Finanças Inteligentes'
      try {
        const meta = $app.settings().meta
        if (meta && meta.senderAddress) senderAddress = meta.senderAddress
        if (meta && meta.senderName) senderName = meta.senderName
      } catch (_) {}

      const unsubscribeUrl = siteUrl + '/configuracoes'

      // Versão HTML anti-spam
      const emailHtml =
        '<!DOCTYPE html>' +
        '<html>' +
        '<head><meta charset="utf-8"></head>' +
        '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; padding: 24px; margin: 0; color: #111827;">' +
        '<div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">' +
        '  <div style="background-color: #5B5FEF; padding: 24px; text-align: left; color: #FFFFFF;">' +
        '    <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Finanças Inteligentes</h1>' +
        '    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Aviso diário de vencimento de contas</p>' +
        '  </div>' +
        '  <div style="padding: 24px;">' +
        '    <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Olá, <strong>' +
        userName +
        '</strong>!</p>' +
        '    <p style="font-size: 14px; line-height: 1.5; color: #4B5563;">' +
        '      Identificamos <strong>' +
        totalBills +
        ' conta(s)</strong> pendente(s) com vencimento nos próximos ' +
        reminderDays +
        ' dia(s) ou com pagamento atrasado:' +
        '    </p>' +
        '    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px;">' +
        '      <thead>' +
        '        <tr style="background-color: #F3F4F6; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280;">' +
        '          <th style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">Conta</th>' +
        '          <th style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">Valor</th>' +
        '          <th style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">Vencimento</th>' +
        '          <th style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">Status</th>' +
        '        </tr>' +
        '      </thead>' +
        '      <tbody>' +
        billsTableRows.join('') +
        '      </tbody>' +
        '    </table>' +
        '    <div style="text-align: center; margin-top: 28px; margin-bottom: 20px;">' +
        '      <a href="' +
        siteUrl +
        '/contas" style="background-color: #5B5FEF; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block;">Ver e quitar contas no app</a>' +
        '    </div>' +
        '    <div style="border-top: 1px solid #F3F4F6; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #6B7280; line-height: 1.5;">' +
        '      💡 <strong>Dica importante para não perder notificações:</strong> adicione o remetente <code>' +
        senderAddress +
        '</code> aos seus contatos confiáveis e, se este e-mail caiu na sua caixa de spam ou lixo eletrônico, marque-o como "Não é spam".' +
        '    </div>' +
        '  </div>' +
        '  <div style="padding: 16px 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.6;">' +
        '    <p style="margin: 0 0 6px 0;">Este é um lembrete automático do <a href="' +
        siteUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Finanças Inteligentes</a>.</p>' +
        '    <p style="margin: 0;">Para alterar o horário, destinatário ou desativar este lembrete, gerencie suas preferências em <a href="' +
        unsubscribeUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Configurações do app</a>.</p>' +
        '  </div>' +
        '</div>' +
        '</body>' +
        '</html>'

      // Versão texto puro alternativo (mitigação anti-spam)
      const emailText =
        'Finanças Inteligentes - Lembrete Diário de Contas\n\n' +
        'Olá, ' +
        userName +
        '!\n\n' +
        'Identificamos ' +
        totalBills +
        ' conta(s) pendente(s) com vencimento nos próximos ' +
        reminderDays +
        ' dia(s) ou em atraso:\n\n' +
        billsTextLines.join('\n') +
        '\n\n' +
        'Acesse e gerencie suas contas no app:\n' +
        siteUrl +
        '/contas\n\n' +
        '----------------------------------------\n' +
        'Dica: Para garantir o recebimento dos avisos, adicione ' +
        senderAddress +
        ' aos seus contatos e marque esta mensagem como "Não é spam".\n\n' +
        'Para ajustar suas preferências ou cancelar os envios, acesse: ' +
        unsubscribeUrl +
        '\n'

      let sendSuccess = false
      let sendErrMsg = ''

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
            'X-Entity-Ref-ID': 'bills-reminder-' + userId + '-' + todayYMD,
          },
        })
        $app.newMailClient().send(message)
        sendSuccess = true
        emailsSent++
        console.log(
          '[cron:bills-due-email] E-mail enviado com sucesso para ' +
            targetEmail +
            ' (' +
            totalBills +
            ' contas)',
        )
      } catch (sendErr) {
        sendErrMsg = sendErr.message
        console.log(
          '[cron:bills-due-email] Falha ao enviar para ' + targetEmail + ': ' + sendErr.message,
        )
      }

      // Gravar histórico de disparo na coleção email_notifications
      try {
        const notifCol = $app.findCollectionByNameOrId('email_notifications')
        const notif = new Record(notifCol)
        notif.set('user', userId)
        notif.set('type', 'lembrete_contas')
        notif.set('recipient', targetEmail)
        notif.set('items_count', totalBills)
        notif.set('status', sendSuccess ? 'enviado' : 'falhou')
        notif.set('subject', emailSubject)
        if (!sendSuccess && sendErrMsg) {
          notif.set('error_message', sendErrMsg)
        }
        $app.save(notif)
      } catch (histErr) {
        console.log('[cron:bills-due-email] Erro ao gravar histórico: ' + histErr.message)
      }
    } catch (userErr) {
      errorsCount++
      console.log(
        '[cron:bills-due-email] Erro ao verificar contas para usuário ' +
          userId +
          ': ' +
          userErr.message,
      )
    }
  }

  console.log(
    '[cron:bills-due-email] Concluído. E-mails enviados/processados: ' +
      emailsSent +
      ', Usuários ignorados (sem contas): ' +
      usersSkipped +
      ', Erros: ' +
      errorsCount,
  )
})

// Rota HTTP protegida para acionar manualmente ou testar o envio de e-mails de contas a vencer
routerAdd(
  'POST',
  '/backend/v1/bills/send-due-reminders',
  (e) => {
    const authRecord = e.auth
    const specificUserId = authRecord ? authRecord.id : ''

    const now = new Date()
    const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const todayYMD = brtTime.toISOString().slice(0, 10)

    let users = []
    if (specificUserId) {
      users = [$app.findRecordById('users', specificUserId)]
    } else {
      users = $app.findRecordsByFilter('users', '', 'created', 1000, 0)
    }

    let emailsSent = 0
    let usersSkipped = 0
    let totalEligibleBills = 0

    for (let u = 0; u < users.length; u++) {
      const user = users[u]
      const userId = user.id
      const userEmail = user.getString('email')
      const userName = user.getString('name') || 'Usuário'

      if (!userEmail) {
        usersSkipped++
        continue
      }

      // Validar onboarding do usuário
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
          usersSkipped++
          continue
        }
      } catch (_) {}

      let billsReminderEnabled = true
      let reminderDays = 3
      let customRecipient = ''
      try {
        const userSettings = $app.findFirstRecordByData('settings', 'user', userId)
        billsReminderEnabled = userSettings.getBool('bills_reminder_enabled')
        const days = userSettings.getInt('bills_reminder_days')
        if (days > 0) {
          reminderDays = days
        }
        const custRec = userSettings.getString('custom_recipient')
        if (custRec && custRec.trim()) {
          customRecipient = custRec.trim()
        }
      } catch (_) {
        // Defaults
      }

      // Se a rota manual foi acionada para todos, respeita quem desativou;
      // se foi acionada pelo próprio usuário logado, permite o teste respeitando seus dias de antecedência
      if (!billsReminderEnabled && !specificUserId) {
        usersSkipped++
        continue
      }

      const userCutoffDate = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000)
      const userCutoffYMD = userCutoffDate.toISOString().slice(0, 10)
      const userCutoff = userCutoffYMD + ' 23:59:59.999Z'

      const bills = $app.findRecordsByFilter(
        'bills',
        "user = '" +
          userId +
          "' && (status = 'em_aberto' || status = 'atrasado') && due_date <= '" +
          userCutoff +
          "'",
        'due_date',
        200,
        0,
      )

      if (bills.length === 0) {
        usersSkipped++
        continue
      }

      totalEligibleBills += bills.length
      const targetEmail = customRecipient || userEmail

      let overdueCount = 0
      const billsTableRows = []
      const billsTextLines = []

      for (let b = 0; b < bills.length; b++) {
        const item = bills[b]
        const desc = item.getString('description')
        const amount = item.getFloat('amount')
        const direction = item.getString('direction')
        const rawDueDate = item.getString('due_date')
        const dueYMD = rawDueDate ? rawDueDate.slice(0, 10) : ''
        const status = item.getString('status')

        let formattedDate = dueYMD
        if (dueYMD.length === 10) {
          const parts = dueYMD.split('-')
          formattedDate = parts[2] + '/' + parts[1] + '/' + parts[0]
        }

        let statusBadge = ''
        let badgeColor = '#5B5FEF'
        let badgeBg = '#EEF2FF'

        if (dueYMD < todayYMD || status === 'atrasado') {
          overdueCount++
          statusBadge = 'Atrasada'
          badgeColor = '#DC2626'
          badgeBg = '#FEE2E2'
        } else if (dueYMD === todayYMD) {
          statusBadge = 'Vence HOJE'
          badgeColor = '#D97706'
          badgeBg = '#FEF3C7'
        } else {
          statusBadge = 'Vence em breve'
          badgeColor = '#2563EB'
          badgeBg = '#DBEAFE'
        }

        const typeLabel = direction === 'receber' ? 'A Receber' : 'A Pagar'
        const amountFormatted = 'R$ ' + amount.toFixed(2).replace('.', ',')

        billsTableRows.push(
          '<tr>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #1F2937;"><strong>' +
            desc +
            '</strong><br><span style="font-size: 11px; color: #6B7280;">' +
            typeLabel +
            '</span></td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; font-weight: 600; color: #1F2937;">' +
            amountFormatted +
            '</td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #374151;">' +
            formattedDate +
            '</td>' +
            '<td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; text-align: right;">' +
            '<span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-weight: 600; background-color: ' +
            badgeBg +
            '; color: ' +
            badgeColor +
            ';">' +
            statusBadge +
            '</span>' +
            '</td>' +
            '</tr>',
        )

        billsTextLines.push(
          '- ' +
            desc +
            ' (' +
            typeLabel +
            '): ' +
            amountFormatted +
            ' | Vencimento: ' +
            formattedDate +
            ' [' +
            statusBadge +
            ']',
        )
      }

      const totalBills = bills.length
      const siteUrl = $os.getenv('SITE_URL') || 'https://financas-inteligentes.skip.app'

      const emailSubject =
        overdueCount > 0
          ? '⚠️ Atenção: Você tem ' + totalBills + ' conta(s) a vencer ou atrasadas'
          : '🔔 Lembrete: Você tem ' + totalBills + ' conta(s) a vencer nos próximos dias'

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
        '  <div style="background-color: #5B5FEF; padding: 24px; color: #FFFFFF;">' +
        '    <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Finanças Inteligentes</h1>' +
        '    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Aviso de vencimento de contas</p>' +
        '  </div>' +
        '  <div style="padding: 24px;">' +
        '    <p style="font-size: 15px; margin-top: 0;">Olá, <strong>' +
        userName +
        '</strong>!</p>' +
        '    <p style="font-size: 14px; color: #4B5563;">Você tem <strong>' +
        totalBills +
        ' conta(s)</strong> pendente(s) com vencimento nos próximos ' +
        reminderDays +
        ' dia(s) ou em atraso:</p>' +
        '    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px;">' +
        '      <thead>' +
        '        <tr style="background-color: #F3F4F6; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280;">' +
        '          <th style="padding: 8px 12px;">Conta</th>' +
        '          <th style="padding: 8px 12px;">Valor</th>' +
        '          <th style="padding: 8px 12px;">Vencimento</th>' +
        '          <th style="padding: 8px 12px; text-align: right;">Status</th>' +
        '        </tr>' +
        '      </thead>' +
        '      <tbody>' +
        billsTableRows.join('') +
        '      </tbody>' +
        '    </table>' +
        '    <div style="text-align: center; margin-top: 24px; margin-bottom: 20px;">' +
        '      <a href="' +
        siteUrl +
        '/contas" style="background-color: #5B5FEF; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block;">Acessar minhas contas no app</a>' +
        '    </div>' +
        '    <div style="border-top: 1px solid #F3F4F6; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #6B7280; line-height: 1.5;">' +
        '      💡 <strong>Dica importante para não perder notificações:</strong> adicione o remetente <code>' +
        senderAddress +
        '</code> aos seus contatos confiáveis e, se este e-mail caiu na sua caixa de spam ou lixo eletrônico, marque-o como "Não é spam".' +
        '    </div>' +
        '  </div>' +
        '  <div style="padding: 16px 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.6;">' +
        '    <p style="margin: 0 0 6px 0;">Este é um lembrete automático do <a href="' +
        siteUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Finanças Inteligentes</a>.</p>' +
        '    <p style="margin: 0;">Para gerenciar suas preferências de notificação ou alterar este e-mail, acesse as <a href="' +
        unsubscribeUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Configurações do app</a>.</p>' +
        '  </div>' +
        '</div>' +
        '</body>' +
        '</html>'

      const emailText =
        'Finanças Inteligentes - Lembrete de Contas\n\n' +
        'Olá, ' +
        userName +
        '!\n\n' +
        'Você tem ' +
        totalBills +
        ' conta(s) pendente(s) com vencimento nos próximos ' +
        reminderDays +
        ' dia(s) ou em atraso:\n\n' +
        billsTextLines.join('\n') +
        '\n\n' +
        'Acesse e quite suas contas no app:\n' +
        siteUrl +
        '/contas\n\n' +
        '----------------------------------------\n' +
        'Dica: Adicione ' +
        senderAddress +
        ' aos seus contatos e marque esta mensagem como "Não é spam".\n\n' +
        'Para ajustar preferências ou cancelar os envios, acesse: ' +
        unsubscribeUrl +
        '\n'

      let sendSuccess = false
      let sendErrMsg = ''

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
            'X-Entity-Ref-ID': 'bills-reminder-manual-' + userId + '-' + todayYMD,
          },
        })
        $app.newMailClient().send(message)
        sendSuccess = true
        emailsSent++
      } catch (err) {
        sendErrMsg = err.message
        console.log(
          '[bills:send-reminders] Erro ou simulação de envio de e-mail para ' +
            targetEmail +
            ': ' +
            err.message,
        )
      }

      // Registrar histórico
      try {
        const notifCol = $app.findCollectionByNameOrId('email_notifications')
        const notif = new Record(notifCol)
        notif.set('user', userId)
        notif.set('type', 'lembrete_contas')
        notif.set('recipient', targetEmail)
        notif.set('items_count', totalBills)
        notif.set('status', sendSuccess ? 'enviado' : 'falhou')
        notif.set('subject', emailSubject)
        if (!sendSuccess && sendErrMsg) {
          notif.set('error_message', sendErrMsg)
        }
        $app.save(notif)
      } catch (histErr) {
        console.log('[bills:send-reminders] Erro ao gravar histórico: ' + histErr.message)
      }
    }

    return e.json(200, {
      success: true,
      emailsSent: emailsSent,
      usersSkipped: usersSkipped,
      billsCount: totalEligibleBills,
      message:
        emailsSent > 0
          ? 'Lembrete de contas enviado com sucesso para o e-mail de destino.'
          : 'Nenhuma conta a vencer encontrada no período configurado.',
    })
  },
  $apis.requireAuth(),
)
