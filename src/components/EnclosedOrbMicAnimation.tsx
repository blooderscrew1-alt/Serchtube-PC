import React from 'react';

interface EnclosedOrbMicAnimationProps {
  size: number; // Dimension in px (diameter of the selected orb)
  wakeWord?: string;
  isWakeWordDetected?: boolean;
  transcript?: string;
  onClick?: () => void;
}

export const EnclosedOrbMicAnimation: React.FC<EnclosedOrbMicAnimationProps> = React.memo(({
  size,
  wakeWord = 'Música',
  isWakeWordDetected = true,
  transcript,
  onClick
}) => {
  // Proportional scaling according to orb size
  const iconSize = Math.max(26, Math.min(84, Math.round(size * 0.28)));
  const showFullBadges = size >= 145;
  const showCompactBadge = size >= 110 && size < 145;

  return (
    <div
      onClick={onClick}
      role="status"
      aria-label="Micrófono activo escuchando orden"
      className="absolute inset-0 rounded-full overflow-hidden flex flex-col items-center justify-center select-none z-30 pointer-events-auto cursor-pointer animate-fadeIn"
      title={`Micrófono serchtube escuchando tras detectar "${wakeWord}". Pulsa para cancelar o habla directamente.`}
    >
      {/* 1. Dark Atmospheric Radial Vignette (Preserves orb texture beneath while guaranteeing mic contrast) */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(5,5,10,0.85)_0%,rgba(15,10,25,0.72)_55%,rgba(0,0,0,0.5)_85%,transparent_100%)] backdrop-blur-[1px] pointer-events-none" />

      {/* 2. Concentric Sonic Ripples (Acoustic audio wave propagation) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[85%] h-[85%] rounded-full border-2 border-red-500/50 animate-sonic-ripple-1 pointer-events-none" />
        <div className="w-[85%] h-[85%] rounded-full border border-red-400/40 animate-sonic-ripple-2 pointer-events-none" />
        <div className="w-[85%] h-[85%] rounded-full border border-red-300/30 animate-sonic-ripple-3 pointer-events-none" />
      </div>

      {/* 3. Outer Rotating Cyber Ring (Aligns with the orb perimeter) */}
      <div className="absolute inset-1.5 sm:inset-2.5 rounded-full border border-red-500/35 border-dashed animate-spin-slow pointer-events-none" />

      {/* 4. Glowing Enclosing Capsule Rim */}
      <div className="absolute inset-2 sm:inset-3 rounded-full border-2 border-red-500/70 shadow-[0_0_24px_rgba(239,68,68,0.5),inset_0_0_16px_rgba(239,68,68,0.3)] animate-pulse pointer-events-none" />

      {/* 5. Top HUD Badge: Keyword Trigger Indicator (Visible on medium/large orbs) */}
      {showFullBadges && (
        <div className="absolute top-[10%] z-20 px-2.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.5)] flex items-center gap-1.5 pointer-events-none">
          <span className="text-[11px] leading-none animate-bounce">⚡</span>
          <span className="text-[10px] font-mono font-bold text-red-200 tracking-wider uppercase">
            &ldquo;{wakeWord}&rdquo;
          </span>
        </div>
      )}

      {/* 6. Center Stage: High-tech Microphone & Real-time Acoustic Wave Bars */}
      <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
        {/* Left Equalizer Audio Bars */}
        <div className="flex items-center gap-0.5 sm:gap-1 h-7 sm:h-10 items-end">
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-full animate-pulse"
            style={{ height: '35%', animationDuration: '600ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-amber-400 rounded-full animate-pulse"
            style={{ height: '70%', animationDuration: '850ms', animationDelay: '150ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-300 rounded-full animate-pulse"
            style={{ height: '100%', animationDuration: '700ms', animationDelay: '300ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-full animate-pulse"
            style={{ height: '50%', animationDuration: '900ms', animationDelay: '450ms' }}
          />
        </div>

        {/* Central Luminous Condenser Microphone Icon */}
        <div className="relative flex items-center justify-center">
          {/* Radial Beacon Glow behind the mic */}
          <div className="absolute w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-red-500/25 blur-md animate-ping pointer-events-none" />

          {/* Microphone Body with Pulse Animation */}
          <div className="relative z-10 text-red-500 animate-mic-pulse flex items-center justify-center">
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_16px_rgba(239,68,68,0.9)]"
            >
              <defs>
                {/* Gradient for Mic Capsule Head */}
                <linearGradient id="micHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fca5a5" />
                  <stop offset="50%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
                {/* Gradient for Outer Stand & Arcs */}
                <linearGradient id="micStemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>

              {/* Top Capsule Head (Rounded Condenser Microphone with mesh grill details) */}
              <rect
                x="8"
                y="2"
                width="8"
                height="12"
                rx="4"
                fill="url(#micHeadGrad)"
                stroke="#fee2e2"
                strokeWidth="0.75"
              />

              {/* Horizontal Grill Accent Lines on Capsule */}
              <line x1="9" y1="5.5" x2="15" y2="5.5" stroke="#ffffff" strokeWidth="0.7" opacity="0.65" />
              <line x1="9" y1="8" x2="15" y2="8" stroke="#ffffff" strokeWidth="0.7" opacity="0.65" />
              <line x1="9" y1="10.5" x2="15" y2="10.5" stroke="#ffffff" strokeWidth="0.7" opacity="0.65" />

              {/* Outer Acoustic Pickup Arc (Cradle U-shape) */}
              <path
                d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10"
                stroke="url(#micStemGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Vertical Mic Stem Base */}
              <line
                x1="12"
                y1="17"
                x2="12"
                y2="21"
                stroke="url(#micStemGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Bottom Support Pedestal Bar */}
              <line
                x1="8"
                y1="21"
                x2="16"
                y2="21"
                stroke="url(#micStemGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Radio Wave Arcs radiating outward from the mic top */}
              <path
                d="M3 6.5C3 6.5 4.5 4 7 3"
                stroke="#fca5a5"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.8"
                className="animate-pulse"
              />
              <path
                d="M21 6.5C21 6.5 19.5 4 17 3"
                stroke="#fca5a5"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.8"
                className="animate-pulse"
              />
            </svg>
          </div>
        </div>

        {/* Right Equalizer Audio Bars (Mirrored) */}
        <div className="flex items-center gap-0.5 sm:gap-1 h-7 sm:h-10 items-end">
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-full animate-pulse"
            style={{ height: '50%', animationDuration: '900ms', animationDelay: '400ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-300 rounded-full animate-pulse"
            style={{ height: '100%', animationDuration: '700ms', animationDelay: '250ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-amber-400 rounded-full animate-pulse"
            style={{ height: '70%', animationDuration: '850ms', animationDelay: '100ms' }}
          />
          <span
            className="w-0.5 sm:w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-full animate-pulse"
            style={{ height: '35%', animationDuration: '600ms' }}
          />
        </div>
      </div>

      {/* 7. Bottom HUD Badge: "ESCUCHANDO..." with Live Recording Ping Dot */}
      {showFullBadges ? (
        <div className="absolute bottom-[11%] z-20 flex flex-col items-center pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/85 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-red-200 uppercase">
              ESCUCHANDO...
            </span>
          </div>
        </div>
      ) : showCompactBadge ? (
        <div className="absolute bottom-[8%] z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 border border-red-500/40 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-[8px] font-mono font-bold text-red-300">REC</span>
        </div>
      ) : null}
    </div>
  );
});
