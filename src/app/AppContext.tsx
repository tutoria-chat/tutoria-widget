/**
 * Companion app state: widget session, active module, per-module conversations.
 *
 * Threading model (WhatsApp-style): each module has its OWN conversation.
 * Switching modules swaps the visible thread; switching back restores it.
 * The backend additionally rejects any conversation_id used under a different
 * module, so context can never bleed across courses.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  type SessionContext,
  type SessionCourse,
  type SessionModule,
  type WidgetSession,
} from '../lib/api-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
}

interface ModuleThread {
  conversationId: string | null;
  messages: ChatMessage[];
}

/** Async assignment-feedback request, one per module at a time. */
export interface FeedbackJob {
  submissionId: number;
  assignmentTitle: string;
  status: 'processing' | 'completed' | 'failed';
  feedback?: string;
  conversationId?: string;
}

interface AppContextValue {
  moduleToken: string;
  session: WidgetSession;
  context: SessionContext;
  activeModuleId: number;
  activeModule: SessionModule | null;
  activeCourse: SessionCourse | null;
  switchModule: (moduleId: number) => void;
  getThread: (moduleId: number) => ModuleThread;
  updateThread: (moduleId: number, update: Partial<ModuleThread>) => void;
  appendMessages: (moduleId: number, messages: ChatMessage[]) => void;
  setMessages: (moduleId: number, updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  feedbackJobs: Record<number, FeedbackJob>;
  setFeedbackJob: (moduleId: number, job: FeedbackJob | null) => void;
  refreshContext: () => Promise<void>;
  endSession: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_THREAD: ModuleThread = { conversationId: null, messages: [] };

function conversationStorageKey(universityId: number, studentId: number): string {
  return `tutoria-conversations-${universityId}-${studentId}`;
}

/** Persisted map moduleId -> conversationId so a refresh re-attaches threads. */
function loadConversationMap(universityId: number, studentId: number): Record<number, string> {
  try {
    const raw = sessionStorage.getItem(conversationStorageKey(universityId, studentId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConversationMap(universityId: number, studentId: number, map: Record<number, string>) {
  try {
    sessionStorage.setItem(conversationStorageKey(universityId, studentId), JSON.stringify(map));
  } catch {
    /* sessionStorage unavailable in some embedded contexts — threads just reset on refresh */
  }
}

export function AppProvider({
  moduleToken,
  session,
  initialContext,
  onSessionEnded,
  children,
}: {
  moduleToken: string;
  session: WidgetSession;
  initialContext: SessionContext;
  onSessionEnded: () => void;
  children: React.ReactNode;
}) {
  const [context, setContext] = useState<SessionContext>(initialContext);
  const [activeModuleId, setActiveModuleId] = useState<number>(
    initialContext.default_module_id || session.default_module_id
  );
  const [threads, setThreads] = useState<Record<number, ModuleThread>>(() => {
    const conversationMap = loadConversationMap(session.university_id, session.student.id);
    const initial: Record<number, ModuleThread> = {};
    for (const [moduleId, conversationId] of Object.entries(conversationMap)) {
      initial[Number(moduleId)] = { conversationId, messages: [] };
    }
    return initial;
  });

  const allModules = useMemo(
    () => context.courses.flatMap((c) => c.modules.map((m) => ({ course: c, module: m }))),
    [context.courses]
  );

  const activeEntry = allModules.find((e) => e.module.id === activeModuleId) ?? null;

  const switchModule = useCallback((moduleId: number) => {
    setActiveModuleId(moduleId);
  }, []);

  const getThread = useCallback(
    (moduleId: number) => threads[moduleId] ?? EMPTY_THREAD,
    [threads]
  );

  const updateThread = useCallback(
    (moduleId: number, update: Partial<ModuleThread>) => {
      setThreads((prev) => {
        const current = prev[moduleId] ?? EMPTY_THREAD;
        const next = { ...current, ...update };
        const result = { ...prev, [moduleId]: next };
        if (update.conversationId !== undefined) {
          const map: Record<number, string> = {};
          for (const [id, thread] of Object.entries(result)) {
            if (thread.conversationId) map[Number(id)] = thread.conversationId;
          }
          saveConversationMap(session.university_id, session.student.id, map);
        }
        return result;
      });
    },
    [session.university_id, session.student.id]
  );

  const appendMessages = useCallback(
    (moduleId: number, messages: ChatMessage[]) => {
      setThreads((prev) => {
        const current = prev[moduleId] ?? EMPTY_THREAD;
        return { ...prev, [moduleId]: { ...current, messages: [...current.messages, ...messages] } };
      });
    },
    []
  );

  const setMessages = useCallback(
    (moduleId: number, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setThreads((prev) => {
        const current = prev[moduleId] ?? EMPTY_THREAD;
        return { ...prev, [moduleId]: { ...current, messages: updater(current.messages) } };
      });
    },
    []
  );

  // ── Async assignment feedback jobs ─────────────────────────────────────────
  const [feedbackJobs, setFeedbackJobs] = useState<Record<number, FeedbackJob>>({});

  const setFeedbackJob = useCallback((moduleId: number, job: FeedbackJob | null) => {
    setFeedbackJobs((prev) => {
      const next = { ...prev };
      if (job) next[moduleId] = job;
      else delete next[moduleId];
      return next;
    });
  }, []);

  // Poll processing jobs at context level so generation continues to be tracked
  // while the student switches panels or modules.
  useEffect(() => {
    const processing = Object.entries(feedbackJobs).filter(([, j]) => j.status === 'processing');
    if (processing.length === 0) return;

    const interval = setInterval(async () => {
      for (const [moduleIdStr, job] of processing) {
        try {
          const result = await apiClient.getSubmissionFeedback(moduleToken, job.submissionId);
          if (result.status === 'completed') {
            setFeedbackJob(Number(moduleIdStr), {
              ...job,
              status: 'completed',
              feedback: result.feedback ?? '',
            });
          } else if (result.status === 'failed') {
            setFeedbackJob(Number(moduleIdStr), { ...job, status: 'failed' });
          }
        } catch {
          /* transient polling error — keep trying on the next tick */
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [feedbackJobs, moduleToken, setFeedbackJob]);

  const refreshContext = useCallback(async () => {
    const fresh = await apiClient.getSessionContext(moduleToken);
    setContext(fresh);
  }, [moduleToken]);

  const value = useMemo<AppContextValue>(
    () => ({
      moduleToken,
      session,
      context,
      activeModuleId,
      activeModule: activeEntry?.module ?? null,
      activeCourse: activeEntry?.course ?? null,
      switchModule,
      getThread,
      updateThread,
      appendMessages,
      setMessages,
      feedbackJobs,
      setFeedbackJob,
      refreshContext,
      endSession: onSessionEnded,
    }),
    [
      moduleToken,
      session,
      context,
      activeModuleId,
      activeEntry,
      switchModule,
      getThread,
      updateThread,
      appendMessages,
      setMessages,
      feedbackJobs,
      setFeedbackJob,
      refreshContext,
      onSessionEnded,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
