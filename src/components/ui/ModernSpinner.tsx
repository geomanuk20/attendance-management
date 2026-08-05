import React from 'react';
import { ShieldCheck, Sparkles, Loader2 } from 'lucide-react';

interface ModernSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
}

export function ModernSpinner({
  label = 'Loading System Data...',
  size = 'md',
  fullScreen = false
}: ModernSpinnerProps) {
  const sizeMap = {
    sm: { box: 'w-8 h-8', ring1: 'w-8 h-8', ring2: 'w-5 h-5', icon: 'h-3.5 w-3.5' },
    md: { box: 'w-12 h-12', ring1: 'w-12 h-12', ring2: 'w-8 h-8', icon: 'h-5 w-5' },
    lg: { box: 'w-16 h-16', ring1: 'w-16 h-16', ring2: 'w-11 h-11', icon: 'h-7 w-7' },
    xl: { box: 'w-20 h-20', ring1: 'w-20 h-20', ring2: 'w-14 h-14', icon: 'h-9 w-9' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
      {/* Multi-layered Glowing Futuristic Spinner */}
      <div className={`relative flex items-center justify-center ${currentSize.box}`}>
        {/* Outer Pulsing Glow aura */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 blur-lg opacity-45 animate-pulse" />

        {/* Outer Rotating Gradient Ring */}
        <div
          className={`absolute ${currentSize.ring1} rounded-full border-2 border-transparent border-t-cyan-400 border-r-indigo-500 border-b-purple-500 animate-spin`}
          style={{ animationDuration: '1.2s' }}
        />

        {/* Inner Counter-Rotating Ring */}
        <div
          className={`absolute ${currentSize.ring2} rounded-full border-2 border-transparent border-t-pink-500 border-l-emerald-400 animate-spin`}
          style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}
        />

        {/* Center Glowing Icon Core */}
        <div className="relative z-10 flex items-center justify-center rounded-full bg-slate-950 p-2 shadow-inner">
          <ShieldCheck className={`${currentSize.icon} text-cyan-400 animate-pulse`} />
        </div>
      </div>

      {/* Modern Gradient Shimmer Text */}
      {label && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-sm font-semibold tracking-wide bg-gradient-to-r from-slate-200 via-indigo-200 to-cyan-300 bg-clip-text text-transparent animate-pulse">
            {label}
          </span>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-all duration-300">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

export function InlineSpinner({ label = 'Processing...' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-semibold text-slate-300">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
      <span>{label}</span>
    </div>
  );
}
