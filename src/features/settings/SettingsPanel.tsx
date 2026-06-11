/**
 * Settings panel: student UI language and theme preferences.
 * Persisted on the unified Users table via PATCH /api/widget/me/preferences.
 */
import React, { useState } from 'react';
import { Check, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
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
      </div>
    </div>
  );
}
