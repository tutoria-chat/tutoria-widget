/**
 * Responsive scaling + simplified ("compact") layout for the embedded widget.
 *
 * The widget is almost always an iframe whose size the host page controls — we
 * have seen it embedded into a tiny box where students literally could not
 * reach the Chat tab. Two levers fix that, and this provider owns both:
 *
 *  1. Root-font scaling. Every dimension in the UI is rem-based off
 *     `html { font-size }`, so shrinking the root font zooms the ENTIRE
 *     interface down proportionally until it fits a Galaxy-Pocket-class screen.
 *     Scale = auto (derived from the iframe viewport) × user preference.
 *
 *  2. Compact mode. A denser layout (icon-only nav, condensed header) for very
 *     small embeds. Auto-enabled below a size threshold, and forceable by the
 *     host via `?ui=compact` (uni/plugin configuration) or by the student in
 *     Settings.
 *
 * Config precedence (highest first): URL param → stored user preference → auto.
 * Everything is defensive: no window during SSR, storage failures ignored.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Base root font-size (px) the design is authored at (mirrors global.css). */
const BASE_FONT_PX = 17;
/** Viewport width (px) at/above which no auto down-scaling happens. */
const REFERENCE_WIDTH = 380;
/** Viewport height (px) at/above which height does not force down-scaling. */
const REFERENCE_HEIGHT = 620;
/** Clamp for the automatic scale factor. */
const AUTO_MIN = 0.6;
const AUTO_MAX = 1;
/** Clamp for the user slider (multiplies the auto scale). */
export const USER_SCALE_MIN = 0.75;
export const USER_SCALE_MAX = 1.25;
/** Absolute clamp on the resulting root font-size (px). */
const FONT_MIN_PX = 9.5;
const FONT_MAX_PX = 21;
/** Below either dimension, auto-enable compact mode. */
const COMPACT_WIDTH = 340;
const COMPACT_HEIGHT = 400;

const SCALE_STORAGE_KEY = 'tutoria-ui-scale';
const COMPACT_STORAGE_KEY = 'tutoria-ui-compact';

type CompactPref = 'auto' | 'on' | 'off';

interface ResponsiveValue {
  /** Effective simplified layout on/off. */
  compact: boolean;
  /** Whether compact was forced by the host URL (student can't override). */
  compactLocked: boolean;
  /** Auto factor from the viewport (read-only, informational). */
  autoScale: number;
  /** Combined font-size actually applied (px). */
  fontPx: number;
  /** User slider value (1 = neutral). */
  userScale: number;
  setUserScale: (value: number) => void;
  /** User compact preference (ignored while compactLocked). */
  compactPref: CompactPref;
  setCompactPref: (pref: CompactPref) => void;
  viewport: { width: number; height: number };
}

const ResponsiveContext = createContext<ResponsiveValue | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredScale(): number {
  try {
    const raw = localStorage.getItem(SCALE_STORAGE_KEY);
    if (!raw) return 1;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? clamp(n, USER_SCALE_MIN, USER_SCALE_MAX) : 1;
  } catch {
    return 1;
  }
}

function readStoredCompact(): CompactPref {
  try {
    const raw = localStorage.getItem(COMPACT_STORAGE_KEY);
    return raw === 'on' || raw === 'off' ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

/** Read one-shot host overrides from the embed URL. */
function readUrlConfig(): { forcedCompact: CompactPref | null; urlScale: number | null } {
  if (typeof window === 'undefined') return { forcedCompact: null, urlScale: null };
  const params = new URLSearchParams(window.location.search);
  const ui = (params.get('ui') || '').toLowerCase();
  let forcedCompact: CompactPref | null = null;
  if (ui === 'compact' || ui === 'simple' || ui === 'simplified') forcedCompact = 'on';
  else if (ui === 'full' || ui === 'comfortable') forcedCompact = 'off';

  const scaleRaw = params.get('scale');
  let urlScale: number | null = null;
  if (scaleRaw) {
    const n = parseFloat(scaleRaw);
    if (Number.isFinite(n)) urlScale = clamp(n, USER_SCALE_MIN, USER_SCALE_MAX);
  }
  return { forcedCompact, urlScale };
}

export function ResponsiveProvider({ children }: { children: React.ReactNode }) {
  const urlConfig = useMemo(readUrlConfig, []);

  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : REFERENCE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : REFERENCE_HEIGHT,
  }));
  const [userScale, setUserScaleState] = useState<number>(
    () => urlConfig.urlScale ?? (typeof window !== 'undefined' ? readStoredScale() : 1),
  );
  const [compactPref, setCompactPrefState] = useState<CompactPref>(
    () => (typeof window !== 'undefined' ? readStoredCompact() : 'auto'),
  );

  // ── Track the iframe viewport ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  // ── Derived scale + compact ────────────────────────────────────────────────
  const autoScale = useMemo(() => {
    const byWidth = viewport.width / REFERENCE_WIDTH;
    const byHeight = viewport.height / REFERENCE_HEIGHT;
    return clamp(Math.min(byWidth, byHeight), AUTO_MIN, AUTO_MAX);
  }, [viewport.width, viewport.height]);

  const fontPx = useMemo(
    () => clamp(BASE_FONT_PX * autoScale * userScale, FONT_MIN_PX, FONT_MAX_PX),
    [autoScale, userScale],
  );

  const compactLocked = urlConfig.forcedCompact !== null;
  const compact = useMemo(() => {
    const pref = compactLocked ? (urlConfig.forcedCompact as CompactPref) : compactPref;
    if (pref === 'on') return true;
    if (pref === 'off') return false;
    return viewport.width < COMPACT_WIDTH || viewport.height < COMPACT_HEIGHT;
  }, [compactLocked, urlConfig.forcedCompact, compactPref, viewport.width, viewport.height]);

  // ── Apply to the document ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.fontSize = `${fontPx}px`;
  }, [fontPx]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('compact', compact);
  }, [compact]);

  // ── Setters (persist) ──────────────────────────────────────────────────────
  const setUserScale = useCallback((value: number) => {
    const next = clamp(value, USER_SCALE_MIN, USER_SCALE_MAX);
    setUserScaleState(next);
    try {
      localStorage.setItem(SCALE_STORAGE_KEY, String(next));
    } catch {
      /* storage unavailable in some embeds — scale just won't persist */
    }
  }, []);

  const setCompactPref = useCallback((pref: CompactPref) => {
    setCompactPrefState(pref);
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ResponsiveValue>(
    () => ({
      compact,
      compactLocked,
      autoScale,
      fontPx,
      userScale,
      setUserScale,
      compactPref,
      setCompactPref,
      viewport,
    }),
    [compact, compactLocked, autoScale, fontPx, userScale, setUserScale, compactPref, setCompactPref, viewport],
  );

  return <ResponsiveContext.Provider value={value}>{children}</ResponsiveContext.Provider>;
}

export function useResponsive(): ResponsiveValue {
  const ctx = useContext(ResponsiveContext);
  if (!ctx) throw new Error('useResponsive must be used within ResponsiveProvider');
  return ctx;
}
