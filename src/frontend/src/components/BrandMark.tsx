import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  stacked?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
};

const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  showWordmark = false,
  stacked = false,
  className = '',
}) => {
  const id = React.useId();
  const gradientId = `${id}-mark-gradient`;
  const glowId = `${id}-mark-glow`;

  return (
    <div className={`inline-flex ${stacked ? 'flex-col items-center text-center' : 'items-center'} gap-3 ${className}`}>
      <div className={`brand-mark ${sizeClasses[size]}`} aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img" focusable="false" className="h-full w-full">
          <defs>
            <linearGradient id={gradientId} x1="6" y1="6" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#2563eb" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
            <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(35 13) rotate(130) scale(32)">
              <stop stopColor="#facc15" stopOpacity="0.85" />
              <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="3" y="3" width="42" height="42" rx="14" fill="#061a33" />
          <rect x="3" y="3" width="42" height="42" rx="14" fill={`url(#${glowId})`} />
          <rect x="4.5" y="4.5" width="39" height="39" rx="12.5" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" />
          <path d="M17 13h11l6 6v16H17V13Z" fill="#0f2747" stroke="#7dd3fc" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M28 13v7h6" fill="none" stroke="#7dd3fc" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13 19l5 5-5 5" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 31h8" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
          <circle cx="35" cy="12" r="3" fill="#f97316" />
          <circle cx="39" cy="19" r="2" fill="#22c55e" />
          <path d="M35 12l4 7" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      {showWordmark && (
        <div className={stacked ? '' : 'min-w-0'}>
          <div className="brand-wordmark">PSScript</div>
          <div className="brand-tagline">ScriptOps with AI</div>
        </div>
      )}
    </div>
  );
};

export default BrandMark;
