/**
 * ENEM / Vestibular practice tab: pick a knowledge area, answer a simulado of
 * ENEM-style multiple-choice questions, then see the score with per-question
 * explanations. Questions come from a global pool generated once per area.
 */
import React, { useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Sparkles, XCircle } from 'lucide-react';
import { apiClient, type EnemArea, type EnemQuestion, type EnemSubmitResult } from '../../lib/api-client';
import { useTranslations } from '../../i18n';

const AREAS: EnemArea[] = ['linguagens', 'matematica', 'natureza', 'humanas'];
const AREA_EMOJI: Record<EnemArea, string> = {
  linguagens: '📖',
  matematica: '➗',
  natureza: '🔬',
  humanas: '🌎',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'pick' | 'loading' | 'generating' | 'quiz' | 'result' | 'error';

export default function EnemPanel() {
  const t = useTranslations('enem');

  const [phase, setPhase] = useState<Phase>('pick');
  const [area, setArea] = useState<EnemArea | null>(null);
  const [questions, setQuestions] = useState<EnemQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<EnemSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pollGenerate = async (a: EnemArea, attempt = 0) => {
    try {
      const res = await apiClient.getEnemQuestions(a, 10);
      if (res.status === 'ready' && res.questions.length > 0) {
        setQuestions(res.questions);
        setAnswers({});
        setResult(null);
        setPhase('quiz');
      } else if (res.status === 'generating' && attempt < 40) {
        setTimeout(() => pollGenerate(a, attempt + 1), 3000);
      } else {
        setPhase('error');
      }
    } catch {
      setPhase('error');
    }
  };

  const pickArea = async (a: EnemArea) => {
    setArea(a);
    setPhase('loading');
    try {
      const res = await apiClient.getEnemQuestions(a, 10);
      if (res.status === 'ready' && res.questions.length > 0) {
        setQuestions(res.questions);
        setAnswers({});
        setResult(null);
        setPhase('quiz');
      } else {
        setPhase('generating');
        await apiClient.generateEnem(a).catch(() => {});
        pollGenerate(a);
      }
    } catch {
      setPhase('error');
    }
  };

  const submit = async () => {
    if (!area || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiClient.submitEnem(
        area,
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

  const reset = () => {
    setPhase('pick');
    setArea(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
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
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Area picker */}
      {phase === 'pick' && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-muted-foreground">{t('pickArea')}</p>
          <div className="grid grid-cols-2 gap-3">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => pickArea(a)}
                className="rounded-2xl border border-border bg-card p-4 text-center transition-all hover:border-primary/40 hover:shadow"
              >
                <p className="text-3xl">{AREA_EMOJI[a]}</p>
                <p className="mt-2 text-sm font-semibold">{t(`area.${a}`)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {(phase === 'loading' || phase === 'generating') && (
        <div className="mt-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">{phase === 'generating' ? t('generatingTitle') : t('loading')}</p>
          {phase === 'generating' && <p className="mt-1 text-xs text-muted-foreground">{t('generatingHint')}</p>}
        </div>
      )}

      {phase === 'error' && (
        <div className="mt-16 text-center">
          <p className="text-sm text-destructive">{t('error')}</p>
          <button onClick={reset} className="mt-4 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
            {t('backToAreas')}
          </button>
        </div>
      )}

      {/* Quiz + result share the same question list; result reveals correctness */}
      {(phase === 'quiz' || phase === 'result') && (
        <div className="mt-6 space-y-5">
          {phase === 'result' && result && (
            <div className="rounded-2xl bg-gradient-to-br from-[#5e17eb]/10 via-transparent to-[#5ce1e6]/10 p-5 text-center ring-1 ring-[#5e17eb]/15">
              <p className="text-sm text-muted-foreground">{area && t(`area.${area}`)}</p>
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
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
                {t('backToAreas')}
              </button>
              <button
                onClick={() => area && pickArea(area)}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t('newSimulado')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
