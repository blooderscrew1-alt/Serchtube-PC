import React, { useState } from 'react';
import {
  Track,
  LockScreenMusicBarStyle,
  LOCKSCREEN_MUSIC_BAR_STYLES_INFO
} from '../types';
import {
  Play,
  Move,
  GripVertical,
  GripHorizontal,
  SlidersHorizontal,
  Minus,
  Plus,
  RotateCcw,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Disc,
  Radio,
  Sparkles,
  Zap,
  Music2,
  Volume2,
  Layers,
  Maximize2,
  ArrowUpDown
} from 'lucide-react';

export interface BarCustomization {
  width: number;
  heightScale: number; // 0.5 to 2.5 (1.0 default)
  offsetY: number; // distance from bottom in px
  offsetX: number; // horizontal shift in px
  bgOpacity: number; // 0.0 to 1.0
}

interface LockScreenMusicBarProps {
  style?: LockScreenMusicBarStyle;
  track: Track | null;
  lastKnownTime: number;
  barConfig: BarCustomization;
  isResizingBar: boolean;
  isDraggingPosition: boolean;
  onResumeMusic: () => void;
  onSaveBarConfig: (updated: Partial<BarCustomization>) => void;
  onStartResize: (e: React.MouseEvent | React.TouchEvent, direction: 'left' | 'right' | 'top' | 'top-right' | 'top-left') => void;
  onStartDragPosition: (e: React.MouseEvent | React.TouchEvent) => void;
  onSelectStyle: (style: LockScreenMusicBarStyle) => void;
  onToggleMusicBarVisible?: (visible: boolean) => void;
}

