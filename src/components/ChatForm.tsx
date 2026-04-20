'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal, FileText, Download, Brain, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/tokyo-night-dark.css';
import { WidgetAPIClient } from '@/lib/api-client';
import QuizModal from '@/components/QuizModal';
import VerificationGate from '@/components/VerificationGate';
import ConsentGate from '@/components/ConsentGate';
import AssignmentFeedbackModal from '@/components/AssignmentFeedbackModal';

/**
 * Represents a single chat message.
 */
interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  isThinking?: boolean;
}

/**
 * Represents module information from the API.
 */
interface ModuleInfo {
  module_name: string;
  module_description: string;
  semester: number;
  year: number;
  has_assignments?: boolean;
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
export default function ChatForm({ apiBaseUrl: apiBaseUrlProp }: { apiBaseUrl?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null); // Track conversation ID
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Message history for arrow key navigation (console-like behavior)
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [currentDraft, setCurrentDraft] = useState<string>(''); // Save current typing when browsing history

  // Module load error state
  const [moduleLoadError, setModuleLoadError] = useState(false);
  const [moduleUnavailable, setModuleUnavailable] = useState(false); // true when soft-deleted

  // Quiz state
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  const [availableDifficulties, setAvailableDifficulties] = useState<string[]>([]);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);

  // Verification gate state
  const [verifiedStudentId, setVerifiedStudentId] = useState<number | null>(null);
  const [verifiedStudentName, setVerifiedStudentName] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string | undefined>(undefined);
  const [verificationPassed, setVerificationPassed] = useState<boolean>(false);

  // Consent gate state (LGPD compliance)
  const [consentPassed, setConsentPassed] = useState<boolean>(false);

  // Assignment feedback modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Only access window on the client side
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const moduleToken = params.get('module_token') || '';
  const professorAgentToken = params.get('professor_agent_token') || '';
  const studentId = params.get('student_id') || '';

  // UP Business mode parameters
  const upId = params.get('up_id') || '';
  const upApiKey = params.get('up_api_key') || '';
  const teamName = params.get('team_name') || '';

  // Auth token for professor/admin JWT bypass of enrollment gating
  const authToken = params.get('auth_token') || '';

  const darkParam = params.get('dark') ?? import.meta.env.PUBLIC_ENABLE_DARK_MODE ?? 'auto';
  const buttonColor = params.get('buttonColor') || ''
  const userMessageColor = params.get('userMessageColor') || ''
  const agentMessageColor = params.get('agentMessageColor') || ''

  // Check if streaming is enabled (via URL param or env variable)
  const enableStreaming = params.get('streaming') === 'true' || import.meta.env.PUBLIC_ENABLE_STREAMING === 'true';

  // Use prop from server-side or fallback to default
  const apiBaseUrl = apiBaseUrlProp || 'https://tutoria-api-dev.orangesmoke-8addc8f4.eastus2.azurecontainerapps.io';
  // Create API client instance with the correct base URL
  const apiClient = useMemo(() => new WidgetAPIClient(apiBaseUrl), [apiBaseUrl]);

  // Determine widget mode
  const isProfessorMode = !!professorAgentToken;
  const isUpBusinessMode = !!upApiKey;

  // Determine the effective student ID to send with chat requests.
  // If verification provided a student ID, use that. Otherwise fall back to URL param.
  const effectiveStudentId = verifiedStudentId && verifiedStudentId > 0
    ? String(verifiedStudentId)
    : studentId;

  // Whether verification gate is needed (only for student module mode, skip if professor auth_token present)
  const needsVerificationGate = moduleToken && !isProfessorMode && !isUpBusinessMode && !verificationPassed && !authToken;

