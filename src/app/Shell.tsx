/**
 * Companion shell: greeting header, course/module selector, side navigation,
 * and the active feature panel. Only features the university paid for (and the
 * token allows) are rendered.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CalendarCheck,
  ClipboardList,
  FolderOpen,
  Home as HomeIcon,
  Layers,
  MessageCircle,
  Settings as SettingsIcon,
  TrendingUp,
  GraduationCap,
  Crown,
  FlaskConical,
  ChevronUp,
} from 'lucide-react';
import { useApp } from './AppContext';
import { useResponsive } from './ResponsiveContext';
import { apiClient } from '../lib/api-client';
import { useTranslations } from '../i18n';
import ChatPanel from '../features/chat/ChatPanel';
import QuizzesPanel from '../features/quizzes/QuizzesPanel';
import AssignmentsPanel from '../features/assignments/AssignmentsPanel';
import FilesPanel from '../features/files/FilesPanel';
import SettingsPanel from '../features/settings/SettingsPanel';
import HomePanel from '../features/home/HomePanel';
import StudyPlanPanel from '../features/plan/StudyPlanPanel';
import FlashcardsPanel from '../features/flashcards/FlashcardsPanel';
import ProgressPanel from '../features/progress/ProgressPanel';
import EnemPanel from '../features/enem/EnemPanel';
import TitlesPanel from '../features/titles/TitlesPanel';
import TitleWatcher from '../features/gamification/TitleWatcher';

type Theme = 'light' | 'dark' | 'system';
export type PanelKey =
  | 'home'
  | 'chat'
  | 'plan'
  | 'flashcards'
  | 'enem'
  | 'quizzes'
  | 'assignments'
  | 'files'
  | 'progress'
  | 'titles'
  | 'settings';

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

/** Apply an opacity percent (0–100) to a #hex color → rgba(). Non-hex passes through. */
function withOpacity(color: string, opacityPercent: number): string {
  if (opacityPercent >= 100 || !color.startsWith('#')) return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = Math.max(0, Math.min(100, opacityPercent)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
  const { moduleToken, session, context, activeModuleId, activeCourse, switchModule } = useApp();
  const { compact } = useResponsive();

  // University branding from the module info (primary/secondary colors)
  const [branding, setBranding] = useState<{ primary?: string | null; secondary?: string | null }>({});
  // Chat bubble opacity (0–100, % ); 100 = fully opaque.
  const [bubbleOpacity, setBubbleOpacity] = useState(100);
  // ENEM/Vestibular tab is opt-in per course (default off) — universities hide it.
  const [enableEnem, setEnableEnem] = useState(false);
  // The course's ENEM area drives the simulado (no student picker).
  const [enemArea, setEnemArea] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const isDefault = activeModuleId === session.default_module_id;
    apiClient
      .getModuleInfo(moduleToken, isDefault ? undefined : activeModuleId)
      .then((info) => {
        if (!cancelled) {
          setBranding({
            primary: info?.appearance?.primary_color ?? null,
            secondary: info?.appearance?.secondary_color ?? null,
          });
          setEnableEnem(!!info?.enable_enem);
          setEnemArea(info?.enem_area ?? null);
          setBubbleOpacity(
            typeof info?.appearance?.bubble_opacity === 'number' ? info.appearance.bubble_opacity : 100,
          );
        }
      })
      .catch(() => {
        /* branding is cosmetic — fall back to defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [moduleToken, activeModuleId, session.default_module_id]);

  const navItems = useMemo(() => {
    const items: { key: PanelKey; label: string; icon: React.ReactNode }[] = [];
    items.push({ key: 'home', label: t('nav.home'), icon: <HomeIcon className="w-5 h-5" /> });
    if (context.features.chat) {
      items.push({ key: 'chat', label: t('nav.chat'), icon: <MessageCircle className="w-5 h-5" /> });
    }
    items.push({ key: 'plan', label: t('nav.plan'), icon: <CalendarCheck className="w-5 h-5" /> });
    items.push({ key: 'flashcards', label: t('nav.flashcards'), icon: <Layers className="w-5 h-5" /> });
    if (enableEnem) {
      items.push({ key: 'enem', label: t('nav.enem'), icon: <GraduationCap className="w-5 h-5" /> });
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
    items.push({ key: 'progress', label: t('nav.progress'), icon: <TrendingUp className="w-5 h-5" /> });
    items.push({ key: 'titles', label: t('nav.titles'), icon: <Crown className="w-5 h-5" /> });
    items.push({ key: 'settings', label: t('nav.settings'), icon: <SettingsIcon className="w-5 h-5" /> });
    return items;
  }, [context.features, enableEnem, t]);

  const defaultPanel: PanelKey =
    initialPanel && navItems.some((i) => i.key === initialPanel)
      ? initialPanel
      : navItems[0]?.key ?? 'settings';
  const [activePanel, setActivePanel] = useState<PanelKey>(defaultPanel);

  // Compact nav: keep only Home + Chat + a "More" toggle on the bar; the rest
  // appear on a second line when expanded, so nothing ever needs to scroll.
  const [navExpanded, setNavExpanded] = useState(false);
  const primaryItems = navItems.filter((i) => i.key === 'home' || i.key === 'chat');
  const secondaryItems = navItems.filter((i) => i.key !== 'home' && i.key !== 'chat');
  const secondaryActive = secondaryItems.some((i) => i.key === activePanel);

  const renderMobileNavButton = (
    item: { key: PanelKey; label: string; icon: React.ReactNode },
    collapseAfter: boolean,
  ) => {
    const isActive = activePanel === item.key;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          setActivePanel(item.key);
          if (collapseAfter) setNavExpanded(false);
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
        className={`flex min-w-0 flex-1 basis-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.625rem] font-medium leading-none transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary ring-1 ring-primary/25 dark:text-[#c4b5fd]'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="max-w-full truncate">{item.label}</span>
      </button>
    );
  };

  const firstName = session.student.first_name?.trim();
  const greeting = firstName ? t('greeting', { name: firstName }) : t('greetingAnonymous');

  // Dynamic colors: URL param > university branding > theme defaults
  const btnColor = urlColors.button ? isValidHexColor(urlColors.button) : '';
  const userMsgColor = urlColors.userMessage ? isValidHexColor(urlColors.userMessage) : '';
  const agentMsgColor =
    (urlColors.agentMessage ? isValidHexColor(urlColors.agentMessage) : '') || branding.secondary || '';

  // Brand purple (#5e17eb) as the default, matching tutoria-ui
  const sendBgColor = btnColor || branding.primary || '#5E17EB';
  const sendTextColor = sendBgColor.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff';
  const userMsgBgColor = userMsgColor || branding.primary || '#5E17EB';
  const userMsgTextColor = userMsgBgColor.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff';

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Celebrates newly-earned titles with a toast + sound */}
      <TitleWatcher />
      <style>
        {`
          .dynamic-button-color { background-color: ${sendBgColor}; color: ${sendTextColor}; }
          .dynamic-button-color:hover { background-color: ${sendBgColor}; color: ${sendTextColor}; opacity: 0.9; }
          .dynamic-agent-message-color { background-color: ${withOpacity(agentMsgColor || 'var(--muted)', bubbleOpacity)}; }
          .dynamic-user-message-color { background-color: ${withOpacity(userMsgBgColor, bubbleOpacity)}; color: ${userMsgTextColor}; }
        `}
      </style>

      {/* Staff test-mode banner: nothing done here counts toward student stats */}
      {session.is_staff && (
        <div
          className={`flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 ${
            compact ? 'px-3 py-1 text-[0.6875rem]' : 'px-5 py-1.5 text-xs'
          }`}
          role="status"
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{t('staffBanner')}</span>
        </div>
      )}

      {/* Top bar: avatar + greeting + module selector */}
      <header
        className={`flex items-center justify-between gap-2 border-b border-border/60 ${
          compact ? 'px-3 py-2' : 'px-5 py-3.5 sm:gap-3'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] font-bold text-white shadow-lg shadow-[#5e17eb]/25 ${
              compact ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
            }`}
          >
            {(session.student.first_name?.[0] || 'E').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`truncate font-semibold leading-tight ${compact ? 'text-sm' : 'text-lg'}`}>
              {greeting}
            </p>
            {activeCourse && !compact && (
              <p className="truncate text-xs text-muted-foreground">
                {activeCourse.name} · {session.university_name}
              </p>
            )}
          </div>
        </div>

        <select
          value={activeModuleId}
          onChange={(e) => switchModule(Number(e.target.value))}
          aria-label={t('moduleSelector')}
          className={`min-w-0 max-w-[45%] shrink truncate rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40 sm:max-w-[240px] ${
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
          }`}
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
        {/* Desktop: full labelled sidebar. */}
        <nav
          className="hidden shrink-0 sm:flex sm:w-56 sm:flex-col sm:gap-1.5 sm:border-r sm:border-border/60 sm:bg-sidebar sm:p-3"
          aria-label="Features"
        >
          <div className="mb-2 border-b border-border/60 px-2 pb-3">
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-[#5e17eb] to-[#5ce1e6] bg-clip-text text-transparent dark:from-[#a78bfa] dark:to-[#5ce1e6]">
              Erwin
            </span>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">TutorIA</p>
          </div>

          {navItems.map((item) => {
            const isActive = activePanel === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActivePanel(item.key)}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center justify-start gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary/20 to-primary/5 font-semibold text-primary shadow-sm ring-1 ring-primary/25 dark:text-[#c4b5fd]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}

          <div className="mt-auto px-2 pt-3">
            <p className="truncate text-[10px] text-muted-foreground/70">{session.university_name}</p>
          </div>
        </nav>

        {/*
          Compact (small embeds / mobile): a fixed bottom bar showing only Home,
          Chat and a "More" toggle — three targets that always fit on one line
          with no horizontal scrolling. Tapping More reveals the remaining
          features on a second line above; picking one collapses the bar again.
        */}
        <nav
          className="flex flex-col gap-1 border-t border-border/60 p-2 sm:hidden"
          aria-label="Features"
        >
          {navExpanded && secondaryItems.length > 0 && (
            <div className="flex flex-wrap items-stretch justify-around gap-1 border-b border-border/40 pb-2">
              {secondaryItems.map((item) => renderMobileNavButton(item, true))}
            </div>
          )}
          <div className="flex items-stretch justify-around gap-1">
            {primaryItems.map((item) => renderMobileNavButton(item, false))}
            {secondaryItems.length > 0 && (
              <button
                type="button"
                onClick={() => setNavExpanded((v) => !v)}
                aria-expanded={navExpanded}
                aria-label={t('nav.more')}
                title={t('nav.more')}
                className={`flex min-w-0 flex-1 basis-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.625rem] font-medium leading-none transition-colors ${
                  navExpanded || secondaryActive
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/25 dark:text-[#c4b5fd]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <ChevronUp className={`h-5 w-5 transition-transform duration-200 ${navExpanded ? 'rotate-180' : ''}`} />
                <span className="max-w-full truncate">{t('nav.more')}</span>
              </button>
            )}
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          {/* key={activeModuleId} forces panels to reload when the module changes —
              the visible cue that the context switched (WhatsApp model) */}
          <div key={`${activePanel}-${activeModuleId}`} className="erwin-fade-up h-full">
            {activePanel === 'home' && <HomePanel onNavigate={setActivePanel} />}
            {activePanel === 'plan' && (
              <StudyPlanPanel key={`plan-${activeCourse?.id ?? 0}`} onOpenChat={() => setActivePanel('chat')} />
            )}
            {activePanel === 'flashcards' && <FlashcardsPanel key={`fc-${activeModuleId}`} />}
            {activePanel === 'enem' && <EnemPanel area={enemArea} />}
            {activePanel === 'chat' && <ChatPanel key={`chat-${activeModuleId}`} streaming={streaming} />}
            {activePanel === 'quizzes' && (
              <QuizzesPanel key={`quiz-${activeModuleId}`} onOpenChat={() => setActivePanel('chat')} />
            )}
            {activePanel === 'assignments' && (
              <AssignmentsPanel key={`asg-${activeModuleId}`} onOpenChat={() => setActivePanel('chat')} />
            )}
            {activePanel === 'files' && <FilesPanel key={`files-${activeModuleId}`} apiBaseUrl={apiBaseUrl} />}
            {activePanel === 'progress' && <ProgressPanel key={`progress-${activeCourse?.id ?? 0}`} />}
            {activePanel === 'titles' && <TitlesPanel />}
            {activePanel === 'settings' && <SettingsPanel theme={theme} onThemeChange={onThemeChange} />}
          </div>
        </main>
      </div>
    </div>
  );
}
