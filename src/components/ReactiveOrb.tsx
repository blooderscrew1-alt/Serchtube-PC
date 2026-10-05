import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SystemStatus, WaveStyle, OrbStyle, Track } from '../types';
import { renderWaveStyle } from '../utils/waveRenderers';
import { OrbRenderer } from './OrbRenderers';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Sliders, Pin, ChevronUp, ChevronDown } from 'lucide-react';

interface ReactiveOrbProps {
  status: SystemStatus;
  isPlaying: boolean;
  volume: number;
  track?: Track | null;
  satelliteCount?: number;
  lastTranscript?: string;
  assistantResponse?: string;
  satelliteCommandNotification?: { nodeName: string; text?: string } | null;
  onClick?: () => void;
  opacity?: number;        // Transparencia de ondas de audio
  orbOpacity?: number;     // Transparencia del cuerpo del orbe
  orbScale?: number;       // Escala del orbe (0.4 a 3.0)
  onUpdateOrbScale?: (scale: number) => void;
  showWavesAndMic?: boolean;
  waveStyle?: WaveStyle;   // Estilo de onda animada (24 opciones)
  orbStyle?: OrbStyle;     // Estilo de orbe animado (32 opciones)
  waveScale?: number;      // Escala / tamaño de ondas (0.2 a 3.0)
  waveHeight?: number;     // Altura en px (ej. 320)
  waveFullscreen?: boolean; // Cubrir toda la pantalla
  wakeWordInfo?: { enabled: boolean; wakeWord: string; isAwaitingCommand: boolean };
}

/**
 * Animación de micrófono de alta fidelidad encerrada en el orbe seleccionado.
 * Se conmuta y se muestra de forma inmersiva ÚNICAMENTE cuando se detecta la palabra clave
 * de activación desde el micrófono local, y se cierra automáticamente al terminar la petición.
 */
