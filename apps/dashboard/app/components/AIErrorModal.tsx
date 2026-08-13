'use client';

import React, { useState, useEffect } from 'react';
import type { StructuredAIError } from '@ion-ai/contracts';

interface AIErrorModalProps {
  error: StructuredAIError;
  onClose: () => void;
  onAction: (actionType: string) => void;
}

export function AIErrorModal({ error, onClose, onAction }: AIErrorModalProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(error.retryAfterSeconds ?? null);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const { category, actionableResolution, institutionSupport, provider } = error;
  const { title, description, primaryButton, secondaryButton } = actionableResolution;

  // Determine visual styling based on error category
  const isQuota = category === 'FREE_TIER_QUOTA' || category === 'GLOBAL_SHARED_KEY_QUOTA';
  const isCustomKeyQuota = category === 'CUSTOM_KEY_QUOTA';
  const isAuth = category === 'AUTHENTICATION';
  const isContext = category === 'CONTEXT_LIMIT';

  let badgeColor = 'border-amber-500/50 bg-amber-500/10 text-amber-400';
  let iconSymbol = '⚠️';

  if (isQuota) {
    badgeColor = 'border-amber-500/50 bg-amber-500/10 text-amber-400';
    iconSymbol = '⏳';
  } else if (isCustomKeyQuota || isAuth) {
    badgeColor = 'border-rose-500/50 bg-rose-500/10 text-rose-400';
    iconSymbol = '🔑';
  } else if (isContext) {
    badgeColor = 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400';
    iconSymbol = '📑';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono text-zinc-100">
      <div className="relative w-full max-w-lg overflow-hidden border border-zinc-800 bg-zinc-950 p-6 shadow-2xl corner-border">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 border text-[11px] font-bold uppercase tracking-wider ${badgeColor}`}
            >
              {iconSymbol} {category.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
              PROV: {provider.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 uppercase tracking-wider border border-transparent hover:border-zinc-800"
          >
            [ ESC ]
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="my-6 space-y-4">
          <h3 className="text-base font-bold text-zinc-100 tracking-wide">{title}</h3>

          <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>

          {/* Countdown Timer Block if present */}
          {timeLeft !== null && (
            <div className="p-3 border border-amber-500/30 bg-amber-950/20 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
                Reset Countdown:
              </span>
              <span className="font-mono font-bold text-sm text-amber-300 tracking-widest">
                {timeLeft > 0 ? formatTimer(timeLeft) : 'READY TO RETRY'}
              </span>
            </div>
          )}

          {/* Institution Contact Information (if provided) */}
          {institutionSupport &&
            (institutionSupport.institutionName ||
              institutionSupport.supportEmail ||
              institutionSupport.supportWebsite) && (
              <div className="p-3 border border-zinc-800 bg-zinc-900/60 space-y-1 text-[11px] text-zinc-300">
                <span className="font-bold text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                  INSTITUTIONAL SUPPORT CONTACT:
                </span>
                {institutionSupport.institutionName && (
                  <div>
                    • Institution:{' '}
                    <span className="text-zinc-100 font-semibold">
                      {institutionSupport.institutionName}
                    </span>
                  </div>
                )}
                {institutionSupport.supportEmail && (
                  <div>
                    • Support Email:{' '}
                    <a
                      href={`mailto:${institutionSupport.supportEmail}`}
                      className="text-emerald-400 underline"
                    >
                      {institutionSupport.supportEmail}
                    </a>
                  </div>
                )}
                {institutionSupport.supportPhone && (
                  <div>
                    • Support Phone:{' '}
                    <span className="text-zinc-200">{institutionSupport.supportPhone}</span>
                  </div>
                )}
                {institutionSupport.supportWebsite && (
                  <div>
                    • Official Portal:{' '}
                    <a
                      href={institutionSupport.supportWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline"
                    >
                      {institutionSupport.supportWebsite}
                    </a>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Action Footer Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
          <button
            onClick={() => onAction(primaryButton.action)}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg"
          >
            {primaryButton.label}
          </button>

          {secondaryButton && (
            <button
              onClick={() => onAction(secondaryButton.action)}
              className="px-4 py-2 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              {secondaryButton.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
