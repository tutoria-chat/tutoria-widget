/**
 * Quizzes panel: pick a difficulty and practice, reusing the existing QuizModal.
 */
import React, { useEffect, useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import QuizModal from '../../components/QuizModal';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';

type Difficulty = 'easy' | 'medium' | 'hard';

export default function QuizzesPanel({ onOpenChat }: { onOpenChat: () => void }) {
  const t = useTranslations('quizzes');
  const { moduleToken, session, activeModuleId, activeModule, setChatDraft } = useApp();

  const [availableDifficulties, setAvailableDifficulties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isDefaultModule = activeModuleId === session.default_module_id;
  const moduleIdParam = isDefaultModule ? undefined : activeModuleId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAvailableDifficulties([]);

    apiClient
      .getQuizzes({ moduleToken, count: 0, moduleId: moduleIdParam })
      .then((data) => {
        if (!cancelled) setAvailableDifficulties(data.available_difficulties || []);
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

  const startQuiz = async (difficulty?: Difficulty) => {
    setQuizLoading(true);
    setShowModal(true);
    setQuizQuestions([]);
    try {
      const data = await apiClient.getQuizzes({
        moduleToken,
        difficulty,
        count: 5,
        moduleId: moduleIdParam,
      });
      setQuizQuestions(data.quizzes || []);
    } catch {
      setShowModal(false);
      setError(t('loadError'));
    } finally {
      setQuizLoading(false);
    }
  };

  const difficultyLabel: Record<string, string> = {
    easy: t('difficultyEasy'),
    medium: t('difficultyMedium'),
    hard: t('difficultyHard'),
  };

  const difficultyEmoji: Record<string, string> = { easy: '🌱', medium: '⚡', hard: '🔥' };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('subtitle', { moduleName: activeModule?.name ?? '' })}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : availableDifficulties.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-muted-foreground">{t('difficulty')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {availableDifficulties.map((d) => (
              <button
                key={d}
                onClick={() => startQuiz(d as Difficulty)}
                className="group rounded-2xl border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <span className="text-3xl">{difficultyEmoji[d] ?? '🎯'}</span>
                <p className="mt-2 text-base font-semibold transition-colors group-hover:text-primary">
                  {difficultyLabel[d] ?? d}
                </p>
              </button>
            ))}
          </div>
          {availableDifficulties.length > 1 && (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => startQuiz()}>
              <Brain className="mr-2 h-4 w-4" />
              {t('start')}
            </Button>
          )}
        </div>
      )}

      <QuizModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        questions={quizQuestions}
        moduleName={activeModule?.name ?? 'Quiz'}
        isLoading={quizLoading}
        onSendResult={(summary) => {
          // Stage the result as a ready-to-send chat draft and jump to chat
          setChatDraft(activeModuleId, summary);
          setShowModal(false);
          onOpenChat();
        }}
      />
    </div>
  );
}
