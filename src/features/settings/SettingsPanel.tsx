/**
 * Settings panel: student UI language and theme preferences, plus password
 * management (the only profile field students may edit — everything else
 * stays under the institution's control).
 */
import React, { useState } from 'react';
import { Check, Download, KeyRound, Loader2, Maximize2, Settings as SettingsIcon } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
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
}

export default function SettingsPanel({ theme, onThemeChange }: SettingsPanelProps) {
  const t = useTranslations('settings');
  const { locale, setLocale } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="h-full overflow-y-auto p-6">
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

        <div className="h-5 text-sm">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {saved && <span className="text-green-600 dark:text-green-400">{t('saved')}</span>}
          {error && <span className="text-destructive">{error}</span>}
        </div>

        <DisplaySection optionClass={optionClass} />

        <PasswordSection />

        <DataExportSection />
      </div>
    </div>
  );
}

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

      <div className="h-5 text-sm">
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
          autoComplete="current-password"
          className={inputClass}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('password.newPlaceholder')}
          autoComplete="new-password"
          className={inputClass}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('password.confirmPlaceholder')}
          autoComplete="new-password"
          className={inputClass}
        />
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive">{t('password.mismatch')}</p>
        )}
        {newPassword && newPassword.length < 8 && (
          <p className="text-xs text-muted-foreground">{t('password.rules')}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('password.saving') : t('password.submit')}
        </button>

        <div className="h-5 text-sm">
          {done && <span className="text-green-600 dark:text-green-400">{t('password.saved')}</span>}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      </form>
    </div>
  );
}
