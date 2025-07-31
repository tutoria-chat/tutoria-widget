'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/tokyo-night-dark.css';

/**
 * Represents a single chat message.
 */
interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * ChatForm component: Manages a markdown-enabled chat interface with auto-scrolling and token authentication.
 */
export default function ChatForm() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const suffix = params.get('apiRoute') || '';
  const darkParam = params.get('dark') ?? import.meta.env.PUBLIC_ENABLE_DARK_MODE ?? 'auto';
  const buttonColor = params.get('buttonColor') || ''
  const isValidHexColor = (color: string): string => {
  const hexRegex = /^[0-9A-Fa-f]{6}$/;
  
  if (typeof color === 'string' && hexRegex.test(color)) {
    return `#${color}`;
  }

  return 'var(--primary)';
};
 

  const [isDark, setIsDark] = useState(false);

  /**
   * Applies dark/light theme based on preferences or URL params.
   */
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

  /**
   * Scrolls the chat to the bottom whenever messages change.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const authTokenRef = useRef<string | null>(null);

  /**
   * Fetches and caches the auth token for API calls.
   * @returns The token string.
   */
  const fetchToken = async (): Promise<string> => {
    if (authTokenRef.current) return authTokenRef.current;

    const response = await fetch('/api/auth', { method: 'POST' });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to obtain token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const token = data?.token;

    if (!token) throw new Error('Token not found in API response.');

    authTokenRef.current = token;
    return token;
  };

  /**
   * Pre-fetch the token when the component mounts.
   */
  useEffect(() => {
    fetchToken().catch((err) => {
      console.error('Authentication pre-fetch failed:', err);
    });
  }, []);

  /**
   * Handles the chat form submission.
   * Sends the user's message to the backend and displays the assistant's response.
   * @param event Form submit event
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = { content: message, role: 'user' as const };
    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenRef.current}`,
        },
        body: JSON.stringify({
          pergunta: message,
          suffix,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data?.response) {
        throw new Error('Invalid response from server.');
      }

      const assistantMessage = { content: data.response, role: 'assistant' as const };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Fetch error:', error);
      setMessages((prev) => [
        ...prev,
        { content: 'Um erro aconteceu ao processar sua mensagem.', role: 'assistant' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles input event and dynamically resizes the textarea.
   * @param e ChangeEvent for the textarea
   */
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  /**
   * Handles Enter key for form submission, Shift+Enter inserts newline.
   * @param e Keyboard event from textarea
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Card className="flex flex-col h-full !rounded-none !border-none">
      <style>
        {`
          .dynamic-color {
            background-color: ${isValidHexColor(buttonColor)};
          }
          .dynamic-color:hover {
            background-color: ${isValidHexColor(buttonColor)};
            opacity: 0.9;
          }
        `}
      </style>

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
          <div className="flex-1 overflow-y-auto space-y-4 w-full px-4 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === 'user' ? 'bg-border max-w-[80%]' : 'bg-transparent w-full'
                  }`}
                >
                    <div className={` ${msg.role === 'user' ? 'whitespace-pre-wrap w-full break-words' : 'prose prose-sm dark:prose-invert max-w-none'}`}>
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
                variant="primary"
                className="dynamic-color max-w-40 rounded-full flex gap-2 items-center"
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
