routerAdd(
  'GET',
  '/backend/v1/ai/assistant/conversations',
  (e) => {
    try {
      const userId = e.auth && e.auth.id
      if (!userId) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const limit = parseInt(e.requestInfo().query?.limit || '20', 10) || 20
      const conversations = $ai.agent('assistente-financeiro').listConversations({
        user_id: userId,
        limit: limit,
      })

      return e.json(200, conversations)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao buscar conversas' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
