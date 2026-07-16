/**
 * Faceted gem emblem for each gamification tier — a pointy-top hexagon cut like
 * a gemstone, with a tier-specific gradient, crown facets and a corner shine.
 * Pure SVG, theme-agnostic, scales to any size. Replaces the placeholder emoji.
 */
import React from 'react';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'crystal';

// [dark, mid, light] stops per tier.
const PALETTE: Record<Tier, [string, string, string]> = {
  bronze: ['#7c4a1e', '#c97b34', '#f0b673'],
  silver: ['#566173', '#9aa7b8', '#e2e8f0'],
  gold: ['#9a7b0a', '#e3b91f', '#ffe9a6'],
  platinum: ['#0e6b78', '#22b8cf', '#bdf3f8'],
  diamond: ['#1e40af', '#3b82f6', '#bfdbfe'],
  crystal: ['#6d28d9', '#b65cff', '#f3c6ff'],
};

// Pointy-top hexagon, centred at (50,50).
const hex = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });

const toPath = (pts: number[][]) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

const OUTER = hex(44);
const TABLE = hex(22);

export function TierEmblem({ tier, size = 48 }: { tier: Tier; size?: number }) {
  const [dark, mid, light] = PALETTE[tier] ?? PALETTE.bronze;
  const uid = `tier-${tier}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={tier}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="45%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${uid}-table`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor={light} />
          <stop offset="70%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor={dark} floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Gem body */}
      <path d={toPath(OUTER)} fill={`url(#${uid}-body)`} filter={`url(#${uid}-glow)`} />

      {/* Crown facets: each outer vertex to its two table neighbours */}
      <g stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.8" fill="none">
        {OUTER.map((o, i) => (
          <g key={i}>
            <line x1={o[0]} y1={o[1]} x2={TABLE[i][0]} y2={TABLE[i][1]} />
            <line x1={o[0]} y1={o[1]} x2={TABLE[(i + 1) % 6][0]} y2={TABLE[(i + 1) % 6][1]} />
          </g>
        ))}
      </g>

      {/* Table facet */}
      <path d={toPath(TABLE)} fill={`url(#${uid}-table)`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.8" />

      {/* Corner shine */}
      <path
        d={`M${TABLE[5][0]},${TABLE[5][1]} L${TABLE[0][0]},${TABLE[0][1]} L${OUTER[0][0]},${OUTER[0][1]} Z`}
        fill="#ffffff"
        fillOpacity="0.25"
      />
    </svg>
  );
}
