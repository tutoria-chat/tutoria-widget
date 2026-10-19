/**
 * Settings panel: student UI language and theme preferences, plus password
 * management (the only profile field students may edit — everything else
 * stays under the institution's control).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, KeyRound, Loader2, Lock, Maximize2, Settings as SettingsIcon, SlidersHorizontal, Volume2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useReadAloudPref } from '../../hooks/useReadAloudPref';
import { useSpeechRatePref, SPEECH_RATES } from '../../hooks/useSpeechRatePref';
import { useLearningProfile } from '../../hooks/useLearningProfile';
import {
  ADAPTATION_IDS,
  CONDITION_IDS,
  MAX_NOTE_CHARS,
  toggleAdaptation,
  toggleCondition,
  type ConditionId,
} from '../../lib/learningProfile';
import { useResponsive, USER_SCALE_MIN, USER_SCALE_MAX } from '../../app/ResponsiveContext';
import {
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  useI18n,
  useTranslations,
  type Locale,
} from '../../i18n';

type Theme = 'light' | 'dark' | 'system';

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  /** Section to scroll to on open (e.g. from the chat's "Adaptar ao meu jeito"). */
  focusSection?: 'learning' | null;
  onFocusHandled?: () => void;
}

export default function SettingsPanel({ theme, onThemeChange, focusSection, onFocusHandled }: SettingsPanelProps) {
  const t = useTranslations('settings');
  const { locale, setLocale } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep-link into "Seu jeito de aprender": scroll this panel's own container
  // (never the host page the widget is embedded in), focus it, flash a ring.
  const scrollRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLElement>(null);
  const [highlightLearning, setHighlightLearning] = useState(false);

  useEffect(() => {
    if (focusSection !== 'learning') return;
    const box = scrollRef.current;
    const el = learningRef.current;
    if (box && el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const top = box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 16;
      box.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
      setHighlightLearning(true);
    }
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSection]);

  useEffect(() => {
    if (!highlightLearning) return;
    const timer = setTimeout(() => setHighlightLearning(false), 1600);
    return () => clearTimeout(timer);
  }, [highlightLearning]);

  const persist = async (prefs: { language?: string; theme?: string }) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiClient.updatePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLanguage = (next: Locale) => {
    setLocale(next);
    persist({ language: next });
  };

  const handleTheme = (next: Theme) => {
    onThemeChange(next);
    persist({ theme: next });
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('themeLight') },
    { value: 'dark', label: t('themeDark') },
    { value: 'system', label: t('themeSystem') },
  ];

  const optionClass = (selected: boolean) =>
    `flex items-center justify-between w-full px-3 py-2 rounded-md border text-sm text-left transition-colors ${
      selected
        ? 'border-primary bg-primary/10 text-foreground'
        : 'border-border bg-background text-foreground hover:bg-accent'
    }`;

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
      </div>

      <div className="mt-6 max-w-sm space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('language')}</p>
          {SUPPORTED_LOCALES.map((l) => (
            <button key={l} className={optionClass(locale === l)} onClick={() => handleLanguage(l)}>
              <span>{LOCALE_NAMES[l]}</span>
              {locale === l && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('theme')}</p>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              className={optionClass(theme === option.value)}
              onClick={() => handleTheme(option.value)}
            >
              <span>{option.label}</span>
              {theme === option.value && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>

        <div className="h-5 text-sm" role="status" aria-live="polite">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          {saved && <span className="text-green-600 dark:text-green-400">{t('saved')}</span>}
          {error && <span className="text-destructive">{error}</span>}
        </div>

        <LearningSection ref={learningRef} highlight={highlightLearning} />

        <VoiceSection />

        <DisplaySection optionClass={optionClass} />

        <PasswordSection />

        <DataExportSection />
      </div>
    </div>
  );
}

/**
 * "Seu jeito de aprender" — the student may opt in to having answers adapted to
 * how they learn. An explicit switch with its purpose stated right next to it,
 * revocable any time (LGPD: specific, highlighted consent). The conditions the
 * student picks never leave this device; they only pre-select answer-style
 * adaptations, which are what the chat sends (see lib/learningProfile).
 */
const LearningSection = React.forwardRef<HTMLElement, { highlight: boolean }>(function LearningSection(
  { highlight },
  ref,
) {
  const t = useTranslations('settings');
  const [profile, setProfile, clearProfile] = useLearningProfile();
  const [cleared, setCleared] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const hasAnything =
    profile.enabled || profile.conditions.length > 0 || profile.adaptations.length > 0 || profile.note !== '';

  const onCondition = (id: ConditionId) => {
    const selecting = !profile.conditions.includes(id);
    setProfile(toggleCondition(profile, id));
    // "Outra": the note is where the student describes it.
    if (id === 'other' && selecting) requestAnimationFrame(() => noteRef.current?.focus());
  };

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="learning-title"
      className={`space-y-3 rounded-md border-t border-border pt-6 outline-none transition-shadow ${
        highlight ? 'ring-2 ring-[#5e17eb]/60 ring-offset-4 ring-offset-background' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 id="learning-title" className="text-sm font-medium">{t('learning.title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{t('learning.intro')}</p>

      <button
        type="button"
        role="switch"
        aria-checked={profile.enabled}
        onClick={() => {
          setCleared(false);
          setProfile({ ...profile, enabled: !profile.enabled });
        }}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent"
      >
        <span className="text-sm">{t('learning.toggle')}</span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${profile.enabled ? 'bg-primary' : 'bg-muted'}`}>
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              profile.enabled ? 'left-0.5 translate-x-4' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {profile.enabled && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm">{t('learning.conditionsLabel')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {CONDITION_IDS.map((id) => {
                const on = profile.conditions.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onCondition(id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {on && <Check className="h-3 w-3 text-primary" aria-hidden="true" />}
                    {t(`learning.conditions.${id}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t('learning.conditionsHint')}</p>
            {profile.conditions.includes('low_vision') && (
              <p className="text-xs text-muted-foreground">{t('learning.lowVisionTip')}</p>
            )}
          </fieldset>

          <details className="rounded-md border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm">
              {t('learning.adaptationsSummary', { count: profile.adaptations.length })}
            </summary>
            <div className="space-y-0.5 border-t border-border px-3 py-2">
              {ADAPTATION_IDS.map((id) => (
                <label key={id} className="flex cursor-pointer items-start gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.adaptations.includes(id)}
                    onChange={() => setProfile(toggleAdaptation(profile, id))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>{t(`learning.adaptations.${id}`)}</span>
                </label>
              ))}
            </div>
          </details>

          <div className="space-y-1">
            <label htmlFor="learning-note" className="text-sm">{t('learning.noteLabel')}</label>
            <textarea
              id="learning-note"
              ref={noteRef}
              rows={2}
              maxLength={MAX_NOTE_CHARS}
              value={profile.note}
              onChange={(e) => setProfile({ ...profile, note: e.target.value })}
              placeholder={t('learning.notePlaceholder')}
              aria-describedby="learning-note-count"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p id="learning-note-count" className="text-right text-[11px] tabular-nums text-muted-foreground">
              {profile.note.length}/{MAX_NOTE_CHARS}
            </p>
          </div>
        </div>
      )}

      {/* Shown even before opting in, so the student knows exactly what happens. */}
      <div className="flex gap-2 rounded-md bg-muted/60 p-3">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">{t('learning.privacy')}</p>
      </div>

      {hasAnything && (
        <button
          type="button"
          onClick={() => {
            clearProfile();
            setCleared(true);
          }}
          className="text-xs text-destructive underline-offset-2 hover:underline"
        >
          {t('learning.clear')}
        </button>
      )}
      <div className="h-4 text-xs" role="status" aria-live="polite">
        {cleared && <span className="text-green-600 dark:text-green-400">{t('learning.cleared')}</span>}
      </div>
    </section>
  );
});

/**
 * Display controls: a zoom slider (scales the whole rem-based UI) and a
 * compact-layout switch. Lets a student rescue a too-small embed without any
 * host-side change; the host can still hard-set both via ?scale= / ?ui=.
 */
function DisplaySection({ optionClass }: { optionClass: (selected: boolean) => string }) {
  const t = useTranslations('settings');
  const { userScale, setUserScale, compactPref, setCompactPref, compact, compactLocked } =
    useResponsive();

  const pct = Math.round(userScale * 100);
  const compactOptions: { value: 'auto' | 'on' | 'off'; label: string }[] = [
    { value: 'auto', label: t('display.compactAuto') },
    { value: 'on', label: t('display.compactOn') },
    { value: 'off', label: t('display.compactOff') },
  ];

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{t('display.title')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="ui-scale" className="text-sm">
            {t('display.zoom')}
          </label>
          <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="ui-scale"
            type="range"
            min={USER_SCALE_MIN}
            max={USER_SCALE_MAX}
            step={0.05}
            value={userScale}
            onChange={(e) => setUserScale(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label={t('display.zoom')}
          />
          {pct !== 100 && (
            <button
              type="button"
              onClick={() => setUserScale(1)}
              className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t('display.reset')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm">{t('display.layout')}</p>
        {compactOptions.map((option) => (
          <button
            key={option.value}
            className={optionClass(compactPref === option.value)}
            onClick={() => setCompactPref(option.value)}
            disabled={compactLocked}
            title={compactLocked ? t('display.lockedHint') : undefined}
          >
            <span className={compactLocked ? 'opacity-50' : ''}>{option.label}</span>
            {compactPref === option.value && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
        <p className="text-xs text-muted-foreground">
          {compactLocked
            ? t('display.lockedHint')
            : compact
              ? t('display.compactActive')
              : t('display.hint')}
        </p>
      </div>
    </div>
  );
}

/**
 * Voice: opt in to having the tutor read every answer aloud. A big win for
 * students who read slowly, have low vision, or are dyslexic. Only shown when
 * the browser supports speech synthesis (checked after mount to avoid an
 * SSR/hydration mismatch).
 */
function VoiceSection() {
  const t = useTranslations('settings');
  const { locale } = useI18n();
  const [readAloud, setReadAloud] = useReadAloudPref();
  const [rate, setRate] = useSpeechRatePref();
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  if (!supported) return null;

  const bcp47 = ({ 'pt-br': 'pt-BR', en: 'en-US', es: 'es-ES' } as const)[locale] ?? 'pt-BR';
  const fmtRate = (r: number) => `${new Intl.NumberFormat(bcp47, { maximumFractionDigits: 2 }).format(r)}×`;

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{t('voice.title')}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={readAloud}
        onClick={() => setReadAloud(!readAloud)}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent"
      >
        <span className="text-sm">{t('voice.autoRead')}</span>
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            readAloud ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              readAloud ? 'left-0.5 translate-x-4' : 'left-0.5'
            }`}
          />
        </span>
      </button>
      <p className="text-xs text-muted-foreground">{t('voice.autoReadHint')}</p>

      <div className="pt-1">
        <p className="mb-1.5 text-sm">{t('voice.speedLabel')}</p>
        <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label={t('voice.speedLabel')}>
          {SPEECH_RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              aria-pressed={rate === r}
              className={`px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                rate === r ? 'bg-primary/10 text-primary dark:text-[#c4b5fd]' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {fmtRate(r)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataExportSection() {
  const t = useTranslations('settings');
  const { moduleToken, session } = useApp();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const data = await apiClient.exportStudentData(moduleToken, session.student.id);

      // Trigger a client-side JSON download of the student's personal data.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `erwin-meus-dados-${session.student.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      setError(t('dataExport.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{t('dataExport.title')}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t('dataExport.description')}</p>

      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('dataExport.exporting')}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {t('dataExport.button')}
          </>
        )}
      </button>

      <div className="h-5 text-sm" role="status" aria-live="polite">
        {done && <span className="text-green-600 dark:text-green-400">{t('dataExport.done')}</span>}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function PasswordSection() {
  const t = useTranslations('settings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  const canSubmit =
    newPassword.length >= 8 && newPassword === confirmPassword && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      await apiClient.changePassword(currentPassword || null, newPassword);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setDone(false), 3000);
    } catch (err: any) {
      const message: string = err?.message || '';
      setError(
        message === 'WRONG_CURRENT_PASSWORD' || message.includes('atual incorreta')
          ? t('password.wrongCurrent')
          : t('saveError')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{t('password.title')}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t('password.description')}</p>

      <form onSubmit={submit} className="space-y-2">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t('password.currentPlaceholder')}
          aria-label={t('password.currentPlaceholder')}
          autoComplete="current-password"
          className={inputClass}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('password.newPlaceholder')}
          aria-label={t('password.newPlaceholder')}
          autoComplete="new-password"
          aria-describedby={newPassword && newPassword.length < 8 ? 'password-rules' : undefined}
          className={inputClass}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('password.confirmPlaceholder')}
          aria-label={t('password.confirmPlaceholder')}
          autoComplete="new-password"
          aria-invalid={confirmPassword ? newPassword !== confirmPassword : undefined}
          aria-describedby={confirmPassword && newPassword !== confirmPassword ? 'password-mismatch' : undefined}
          className={inputClass}
        />
        {confirmPassword && newPassword !== confirmPassword && (
          <p id="password-mismatch" role="alert" className="text-xs text-destructive">{t('password.mismatch')}</p>
        )}
        {newPassword && newPassword.length < 8 && (
          <p id="password-rules" className="text-xs text-muted-foreground">{t('password.rules')}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('password.saving') : t('password.submit')}
        </button>

        <div className="h-5 text-sm" role="status" aria-live="polite">
          {done && <span className="text-green-600 dark:text-green-400">{t('password.saved')}</span>}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      </form>
    </div>
  );
}
