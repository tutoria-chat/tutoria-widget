/**
 * Scroll helpers that move exactly ONE scroll container.
 *
 * Element.scrollIntoView() also scrolls every ancestor that is able to scroll —
 * including our overflow:hidden layout boxes and the host LMS page around the
 * iframe. In the chat that slid the whole panel up under the header after a
 * couple of messages, leaving only the input visible. Use these instead.
 */

/** Nearest ancestor that scrolls vertically (overflow-y: auto | scroll). */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/** Scroll a container all the way down. */
export function scrollToBottom(box: HTMLElement | null, behavior: ScrollBehavior = 'auto'): void {
  box?.scrollTo({ top: box.scrollHeight, behavior });
}

/** scrollIntoView({ block: 'nearest' }), but only inside el's own scroller. */
export function revealInScroller(el: HTMLElement, behavior: ScrollBehavior = 'auto'): void {
  const box = scrollParent(el);
  if (!box) return;
  const view = box.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  if (rect.top < view.top) box.scrollBy({ top: rect.top - view.top, behavior });
  else if (rect.bottom > view.bottom) box.scrollBy({ top: rect.bottom - view.bottom, behavior });
}
