import pb from '@/lib/pocketbase/client'
import {
  displayableMessages,
  streamAgentChat,
  type AgentCitation,
  type AgentMessage,
  type DisplayMessage,
} from '@/lib/skipAi'

export interface AssistantConversation {
  id: string
  title?: string
  created: string
  updated?: string
  last_message?: string
}

export interface AssistantChatResult {
  conversation_id: string
  content: string
  citations?: AgentCitation[]
  message_id: string
}

/**
 * Envia uma mensagem síncrona para o agente nativo.
 */
export async function sendAssistantMessage(
  message: string,
  conversationId: string | null = null,
): Promise<AssistantChatResult> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Falha ao conversar com o assistente.')
  }

  return payload as AssistantChatResult
}

/**
 * Envia uma mensagem com streaming via SSE para o agente nativo.
 */
export async function streamAssistantMessage(
  message: string,
  conversationId: string | null = null,
  handlers: {
    onChunk?: (delta: string, accumulated: string) => void
    onCitations?: (citations: AgentCitation[]) => void
    onError?: (err: string) => void
    signal?: AbortSignal
  } = {},
): Promise<{
  conversationId: string
  messageId: string
  content: string
  citations?: AgentCitation[]
}> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/assistant/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
    signal: handlers.signal,
  })

  const result = await streamAgentChat(res, {
    onChunk: handlers.onChunk,
    onCitations: handlers.onCitations,
    onError: handlers.onError,
    signal: handlers.signal,
  })

  const resolvedConvId = res.headers.get('X-Conversation-Id') ?? result.conversation_id

  return {
    conversationId: resolvedConvId,
    messageId: result.message_id,
    content: result.content,
    citations: result.citations,
  }
}

/**
 * Lista conversas recentes do usuário com o agente nativo.
 */
export async function listAssistantConversations(limit = 20): Promise<AssistantConversation[]> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/assistant/conversations?limit=${limit}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || 'Falha ao carregar conversas.')
  }

  // PocketBase agent listConversations returns an array or { items: [...] }
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

/**
 * Carrega o histórico de mensagens de uma conversa existente, filtrando pelo formato de exibição.
 */
export async function loadConversationMessages(conversationId: string): Promise<DisplayMessage[]> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(
    `${baseUrl}/backend/v1/ai/assistant/conversations/${conversationId}/messages`,
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    },
  )

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || 'Falha ao carregar mensagens.')
  }

  const rawMessages: AgentMessage[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.items)
        ? payload.items
        : []

  return displayableMessages(rawMessages)
}
