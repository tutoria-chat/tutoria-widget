/**
 * Watches for newly-earned titles and celebrates them with a toast + sound.
 *
 * Titles are derived on read, so we detect "just earned" by diffing the current
 * earned set against a per-student baseline in localStorage. The baseline is
 * seeded silently on first run (so a returning student isn't spammed with titles
 * they already had). A re-check fires on mount and whenever a panel signals a
 * gamification change via the `tutoria:gamification` window event (after a chat
 * or quiz), with a short delay to let the server-side award land.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { apiClient, type TitleDto } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations, type Translator } from '../../i18n';
import { titleName } from './TitlesShowcase';
import { playAchievementSound } from '../../lib/achievementSound';
import { burstConfetti } from '../../lib/confetti';

const storageKey = (sid: number | string) => `tutoria-earned-titles-${sid}`;

export default function TitleWatcher() {
  const { session } = useApp();
  const t = useTranslations('titles');
  const tCommon = useTranslations('common');
  const tt = useTranslations() as Translator;
  const studentId = session.student.id;
  const [toasts, setToasts] = useState<TitleDto[]>([]);
  const checking = useRef(false);

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((x) => x.key !== key));
  }, []);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const res = await apiClient.getTitles();
      const earnedKeys = res.titles.filter((x) => x.earned).map((x) => x.key);

      let known: string[] | null = null;
      try {
        known = JSON.parse(localStorage.getItem(storageKey(studentId)) || 'null');
      } catch {
        /* storage unavailable */
      }

      if (known === null) {
        // First run for this student — seed the baseline, don't celebrate the past.
        try { localStorage.setItem(storageKey(studentId), JSON.stringify(earnedKeys)); } catch {}
        return;
      }

      const knownSet = new Set(known);
      const fresh = res.titles.filter((x) => x.earned && !knownSet.has(x.key));
      if (fresh.length > 0) {
        try { localStorage.setItem(storageKey(studentId), JSON.stringify(earnedKeys)); } catch {}
        setToasts((prev) => [...prev, ...fresh]);
        playAchievementSound();
        burstConfetti();
        fresh.forEach((f) => setTimeout(() => dismiss(f.key), 7000));
      }
    } catch {
      /* ignore — try again next signal */
    } finally {
      checking.current = false;
    }
  }, [studentId, dismiss]);

  useEffect(() => {
    check();
    // A panel earned XP — re-check after the award lands (twice, for slow paths).
    const onSignal = () => {
      setTimeout(check, 1500);
      setTimeout(check, 4500);
    };
    window.addEventListener('tutoria:gamification', onSignal);
    return () => window.removeEventListener('tutoria:gamification', onSignal);
  }, [check]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((title) => (
        <div
          key={title.key}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-gradient-to-r from-[#5e17eb] to-[#7c3aed] p-3 text-white shadow-2xl shadow-[#5e17eb]/40 ring-1 ring-white/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/90">{t('unlockedToast')}</p>
            <p className="truncate text-sm font-bold">{titleName(tt, title)}</p>
          </div>
          <button
            onClick={() => dismiss(title.key)}
            className="shrink-0 rounded-md p-1 opacity-80 transition-opacity hover:opacity-100"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
