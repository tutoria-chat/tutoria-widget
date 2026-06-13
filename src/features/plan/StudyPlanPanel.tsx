/**
 * Study plan panel: generate (1× per course per week) and view this week's
 * AI study plan. Style + free-text preferences personalize the plan; the plan
 * is also emailed, with an optional daily-morning reminder.
 */
import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarCheck,
  Loader2,
  Sparkles,
  Target,
} from 'lucide-react';
import { apiClient, type StudyPlanDto } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations, useI18n } from '../../i18n';

const STYLES = ['light', 'balanced', 'intensive'] as const;

export default function StudyPlanPanel() {
  const t = useTranslations('plan');
  const { locale } = useI18n();
  const { activeCourse } = useApp();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlanDto | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [style, setStyle] = useState<(typeof STYLES)[number]>('balanced');
  const [preferences, setPreferences] = useState('');
  const [dailyReminder, setDailyReminder] = useState(true);
  const [togglingReminder, setTogglingReminder] = useState(false);

  const courseId = activeCourse?.id;

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setPlan(null);
    apiClient
      .getStudyPlans(courseId)
      .then((result) => {
        if (!cancelled) setPlan(result.plans[0] ?? null);
      })
      .catch(() => { /* treated as no plan yet */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  const handleGenerate = async () => {
    if (!courseId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const newPlan = await apiClient.createStudyPlan({
        course_id: courseId,
        style,
        preferences: preferences.trim() || undefined,
        daily_reminder: dailyReminder,
        language: locale,
      });
      setPlan(newPlan);
    } catch (err: any) {
      const message: string = err?.message || '';
      setError(message === 'QUOTA_REACHED' || message.includes('já gerou') ? t('quotaReached') : t('generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleReminder = async () => {
    if (!plan || togglingReminder) return;
    setTogglingReminder(true);
    const next = !plan.daily_reminder_opt_in;
    try {
      await apiClient.updatePlanReminder(plan.id, next);
      setPlan({ ...plan, daily_reminder_opt_in: next });
    } catch { /* keep previous state */ } finally {
      setTogglingReminder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          {activeCourse && <p className="text-xs text-muted-foreground">{activeCourse.name}</p>}
        </div>
      </div>

      {!plan ? (
        /* ── Generation form ── */
        <div className="mt-6 max-w-lg space-y-5">
          <p className="text-sm text-muted-foreground">{t('intro')}</p>

          <div>
            <p className="mb-2 text-sm font-medium">{t('styleLabel')}</p>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`rounded-xl border px-3 py-3 text-center transition-all ${
                    style === s
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <p className="text-lg">{s === 'light' ? '🌱' : s === 'balanced' ? '⚖️' : '🔥'}</p>
                  <p className="mt-1 text-sm font-medium">{t(`style.${s}`)}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {t(`styleHint.${s}`)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('preferencesLabel')}</p>
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder={t('preferencesPlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5">
            <input
              type="checkbox"
              checked={dailyReminder}
              onChange={(e) => setDailyReminder(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#5e17eb]"
            />
            <span>
              <span className="block text-sm font-medium">{t('reminderLabel')}</span>
              <span className="block text-xs text-muted-foreground">{t('reminderHint')}</span>
            </span>
          </label>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5e17eb] to-[#7c3aed] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5e17eb]/25 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('generateButton')}
              </>
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground">{t('quotaNote')}</p>
        </div>
      ) : (
        /* ── Plan view ── */
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#5e17eb]/10 via-transparent to-[#5ce1e6]/10 p-4 ring-1 ring-[#5e17eb]/15">
            <p className="text-sm leading-relaxed">{plan.overview}</p>
          </div>

          {plan.weak_concepts.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold">{t('weakConceptsTitle')}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.weak_concepts.map((c) => (
                  <span
                    key={c.concept}
                    className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                  >
                    {c.concept} · {c.success_rate}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleToggleReminder}
            disabled={togglingReminder}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              plan.daily_reminder_opt_in
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-card hover:border-primary/30'
            }`}
          >
            {plan.daily_reminder_opt_in ? (
              <Bell className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1">
              {plan.daily_reminder_opt_in ? t('reminderOn') : t('reminderOff')}
            </span>
            {togglingReminder && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </button>

          <div className="space-y-3">
            {plan.days.map((day) => (
              <div key={day.date} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#0e7490] dark:text-[#5ce1e6]">
                  {day.date}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{day.title}</p>
                {day.focus && <p className="text-xs text-muted-foreground">{day.focus}</p>}
                <ul className="mt-2 space-y-1.5">
                  {day.tasks.length === 0 ? (
                    <li className="text-sm text-muted-foreground">{t('restDay')}</li>
                  ) : (
                    day.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5ce1e6]" />
                        <span>
                          {task.description}
                          {task.duration_min ? (
                            <span className="text-muted-foreground"> · {task.duration_min} min</span>
                          ) : null}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">{t('nextPlanNote')}</p>
        </div>
      )}
    </div>
  );
}
