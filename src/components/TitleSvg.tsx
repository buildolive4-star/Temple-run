import React from 'react';

export const TitleSvg: React.FC = () => {
  return (
    <svg
      viewBox="0 0 520 156"
      className="w-full max-w-[440px] h-auto select-none"
      role="img"
      aria-label="Surya Run: Temple Escape"
    >
      <defs>
        <linearGradient id="suryaGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="48%" stopColor="#f3b63f" />
          <stop offset="100%" stopColor="#b86b18" />
        </linearGradient>
        <linearGradient id="stoneTrim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#b86b18" stopOpacity="0" />
          <stop offset="50%" stopColor="#f6c453" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#b86b18" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Carved Sun Emblem */}
      <g transform="translate(260, 26)">
        <polygon points="0,-18 5,-5 18,0 5,5 0,18 -5,5 -18,0 -5,-5" fill="url(#suryaGold)" />
        <circle cx="0" cy="0" r="8" fill="#141e24" stroke="#f3b63f" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="3" fill="#ff9f2e" />
      </g>

      {/* Main Carved Title */}
      <text
        x="260"
        y="96"
        textAnchor="middle"
        fill="url(#suryaGold)"
        stroke="#221409"
        strokeWidth="5"
        paintOrder="stroke"
        style={{
          fontSize: '58px',
          fontWeight: 900,
          letterSpacing: '0.1em',
          fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
        }}
      >
        SURYA RUN
      </text>

      {/* Ornamental Divider */}
      <rect x="70" y="112" width="380" height="2" fill="url(#stoneTrim)" />

      {/* Subtitle */}
      <text
        x="260"
        y="138"
        textAnchor="middle"
        fill="#e8d8b7"
        style={{
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.42em',
        }}
      >
        TEMPLE ESCAPE
      </text>
    </svg>
  );
};
