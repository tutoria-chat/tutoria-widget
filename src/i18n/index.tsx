/**
 * Minimal i18n for the companion widget.
 *
 * Same JSON message format and namespace conventions as tutoria-ui
 * (i18n/messages/{locale}.json, dot-notation keys, {var} interpolation),
 * without pulling in next-intl (which is Next.js-specific).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ptBr from './messages/pt-br.json';
import en from './messages/en.json';
import es from './messages/es.json';

export type Locale = 'pt-br' | 'en' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['pt-br', 'en', 'es'];
export const DEFAULT_LOCALE: Locale = 'pt-br';

export const LOCALE_NAMES: Record<Locale, string> = {
  'pt-br': 'Português (BR)',
  en: 'English',
  es: 'Español',
};

const MESSAGES: Record<Locale, Record<string, any>> = {
  'pt-br': ptBr,
  en,
  es,
};

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('pt')) return 'pt-br';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('es')) return 'es';
  return null;
}

/** Resolve initial locale: explicit pref > ?lang= param > browser > default. */
export function resolveInitialLocale(preference?: string | null): Locale {
  const fromPref = normalizeLocale(preference);
  if (fromPref) return fromPref;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromParam = normalizeLocale(params.get('lang'));
    if (fromParam) return fromParam;

    const fromBrowser = normalizeLocale(navigator.language);
    if (fromBrowser) return fromBrowser;
  }
  return DEFAULT_LOCALE;
}

function lookup(messages: Record<string, any>, key: string): string | undefined {
  let node: any = messages;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  const t = useCallback<Translator>(
    (key, vars) => {
      const message =
        lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[DEFAULT_LOCALE], key);
      if (message === undefined) {
        console.warn(`[i18n] Missing translation: ${key}`);
        return key;
      }
      return interpolate(message, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Namespaced translator, mirroring next-intl's useTranslations(namespace). */
export function useTranslations(namespace?: string): Translator {
  const { t } = useI18n();
  return useCallback<Translator>(
    (key, vars) => t(namespace ? `${namespace}.${key}` : key, vars),
    [t, namespace]
  );
}
