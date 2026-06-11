/**
 * Companion app boot sequence:
 *   URL params -> MatriculaGate (mandatory) -> LGPD ConsentGate ->
 *   session context (courses + features) -> Shell.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import ConsentGate from '../components/ConsentGate';
import MatriculaGate from '../auth/MatriculaGate';
import { AppProvider } from './AppContext';
import Shell, { type PanelKey } from './Shell';
import {
  apiClient,
  type SessionContext,
  type WidgetSession,
} from '../lib/api-client';
import {
  I18nProvider,
  normalizeLocale,
  resolveInitialLocale,
  useI18n,
  useTranslations,
} from '../i18n';

type Theme = 'light' | 'dark' | 'system';
type BootState = 'loading' | 'gate' | 'consent' | 'context' | 'ready' | 'error';

interface CompanionAppProps {
  apiBaseUrl?: string;
}

function sessionStorageKey(moduleToken: string) {
  return `tutoria-session-${moduleToken}`;
}

function loadStoredSession(moduleToken: string): WidgetSession | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey(moduleToken));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(moduleToken: string, session: WidgetSession | null) {
  try {
    if (session) {
      sessionStorage.setItem(sessionStorageKey(moduleToken), JSON.stringify(session));
    } else {
      sessionStorage.removeItem(sessionStorageKey(moduleToken));
    }
  } catch {
    /* ignore */
  }
}

function CompanionAppInner({ apiBaseUrl }: { apiBaseUrl: string }) {
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');
  const { setLocale } = useI18n();

  const params = useMemo(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );
  const moduleToken = params.get('module_token') || '';
  // Streaming is the default; ?streaming=false opts out
  const streaming = params.get('streaming') !== 'false';
  const darkParam = params.get('dark') ?? 'auto';
  const initialPanel = (params.get('panel') as PanelKey | null) ?? undefined;
  const urlColors = {
    button: params.get('buttonColor') || undefined,
    userMessage: params.get('userMessageColor') || undefined,
    agentMessage: params.get('agentMessageColor') || undefined,
  };

  const [bootState, setBootState] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [session, setSession] = useState<WidgetSession | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // ── Theme application ──────────────────────────────────────────────────────
  useEffect(() => {
    const systemDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    let dark: boolean;
    if (darkParam === 'true') dark = true;
    else if (darkParam === 'false') dark = false;
    else if (theme === 'dark') dark = true;
    else if (theme === 'light') dark = false;
    else dark = systemDark;

    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [darkParam, theme]);

  // ── Boot: restore session or show gate ────────────────────────────────────
  useEffect(() => {
    if (!moduleToken) {
      setBootState('error');
      setBootError('missing-token');
      return;
    }

    let cancelled = false;

    const boot = async () => {
      // Course name for the gate (also confirms the token is valid)
      try {
        const info = await apiClient.requiresVerification(moduleToken);
        if (!cancelled) {
          setCourseName(info.course_name);
          // Pre-session locale: ?lang= wins, otherwise the module's tutor
          // language drives the gate (a Brazilian course gates in Portuguese
          // even on an English OS). Student preference takes over post-login.
          const langParam = normalizeLocale(params.get('lang'));
          if (!langParam) {
            const moduleLocale = normalizeLocale(info.tutor_language);
            if (moduleLocale) setLocale(moduleLocale);
          }
        }
      } catch {
        if (!cancelled) {
          setBootState('error');
          setBootError('invalid-token');
        }
        return;
      }

      const stored = loadStoredSession(moduleToken);
      if (stored) {
        apiClient.setSessionToken(stored.session_token);
        try {
          const ctx = await apiClient.getSessionContext(moduleToken);
          if (cancelled) return;
          setSession(stored);
          setContext(ctx);
          applyStudentLocale(stored, ctx);
          setBootState('consent');
          return;
        } catch {
          // Stored session expired or invalid — fall through to the gate
          apiClient.setSessionToken(null);
          storeSession(moduleToken, null);
        }
      }

      if (!cancelled) setBootState('gate');
    };

    const applyStudentLocale = (s: WidgetSession, ctx: SessionContext) => {
      const pref = ctx.student.language_preference || s.student.language_preference;
      setLocale(resolveInitialLocale(pref));
      const themePref = (ctx.student.theme_preference || s.student.theme_preference) as Theme;
      if (themePref === 'light' || themePref === 'dark' || themePref === 'system') {
        setTheme(themePref);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleToken]);

  // ── Gate success: store session, load context ──────────────────────────────
  const handleSession = async (newSession: WidgetSession) => {
    storeSession(moduleToken, newSession);
    setSession(newSession);

    const pref = normalizeLocale(newSession.student.language_preference);
    if (pref) setLocale(pref);
    const themePref = newSession.student.theme_preference as Theme;
    if (themePref === 'light' || themePref === 'dark' || themePref === 'system') {
      setTheme(themePref);
    }

    setBootState('context');
    try {
      const ctx = await apiClient.getSessionContext(moduleToken);
      setContext(ctx);
      setBootState('consent');
    } catch {
      setBootState('error');
      setBootError('context');
    }
  };

  const handleSessionEnded = () => {
    apiClient.setSessionToken(null);
    storeSession(moduleToken, null);
    setSession(null);
    setContext(null);
    setBootState('gate');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (bootState === 'error') {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none items-center justify-center text-center p-8">
        <h2 className="text-xl font-semibold text-foreground">
          {bootError === 'missing-token' ? (
            <>
              Autenticação necessária — este widget requer um <code>module_token</code>.
            </>
          ) : (
            tCommon('error')
          )}
        </h2>
      </Card>
    );
  }

  if (bootState === 'loading' || bootState === 'context') {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none items-center justify-center p-8">
        <div className="flex space-x-2">
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]"></div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">{tCommon('loading')}</p>
      </Card>
    );
  }

  if (bootState === 'gate') {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none">
        <MatriculaGate moduleToken={moduleToken} courseName={courseName} onSession={handleSession} />
      </Card>
    );
  }

  if (bootState === 'consent' && session) {
    return (
      <Card className="flex flex-col h-full !rounded-none !border-none">
        <ConsentGate
          moduleToken={moduleToken}
          apiBaseUrl={apiBaseUrl}
          studentId={session.student.id}
          onConsented={() => setBootState('ready')}
        />
      </Card>
    );
  }

  if (bootState === 'ready' && session && context) {
    return (
      <AppProvider
        moduleToken={moduleToken}
        session={session}
        initialContext={context}
        onSessionEnded={handleSessionEnded}
      >
        <Shell
          apiBaseUrl={apiBaseUrl}
          streaming={streaming}
          isDark={isDark}
          theme={theme}
          onThemeChange={setTheme}
          initialPanel={initialPanel}
          urlColors={urlColors}
        />
      </AppProvider>
    );
  }

  return null;
}

export default function CompanionApp({ apiBaseUrl }: CompanionAppProps) {
  const resolvedBaseUrl =
    apiBaseUrl || import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8000';

  return (
    <I18nProvider initialLocale={resolveInitialLocale()}>
      <CompanionAppInner apiBaseUrl={resolvedBaseUrl} />
    </I18nProvider>
  );
}
