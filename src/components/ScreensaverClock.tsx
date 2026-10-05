import React from 'react';
import { ClockStyle } from '../types';

interface ScreensaverClockProps {
  style: ClockStyle;
  timeStr: string;
  amPmStr: string;
  dateStr: string;
  showSeconds: boolean;
  showDate: boolean;
}

export const ScreensaverClockRenderer: React.FC<ScreensaverClockProps> = ({
  style = 'mono',
  timeStr,
  amPmStr,
  dateStr,
  showSeconds,
  showDate
}) => {
  const parts = timeStr.split(':');
  const hours = parts[0] || '00';
  const minutes = parts[1] || '00';
  const seconds = parts[2] || '';

  switch (style) {
    // 1. DIGITAL 7-SEGMENT LED
    case 'digital':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="relative flex items-baseline justify-center gap-2 text-red-500 font-extrabold tracking-widest drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
            <span className="text-6xl sm:text-8xl md:text-9xl tracking-wider">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-4xl md:text-5xl opacity-90 text-red-400">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-lg sm:text-xl font-bold bg-red-950/70 border border-red-500/40 text-red-400 px-2 py-0.5 rounded">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-red-400/80 font-mono tracking-[0.25em] uppercase mt-2">
              {dateStr}
            </p>
          )}
        </div>
      );

    // 2. SANS-SERIF GEOMÉTRICO
    case 'sans':
      return (
        <div className="flex flex-col items-center justify-center font-sans">
          <div className="flex items-baseline justify-center gap-3 text-white font-light tracking-tight">
            <span className="text-6xl sm:text-8xl md:text-9xl font-semibold">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl font-light text-gray-400">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-lg sm:text-2xl font-bold text-red-500 tracking-wider">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-gray-300 font-medium tracking-[0.2em] uppercase mt-2">
              {dateStr}
            </p>
          )}
        </div>
      );

    // 3. SERIF EDITORIAL DE LUJO
    case 'serif':
      return (
        <div className="flex flex-col items-center justify-center font-serif">
          <div className="flex items-baseline justify-center gap-3 text-amber-100 italic tracking-normal drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            <span className="text-6xl sm:text-8xl md:text-9xl not-italic font-normal">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl not-italic text-amber-300/70 font-light">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-lg sm:text-2xl not-italic font-serif font-light text-amber-400">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-amber-200/70 font-serif tracking-[0.3em] uppercase mt-2">
              — {dateStr} —
            </p>
          )}
        </div>
      );

    // 4. FUTURISTA SCI-FI
    case 'futuristic':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="flex items-baseline justify-center gap-3 text-cyan-400 font-bold tracking-[0.15em] drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]">
            <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl text-cyan-200">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-sm sm:text-lg bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 px-2 py-0.5 rounded-lg tracking-widest">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <p className="text-xs sm:text-sm text-cyan-300/80 font-mono tracking-[0.3em] uppercase">
                {dateStr}
              </p>
            </div>
          )}
        </div>
      );

    // 5. NEÓN CYBERPUNK LED
    case 'cyber_digital':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="relative p-3 rounded-2xl bg-black/60 border border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.3)]">
            <div className="flex items-baseline justify-center gap-2 text-red-500 font-black tracking-widest drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}</span>
              <span className="text-5xl sm:text-7xl md:text-8xl text-red-400 animate-pulse">:</span>
              <span className="text-6xl sm:text-8xl md:text-9xl">{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-red-300">:{seconds}</span>
              )}
            </div>
            {amPmStr && (
              <div className="absolute top-2 right-3 text-xs font-mono font-bold text-red-400 uppercase tracking-widest">
                {amPmStr}
              </div>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-red-400 font-mono tracking-[0.3em] uppercase mt-2.5 bg-red-950/40 px-3 py-0.5 rounded-full border border-red-500/20">
              SYS • {dateStr}
            </p>
          )}
        </div>
      );

    // 6. HUD VECTORIAL TÁCTICO
    case 'futuristic_hud':
      return (
        <div className="flex flex-col items-center justify-center font-mono select-none">
          <div className="relative px-6 py-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            {/* Corner HUD Markers */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />

            <div className="flex items-center justify-between text-[9px] text-emerald-400/80 mb-1 uppercase tracking-widest">
              <span>TAC-CLK // 01</span>
              <span>AZM: 342°</span>
            </div>

            <div className="flex items-baseline justify-center gap-2 text-emerald-400 font-extrabold tracking-wider drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-emerald-300">.{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-sm font-mono text-emerald-300 font-bold ml-1">
                  [{amPmStr}]
                </span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-[11px] sm:text-xs text-emerald-400/90 font-mono tracking-[0.25em] uppercase mt-2">
              COORD // {dateStr}
            </p>
          )}
        </div>
      );

    // 7. TUBOS NIXIE VINTAGE INCANDESCENTES
    case 'retro_nixie':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            {/* Tube Hours */}
            <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-black/80 border border-amber-500/50 shadow-[inset_0_0_15px_rgba(245,158,11,0.4)] text-amber-500 font-black text-5xl sm:text-7xl md:text-8xl drop-shadow-[0_0_15px_rgba(245,158,11,0.9)]">
              {hours}
            </div>
            {/* Dual Glow Dots */}
            <div className="flex flex-col gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b] animate-ping" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b] animate-ping" />
            </div>
            {/* Tube Minutes */}
            <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-black/80 border border-amber-500/50 shadow-[inset_0_0_15px_rgba(245,158,11,0.4)] text-amber-500 font-black text-5xl sm:text-7xl md:text-8xl drop-shadow-[0_0_15px_rgba(245,158,11,0.9)]">
              {minutes}
            </div>
            {showSeconds && seconds && (
              <div className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-black/80 border border-amber-500/40 text-amber-400 font-black text-3xl sm:text-5xl drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">
                {seconds}
              </div>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-amber-300/80 font-mono tracking-[0.25em] uppercase mt-2">
              ★ {dateStr} {amPmStr ? `• ${amPmStr}` : ''} ★
            </p>
          )}
        </div>
      );

    // 8. MINIMALISTA NÓRDICO ULTRA-FINO
    case 'minimal_scandi':
      return (
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-baseline justify-center gap-4 text-white font-extralight tracking-[0.25em]">
            <span className="text-6xl sm:text-8xl md:text-9xl">{hours}</span>
            <span className="text-4xl sm:text-6xl font-thin text-gray-500">:</span>
            <span className="text-6xl sm:text-8xl md:text-9xl">{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-2xl sm:text-4xl font-thin text-gray-500">{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-sm sm:text-base font-light tracking-widest text-gray-400">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <div className="mt-3 px-4 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-[11px] sm:text-xs text-gray-300 font-light tracking-[0.3em] uppercase">
                {dateStr}
              </p>
            </div>
          )}
        </div>
      );

    // 9. PIXEL ART ARCADE 8-BIT
    case 'arcade_8bit':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="p-3 rounded-xl bg-indigo-950/50 border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <div className="text-[10px] text-indigo-300 font-mono tracking-widest uppercase mb-1 flex justify-between">
              <span>TIME // 1UP</span>
              <span>STAGE-8</span>
            </div>
            <div className="flex items-baseline justify-center gap-2 text-yellow-400 font-black tracking-widest drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <span className="text-5xl sm:text-7xl md:text-8xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-yellow-200">:{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-xs text-pink-400 font-black ml-1">{amPmStr}</span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-[10px] sm:text-xs text-yellow-300/80 font-mono tracking-[0.2em] uppercase mt-2">
              CREDIT 00 • {dateStr}
            </p>
          )}
        </div>
      );

    // 10. NEÓN TOKYO SHINJUKU
    case 'neon_tokyo':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="flex items-baseline justify-center gap-2 text-fuchsia-500 font-black tracking-widest drop-shadow-[0_0_30px_rgba(217,70,239,0.9)]">
            <span className="text-6xl sm:text-8xl md:text-9xl">{hours}</span>
            <span className="text-5xl sm:text-7xl text-cyan-400 drop-shadow-[0_0_20px_#22d3ee] animate-pulse">:</span>
            <span className="text-6xl sm:text-8xl md:text-9xl text-cyan-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.9)]">{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl text-fuchsia-300">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-base sm:text-xl text-yellow-300 font-black drop-shadow-[0_0_15px_#fde047]">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-fuchsia-300/90 font-mono tracking-[0.3em] uppercase mt-2 drop-shadow-[0_0_10px_#d946ef]">
              新宿 • {dateStr}
            </p>
          )}
        </div>
      );

    // 11. MILITAR STENCIL ZULU
    case 'military_tactical':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="p-3 sm:p-4 rounded-xl bg-stone-900 border-2 border-stone-600 shadow-2xl">
            <div className="flex items-center justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1 border-b border-stone-700 pb-1">
              <span>SERCH-MIL // ZULU</span>
              <span>SEC-OP</span>
            </div>
            <div className="flex items-baseline justify-center gap-3 text-stone-100 font-black tracking-widest">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-2xl sm:text-4xl font-bold">
                  {seconds}s
                </span>
              )}
              {amPmStr && (
                <span className="text-sm font-bold text-stone-400 uppercase">
                  {amPmStr}
                </span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-xs text-stone-400 font-mono tracking-[0.2em] uppercase mt-2">
              DTG: {dateStr}
            </p>
          )}
        </div>
      );

    // 12. CRONÓGRAFO SUIZO DE LUJO
    case 'chrono_luxury':
      return (
        <div className="flex flex-col items-center justify-center font-serif">
          <div className="relative px-6 py-4 rounded-3xl bg-gradient-to-b from-neutral-900 to-black border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <div className="text-[9px] text-amber-400/80 uppercase tracking-[0.4em] font-sans text-center mb-1">
              CHRONOMÈTRE SUISSE // 432 Hz
            </div>
            <div className="flex items-baseline justify-center gap-3 text-amber-200 font-medium tracking-normal">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-amber-400/70 font-light">.{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-base font-sans text-amber-400 font-semibold uppercase tracking-wider">
                  {amPmStr}
                </span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-amber-300/70 font-serif italic tracking-[0.25em] uppercase mt-2">
              — {dateStr} —
            </p>
          )}
        </div>
      );

    // 13. GLIFOS CÓDIGO MATRIX
    case 'matrix_glyph':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="p-3 rounded-2xl bg-black/80 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
            <div className="text-[9px] text-green-500/70 font-mono tracking-widest text-center mb-1">
              01001100 01001111 01000001 01000100
            </div>
            <div className="flex items-baseline justify-center gap-2 text-green-400 font-black tracking-widest drop-shadow-[0_0_20px_#22c55e]">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-green-200">:{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-sm font-bold text-green-300 bg-green-950 px-2 py-0.5 rounded border border-green-500/30">
                  {amPmStr}
                </span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-xs text-green-400 font-mono tracking-[0.25em] uppercase mt-2">
              ROOT // {dateStr}
            </p>
          )}
        </div>
      );

    // 14. DEPORTIVO BOLD ITALIC
    case 'bold_athletic':
      return (
        <div className="flex flex-col items-center justify-center font-sans italic">
          <div className="flex items-baseline justify-center gap-2 text-white font-black tracking-tighter">
            <span className="text-7xl sm:text-9xl md:text-[10rem] drop-shadow-[0_4px_20px_rgba(239,68,68,0.5)]">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-4xl sm:text-6xl text-red-500 not-italic font-bold">.{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-xl sm:text-2xl font-black text-red-500 not-italic uppercase ml-2">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <div className="mt-1 px-4 py-0.5 bg-red-600 text-white font-black text-xs sm:text-sm uppercase tracking-widest rounded skew-x-[-12deg]">
              {dateStr}
            </div>
          )}
        </div>
      );

    // 15. TABLILLAS ABATIBLES FLIP-CLOCK
    case 'split_flip':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {/* Hours flip card */}
            <div className="relative px-4 py-3 sm:px-6 sm:py-5 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl text-white font-bold text-6xl sm:text-8xl md:text-9xl overflow-hidden">
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10" />
              <span>{hours}</span>
            </div>
            <span className="text-4xl sm:text-6xl font-bold text-neutral-500">:</span>
            {/* Minutes flip card */}
            <div className="relative px-4 py-3 sm:px-6 sm:py-5 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl text-white font-bold text-6xl sm:text-8xl md:text-9xl overflow-hidden">
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10" />
              <span>{minutes}</span>
            </div>
            {showSeconds && seconds && (
              <div className="relative px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-neutral-800 border border-neutral-600 shadow-xl text-red-400 font-bold text-3xl sm:text-5xl overflow-hidden">
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black z-10" />
                <span>{seconds}</span>
              </div>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-neutral-300 font-mono tracking-[0.2em] uppercase mt-2.5">
              {dateStr} {amPmStr ? `• ${amPmStr}` : ''}
            </p>
          )}
        </div>
      );

    // 16. GLITCH RGB CROMÁTICO
    case 'glitch_cyber':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="relative flex items-baseline justify-center gap-2 font-black tracking-widest text-6xl sm:text-8xl md:text-9xl">
            {/* Cyan layer offset */}
            <span className="absolute -left-1 text-cyan-400 opacity-70 blur-[0.5px]">
              {hours}:{minutes}
            </span>
            {/* Red layer offset */}
            <span className="absolute -right-1 text-red-500 opacity-70 blur-[0.5px]">
              {hours}:{minutes}
            </span>
            {/* Main layer */}
            <span className="relative z-10 text-white">
              {hours}:{minutes}
            </span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl text-red-400 z-10">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-lg text-cyan-300 font-bold z-10">{amPmStr}</span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs sm:text-sm text-cyan-300 font-mono tracking-[0.3em] uppercase mt-2">
              ERR // {dateStr}
            </p>
          )}
        </div>
      );

    // 17. HOLOGRAMA LÁSER AZUL
    case 'hologram_laser':
      return (
        <div className="flex flex-col items-center justify-center font-mono select-none">
          <div className="relative px-6 py-2 rounded-2xl bg-cyan-950/20 border-y-2 border-cyan-400/60 shadow-[0_0_35px_rgba(34,211,238,0.4)]">
            <div className="flex items-baseline justify-center gap-2 text-cyan-300 font-black tracking-[0.15em] drop-shadow-[0_0_20px_#22d3ee]">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-cyan-200">.{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-base text-cyan-400 font-mono font-bold">[{amPmStr}]</span>
              )}
            </div>
            {/* Hologram scanlines effect */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
          </div>
          {showDate && dateStr && (
            <p className="text-xs text-cyan-300/90 font-mono tracking-[0.3em] uppercase mt-2">
              HOLOGRAM // {dateStr}
            </p>
          )}
        </div>
      );

    // 18. PANTALLA LCD RETRO DESPERTADOR
    case 'lcd_alarm':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="p-4 rounded-2xl bg-emerald-950/30 border-2 border-emerald-800/60 shadow-[inset_0_0_20px_rgba(6,78,59,0.5)]">
            <div className="relative flex items-baseline justify-center gap-2 text-emerald-400 font-black tracking-widest text-6xl sm:text-8xl md:text-9xl drop-shadow-[0_0_15px_#10b981]">
              <span>{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-emerald-300">:{seconds}</span>
              )}
              {amPmStr && (
                <span className="text-lg text-emerald-400 uppercase">{amPmStr}</span>
              )}
            </div>
          </div>
          {showDate && dateStr && (
            <p className="text-xs text-emerald-400/80 font-mono tracking-[0.25em] uppercase mt-2">
              LCD-AUTO • {dateStr}
            </p>
          )}
        </div>
      );

    // 19. VELOCÍMETRO DIGITAL GT
    case 'speedometer_gauge':
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="relative p-5 rounded-full border-4 border-dashed border-red-500/50 bg-black/80 shadow-[0_0_35px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">
              SPEED-CLK // GT-SPORT
            </div>
            <div className="flex items-baseline justify-center gap-2 text-white font-black tracking-tight">
              <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
              {showSeconds && seconds && (
                <span className="text-3xl sm:text-5xl text-red-500 font-bold">.{seconds}</span>
              )}
            </div>
            {amPmStr && (
              <span className="mt-1 px-3 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-widest">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-xs text-gray-400 font-mono tracking-[0.2em] uppercase mt-2">
              {dateStr}
            </p>
          )}
        </div>
      );

    // 20. MONOSPACE TÉCNICO CLÁSICO (DEFAULT)
    case 'mono':
    default:
      return (
        <div className="flex flex-col items-center justify-center font-mono">
          <div className="flex items-baseline justify-center gap-3 text-white font-bold tracking-tight">
            <span className="text-6xl sm:text-8xl md:text-9xl">{hours}:{minutes}</span>
            {showSeconds && seconds && (
              <span className="text-3xl sm:text-5xl text-gray-400">:{seconds}</span>
            )}
            {amPmStr && (
              <span className="text-xl sm:text-2xl font-mono font-bold text-red-500 uppercase">
                {amPmStr}
              </span>
            )}
          </div>
          {showDate && dateStr && (
            <p className="text-sm sm:text-base text-gray-300 font-mono uppercase tracking-[0.2em] mt-1">
              {dateStr}
            </p>
          )}
        </div>
      );
  }
};
