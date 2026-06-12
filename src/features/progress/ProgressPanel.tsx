/**
 * "Meu Progresso" tab: the student's full academic-progress view —
 * gamification summary, weekly XP evolution chart, this-vs-last-week
 * comparison, per-discipline XP, and personal goals (set/track/remove).
 * Everything reads the gamification ledger; goals are the only stored bit.
 */
import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  apiClient,
  type GamificationData,
  type ProgressEvolution,
  type GoalDto,
} from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';
import { GamificationCard } from '../gamification/GamificationCard';

const GOAL_METRICS = ['level', 'xp', 'streak', 'quizzes', 'questions', 'flashcards'] as const;

export default function ProgressPanel() {
  const t = useTranslations('progress');
  const { activeCourse } = useApp();

  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [evolution, setEvolution] = useState<ProgressEvolution | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newMetric, setNewMetric] = useState<(typeof GOAL_METRICS)[number]>('level');
  const [newTarget, setNewTarget] = useState('10');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [g, e, gl] = await Promise.all([
      apiClient.getGamification(activeCourse?.id).catch(() => null),
      apiClient.getProgressEvolution().catch(() => null),
      apiClient.getGoals().catch(() => null),
    ]);
    if (g) setGamification(g);
    if (e) setEvolution(e);
    if (gl) setGoals(gl.goals);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse?.id]);

  const handleAddGoal = async () => {
    const target = parseInt(newTarget, 10);
    if (!Number.isFinite(target) || target <= 0 || busy) return;
    setBusy(true);
    try {
      await apiClient.createGoal(newMetric, target);
      const gl = await apiClient.getGoals().catch(() => null);
      if (gl) setGoals(gl.goals);
      setAdding(false);
      setNewTarget('10');
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    setGoals((prev) => prev.filter((g) => g.id !== id)); // optimistic
    apiClient.deleteGoal(id).catch(() => reload());
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
          <TrendingUp className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
      </div>

      {gamification && (
        <div className="mt-5">
          <GamificationCard data={gamification} />
        </div>
      )}

      {/* This-week-vs-last-week comparison */}
      {evolution && (
        <section className="mt-6 grid grid-cols-2 gap-3">
          <ComparisonStat
            label={t('xpThisWeek')}
            value={evolution.comparison.this_week.xp}
            delta={evolution.comparison.xp_delta}
          />
          <ComparisonStat
            label={t('activitiesThisWeek')}
            value={evolution.comparison.this_week.activities}
            delta={evolution.comparison.activities_delta}
          />
        </section>
      )}

      {/* Weekly XP evolution chart */}
      {evolution && evolution.weeks.some((w) => w.xp > 0) && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('evolutionTitle')}
          </h3>
          <EvolutionChart weeks={evolution.weeks} emptyLabel={t('noXpYet')} />
        </section>
      )}

      {/* Per-discipline XP */}
      {evolution && evolution.by_course.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('byDisciplineTitle')}
          </h3>
          <div className="space-y-2">
            {evolution.by_course.map((c) => (
              <div key={c.course_id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                <span className="truncate text-sm font-medium">{c.course_name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{c.xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Personal goals */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-4 w-4 text-primary" />
            {t('goalsTitle')}
          </h3>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addGoal')}
            </button>
          )}
        </div>

        {adding && (
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newMetric}
                onChange={(e) => setNewMetric(e.target.value as (typeof GOAL_METRICS)[number])}
                className="flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {GOAL_METRICS.map((m) => (
                  <option key={m} value={m}>{t(`metric.${m}`)}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-24 rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                {t('cancel')}
              </button>
              <button
                onClick={handleAddGoal}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('save')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {goals.length === 0 && !adding && (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              {t('noGoals')}
            </p>
          )}
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.progress / goal.target) * 100));
            return (
              <div
                key={goal.id}
                className={`rounded-xl border p-3 ${goal.completed ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {t(`goalLabel.${goal.metric}`, { target: goal.target })}
                    {goal.course_name ? ` · ${goal.course_name}` : ''}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {goal.completed && (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ {t('done')}</span>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t('removeGoal')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${goal.completed ? 'bg-green-500' : 'bg-gradient-to-r from-[#5e17eb] to-[#5ce1e6]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {goal.progress}/{goal.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ComparisonStat({ label, value, delta }: { label: string; value: number; delta: number }) {
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
      <div className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${
        flat ? 'text-muted-foreground' : up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}>
        {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {up ? '+' : ''}{delta.toLocaleString()}
      </div>
    </div>
  );
}

/** Compact inline SVG bar chart of weekly XP — no chart lib, themes via currentColor. */
function EvolutionChart({ weeks, emptyLabel }: { weeks: ProgressEvolution['weeks']; emptyLabel: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.xp));
  const W = 320;
  const H = 120;
  const pad = 18;
  const barGap = 6;
  const barW = (W - pad * 2 - barGap * (weeks.length - 1)) / weeks.length;

  if (max <= 1) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="weekly XP">
      <defs>
        <linearGradient id="xp-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5ce1e6" />
        </linearGradient>
      </defs>
      {weeks.map((w, i) => {
        const h = Math.round(((H - pad * 2) * w.xp) / max);
        const x = pad + i * (barW + barGap);
        const y = H - pad - h;
        const label = w.week_start.slice(5).replace('-', '/'); // MM/DD
        return (
          <g key={w.week_start}>
            {w.xp > 0 && (
              <rect x={x} y={y} width={barW} height={h} rx={3} fill="url(#xp-bar)">
                <title>{`${label}: ${w.xp} XP`}</title>
              </rect>
            )}
            <text
              x={x + barW / 2}
              y={H - 5}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 8 }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
