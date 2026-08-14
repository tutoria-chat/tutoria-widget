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
  // Assignments are course-wide — there is no owning module any more.
  course_id: number;
  title: string;
  description?: string | null;
  due_date: string;
  original_file_name: string;
  file_size_bytes: number;
  content_type: string;
  // Daily feedback quota for the verified student (absent in legacy mode)
  feedback_daily_limit?: number;
  feedback_used_today?: number;
  feedback_remaining_today?: number;
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
  const [feedbackTarget, setFeedbackTarget] = useState<Assignment | null>(null);
  const [detailTarget, setDetailTarget] = useState<Assignment | null>(null);
  const [quotaRefresh, setQuotaRefresh] = useState(0);

  const isDefaultModule = activeModuleId === session.default_module_id;
  const moduleIdParam = isDefaultModule ? undefined : activeModuleId;

  useEffect(() => {
    let cancelled = false;
    if (quotaRefresh === 0) setLoading(true);
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
  }, [moduleToken, activeModuleId, moduleIdParam, quotaRefresh]);

  const handleDownload = async (assignment: Assignment) => {
    try {
      const url = await apiClient.getAssignmentDownloadUrl(moduleToken, assignment.id, moduleIdParam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('loadError'));
    }
  };

  const formatDate = (iso?: string | null): string => {
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

  const isPastDue = (iso: string) => new Date(iso).getTime() < Date.now();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Async feedback job card */}
      {job && (
        <div className="mb-4 rounded-xl border bg-card shadow-sm">
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
        <div className="grid gap-4 lg:grid-cols-2">
          {assignments.map((a) => {
            const pastDue = isPastDue(a.due_date);
            const remaining = a.feedback_remaining_today;
            return (
              <button
                key={a.id}
                onClick={() => setDetailTarget(a)}
                className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold transition-colors group-hover:text-primary">
                      {a.title}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      pastDue
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {pastDue ? t('pastDue') : formatDate(a.due_date)}
                  </span>
                </div>

                {a.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  {remaining === 0 ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {t('quotaExhausted', { limit: a.feedback_daily_limit ?? 0 })}
                    </span>
                  ) : remaining !== undefined && a.feedback_daily_limit !== undefined ? (
                    <span className="text-muted-foreground">
                      {t('quotaRemaining', { remaining, limit: a.feedback_daily_limit })}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {t('viewDetails')} →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Assignment detail modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="erwin-fade-up flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">{detailTarget.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isPastDue(detailTarget.due_date)
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-green-500/10 text-green-700 dark:text-green-400'
                  }`}
                >
                  {isPastDue(detailTarget.due_date) ? t('pastDue') : formatDate(detailTarget.due_date)}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  📎 {detailTarget.original_file_name}
                </span>
              </div>

              {detailTarget.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {detailTarget.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">{t('noDescription')}</p>
              )}

              {detailTarget.feedback_remaining_today === 0 ? (
                <p className="rounded-lg bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t('quotaExhausted', { limit: detailTarget.feedback_daily_limit ?? 0 })}
                </p>
              ) : detailTarget.feedback_remaining_today !== undefined &&
                detailTarget.feedback_daily_limit !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  {t('quotaRemaining', {
                    remaining: detailTarget.feedback_remaining_today,
                    limit: detailTarget.feedback_daily_limit,
                  })}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 border-t p-5">
              <Button variant="outline" className="flex-1" onClick={() => handleDownload(detailTarget)}>
                <Download className="mr-2 h-4 w-4" />
                {t('downloadStatement')}
              </Button>
              <Button
                className="flex-1"
                disabled={job?.status === 'processing' || detailTarget.feedback_remaining_today === 0}
                onClick={() => {
                  setFeedbackTarget(detailTarget);
                  setDetailTarget(null);
                }}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                {t('requestFeedback')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {feedbackTarget && (
        <AssignmentFeedbackModal
          moduleToken={moduleToken}
          studentId={String(session.student.id)}
          conversationId={getThread(activeModuleId).conversationId ?? undefined}
          moduleId={moduleIdParam}
          initialAssignment={feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
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
            // Re-fetch so the quota counters reflect the new submission
            setQuotaRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
