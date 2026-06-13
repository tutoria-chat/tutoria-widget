/**
 * Chat panel for the companion widget.
 *
 * One conversation per module (WhatsApp model): the thread shown here belongs
 * to the active module; switching modules swaps threads via AppContext.
 */
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { History, Loader2, SendHorizontal, Sparkles, SquarePen, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useI18n, useTranslations } from '../../i18n';

interface ConversationSummary {
  conversation_id: string;
  preview: string;
  last_message_at: number;
  message_count: number;
}

interface ChatPanelProps {
  streaming: boolean;
}

export default function ChatPanel({ streaming }: ChatPanelProps) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const {
    moduleToken,
    session,
    activeModuleId,
    activeModule,
    getThread,
    updateThread,
    appendMessages,
    setMessages,
    consumeChatDraft,
    endSession,
  } = useApp();

  const { locale } = useI18n();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Flipped when the server can't stream (e.g. 501) — we fall back permanently
  const [streamingDisabled, setStreamingDisabled] = useState(false);

  // Past conversations (90-day window)
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const thread = getThread(activeModuleId);
  const isDefaultModule = activeModuleId === session.default_module_id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length, activeModuleId]);

  // Drafts staged by other panels (e.g. quiz result summaries) land in the
  // input ready to send — the student just hits Enter.
  useEffect(() => {
    const draft = consumeChatDraft(activeModuleId);
    if (draft) {
      setInput(draft);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
          el.focus();
        }
      });
    }
  }, [activeModuleId, consumeChatDraft]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || isLoading) return;

    const moduleId = activeModuleId;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    appendMessages(moduleId, [{ role: 'user', content: message }]);

    const params = {
      moduleToken,
      message,
      conversationId: getThread(moduleId).conversationId,
      // module_id only needs to be sent when targeting a non-default module
      moduleId: isDefaultModule ? null : moduleId,
    };

    try {
      if (streaming && !streamingDisabled) {
        appendMessages(moduleId, [{ role: 'assistant', content: '', isThinking: true }]);
        let accumulated = '';

        try {
          for await (const event of apiClient.sendChatMessageStream(params)) {
            if (event.type === 'chunk' && event.content) {
              accumulated += event.content;
              const text = accumulated;
              setMessages(moduleId, (prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: text };
                return next;
              });
            } else if (event.type === 'formatted' && event.content) {
              accumulated = event.content;
              const text = accumulated;
              setMessages(moduleId, (prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: text };
                return next;
              });
            } else if (event.type === 'done') {
              if (event.conversationId) {
                updateThread(moduleId, { conversationId: event.conversationId });
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'stream error');
            }
          }
        } catch (streamErr: any) {
          // Streaming unavailable (e.g. disabled server-side) and nothing
          // rendered yet: fall back to the non-streaming endpoint transparently.
          const msg: string = streamErr?.message || '';
          const streamingUnavailable = msg.includes('501') || msg.toLowerCase().includes('streaming is not enabled');
          if (!accumulated && streamingUnavailable) {
            setStreamingDisabled(true);
            const data = await apiClient.sendChatMessage(params);
            setMessages(moduleId, (prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: data.response };
              return next;
            });
            if (data.conversation_id) {
              updateThread(moduleId, { conversationId: data.conversation_id });
            }
            return;
          }
          throw streamErr;
        }

        // If nothing streamed, surface a generic error instead of an empty bubble
        if (!accumulated) {
          setMessages(moduleId, (prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: t('errorGeneric') };
            return next;
          });
        }
      } else {
        const data = await apiClient.sendChatMessage(params);
        appendMessages(moduleId, [{ role: 'assistant', content: data.response }]);
        if (data.conversation_id) {
          updateThread(moduleId, { conversationId: data.conversation_id });
        }
      }
    } catch (err: any) {
      const message: string = err?.message || '';
      let friendly = t('errorGeneric');
      if (message.includes('SESSION_EXPIRED') || message.includes('401')) {
        friendly = t('errorSession');
        endSession();
      } else if (message.includes('429') || message.toLowerCase().includes('too many')) {
        friendly = t('errorRateLimit');
      }
      setMessages(moduleId, (prev) => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].isThinking) {
          next[next.length - 1] = { role: 'assistant', content: friendly };
          return next;
        }
        return [...next, { role: 'assistant', content: friendly }];
      });
    } finally {
      setIsLoading(false);
      // Nudge the title watcher — a question may have unlocked XP / a title.
      try { window.dispatchEvent(new Event('tutoria:gamification')); } catch { /* SSR */ }
    }
  };

  const openHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const data = await apiClient.getConversations(
        moduleToken,
        isDefaultModule ? undefined : activeModuleId
      );
      setHistory(data.conversations);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreConversation = async (conversationId: string) => {
    setRestoringId(conversationId);
    try {
      const data = await apiClient.getConversationMessages(moduleToken, conversationId);
      updateThread(activeModuleId, { conversationId });
      setMessages(activeModuleId, () => data.messages);
      setShowHistory(false);
    } catch {
      /* keep the panel open; the row simply stops spinning */
    } finally {
      setRestoringId(null);
    }
  };

  const startNewChat = () => {
    updateThread(activeModuleId, { conversationId: null });
    setMessages(activeModuleId, () => []);
    setShowHistory(false);
  };

  const formatHistoryDate = (ms: number) => {
    try {
      const localeMap = { 'pt-br': 'pt-BR', en: 'en-US', es: 'es-ES' } as const;
      return new Date(ms).toLocaleString(localeMap[locale] ?? 'pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const moduleName = activeModule?.name ?? '';

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Chat toolbar: history + new chat */}
      <div className="flex items-center justify-end gap-1 px-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={openHistory}
          title={t('historyTitle')}
          className="text-muted-foreground hover:text-foreground"
        >
          <History className="w-4 h-4 mr-1" />
          <span className="text-xs">{t('historyTitle')}</span>
        </Button>
        {(thread.messages.length > 0 || thread.conversationId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewChat}
            title={t('newChat')}
            className="text-muted-foreground hover:text-foreground"
          >
            <SquarePen className="w-4 h-4 mr-1" />
            <span className="text-xs">{t('newChat')}</span>
          </Button>
        )}
      </div>

      {/* History overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              {t('historyTitle')}
            </p>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {historyLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t('historyEmpty')}
              </p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={startNewChat}
                  className="w-full text-left p-3 rounded-lg border border-dashed text-sm text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
                >
                  <SquarePen className="w-4 h-4" />
                  {t('newChat')}
                </button>
                {history.map((conv) => (
                  <button
                    key={conv.conversation_id}
                    onClick={() => restoreConversation(conv.conversation_id)}
                    disabled={restoringId !== null}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-colors hover:border-primary hover:bg-muted/50 ${
                      conv.conversation_id === thread.conversationId ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <p className="font-medium line-clamp-2">{conv.preview || t('historyUntitled')}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {restoringId === conv.conversation_id && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {formatHistoryDate(conv.last_message_at)} · {t('historyMessages', { count: conv.message_count })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {thread.messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] shadow-xl shadow-[#5e17eb]/30">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('emptyTitle', { moduleName })}
          </h2>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-md">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 w-full px-4 py-4 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border">
          {thread.messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'dynamic-user-message-color max-w-[80%]'
                    : 'dynamic-agent-message-color w-full'
                }`}
              >
                {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.15s]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.3s]"></div>
                    </div>
                    <span className="text-sm">{t('thinking')}</span>
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap w-full break-words text-sm">{msg.content}</div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeHighlight]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !streaming && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.3s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="w-full px-4 pb-4 pt-2 sm:max-w-4xl mx-auto">
        <form onSubmit={handleSend} className="w-full">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            className="w-full resize-none overflow-y-auto !text-base placeholder:text-base min-h-20 max-h-40 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border"
          />
          <div className="flex flex-row items-center justify-end w-full mt-3">
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="dynamic-button-color max-w-40 rounded-full flex gap-2 items-center"
            >
              {tCommon('send')}
              <SendHorizontal />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
