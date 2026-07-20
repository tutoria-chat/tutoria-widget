'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, XCircle, Trophy, ArrowRight, Loader2, Brain } from 'lucide-react';
import { useTranslations } from '@/i18n';

interface QuizQuestion {
  id: number;
  question_text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options: Record<string, string | null>;
  correct_answer: string;
  explanations: Record<string, string | null>;
  concepts_covered: string[];
}

interface ShuffledOption {
  displayKey: string;   // letter shown to student (A, B, C, …)
  value: string;        // answer text
  originalKey: string;  // original letter from the API (used to look up the explanation)
  explanation: string | null;
}

export interface QuizSubmitAnswer {
  questionNumber: number;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  conceptsCovered: string;
  difficulty: string;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  moduleName: string;
  isLoading: boolean;
  onSendResult?: (summary: string) => void;
  /** Fires once when the quiz finishes — persists the attempt + awards XP. */
  onComplete?: (quizId: number, answers: QuizSubmitAnswer[]) => void;
}

type QuizState = 'intro' | 'question' | 'feedback' | 'results';

export default function QuizModal({ isOpen, onClose, questions, moduleName, isLoading, onSendResult, onComplete }: QuizModalProps) {
  const t = useTranslations('quizModal');
  const tCommon = useTranslations('common');
  const [quizState, setQuizState] = useState<QuizState>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ question: number; selected: string; correct: string; isCorrect: boolean }[]>([]);
  const submittedRef = useRef(false);

  // Pre-compute shuffled options for every question when the question list changes.
  const shuffledData = useMemo(() => {
    const displayKeys = ['A', 'B', 'C', 'D', 'E'];
    return questions.map((q) => {
      const valid = (Object.entries(q.options) as [string, string | null][]).filter(
        ([, v]) => v != null,
      ) as [string, string][];

      // Fisher-Yates shuffle
      const shuffled = [...valid];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const options: ShuffledOption[] = shuffled.map(([originalKey, value], idx) => ({
        displayKey: displayKeys[idx],
        value,
        originalKey,
        explanation: q.explanations[originalKey] ?? null,
      }));

      const correctDisplayKey =
        options.find((o) => o.originalKey === q.correct_answer)?.displayKey ??
        q.correct_answer;

      return { options, correctDisplayKey };
    });
  }, [questions]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuizState('intro');
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setScore(0);
      setAnswers([]);
      submittedRef.current = false;
    }
  }, [isOpen]);

  // Close modal on Escape key — disabled on the results screen, where the
  // student is required to take their result to the tutor (no escape hatch).
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && quizState !== 'results') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, quizState]);

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentIndex + (quizState === 'feedback' ? 1 : 0)) / totalQuestions) * 100 : 0;

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const difficultyLabels: Record<string, string> = {
    easy: t('difficultyEasy'),
    medium: t('difficultyMedium'),
    hard: t('difficultyHard'),
  };

  const handleSelectAnswer = (key: string) => {
    if (quizState !== 'question') return;
    setSelectedAnswer(key);
  };

  const handleConfirm = () => {
    if (!selectedAnswer || !currentQuestion) return;

    const correctDisplayKey = shuffledData[currentIndex]?.correctDisplayKey ?? currentQuestion.correct_answer;
    const isCorrect = selectedAnswer === correctDisplayKey;
    if (isCorrect) setScore((prev) => prev + 1);

    setAnswers((prev) => [
      ...prev,
      {
        question: currentIndex + 1,
        selected: selectedAnswer,
        correct: correctDisplayKey,
        isCorrect,
      },
    ]);
    setQuizState('feedback');
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setQuizState('question');
    } else {
      setQuizState('results');
      // Persist the attempt + award XP, exactly once per run.
      if (!submittedRef.current && onComplete && answers.length > 0) {
        submittedRef.current = true;
        const payload: QuizSubmitAnswer[] = answers.map((ans) => {
          const q = questions[ans.question - 1];
          return {
            questionNumber: ans.question,
            selectedAnswer: ans.selected,
            correctAnswer: ans.correct,
            isCorrect: ans.isCorrect,
            conceptsCovered: (q?.concepts_covered ?? []).join(','),
            difficulty: q?.difficulty ?? 'medium',
          };
        });
        onComplete(questions[0]?.id ?? 0, payload);
      }
    }
  };

  const handleFinishAndShare = () => {
    const percentage = Math.round((score / totalQuestions) * 100);
    const wrongAnswers = answers.filter((a) => !a.isCorrect);
    // Escape $ signs so they don't trigger KaTeX math mode in the chat renderer
    const escapeDollar = (text: string) => text.replace(/\$/g, '＄');

    let summary: string;

    if (wrongAnswers.length === 0) {
      summary = t('sharePerfect', {
        moduleName: escapeDollar(moduleName),
        score,
        total: totalQuestions,
        percent: percentage,
      });
    } else {
      const wrongDetails = wrongAnswers
        .map((ans) => {
          const qIdx = ans.question - 1;
          const question = questions[qIdx];
          const opts = shuffledData[qIdx]?.options ?? [];
          const correctOpt = opts.find((o) => o.displayKey === ans.correct);
          const concepts = question?.concepts_covered?.join(', ') || '';
          const questionText = escapeDollar(question?.question_text ?? '');
          const correctText = escapeDollar(correctOpt?.value ?? '');
          const themes = concepts ? ` (${t('shareThemes', { concepts })})` : '';
          return `• "${questionText}"${themes} — ${t('shareCorrect', { answer: ans.correct })} ${correctText}`;
        })
        .join('\n');

      const header = t('shareHeader', {
        moduleName: escapeDollar(moduleName),
        score,
        total: totalQuestions,
        percent: percentage,
      });
      summary = `${header}\n\n${t('shareWrongCount', { count: wrongAnswers.length })}\n${wrongDetails}\n\n${t('shareAskHelp')}`;
    }

    onSendResult?.(summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — click-to-close is disabled on the results screen so the
          student can't dismiss their result without going to the tutor. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={quizState === 'results' ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto bg-background border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">{t('practice')}</span>
          </div>
          {quizState !== 'results' && (
            <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {quizState !== 'intro' && quizState !== 'results' && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-5">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('loadingQuestions')}</p>
            </div>
          )}

          {/* Intro Screen */}
          {!isLoading && quizState === 'intro' && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {totalQuestions === 0 ? t('unavailableTitle') : t('introTitle')}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{moduleName}</p>
              </div>
              {totalQuestions > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('introCount', { count: totalQuestions })}
                  </p>
                  <Button
                    onClick={() => setQuizState('question')}
                    className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t('start')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('unavailableBody')}
                  </p>
                  <Button variant="outline" onClick={onClose} className="mt-2">
                    {tCommon('close')}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Question Screen */}
          {!isLoading && quizState === 'question' && currentQuestion && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  {t('questionProgress', { current: currentIndex + 1, total: totalQuestions })}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColors[currentQuestion.difficulty]}`}>
                  {difficultyLabels[currentQuestion.difficulty]}
                </span>
              </div>

              <p className="text-sm font-medium leading-relaxed">{currentQuestion.question_text}</p>

              <div className="space-y-2">
                {(shuffledData[currentIndex]?.options ?? []).map(({ displayKey, value }) => (
                  <button
                    key={displayKey}
                    onClick={() => handleSelectAnswer(displayKey)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selectedAnswer === displayKey
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50'
                    }`}
                  >
                    <span className="font-semibold mr-2 text-muted-foreground">{displayKey}.</span>
                    {value}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleConfirm}
                disabled={!selectedAnswer}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('confirm')}
              </Button>
            </div>
          )}

          {/* Feedback Screen */}
          {!isLoading && quizState === 'feedback' && currentQuestion && selectedAnswer && (
            <div className="space-y-4">
              {(() => {
                const correctDisplayKey = shuffledData[currentIndex]?.correctDisplayKey ?? currentQuestion.correct_answer;
                const isAnswerCorrect = selectedAnswer === correctDisplayKey;
                return (
                  <div className="flex items-center gap-2">
                    {isAnswerCorrect ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        <span className="font-semibold text-green-600 dark:text-green-400">{t('correct')}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="font-semibold text-red-600 dark:text-red-400">{t('incorrect')}</span>
                      </>
                    )}
                  </div>
                );
              })()}

              <p className="text-sm text-muted-foreground">{currentQuestion.question_text}</p>

              <div className="space-y-2">
                {(shuffledData[currentIndex]?.options ?? []).map(({ displayKey, value, explanation }) => {
                  const correctDisplayKey = shuffledData[currentIndex]?.correctDisplayKey ?? currentQuestion.correct_answer;
                  const isCorrect = displayKey === correctDisplayKey;
                  const isSelected = displayKey === selectedAnswer;
                  const showExplanation = isCorrect || isSelected;

                  return (
                    <div
                      key={displayKey}
                      className={`px-4 py-3 rounded-lg border text-sm ${
                        isCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : isSelected
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-border opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground">{displayKey}.</span>
                        <span>{value}</span>
                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" />}
                        {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 ml-auto shrink-0" />}
                      </div>
                      {showExplanation && explanation && (
                        <p className="text-xs text-muted-foreground mt-2 pl-5 border-l-2 border-muted ml-1">
                          {explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleNext}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {currentIndex + 1 < totalQuestions ? t('next') : t('seeResults')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Results Screen */}
          {!isLoading && quizState === 'results' && (
            <div className="flex flex-col gap-4">
              {/* Score header */}
              <div className="flex flex-col items-center text-center py-4 gap-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('resultsTitle')}</h2>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {score}/{totalQuestions}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('scorePercent', { percent: Math.round((score / totalQuestions) * 100) })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {score === totalQuestions
                    ? t('resultPerfect')
                    : score >= totalQuestions * 0.7
                    ? t('resultGreat')
                    : score >= totalQuestions * 0.5
                    ? t('resultOk')
                    : t('resultReview')}
                </p>
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {answers.map((ans, i) => {
                  const qIdx = ans.question - 1;
                  const question = questions[qIdx];
                  const opts = shuffledData[qIdx]?.options ?? [];
                  const correctOpt = opts.find((o) => o.displayKey === ans.correct);
                  const selectedOpt = opts.find((o) => o.displayKey === ans.selected);

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 text-sm ${
                        ans.isCorrect
                          ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10'
                          : 'border-red-500/30 bg-red-50/50 dark:bg-red-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {ans.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-medium leading-snug">{question?.question_text}</p>

                          {!ans.isCorrect && (
                            <>
                              <p className="text-xs text-red-600 dark:text-red-400">
                                {t('yourAnswer', { answer: `${ans.selected}. ${selectedOpt?.value ?? ''}` })}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400">
                                {t('correctAnswer', { answer: `${ans.correct}. ${correctOpt?.value ?? ''}` })}
                              </p>
                              {correctOpt?.explanation && (
                                <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2 mt-1">
                                  {correctOpt.explanation}
                                </p>
                              )}
                            </>
                          )}

                          {question?.concepts_covered?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {question.concepts_covered.map((c, ci) => (
                                <span
                                  key={ci}
                                  className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action button — the only way out of the results screen is to
                  take the result to the tutor. Close/cancel is intentionally
                  removed so the student always follows up with the tutor. */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleFinishAndShare}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {score === totalQuestions ? t('continueStudying') : t('sendToTutor')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
