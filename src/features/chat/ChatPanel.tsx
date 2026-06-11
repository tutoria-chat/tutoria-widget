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
import { SendHorizontal } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';

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

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      if (streaming) {
        appendMessages(moduleId, [{ role: 'assistant', content: '', isThinking: true }]);
        let accumulated = '';

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
    <div className="flex flex-col h-full overflow-hidden">
      {thread.messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <h2 className="text-2xl font-semibold text-foreground">
            {t('emptyTitle', { moduleName })}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">{t('emptySubtitle')}</p>
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
