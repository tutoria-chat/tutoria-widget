'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { apiClient as sharedApiClient } from '@/lib/api-client';
import { useTranslations } from '@/i18n';

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
 * - openai_cross_border_transfer: Disclosure that data is sent to third-party AI provider APIs (servers abroad).
 *   Note: the consent-key string is kept as-is for backend/record compatibility; only the user-facing wording changed.
 */
export default function ConsentGate({ moduleToken, apiBaseUrl, studentId, onConsented }: ConsentGateProps) {
  const t = useTranslations('consent');
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

      // Call API to check consent status. Use the SHARED client: it carries the
      // widget session JWT, required when moduleToken is the "session" sentinel.
      try {
        const result = await sharedApiClient.checkConsentStatus(moduleToken, studentId);

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
      await sharedApiClient.recordConsent(moduleToken, studentId, [
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
        <p className="text-sm text-muted-foreground">{t('checking')}</p>
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
          <p className="font-semibold text-foreground">{t('errorTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{loadError}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          {t('retry')}
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
            <h2 className="text-lg font-bold text-foreground">{t('title')}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>

        {/* Consent text */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              {t('aiTitle')}
            </p>
            <p className="text-xs leading-relaxed">{t('aiBody')}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              {t('dataTitle')}
            </p>
            <ul className="text-xs space-y-1.5 leading-relaxed">
              <li>• {t('dataItem1')}</li>
              <li>• {t('dataItem2')}</li>
              <li>• {t('dataItem3')}</li>
              <li>• {t('dataItem4')}</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">
              {t('rightsTitle')}
            </p>
            <ul className="text-xs space-y-1.5 leading-relaxed">
              <li>• {t('rightsItem1')}</li>
              <li>• {t('rightsItem2')}</li>
              <li>• {t('rightsItem3')}</li>
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
                {t('submitting')}
              </>
            ) : (
              t('accept')
            )}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">{t('footnote')}</p>
        </div>
      </div>
    </div>
  );
}