  /**
   * Called when VerificationGate completes (either no verification needed or student verified).
   */
  const handleVerified = (sid: number, sname: string, vtoken?: string) => {
    setVerifiedStudentId(sid);
    setVerifiedStudentName(sname);
    setVerificationToken(vtoken);
    setVerificationPassed(true);
  };

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
  }, [messages, showQuizPrompt]);

  /**
   * Fetches module information from the API with automatic retry.
   */
  const fetchModuleInfo = async () => {
    if (!moduleToken) {
      console.error('No module token provided');
      return;
    }

    try {
      const moduleData = await apiClient.getModuleInfo(moduleToken);
      setModuleInfo(moduleData);
    } catch (error) {
      console.error('Failed to fetch module info:', error);
      setModuleLoadError(true);
      // Show a specific message when the module has been removed
      const isUnavailable = error instanceof Error && error.message === 'MODULE_NOT_AVAILABLE';
      if (isUnavailable) setModuleUnavailable(true);
      setMessages((prev) => [
        ...prev,
        {
          content: isUnavailable
            ? '🚫 Este módulo não está mais disponível. Entre em contato com o seu professor.'
            : `⚠️ Não foi possível carregar as informações do módulo. ${error instanceof Error ? error.message : 'Atualize a página e tente novamente.'}`,
          role: 'assistant',
        },
      ]);
    }
  };

  /**
   * Fetches available files for the module with automatic retry.
   */
  const fetchFiles = async () => {
    if (!moduleToken || !moduleInfo?.permissions.allow_file_access) {
      return;
    }

    try {
      const filesData = await apiClient.getModuleFiles(moduleToken);
      setFiles(filesData);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      // Files are optional, so we don't show error to user
    }
  };

  /**
   * Detects if a message indicates the user wants a quiz/challenge.
   */
  const detectQuizIntent = (text: string): boolean => {
    const quizKeywords = [
      'quiz', 'quizz', 'teste', 'prova', 'exercício', 'exercicio',
      'desafio', 'challenge', 'question', 'perguntas', 'pergunta',
      'avaliação', 'avaliacao', 'testar', 'me testa', 'me teste',
      'prática', 'pratica', 'treinar', 'treino', 'questões', 'questoes',
      'flashcard', 'simulado', 'quero praticar', 'quero treinar',
      'me desafie', 'me desafia', 'questions', 'practice',
    ];
    const lower = text.toLowerCase();
    return quizKeywords.some((kw) => lower.includes(kw));
  };

  /**
   * Loads quiz questions from the API and opens the modal.
   */
  const startQuiz = async (difficulty?: 'easy' | 'medium' | 'hard') => {
    setShowQuizPrompt(false);
    setQuizLoading(true);
    setShowQuizModal(true);

    try {
      const data = await apiClient.getQuizzes({
        moduleToken,
        difficulty,
        count: 5,
      });
      setQuizQuestions(data.quizzes);
    } catch (error) {
      console.error('Failed to load quiz:', error);
      setQuizQuestions([]);
    } finally {
      setQuizLoading(false);
    }
  };

  /**
   * Handles sharing quiz result back into the chat.
   */
  const handleQuizResult = (summary: string) => {
    setMessages((prev) => [...prev, { content: summary, role: 'user' }]);
  };

  /**
   * Fetch module info and files when the component mounts.
   * Skip if in UP Business mode (no module needed).
   */
  useEffect(() => {
    if (!isUpBusinessMode && !isProfessorMode) {
      fetchModuleInfo();
    }
  }, [moduleToken, isUpBusinessMode, isProfessorMode]);

  useEffect(() => {
    if (moduleInfo) {
      fetchFiles();
    }
  }, [moduleInfo]);

  /**
   * Handles the chat form submission with robust error handling and retry logic.
   * Sends the user's message to the backend and displays the assistant's response.
   * @param event Form submit event
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isLoading) return;

    // Check if we have authentication (moduleToken OR professorAgentToken OR upApiKey)
    if (!moduleToken && !professorAgentToken && !upApiKey) return;

    // Check if chat is allowed (only for student mode with module)
    if (!isProfessorMode && !isUpBusinessMode && !moduleInfo?.permissions.allow_chat) {
      setMessages((prev) => [
        ...prev,
        { content: 'Chat não está habilitado para este módulo.', role: 'assistant' },
      ]);
      return;
    }

    // Dismiss quiz prompt if visible
    setShowQuizPrompt(false);

    // Add to message history for arrow key navigation
    setMessageHistory((prev) => [...prev, message.trim()]);
    setHistoryIndex(-1);
    setCurrentDraft('');

    const userMessage = { content: message, role: 'user' as const };
    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');

    // Check if the user wants a quiz before sending to AI
    if (!isUpBusinessMode && !isProfessorMode && moduleToken && detectQuizIntent(currentMessage)) {
      try {
        const data = await apiClient.getQuizzes({ moduleToken, count: 0 });
        if (data.available_difficulties.length === 0) {
          // No questions configured — let the student know via a bot message
          setMessages((prev) => [
            ...prev,
            {
              content:
                'Desculpe, as perguntas de prática ainda não foram configuradas para este módulo. 😕',
              role: 'assistant' as const,
            },
          ]);
        } else {
          setAvailableDifficulties(data.available_difficulties);
          setShowQuizPrompt(true);
        }
      } catch {
        // On error fall back to showing all difficulties
        setAvailableDifficulties(['easy', 'medium', 'hard']);
        setShowQuizPrompt(true);
      }
      return;
    }

    setIsLoading(true);

    try {
      // Use streaming if enabled and in student module mode
      if (enableStreaming && !isUpBusinessMode && !isProfessorMode) {
        // Create placeholder assistant message with thinking state
        const assistantMessageIndex = messages.length + 1;
        setMessages((prev) => [...prev, { content: '', role: 'assistant' as const, isThinking: true }]);

        let fullResponse = '';
        let receivedConversationId: string | undefined;

        try {
          const streamGenerator = apiClient.sendChatMessageStream({
            moduleToken,
            message: currentMessage,
            studentId: effectiveStudentId,
            conversationId,
            verificationToken,
            authToken: authToken || undefined,
          });

          for await (const event of streamGenerator) {
            if (event.type === 'connected') {
              console.log('[Streaming] Connected to server');
            } else if (event.type === 'chunk' && event.content) {
              fullResponse += event.content;
              // Update the assistant message with accumulated content, clear thinking state
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  content: fullResponse,
                  role: 'assistant',
                  isThinking: false,
                };
                return newMessages;
              });
            } else if (event.type === 'done') {
              console.log('[Streaming] Stream completed');
              if (event.conversationId) {
                receivedConversationId = event.conversationId;
              }
            } else if (event.type === 'error') {
              console.error('[Streaming] Error:', event.error);
              throw new Error(event.error || 'Streaming error occurred');
            }
          }

          // Store conversation_id from stream
          if (receivedConversationId) {
            setConversationId(receivedConversationId);
            console.log('Conversation ID:', receivedConversationId);
          }

          // If stream completed but no content was received, show a fallback message
          if (!fullResponse.trim()) {
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                content: 'Não foi possível gerar uma resposta. Por favor, tente novamente.',
                role: 'assistant',
                isThinking: false,
              };
              return newMessages;
            });
          }
        } catch (streamError) {
          // If streaming fails, remove placeholder and show error
          setMessages((prev) => prev.slice(0, -1));
          throw streamError;
        }
      } else {
        // Use regular non-streaming API
        let data;
        if (isUpBusinessMode) {
          // UP Business mode
          data = await apiClient.sendUpBusinessChatMessage({
            upApiKey,
            message: currentMessage,
            upId: upId || undefined,
            teamName: teamName || undefined,
            conversationId,
          });
        } else if (isProfessorMode) {
          // Professor mode
          data = await apiClient.sendProfessorChatMessage({
            professorAgentToken,
            message: currentMessage,
            conversationId,
          });
        } else {
          // Student module mode (non-streaming)
          data = await apiClient.sendChatMessage({
            moduleToken,
            message: currentMessage,
            studentId: effectiveStudentId,
            conversationId,
            verificationToken,
            authToken: authToken || undefined,
          });
        }

        // Store conversation_id from response for conversation threading
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
          console.log('Conversation ID:', data.conversation_id);
        }

        const assistantMessage = { content: data.response, role: 'assistant' as const };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);

      // User-friendly error message based on error type and mode
      let errorMessage = isUpBusinessMode
        ? 'An error occurred while processing your message.'
        : isProfessorMode
        ? 'An error occurred while processing your message.'
        : 'Um erro aconteceu ao processar sua mensagem.';

      if (error instanceof Error) {
        // Use error message from API client if available
        if (error.message.includes('Network error')) {
          errorMessage = isUpBusinessMode || isProfessorMode
            ? '🔌 Network error. Please check your internet connection.'
            : '🔌 Erro de rede. Por favor, verifique sua conexão com a internet.';
        } else if (error.message.includes('timed out')) {
          errorMessage = isUpBusinessMode || isProfessorMode
            ? '⏱️ Request timed out. The server is taking too long to respond. Please try again.'
            : '⏱️ Tempo esgotado. O servidor está demorando muito para responder. Tente novamente.';
        } else if (error.message.includes('Verification expired')) {
          // Verification token (HMAC) expired or student not verified — clear cached verification
          // and silently re-show the gate. Do NOT append a chat message: the gate overlay
          // makes the situation clear and "Sua verificação expirou" is confusing for first-time users.
          if (!isProfessorMode && !isUpBusinessMode && moduleToken) {
            try {
              sessionStorage.removeItem(`tutoria-verified-${moduleToken}`);
            } catch { /* ignore */ }
            setVerificationPassed(false);
            setVerificationToken(undefined);
            setVerifiedStudentId(null);
            setVerifiedStudentName('');
            return; // gate will re-render; no chat message needed
          } else {
            errorMessage = '🔑 Your access token has expired. Please refresh the page.';
          }
        } else if (error.message.includes('Invalid or expired')) {
          errorMessage = isUpBusinessMode
            ? '🔑 Your UP Business API key is invalid or expired. Please contact support.'
            : isProfessorMode
            ? '🔑 Your access token has expired. Please refresh the page.'
            : '🔑 Seu token de acesso expirou. Por favor, atualize a página.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = isUpBusinessMode || isProfessorMode
            ? '🚦 Too many requests. Please wait a moment before trying again.'
            : '🚦 Muitas solicitações. Aguarde um momento antes de tentar novamente.';
        } else {
          // Don't expose raw API errors to students — show generic message
          console.error('Unhandled chat error:', error.message);
        }
      }

      setMessages((prev) => [
        ...prev,
        { content: errorMessage, role: 'assistant' },
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
   * Handles keyboard navigation: Arrow keys for history, Enter for submission.
   * @param e Keyboard event from textarea
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ArrowUp - go to older messages
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (messageHistory.length === 0) return;

      // Save current draft on first up arrow press
      if (historyIndex === -1) {
        setCurrentDraft(message);
      }

      const newIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
      setHistoryIndex(newIndex);
      setMessage(messageHistory[messageHistory.length - 1 - newIndex]);
      return;
    }

    // ArrowDown - go to newer messages
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      const newIndex = historyIndex - 1;
      if (newIndex === -1) {
        // Restore draft
        setMessage(currentDraft);
        setHistoryIndex(-1);
        setCurrentDraft('');
      } else {
        setHistoryIndex(newIndex);
        setMessage(messageHistory[messageHistory.length - 1 - newIndex]);
      }
      return;
    }

    // Enter key - submit form
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Show verification gate if needed (student module mode, not yet verified)
  if (needsVerificationGate) {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none">
        <VerificationGate
          moduleToken={moduleToken}
          apiBaseUrl={apiBaseUrl}
          onVerified={handleVerified}
        />
      </Card>
    );
  }

  // Show consent gate after verification (LGPD compliance)
  // Only for student module mode, after verification has passed, if consent not yet given
  const needsConsentGate = moduleToken && !isProfessorMode && !isUpBusinessMode && !authToken
    && verificationPassed && !consentPassed
    && verifiedStudentId !== null && verifiedStudentId > 0;

  if (needsConsentGate) {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none">
        <ConsentGate
          moduleToken={moduleToken}
          apiBaseUrl={apiBaseUrl}
          studentId={verifiedStudentId!}
          onConsented={() => setConsentPassed(true)}
        />
      </Card>
    );
  }

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
          {isUpBusinessMode ? (
            <>
              <CardTitle className="text-lg">UP Business Game</CardTitle>
              <p className="text-sm text-muted-foreground">
                {teamName || (upId ? `Team ${upId}` : 'AI Tutor')}
              </p>
            </>
          ) : isProfessorMode ? (
            <>
              <CardTitle className="text-lg">Agente do Professor</CardTitle>
              <p className="text-sm text-muted-foreground">Modo de teste</p>
            </>
          ) : moduleInfo ? (
            <>
              <CardTitle className="text-lg">{moduleInfo.module_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {verifiedStudentName
                  ? `${verifiedStudentName} - ${moduleInfo.semester}º Semestre, ${moduleInfo.year}`
                  : `${moduleInfo.semester}º Semestre, ${moduleInfo.year}`}
              </p>
            </>
          ) : moduleLoadError ? (
            <CardTitle className="text-lg text-destructive">
              {moduleUnavailable ? 'Módulo indisponível' : 'Erro ao carregar módulo'}
            </CardTitle>
          ) : (
            <CardTitle className="text-lg">Carregando módulo...</CardTitle>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isUpBusinessMode && moduleInfo?.permissions.allow_file_access && files.length > 0 && (
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
          {!isUpBusinessMode && moduleInfo?.has_assignments && verifiedStudentId && verifiedStudentId > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssignmentModal(true)}
              className="flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Atividades
            </Button>
          )}
        </div>
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
        {!moduleToken && !upApiKey && !professorAgentToken ? (
          <CardContent className="max-sm:flex-1 flex flex-col justify-center items-center text-center">
            <CardTitle className="text-2xl text-foreground">Autenticação necessária</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Este widget requer um <code>module_token</code> ou <code>up_api_key</code> para funcionar.
            </p>
          </CardContent>
        ) : messages.length === 0 ? (
          <CardContent className="max-sm:flex-1 flex flex-col justify-center items-center text-center">
            <CardTitle className="text-2xl text-foreground">
              {isUpBusinessMode
                ? 'How can I help you with the UP Business Game?'
                : isProfessorMode
                ? 'Como posso ajudar?'
                : moduleInfo
                ? `Qual sua dúvida sobre ${moduleInfo.module_name}?`
                : 'Qual sua dúvida?'}
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
                    {msg.isThinking ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.15s]"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.3s]"></div>
                        </div>
                        <span className="text-sm">Pensando...</span>
                      </div>
                    ) : (
                      <div className={` ${msg.role === 'user' ? 'whitespace-pre-wrap w-full break-words' : 'prose prose-sm dark:prose-invert max-w-none'}`}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
                              {msg.content}
                          </ReactMarkdown>
                      </div>
                    )}
                </div>
              </div>
            ))}
            {isLoading && !messages.some(m => m.isThinking) && (
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

            {/* Quiz prompt - appears when quiz intent is detected */}
            {showQuizPrompt && (
              <div className="flex justify-start">
                <div className="dynamic-agent-message-color rounded-lg px-4 py-4 w-full space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">Quer praticar?</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Posso testar seus conhecimentos com perguntas sobre o conteúdo do módulo!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableDifficulties.map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant="outline"
                        onClick={() => startQuiz(d as 'easy' | 'medium' | 'hard')}
                        className="text-xs"
                      >
                        {{ easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }[d] ?? d}
                      </Button>
                    ))}
                    {availableDifficulties.length > 1 && (
                      <Button
                        size="sm"
                        onClick={() => startQuiz()}
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Misto
                      </Button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowQuizPrompt(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Não, continuar no chat
                  </button>
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
                placeholder={isUpBusinessMode ? 'Type your question...' : 'Pergunte alguma coisa...'}

                className="w-full resize-none overflow-y-scroll !text-base placeholder:text-base min-h-20 max-h-30 scrollbar scrollbar-w-2 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-border"
            />
            <div className="flex flex-row items-center justify-end w-full mt-4">
                <Button
                type="submit"
                disabled={isLoading || !message.trim() || (!isProfessorMode && !isUpBusinessMode && !moduleInfo?.permissions.allow_chat)}
                variant="primary"
                className="dynamic-button-color max-w-40 rounded-full flex gap-2 items-center"
                >
                {isUpBusinessMode ? 'Send' : 'Enviar'}
                <SendHorizontal />
                </Button>
            </div>
            </form>
        </CardFooter>
      </div>

      {/* Quiz Modal */}
      <QuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        questions={quizQuestions}
        moduleName={moduleInfo?.module_name || 'Quiz'}
        isLoading={quizLoading}
        onSendResult={handleQuizResult}
      />

      {showAssignmentModal && (
        <AssignmentFeedbackModal
          moduleToken={moduleToken}
          verificationToken={verificationToken}
          studentId={verifiedStudentId ? String(verifiedStudentId) : undefined}
          conversationId={conversationId ?? undefined}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setShowAssignmentModal(false)}
          onFeedbackReceived={(response, newConversationId) => {
            setMessages(prev => [
              ...prev,
              { role: 'assistant', content: response },
            ]);
            if (newConversationId) setConversationId(newConversationId);
          }}
        />
      )}
    </Card>
  );
}
