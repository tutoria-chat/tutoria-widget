/**
 * ENEM / Vestibular practice tab. The course defines the knowledge area, so the
 * student never picks one or presses "generate": the panel auto-loads the
 * course's area, the server auto-provisions the question pool on first open, and
 * we poll until it's ready. Questions come from a global pool per area.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Sparkles, XCircle } from 'lucide-react';
import { apiClient, type EnemArea, type EnemQuestion, type EnemSubmitResult } from '../../lib/api-client';
import { useTranslations } from '../../i18n';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'loading' | 'generating' | 'quiz' | 'result' | 'error' | 'unconfigured' | 'empty';

export default function EnemPanel({ area }: { area: string | null }) {
  const t = useTranslations('enem');

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<EnemQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<EnemSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (attempt = 0) => {
      if (!area) {
        setPhase('unconfigured');
        return;
      }
      try {
        const res = await apiClient.getEnemQuestions(area as EnemArea, 10);
        if (res.status === 'ready' && res.questions.length > 0) {
          setQuestions(res.questions);
          setAnswers({});
          setResult(null);
          setPhase('quiz');
        } else if (res.status === 'generating' && attempt < 40) {
          // If a school opted into AI generation, the server provisions the pool
          // on first open — just keep polling until it's ready.
          setPhase('generating');
          pollTimer.current = setTimeout(() => load(attempt + 1), 3000);
        } else if (res.status === 'none') {
          // Official bank not loaded for this area yet.
          setPhase('empty');
        } else {
          setPhase('error');
        }
      } catch {
        setPhase('error');
      }
    },
    [area],
  );

  // Auto-load the course's area on mount / whenever it changes.
  useEffect(() => {
    setPhase('loading');
    load();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [load]);

  const submit = async () => {
    if (!area || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiClient.submitEnem(
        area as EnemArea,
        Object.entries(answers).map(([qid, idx]) => ({ question_id: Number(qid), selected_index: idx })),
      );
      setResult(res);
      setPhase('result');
    } catch {
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const newSimulado = () => {
    setPhase('loading');
    load();
  };

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);
  const resultById = result
    ? Object.fromEntries(result.results.map((r) => [r.question_id, r]))
    : {};

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">
            {area ? t(`area.${area as EnemArea}`) : t('subtitle')}
          </p>
        </div>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <div className="mt-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">{phase === 'generating' ? t('generatingTitle') : t('loading')}</p>
          {phase === 'generating' && <p className="mt-1 text-xs text-muted-foreground">{t('generatingHint')}</p>}
        </div>
      )}

      {phase === 'unconfigured' && (
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">{t('unconfigured')}</p>
        </div>
      )}

      {phase === 'empty' && (
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">{t('emptyBank')}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="mt-16 text-center">
          <p className="text-sm text-destructive">{t('error')}</p>
          <button onClick={newSimulado} className="mt-4 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
            {t('retry')}
          </button>
        </div>
      )}

      {/* Quiz + result share the same question list; result reveals correctness */}
      {(phase === 'quiz' || phase === 'result') && (
        <div className="mt-6 space-y-5">
          {phase === 'result' && result && (
            <div className="rounded-2xl bg-gradient-to-br from-[#5e17eb]/10 via-transparent to-[#5ce1e6]/10 p-5 text-center ring-1 ring-[#5e17eb]/15">
              <p className="text-sm text-muted-foreground">{area && t(`area.${area as EnemArea}`)}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {result.score}/{result.total}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('scorePct', { pct: result.total > 0 ? Math.round((result.score / result.total) * 100) : 0 })}
              </p>
            </div>
          )}

          {questions.map((q, qi) => {
            const r = resultById[q.id];
            const chosen = answers[q.id];
            return (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                {q.supporting_text && (
                  <p className="mb-2 whitespace-pre-line rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    {q.supporting_text}
                  </p>
                )}
                <p className="text-sm font-medium">
                  <span className="text-primary">{qi + 1}.</span> {q.statement}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const isChosen = chosen === oi;
                    const isCorrect = phase === 'result' && r && oi === r.correct_index;
                    const isWrongChoice = phase === 'result' && isChosen && r && !r.correct;
                    return (
                      <button
                        key={oi}
                        disabled={phase === 'result'}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                          isCorrect
                            ? 'border-green-500/50 bg-green-500/10'
                            : isWrongChoice
                              ? 'border-red-500/50 bg-red-500/10'
                              : isChosen
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCorrect ? 'bg-green-500 text-white' : isWrongChoice ? 'bg-red-500 text-white' : isChosen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {LETTERS[oi]}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
                        {isWrongChoice && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                      </button>
                    );
                  })}
                </div>
                {phase === 'result' && r?.explanation && (
                  <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    💡 {r.explanation}
                  </p>
                )}
              </div>
            );
          })}

          {phase === 'quiz' ? (
            <button
              onClick={submit}
              disabled={!allAnswered || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5e17eb] to-[#7c3aed] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5e17eb]/25 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {allAnswered ? t('finish') : t('answerAll')}
            </button>
          ) : (
            <button
              onClick={newSimulado}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t('newSimulado')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
