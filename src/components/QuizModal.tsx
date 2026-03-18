'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, XCircle, Trophy, ArrowRight, Loader2, Brain } from 'lucide-react';

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

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  moduleName: string;
  isLoading: boolean;
  onSendResult?: (summary: string) => void;
}

type QuizState = 'intro' | 'question' | 'feedback' | 'results';

export default function QuizModal({ isOpen, onClose, questions, moduleName, isLoading, onSendResult }: QuizModalProps) {
  const [quizState, setQuizState] = useState<QuizState>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ question: number; selected: string; correct: string; isCorrect: boolean }[]>([]);

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
    }
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    easy: 'Fácil',
    medium: 'Médio',
    hard: 'Difícil',
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
    }
  };

  const handleFinishAndShare = () => {
    const percentage = Math.round((score / totalQuestions) * 100);
    const wrongAnswers = answers.filter((a) => !a.isCorrect);

    let summary: string;

    if (wrongAnswers.length === 0) {
      summary = `Acabei uma avaliação sobre "${moduleName}" e acertei tudo (${score}/${totalQuestions}, ${percentage}%)! Pode me sugerir tópicos avançados para continuar aprendendo?`;
    } else {
      const wrongDetails = wrongAnswers
        .map((ans) => {
          const qIdx = ans.question - 1;
          const question = questions[qIdx];
          const opts = shuffledData[qIdx]?.options ?? [];
          const correctOpt = opts.find((o) => o.displayKey === ans.correct);
          const concepts = question?.concepts_covered?.join(', ') || '';
          return `• "${question?.question_text}"${concepts ? ` (temas: ${concepts})` : ''} — resposta correta: ${ans.correct}. ${correctOpt?.value || ''}`;
        })
        .join('\n');

      summary = `Acabei uma avaliação sobre "${moduleName}". Acertei ${score}/${totalQuestions} (${percentage}%).\n\nErrei ${wrongAnswers.length} questão${wrongAnswers.length > 1 ? 'ões' : ''}:\n${wrongDetails}\n\nPode me ajudar a entender melhor esses pontos e me sugerir como estudá-los?`;
    }

    onSendResult?.(summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto bg-background border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Prática</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
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
              <p className="text-sm text-muted-foreground">Carregando perguntas...</p>
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
                  {totalQuestions === 0 ? 'Exercícios indisponíveis' : 'Teste seus conhecimentos!'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{moduleName}</p>
              </div>
              {totalQuestions > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {totalQuestions} perguntas para testar o que você aprendeu.
                  </p>
                  <Button
                    onClick={() => setQuizState('question')}
                    className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Começar
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Ainda não há perguntas disponíveis para este módulo. As perguntas são geradas automaticamente — tente novamente mais tarde.
                  </p>
                  <Button variant="outline" onClick={onClose} className="mt-2">
                    Fechar
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
                  Pergunta {currentIndex + 1} de {totalQuestions}
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
                Confirmar Resposta
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
                        <span className="font-semibold text-green-600 dark:text-green-400">Correto!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="font-semibold text-red-600 dark:text-red-400">Incorreto</span>
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
                {currentIndex + 1 < totalQuestions ? 'Próxima Pergunta' : 'Ver Resultado'}
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
                  <h2 className="text-xl font-bold">Avaliação Concluída!</h2>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {score}/{totalQuestions}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {Math.round((score / totalQuestions) * 100)}% de acerto
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {score === totalQuestions
                    ? 'Perfeito! Você dominou o conteúdo!'
                    : score >= totalQuestions * 0.7
                    ? 'Ótimo! Você tem um bom entendimento do conteúdo.'
                    : score >= totalQuestions * 0.5
                    ? 'Bom esforço! Há alguns pontos para revisar.'
                    : 'Há pontos importantes para revisar. O tutor pode te ajudar!'}
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
                                Sua resposta: {ans.selected}. {selectedOpt?.value}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400">
                                Resposta correta: {ans.correct}. {correctOpt?.value}
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

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Fechar
                </Button>
                <Button
                  onClick={handleFinishAndShare}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {score === totalQuestions
                    ? 'Continuar estudando'
                    : 'Enviar para o tutor'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
