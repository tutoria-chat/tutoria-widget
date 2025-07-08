'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/tokyo-night-dark.css';

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
}

export default function ChatForm() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const baseUrl = import.meta.env.PUBLIC_API_BASE_URL;
  
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const suffix = params.get('apiRoute') || 'chat';
  const apiRoute = `${baseUrl}${suffix}`;
  const darkParam = (params.get('dark')) || (import.meta.env.PUBLIC_ENABLE_DARK_MODE ? import.meta.env.PUBLIC_ENABLE_DARK_MODE : 'auto');


  
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
  const applyTheme = (dark: boolean) => {
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  };

  if (darkParam === 'true') {
    applyTheme(true);
  } else if (darkParam === 'false') {
    applyTheme(false);
  } else {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => applyTheme(mq.matches);

    updateTheme();
    mq.addEventListener('change', updateTheme);
    return () => mq.removeEventListener('change', updateTheme);
  }
}, [darkParam]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = { content: message, role: 'user' as const };
    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
    const response = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta da API:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data?.response) {
        console.error('Resposta inválida:', data);
        throw new Error('Resposta inválida do servidor');
    }

    const assistantMessage = { content: data.response, role: 'assistant' as const };
    setMessages((prev) => [...prev, assistantMessage]);

    } catch (error) {
    console.error('Erro no fetch:', error);
    setMessages((prev) => [
        ...prev,
        { content: 'Ocorreu um erro ao processar sua mensagem.', role: 'assistant' },
    ]);
    } finally {
    setIsLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Card className="flex flex-col h-full rounded-none !important">
      <CardHeader className="flex flex-row border-b hidden">
        <img src={isDark ? "/white_blue_horizontal.svg" : "/colored_horizontal.svg"} alt="Logo" className="w-40 h-auto object-contain" />
      </CardHeader>

      <div
        className={`flex flex-col flex-1 overflow-hidden gap-6 ${
          messages.length > 0 ? 'justify-start' : 'justify-end sm:justify-center sm:items-center '
        }`}
      >
        {messages.length === 0 ? (
          <CardContent className="max-sm:flex-1 flex flex-col justify-center items-center text-center">
            <CardTitle className="text-2xl text-foreground">Qual sua dúvida?</CardTitle>
          </CardContent>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 w-full px-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === 'user' ? 'bg-border max-w-[80%]' : 'bg-transparent w-full'
                  }`}
                >
                    <div className={` ${msg.role === 'user' ? 'whitespace-pre-wrap' : 'prose prose-sm dark:prose-invert max-w-none'}`}>
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <CardFooter className="flex flex-col gap-4 sm:max-w-4xl w-full justify-center mx-auto px-6 pb-6 pt-0 border-t-0">
            <form onSubmit={handleSubmit} className="w-full">
            <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte alguma coisa"
                className="w-full resize-none overflow-y-scroll !text-base placeholder:text-base min-h-20 max-h-30 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border"
            />
            <div className="flex flex-row items-center justify-between w-full mt-4">
                <Button
                type="button"
                variant="ghost"
                className="max-w-40 rounded-full flex gap-2 items-center hidden"
                >
                Anexar arquivo
                <Paperclip />
                </Button>
                <div></div>
                <Button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="max-w-40 rounded-full flex gap-2 items-center"
                >
                Enviar
                <SendHorizontal />
                </Button>
            </div>
            </form>
        </CardFooter>
      </div>
    </Card>
  );
}
