/**
 * Assignments panel: list the course's published assignments, download the
 * statement, and request AI feedback on submitted work (no grading).
 *
 * Feedback is generated in the BACKGROUND: the panel shows a processing card
 * (polled by AppContext), the student keeps using the app, and the result is
 * displayed here — with an optional "discuss in chat" handoff.
 */
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { ClipboardList, Download, Loader2, MessageCircle, MessageSquareText, X, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import AssignmentFeedbackModal from '../../components/AssignmentFeedbackModal';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useI18n, useTranslations } from '../../i18n';

interface Assignment {
  id: number;
  module_id: number;
  module_name?: string | null;
  is_own_module: boolean;
  title: string;
  description?: string | null;
  due_date?: string | null;
  original_file_name: string;
}

export default function AssignmentsPanel({ onOpenChat }: { onOpenChat: () => void }) {
  const t = useTranslations('assignments');
  const { locale } = useI18n();
  const {
    moduleToken,
    session,
    activeModuleId,
    getThread,
    updateThread,
    appendMessages,
    feedbackJobs,
    setFeedbackJob,
  } = useApp();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const isDefaultModule = activeModuleId === session.default_module_id;
  const moduleIdParam = isDefaultModule ? undefined : activeModuleId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .getAssignments(moduleToken, moduleIdParam)
      .then((data) => {
        if (!cancelled) setAssignments(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleToken, activeModuleId, moduleIdParam]);

  const handleDownload = async (assignment: Assignment) => {
    try {
      const url = await apiClient.getAssignmentDownloadUrl(moduleToken, assignment.id, moduleIdParam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('loadError'));
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return t('noDueDate');
    try {
      const localeMap = { 'pt-br': 'pt-BR', en: 'en-US', es: 'es-ES' } as const;
      return t('due', {
        date: new Date(iso).toLocaleDateString(localeMap[locale] ?? 'pt-BR', {
          dateStyle: 'short',
        }),
      });
    } catch {
      return iso;
    }
  };

  const job = feedbackJobs[activeModuleId];

  const handleDiscussInChat = () => {
    if (!job?.feedback) return;
    appendMessages(activeModuleId, [{ role: 'assistant', content: job.feedback }]);
    // Adopt the feedback's conversation so chat follow-ups have its context,
    // unless the student already has an ongoing conversation in this module.
    if (!getThread(activeModuleId).conversationId && job.conversationId) {
      updateThread(activeModuleId, { conversationId: job.conversationId });
    }
    setFeedbackJob(activeModuleId, null);
    onOpenChat();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        {t('title')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{t('subtitle')}</p>

      {/* Async feedback job card */}
      {job && (
        <div className="mb-4 rounded-lg border bg-background">
          {job.status === 'processing' ? (
            <div className="flex items-center gap-3 p-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {t('feedbackProcessing', { title: job.assignmentTitle })}
                </p>
                <p className="text-xs text-muted-foreground">{t('feedbackProcessingHint')}</p>
              </div>
            </div>
          ) : job.status === 'failed' ? (
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 min-w-0">
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive truncate">
                  {t('feedbackFailed', { title: job.assignmentTitle })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFeedbackJob(activeModuleId, null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">
                  {t('feedbackReady', { title: job.assignmentTitle })}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setFeedbackJob(activeModuleId, null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-y-auto rounded-md bg-muted/30 p-3">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                >
                  {job.feedback ?? ''}
                </ReactMarkdown>
              </div>
              <Button size="sm" onClick={handleDiscussInChat}>
                <MessageCircle className="w-4 h-4 mr-1" />
                {t('discussInChat')}
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="grid gap-3">
          {assignments.map((a) => (
            <div key={a.id} className="p-4 rounded-md bg-background border space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {a.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(a.due_date)}
                </span>
              </div>
              {!a.is_own_module && a.module_name && (
                <p className="text-xs text-muted-foreground">
                  {t('otherModule', { moduleName: a.module_name })}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => handleDownload(a)}>
                  <Download className="w-4 h-4 mr-1" />
                  {t('downloadStatement')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowFeedbackModal(true)}
                  disabled={job?.status === 'processing'}
                >
                  <MessageSquareText className="w-4 h-4 mr-1" />
                  {t('requestFeedback')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showFeedbackModal && (
        <AssignmentFeedbackModal
          moduleToken={moduleToken}
          studentId={String(session.student.id)}
          conversationId={getThread(activeModuleId).conversationId ?? undefined}
          moduleId={moduleIdParam}
          onClose={() => setShowFeedbackModal(false)}
          onFeedbackReceived={() => {
            /* unused in background mode */
          }}
          onJobStarted={({ submissionId, conversationId: jobConversationId, assignmentTitle }) => {
            setFeedbackJob(activeModuleId, {
              submissionId,
              assignmentTitle,
              status: 'processing',
              conversationId: jobConversationId,
            });
          }}
        />
      )}
    </div>
  );
}
