import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScreensaverConfig,
  Track,
  ClockFont,
  ClockStyle,
  ClockFormat,
  TimeOfDaySlot,
  LockScreenMusicBarStyle,
  CLOCK_STYLES_INFO,
  LOCKSCREEN_MUSIC_BAR_STYLES_INFO
} from '../types';
import {
  Volume2,
  VolumeX,
  Moon,
  Play,
  Power,
  Clock,
  Settings2,
  Check,
  Eye,
  EyeOff,
  Type,
  Sunrise,
  Sun,
  Sparkles,
  SlidersHorizontal,
  X,
  Minus,
  Plus,
  Move,
  RotateCcw,
  Maximize2,
  Music2,
  Layers,
  UserCheck,
  MousePointerClick,
  Tv,
  QrCode,
  Smartphone,
  RefreshCw,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { extractYouTubeId } from '../utils/youtube';
import { ScreensaverClockRenderer } from './ScreensaverClock';
import { LockScreenMusicBar } from './LockScreenMusicBar';
import { YouTubeAuthModal } from './YouTubeAuthModal';
import { ScreensaverBackgroundVideo } from './ScreensaverBackgroundVideo';
import { QRCodeSVG } from 'qrcode.react';
import { NodeSyncService } from '../services/nodeSync';
import { detectRealDeviceIp } from '../utils/networkIp';

interface ScreensaverOverlayProps {
  config: ScreensaverConfig;
  lastKnownTrack: Track | null;
  lastKnownTime: number;
  onResumeMusic: () => void;
  onDismiss: () => void;
  onUpdateConfig: (updated: Partial<ScreensaverConfig>) => void;
}

export const TIME_OF_DAY_SLOTS = [
  {
    slot: 'morning' as const,
    label: 'Mañana',
    hours: '06:00 - 12:00',
    theme: 'Amanecer Relajante & Lofi',
    defaultVideo: 'wA0C0u6624Q',
    icon: Sunrise
  },
  {
    slot: 'afternoon' as const,
    label: 'Tarde',
    hours: '12:00 - 19:00',
    theme: 'Carretera Soleada & Retrowave',
    defaultVideo: 'MV_3Dpw-BRY',
    icon: Sun
  },
  {
    slot: 'night' as const,
    label: 'Noche',
    hours: '19:00 - 00:00',
    theme: 'Ciudad Nocturna & Luces Neón 4K',
    defaultVideo: 'f02mOEt11OQ',
    icon: Moon
  },
  {
    slot: 'late_night' as const,
    label: 'Madrugada',
    hours: '00:00 - 06:00',
    theme: 'Cosmos Profundo 432Hz & Nebulosa',
    defaultVideo: 'WPni755-Krg',
    icon: Sparkles
  }
];

export const getAutoTimeSlot = (hour: number): 'morning' | 'afternoon' | 'night' | 'late_night' => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  if (hour >= 19 && hour < 24) return 'night';
  return 'late_night';
};

export const RECOMMENDED_AMBIENT_LOOPS = [
  { id: 'MV_3Dpw-BRY', name: 'Carretera Retrowave Sunset', desc: 'Loop fluido 60fps sin cortes' },
  { id: 'f02mOEt11OQ', name: 'Tokyo Night Drive', desc: 'Luces nocturnas y ciudad' },
  { id: 'wA0C0u6624Q', name: 'Amanecer Lofi Beats', desc: 'Chillhop relajante' },
  { id: 'WPni755-Krg', name: 'Cosmos & Nebulosa 432Hz', desc: 'Espacio profundo relajante' },
  { id: 'mPZkdNFkN8A', name: 'Lluvia en Ventana', desc: 'Ambiente acústico y pacífico' },
  { id: 'L_LUpnjgPso', name: 'Chimenea Acogedora', desc: 'Fuego relajante para descansar' },
  { id: 'jfKfPfyJRdk', name: 'Lofi Girl Estudiando', desc: 'Clásico lofi sin cortes' },
  { id: '5qap5aO4i9A', name: 'Cyberpunk Noche Lluviosa', desc: 'Neón futurista y lluvia' }
];

interface BarCustomization {
  width: number;
  heightScale: number; // 0.5 to 2.5
  offsetY: number; // distance from bottom in px
  offsetX: number; // horizontal shift in px
  bgOpacity: number; // 0.0 to 1.0
}

const DEFAULT_BAR_CONFIG: BarCustomization = {
  width: 680,
  heightScale: 1.0,
  offsetY: 0,
  offsetX: 0,
  bgOpacity: 0.85
};

interface ClockCustomization {
  scale: number; // 0.4 to 3.0
  offsetX: number; // horizontal shift in px from center
  offsetY: number; // vertical shift in px from center
}

const DEFAULT_CLOCK_CONFIG: ClockCustomization = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0
};

interface QrCustomization {
  scale: number; // 0.4 to 3.2
  offsetX: number; // horizontal shift in px
  offsetY: number; // vertical shift in px
  bgOpacity: number; // 0.0 to 1.0 (0.0 = totalmente transparente sin fondo negro)
  hideText: boolean; // true = quitar letras y dejar solo el QR limpio
}

const DEFAULT_QR_CONFIG: QrCustomization = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  bgOpacity: 0.90,
  hideText: false
};

