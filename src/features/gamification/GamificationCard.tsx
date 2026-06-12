/**
 * Gamification UI: progress card (level/XP/tier/streak + title), badge row and
 * course leaderboard. All read-only views over the backend ledger — they take
 * already-fetched data as props so the Home panel controls loading.
 */
import React from 'react';
import { Flame, Trophy, Crown, Target, Check, Loader2 } from 'lucide-react';
import type { GamificationData, LeaderboardData, ChallengeDto } from '../../lib/api-client';
import { useTranslations } from '../../i18n';
import { TierEmblem, type Tier } from './TierEmblem';
import { titleName } from './TitlesShowcase';

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
  const tRoot = useTranslations();
  const tier = TIER_STYLE[data.tier] ?? TIER_STYLE.bronze;
  const pct = data.level_xp_needed > 0
    ? Math.min(100, Math.round((data.level_xp / data.level_xp_needed) * 100))
    : 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tier.gradient} p-[1.5px] shadow-lg`}>
      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TierEmblem tier={data.tier as Tier} size={48} />
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

        {/* Academic title: the equipped one (if any) overrides the auto-computed */}
        {data.displayed_title ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
            <Crown className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">{titleName(tRoot, data.displayed_title)}</span>
          </div>
        ) : data.title ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
            <Crown className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t(`titleByTier.${data.title.tier}`, { course: data.title.course_name })}
            </span>
          </div>
        ) : null}

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

const CHALLENGE_EMOJI: Record<string, string> = {
  weekly_questions: '💬',
  weekly_quizzes: '🧩',
  weekly_flashcards: '🃏',
  weekly_plan: '🗓️',
  weekly_streak: '🔥',
};

export function MissionsCard({
  challenges,
  claimingKey,
  onClaim,
}: {
  challenges: ChallengeDto[];
  claimingKey: string | null;
  onClaim: (key: string) => void;
}) {
  const t = useTranslations('gamification');
  if (challenges.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('missionsTitle')}
        </h3>
      </div>
      <div className="mt-3 space-y-2">
        {challenges.map((ch) => {
          const pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
          const claimed = ch.status === 'claimed';
          const claimable = ch.status === 'claimable';
          return (
            <div
              key={ch.key}
              className={`rounded-xl border p-3 transition-colors ${
                claimed ? 'border-border bg-muted/40' : claimable ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg">{CHALLENGE_EMOJI[ch.key] ?? '🎯'}</span>
                  <span className="truncate text-sm font-medium">{t(`mission.${ch.key}`)}</span>
                </div>
                {claimed ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" /> +{ch.xp} XP
                  </span>
                ) : claimable ? (
                  <button
                    onClick={() => onClaim(ch.key)}
                    disabled={claimingKey === ch.key}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#5e17eb] to-[#7c3aed] px-3 py-1 text-xs font-semibold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {claimingKey === ch.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {t('claim', { xp: ch.xp })}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">+{ch.xp} XP</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${claimed || claimable ? 'bg-gradient-to-r from-[#5e17eb] to-[#5ce1e6]' : 'bg-primary/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {ch.progress}/{ch.target}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type LeaderboardLike = Omit<LeaderboardData, 'course_id' | 'course_name'> & { course_name?: string };

export function Leaderboard({ data, heading }: { data: LeaderboardLike; heading?: string }) {
  const t = useTranslations('gamification');
  if (data.entries.length === 0) return null;

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {heading ?? t('leaderboardTitle', { course: data.course_name ?? '' })}
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
