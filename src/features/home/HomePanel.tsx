/**
 * Home panel: the student's day at a glance — today's study tasks across
 * courses, this week's plans, recent quiz results and quick actions.
 */
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  CalendarClock,
  FileText,
  Layers,
  Loader2,
  MapPin,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { UpcomingEvent, GamificationData, LeaderboardData } from '../../lib/api-client';
import { apiClient, type HomeData } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';
import type { PanelKey } from '../../app/Shell';
import { GamificationCard, Leaderboard } from '../gamification/GamificationCard';

interface HomePanelProps {
  onNavigate: (panel: PanelKey) => void;
}

export default function HomePanel({ onNavigate }: HomePanelProps) {
  const t = useTranslations('home');
  const { session, activeCourse } = useApp();
  const [data, setData] = useState<HomeData | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHome()
      .then((home) => { if (!cancelled) setData(home); })
      .catch(() => { /* home is best-effort; sections degrade gracefully */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Gamification card + leaderboard load independently (never block Home)
    apiClient.getGamification(activeCourse?.id)
      .then((g) => { if (!cancelled) setGamification(g); })
      .catch(() => {});
    if (activeCourse?.id) {
      apiClient.getLeaderboard(activeCourse.id, 10)
        .then((l) => { if (!cancelled) setLeaderboard(l); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [activeCourse?.id]);

  const firstName = session.student.first_name?.trim() || '';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayTasks = data?.today_tasks ?? [];
  const recentQuizzes = data?.recent_quizzes ?? [];
  const weekPlans = data?.week_plans ?? [];
  const upcomingEvents = data?.upcoming_events ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-[#5e17eb]/10 via-transparent to-[#5ce1e6]/10 p-5 ring-1 ring-[#5e17eb]/15">
        <h2 className="text-xl font-bold text-foreground">
          {firstName ? t('welcome', { name: firstName }) : t('welcomeAnonymous')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Gamification: level / XP / tier / streak / badges / title */}
      {gamification && (
        <div className="mt-5">
          <GamificationCard data={gamification} />
        </div>
      )}

      {/* Upcoming events strip: next test / deadline / field event */}
      {upcomingEvents.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('upcomingTitle')}
            </h3>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {upcomingEvents.map((event) => (
              <EventChip key={event.id} event={event} label={whenLabel(event.days_until, t)} />
            ))}
          </div>
        </section>
      )}

      {/* Today's plan */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('todayTitle')}
          </h3>
        </div>

        {todayTasks.length === 0 ? (
          <button
            onClick={() => onNavigate('plan')}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-left transition-colors hover:bg-primary/10"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{t('noPlanTitle')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('noPlanSubtitle')}</p>
            </div>
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            {todayTasks.map((day) => (
              <div
                key={day.plan_id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  {day.course_name}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{day.title}</p>
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
        )}
      </section>

      {/* Recent quizzes */}
      {recentQuizzes.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('recentQuizzesTitle')}
            </h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {recentQuizzes.map((quiz, i) => {
              const rate = quiz.total > 0 ? Math.round((quiz.correct / quiz.total) * 100) : 0;
              return (
                <div
                  key={`${quiz.quiz_id}-${i}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {t('quizScore', { correct: quiz.correct, total: quiz.total })}
                    </p>
                    <p className="text-xs text-muted-foreground">{quiz.date}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      rate >= 70
                        ? 'text-green-600 dark:text-green-400'
                        : rate >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Course leaderboard */}
      {leaderboard && leaderboard.entries.length > 0 && (
        <section className="mt-6">
          <Leaderboard data={leaderboard} />
        </section>
      )}

      {/* Quick actions */}
      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('quickActionsTitle')}
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <QuickAction
            icon={<MessageCircle className="h-5 w-5" />}
            label={t('actionChat')}
            onClick={() => onNavigate('chat')}
          />
          <QuickAction
            icon={<CalendarCheck className="h-5 w-5" />}
            label={weekPlans.length > 0 ? t('actionViewPlan') : t('actionCreatePlan')}
            onClick={() => onNavigate('plan')}
          />
          <QuickAction
            icon={<Layers className="h-5 w-5" />}
            label={t('actionFlashcards')}
            onClick={() => onNavigate('flashcards')}
          />
        </div>
      </section>
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  test: <FileText className="h-4 w-4" />,
  assignment: <CalendarCheck className="h-4 w-4" />,
  field_event: <MapPin className="h-4 w-4" />,
  holiday: <Sparkles className="h-4 w-4" />,
};

function whenLabel(daysUntil: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (daysUntil <= 0) return t('eventToday');
  if (daysUntil === 1) return t('eventTomorrow');
  return t('eventInDays', { days: daysUntil });
}

function EventChip({ event, label }: { event: UpcomingEvent; label: string }) {
  const urgent = event.days_until <= 2;
  return (
    <div
      className={`flex min-w-[180px] shrink-0 flex-col gap-1 rounded-xl border p-3 ${
        urgent
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-1.5 text-primary">
        {EVENT_ICONS[event.event_type] ?? <CalendarClock className="h-4 w-4" />}
        <span className={`text-[11px] font-bold uppercase tracking-wide ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          {label}
        </span>
      </div>
      <p className="truncate text-sm font-semibold text-foreground" title={event.title}>
        {event.title}
      </p>
      <p className="truncate text-xs text-muted-foreground">{event.course_name}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:shadow"
    >
      <span className="text-primary">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
