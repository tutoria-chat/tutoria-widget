/**
 * Gamification UI: progress card (level/XP/tier/streak + title), badge row and
 * course leaderboard. All read-only views over the backend ledger — they take
 * already-fetched data as props so the Home panel controls loading.
 */
import React from 'react';
import { Flame, Trophy, Crown } from 'lucide-react';
import type { GamificationData, LeaderboardData } from '../../lib/api-client';
import { useTranslations } from '../../i18n';

// FFXIV Crystalline-Conflict-style tiers → gradient + emblem.
export const TIER_STYLE: Record<string, { gradient: string; emoji: string }> = {
  bronze: { gradient: 'from-[#a16207] to-[#d97706]', emoji: '🥉' },
  silver: { gradient: 'from-[#64748b] to-[#94a3b8]', emoji: '🥈' },
  gold: { gradient: 'from-[#ca8a04] to-[#facc15]', emoji: '🥇' },
  platinum: { gradient: 'from-[#0e7490] to-[#22d3ee]', emoji: '💠' },
  diamond: { gradient: 'from-[#1d4ed8] to-[#60a5fa]', emoji: '💎' },
  crystal: { gradient: 'from-[#7c3aed] to-[#e879f9]', emoji: '🔮' },
};

export const BADGE_EMOJI: Record<string, string> = {
  first_steps: '👣',
  curious_10: '🤔',
  curious_50: '🧠',
  quiz_ace: '🎯',
  streak_7: '🔥',
  streak_30: '⚡',
  scholar_10: '🎓',
  planner: '🗓️',
};

export function GamificationCard({ data }: { data: GamificationData }) {
  const t = useTranslations('gamification');
  const tier = TIER_STYLE[data.tier] ?? TIER_STYLE.bronze;
  const pct = data.level_xp_needed > 0
    ? Math.min(100, Math.round((data.level_xp / data.level_xp_needed) * 100))
    : 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tier.gradient} p-[1.5px] shadow-lg`}>
      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tier.gradient} text-2xl shadow-inner`}>
              {tier.emoji}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {t('level', { level: data.level })}
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                {t(`tier.${data.tier}`)} · {data.total_xp.toLocaleString()} XP
              </p>
            </div>
          </div>
          {data.streak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {data.streak}
              </span>
            </div>
          )}
        </div>

        {/* XP progress to next level */}
        <div className="mt-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tier.gradient} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {t('toNextLevel', {
              current: data.level_xp.toLocaleString(),
              needed: data.level_xp_needed.toLocaleString(),
              next: data.next_level,
            })}
          </p>
        </div>

        {/* Academic title (top discipline) */}
        {data.title && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
            <Crown className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t(`titleByTier.${data.title.tier}`, { course: data.title.course_name })}
            </span>
          </div>
        )}

        {/* Badges */}
        {data.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.badges.map((badge) => (
              <span
                key={badge.key}
                title={t(`badge.${badge.key}`)}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs"
              >
                <span>{BADGE_EMOJI[badge.key] ?? '🏅'}</span>
                <span className="text-muted-foreground">{t(`badge.${badge.key}`)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Leaderboard({ data }: { data: LeaderboardData }) {
  const t = useTranslations('gamification');
  if (data.entries.length === 0) return null;

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('leaderboardTitle', { course: data.course_name })}
        </h3>
      </div>
      <div className="mt-3 space-y-1.5">
        {data.entries.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
              entry.is_me ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-7 text-center text-sm font-bold">{medal(entry.rank)}</span>
              <span className={`text-sm ${entry.is_me ? 'font-semibold text-foreground' : ''}`}>
                {entry.name}
                {entry.is_me && <span className="ml-1 text-xs text-primary">({t('you')})</span>}
              </span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {entry.xp.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
      {data.my_rank && data.my_rank > data.entries.length && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('yourRank', { rank: data.my_rank, total: data.total_ranked, xp: data.my_xp.toLocaleString() })}
        </p>
      )}
    </div>
  );
}
