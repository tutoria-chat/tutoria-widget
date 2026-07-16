/**
 * Mode switch for the widget entry point.
 *
 * - Student companion app (module_token): the new multi-feature shell.
 * - Professor agent and UP Business modes: untouched legacy ChatForm.
 * - auth_token present (professor/admin testing a module token as themselves):
 *   legacy ChatForm, which supports the dashboard-JWT bypass without matricula.
 */
import React, { useMemo } from 'react';
import ChatForm from '../components/ChatForm';
import CompanionApp from './CompanionApp';

export default function Root({ apiBaseUrl }: { apiBaseUrl?: string }) {
  const mode = useMemo(() => {
    if (typeof window === 'undefined') return 'companion';
    const params = new URLSearchParams(window.location.search);
    if (params.get('professor_agent_token') || params.get('up_api_key')) return 'legacy';
    if (params.get('auth_token')) return 'legacy';
    return 'companion';
  }, []);

  if (mode === 'legacy') {
    return <ChatForm apiBaseUrl={apiBaseUrl} />;
  }
  return <CompanionApp apiBaseUrl={apiBaseUrl} />;
}
