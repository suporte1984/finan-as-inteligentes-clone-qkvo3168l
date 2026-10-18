routerAdd(
  'POST',
  '/backend/v1/ai/assistant/chat-stream',
  (e) => {
    try {
      const userId = e.auth && e.auth.id
      if (!userId) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const body = e.requestInfo().body || {}
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) {
        return e.badRequestError('Mensagem é obrigatória')
      }

      const conv = $ai.agent('assistente-financeiro').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
      })

      const iter = $ai.agent('assistente-financeiro').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao processar solicitação com o assistente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'Serviço de IA temporariamente indisponível' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
