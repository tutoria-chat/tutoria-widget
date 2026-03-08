'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { WidgetAPIClient } from '@/lib/api-client';

interface VerificationGateProps {
  moduleToken: string;
  apiBaseUrl: string;
  onVerified: (studentId: number, studentName: string) => void;
}

type GateState = 'loading' | 'form' | 'verifying' | 'error';

/**
 * VerificationGate component: Shows a matricula verification form when a course
 * requires student enrollment verification before allowing chat access.
 */
export default function VerificationGate({ moduleToken, apiBaseUrl, onVerified }: VerificationGateProps) {
  const [state, setState] = useState<GateState>('loading');
  const [courseName, setCourseName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionStorageKey = `tutoria-verified-${moduleToken}`;

  /**
   * On mount, check sessionStorage for existing verification, then check API.
   */
  useEffect(() => {
    const checkVerification = async () => {
      // Check sessionStorage for existing verification
      try {
        const stored = sessionStorage.getItem(sessionStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.studentId === 'number' && typeof parsed.studentName === 'string') {
            onVerified(parsed.studentId, parsed.studentName);
            return;
          }
        }
      } catch {
        // Invalid stored data, continue with API check
        sessionStorage.removeItem(sessionStorageKey);
      }

      // Call API to check if verification is required
      try {
        const apiClient = new WidgetAPIClient(apiBaseUrl);
        const result = await apiClient.requiresVerification(moduleToken);

        if (!result.requires_verification) {
          // No verification needed, pass through immediately
          onVerified(0, '');
          return;
        }

        // Verification required, show form
        setCourseName(result.course_name || '');
        setState('form');
      } catch (error: any) {
        console.error('Failed to check verification requirement:', error);
        setLoadError(error.message || 'Erro ao verificar requisitos. Atualize a pagina.');
        setState('error');
      }
    };

    checkVerification();
  }, [moduleToken, apiBaseUrl]);

  /**
   * Focus the input when the form is shown.
   */
  useEffect(() => {
    if (state === 'form' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  /**
   * Handle matricula form submission.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = matricula.trim();
    if (!trimmed) return;

    setErrorMessage('');
    setState('verifying');

    try {
      const apiClient = new WidgetAPIClient(apiBaseUrl);
      const result = await apiClient.verifyStudent(moduleToken, trimmed);

      if (result.verified && result.student_id !== undefined) {
        const studentId = result.student_id;
        const studentName = result.student_name || '';

        // Store in sessionStorage so refreshing doesn't re-ask
        try {
          sessionStorage.setItem(
            sessionStorageKey,
            JSON.stringify({ studentId, studentName })
          );
        } catch {
          // sessionStorage may be unavailable in some contexts, that is fine
        }

        onVerified(studentId, studentName);
      } else {
        setErrorMessage(result.message || 'Matricula nao encontrada. Verifique e tente novamente.');
        setState('form');
        // Re-focus input after error
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (error: any) {
      console.error('Verification failed:', error);
      setErrorMessage(error.message || 'Erro ao verificar. Tente novamente.');
      setState('form');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  /**
   * Handle Enter key in the input field.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  /**
   * Retry loading when initial check fails.
   */
  const handleRetry = () => {
    setLoadError('');
    setState('loading');
    // Re-trigger the effect by forcing a re-render
    window.location.reload();
  };

  // Loading state - checking if verification is required
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando requisitos...</p>
      </div>
    );
  }

  // Error state - failed to check verification requirement
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Erro ao carregar</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{loadError}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Form / Verifying state
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Icon and header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Identificacao do Aluno</h2>
            {courseName && (
              <p className="text-sm text-muted-foreground mt-1">{courseName}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Informe sua matricula para acessar o tutor.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="matricula-input" className="text-sm font-medium text-foreground">
              Matricula
            </label>
            <input
              ref={inputRef}
              id="matricula-input"
              type="text"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua matricula"
              disabled={state === 'verifying'}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="off"
            />
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={state === 'verifying' || !matricula.trim()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {state === 'verifying' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
