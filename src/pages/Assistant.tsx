import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bot,
  BrainCircuit,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  listAssistantConversations,
  loadConversationMessages,
  streamAssistantMessage,
  type AssistantConversation,
} from '@/services/aiAssistant'
import type { DisplayMessage } from '@/lib/skipAi'

const SUGGESTED_PROMPTS = [
  'Qual é o total das minhas despesas neste mês e quais as maiores categorias?',
  'Quais são minhas próximas contas a pagar e tem alguma atrasada?',
  'Como estão minhas metas de gasto? Tem alguma perto de estourar?',
  'Compare meus gastos deste mês com a média dos últimos 3 meses.',
  'Onde posso economizar nos próximos meses com base nos meus lançamentos?',
]

export default function AssistantPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)

  const initialPromptHandled = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Carregar conversas ao iniciar
  const fetchConversations = async () => {
    try {
      setLoadingConversations(true)
      const list = await listAssistantConversations()
      setConversations(list)
    } catch {
      // Falha silenciosa ou sem conversas prévias
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }

  useEffect(() => {
    void fetchConversations()
  }, [])

  // Inicializar com pergunta vinda da query string (?q=)
  useEffect(() => {
    const queryPrompt = searchParams.get('q')
    if (queryPrompt && queryPrompt.trim() && !initialPromptHandled.current) {
      initialPromptHandled.current = true
      // Limpa a query string para não reenviar ao atualizar
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('q')
      setSearchParams(nextParams, { replace: true })
      // Dispara envio automático da pergunta inicial
      void handleSendMessage(queryPrompt.trim())
    }
  }, [searchParams, setSearchParams])

  // Carregar mensagens quando a conversa ativa mudar
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    let isMounted = true
    setLoadingHistory(true)
    loadConversationMessages(activeConversationId)
      .then((history) => {
        if (isMounted) setMessages(history)
      })
      .catch(() => {
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: 'Não foi possível carregar a conversa',
            description: 'Tente novamente selecionando outra conversa ou criando uma nova.',
          })
        }
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeConversationId, toast])

  const handleStartNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setActiveConversationId(null)
    setMessages([])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleSelectConversation = (id: string) => {
    if (id === activeConversationId) return
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setActiveConversationId(id)
  }

  async function handleSendMessage(textToSend?: string) {
    const rawText = textToSend ?? input
    const message = rawText.trim()
    if (!message || loading) return

    setInput('')
    setLoading(true)

    // Mensagem do usuário temporária
    const userMsgId = 'user-' + Date.now()
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: 'user',
      content: message,
      created: new Date().toISOString(),
    }

    // Placeholder de resposta do assistente
    const assistantMsgId = 'assistant-' + Date.now()
    const assistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      created: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await streamAssistantMessage(message, activeConversationId, {
        onChunk: (_delta, fullText) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: fullText } : msg)),
          )
        },
        onCitations: (citations) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, citations } : msg)),
          )
        },
        signal: controller.signal,
      })

      // Se iniciou uma conversa nova, atualiza activeConversationId e a lista lateral
      if (!activeConversationId && result.conversationId) {
        setActiveConversationId(result.conversationId)
        void fetchConversations()
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: result.content,
                citations: result.citations,
              }
            : msg,
        ),
      )
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Falha na comunicação com o assistente.'
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Cancelado pelo usuário
        return
      }

      toast({
        variant: 'destructive',
        title: 'Erro no assistente',
        description: errorMsg,
      })

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  'Desculpe, não consegui processar a resposta agora. Por favor, tente novamente.',
              }
            : msg,
        ),
      )
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSendMessage()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  const initials = String(user?.name || user?.email || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(msgId)
      toast({
        title: 'Mensagem copiada',
        description: 'O texto da resposta foi copiado para a área de transferência.',
      })
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Falha ao copiar',
        description: 'Não foi possível copiar o texto da mensagem.',
      })
    }
  }

  return (
    <div className="space-y-6 page-container">
      <header className="animate-fade-up flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] text-fin-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Inteligência Financeira Nativa
          </p>
          <h1 className="page-title">Assistente Financeiro</h1>
          <p className="page-subtitle">
            Converse com seu assistente para consultar lançamentos, metas, despesas e receber
            sugestões de economia.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button onClick={handleStartNewChat} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>
      </header>

      <div className="animate-fade-up stagger-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Painel lateral: Histórico de Conversas */}
        <div className="fin-card p-4 space-y-3 bg-[var(--fin-bg-card)] shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-fin-border">
            <span className="text-xs font-bold uppercase tracking-wider text-fin-muted flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversas
            </span>
            <button
              onClick={handleStartNewChat}
              className="text-xs text-fin-primary font-medium hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Novo chat
            </button>
          </div>

          {loadingConversations ? (
            <div className="space-y-2 py-2">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-6 text-center text-xs text-fin-muted">
              Nenhuma conversa gravada. Envie sua primeira pergunta ao lado.
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
              {conversations.map((c) => {
                const isActive = c.id === activeConversationId
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex flex-col gap-1',
                      isActive
                        ? 'bg-[#EEEEF8] text-fin-primary font-semibold'
                        : 'text-fin-muted hover:bg-fin-surface hover:text-fin-text',
                    )}
                  >
                    <span className="truncate block font-medium">
                      {c.title || c.last_message || 'Conversa sem título'}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {new Date(c.created).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Área de Chat Principal */}
        <div className="fin-card flex flex-col h-[650px] overflow-hidden border border-fin-border shadow-xs">
          {/* Header do Chat */}
          <div className="flex items-center justify-between border-b border-fin-border bg-[var(--fin-bg-card)] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-fin-primary text-white shadow-sm">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  Assistente Financeiro
                  <span className="fin-badge fin-badge-primary text-[10px] py-0 px-1.5">
                    Nativo
                  </span>
                </h2>
                <p className="text-xs text-fin-muted">
                  Com acesso integrado a transações, contas, categorias e metas
                </p>
              </div>
            </div>
            {activeConversationId && (
              <button
                onClick={() => {
                  if (activeConversationId) {
                    setLoadingHistory(true)
                    loadConversationMessages(activeConversationId)
                      .then(setMessages)
                      .finally(() => setLoadingHistory(false))
                  }
                }}
                className="rounded-lg p-2 text-fin-muted hover:bg-fin-surface transition"
                title="Recarregar mensagens"
              >
                <RefreshCw className={cn('h-4 w-4', loadingHistory && 'animate-spin')} />
              </button>
            )}
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--fin-bg-page)]">
            {loadingHistory ? (
              <div className="space-y-4 py-8">
                <div className="skeleton h-16 w-3/4 ml-auto rounded-2xl" />
                <div className="skeleton h-24 w-3/4 mr-auto rounded-2xl" />
                <div className="skeleton h-16 w-2/3 ml-auto rounded-2xl" />
              </div>
            ) : messages.length === 0 ? (
              /* Estado vazio com sugestões */
              <div className="h-full flex flex-col justify-center items-center text-center max-w-lg mx-auto py-8">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-fin-primary mb-4 shadow-xs">
                  <Bot className="h-7 w-7" />
                </span>
                <h3 className="text-base font-semibold">Olá! Como posso ajudar hoje?</h3>
                <p className="text-xs text-fin-muted mt-1 mb-6">
                  Pergunte sobre seus lançamentos, despesas por categoria, contas a pagar ou peça
                  dicas personalizadas de economia.
                </p>

                <div className="w-full space-y-2 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-fin-muted">
                    Sugestões rápidas:
                  </p>
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => void handleSendMessage(prompt)}
                      className="w-full text-left text-xs p-3 rounded-xl border border-fin-border bg-[var(--fin-bg-card)] text-fin-text hover:border-fin-primary/40 hover:bg-indigo-500/10 transition flex items-center justify-between group shadow-2xs"
                    >
                      <span className="line-clamp-1">{prompt}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 text-fin-muted group-hover:text-fin-primary shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Lista de Mensagens */
              messages.map((msg) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-start gap-3 text-sm animate-fade-in',
                      isUser ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    {isUser ? (
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-fin-text text-white text-xs font-bold shrink-0 shadow-xs">
                        {initials}
                      </span>
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-fin-primary text-white shrink-0 shadow-xs">
                        <BrainCircuit className="h-4 w-4" />
                      </span>
                    )}

                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl p-4 shadow-xs leading-relaxed transition-all relative group/msg',
                        isUser
                          ? 'bg-fin-primary text-white rounded-tr-none font-medium whitespace-pre-wrap'
                          : 'bg-[var(--fin-bg-card)] text-fin-text border border-fin-border rounded-tl-none',
                      )}
                    >
                      {isUser ? (
                        <div>{msg.content}</div>
                      ) : msg.content ? (
                        <>
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[11px] text-fin-muted">
                            <span className="font-semibold uppercase tracking-wider text-[10px] text-fin-primary flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Resposta IA
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopyMessage(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 text-fin-muted hover:text-fin-text transition"
                              title="Copiar resposta completa"
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-medium text-[11px]">
                                    Copiado
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                          <MarkdownRenderer
                            content={msg.content}
                            isStreaming={loading && msg === messages[messages.length - 1]}
                          />
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-fin-muted py-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-fin-primary" />
                          Consultando seus dados e formulando resposta...
                        </div>
                      )}

                      {/* Citações / Fontes se houver */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-fin-muted space-y-1">
                          <p className="font-semibold text-[10px] uppercase tracking-wider text-fin-text">
                            Referências consultadas:
                          </p>
                          {msg.citations.map((c, i) => (
                            <div
                              key={i}
                              className="line-clamp-2 italic bg-fin-surface/60 p-1.5 rounded border border-slate-200/50"
                            >
                              &ldquo;{c.excerpt}&rdquo;
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Envio */}
          <form
            onSubmit={onSubmit}
            className="p-3 border-t border-fin-border bg-[var(--fin-bg-card)] flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Pergunte sobre seus gastos, contas, metas ou peça dicas... (Enter para enviar)"
                rows={1}
                className="w-full resize-none rounded-xl border border-fin-border bg-fin-surface/50 px-4 py-3 text-sm text-fin-text focus:border-fin-primary focus:bg-[var(--fin-bg-card)] focus:outline-none transition max-h-32 min-h-[46px]"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary h-[46px] px-4 shrink-0"
              title="Enviar mensagem"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CornerDownLeft className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
