import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-11 w-11 rounded-2xl',
  lg: 'h-16 w-16 rounded-3xl',
};

const textClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', showText = true, className = '' }) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <img
      src="/psscript-logo.svg"
      alt="PSScript"
      className={`${sizeClasses[size]} shadow-[0_18px_45px_rgba(124,247,212,0.22)] ring-1 ring-white/20`}
    />
    {showText && (
      <div>
        <div className={`${textClasses[size]} font-black tracking-tight text-[var(--ink-primary)]`}>
          PSScript
        </div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          AI Ops Studio
        </div>
      </div>
    )}
  </div>
);

export default BrandMark;
