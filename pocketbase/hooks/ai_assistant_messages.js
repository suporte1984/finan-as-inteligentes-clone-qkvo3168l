routerAdd(
  'GET',
  '/backend/v1/ai/assistant/conversations/{conversationId}/messages',
  (e) => {
    try {
      const userId = e.auth && e.auth.id
      if (!userId) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const conversationId = e.request.pathValue('conversationId')
      const messages = $ai.agent('assistente-financeiro').listMessages({
        conversation_id: conversationId,
        user_id: userId,
      })

      return e.json(200, messages)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao buscar mensagens da conversa' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
