// Hook para finalizar o onboarding do usuário
// Ativa as configurações de e-mail com os defaults (lembretes: true, 3 dias, 9h; fechamento IA: true, 9h)
// e dispara um e-mail de boas-vindas confirmando que as automações estão ativas
routerAdd(
  'POST',
  '/backend/v1/onboarding/complete',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    const userId = authRecord.id
    const userEmail = authRecord.getString('email')
    const userName = authRecord.getString('name') || 'Usuário'

    // Validar se os dados mínimos reais existem:
    // 1 conta banco, 1 conta cartao, 1 lançamento
    const bankAccounts = $app.findRecordsByFilter(
      'accounts',
      "user = '" + userId + "' && type = 'banco'",
      '',
      1,
      0,
    )
    const cardAccounts = $app.findRecordsByFilter(
      'accounts',
      "user = '" + userId + "' && type = 'cartao'",
      '',
      1,
      0,
    )
    const transactions = $app.findRecordsByFilter(
      'transactions',
      "user = '" + userId + "'",
      '',
      1,
      0,
    )

    if (bankAccounts.length === 0 || cardAccounts.length === 0 || transactions.length === 0) {
      return e.json(400, {
        error:
          'Onboarding incompleto. É necessário pelo menos 1 conta bancária, 1 cartão e 1 lançamento.',
        hasBank: bankAccounts.length > 0,
        hasCard: cardAccounts.length > 0,
        hasTransaction: transactions.length > 0,
      })
    }

    // Atualizar ou criar registro em settings com as automações ativadas nos defaults
    let userSettings
    try {
      userSettings = $app.findFirstRecordByData('settings', 'user', userId)
    } catch (_) {
      const col = $app.findCollectionByNameOrId('settings')
      userSettings = new Record(col)
      userSettings.set('user', userId)
    }

    userSettings.set('bills_reminder_enabled', true)
    userSettings.set('bills_reminder_days', 3)
    userSettings.set('bills_reminder_hour', 9)
    userSettings.set('ai_report_auto_enabled', true)
    userSettings.set('ai_report_notify_email', true)
    userSettings.set('ai_report_hour', 9)
    $app.save(userSettings)

    // Enviar e-mail de boas-vindas confirmando que as automações estão ativas
    let emailSent = false
    let sendErrMsg = ''

    if (userEmail) {
      const siteUrl = $os.getenv('SITE_URL') || 'https://financas-inteligentes.skip.app'
      let senderAddress = 'contato@financas.local'
      let senderName = 'Finanças Inteligentes'
      try {
        const meta = $app.settings().meta
        if (meta && meta.senderAddress) senderAddress = meta.senderAddress
        if (meta && meta.senderName) senderName = meta.senderName
      } catch (_) {}

      const emailSubject = '🎉 Boas-vindas ao Finanças Inteligentes! Suas automações estão prontas'
      const unsubscribeUrl = siteUrl + '/configuracoes'

      const emailHtml =
        '<!DOCTYPE html>' +
        '<html>' +
        '<head><meta charset="utf-8"></head>' +
        '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; padding: 24px; margin: 0; color: #111827;">' +
        '<div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">' +
        '  <div style="background-color: #5B5FEF; padding: 28px; text-align: left; color: #FFFFFF;">' +
        '    <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Tudo pronto com suas finanças!</h1>' +
        '    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Configuração inicial concluída com sucesso</p>' +
        '  </div>' +
        '  <div style="padding: 24px;">' +
        '    <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Olá, <strong>' +
        userName +
        '</strong>!</p>' +
        '    <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">' +
        '      Você concluiu as etapas obrigatórias de configuração da sua conta: cadastrou seu banco, seu cartão e registrou seu primeiro lançamento.' +
        '    </p>' +
        '    <div style="background-color: #F3F4F6; border-radius: 8px; padding: 16px; margin: 20px 0;">' +
        '      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #111827;">⚡ Suas automações inteligentes já estão ativas:</h3>' +
        '      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151; line-height: 1.6;">' +
        '        <li><strong>Lembrete diário de contas a vencer:</strong> avisos matinais às 09:00 com 3 dias de antecedência para você nunca mais pagar juros.</li>' +
        '        <li><strong>Fechamento mensal com IA:</strong> relatório automático todo dia 1º às 09:00 com análise de gastos e sugestões práticas de economia.</li>' +
        '      </ul>' +
        '    </div>' +
        '    <div style="text-align: center; margin-top: 28px; margin-bottom: 20px;">' +
        '      <a href="' +
        siteUrl +
        '" style="background-color: #5B5FEF; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">Acessar o Dashboard</a>' +
        '    </div>' +
        '    <div style="border-top: 1px solid #F3F4F6; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #6B7280; line-height: 1.5;">' +
        '      💡 <strong>Dica importante para não perder notificações:</strong> adicione <code>' +
        senderAddress +
        '</code> aos seus contatos confiáveis e, se este e-mail caiu na sua caixa de spam, marque-o como "Não é spam".' +
        '    </div>' +
        '  </div>' +
        '  <div style="padding: 16px 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.6;">' +
        '    <p style="margin: 0 0 6px 0;">Este é um e-mail de boas-vindas do <a href="' +
        siteUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Finanças Inteligentes</a>.</p>' +
        '    <p style="margin: 0;">Você pode personalizar ou desativar suas automações quando quiser em <a href="' +
        unsubscribeUrl +
        '" style="color: #5B5FEF; text-decoration: underline;">Configurações</a>.</p>' +
        '  </div>' +
        '</div>' +
        '</body>' +
        '</html>'

      const emailText =
        'Finanças Inteligentes - Boas-vindas!\n\n' +
        'Olá, ' +
        userName +
        '!\n\n' +
        'Você concluiu o cadastro inicial da sua conta (banco, cartão e primeiro lançamento).\n\n' +
        'Suas automações inteligentes já estão ativas:\n' +
        '- Lembrete diário de contas a vencer (às 09:00 com 3 dias de antecedência)\n' +
        '- Fechamento mensal de despesas com IA (todo dia 1º às 09:00)\n\n' +
        'Acesse seu painel agora:\n' +
        siteUrl +
        '\n\n' +
        '----------------------------------------\n' +
        'Dica: Adicione ' +
        senderAddress +
        ' aos seus contatos e marque como "Não é spam".\n\n' +
        'Gerenciar automações: ' +
        unsubscribeUrl +
        '\n'

      try {
        const message = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: userEmail }],
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          headers: {
            'List-Unsubscribe':
              '<' + unsubscribeUrl + '>, <mailto:' + senderAddress + '?subject=unsubscribe>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Entity-Ref-ID': 'onboarding-welcome-' + userId,
          },
        })
        $app.newMailClient().send(message)
        emailSent = true
      } catch (mailErr) {
        sendErrMsg = mailErr.message
        console.log(
          '[onboarding:complete] Falha ao enviar e-mail de boas-vindas: ' + mailErr.message,
        )
      }
    }

    return e.json(200, {
      success: true,
      emailSent: emailSent,
      sendErrMsg: sendErrMsg || null,
      message: 'Onboarding concluído com sucesso e automações ativadas!',
    })
  },
  $apis.requireAuth(),
)
