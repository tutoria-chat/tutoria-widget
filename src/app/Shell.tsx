/**
 * Companion shell: greeting header, course/module selector, side navigation,
 * and the active feature panel. Only features the university paid for (and the
 * token allows) are rendered.
 */
import React, { useMemo, useState } from 'react';
import {
  Brain,
  ClipboardList,
  FolderOpen,
  MessageCircle,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useApp } from './AppContext';
import { useTranslations } from '../i18n';
import ChatPanel from '../features/chat/ChatPanel';
import QuizzesPanel from '../features/quizzes/QuizzesPanel';
import AssignmentsPanel from '../features/assignments/AssignmentsPanel';
import FilesPanel from '../features/files/FilesPanel';
import SettingsPanel from '../features/settings/SettingsPanel';

type Theme = 'light' | 'dark' | 'system';
export type PanelKey = 'chat' | 'quizzes' | 'assignments' | 'files' | 'settings';

interface ShellProps {
  apiBaseUrl: string;
  streaming: boolean;
  isDark: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  initialPanel?: PanelKey;
  urlColors: { button?: string; userMessage?: string; agentMessage?: string };
}

function isValidHexColor(value: string): string {
  const candidate = value.startsWith('#') ? value : `#${value}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate) ? candidate : '';
}

export default function Shell({
  apiBaseUrl,
  streaming,
  isDark,
  theme,
  onThemeChange,
  initialPanel,
  urlColors,
}: ShellProps) {
  const t = useTranslations('shell');
  const { session, context, activeModuleId, activeCourse, switchModule } = useApp();

  const navItems = useMemo(() => {
    const items: { key: PanelKey; label: string; icon: React.ReactNode }[] = [];
    if (context.features.chat) {
      items.push({ key: 'chat', label: t('nav.chat'), icon: <MessageCircle className="w-5 h-5" /> });
    }
    if (context.features.quizzes) {
      items.push({ key: 'quizzes', label: t('nav.quizzes'), icon: <Brain className="w-5 h-5" /> });
    }
    if (context.features.assignments) {
      items.push({ key: 'assignments', label: t('nav.assignments'), icon: <ClipboardList className="w-5 h-5" /> });
    }
    if (context.features.files) {
      items.push({ key: 'files', label: t('nav.files'), icon: <FolderOpen className="w-5 h-5" /> });
    }
    items.push({ key: 'settings', label: t('nav.settings'), icon: <SettingsIcon className="w-5 h-5" /> });
    return items;
  }, [context.features, t]);

  const defaultPanel: PanelKey =
    initialPanel && navItems.some((i) => i.key === initialPanel)
      ? initialPanel
      : navItems[0]?.key ?? 'settings';
  const [activePanel, setActivePanel] = useState<PanelKey>(defaultPanel);

  const firstName = session.student.first_name?.trim();
  const greeting = firstName ? t('greeting', { name: firstName }) : t('greetingAnonymous');

  // Dynamic colors: URL param > theme defaults (university branding can override later)
  const btnColor = urlColors.button ? isValidHexColor(urlColors.button) : '';
  const userMsgColor = urlColors.userMessage ? isValidHexColor(urlColors.userMessage) : '';
  const agentMsgColor = urlColors.agentMessage ? isValidHexColor(urlColors.agentMessage) : '';

  const sendBgColor = btnColor || (isDark ? '#FFFFFF' : '#7C3AED');
  const sendTextColor = sendBgColor.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff';
  const userMsgBgColor = userMsgColor || (isDark ? '#FFFFFF' : '#7C3AED');
  const userMsgTextColor = userMsgBgColor.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff';

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <style>
        {`
          .dynamic-button-color { background-color: ${sendBgColor}; color: ${sendTextColor}; }
          .dynamic-button-color:hover { background-color: ${sendBgColor}; color: ${sendTextColor}; opacity: 0.9; }
          .dynamic-agent-message-color { background-color: ${agentMsgColor || 'var(--accent)'}; }
          .dynamic-user-message-color { background-color: ${userMsgBgColor}; color: ${userMsgTextColor}; }
        `}
      </style>

      {/* Top bar: greeting + module selector */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-base font-semibold truncate">{greeting}</p>
          {activeCourse && (
            <p className="text-xs text-muted-foreground truncate">
              {activeCourse.name} · {session.university_name}
            </p>
          )}
        </div>

        <select
          value={activeModuleId}
          onChange={(e) => switchModule(Number(e.target.value))}
          aria-label={t('moduleSelector')}
          className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground max-w-[220px] truncate"
        >
          {context.courses.map((course) => (
            <optgroup key={course.id} label={course.name}>
              {course.modules.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </header>

      {/* Body: side nav + active panel */}
      <div className="flex flex-1 overflow-hidden max-sm:flex-col-reverse">
        <nav
          className="flex sm:flex-col gap-1 border-t sm:border-t-0 sm:border-r p-2 sm:w-44 shrink-0 max-sm:justify-around"
          aria-label="Features"
        >
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActivePanel(item.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors max-sm:flex-col max-sm:gap-0.5 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs ${
                activePanel === item.key
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-hidden">
          {/* key={activeModuleId} forces panels to reload when the module changes —
              the visible cue that the context switched (WhatsApp model) */}
          {activePanel === 'chat' && <ChatPanel key={`chat-${activeModuleId}`} streaming={streaming} />}
          {activePanel === 'quizzes' && <QuizzesPanel key={`quiz-${activeModuleId}`} />}
          {activePanel === 'assignments' && <AssignmentsPanel key={`asg-${activeModuleId}`} />}
          {activePanel === 'files' && <FilesPanel key={`files-${activeModuleId}`} apiBaseUrl={apiBaseUrl} />}
          {activePanel === 'settings' && <SettingsPanel theme={theme} onThemeChange={onThemeChange} />}
        </main>
      </div>
    </div>
  );
}