const ScreensaverOverlayComponent: React.FC<ScreensaverOverlayProps> = ({
  config,
  lastKnownTrack,
  lastKnownTime,
  onResumeMusic,
  onDismiss,
  onUpdateConfig
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [amPmStr, setAmPmStr] = useState<string>('');
  const [currentHour, setCurrentHour] = useState<number>(new Date().getHours());
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [showControlsBar, setShowControlsBar] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState<boolean>(false);
  const [reloadVideoTrigger, setReloadVideoTrigger] = useState<number>(0);
  const [videoStatus, setVideoStatus] = useState<'playing' | 'buffering' | 'stalled' | 'ready'>('ready');

  const handleReloadVideo = useCallback(() => {
    setReloadVideoTrigger(k => k + 1);
  }, []);

  const [localIp, setLocalIp] = useState<string>(() => {
    try {
      return localStorage.getItem('serchtube_local_ip') || '';
    } catch {
      return '';
    }
  });
  const [detectedIp, setDetectedIp] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    detectRealDeviceIp()
      .then(res => {
        if (!isMounted) return;
        if (res.primaryIp) {
          setDetectedIp(res.primaryIp);
          if (!localIp || localIp === '192.168.1.100') {
            setLocalIp(res.primaryIp);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [localIp]);

  const lockScreenRemoteUrl = React.useMemo(() => {
    const activeRoom = (typeof window !== 'undefined' && localStorage.getItem('serchtube_room')) || NodeSyncService.getInstance().getConfig().room || 'serchtube-master';
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0');

    if (!isLocalhost && typeof window !== 'undefined') {
      return `${window.location.origin}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
    }

    const bestIp = localIp || detectedIp || '192.168.1.100';
    const port = (typeof window !== 'undefined' && window.location.port) ? window.location.port : '3000';
    return `http://${bestIp}:${port}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
  }, [localIp, detectedIp]);

  // Resizable and repositionable music resume bar state (saved in localStorage)
  const [barConfig, setBarConfig] = useState<BarCustomization>(() => {
    try {
      const saved = localStorage.getItem('serchtube_screensaver_music_bar_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          width: typeof parsed.width === 'number' ? Math.max(320, Math.min(1150, parsed.width)) : DEFAULT_BAR_CONFIG.width,
          heightScale: typeof parsed.heightScale === 'number' ? Math.max(0.5, Math.min(2.5, parsed.heightScale)) : DEFAULT_BAR_CONFIG.heightScale,
          offsetY: typeof parsed.offsetY === 'number' ? Math.max(0, Math.min(350, parsed.offsetY)) : DEFAULT_BAR_CONFIG.offsetY,
          offsetX: typeof parsed.offsetX === 'number' ? Math.max(-400, Math.min(400, parsed.offsetX)) : DEFAULT_BAR_CONFIG.offsetX,
          bgOpacity: typeof parsed.bgOpacity === 'number' ? Math.max(0, Math.min(1, parsed.bgOpacity)) : DEFAULT_BAR_CONFIG.bgOpacity
        };
      }
    } catch (_) {}
    return DEFAULT_BAR_CONFIG;
  });

  const saveBarConfig = (updated: Partial<BarCustomization>) => {
    setBarConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_screensaver_music_bar_customization', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const [isResizingBar, setIsResizingBar] = useState<boolean>(false);
  const [isDraggingPosition, setIsDraggingPosition] = useState<boolean>(false);

  const resizeStartXRef = useRef<number>(0);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);
  const resizeStartHeightScaleRef = useRef<number>(1.0);

  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragStartOffsetXRef = useRef<number>(0);
  const dragStartOffsetYRef = useRef<number>(0);

  // Handle horizontal & vertical & corner drag resizing
  const handleStartResize = (
    e: React.MouseEvent | React.TouchEvent,
    direction: 'right' | 'left' | 'top' | 'top-right' | 'top-left'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingBar(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeStartXRef.current = clientX;
    resizeStartYRef.current = clientY;
    resizeStartWidthRef.current = barConfig.width;
    resizeStartHeightScaleRef.current = barConfig.heightScale || 1.0;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = currentX - resizeStartXRef.current;
      const deltaY = resizeStartYRef.current - currentY; // positive when dragging upwards

      const updates: Partial<BarCustomization> = {};

      if (direction === 'right' || direction === 'top-right') {
        const newWidth = Math.min(1150, Math.max(330, resizeStartWidthRef.current + deltaX * 2));
        updates.width = Math.round(newWidth);
      } else if (direction === 'left' || direction === 'top-left') {
        const newWidth = Math.min(1150, Math.max(330, resizeStartWidthRef.current - deltaX * 2));
        updates.width = Math.round(newWidth);
      }

      if (direction === 'top' || direction === 'top-right' || direction === 'top-left') {
        const newHeightScale = Math.min(2.5, Math.max(0.5, resizeStartHeightScaleRef.current + (deltaY / 120)));
        updates.heightScale = Math.round(newHeightScale * 100) / 100;
      }

      if (Object.keys(updates).length > 0) {
        saveBarConfig(updates);
      }
    };

    const handleEnd = () => {
      setIsResizingBar(false);
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

  // Handle free dragging of position (Arriba, Abajo, Lados)
  const handleStartDragPosition = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPosition(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragStartOffsetXRef.current = barConfig.offsetX;
    dragStartOffsetYRef.current = barConfig.offsetY;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - dragStartXRef.current;
      const deltaY = dragStartYRef.current - currentY;

      const newOffsetX = Math.max(-400, Math.min(400, dragStartOffsetXRef.current + deltaX));
      const newOffsetY = Math.max(0, Math.min(350, dragStartOffsetYRef.current + deltaY));

      saveBarConfig({
        offsetX: Math.round(newOffsetX),
        offsetY: Math.round(newOffsetY)
      });
    };

    const handleEnd = () => {
      setIsDraggingPosition(false);
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

  // Resizable and freely movable clock state (saved in localStorage and synced with config)
  const [clockConfig, setClockConfig] = useState<ClockCustomization>(() => {
    try {
      const saved = localStorage.getItem('serchtube_screensaver_clock_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          scale: typeof parsed.scale === 'number' ? Math.max(0.35, Math.min(3.2, parsed.scale)) : (config.clockScale || DEFAULT_CLOCK_CONFIG.scale),
          offsetX: typeof parsed.offsetX === 'number' ? Math.max(-1200, Math.min(1200, parsed.offsetX)) : (config.clockOffsetX || DEFAULT_CLOCK_CONFIG.offsetX),
          offsetY: typeof parsed.offsetY === 'number' ? Math.max(-800, Math.min(800, parsed.offsetY)) : (config.clockOffsetY || DEFAULT_CLOCK_CONFIG.offsetY)
        };
      }
    } catch (_) {}
    return {
      scale: config.clockScale || DEFAULT_CLOCK_CONFIG.scale,
      offsetX: config.clockOffsetX || DEFAULT_CLOCK_CONFIG.offsetX,
      offsetY: config.clockOffsetY || DEFAULT_CLOCK_CONFIG.offsetY
    };
  });

  const saveClockConfig = (updated: Partial<ClockCustomization>) => {
    setClockConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_screensaver_clock_customization', JSON.stringify(next));
      } catch (_) {}
      onUpdateConfig({
        clockScale: next.scale,
        clockOffsetX: next.offsetX,
        clockOffsetY: next.offsetY
      });
      return next;
    });
  };

  const [isDraggingClock, setIsDraggingClock] = useState<boolean>(false);
  const [isResizingClock, setIsResizingClock] = useState<boolean>(false);
  const [showClockToolbar, setShowClockToolbar] = useState<boolean>(false);

  const clockDragStartXRef = useRef<number>(0);
  const clockDragStartYRef = useRef<number>(0);
  const clockDragStartOffsetXRef = useRef<number>(0);
  const clockDragStartOffsetYRef = useRef<number>(0);

  const clockResizeStartXRef = useRef<number>(0);
  const clockResizeStartYRef = useRef<number>(0);
  const clockResizeStartScaleRef = useRef<number>(1.0);

  // Handle free dragging of clock position
  const handleStartClockDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingClock(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    clockDragStartXRef.current = clientX;
    clockDragStartYRef.current = clientY;
    clockDragStartOffsetXRef.current = clockConfig.offsetX;
    clockDragStartOffsetYRef.current = clockConfig.offsetY;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - clockDragStartXRef.current;
      const deltaY = currentY - clockDragStartYRef.current;

      const newOffsetX = Math.max(-1200, Math.min(1200, clockDragStartOffsetXRef.current + deltaX));
      const newOffsetY = Math.max(-800, Math.min(800, clockDragStartOffsetYRef.current + deltaY));

      saveClockConfig({
        offsetX: Math.round(newOffsetX),
        offsetY: Math.round(newOffsetY)
      });
    };

    const handleEnd = () => {
      setIsDraggingClock(false);
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

  // Handle corner drag-resizing of clock
  const handleStartClockResize = (e: React.MouseEvent | React.TouchEvent, corner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingClock(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    clockResizeStartXRef.current = clientX;
    clockResizeStartYRef.current = clientY;
    clockResizeStartScaleRef.current = clockConfig.scale;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - clockResizeStartXRef.current;
      const deltaY = currentY - clockResizeStartYRef.current;

      const factor = (corner === 'bottom-right' || corner === 'top-left')
        ? (deltaX + deltaY) / 280
        : (deltaX - deltaY) / 280;

      const newScale = Math.max(0.35, Math.min(3.2, clockResizeStartScaleRef.current + factor));
      saveClockConfig({
        scale: Math.round(newScale * 100) / 100
      });
    };

    const handleEnd = () => {
      setIsResizingClock(false);
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

  const handleAdjustClockScale = (delta: number) => {
    saveClockConfig({
      scale: Math.max(0.35, Math.min(3.2, Math.round((clockConfig.scale + delta) * 10) / 10))
    });
  };

  const handleResetClock = () => {
    saveClockConfig(DEFAULT_CLOCK_CONFIG);
  };

  // Freely movable & resizable Lock Screen QR Code state (saved in localStorage & config)
  const [qrConfig, setQrConfig] = useState<QrCustomization>(() => {
    try {
      const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          scale: typeof parsed.scale === 'number' ? Math.max(0.4, Math.min(3.2, parsed.scale)) : (config.qrScale || DEFAULT_QR_CONFIG.scale),
          offsetX: typeof parsed.offsetX === 'number' ? Math.max(-1200, Math.min(1200, parsed.offsetX)) : (config.qrOffsetX || DEFAULT_QR_CONFIG.offsetX),
          offsetY: typeof parsed.offsetY === 'number' ? Math.max(-800, Math.min(800, parsed.offsetY)) : (config.qrOffsetY || DEFAULT_QR_CONFIG.offsetY),
          bgOpacity: typeof parsed.bgOpacity === 'number' ? Math.max(0.0, Math.min(1.0, parsed.bgOpacity)) : (config.qrBgOpacity ?? DEFAULT_QR_CONFIG.bgOpacity),
          hideText: typeof parsed.hideText === 'boolean' ? parsed.hideText : (config.qrHideText ?? DEFAULT_QR_CONFIG.hideText)
        };
      }
    } catch (_) {}
    return {
      scale: config.qrScale || DEFAULT_QR_CONFIG.scale,
      offsetX: config.qrOffsetX || DEFAULT_QR_CONFIG.offsetX,
      offsetY: config.qrOffsetY || DEFAULT_QR_CONFIG.offsetY,
      bgOpacity: config.qrBgOpacity ?? DEFAULT_QR_CONFIG.bgOpacity,
      hideText: config.qrHideText ?? DEFAULT_QR_CONFIG.hideText
    };
  });

  const saveQrConfig = (updated: Partial<QrCustomization>) => {
    setQrConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify(next));
      } catch (_) {}
      onUpdateConfig({
        qrScale: next.scale,
        qrOffsetX: next.offsetX,
        qrOffsetY: next.offsetY,
        qrBgOpacity: next.bgOpacity,
        qrHideText: next.hideText
      });
      return next;
    });
  };

  const [isDraggingQr, setIsDraggingQr] = useState<boolean>(false);
  const [isResizingQr, setIsResizingQr] = useState<boolean>(false);
  const [showQrToolbar, setShowQrToolbar] = useState<boolean>(false);

  const qrDragStartXRef = useRef<number>(0);
  const qrDragStartYRef = useRef<number>(0);
  const qrDragStartOffsetXRef = useRef<number>(0);
  const qrDragStartOffsetYRef = useRef<number>(0);

  const qrResizeStartXRef = useRef<number>(0);
  const qrResizeStartYRef = useRef<number>(0);
  const qrResizeStartScaleRef = useRef<number>(1.0);

  // Handle free dragging of Lock Screen QR position
  const handleStartQrDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingQr(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    qrDragStartXRef.current = clientX;
    qrDragStartYRef.current = clientY;
    qrDragStartOffsetXRef.current = qrConfig.offsetX;
    qrDragStartOffsetYRef.current = qrConfig.offsetY;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - qrDragStartXRef.current;
      const deltaY = currentY - qrDragStartYRef.current;

      const newOffsetX = Math.max(-1200, Math.min(1200, qrDragStartOffsetXRef.current + deltaX));
      const newOffsetY = Math.max(-800, Math.min(800, qrDragStartOffsetYRef.current + deltaY));

      saveQrConfig({
        offsetX: Math.round(newOffsetX),
        offsetY: Math.round(newOffsetY)
      });
    };

    const handleEnd = () => {
      setIsDraggingQr(false);
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

  // Handle corner drag-resizing of Lock Screen QR
  const handleStartQrResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingQr(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    qrResizeStartXRef.current = clientX;
    qrResizeStartYRef.current = clientY;
    qrResizeStartScaleRef.current = qrConfig.scale;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - qrResizeStartXRef.current;
      const deltaY = currentY - qrResizeStartYRef.current;

      const factor = (deltaX - deltaY) / 250;
      const newScale = Math.max(0.4, Math.min(3.2, qrResizeStartScaleRef.current + factor));
      saveQrConfig({
        scale: Math.round(newScale * 100) / 100
      });
    };

    const handleEnd = () => {
      setIsResizingQr(false);
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

  const handleAdjustQrScale = (delta: number) => {
    saveQrConfig({
      scale: Math.max(0.4, Math.min(3.2, Math.round((qrConfig.scale + delta) * 10) / 10))
    });
  };

  const handleResetQr = () => {
    saveQrConfig(DEFAULT_QR_CONFIG);
  };

  // Close floating QR toolbar when mouse becomes idle
  useEffect(() => {
    const handleCursorIdle = (e: any) => {
      if (e.detail?.idle && !isDraggingQr && !isResizingQr) {
        setShowQrToolbar(false);
      }
    };
    window.addEventListener('serchtube:cursor-idle', handleCursorIdle);
    return () => {
      window.removeEventListener('serchtube:cursor-idle', handleCursorIdle);
    };
  }, [isDraggingQr, isResizingQr]);

  // Close floating clock toolbar when mouse becomes idle
  useEffect(() => {
    const handleCursorIdle = (e: any) => {
      if (e.detail?.idle && !isDraggingClock && !isResizingClock) {
        setShowClockToolbar(false);
      }
    };
    window.addEventListener('serchtube:cursor-idle', handleCursorIdle);
    return () => {
      window.removeEventListener('serchtube:cursor-idle', handleCursorIdle);
    };
  }, [isDraggingClock, isResizingClock]);

  // Determine current effective time slot
  const currentAutoSlot = getAutoTimeSlot(currentHour);
  const effectiveSlot =
    config.selectedTimeOfDaySlot && config.selectedTimeOfDaySlot !== 'auto'
      ? config.selectedTimeOfDaySlot
      : currentAutoSlot;

  const currentSlotMeta =
    TIME_OF_DAY_SLOTS.find((s) => s.slot === effectiveSlot) || TIME_OF_DAY_SLOTS[0];

  // Resolve background video for current slot
  const activeVideoId = (() => {
    const slotSaved = config.timeOfDayVideos?.[effectiveSlot as 'morning' | 'afternoon' | 'night' | 'late_night']?.videoUrl;
    if (slotSaved) return extractYouTubeId(slotSaved) || slotSaved;
    if (config.customVideoUrl) return extractYouTubeId(config.customVideoUrl) || config.customVideoUrl;
    const item = config.items?.find((i) => i.id === config.activeItemId) || config.items?.[0];
    if (item && item.videoUrl) return extractYouTubeId(item.videoUrl) || item.videoUrl;
    return currentSlotMeta.defaultVideo;
  })();

  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [customLinkInput, setCustomLinkInput] = useState<string>(activeVideoId);

  useEffect(() => {
    setCustomLinkInput(activeVideoId);
  }, [activeVideoId]);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentHour(now.getHours());

      const is12h = config.clockFormat === '12h';
      const showSeconds = config.showSeconds !== false;

      let h = now.getHours();
      let ampm = '';
      if (is12h) {
        ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
      }
      setAmPmStr(ampm);

      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');

      if (showSeconds) {
        setCurrentTimeStr(`${h.toString().padStart(2, '0')}:${m}:${s}`);
      } else {
        setCurrentTimeStr(`${h.toString().padStart(2, '0')}:${m}`);
      }

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      };
      setCurrentDateStr(now.toLocaleDateString('es-ES', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [config.clockFormat, config.showSeconds]);

  const handleSaveSlotVideo = () => {
    if (!customLinkInput.trim()) return;
    const newId = extractYouTubeId(customLinkInput.trim()) || customLinkInput.trim();
    const currentSlot = effectiveSlot as 'morning' | 'afternoon' | 'night' | 'late_night';

    const updatedVideos = {
      ...(config.timeOfDayVideos || {}),
      [currentSlot]: {
        videoUrl: newId,
        name: `${currentSlotMeta.label} - Personalizado`
      }
    };
    onUpdateConfig({
      timeOfDayVideos: updatedVideos,
      customVideoUrl: newId
    });
  };

  const handleSelectTimeOfDaySlot = (slot: TimeOfDaySlot) => {
    onUpdateConfig({
      selectedTimeOfDaySlot: slot,
      timeOfDayMode: slot === 'auto'
    });
  };

  const handleFallbackToCertifiedLoop = () => {
    const certifiedId = 'MV_3Dpw-BRY';
    const currentSlot = (effectiveSlot || 'afternoon') as 'morning' | 'afternoon' | 'night' | 'late_night';
    onUpdateConfig({
      timeOfDayVideos: {
        ...(config.timeOfDayVideos || {}),
        [currentSlot]: {
          videoUrl: certifiedId,
          name: `${currentSlotMeta.label} - Carretera Retrowave (Fluido)`
        }
      },
      customVideoUrl: certifiedId
    });
  };

  const showClock = config.showClock !== false;
  const showMusicBar = config.showMusicBar !== false;
  const currentClockStyle = (config.clockStyle || config.clockFont || 'mono') as ClockStyle;
  const currentMusicBarStyle = (config.musicBarStyle || 'album_card_glass') as LockScreenMusicBarStyle;
  const isAutoMode = !config.selectedTimeOfDaySlot || config.selectedTimeOfDaySlot === 'auto';
  const darknessLevel = config.darknessLevel ?? 0.65;

  return (
    <div
      id="screensaver-overlay"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 select-none animate-fadeIn cursor-pointer overflow-hidden"
      onClick={onDismiss}
    >
      {/* Background YouTube Video with Hardware Acceleration & Anti-Stuck Watchdog */}
      {activeVideoId && (
        <ScreensaverBackgroundVideo
          videoId={activeVideoId}
          isMuted={isMuted}
          isInteractiveMode={isInteractiveMode}
          darknessLevel={darknessLevel}
          quality={config.videoQuality || 'auto'}
          autoRecover={config.autoRecoverFreeze !== false}
          forceReloadTrigger={reloadVideoTrigger}
          onVideoStatusChange={setVideoStatus}
          onFallbackToCertifiedLoop={handleFallbackToCertifiedLoop}
        />
      )}

      {/* Darkness / Blackout Tint Layer (0% to 100% OLED) */}
      <div
        className={`absolute inset-0 bg-black z-0 transition-opacity duration-300 ${
          isInteractiveMode ? 'pointer-events-none opacity-20' : 'pointer-events-none'
        }`}
        style={{ opacity: isInteractiveMode ? 0.2 : darknessLevel }}
      />

      {/* Subtle overlay gradient to keep clock readable */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/85 z-0 ${
        isInteractiveMode ? 'pointer-events-none opacity-40' : 'pointer-events-none'
      }`} />

      {/* Interactive Mode Screen Banner (allows clicking on "Acceder" or bot check) */}
      {isInteractiveMode && (
        <div
          className="relative z-50 max-w-xl mx-auto w-full mb-3 p-3 rounded-2xl bg-amber-950/95 border-2 border-amber-500 text-amber-200 text-xs shadow-2xl flex items-center justify-between gap-3 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <MousePointerClick size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong>Modo Interactivo Activo:</strong> Puedes hacer clic directamente sobre el video para pulsar <em>"Acceder"</em> o resolver la comprobación de YouTube.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsInteractiveMode(false)}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 cursor-pointer"
          >
            Salir
          </button>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="relative z-20 w-full" onClick={(e) => e.stopPropagation()}>
        {!showControlsBar ? (
          <div className="flex items-center justify-end w-full">
            <button
              id="btn-screensaver-controls-toggle"
              type="button"
              onClick={() => setShowControlsBar(true)}
              className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white backdrop-blur-md transition-all shadow-xl cursor-pointer flex items-center gap-2 opacity-60 hover:opacity-100"
              title="Mostrar controles del Modo Descanso OLED"
            >
              <SlidersHorizontal size={16} className="text-red-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2 bg-black/85 backdrop-blur-xl p-2 rounded-2xl border border-white/15 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-gray-300 text-xs backdrop-blur-md">
                <Moon size={14} className="text-red-500 animate-pulse" />
                <span className="font-mono uppercase tracking-widest text-[11px]">Modo Descanso OLED</span>
              </div>

              {/* Quick Darkness Slider */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/70 border border-white/10 text-xs backdrop-blur-md">
                <Moon size={12} className="text-amber-400" />
                <span className="font-mono text-[10px] text-gray-300 hidden sm:inline">Oscuridad:</span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={darknessLevel}
                  onChange={(e) => onUpdateConfig({ darknessLevel: parseFloat(e.target.value) })}
                  className="w-16 sm:w-24 accent-amber-500 cursor-pointer"
                  title="Nivel de oscuridad del protector (0% a 100% OLED puro)"
                />
                <span className="font-mono text-amber-400 font-bold text-[11px] w-8 text-right">
                  {Math.round(darknessLevel * 100)}%
                </span>
              </div>

              {/* Time-of-Day Quick Indicator Badge */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs backdrop-blur-md">
                <currentSlotMeta.icon size={14} className="text-amber-400" />
                <span className="font-mono text-white text-[11px]">
                  {isAutoMode ? 'Auto: ' : 'Fijo: '} {currentSlotMeta.label} ({currentSlotMeta.hours})
                </span>
              </div>
            </div>

            {/* Quick Time of Day Switcher Pills */}
            <div className="hidden md:flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => handleSelectTimeOfDaySlot('auto')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                  isAutoMode ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                }`}
                title="Cambiar video automáticamente según la hora real"
              >
                Auto (Hora)
              </button>
              {TIME_OF_DAY_SLOTS.map((s) => {
                const isSelected = !isAutoMode && config.selectedTimeOfDaySlot === s.slot;
                return (
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => handleSelectTimeOfDaySlot(s.slot)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                      isSelected ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <s.icon size={12} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {/* Iniciar Sesión YouTube / Resolver Bot */}
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/50 bg-red-600/30 hover:bg-red-600/50 text-white text-xs backdrop-blur-md transition-colors cursor-pointer shadow-[0_0_12px_rgba(220,38,38,0.4)]"
                title="Iniciar sesión en YouTube o resolver comprobación de bot"
              >
                <UserCheck size={14} className="text-red-400" />
                <span className="font-semibold hidden sm:inline">Iniciar Sesión YouTube</span>
                <span className="font-semibold sm:hidden">YouTube</span>
              </button>

              {/* Botón Modo Interactivo Directo */}
              <button
                type="button"
                onClick={() => setIsInteractiveMode(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-colors cursor-pointer ${
                  isInteractiveMode
                    ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                    : 'bg-white/10 border-white/20 text-gray-200 hover:text-white'
                }`}
                title={isInteractiveMode ? 'Desactivar modo interactivo' : 'Activar modo interactivo para poder pulsar en los botones del video'}
              >
                <MousePointerClick size={14} />
                <span className="hidden md:inline font-mono">{isInteractiveMode ? 'Interactuar: ON' : 'Pulsar Video'}</span>
              </button>

              {/* Descongelar / Recargar Video (Anti-bloqueo) */}
              <button
                type="button"
                onClick={handleReloadVideo}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-colors cursor-pointer ${
                  videoStatus === 'stalled'
                    ? 'bg-amber-600/40 border-amber-500 text-amber-200 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                    : 'bg-black/60 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
                }`}
                title="Descongelar / Recargar Video (resuelve parones o congelamientos de red)"
              >
                <RefreshCw size={13} className={videoStatus === 'buffering' ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                <span className="hidden lg:inline font-mono">
                  {videoStatus === 'stalled' ? 'Descongelar Video' : 'Descongelar'}
                </span>
              </button>

              {/* Toggle Clock Visibility */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ showClock: !showClock })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-colors cursor-pointer ${
                  showClock ? 'bg-white/10 border-white/20 text-white' : 'bg-red-600/20 border-red-600/40 text-red-400'
                }`}
                title={showClock ? 'Ocultar reloj' : 'Mostrar reloj'}
              >
                {showClock ? <Eye size={14} /> : <EyeOff size={14} />}
                <span className="hidden sm:inline font-mono">{showClock ? 'Reloj ON' : 'Reloj OFF'}</span>
              </button>

              {/* Toggle Music Bar Visibility ("posibilidad de desactivarla") */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ showMusicBar: !showMusicBar })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-colors cursor-pointer ${
                  showMusicBar ? 'bg-white/10 border-white/20 text-white' : 'bg-red-600/20 border-red-600/40 text-red-400'
                }`}
                title={showMusicBar ? 'Desactivar barra de música en pantalla de bloqueo' : 'Activar barra de música'}
              >
                <Music2 size={14} />
                <span className="hidden sm:inline font-mono">{showMusicBar ? 'Barra ON' : 'Barra OFF'}</span>
              </button>

              {/* Lock Screen Fixed QR Code Toggle */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ showLockScreenQr: !config.showLockScreenQr })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-colors cursor-pointer ${
                  config.showLockScreenQr
                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                    : 'bg-black/60 hover:bg-white/10 border-white/10 text-gray-300'
                }`}
                title={config.showLockScreenQr ? 'Ocultar código QR fijo en pantalla de bloqueo' : 'Mostrar código QR fijo en pantalla de bloqueo'}
              >
                <QrCode size={14} />
                <span className="hidden sm:inline font-mono">{config.showLockScreenQr ? 'QR ON' : 'QR OFF'}</span>
              </button>

              {/* Quick Customization Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  showConfigPanel
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-black/60 hover:bg-white/10 border-white/10 text-gray-300'
                }`}
                title="Personalizar estilos de reloj y barra de música"
              >
                <Settings2 size={16} />
              </button>

              {/* Mute Toggle */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-xl bg-black/60 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Activar audio ambiental' : 'Silenciar protector'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {/* Deactivate Screensaver Option */}
              <button
                type="button"
                onClick={() => {
                  onUpdateConfig({ enabled: false });
                  onDismiss();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-white/10 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors font-mono uppercase cursor-pointer"
                title="Desactivar protector"
              >
                <Power size={14} />
                <span className="hidden sm:inline">Desactivar</span>
              </button>

              {/* Minimize bar back to icon */}
              <button
                type="button"
                onClick={() => setShowControlsBar(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer ml-1"
                title="Minimizar barra a icono"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Quick Customization Panel */}
      {showConfigPanel && (
        <div
          className="relative z-30 max-w-2xl mx-auto w-full bg-black/95 border border-white/20 backdrop-blur-2xl p-5 rounded-3xl shadow-2xl space-y-4 my-2 max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Settings2 size={15} className="text-red-500" />
              Estilos de Reloj (20) & Barra de Música (20)
            </h3>
            <button
              type="button"
              onClick={() => setShowConfigPanel(false)}
              className="text-gray-400 hover:text-white text-xs font-mono cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          {/* Time of Day Slot Selector */}
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-semibold block flex items-center justify-between">
              <span>Franja Horaria del Protector:</span>
              <span className="text-[11px] font-mono text-red-400">
                Hora actual: {currentHour}:00 ({currentAutoSlot})
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_OF_DAY_SLOTS.map((s) => {
                const isCurrentActive = effectiveSlot === s.slot;
                return (
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => handleSelectTimeOfDaySlot(s.slot)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      isCurrentActive
                        ? 'bg-red-600/20 border-red-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <s.icon size={14} className={isCurrentActive ? 'text-red-400' : 'text-gray-400'} />
                      <span>{s.label}</span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-400">{s.hours}</div>
                    <div className="text-[10px] text-gray-300 truncate">{s.theme}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* YouTube Video Link Customization for this slot */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <label className="text-xs text-gray-300 font-semibold block flex items-center justify-between">
              <span>Link de YouTube ({currentSlotMeta.label}):</span>
              <span className="text-[11px] font-mono text-gray-400">{activeVideoId}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customLinkInput}
                onChange={(e) => setCustomLinkInput(e.target.value)}
                placeholder="ej. https://www.youtube.com/watch?v=... o ID"
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-600 font-mono"
              />
              <button
                type="button"
                onClick={handleSaveSlotVideo}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Check size={14} />
                <span>Guardar</span>
              </button>
            </div>
          </div>

          {/* Video Performance & Anti-Freeze Controls */}
          <div className="space-y-2.5 pt-2.5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-200 font-bold flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                <span>Fluidez del Video y Prevención de Tirones / Parones:</span>
              </label>
              <button
                type="button"
                onClick={handleReloadVideo}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Descongelar y forzar recarga limpia del video de fondo"
              >
                <RefreshCw size={12} className={videoStatus === 'buffering' ? 'animate-spin' : ''} />
                <span>Descongelar Video</span>
              </button>
            </div>

            {/* Quality Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => onUpdateConfig({ videoQuality: 'auto' })}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  !config.videoQuality || config.videoQuality === 'auto'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-emerald-400">⚡ Auto Adaptable</div>
                <div className="text-[9px] text-gray-300">Recomendado (Cero parones)</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateConfig({ videoQuality: '720p' })}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  config.videoQuality === '720p'
                    ? 'bg-blue-600/30 border-blue-500 text-white font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-blue-400">✨ 720p HD</div>
                <div className="text-[9px] text-gray-300">Equilibrado</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateConfig({ videoQuality: '480p' })}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  config.videoQuality === '480p'
                    ? 'bg-amber-600/30 border-amber-500 text-white font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-amber-400">🔋 480p Fluido</div>
                <div className="text-[9px] text-gray-300">Máxima estabilidad</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateConfig({ videoQuality: '1080p' })}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  config.videoQuality === '1080p'
                    ? 'bg-purple-600/30 border-purple-500 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-purple-400">🎬 1080p Full HD</div>
                <div className="text-[9px] text-gray-300">Requiere buena conexión</div>
              </button>
            </div>

            {/* Anti-Freeze Watchdog Switch & Status */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-left">
                <div className="text-xs text-white font-medium flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>Perro Guardián Anti-Congelamiento (Watchdog Automático)</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  Detecta si YouTube entra en búfer prolongado o se pausa solo y reanuda la reproducción sin que tengas que tocar nada.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ autoRecoverFreeze: config.autoRecoverFreeze === false })}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer shrink-0 ml-3 ${
                  config.autoRecoverFreeze !== false
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-white/10 text-gray-400 border-white/10'
                }`}
              >
                {config.autoRecoverFreeze !== false ? 'ACTIVO' : 'MANUAL'}
              </button>
            </div>

            {/* Gallery of Tested Ultra-Smooth Ambient Loops */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-300 font-semibold">
                  Fondos Ambientales Probados y Optimizados (Cero Tirones):
                </span>
                <span className="text-[10px] font-mono text-gray-400">Haz clic para sintonizar</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {RECOMMENDED_AMBIENT_LOOPS.map((loop) => {
                  const isCurrent = activeVideoId === loop.id;
                  return (
                    <button
                      key={loop.id}
                      type="button"
                      onClick={() => {
                        const currentSlot = effectiveSlot as 'morning' | 'afternoon' | 'night' | 'late_night';
                        onUpdateConfig({
                          timeOfDayVideos: {
                            ...(config.timeOfDayVideos || {}),
                            [currentSlot]: {
                              videoUrl: loop.id,
                              name: loop.name
                            }
                          }
                        });
                        setCustomLinkInput(loop.id);
                        handleReloadVideo();
                      }}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-red-600/30 border-red-500 text-white shadow-md'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate text-white">{loop.name}</div>
                      <div className="text-[9px] text-gray-400 truncate">{loop.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 20 CLOCK STYLES GALLERY */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-200 font-bold flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" />
                <span>Estilos de Reloj (20 Modelos):</span>
              </label>
              <span className="text-xs font-mono font-bold text-blue-300">
                {CLOCK_STYLES_INFO.find(c => c.id === currentClockStyle)?.name || 'Monospace'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {CLOCK_STYLES_INFO.map((item) => {
                const isSelected = item.id === currentClockStyle;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateConfig({ clockStyle: item.id, clockFont: item.id })}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)] ring-1 ring-blue-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-white truncate">{item.badge}</div>
                    <div className="text-[9px] text-gray-400 truncate mt-0.5">{item.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Clock Options: Format 12h/24h, Seconds, Date */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-gray-300">
              <button
                type="button"
                onClick={() => onUpdateConfig({ clockFormat: config.clockFormat === '12h' ? '24h' : '12h' })}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-center cursor-pointer"
              >
                Formato: {config.clockFormat || '24h'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ showSeconds: config.showSeconds === false ? true : false })}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-center cursor-pointer"
              >
                Segundos: {config.showSeconds === false ? 'No' : 'Sí'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ showDate: config.showDate === false ? true : false })}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-center cursor-pointer"
              >
                Fecha: {config.showDate === false ? 'No' : 'Sí'}
              </button>
            </div>
          </div>

          {/* 20 MUSIC BAR STYLES GALLERY & TOGGLE */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 size={14} className="text-red-400" />
                <span className="text-xs font-bold text-gray-200">
                  Barra de Música en Pantalla de Bloqueo (20 Estilos):
                </span>
              </div>
              {/* Enable / Disable Toggle Switch */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ showMusicBar: !showMusicBar })}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showMusicBar
                    ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                    : 'bg-zinc-800 text-gray-400 border-white/10'
                }`}
              >
                {showMusicBar ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>{showMusicBar ? 'Activada (Visible)' : 'Desactivada (Oculta)'}</span>
              </button>
            </div>

            {showMusicBar && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {LOCKSCREEN_MUSIC_BAR_STYLES_INFO.map((item) => {
                  const isSelected = item.id === currentMusicBarStyle;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdateConfig({ musicBarStyle: item.id })}
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
            )}
          </div>

          {/* Fixed QR Code on Lock Screen Toggle & Customization */}
          <div className="space-y-3 pt-2.5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode size={14} className="text-red-400" />
                <div className="text-left">
                  <span className="text-xs text-gray-200 font-bold block">
                    Código QR Fijo en Pantalla de Bloqueo
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    Posición, tamaño, transparencia del fondo y textos 100% personalizables
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ showLockScreenQr: !config.showLockScreenQr })}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ml-2 ${
                  config.showLockScreenQr
                    ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                    : 'bg-zinc-800 text-gray-400 border-white/10'
                }`}
              >
                {config.showLockScreenQr ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>{config.showLockScreenQr ? 'Visible (Fijo)' : 'Oculto'}</span>
              </button>
            </div>

            {config.showLockScreenQr && (
              <div className="space-y-2.5 pt-1 px-1">
                {/* Scale slider */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-300 font-mono shrink-0 w-24">Tamaño QR:</span>
                  <input
                    type="range"
                    min="0.4"
                    max="3.0"
                    step="0.05"
                    value={qrConfig.scale}
                    onChange={(e) => saveQrConfig({ scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-600 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                  <span className="text-[11px] font-mono text-amber-300 w-12 text-right font-bold">
                    {Math.round(qrConfig.scale * 100)}%
                  </span>
                </div>

                {/* Background Transparency Slider */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-300 font-mono shrink-0 w-24">Fondo Negro:</span>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={qrConfig.bgOpacity}
                    onChange={(e) => saveQrConfig({ bgOpacity: parseFloat(e.target.value) })}
                    className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                  <span className="text-[11px] font-mono text-amber-400 w-12 text-right font-bold">
                    {qrConfig.bgOpacity === 0 ? '0% (Off)' : `${Math.round(qrConfig.bgOpacity * 100)}%`}
                  </span>
                </div>

                {/* Quick Presets & Text Toggle Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Hide Text Toggle */}
                    <button
                      type="button"
                      onClick={() => saveQrConfig({ hideText: !qrConfig.hideText })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${
                        qrConfig.hideText
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={qrConfig.hideText ? "Mostrar letras y títulos de vinculación" : "Quitar letras y dejar solo el código QR"}
                    >
                      <Type size={11} className={qrConfig.hideText ? 'text-amber-400' : 'text-gray-400'} />
                      <span>{qrConfig.hideText ? 'Solo QR (Sin letras)' : 'Con letras'}</span>
                    </button>

                    {/* Instant Transparent Toggle */}
                    <button
                      type="button"
                      onClick={() => saveQrConfig({ bgOpacity: qrConfig.bgOpacity === 0 ? 0.90 : 0.0 })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${
                        qrConfig.bgOpacity === 0
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                      title="Quitar fondo negro o restaurarlo"
                    >
                      <Layers size={11} className={qrConfig.bgOpacity === 0 ? 'text-emerald-400' : 'text-gray-400'} />
                      <span>{qrConfig.bgOpacity === 0 ? 'Fondo Transparente' : 'Fondo Negro'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 1-Click Clean Minimal Preset: Sin letras ni fondo negro */}
                    <button
                      type="button"
                      onClick={() => saveQrConfig({ hideText: true, bgOpacity: 0.0 })}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                        qrConfig.hideText && qrConfig.bgOpacity === 0
                          ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                          : 'bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/50 hover:to-amber-600/50 border-red-500/40 text-white'
                      }`}
                      title="Dejar solo el código QR limpio sin letras ni fondo negro"
                    >
                      <Sparkles size={11} className={qrConfig.hideText && qrConfig.bgOpacity === 0 ? 'text-black' : 'text-amber-300'} />
                      <span>Solo QR Limpio</span>
                    </button>

                    {/* Reset Button */}
                    <button
                      type="button"
                      onClick={handleResetQr}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                      title="Restablecer posición, tamaño, fondo y texto por defecto"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center Ambient Display: Freely Movable & Resizable Clock */}
      {showClock && (
        <div
          className="relative z-10 flex flex-col items-center justify-center my-auto text-center pointer-events-none w-full"
        >
          <div
            id="screensaver-movable-clock"
            style={{
              transform: `translate(${clockConfig.offsetX}px, ${clockConfig.offsetY}px) scale(${clockConfig.scale})`,
              transformOrigin: 'center center',
              transition: (isDraggingClock || isResizingClock) ? 'none' : 'transform 0.15s ease-out'
            }}
            className={`group/clock relative pointer-events-auto select-none px-6 py-4 rounded-3xl border transition-[border-color,box-shadow,background-color] ${
              isDraggingClock || isResizingClock
                ? 'border-red-500/80 bg-black/60 shadow-[0_0_40px_rgba(220,38,38,0.4)] ring-2 ring-red-500/40'
                : 'border-transparent hover:border-white/20 hover:bg-black/40 hover:shadow-2xl'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setShowClockToolbar(prev => !prev);
            }}
            onMouseEnter={() => setShowClockToolbar(true)}
            onMouseLeave={() => {
              if (!isDraggingClock && !isResizingClock) {
                setShowClockToolbar(false);
              }
            }}
          >
            {/* Quick Floating Toolbar above clock */}
            <div
              className={`absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 text-xs shadow-2xl transition-all duration-200 z-30 whitespace-nowrap ${
                showClockToolbar || isDraggingClock || isResizingClock
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-2 pointer-events-none group-hover/clock:opacity-100 group-hover/clock:translate-y-0 group-hover/clock:pointer-events-auto'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Move Handle */}
              <div
                onMouseDown={handleStartClockDrag}
                onTouchStart={handleStartClockDrag}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white cursor-grab active:cursor-grabbing font-mono text-[11px] transition-colors"
              >
                <Move size={13} className="text-red-400" />
                <span className="hidden sm:inline">Mover</span>
              </div>

              {/* Scale Down */}
              <button
                type="button"
                onClick={() => handleAdjustClockScale(-0.1)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                <Minus size={13} />
              </button>

              {/* Scale Badge */}
              <span className="px-2 py-0.5 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] font-bold text-red-400">
                {Math.round(clockConfig.scale * 100)}%
              </span>

              {/* Scale Up */}
              <button
                type="button"
                onClick={() => handleAdjustClockScale(0.1)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                <Plus size={13} />
              </button>

              {/* Center / Reset */}
              <button
                type="button"
                onClick={handleResetClock}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono px-2"
              >
                <RotateCcw size={11} />
                <span className="hidden sm:inline">Centrar</span>
              </button>
            </div>

            {/* Direct Drag Area on clock content */}
            <div
              onMouseDown={handleStartClockDrag}
              onTouchStart={handleStartClockDrag}
              className="cursor-grab active:cursor-grabbing select-none"
            >
              <ScreensaverClockRenderer
                style={currentClockStyle}
                timeStr={currentTimeStr}
                amPmStr={amPmStr}
                dateStr={currentDateStr}
                showSeconds={config.showSeconds !== false}
                showDate={config.showDate !== false}
              />
            </div>

            {/* Corner Resize Handles */}
            <div
              onMouseDown={(e) => handleStartClockResize(e, 'bottom-right')}
              onTouchStart={(e) => handleStartClockResize(e, 'bottom-right')}
              className="absolute -bottom-2.5 -right-2.5 w-7 h-7 rounded-xl bg-black/90 border border-white/30 text-gray-300 hover:text-white hover:border-red-500 flex items-center justify-center cursor-nwse-resize shadow-xl transition-all opacity-0 group-hover/clock:opacity-90 hover:!opacity-100 z-30"
            >
              <Maximize2 size={12} className="text-red-400" />
            </div>

            <div
              onMouseDown={(e) => handleStartClockResize(e, 'bottom-left')}
              onTouchStart={(e) => handleStartClockResize(e, 'bottom-left')}
              className="absolute -bottom-2.5 -left-2.5 w-7 h-7 rounded-xl bg-black/90 border border-white/30 text-gray-300 hover:text-white hover:border-red-500 flex items-center justify-center cursor-nesw-resize shadow-xl transition-all opacity-0 group-hover/clock:opacity-90 hover:!opacity-100 z-30"
            >
              <Maximize2 size={12} className="rotate-90 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Resizable & Repositionable Music Resume Bar with 20 Archetypes & Deactivation Option */}
      {showMusicBar && (
        <LockScreenMusicBar
          style={currentMusicBarStyle}
          track={lastKnownTrack}
          lastKnownTime={lastKnownTime}
          barConfig={barConfig}
          isResizingBar={isResizingBar}
          isDraggingPosition={isDraggingPosition}
          onResumeMusic={onResumeMusic}
          onSaveBarConfig={saveBarConfig}
          onStartResize={handleStartResize}
          onStartDragPosition={handleStartDragPosition}
          onSelectStyle={(newStyle) => onUpdateConfig({ musicBarStyle: newStyle })}
          onToggleMusicBarVisible={(visible) => onUpdateConfig({ showMusicBar: visible })}
        />
      )}

      {/* Freely Movable & Resizable Fixed QR Code for Lock Screen / Screensaver */}
      {config.showLockScreenQr && (
        <div
          className="absolute bottom-6 left-6 z-40 pointer-events-auto select-none"
          style={{
            transform: `translate(${qrConfig.offsetX}px, ${qrConfig.offsetY}px) scale(${qrConfig.scale})`,
            transformOrigin: 'bottom left',
            transition: (isDraggingQr || isResizingQr) ? 'none' : 'transform 0.15s ease-out'
          }}
          onMouseEnter={() => setShowQrToolbar(true)}
          onMouseLeave={() => {
            if (!isDraggingQr && !isResizingQr) {
              setShowQrToolbar(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: qrConfig.bgOpacity > 0 ? `rgba(0, 0, 0, ${qrConfig.bgOpacity})` : 'transparent',
              backdropFilter: qrConfig.bgOpacity > 0.05 ? 'blur(16px)' : 'none',
              WebkitBackdropFilter: qrConfig.bgOpacity > 0.05 ? 'blur(16px)' : 'none',
              borderColor: isDraggingQr || isResizingQr
                ? 'rgb(239, 68, 68)'
                : qrConfig.bgOpacity > 0.05
                ? 'rgba(255, 255, 255, 0.2)'
                : (showQrToolbar ? 'rgba(255, 255, 255, 0.3)' : 'transparent'),
              boxShadow: qrConfig.bgOpacity > 0.05
                ? (isDraggingQr || isResizingQr ? '0 0 40px rgba(220,38,38,0.5)' : '0 0 30px rgba(0,0,0,0.8)')
                : (isDraggingQr || isResizingQr ? '0 0 30px rgba(220,38,38,0.5)' : 'none')
            }}
            className={`group/qr relative flex items-center ${qrConfig.hideText ? 'p-1.5' : 'gap-3 p-3'} rounded-2xl border transition-all ${
              isDraggingQr || isResizingQr
                ? 'ring-2 ring-red-500/40'
                : 'hover:border-red-500/60'
            }`}
          >
            {/* Quick Floating Action Toolbar above QR card */}
            <div
              className={`absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-black/95 backdrop-blur-xl border border-white/20 text-xs shadow-2xl transition-all duration-200 z-50 whitespace-nowrap ${
                showQrToolbar || isDraggingQr || isResizingQr
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-2 pointer-events-none group-hover/qr:opacity-100 group-hover/qr:translate-y-0 group-hover/qr:pointer-events-auto'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Move Handle */}
              <div
                onMouseDown={handleStartQrDrag}
                onTouchStart={handleStartQrDrag}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white cursor-grab active:cursor-grabbing font-mono text-[11px] transition-colors"
                title="Arrastrar para mover libremente por la pantalla"
              >
                <Move size={12} className="text-red-400" />
                <span>Mover</span>
              </div>

              {/* Decrease Scale */}
              <button
                type="button"
                onClick={() => handleAdjustQrScale(-0.1)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Reducir tamaño"
              >
                <Minus size={12} />
              </button>

              {/* Scale Badge */}
              <span className="font-mono text-[10px] text-amber-300 px-1 font-bold">
                {Math.round(qrConfig.scale * 100)}%
              </span>

              {/* Increase Scale */}
              <button
                type="button"
                onClick={() => handleAdjustQrScale(0.1)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Aumentar tamaño"
              >
                <Plus size={12} />
              </button>

              {/* Toggle Text: Quitar letras / Mostrar letras */}
              <button
                type="button"
                onClick={() => saveQrConfig({ hideText: !qrConfig.hideText })}
                className={`p-1 px-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 font-mono text-[10px] ${
                  qrConfig.hideText
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                    : 'bg-white/10 text-gray-300 hover:text-white border-transparent hover:bg-white/20'
                }`}
                title={qrConfig.hideText ? "Mostrar letras y títulos de vinculación" : "Quitar letras y dejar solo el QR"}
              >
                <Type size={11} />
                <span>{qrConfig.hideText ? 'Solo QR' : 'Letras'}</span>
              </button>

              {/* Toggle Background Transparency */}
              <button
                type="button"
                onClick={() => saveQrConfig({ bgOpacity: qrConfig.bgOpacity === 0 ? 0.90 : 0.0 })}
                className={`p-1 px-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 font-mono text-[10px] ${
                  qrConfig.bgOpacity === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-white/10 text-gray-300 hover:text-white border-transparent hover:bg-white/20'
                }`}
                title={qrConfig.bgOpacity === 0 ? "Activar fondo negro" : "Quitar fondo negro (Transparente)"}
              >
                <Layers size={11} />
                <span>{qrConfig.bgOpacity === 0 ? 'Fondo 0%' : 'Fondo ON'}</span>
              </button>

              {/* 1-Click Clean Minimal Preset: Solo QR sin letras ni fondo negro */}
              <button
                type="button"
                onClick={() => {
                  const isClean = qrConfig.hideText && qrConfig.bgOpacity === 0;
                  saveQrConfig({
                    hideText: !isClean,
                    bgOpacity: isClean ? 0.90 : 0.0
                  });
                }}
                className={`p-1 px-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 font-mono text-[10px] ${
                  qrConfig.hideText && qrConfig.bgOpacity === 0
                    ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : 'bg-gradient-to-r from-red-600/30 to-amber-600/30 text-amber-300 border-amber-500/40 hover:from-red-600/50 hover:to-amber-600/50'
                }`}
                title="Modo ultra-limpio: Dejar solo el código QR sin letras ni fondo negro"
              >
                <Sparkles size={11} className={qrConfig.hideText && qrConfig.bgOpacity === 0 ? 'text-black' : 'text-amber-300'} />
                <span>Solo QR</span>
              </button>

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetQr}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer ml-0.5"
                title="Restablecer posición, tamaño, fondo y texto por defecto"
              >
                <RotateCcw size={12} />
              </button>

              {/* Hide QR Button */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ showLockScreenQr: false })}
                className="p-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 hover:text-white transition-colors cursor-pointer ml-0.5"
                title="Ocultar QR de la pantalla de bloqueo"
              >
                <X size={12} />
              </button>
            </div>

            {/* QR Code SVG */}
            <div className={`p-1.5 bg-white ${qrConfig.hideText && qrConfig.bgOpacity === 0 ? 'rounded-2xl ring-2 ring-black/40 shadow-2xl' : 'rounded-xl shadow-md'} flex items-center justify-center shrink-0`}>
              <QRCodeSVG
                value={lockScreenRemoteUrl}
                size={82}
                level="M"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Label & Description (quitar letras si hideText es true) */}
            {!qrConfig.hideText && (
              <div className="text-left pr-2 flex flex-col justify-center animate-fadeIn">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Smartphone size={12} /> Control Móvil
                </span>
                <p className="text-xs font-bold text-white leading-tight mt-0.5">
                  Escanea para conectar
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Mando a distancia
                </p>
              </div>
            )}

            {/* Corner Drag-Resize Handle */}
            <div
              onMouseDown={handleStartQrResize}
              onTouchStart={handleStartQrResize}
              className={`absolute bottom-0.5 right-0.5 p-1 text-gray-400 hover:text-white cursor-nwse-resize active:scale-125 transition-transform ${
                qrConfig.hideText && qrConfig.bgOpacity === 0
                  ? 'bg-black/60 rounded-full text-white'
                  : ''
              }`}
              title="Arrastra esta esquina para redimensionar libremente"
            >
              <Maximize2 size={11} className="rotate-90 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* YouTube / Google Account Sign-In & Bot Check Resolution Modal */}
      <YouTubeAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onEnableInteractiveScreensaver={() => setIsInteractiveMode(true)}
        onReloadPlayer={() => window.dispatchEvent(new CustomEvent('serchtube:reload-player'))}
      />
    </div>
  );
};

export const ScreensaverOverlay = React.memo(ScreensaverOverlayComponent);
