/**
 * Dependency-free confetti burst using the Web Animations API.
 *
 * Spawns a handful of small colored squares from the top-center of the screen,
 * lets them fan out and fall under a little gravity/rotation, then cleans up.
 * Best-effort: no-ops if the DOM or WAAPI isn't available (SSR/old browsers).
 */
const COLORS = ['#5e17eb', '#5ce1e6', '#ffd166', '#ff6b6b', '#06d6a0', '#ffffff'];

export function burstConfetti(count = 80): void {
  if (typeof document === 'undefined' || typeof document.body === 'undefined') return;

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden;';
  document.body.appendChild(container);

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.18;
  let longest = 0;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const size = 6 + Math.floor((i % 5)) * 2; // 6–14px, deterministic
    const color = COLORS[i % COLORS.length];
    piece.style.cssText =
      `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size}px;` +
      `background:${color};border-radius:${i % 3 === 0 ? '50%' : '2px'};will-change:transform,opacity;`;
    container.appendChild(piece);

    // Spread evenly across a fan, with per-piece variation from the index.
    const angle = (Math.PI * (0.15 + 0.7 * (i / count))) + (i % 7) * 0.04;
    const velocity = 140 + (i % 11) * 26;
    const dx = Math.cos(angle) * velocity * (i % 2 === 0 ? 1 : -1);
    const dy = -Math.abs(Math.sin(angle)) * velocity - 80;
    const fall = window.innerHeight * 0.9;
    const spin = 360 + (i % 6) * 180;
    const duration = 1400 + (i % 9) * 120;
    longest = Math.max(longest, duration);

    piece.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${dy}px) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${fall}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration, easing: 'cubic-bezier(0.21,0.6,0.35,1)', fill: 'forwards' },
    );
  }

  setTimeout(() => container.remove(), longest + 200);
}
