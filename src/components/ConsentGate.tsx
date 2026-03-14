'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { WidgetAPIClient } from '@/lib/api-client';

interface ConsentGateProps {
  moduleToken: string;
  apiBaseUrl: string;
  studentId: number;
  onConsented: () => void;
}

type GateState = 'loading' | 'form' | 'submitting' | 'error';

/**
 * ConsentGate component: Shows LGPD consent notice before allowing chat access.
 * Required for MEC compliance and LGPD Articles 7, 9, 33-36.
 *
 * Consent types recorded:
 * - lgpd_privacy_policy: General data processing consent
 * - ai_data_processing: Consent for AI-powered tutoring
 * - openai_cross_border_transfer: Disclosure that data is sent to OpenAI (US servers)
 */
export default function ConsentGate({ moduleToken, apiBaseUrl, studentId, onConsented }: ConsentGateProps) {
  const [state, setState] = useState<GateState>('loading');
  const [loadError, setLoadError] = useState('');

  const sessionStorageKey = `tutoria-consent-${moduleToken}`;

  /**
   * On mount, check sessionStorage for existing consent, then check API.
   */
  useEffect(() => {
    const checkConsent = async () => {
      // If no studentId yet (verification hasn't happened), pass through
      if (!studentId || studentId <= 0) {
        onConsented();
        return;
      }

      // Check sessionStorage for existing consent
      try {
        const stored = sessionStorage.getItem(sessionStorageKey);
        if (stored === 'true') {
          onConsented();
          return;
        }
      } catch {
        // sessionStorage may be unavailable
      }

      // Call API to check consent status
      try {
        const apiClient = new WidgetAPIClient(apiBaseUrl);
        const result = await apiClient.checkConsentStatus(moduleToken, studentId);

        if (result.has_all_consents) {
          // Already consented, cache and pass through
          try {
            sessionStorage.setItem(sessionStorageKey, 'true');
          } catch { /* ignore */ }
          onConsented();
          return;
        }

        // Consent needed, show form
        setState('form');
      } catch (error: any) {
        console.error('Failed to check consent status:', error);
        setLoadError(error.message || 'Erro ao verificar consentimento.');
        setState('error');
      }
    };

    checkConsent();
  }, [moduleToken, apiBaseUrl, studentId]);

  /**
   * Handle consent acceptance.
   */
  const handleAccept = async () => {
    setState('submitting');

    try {
      const apiClient = new WidgetAPIClient(apiBaseUrl);
      await apiClient.recordConsent(moduleToken, studentId, [
        'lgpd_privacy_policy',
        'ai_data_processing',
        'openai_cross_border_transfer',
      ]);

      // Cache in sessionStorage
      try {
        sessionStorage.setItem(sessionStorageKey, 'true');
      } catch { /* ignore */ }

      onConsented();
    } catch (error: any) {
      console.error('Failed to record consent:', error);
      setLoadError(error.message || 'Erro ao registrar consentimento.');
      setState('error');
    }
  };

  /**
   * Retry loading when check fails.
   */
  const handleRetry = () => {
    setLoadError('');
    setState('loading');
    window.location.reload();
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando consentimento...</p>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Erro</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{loadError}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Consent form
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 overflow-y-auto">
      <div className="w-full max-w-md space-y-5">
        {/* Icon and header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Aviso de Privacidade</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Conforme a Lei Geral de Protecao de Dados (LGPD)
            </p>
          </div>
        </div>

        {/* Consent text */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              Este tutor utiliza inteligencia artificial
            </p>
            <p className="text-xs leading-relaxed">
              As respostas sao geradas por IA com base nos materiais do curso.
              Podem conter imprecisoes e nao substituem o professor.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              Coleta e uso de dados
            </p>
            <ul className="text-xs space-y-1.5 leading-relaxed">
              <li>• Suas perguntas e interacoes sao registradas para fins educacionais</li>
              <li>• Seus dados podem ser visualizados pelo professor da disciplina</li>
              <li>• Os dados sao processados pela OpenAI (servidores nos EUA)</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              Seus direitos (LGPD)
            </p>
            <ul className="text-xs space-y-1.5 leading-relaxed">
              <li>• Voce pode solicitar a exportacao dos seus dados a qualquer momento</li>
              <li>• Voce pode solicitar a exclusao dos seus dados</li>
              <li>• Entre em contato com a instituicao para exercer seus direitos</li>
            </ul>
          </div>
        </div>

        {/* Accept button */}
        <div className="space-y-2">
          <Button
            onClick={handleAccept}
            disabled={state === 'submitting'}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {state === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando...
              </>
            ) : (
              'Li e concordo com os termos'
            )}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            Ao continuar, voce consente com o processamento de dados conforme descrito acima.
          </p>
        </div>
      </div>
    </div>
  );
}
