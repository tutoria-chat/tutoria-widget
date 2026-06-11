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

export default function QuizzesPanel() {
  const t = useTranslations('quizzes');
  const { moduleToken, session, activeModuleId, activeModule } = useApp();

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

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <Brain className="w-5 h-5" />
        {t('title')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        {t('subtitle', { moduleName: activeModule?.name ?? '' })}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : availableDifficulties.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="space-y-4 max-w-md">
          <p className="text-sm font-medium">{t('difficulty')}</p>
          <div className="flex flex-wrap gap-2">
            {availableDifficulties.map((d) => (
              <Button
                key={d}
                variant="outline"
                onClick={() => startQuiz(d as Difficulty)}
              >
                {difficultyLabel[d] ?? d}
              </Button>
            ))}
            {availableDifficulties.length > 1 && (
              <Button onClick={() => startQuiz()}>{t('start')}</Button>
            )}
          </div>
        </div>
      )}

      <QuizModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        questions={quizQuestions}
        moduleName={activeModule?.name ?? 'Quiz'}
        isLoading={quizLoading}
      />
    </div>
  );
}
