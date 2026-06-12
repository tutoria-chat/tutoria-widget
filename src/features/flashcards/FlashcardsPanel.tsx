/**
 * Flashcards panel: study the module's AI-generated deck (built once from the
 * module's content, shared by all students). Click to flip, arrows to move.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { apiClient, type FlashcardDto } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';

type DeckStatus = 'loading' | 'ready' | 'generating' | 'none' | 'error';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  hard: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export default function FlashcardsPanel() {
  const t = useTranslations('flashcards');
  const { moduleToken, session, activeModuleId } = useApp();

  const [status, setStatus] = useState<DeckStatus>('loading');
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviewReported = useRef(false);

  const isDefault = activeModuleId === session.default_module_id;
  const moduleParam = isDefault ? undefined : activeModuleId;

  // Award XP the first time the student reaches the end of a deck this session
  // (server-side daily cap prevents farming). Fire-and-forget.
  useEffect(() => {
    if (status === 'ready' && cards.length > 0 && index >= cards.length - 1 && !reviewReported.current) {
      reviewReported.current = true;
      apiClient.reportFlashcardsReviewed(moduleToken, moduleParam).catch(() => {});
    }
  }, [status, index, cards.length, moduleToken, moduleParam]);

  const load = useCallback(async () => {
    try {
      const result = await apiClient.getFlashcards(moduleToken, moduleParam, 15);
      setCards(result.cards);
      setIndex(0);
      setFlipped(false);
      setStatus(result.status === 'ready' ? 'ready' : result.status);
      return result.status;
    } catch {
      setStatus('error');
      return 'error';
    }
  }, [moduleToken, moduleParam]);

  useEffect(() => {
    setStatus('loading');
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Poll while the deck is being generated (~10-30s, once per module ever)
  useEffect(() => {
    if (status !== 'generating') {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const next = await load();
      if (next !== 'generating' || attempts > 40) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        if (next === 'generating') setStatus('none');
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, load]);

  const handleGenerate = async () => {
    setStatus('generating');
    try {
      await apiClient.generateFlashcards(moduleToken, moduleParam);
    } catch {
      setStatus('error');
    }
  };

  const card = cards[index];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}

        {status === 'none' && (
          <div className="max-w-sm text-center">
            <p className="text-sm text-muted-foreground">{t('emptyText')}</p>
            <button
              onClick={handleGenerate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5e17eb] to-[#7c3aed] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5e17eb]/25 transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              {t('generateButton')}
            </button>
          </div>
        )}

        {status === 'generating' && (
          <div className="max-w-sm text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium">{t('generatingTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('generatingHint')}</p>
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-destructive">{t('loadError')}</p>
        )}

        {status === 'ready' && card && (
          <div className="w-full max-w-md">
            {/* Card */}
            <button
              onClick={() => setFlipped((f) => !f)}
              className="group relative block min-h-[260px] w-full rounded-2xl border border-border bg-card p-6 text-left shadow-lg transition-transform hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  {flipped ? t('backLabel') : t('frontLabel')}
                </span>
                <span className="flex items-center gap-1.5">
                  {card.concept && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {card.concept}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      DIFFICULTY_COLORS[card.difficulty] || DIFFICULTY_COLORS.medium
                    }`}
                  >
                    {t(`difficulty.${card.difficulty}` as any) || card.difficulty}
                  </span>
                </span>
              </div>

              <p
                className={`mt-5 leading-relaxed ${
                  flipped ? 'text-base text-foreground' : 'text-lg font-semibold text-foreground'
                }`}
              >
                {flipped ? card.back : card.front}
              </p>

              <p className="absolute bottom-4 left-6 right-6 flex items-center gap-1.5 text-xs text-muted-foreground opacity-70">
                <RotateCcw className="h-3 w-3" />
                {t('flipHint')}
              </p>
            </button>

            {/* Navigation */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
                disabled={index === 0}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted disabled:opacity-40"
                aria-label={t('previous')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-muted-foreground">
                {index + 1} / {cards.length}
              </span>
              <button
                onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
                disabled={index >= cards.length - 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted disabled:opacity-40"
                aria-label={t('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {index >= cards.length - 1 && (
              <button
                onClick={() => load()}
                className="mt-3 w-full rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t('newRound')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
