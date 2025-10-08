'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, SendHorizontal, FileText, Download } from 'lucide-react';
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
 * Represents module information from the API.
 */
interface ModuleInfo {
  module_name: string;
  module_description: string;
  semester: number;
  year: number;
  permissions: {
    allow_chat: boolean;
    allow_file_access: boolean;
  };
}

/**
 * Represents a file available for download.
 */
interface FileInfo {
  id: number;
  name: string;
  file_type: string;
  download_url: string;
}

/**
 * ChatForm component: Manages a markdown-enabled chat interface with auto-scrolling and token authentication.
 */
export default function ChatForm() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const moduleToken = params.get('module_token') || '';
  const studentId = params.get('student_id') || '';
  const darkParam = params.get('dark') ?? import.meta.env.PUBLIC_ENABLE_DARK_MODE ?? 'auto';
  const buttonColor = params.get('buttonColor') || ''
  const userMessageColor = params.get('userMessageColor') || ''
  const agentMessageColor = params.get('agentMessageColor') || ''

  const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8000';

  /**
   * Validates a hex color string.
   * @param color Hex code string without '#'
   * @param fallbackColor Fallback css class color
   * @returns The color prefixed with '#', if not a valid hex color returns a fallback color.
   */
  const isValidHexColor = (color: string, fallbackColor: string): string => {
    const hexRegex = /^[0-9A-Fa-f]{6}$/;
    
    if (typeof color === 'string' && hexRegex.test(color)) {
      return `#${color}`;
    }

    return fallbackColor;
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

  /**
   * Fetches module information from the API.
   */
  const fetchModuleInfo = async () => {
    if (!moduleToken) {
      console.error('No module token provided');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/info?module_token=${moduleToken}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch module info: ${response.status} - ${errorText}`);
      }

      const moduleData = await response.json();
      setModuleInfo(moduleData);
    } catch (error) {
      console.error('Failed to fetch module info:', error);
    }
  };

  /**
   * Fetches available files for the module.
   */
  const fetchFiles = async () => {
    if (!moduleToken || !moduleInfo?.permissions.allow_file_access) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/files?module_token=${moduleToken}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch files: ${response.status} - ${errorText}`);
      }

      const filesData = await response.json();
      setFiles(filesData);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  /**
   * Fetch module info and files when the component mounts.
   */
  useEffect(() => {
    fetchModuleInfo();
  }, [moduleToken]);

  useEffect(() => {
    if (moduleInfo) {
      fetchFiles();
    }
  }, [moduleInfo]);

  /**
   * Handles the chat form submission.
   * Sends the user's message to the backend and displays the assistant's response.
   * @param event Form submit event
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isLoading || !moduleToken) return;

    // Check if chat is allowed
    if (!moduleInfo?.permissions.allow_chat) {
      setMessages((prev) => [
        ...prev,
        { content: 'Chat não está habilitado para este módulo.', role: 'assistant' },
      ]);
      return;
    }

    const userMessage = { content: message, role: 'user' as const };
    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/chat?module_token=${moduleToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          student_id: studentId,
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
          .dynamic-button-color {
            background-color: ${isValidHexColor(buttonColor, 'var(--primary)')};
          }
          .dynamic-button-color:hover {
            background-color: ${isValidHexColor(buttonColor, 'var(--primary)')};
            opacity: 0.9;
          }
          .dynamic-agent-message-color {
            background-color: ${isValidHexColor(agentMessageColor, 'var(--accent)')};
          }
          .dynamic-agent-message-color:hover {
            background-color: ${isValidHexColor(agentMessageColor, 'var(--accent)')};
            opacity: 0.9;
          }
          .dynamic-user-message-color {
            background-color: ${isValidHexColor(userMessageColor, 'var(--border)')};
          }
          .dynamic-user-message-color:hover {
            background-color: ${isValidHexColor(userMessageColor, 'var(--border)')};
            opacity: 0.9;
          }
        `}
      </style>

      <CardHeader className="flex flex-row items-center justify-between border-b">
        <div className="flex flex-col gap-1">
          {moduleInfo ? (
            <>
              <CardTitle className="text-lg">{moduleInfo.module_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {moduleInfo.semester}º Semestre, {moduleInfo.year}
              </p>
            </>
          ) : (
            <CardTitle className="text-lg">Carregando módulo...</CardTitle>
          )}
        </div>
        {moduleInfo?.permissions.allow_file_access && files.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Arquivos ({files.length})
          </Button>
        )}
      </CardHeader>

      {/* Files Panel */}
      {showFiles && (
        <div className="border-b bg-muted/50 p-4">
          <h3 className="font-medium mb-3">Arquivos Disponíveis</h3>
          <div className="grid gap-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 rounded-md bg-background border">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{file.file_type}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0"
                >
                  <a href={`${apiBaseUrl}/api/widget/files/${file.id}/download?module_token=${moduleToken}`} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`flex flex-col flex-1 overflow-hidden gap-6 ${
          messages.length > 0 ? 'justify-start' : 'justify-end sm:justify-center sm:items-center '
        }`}
      >
        {!moduleToken ? (
          <CardContent className="max-sm:flex-1 flex flex-col justify-center items-center text-center">
            <CardTitle className="text-2xl text-foreground">Token de módulo necessário</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Este widget precisa de um token de módulo válido para funcionar. Verifique se a URL contém o parâmetro <code>module_token</code>.
            </p>
          </CardContent>
        ) : messages.length === 0 ? (
          <CardContent className="max-sm:flex-1 flex flex-col justify-center items-center text-center">
            <CardTitle className="text-2xl text-foreground">
              {moduleInfo ? `Qual sua dúvida sobre ${moduleInfo.module_name}?` : 'Qual sua dúvida?'}
            </CardTitle>
            {moduleInfo && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {moduleInfo.module_description}
              </p>
            )}
          </CardContent>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 w-full px-4 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === 'user' ? 'dynamic-user-message-color max-w-[80%]' : 'dynamic-agent-message-color w-full'
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
                disabled={isLoading || !message.trim() || !moduleInfo?.permissions.allow_chat}
                variant="primary"
                className="dynamic-button-color max-w-40 rounded-full flex gap-2 items-center"
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
