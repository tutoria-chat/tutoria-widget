/**
 * Accessible-dialog plumbing shared by every modal/overlay in the widget.
 *
 * Attach the returned ref to the dialog container and spread `role="dialog"
 * aria-modal="true"` (plus an `aria-labelledby` pointing at the title). On open
 * it moves focus into the dialog, traps Tab within it, and restores focus to
 * whatever was focused before it opened. Pass `onEscape` to close on Escape;
 * omit it when the modal manages Escape itself (e.g. the quiz results screen,
 * where there is intentionally no escape hatch).
 */
import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog<T extends HTMLElement = HTMLDivElement>(
  onEscape?: () => void,
  /** When false the trap is idle — for modals that early-return null while closed. */
  active = true,
) {
  const ref = useRef<T>(null);
  // Keep the latest callback without re-running the focus effect on each render.
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  const focusables = useCallback((): HTMLElement[] => {
    const root = ref.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable, else the container itself).
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      root.tabIndex = -1;
      root.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeRef.current) {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !root.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Restore focus to the opener if it's still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [focusables, active]);

  return ref;
}