const EnclosedMicListeningAnimation: React.FC<{
  size: number;
  isActive: boolean;
  colors: { primary: string; secondary: string; accent: string; glow: string };
  wakeWord?: string;
}> = ({ size, isActive, colors, wakeWord = 'música' }) => {
  return (
    <div
      className={`absolute inset-0 rounded-full overflow-hidden flex flex-col items-center justify-center transition-all duration-300 pointer-events-none select-none z-20 ${
        isActive
          ? 'opacity-100 scale-100 backdrop-blur-[2px]'
          : 'opacity-0 scale-90 pointer-events-none'
      }`}
      style={{
        background: isActive
          ? 'radial-gradient(circle, rgba(15, 23, 42, 0.88) 0%, rgba(2, 6, 23, 0.94) 70%, rgba(0, 0, 0, 0.98) 100%)'
          : 'transparent'
      }}
    >
      {/* 1. Animated Concentric Acoustic Sound Wave Rings radiating from center */}
      {isActive && (
        <>
          <div
            className="absolute rounded-full border border-red-500/60 animate-mic-pulse-ring pointer-events-none"
            style={{ width: `${Math.round(size * 0.75)}px`, height: `${Math.round(size * 0.75)}px` }}
          />
          <div
            className="absolute rounded-full border border-red-400/40 animate-mic-pulse-ring-delayed pointer-events-none"
            style={{ width: `${Math.round(size * 0.85)}px`, height: `${Math.round(size * 0.85)}px` }}
          />

          {/* 2. Rotating High-Tech HUD Perimeter Brackets & Rings */}
          <div
            className="absolute rounded-full border border-dashed border-red-500/30 animate-mic-spin-slow pointer-events-none"
            style={{ width: `${Math.round(size * 0.92)}px`, height: `${Math.round(size * 0.92)}px` }}
          />
          <div
            className="absolute rounded-full border border-dotted border-red-400/20 animate-mic-spin-reverse pointer-events-none"
            style={{ width: `${Math.round(size * 0.65)}px`, height: `${Math.round(size * 0.65)}px` }}
          />
        </>
      )}

      {/* 3. Central Ambient Glowing Aura */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-500"
        style={{
          width: `${Math.round(size * 0.55)}px`,
          height: `${Math.round(size * 0.55)}px`,
          background: `radial-gradient(circle, ${colors.primary}55 0%, ${colors.secondary}22 60%, transparent 80%)`,
          filter: 'blur(8px)'
        }}
      />

      {/* 4. Illuminated Vector Microphone Graphic with Acoustic Waves */}
      <div className="relative z-10 flex flex-col items-center justify-center animate-mic-glow">
        <div className="relative flex items-center justify-center">
          {/* Left Sound Wave Arc */}
          <svg
            className="w-5 h-8 sm:w-6 sm:h-10 text-red-400/80 -mr-1 animate-pulse"
            viewBox="0 0 24 36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M16 8 C10 13, 10 23, 16 28" />
            <path d="M22 4 C14 11, 14 25, 22 32" opacity="0.6" />
          </svg>

          {/* Central High-Tech Microphone Housing */}
          <div className="relative flex flex-col items-center justify-center px-1">
            {/* Microphone Grille / Head */}
            <div className="relative w-7 h-10 sm:w-8 sm:h-12 rounded-full bg-gradient-to-b from-white via-red-500 to-red-700 border-2 border-white/90 shadow-[0_0_20px_rgba(239,68,68,0.9)] flex items-center justify-center overflow-hidden">
              {/* Internal Mesh Texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:3px_3px] opacity-60" />
              {/* Central Glowing Capsule LED */}
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_#ffffff] animate-ping" />
            </div>

            {/* Microphone U-Bracket Stand */}
            <div className="-mt-1 w-10 sm:w-12 h-5 sm:h-6 border-b-2 border-x-2 border-red-400 rounded-b-xl flex items-center justify-center" />

            {/* Base Stem */}
            <div className="w-1.5 h-3 sm:h-4 bg-red-400/90 shadow-sm" />
            <div className="w-6 sm:w-8 h-1 sm:h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          </div>

          {/* Right Sound Wave Arc */}
          <svg
            className="w-5 h-8 sm:w-6 sm:h-10 text-red-400/80 -ml-1 animate-pulse"
            viewBox="0 0 24 36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M8 8 C14 13, 14 23, 8 28" />
            <path d="M2 4 C10 11, 10 25, 2 32" opacity="0.6" />
          </svg>
        </div>

        {/* 5. Animated Voice Equalizer Spectrum Bars nested in orb bottom */}
        <div className="flex items-end justify-center gap-1 mt-2.5 h-6">
          <div className="w-1 bg-red-400 rounded-full animate-mic-eq-1 shadow-[0_0_8px_#ef4444]" />
          <div className="w-1 bg-white rounded-full animate-mic-eq-2 shadow-[0_0_8px_#ffffff]" />
          <div className="w-1 bg-red-400 rounded-full animate-mic-eq-3 shadow-[0_0_8px_#ef4444]" />
          <div className="w-1 bg-white rounded-full animate-mic-eq-4 shadow-[0_0_8px_#ffffff]" />
          <div className="w-1 bg-red-300 rounded-full animate-mic-eq-2 shadow-[0_0_8px_#fca5a5]" />
          <div className="w-1 bg-white rounded-full animate-mic-eq-3 shadow-[0_0_8px_#ffffff]" />
          <div className="w-1 bg-red-400 rounded-full animate-mic-eq-1 shadow-[0_0_8px_#ef4444]" />
        </div>

        {/* 6. High-Tech Badge Label inside the orb */}
        <div className="mt-1 px-2.5 py-0.5 rounded-full bg-red-600/30 border border-red-400/50 shadow-md flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          <span className="text-[9px] sm:text-[10px] font-mono font-extrabold tracking-widest text-red-200 uppercase">
            ESCUCHANDO
          </span>
        </div>
      </div>
    </div>
  );
};

export const ReactiveOrb: React.FC<ReactiveOrbProps> = React.memo(({
  status,
  isPlaying,
  volume,
  track,
  satelliteCount = 0,
  lastTranscript,
  assistantResponse,
  satelliteCommandNotification,
  onClick,
  opacity = 0.85,
  orbOpacity = 1.0,
  orbScale: propOrbScale,
  onUpdateOrbScale,
  showWavesAndMic = true,
  waveStyle = 'sine_harmonic',
  orbStyle = 'classic_core',
  waveScale = 1.0,
  waveHeight = 320,
  waveFullscreen = false,
  wakeWordInfo
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbContainerRef = useRef<HTMLDivElement | null>(null);
  const showWavesAndMicRef = useRef(showWavesAndMic);
  const opacityRef = useRef(opacity);
  const waveStyleRef = useRef(waveStyle);
  const waveScaleRef = useRef(waveScale);
  const waveFullscreenRef = useRef(waveFullscreen);
  const waveHeightRef = useRef(waveHeight);

  // Size scale state (persisted in localStorage)
  const [scale, setScale] = useState<number>(() => {
    if (typeof propOrbScale === 'number' && propOrbScale > 0) return propOrbScale;
    try {
      const saved = localStorage.getItem('serchtube_reactive_orb_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.4 && val <= 3.0) return val;
      }
    } catch (_) {}
    return 1.0;
  });

  // Sync when propOrbScale changes externally
  useEffect(() => {
    if (typeof propOrbScale === 'number' && propOrbScale > 0 && Math.abs(propOrbScale - scale) > 0.01) {
      setScale(propOrbScale);
    }
  }, [propOrbScale]);

  // Hover and Interactive Sizing Controls state
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isDraggingResize, setIsDraggingResize] = useState<boolean>(false);
  const [showWheelTooltip, setShowWheelTooltip] = useState<boolean>(false);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const updateScale = useCallback((newScale: number) => {
    const clamped = Math.round(Math.max(0.4, Math.min(2.8, newScale)) * 100) / 100;
    setScale(clamped);
    try {
      localStorage.setItem('serchtube_reactive_orb_scale', clamped.toString());
    } catch (_) {}
    if (onUpdateOrbScale) {
      onUpdateOrbScale(clamped);
    }

    // Trigger visual tooltip
    setShowWheelTooltip(true);
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setShowWheelTooltip(false);
    }, 1600);
  }, [onUpdateOrbScale]);

  // Handle Mouse Wheel Zooming over Orb
  const handleOrbWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    updateScale(scale + delta);
  }, [scale, updateScale]);

  // Handle Drag Handle Resizing
  const dragCenterRef = useRef<{ cx: number; cy: number; initialDist: number; initialScale: number }>({
    cx: 0,
    cy: 0,
    initialDist: 1,
    initialScale: 1
  });

  const handleStartDragResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResize(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (orbContainerRef.current) {
      const rect = orbContainerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      dragCenterRef.current = {
        cx,
        cy,
        initialDist: Math.max(20, dist),
        initialScale: scale
      };
    }

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const curDist = Math.hypot(curX - dragCenterRef.current.cx, curY - dragCenterRef.current.cy);
      const ratio = curDist / dragCenterRef.current.initialDist;
      const nextScale = dragCenterRef.current.initialScale * ratio;
      updateScale(nextScale);
    };

    const handleEnd = () => {
      setIsDraggingResize(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // Determine orb color palette based on status in Elegant Dark theme
  const getColorScheme = () => {
    switch (status) {
      case 'listening':
        return {
          glow: 'rgba(220, 38, 38, 0.75)', // Crimson Red
          coreBorder: 'border-red-600/50',
          irisBorder: 'border-red-600/40',
          dot: 'bg-red-600 shadow-[0_0_20px_#dc2626]',
          label: 'LISTENING FOR COMMANDS...',
          labelColor: 'text-red-500',
          badge: 'bg-red-600/10 text-red-400 border-red-600/30',
          primary: '#ef4444',
          secondary: '#dc2626',
          accent: '#f87171'
        };
      case 'processing':
        return {
          glow: 'rgba(59, 130, 246, 0.7)', // Electric Blue
          coreBorder: 'border-blue-500/50',
          irisBorder: 'border-blue-500/40',
          dot: 'bg-blue-500 shadow-[0_0_20px_#3b82f6]',
          label: 'PROCESSING COMMAND...',
          labelColor: 'text-blue-400',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          primary: '#3b82f6',
          secondary: '#60a5fa',
          accent: '#93c5fd'
        };
      case 'speaking':
        return {
          glow: 'rgba(239, 68, 68, 0.7)', // Red / Crimson
          coreBorder: 'border-red-500/50',
          irisBorder: 'border-red-500/40',
          dot: 'bg-red-500 shadow-[0_0_20px_#ef4444]',
          label: 'ASSISTANT RESPONDING...',
          labelColor: 'text-red-400',
          badge: 'bg-red-500/10 text-red-400 border-red-500/30',
          primary: '#ef4444',
          secondary: '#f97316',
          accent: '#fca5a5'
        };
      case 'satellite_active':
        return {
          glow: 'rgba(34, 197, 94, 0.7)', // Green
          coreBorder: 'border-green-500/50',
          irisBorder: 'border-green-500/40',
          dot: 'bg-green-500 shadow-[0_0_20px_#22c55e]',
          label: 'REMOTE SATELLITE MIC ACTIVE',
          labelColor: 'text-green-400',
          badge: 'bg-green-500/10 text-green-400 border-green-500/30',
          primary: '#22c55e',
          secondary: '#10b981',
          accent: '#86efac'
        };
      case 'error':
        return {
          glow: 'rgba(239, 68, 68, 0.65)',
          coreBorder: 'border-red-600/60',
          irisBorder: 'border-red-600/50',
          dot: 'bg-red-600 shadow-[0_0_15px_#dc2626]',
          label: 'MIC PAUSED / RECONNECTING',
          labelColor: 'text-red-500',
          badge: 'bg-red-600/10 text-red-400 border-red-600/30',
          primary: '#dc2626',
          secondary: '#b91c1c',
          accent: '#f87171'
        };
      case 'idle':
      default:
        return {
          glow: isPlaying ? 'rgba(220, 38, 38, 0.45)' : 'rgba(255, 255, 255, 0.1)',
          coreBorder: isPlaying ? 'border-red-600/30' : 'border-white/10',
          irisBorder: isPlaying ? 'border-red-600/30' : 'border-white/10',
          dot: isPlaying ? 'bg-red-600 shadow-[0_0_15px_#dc2626]' : 'bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.4)]',
          label: isPlaying ? 'PLAYING AUDIO' : 'READY FOR YOUR COMMAND',
          labelColor: isPlaying ? 'text-red-500' : 'text-gray-400',
          badge: isPlaying ? 'bg-red-600/10 text-red-400 border-red-600/30' : 'bg-white/5 text-gray-300 border-white/10',
          primary: isPlaying ? '#ef4444' : '#06b6d4',
          secondary: isPlaying ? '#3b82f6' : '#3b82f6',
          accent: isPlaying ? '#f59e0b' : '#a855f7'
        };
    }
  };

  const colors = getColorScheme();
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const statusRef = useRef(status);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    volumeRef.current = volume;
    statusRef.current = status;
    showWavesAndMicRef.current = showWavesAndMic;
    opacityRef.current = opacity;
    waveStyleRef.current = waveStyle;
    waveScaleRef.current = waveScale;
    waveFullscreenRef.current = waveFullscreen;
    waveHeightRef.current = waveHeight;
  }, [isPlaying, volume, status, showWavesAndMic, opacity, waveStyle, waveScale, waveFullscreen, waveHeight]);

  // Draw animated audio waves matching the selected style and custom screen size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    let animationId: number;
    let step = 0;
    let lastDrawTime = 0;
    const targetInterval = 1000 / 30; // 30 FPS smooth rendering

    const resize = () => {
      if (!canvas) return;
      if (waveFullscreenRef.current) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        const rect = canvas.parentElement?.getBoundingClientRect();
        canvas.width = rect?.width || window.innerWidth;
        // Provide generous vertical headroom so wave peaks are never clipped at the top
        canvas.height = Math.max(280, (waveHeightRef.current || 320) + 100);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const render = (currentTime: number) => {
      animationId = requestAnimationFrame(render);

      if (currentTime - lastDrawTime < targetInterval) {
        return;
      }
      lastDrawTime = currentTime;

      const isWavesEnabled = showWavesAndMicRef.current !== false && opacityRef.current > 0.01;
      if (!isWavesEnabled) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const currIsPlaying = isPlayingRef.current;
      const currVolume = volumeRef.current;
      const currStatus = statusRef.current;
      const currScale = waveScaleRef.current || 1.0;
      const currStyle = waveStyleRef.current || 'sine_harmonic';

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;

      // Speed of animation based on activity
      const waveSpeed = currStatus === 'listening' ? 0.055 : (currIsPlaying ? 0.028 : 0.012);
      step += waveSpeed;

      // Dispatch to modern 24-style wave renderer
      renderWaveStyle(currStyle, {
        ctx,
        width,
        height,
        step,
        status: currStatus,
        isPlaying: currIsPlaying,
        volume: currVolume,
        scale: currScale,
        colors: {
          primary: colors.primary,
          secondary: colors.secondary,
          accent: colors.accent,
          glow: colors.glow
        }
      });
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [colors.primary, colors.secondary, colors.accent, colors.glow]);

  const baseOrbSize = 184;
  const currentOrbSize = Math.round(baseOrbSize * scale);

  return (
    <div
      className="relative w-full flex flex-col items-center justify-center py-4 select-none overflow-visible transition-all duration-300"
      style={{
        minHeight: waveFullscreen ? 'auto' : `${Math.max(240, waveHeight)}px`
      }}
    >
      {/* Background Animated Sound Waves Canvas - Extended vertical clearance to avoid top clipping */}
      <canvas
        ref={canvasRef}
        className={`${
          waveFullscreen
            ? 'fixed inset-0 w-screen h-screen z-0 pointer-events-none'
            : 'absolute -top-10 inset-x-0 w-full pointer-events-none z-0 overflow-visible'
        } transition-opacity duration-300`}
        style={{
          opacity: showWavesAndMic ? Math.max(0, Math.min(1, opacity)) : 0,
          height: waveFullscreen ? '100vh' : `${(waveHeight || 320) + 100}px`
        }}
      />

      {/* Central Interactive Reactive Orb - 32 Distinct Animated Archetypes */}
      <div
        ref={orbContainerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isDraggingResize) setIsHovered(false);
        }}
        onWheel={handleOrbWheel}
        className="group relative z-10 flex flex-col items-center overflow-visible transition-all duration-200"
        style={{
          opacity: Math.max(0, Math.min(1, orbOpacity))
        }}
      >
        {/* Hover Size Toolbar (Appears above the orb on mouse hover or when pinned) */}
        <div
          className={`absolute -top-14 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.8)] transition-all duration-300 pointer-events-auto ${
            isHovered || isPinned || isDraggingResize
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={() => updateScale(scale - 0.1)}
            disabled={scale <= 0.4}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Reducir tamaño del orbe (-10%)"
          >
            <ZoomOut size={13} />
          </button>

          {/* Slider for smooth scale adjustments */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="range"
              min="0.4"
              max="2.6"
              step="0.05"
              value={scale}
              onChange={(e) => updateScale(parseFloat(e.target.value))}
              className="w-20 sm:w-28 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 transition-all"
            />
            <span className="text-[10px] font-mono font-bold text-white min-w-[58px] text-center bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              {Math.round(scale * 100)}% <span className="text-gray-400 font-normal">({currentOrbSize}px)</span>
            </span>
          </div>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={() => updateScale(scale + 0.1)}
            disabled={scale >= 2.6}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Aumentar tamaño del orbe (+10%)"
          >
            <ZoomIn size={13} />
          </button>

          {/* Reset to 1.0x */}
          <button
            type="button"
            onClick={() => updateScale(1.0)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all text-[10px] font-bold cursor-pointer"
            title="Restablecer tamaño predeterminado (100% / 184px)"
          >
            <RotateCcw size={12} />
          </button>

          {/* Quick presets pills */}
          <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-white/10">
            {[0.7, 1.0, 1.4, 1.8, 2.2].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateScale(p)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  Math.abs(scale - p) < 0.05
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/15'
                }`}
              >
                {p}x
              </button>
            ))}
          </div>

          {/* Pin Toolbar open button */}
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg transition-all text-[10px] cursor-pointer ml-0.5 ${
              isPinned
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/15'
            }`}
            title={isPinned ? 'Desanclar barra de tamaño' : 'Mantener visible la barra de tamaño'}
          >
            <Pin size={11} className={isPinned ? 'rotate-45' : ''} />
          </button>
        </div>

        {/* Real-time Tooltip when using Mouse Wheel */}
        {showWheelTooltip && (
          <div className="absolute top-2 z-40 px-3 py-1 rounded-full bg-black/90 backdrop-blur-md border border-red-500/40 text-white text-xs font-mono font-bold shadow-lg animate-fadeIn pointer-events-none flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Tamaño: {Math.round(scale * 100)}% ({currentOrbSize}px)</span>
          </div>
        )}

        {/* Scaled Orb Wrapper with Interactive Corner Drag Handles */}
        <div
          className="relative flex items-center justify-center transition-transform duration-150"
          style={{
            width: `${currentOrbSize}px`,
            height: `${currentOrbSize}px`
          }}
        >
          {/* Active Resize Bounding Frame & Corner Handles (Visible on Hover / Drag) */}
          <div
            className={`absolute -inset-2.5 rounded-full border border-dashed transition-all duration-200 pointer-events-none ${
              isHovered || isDraggingResize
                ? 'border-red-500/50 bg-red-500/[0.03] scale-100 opacity-100 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                : 'border-transparent opacity-0 scale-95'
            }`}
          />

          {/* Corner Resize Handles */}
          {(isHovered || isDraggingResize) && (
            <>
              {/* Top Left */}
              <div
                onMouseDown={handleStartDragResize}
                onTouchStart={handleStartDragResize}
                className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black/90 border-2 border-red-500 hover:border-white shadow-lg cursor-nwse-resize z-30 flex items-center justify-center transition-transform hover:scale-125 pointer-events-auto"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              </div>

              {/* Top Right */}
              <div
                onMouseDown={handleStartDragResize}
                onTouchStart={handleStartDragResize}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/90 border-2 border-red-500 hover:border-white shadow-lg cursor-nesw-resize z-30 flex items-center justify-center transition-transform hover:scale-125 pointer-events-auto"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              </div>

              {/* Bottom Right */}
              <div
                onMouseDown={handleStartDragResize}
                onTouchStart={handleStartDragResize}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black/90 border-2 border-red-500 hover:border-white shadow-lg cursor-nwse-resize z-30 flex items-center justify-center transition-transform hover:scale-125 pointer-events-auto"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              </div>

              {/* Bottom Left */}
              <div
                onMouseDown={handleStartDragResize}
                onTouchStart={handleStartDragResize}
                className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-black/90 border-2 border-red-500 hover:border-white shadow-lg cursor-nesw-resize z-30 flex items-center justify-center transition-transform hover:scale-125 pointer-events-auto"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              </div>
            </>
          )}

          {/* Canvas Orb Renderer with dynamic pixel size */}
          <OrbRenderer
            style={orbStyle}
            status={status}
            isPlaying={isPlaying}
            volume={volume}
            track={track}
            colors={colors}
            size={currentOrbSize}
            onClick={onClick}
          />

          {/* Animación de micrófono encerrada en el orbe seleccionado (Se conmuta y aparece ÚNICAMENTE cuando se detecta la palabra clave de activación) */}
          <EnclosedMicListeningAnimation
            size={currentOrbSize}
            isActive={Boolean(wakeWordInfo?.isAwaitingCommand)}
            colors={colors}
            wakeWord={wakeWordInfo?.wakeWord || 'música'}
          />
        </div>

        {/* State Badge and Feedback Labels */}
        <div className="mt-4 flex flex-col items-center gap-2 z-10 max-w-lg text-center px-4">
          <p className={`text-xs uppercase tracking-[0.4em] font-bold ${colors.labelColor}`}>
            {colors.label}
          </p>

          {/* Wake Word Status Indicator */}
          {wakeWordInfo && wakeWordInfo.enabled && wakeWordInfo.isAwaitingCommand && (
            <div className="mt-0.5 mb-1">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/50 text-blue-300 text-xs font-mono animate-pulse shadow-md">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>⚡ ¡&ldquo;{wakeWordInfo.wakeWord}&rdquo; detectada! Escuchando orden...</span>
              </div>
            </div>
          )}

          {/* Transcript / Spoken query */}
          {lastTranscript ? (
            <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white animate-fadeIn max-w-xl truncate px-2">
              &ldquo;{lastTranscript}&rdquo;
            </h1>
          ) : satelliteCommandNotification ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 font-mono text-xs animate-fadeIn shadow-md">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Satélite {satelliteCommandNotification.nodeName}: &ldquo;{satelliteCommandNotification.text}&rdquo;</span>
            </div>
          ) : null}

          {assistantResponse && !satelliteCommandNotification && (
            <p className="text-xs sm:text-sm text-gray-400 font-normal tracking-wide max-w-md animate-fadeIn">
              {assistantResponse}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

