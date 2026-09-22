/**
 * Matricula gate for the companion widget.
 *
 * Verification is mandatory: a session (POST /api/widget/session) is required
 * before any feature works. On success the parent receives the session payload.
 */
import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { CardContent, CardTitle } from '../components/ui/card';
import { apiClient, type WidgetSession } from '../lib/api-client';
import { useTranslations } from '../i18n';

interface MatriculaGateProps {
  moduleToken: string;
  courseName?: string;
  onSession: (session: WidgetSession) => void;
}

export default function MatriculaGate({ moduleToken, courseName, onSession }: MatriculaGateProps) {
  const t = useTranslations('gate');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  // Staff (professor/gestor/tutor) reveal a password field to test the widget.
  const [staffMode, setStaffMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = matricula.trim();
    if (!value || isVerifying) return;

    setIsVerifying(true);
    setError(null);
    try {
      const session = await apiClient.createSession(
        moduleToken,
        value,
        staffMode && password ? password : undefined,
      );
      onSession(session);
    } catch (err: any) {
      const message: string = err?.message || '';
      if (message.includes('senha') || message.toLowerCase().includes('password')) {
        setError(t('staff.invalid'));
      } else if (message === 'MATRICULA_NOT_FOUND' || message.includes('não encontrada') || message.includes('not found')) {
        setError(message.includes('curso') ? t('notEnrolled') : t('notFound'));
      } else {
        setError(t('genericError'));
      }
    } finally {
      setIsVerifying(false);
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
        <CardTitle className="text-2xl text-foreground">{t('title')}</CardTitle>
        {courseName && (
          <p className="text-sm text-muted-foreground">{t('subtitle', { courseName })}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-left text-sm font-medium" htmlFor="matricula-input">
            {t('matriculaLabel')}
          </label>
          <input
            id="matricula-input"
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder={t('matriculaPlaceholder')}
            autoComplete="off"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'gate-error' : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {staffMode && (
            <div>
              <label className="block text-left text-sm font-medium mb-1" htmlFor="staff-password">
                {t('staff.passwordLabel')}
              </label>
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {error && (
            <p id="gate-error" className="text-sm text-destructive text-left" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isVerifying || !matricula.trim()}>
            {isVerifying ? t('verifying') : t('verify')}
          </Button>
        </form>

        {staffMode ? (
          // Already in staff mode — a quiet way back to the student flow.
          <button
            type="button"
            onClick={() => setStaffMode(false)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('staff.hide')}
          </button>
        ) : (
          // Loud, unmissable call-to-action for staff.
          <button
            type="button"
            onClick={() => setStaffMode(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-[#c4b5fd]"
          >
            <GraduationCap className="h-5 w-5 shrink-0" />
            {t('staff.toggle')}
          </button>
        )}

        <p className="text-xs text-muted-foreground">{t('helpText')}</p>
      </div>
    </CardContent>
  );
}
