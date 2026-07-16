/**
 * Titles showcase: the full catalog of achievable academic titles with earned
 * ✓ / locked 🔒 state, progress + tip on locked ones, the hidden "???" title,
 * and an equip action to display one in the profile card.
 */
import React from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import type { TitleDto, TitleDescriptor } from '../../lib/api-client';
import type { Translator } from '../../i18n';
import { useTranslations } from '../../i18n';

/** Display name for a title (descriptor or full dto). Hidden+unearned → "???". */
export function titleName(t: Translator, td: TitleDescriptor | TitleDto): string {
  const earned = 'earned' in td ? td.earned : true;
  if (td.type === 'champion') return `${t('titles.special.the_one.name')} — ${td.label ?? ''}`.trim();
  if (td.type === 'hidden') return earned ? t(`titles.special.${td.key}.name`) : '???';
  if (td.type === 'track' && td.track && td.tier) {
    return t(`titles.trackTitle.${td.tier}`, { area: t(`titles.track.${td.track}`) });
  }
  return t(`titles.special.${td.key}.name`);
}

function titleTip(t: Translator, td: TitleDto): string {
  if (td.type === 'hidden') return t(`titles.special.${td.key}.tip`);
  if (td.type === 'track' && td.track && td.tier) {
    return t(`titles.trackTip.${td.tier}`, {
      threshold: td.threshold ?? 0,
      area: t(`titles.track.${td.track}`),
    });
  }
  return t(`titles.special.${td.key}.tip`, { threshold: td.threshold ?? 0 });
}

export default function TitlesShowcase({
  titles,
  displayed,
  equipping,
  onEquip,
}: {
  titles: TitleDto[];
  displayed: string | null;
  equipping: string | null;
  onEquip: (key: string | null) => void;
}) {
  const t = useTranslations('progress');
  const tt = useTranslations() as Translator;
  if (titles.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('titlesTitle')}
      </h3>
      <div className="space-y-2">
        {titles.map((title) => {
          const isDisplayed = displayed === title.key;
          const showProgress = !title.hidden && !title.earned && title.threshold;
          const pct = showProgress ? Math.min(100, Math.round(((title.progress ?? 0) / title.threshold!) * 100)) : 0;
          return (
            <div
              key={title.key}
              className={`rounded-xl border p-3 ${
                isDisplayed
                  ? 'border-primary/50 bg-primary/5'
                  : title.earned
                    ? 'border-border bg-card'
                    : 'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {title.earned ? (
                    title.hidden ? <Sparkles className="h-4 w-4 shrink-0 text-[#b65cff]" /> : <Check className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={`truncate text-sm ${title.earned ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {titleName(tt, title)}
                  </span>
                </div>
                {title.earned ? (
                  isDisplayed ? (
                    <span className="shrink-0 text-xs font-medium text-primary">{t('equipped')}</span>
                  ) : (
                    <button
                      onClick={() => onEquip(title.key)}
                      disabled={equipping === title.key}
                      className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {t('equip')}
                    </button>
                  )
                ) : null}
              </div>

              {!title.earned && (
                <p className="mt-1.5 text-xs text-muted-foreground">{titleTip(tt, title)}</p>
              )}
              {showProgress && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#5e17eb] to-[#5ce1e6]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {(title.progress ?? 0).toLocaleString()}/{title.threshold!.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
