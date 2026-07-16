/**
 * Direct (tokenless) login gate for Erwin.
 *
 * Students opening the widget without an AVA module_token authenticate with
 * the triple matricula + institutional email + password. First access (no
 * password on the account yet) switches to a create-password screen. If the
 * same matricula exists at two institutions, a picker appears.
 */
import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { CardContent, CardTitle } from '../components/ui/card';
import { apiClient, type WidgetSession } from '../lib/api-client';
import { useTranslations } from '../i18n';

interface LoginGateProps {
  onSession: (session: WidgetSession) => void;
}

type Step = 'login' | 'first_access' | 'choose_university';

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function LoginGate({ onSession }: LoginGateProps) {
  const t = useTranslations('gate');

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [universities, setUniversities] = useState<Array<{ id: number; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password optional on purpose: first-access accounts have none yet — the
  // backend answers "first_access" and we switch to the create-password step.
  const canSubmitLogin = email.trim() && matricula.trim() && !busy;
  const canSubmitFirst =
    newPassword.length >= 8 && newPassword === confirmPassword && !busy;

  const handleResult = (result: Awaited<ReturnType<typeof apiClient.directLogin>>) => {
    if (result.status === 'ok' && result.session) {
      onSession(result.session);
    } else if (result.status === 'first_access') {
      setStep('first_access');
      setError(null);
    } else if (result.status === 'choose_university') {
      setUniversities(result.universities);
      setStep('choose_university');
      setError(null);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitLogin) return;
    setBusy(true);
    setError(null);
    try {
      handleResult(
        await apiClient.directLogin({
          email: email.trim(),
          matricula: matricula.trim(),
          password,
        })
      );
    } catch {
      setError(t('login.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  };

  const submitFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitFirst) return;
    setBusy(true);
    setError(null);
    try {
      handleResult(
        await apiClient.setFirstPassword({
          email: email.trim(),
          matricula: matricula.trim(),
          password: newPassword,
        })
      );
    } catch (err: any) {
      const message: string = err?.message || '';
      setError(message.includes('já possui') ? t('login.alreadyHasPassword') : t('login.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const chooseUniversity = async (universityId: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      handleResult(
        await apiClient.directLogin({
          email: email.trim(),
          matricula: matricula.trim(),
          password: password || newPassword,
          university_id: universityId,
        })
      );
    } catch {
      setError(t('login.genericError'));
      setStep('login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
      <div className="max-w-sm w-full space-y-4">
        <div>
          <p className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#5e17eb] to-[#5ce1e6] bg-clip-text text-transparent dark:from-[#a78bfa] dark:to-[#5ce1e6]">
            Erwin
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('tagline')}</p>
        </div>

        {step === 'login' && (
          <>
            <CardTitle className="text-2xl text-foreground">{t('login.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>

            <form onSubmit={submitLogin} className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="login-email">
                  {t('login.emailLabel')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="login-matricula">
                  {t('matriculaLabel')}
                </label>
                <input
                  id="login-matricula"
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder={t('matriculaPlaceholder')}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="login-password">
                  {t('login.passwordLabel')}
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmitLogin}>
                {busy ? t('verifying') : t('login.submit')}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">{t('login.firstAccessHint')}</p>
          </>
        )}

        {step === 'first_access' && (
          <>
            <CardTitle className="text-2xl text-foreground">{t('login.firstAccessTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('login.firstAccessSubtitle')}</p>

            <form onSubmit={submitFirstAccess} className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="first-password">
                  {t('login.newPasswordLabel')}
                </label>
                <input
                  id="first-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('login.passwordRules')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="first-password-confirm">
                  {t('login.confirmPasswordLabel')}
                </label>
                <input
                  id="first-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive mt-1">{t('login.passwordMismatch')}</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmitFirst}>
                {busy ? t('verifying') : t('login.createPasswordSubmit')}
              </Button>
              <button
                type="button"
                onClick={() => setStep('login')}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('login.backToLogin')}
              </button>
            </form>
          </>
        )}

        {step === 'choose_university' && (
          <>
            <CardTitle className="text-2xl text-foreground">{t('login.chooseUniversityTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('login.chooseUniversitySubtitle')}</p>

            <div className="space-y-2">
              {universities.map((u) => (
                <Button
                  key={u.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={busy}
                  onClick={() => chooseUniversity(u.id)}
                >
                  {u.name}
                </Button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => setStep('login')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('login.backToLogin')}
            </button>
          </>
        )}
      </div>
    </CardContent>
  );
}
