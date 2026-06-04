import React from 'react';

/**
 * Fio brand mark — a rounded-square tile with the brand-blue gradient and a
 * geometric "F" plus a small data-node accent. Scales crisply (SVG) and is
 * reused in the header, the receipt, and the favicon (src/app/icon.svg).
 *
 * `gradId` must be unique per on-page instance so the <linearGradient> fill
 * resolves correctly (and rasterizes cleanly through html-to-image on export).
 */
export function FioMark({ size = 40, gradId = 'fioGrad' }: { size?: number; gradId?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradId})`} />
      <rect x="14.5" y="12" width="7" height="23" rx="3.5" fill="#ffffff" />
      <rect x="14.5" y="12" width="20" height="7" rx="3.5" fill="#ffffff" />
      <rect x="14.5" y="21.5" width="13.5" height="6.5" rx="3.25" fill="#ffffff" />
      <rect x="29.5" y="29.5" width="6" height="6" rx="2" fill="#7dd3fc" />
    </svg>
  );
}