const formatSeconds = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const LockScreenMusicBar: React.FC<LockScreenMusicBarProps> = ({
  style = 'album_card_glass',
  track,
  lastKnownTime,
  barConfig,
  isResizingBar,
  isDraggingPosition,
  onResumeMusic,
  onSaveBarConfig,
  onStartResize,
  onStartDragPosition,
  onSelectStyle,
  onToggleMusicBarVisible
}) => {
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);

  const title = track?.title || 'Reanudar Música SerchTube';
  const artist = track?.artist || 'SerchTube HD Audio';
  const thumbnail = track?.thumbnail && !track.thumbnail.includes('placeholder')
    ? track.thumbnail
    : (track?.id ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop');

  const heightScale = typeof barConfig.heightScale === 'number' ? Math.max(0.5, Math.min(2.5, barConfig.heightScale)) : 1.0;

  const handleAdjustWidth = (delta: number) => {
    onSaveBarConfig({ width: Math.min(1150, Math.max(330, barConfig.width + delta)) });
  };

  const handleAdjustHeightScale = (delta: number) => {
    const next = Math.max(0.5, Math.min(2.5, Math.round((heightScale + delta) * 10) / 10));
    onSaveBarConfig({ heightScale: next });
  };

  const handleReset = () => {
    onSaveBarConfig({
      width: 680,
      heightScale: 1.0,
      offsetY: 0,
      offsetX: 0,
      bgOpacity: 0.85
    });
  };

  // Compute dynamic dimensions based on heightScale
  const thumbSize = Math.round(52 * heightScale);
  const vPadding = Math.round(14 * heightScale);
  const hPadding = Math.round(18 * heightScale);
  const titleFontSize = heightScale >= 1.6 ? 'text-base sm:text-lg' : heightScale >= 1.2 ? 'text-sm sm:text-base' : 'text-xs sm:text-sm';
  const subFontSize = heightScale >= 1.5 ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs';
  const btnPaddingY = Math.round(10 * Math.max(0.8, Math.min(1.6, heightScale)));
  const btnPaddingX = Math.round(18 * Math.max(0.8, Math.min(1.6, heightScale)));

  // Render internal archetype body based on selected style
  const renderStyleContent = () => {
    switch (style) {
      // 1. PÍLDORA NEÓN COMPACTA
      case 'compact_pill':
        return (
          <div className="flex items-center gap-3.5 w-full">
            {/* Spinning Mini Thumbnail */}
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-full overflow-hidden border-2 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.5)] flex-shrink-0 animate-[spin_8s_linear_infinite]"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute inset-[38%] rounded-full bg-black border border-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-white truncate uppercase tracking-wider flex items-center gap-1.5`}>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              <div className={`${subFontSize} text-gray-400 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">{artist}</span>
                <span>•</span>
                <span className="text-red-400 font-mono font-semibold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 2. VINILO RETRO GIRATORIO CON CARÁTULA CENTRAL
      case 'vinyl_turntable':
        return (
          <div className="flex items-center gap-4 w-full">
            {/* Vinyl record container */}
            <div
              style={{ width: `${thumbSize + 8}px`, height: `${thumbSize + 8}px` }}
              className="relative rounded-full bg-gradient-to-tr from-black via-zinc-900 to-neutral-800 border-2 border-zinc-700 shadow-2xl flex-shrink-0 flex items-center justify-center animate-[spin_6s_linear_infinite]"
            >
              <div className="absolute inset-1 rounded-full border border-white/10" />
              <div className="absolute inset-2.5 rounded-full border border-white/10" />
              {/* Center Album Label Thumbnail */}
              <div
                style={{ width: `${Math.round(thumbSize * 0.5)}px`, height: `${Math.round(thumbSize * 0.5)}px` }}
                className="rounded-full overflow-hidden border border-amber-400/80 shadow-md"
              >
                <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              </div>
              <div className="absolute w-2 h-2 rounded-full bg-white/90 shadow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-amber-200 truncate uppercase tracking-wide flex items-center gap-2`}>
                <Disc size={15} className="text-amber-400 animate-spin flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              <div className={`${subFontSize} text-zinc-400 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">{artist}</span>
                <span className="text-amber-400/80 font-mono">33 RPM • {formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 3. CONSOLA HUD CYBERPUNK
      case 'cyberpunk_hud':
        return (
          <div className="flex items-center gap-4 w-full font-mono">
            {/* Corner Bracket Thumbnail */}
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-xl overflow-hidden border border-cyan-400 bg-cyan-950/40 p-0.5 flex-shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover rounded-lg" />
              <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-bl">HUD</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-black text-cyan-300 truncate uppercase tracking-widest flex items-center gap-2`}>
                <Zap size={14} className="text-cyan-400 animate-pulse flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              <div className={`${subFontSize} text-cyan-400/70 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">CH: 01 // {artist}</span>
                <span className="bg-cyan-950 px-2 py-0.5 rounded border border-cyan-400/40 text-cyan-200 font-bold">
                  {formatSeconds(lastKnownTime)}
                </span>
              </div>
            </div>
          </div>
        );

      // 4. CASETE VINTAGE 80s
      case 'cassette_tape':
        return (
          <div className="flex items-center gap-4 w-full font-sans">
            <div
              style={{ width: `${Math.round(thumbSize * 1.3)}px`, height: `${thumbSize}px` }}
              className="relative rounded-xl bg-neutral-900 border-2 border-amber-600/70 shadow-lg flex-shrink-0 flex items-center justify-between px-2.5 overflow-hidden"
            >
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-400/80 animate-spin" />
              <div className="w-8 h-5 bg-black/60 border border-white/20 rounded-sm overflow-hidden flex items-center justify-center">
                <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-80" />
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-400/80 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-amber-100 truncate uppercase tracking-tight`}>
                📼 {title}
              </div>
              <div className={`${subFontSize} text-amber-300/70 truncate font-mono mt-0.5`}>
                SIDE A • {artist} • POS: {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 5. TARJETA ONDA ESPECTRAL RGB
      case 'wave_glow_card':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 to-transparent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-purple-200 truncate uppercase tracking-wider flex items-center gap-2`}>
                <Sparkles size={14} className="text-purple-400 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              {/* Animated Spectral mini bars */}
              <div className="flex items-center gap-1.5 my-1">
                {[5, 14, 9, 16, 7, 13, 8, 15, 10, 6, 12, 8].map((h, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-gradient-to-t from-purple-500 to-pink-400 rounded-full animate-pulse"
                    style={{ height: `${Math.round(h * Math.max(0.8, heightScale))}px`, animationDelay: `${idx * 0.08}s` }}
                  />
                ))}
              </div>
              <div className={`${subFontSize} text-gray-400 truncate`}>
                {artist} • <span className="text-pink-400 font-mono font-bold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 6. ISLA DINÁMICA FLOTANTE
      case 'minimal_island':
        return (
          <div className="flex items-center gap-3.5 w-full">
            <div
              style={{ width: `${Math.round(thumbSize * 0.85)}px`, height: `${Math.round(thumbSize * 0.85)}px` }}
              className="rounded-full overflow-hidden border border-white/20 flex-shrink-0 shadow-md"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-white truncate tracking-tight`}>{title}</div>
              <div className={`${subFontSize} text-gray-400 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">{artist}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                <span className="font-mono text-gray-300 font-semibold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 7. SYNTHWAVE SUNSET 1984
      case 'synthwave_neon':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-xl overflow-hidden border-2 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.6)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-fuchsia-950/80 to-transparent" />
            </div>
            <div className="flex-1 min-w-0 font-mono">
              <div className={`${titleFontSize} font-black text-fuchsia-300 truncate uppercase tracking-widest`}>
                🌴 {title}
              </div>
              <div className={`${subFontSize} text-cyan-300 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">RETROWAVE // {artist}</span>
                <span className="text-yellow-300 font-bold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 8. TERMINAL TÁCTICO DE MANDO
      case 'tactical_military':
        return (
          <div className="flex items-center gap-4 w-full font-mono">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-lg bg-stone-900 border-2 border-emerald-600/70 p-0.5 flex-shrink-0 shadow-lg"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover rounded" />
              <div className="absolute bottom-0 left-0 bg-emerald-700 text-stone-900 font-black text-[8px] px-1">MIL-SPEC</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-emerald-300 truncate uppercase tracking-wider`}>
                TACTICAL AUDIO // {title}
              </div>
              <div className={`${subFontSize} text-emerald-500/80 truncate mt-0.5`}>
                UNIT: {artist} • ELAPSED: {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 9. CONSOLA MASTER VU PRO
      case 'studio_console':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="rounded-2xl overflow-hidden border border-zinc-600 bg-zinc-900 p-0.5 flex-shrink-0 shadow-xl"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-gray-200 truncate uppercase tracking-wider flex items-center gap-2`}>
                <Volume2 size={15} className="text-red-500 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              {/* VU Meter indicators */}
              <div className="flex items-center gap-2.5 mt-1.5">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
                  <div className="w-3/5 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                </div>
                <span className="text-[10px] font-mono text-gray-400 font-bold">0 dB • {formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 10. PROYECCIÓN HOLOGRÁFICA LÁSER
      case 'hologram_wireframe':
        return (
          <div className="flex items-center gap-4 w-full font-mono">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-cyan-400/80 bg-cyan-950/50 shadow-[0_0_20px_rgba(6,182,212,0.6)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.6)_50%)] bg-[length:100%_3px] pointer-events-none" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-cyan-200 truncate uppercase tracking-widest`}>
                HOLOPROJECTION // {title}
              </div>
              <div className={`${subFontSize} text-cyan-400/80 truncate mt-0.5`}>
                SOURCE: {artist} • {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 11. COCKPIT AUTOMOTRIZ GT
      case 'car_cockpit_gauge':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded">GT</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-black text-white truncate uppercase tracking-wide`}>
                🏎️ {title}
              </div>
              <div className={`${subFontSize} text-red-400 truncate font-mono mt-0.5`}>
                REV: {artist} • TIME: {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 12. BARRA ULTRA PANORÁMICA HD
      case 'split_horizontal_bar':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${Math.round(thumbSize * 1.5)}px`, height: `${thumbSize}px` }}
              className="rounded-xl overflow-hidden border border-white/20 flex-shrink-0 shadow-lg"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-white truncate uppercase tracking-tight`}>{title}</div>
              <div className={`${subFontSize} text-gray-400 truncate flex items-center gap-2 mt-0.5`}>
                <span className="truncate">{artist}</span>
                <span className="font-mono text-red-400 font-bold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 13. CAJA CD CRISTALINA JEWEL CASE
      case 'floating_cd_jewel':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize + 4}px`, height: `${thumbSize}px` }}
              className="relative rounded-sm bg-black/40 border-2 border-white/40 shadow-2xl flex-shrink-0 p-0.5 overflow-hidden"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover shadow-inner" />
              <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-zinc-800 to-transparent border-r border-white/20" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-white truncate uppercase tracking-wide`}>
                💿 {title}
              </div>
              <div className={`${subFontSize} text-zinc-400 truncate mt-0.5`}>
                COMPACT DISC • {artist} • {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 14. LÍNEA NEÓN MINIMALISTA
      case 'neon_minimalist_line':
        return (
          <div className="flex items-center gap-3.5 w-full">
            <div
              style={{ width: `${Math.round(thumbSize * 0.9)}px`, height: `${Math.round(thumbSize * 0.9)}px` }}
              className="rounded-xl overflow-hidden border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 border-b border-red-500/40 pb-1.5">
              <div className={`${titleFontSize} font-light text-white truncate uppercase tracking-widest`}>{title}</div>
              <div className={`${subFontSize} text-gray-400 truncate mt-0.5`}>{artist} • {formatSeconds(lastKnownTime)}</div>
            </div>
          </div>
        );

      // 15. GRADIENTE AURORA BOREAL
      case 'aurora_gradient':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-emerald-200 truncate uppercase tracking-wider flex items-center gap-2`}>
                <Sparkles size={14} className="text-emerald-400 animate-pulse flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
              <div className={`${subFontSize} text-teal-300/80 truncate mt-0.5`}>
                {artist} • <span className="font-mono text-emerald-300 font-bold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );

      // 16. GAMEBOY RETRO DOT MATRIX
      case 'arcade_gameboy':
        return (
          <div className="flex items-center gap-4 w-full font-mono">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-xl bg-emerald-950 border-2 border-emerald-600 p-0.5 flex-shrink-0 shadow-lg"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-75 grayscale sepia" />
              <div className="absolute top-0 right-0 bg-emerald-600 text-black text-[8px] font-black px-1">8-BIT</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-black text-emerald-300 truncate uppercase tracking-widest`}>
                GAME // {title}
              </div>
              <div className={`${subFontSize} text-emerald-400/80 truncate mt-0.5`}>
                BGM: {artist} • TIME: {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 17. LLAMARADA SOLAR Y ORO
      case 'solar_flare_gold':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-serif font-bold text-amber-200 truncate uppercase tracking-widest`}>
                👑 {title}
              </div>
              <div className={`${subFontSize} text-amber-400/80 truncate font-mono mt-0.5`}>
                {artist} • GOLD EDITION • {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 18. STEALTH BLACKOUT OLED
      case 'stealth_blackout':
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="rounded-2xl overflow-hidden border border-neutral-800 flex-shrink-0 grayscale"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-neutral-300 truncate uppercase tracking-tight`}>{title}</div>
              <div className={`${subFontSize} text-neutral-500 truncate font-mono mt-0.5`}>{artist} • {formatSeconds(lastKnownTime)}</div>
            </div>
          </div>
        );

      // 19. CÁPSULA CUÁNTICA MATRIX
      case 'quantum_matrix_pod':
        return (
          <div className="flex items-center gap-4 w-full font-mono">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-green-500 bg-green-950/60 shadow-[0_0_20px_rgba(34,197,94,0.5)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-green-950/20" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-black text-green-300 truncate uppercase tracking-widest`}>
                POD-01 // {title}
              </div>
              <div className={`${subFontSize} text-green-400/80 truncate mt-0.5`}>
                NODE: {artist} • {formatSeconds(lastKnownTime)}
              </div>
            </div>
          </div>
        );

      // 20. TARJETA GLASSMORPHISM 3D CON PORTADA GRANDE (DEFAULT)
      case 'album_card_glass':
      default:
        return (
          <div className="flex items-center gap-4 w-full">
            <div
              style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
              className="relative rounded-2xl overflow-hidden border-2 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex-shrink-0"
            >
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-[8px] font-mono font-bold text-white border border-white/20">
                HD
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`${titleFontSize} font-bold text-white truncate uppercase tracking-tight`}>
                {title}
              </div>
              <div className={`${subFontSize} text-gray-400 truncate flex items-center gap-2 mt-1`}>
                <span className="truncate">{artist}</span>
                <span>•</span>
                <span className="text-red-400 font-mono font-semibold">{formatSeconds(lastKnownTime)}</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="relative z-20 mx-auto w-full flex items-center justify-center select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating Settings & Style Selector Popover */}
      {showSettingsPopover && (
        <div
          style={{
            transform: `translate(${barConfig.offsetX}px, -${barConfig.offsetY + 14}px)`
          }}
          className="absolute bottom-full mb-3 z-40 w-[94vw] max-w-lg bg-black/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 sm:p-5 shadow-2xl text-left space-y-4 animate-fadeIn max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-red-500" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Personalizar Dimensiones & 20 Estilos
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                title="Restablecer valores originales"
              >
                <RotateCcw size={11} />
                <span>Restablecer</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsPopover(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 1. Selector de 20 Estilos de Barra */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Layers size={13} className="text-amber-400" />
                <span>Estilo Visual de Barra:</span>
              </span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {LOCKSCREEN_MUSIC_BAR_STYLES_INFO.find(s => s.id === style)?.name || 'Cristal 3D'}
              </span>
            </div>

            {/* Grid of 20 Styles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {LOCKSCREEN_MUSIC_BAR_STYLES_INFO.map((item) => {
                const isSelected = item.id === style;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectStyle(item.id)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-600/30 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] ring-1 ring-red-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-white truncate">{item.badge}</div>
                    <div className="text-[9px] text-gray-400 truncate mt-0.5">{item.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. ALTO DE BARRA (ESCALA VERTICAL) */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-200 font-bold flex items-center gap-1.5">
                <ArrowUpDown size={14} className="text-red-400" />
                <span>Alto de Barra (Escala Vertical):</span>
              </span>
              <span className="font-mono text-red-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 text-[11px]">
                {Math.round(heightScale * 100)}% ({heightScale.toFixed(1)}x)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustHeightScale(-0.1)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                title="Reducir altura (-10%)"
              >
                <Minus size={13} />
              </button>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={heightScale}
                onChange={(e) => onSaveBarConfig({ heightScale: parseFloat(e.target.value) })}
                className="w-full accent-red-600 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleAdjustHeightScale(0.1)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                title="Aumentar altura (+10%)"
              >
                <Plus size={13} />
              </button>
            </div>
            {/* Height Presets */}
            <div className="grid grid-cols-5 gap-1 pt-1">
              {[
                { label: '0.7x Mini', val: 0.7 },
                { label: '1.0x Normal', val: 1.0 },
                { label: '1.3x Alto', val: 1.3 },
                { label: '1.7x Grande', val: 1.7 },
                { label: '2.2x Max', val: 2.2 }
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onSaveBarConfig({ heightScale: preset.val })}
                  className={`py-1 px-1 rounded text-[10px] font-mono border text-center transition-colors ${
                    Math.abs(heightScale - preset.val) < 0.08
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. ANCHO DE BARRA (LADOS) */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Ancho de Barra (Lados)</span>
              <span className="font-mono text-gray-300 text-[11px]">{barConfig.width}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustWidth(-50)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              >
                <Minus size={12} />
              </button>
              <input
                type="range"
                min="330"
                max="1150"
                step="10"
                value={barConfig.width}
                onChange={(e) => onSaveBarConfig({ width: parseInt(e.target.value, 10) })}
                className="w-full accent-red-600 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleAdjustWidth(50)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* 4. Transparencia del Fondo Negro */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-black border border-white/40" />
                Transparencia del Fondo Negro
              </span>
              <span className="font-mono text-red-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 text-[11px]">
                {Math.round(barConfig.bgOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={barConfig.bgOpacity}
              onChange={(e) => onSaveBarConfig({ bgOpacity: parseFloat(e.target.value) })}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          {/* 5. Vertical Position (Arriba / Abajo) */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Posición Vertical (Arriba / Abajo)</span>
              <span className="font-mono text-gray-300 text-[11px]">{barConfig.offsetY}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="320"
              step="5"
              value={barConfig.offsetY}
              onChange={(e) => onSaveBarConfig({ offsetY: parseInt(e.target.value, 10) })}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          {/* 6. Lateral Position */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Alineación Lateral</span>
              <span className="font-mono text-gray-300 text-[11px]">
                {barConfig.offsetX === 0 ? 'Centrado' : `${barConfig.offsetX > 0 ? '+' : ''}${barConfig.offsetX}px`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSaveBarConfig({ offsetX: -200 })}
                className={`py-1 rounded text-[10px] font-mono border flex items-center justify-center gap-1 ${
                  barConfig.offsetX === -200 ? 'bg-red-600 text-white border-red-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <AlignLeft size={11} /> Izquierda
              </button>
              <button
                type="button"
                onClick={() => onSaveBarConfig({ offsetX: 0 })}
                className={`py-1 rounded text-[10px] font-mono border flex items-center justify-center gap-1 ${
                  barConfig.offsetX === 0 ? 'bg-red-600 text-white border-red-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <AlignCenter size={11} /> Centro
              </button>
              <button
                type="button"
                onClick={() => onSaveBarConfig({ offsetX: 200 })}
                className={`py-1 rounded text-[10px] font-mono border flex items-center justify-center gap-1 ${
                  barConfig.offsetX === 200 ? 'bg-red-600 text-white border-red-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <AlignRight size={11} /> Derecha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Music Resume Bar Frame */}
      <div
        style={{
          width: `${barConfig.width}px`,
          maxWidth: '96vw',
          padding: `${vPadding}px ${hPadding}px`,
          transform: `translate(${barConfig.offsetX}px, -${barConfig.offsetY}px)`,
          backgroundColor: `rgba(0, 0, 0, ${barConfig.bgOpacity})`
        }}
        className={`relative group/bar flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-5 backdrop-blur-2xl rounded-3xl border shadow-2xl transition-[box-shadow,border-color,background-color] duration-150 ${
          isResizingBar || isDraggingPosition
            ? 'border-red-500 ring-2 ring-red-500/40 shadow-[0_0_35px_rgba(220,38,38,0.35)]'
            : 'border-white/15 hover:border-white/35'
        }`}
      >
        {/* TOP HEIGHT RESIZE HANDLE (Arrastrar hacia arriba para hacer grande a lo alto) */}
        <div
          onMouseDown={(e) => onStartResize(e, 'top')}
          onTouchStart={(e) => onStartResize(e, 'top')}
          className="hidden md:flex absolute -top-3.5 left-1/2 -translate-x-1/2 h-7 px-4 items-center justify-center cursor-ns-resize opacity-0 group-hover/bar:opacity-85 hover:!opacity-100 transition-opacity z-30"
        >
          <div className="px-2 py-0.5 rounded-lg bg-black/95 border border-white/40 text-red-400 hover:text-white shadow-2xl flex items-center gap-1 text-[10px] font-mono">
            <GripHorizontal size={13} />
            <span>Alto {Math.round(heightScale * 100)}%</span>
          </div>
        </div>

        {/* TOP-RIGHT CORNER RESIZE HANDLE (Arrastrar para redimensionar Alto y Ancho a la vez) */}
        <div
          onMouseDown={(e) => onStartResize(e, 'top-right')}
          onTouchStart={(e) => onStartResize(e, 'top-right')}
          className="hidden md:flex absolute -top-2.5 -right-2.5 w-7 h-7 rounded-xl bg-black/90 border border-white/30 text-gray-300 hover:text-white hover:border-red-500 items-center justify-center cursor-nesw-resize shadow-xl transition-all opacity-0 group-hover/bar:opacity-85 hover:!opacity-100 z-30"
        >
          <Maximize2 size={12} className="rotate-90 text-red-400" />
        </div>

        {/* TOP-LEFT CORNER RESIZE HANDLE */}
        <div
          onMouseDown={(e) => onStartResize(e, 'top-left')}
          onTouchStart={(e) => onStartResize(e, 'top-left')}
          className="hidden md:flex absolute -top-2.5 -left-2.5 w-7 h-7 rounded-xl bg-black/90 border border-white/30 text-gray-300 hover:text-white hover:border-red-500 items-center justify-center cursor-nwse-resize shadow-xl transition-all opacity-0 group-hover/bar:opacity-85 hover:!opacity-100 z-30"
        >
          <Maximize2 size={12} className="text-red-400" />
        </div>

        {/* Left drag width handle */}
        <div
          onMouseDown={(e) => onStartResize(e, 'left')}
          onTouchStart={(e) => onStartResize(e, 'left')}
          className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-12 items-center justify-center cursor-ew-resize opacity-0 group-hover/bar:opacity-75 hover:!opacity-100 transition-opacity z-30"
        >
          <div className="p-1 rounded-lg bg-black/90 border border-white/30 text-gray-300 hover:text-white shadow-xl">
            <GripVertical size={14} />
          </div>
        </div>

        {/* Drag Handle to Move Position anywhere on screen (Arriba, Abajo, Lados) */}
        <div
          onMouseDown={onStartDragPosition}
          onTouchStart={onStartDragPosition}
          className="cursor-grab active:cursor-grabbing p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Move size={Math.round(15 * Math.max(0.9, Math.min(1.4, heightScale)))} />
        </div>

        {/* Dynamic Music Style Archetype Rendering */}
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          {renderStyleContent()}
        </div>

        {/* Action Controls & Resume Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-shrink-0">
          {/* Quick Style Switcher & Height button */}
          <button
            type="button"
            onClick={() => setShowSettingsPopover((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              showSettingsPopover
                ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title="Ajustar alto, ancho, transparencia y 20 estilos"
          >
            <SlidersHorizontal size={Math.round(14 * Math.max(0.9, Math.min(1.4, heightScale)))} />
          </button>

          {/* Continuar Música button */}
          <button
            id="btn-screensaver-continue-music"
            type="button"
            onClick={onResumeMusic}
            style={{
              paddingTop: `${btnPaddingY}px`,
              paddingBottom: `${btnPaddingY}px`,
              paddingLeft: `${btnPaddingX}px`,
              paddingRight: `${btnPaddingX}px`
            }}
            className="flex items-center gap-2 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:shadow-[0_0_25px_rgba(220,38,38,0.7)] cursor-pointer"
          >
            <Play size={Math.round(13 * Math.max(0.9, Math.min(1.4, heightScale)))} fill="currentColor" />
            <span>Continuar Música</span>
          </button>
        </div>

        {/* Right drag width handle */}
        <div
          onMouseDown={(e) => onStartResize(e, 'right')}
          onTouchStart={(e) => onStartResize(e, 'right')}
          className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-12 items-center justify-center cursor-ew-resize opacity-0 group-hover/bar:opacity-75 hover:!opacity-100 transition-opacity z-30"
          title="Arrastrar para ensanchar o reducir ancho a la derecha"
        >
          <div className="p-1 rounded-lg bg-black/90 border border-white/30 text-gray-300 hover:text-white shadow-xl">
            <GripVertical size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};
