// Cron diário para marcar contas vencidas como atrasadas
// Executa às 09:00 no fuso de Brasília (UTC-3) -> 12:00 UTC
cronAdd('bills-overdue-daily', '0 12 * * *', () => {
  // Obter data de hoje em America/Sao_Paulo (UTC-3)
  const now = new Date()
  const brtTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const todayBRTYMD = brtTime.toISOString().slice(0, 10)
  // Início do dia atual em BRT convertido para UTC (00:00:00 BRT = 03:00:00 UTC)
  const cutoff = todayBRTYMD + ' 03:00:00.000Z'

  const records = $app.findRecordsByFilter(
    'bills',
    "status = 'em_aberto' && due_date < '" + cutoff + "'",
    'due_date',
    1000,
    0,
  )

  let updatedCount = 0
  for (let i = 0; i < records.length; i++) {
    records[i].set('status', 'atrasado')
    $app.save(records[i])
    updatedCount++
  }

  console.log(
    '[cron:bills-overdue-daily] Contas vencidas atualizadas para atrasado: ' + updatedCount,
  )
})
