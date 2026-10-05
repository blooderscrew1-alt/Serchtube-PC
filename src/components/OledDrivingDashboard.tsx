import React, { useState, useRef, useEffect } from 'react';
import { Track, PlayerState, SystemStatus, NodeRole, DisplayVisualConfig, VideoQuality, AutoVolumeReducerConfig, AutoShutdownConfig, WaveStyle, WAVE_STYLES_INFO, OrbStyle, ORB_STYLES_INFO, BottomBarElementId, BottomBarItemConfig, BottomBarLayoutConfig } from '../types';
import { ReactiveOrb } from './ReactiveOrb';
import { YouTubePlayer } from './YouTubePlayer';
import { QualityMenuPopover } from './QualityMenuPopover';
import { getQualityOption } from '../utils/quality';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Mic,
  MicOff,
  Sliders,
  Wifi,
  Settings2,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
  Smartphone,
  Infinity,
  Layers,
  Activity,
  SlidersHorizontal,
  X,
  Gauge,
  Tv,
  PanelTop,
  PanelBottom,
  Sun,
  Menu,
  Search,
  Send,
  Volume1,
  Music,
  Minus,
  Plus,
  HelpCircle,
  ListMusic,
  Power,
  Clock,
  Move,
  RotateCcw,
  Check,
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
  GripHorizontal,
  Eye,
  EyeOff,
  UserCheck,
  RefreshCw,
  Clipboard
} from 'lucide-react';
import { QuickRemoteQrCode } from './QuickRemoteQrCode';
import { YouTubeAuthModal } from './YouTubeAuthModal';
import { HostScannerModal } from './HostScannerModal';
import { PWAInstallBanner } from './PWAInstallBanner';
import { NodeSyncService } from '../services/nodeSync';
import { youtubeAuthService, GoogleAccountProfile } from '../services/youtubeAuthService';

interface OledDrivingDashboardProps {
  playerState: PlayerState;
  systemStatus: SystemStatus;
  nodeRole: NodeRole;
  connectedNodesCount: number;
  isConnected?: boolean;
  lastTranscript: string;
  assistantResponse: string;
  isListening: boolean;
  isFullscreen: boolean;
  visualConfig?: DisplayVisualConfig;
  onUpdateVisualConfig?: (updated: Partial<DisplayVisualConfig>) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onToggleRepeat: () => void;
  onToggleNonStop?: () => void;
  onToggleMute: () => void;
  onVolumeChange: (newVol: number) => void;
  onVolumeStep?: (delta: number) => void;
  onToggleListening: () => void;
  onToggleFullscreen: () => void;
  onOpenEqualizer: () => void;
  onOpenNodeSync: () => void;
  onOpenSettings: () => void;
  onOpenAutoShutdown?: () => void;
  onDirectSearch: (query: string, isArtist?: boolean) => void;
  onTrackEnded: () => void;
  onPlayerStateChange: (updates: Partial<PlayerState>) => void;
  videoOpacity?: number;
  onVideoOpacityChange?: (opacity: number) => void;
  satelliteCommandNotification?: { nodeName: string; text?: string } | null;
  wakeWordInfo?: { enabled: boolean; wakeWord: string; isAwaitingCommand: boolean };
  onSeek?: (time: number) => void;
  onToggleScreensaver?: () => void;
  onToggleWakeWord?: () => void;
  autoVolumeConfig?: AutoVolumeReducerConfig;
  autoShutdownConfig?: AutoShutdownConfig;
  onAutoVolumeReduced?: (vol: number) => void;
  isEqEnabled?: boolean;
  playlistQueue?: Track[];
  playlistIndex?: number;
  onSelectTrackFromQueue?: (track: Track, index: number) => void;
}

const DEFAULT_BOTTOM_BAR_LAYOUT: BottomBarLayoutConfig = {
  items: {
    qr_code: { id: 'qr_code', scale: 1.0, offsetX: 0, offsetY: 0, order: 0, hidden: false },
    track_info: { id: 'track_info', scale: 1.0, offsetX: 0, offsetY: 0, order: 1, hidden: false },
    playback_controls: { id: 'playback_controls', scale: 1.0, offsetX: 0, offsetY: 0, order: 2, hidden: false },
    volume_nodes: { id: 'volume_nodes', scale: 1.0, offsetX: 0, offsetY: 0, order: 3, hidden: false }
  },
  overallHeightScale: 1.0,
  overallOffsetY: 0,
  gap: 20,
  alignItems: 'center'
};

const OledDrivingDashboardComponent: React.FC<OledDrivingDashboardProps> = ({
  playerState,
  systemStatus,
  nodeRole,
  connectedNodesCount,
  isConnected,
  lastTranscript,
  assistantResponse,
  isListening,
  isFullscreen,
  satelliteCommandNotification,
  wakeWordInfo,
  autoVolumeConfig,
  autoShutdownConfig,
  onAutoVolumeReduced,
  isEqEnabled = true,
  visualConfig = {
    videoOpacity: 0.45,
    wavesOpacity: 0.85,
    orbOpacity: 1.0,
    orbScale: 1.0,
    showWavesAndMic: true,
    waveStyle: 'sine_harmonic',
    orbStyle: 'classic_core',
    waveScale: 1.0,
    waveHeight: 320,
    waveFullscreen: false,
    topFadeOpacity: 0.80,
    bottomFadeOpacity: 0.85,
    headerBgOpacity: 0.40,
    footerBgOpacity: 0.60,
    autoExpandOnPlay: true
  },
  onUpdateVisualConfig,
  isExpanded = true,
  onToggleExpanded,
  onTogglePlay,
  onNextTrack,
  onPreviousTrack,
  onToggleRepeat,
  onToggleNonStop,
  onToggleMute,
  onVolumeChange,
  onVolumeStep,
  onToggleListening,
  onToggleFullscreen,
  onOpenEqualizer,
  onOpenNodeSync,
  onOpenSettings,
  onOpenAutoShutdown,
  onDirectSearch,
  onTrackEnded,
  onPlayerStateChange,
  videoOpacity,
  onVideoOpacityChange,
  onSeek,
  onToggleScreensaver,
  onToggleWakeWord,
  playlistQueue = [],
  playlistIndex = 0,
  onSelectTrackFromQueue
}) => {
  const [quickSearchInput, setQuickSearchInput] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [showVisualControls, setShowVisualControls] = useState<boolean>(false);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showTopMenu, setShowTopMenu] = useState<boolean>(false);
  const [showPlaylistQueueModal, setShowPlaylistQueueModal] = useState<boolean>(false);
  const [showYouTubeAuthModal, setShowYouTubeAuthModal] = useState<boolean>(false);
  const [isHostScannerOpen, setIsHostScannerOpen] = useState<boolean>(false);
  const [googleProfile, setGoogleProfile] = useState<GoogleAccountProfile>(() => youtubeAuthService.getProfile());

  const isYouTubeAuthVerified = googleProfile.isLinked && googleProfile.botStatus !== 'detected';
  const hasBotAlert = googleProfile.botStatus === 'detected';

  useEffect(() => {
    const handleOpenAuth = () => {
      setShowYouTubeAuthModal(true);
      setGoogleProfile(youtubeAuthService.getProfile());
    };
    const handleAccountUpdate = (e: any) => {
      if (e.detail) {
        setGoogleProfile(e.detail);
      }
    };
    window.addEventListener('serchtube:open-youtube-auth', handleOpenAuth);
    window.addEventListener('serchtube:account-updated', handleAccountUpdate);
    return () => {
      window.removeEventListener('serchtube:open-youtube-auth', handleOpenAuth);
      window.removeEventListener('serchtube:account-updated', handleAccountUpdate);
    };
  }, []);

  // Bottom Information Bar Custom Layout & Interactive Resizing Engine
  const [bottomBarLayout, setBottomBarLayout] = useState<BottomBarLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem('serchtube_bottom_bar_layout_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_BOTTOM_BAR_LAYOUT,
          ...parsed,
          items: {
            ...DEFAULT_BOTTOM_BAR_LAYOUT.items,
            ...(parsed.items || {})
          }
        };
      }
    } catch (e) {
      console.warn('Failed to load bottom bar layout', e);
    }
    return DEFAULT_BOTTOM_BAR_LAYOUT;
  });

  const [isEditingBottomBar, setIsEditingBottomBar] = useState<boolean>(false);
  const [activeDragItem, setActiveDragItem] = useState<BottomBarElementId | null>(null);
  const [activeResizeItem, setActiveResizeItem] = useState<BottomBarElementId | null>(null);

  const saveBottomBarLayout = (newLayout: BottomBarLayoutConfig) => {
    setBottomBarLayout(newLayout);
    try {
      localStorage.setItem('serchtube_bottom_bar_layout_v2', JSON.stringify(newLayout));
    } catch (e) {
      console.warn('Failed to save bottom bar layout', e);
    }
  };

  const handleUpdateItemLayout = (id: BottomBarElementId, updates: Partial<BottomBarItemConfig>) => {
    setBottomBarLayout(prev => {
      const current = prev.items[id] || { id, scale: 1.0, offsetX: 0, offsetY: 0, order: 0, hidden: false };
      const updatedItem: BottomBarItemConfig = { ...current, ...updates };
      const newLayout: BottomBarLayoutConfig = {
        ...prev,
        items: {
          ...prev.items,
          [id]: updatedItem
        }
      };
      try {
        localStorage.setItem('serchtube_bottom_bar_layout_v2', JSON.stringify(newLayout));
      } catch (err) {
        console.warn(err);
      }
      return newLayout;
    });
  };

  const handleResetBottomBarLayout = () => {
    saveBottomBarLayout(DEFAULT_BOTTOM_BAR_LAYOUT);
  };

  const handleSwapItemOrder = (id: BottomBarElementId, direction: 'left' | 'right') => {
    const sortedIds = (Object.keys(bottomBarLayout.items) as BottomBarElementId[]).sort(
      (a, b) => (bottomBarLayout.items[a]?.order ?? 0) - (bottomBarLayout.items[b]?.order ?? 0)
    );
    const currentIndex = sortedIds.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedIds.length) return;

    const targetId = sortedIds[targetIndex];
    const currentOrder = bottomBarLayout.items[id]?.order ?? currentIndex;
    const targetOrder = bottomBarLayout.items[targetId]?.order ?? targetIndex;

    const newItems = {
      ...bottomBarLayout.items,
      [id]: { ...bottomBarLayout.items[id], order: targetOrder },
      [targetId]: { ...bottomBarLayout.items[targetId], order: currentOrder }
    };
    saveBottomBarLayout({ ...bottomBarLayout, items: newItems });
  };

  // Item Drag Handlers (Free Offset X/Y)
  const itemDragStartPosRef = useRef<{ x: number; y: number; initialOffsetX: number; initialOffsetY: number }>({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 });

  const handleStartItemDrag = (e: React.MouseEvent | React.TouchEvent, id: BottomBarElementId) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const currentItem = bottomBarLayout.items[id] || { id, scale: 1.0, offsetX: 0, offsetY: 0, order: 0, hidden: false };
    itemDragStartPosRef.current = {
      x: clientX,
      y: clientY,
      initialOffsetX: currentItem.offsetX || 0,
      initialOffsetY: currentItem.offsetY || 0
    };
    setActiveDragItem(id);

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - itemDragStartPosRef.current.x;
      const deltaY = curY - itemDragStartPosRef.current.y;
      const newOffsetX = Math.max(-800, Math.min(800, Math.round(itemDragStartPosRef.current.initialOffsetX + deltaX)));
      const newOffsetY = Math.max(-400, Math.min(400, Math.round(itemDragStartPosRef.current.initialOffsetY + deltaY)));
      handleUpdateItemLayout(id, { offsetX: newOffsetX, offsetY: newOffsetY });
    };

    const handleMouseUp = () => {
      setActiveDragItem(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  // Item Corner Resize Handlers (Smooth Dynamic Scale)
  const itemResizeStartPosRef = useRef<{ x: number; y: number; initialScale: number }>({ x: 0, y: 0, initialScale: 1.0 });

  const handleStartItemResize = (e: React.MouseEvent | React.TouchEvent, id: BottomBarElementId) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const currentItem = bottomBarLayout.items[id] || { id, scale: 1.0, offsetX: 0, offsetY: 0, order: 0, hidden: false };
    itemResizeStartPosRef.current = {
      x: clientX,
      y: clientY,
      initialScale: currentItem.scale || 1.0
    };
    setActiveResizeItem(id);

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const delta = (curX - itemResizeStartPosRef.current.x + (curY - itemResizeStartPosRef.current.y)) / 180;
      const newScale = Math.max(0.5, Math.min(2.4, Math.round((itemResizeStartPosRef.current.initialScale + delta) * 20) / 20));
      handleUpdateItemLayout(id, { scale: newScale });
    };

    const handleMouseUp = () => {
      setActiveResizeItem(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  const effectiveVideoOpacity = visualConfig?.videoOpacity ?? videoOpacity ?? 0.45;
  const effectiveWavesOpacity = visualConfig?.wavesOpacity ?? 0.85;
  const effectiveOrbOpacity = visualConfig?.orbOpacity ?? 1.0;
  const effectiveTopFade = visualConfig?.topFadeOpacity ?? 0.80;
  const effectiveBottomFade = visualConfig?.bottomFadeOpacity ?? 0.85;
  const effectiveHeaderBg = visualConfig?.headerBgOpacity ?? 0.40;
  const effectiveFooterBg = visualConfig?.footerBgOpacity ?? 0.60;

  const currentQualityOption = getQualityOption(playerState.playbackQuality || 'auto');

  const handleSelectQuality = (quality: VideoQuality) => {
    onPlayerStateChange({ playbackQuality: quality });
    handleUpdateConfig({ preferredQuality: quality });
  };

  const handleSelectSpeed = (speed: number) => {
    onPlayerStateChange({ playbackSpeed: speed });
  };

  const handleUpdateConfig = (updates: Partial<DisplayVisualConfig>) => {
    if (onUpdateVisualConfig) {
      onUpdateVisualConfig(updates);
    }
    if (updates.videoOpacity !== undefined && onVideoOpacityChange) {
      onVideoOpacityChange(updates.videoOpacity);
    }
  };

  // Clock for nav bar
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchInput.trim()) return;
    onDirectSearch(quickSearchInput.trim());
    setQuickSearchInput('');
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const parseTrackDuration = (duration?: string): number => {
    if (!duration) return 240;
    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 240;
  };

  // If this device is configured as a Satellite Microphone Node (Phone / Secondary Screen)
  if (nodeRole === 'satellite') {
    const isSatelliteConnected = typeof isConnected === 'boolean'
      ? isConnected
      : NodeSyncService.getInstance().getConnected();
    const trackDuration = parseTrackDuration(playerState.currentTrack?.duration);
    const trackPosition = Math.max(0, playerState.currentTime || 0);

    // Build upcoming 20 songs queue for satellite display (including current song at #1)
    const displayQueue: Track[] = [];
    const seenIds = new Set<string>();

    const activeTrack = playerState.currentTrack || (playlistQueue && playlistQueue[playlistIndex]);
    if (activeTrack && activeTrack.id) {
      seenIds.add(activeTrack.id);
      displayQueue.push({
        ...activeTrack,
        thumbnail: activeTrack.thumbnail && !activeTrack.thumbnail.includes('unsplash')
          ? activeTrack.thumbnail
          : `https://i.ytimg.com/vi/${activeTrack.id}/hqdefault.jpg`
      });
    }

    if (Array.isArray(playlistQueue) && playlistQueue.length > 0) {
      const startIdx = typeof playlistIndex === 'number' && playlistIndex >= 0 ? playlistIndex + 1 : 1;
      for (let i = startIdx; i < playlistQueue.length; i++) {
        if (displayQueue.length >= 20) break;
        const track = playlistQueue[i];
        if (track && track.id && !seenIds.has(track.id)) {
          seenIds.add(track.id);
          displayQueue.push({
            ...track,
            thumbnail: track.thumbnail && !track.thumbnail.includes('unsplash')
              ? track.thumbnail
              : `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`
          });
        }
      }

      if (displayQueue.length < 20) {
        for (let i = 0; i < Math.min(startIdx - 1, playlistQueue.length); i++) {
          if (displayQueue.length >= 20) break;
          const track = playlistQueue[i];
          if (track && track.id && !seenIds.has(track.id)) {
            seenIds.add(track.id);
            displayQueue.push({
              ...track,
              thumbnail: track.thumbnail && !track.thumbnail.includes('unsplash')
                ? track.thumbnail
                : `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`
            });
          }
        }
      }
    }

    return (
      <div className="min-h-screen bg-black text-gray-100 font-sans flex flex-col p-4 sm:p-6 select-none animate-fadeIn relative overflow-y-auto pb-16">
        {/* Ambient background glow */}
        <div
          className="fixed inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 30%, #1e3a8a 0%, #000 80%)' }}
        />

        {/* Top Satellite Bar */}
        <div className="relative z-20 flex items-center justify-between border-b border-white/10 pb-4 mb-5 bg-black/80 backdrop-blur-md">
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => setIsHostScannerOpen(true)}
            title="Pulsar para buscar o reconectar con el Host en la red local"
          >
            <div className={`w-3 h-3 rounded-full ${isSatelliteConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'} animate-pulse`} />
            <div>
              <span className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
                MANDO SATÉLITE <span className="text-red-500 font-mono text-xs">[REMOTE]</span>
              </span>
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <span>
                  {isSatelliteConnected
                    ? connectedNodesCount > 1
                      ? `Conectado al Coche (${connectedNodesCount} dispositivos)`
                      : 'Conectado al Coche (Host Activo)'
                    : 'Esperando conexión con Host'}
                </span>
                {!isSatelliteConnected && (
                  <span className="text-red-400 font-bold underline text-[10px] flex items-center gap-0.5 group-hover:text-red-300">
                    <Search size={11} /> Escanear Red
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Host Scanner Radar Button */}
            <button
              type="button"
              onClick={() => setIsHostScannerOpen(true)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                !isSatelliteConnected
                  ? 'bg-red-600/30 hover:bg-red-600/50 border-red-500/60 text-red-200 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
              }`}
              title="Escáner automático de red local (Host :3000)"
            >
              <Radio size={14} className={!isSatelliteConnected ? 'text-red-400' : 'text-gray-400'} />
              <span className="hidden sm:inline">Escanear Host</span>
            </button>

            {/* In-App PWA Install Button (Compact) */}
            <PWAInstallBanner compact={true} />

            <button
              type="button"
              onClick={() => setShowYouTubeAuthModal(true)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                hasBotAlert
                  ? 'bg-red-600/30 hover:bg-red-600/40 border-red-500 text-red-200 animate-pulse'
                  : isYouTubeAuthVerified
                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-600/20 hover:bg-red-600/30 border-red-500/40 text-red-300'
              }`}
              title="Comprobar estado y autenticación oficial de Google & YouTube"
            >
              {googleProfile.photoURL ? (
                <img
                  src={googleProfile.photoURL}
                  alt={googleProfile.displayName}
                  className="w-4 h-4 rounded-full border border-emerald-400 object-cover"
                />
              ) : (
                <UserCheck size={14} className={hasBotAlert ? "text-red-400" : isYouTubeAuthVerified ? "text-emerald-400" : "text-red-400"} />
              )}
              <span>{hasBotAlert ? 'Aviso Bot' : isYouTubeAuthVerified ? `${googleProfile.displayName.split(' ')[0]} ✓` : 'Acceder con Google'}</span>
            </button>
            <div className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 text-xs font-mono text-gray-300">
              {currentTimeStr}
            </div>
            <button
              type="button"
              onClick={onOpenNodeSync}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
              title="Ajustes de sincronización"
            >
              <Wifi size={16} />
            </button>
          </div>
        </div>

        {/* Main Remote Grid */}
        <div className="relative z-10 max-w-xl mx-auto w-full flex flex-col gap-4">

          {/* Invitation to Add to Home Screen (PWA) with Offline Capability */}
          <PWAInstallBanner />

          {/* Disconnected / Host Scanner Alert Banner - SOLO VISIBLE SI REALMENTE SE PIERDE LA CONEXIÓN */}
          {!isSatelliteConnected && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/70 via-black to-zinc-950/80 border border-red-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <Radio size={20} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Host Desconectado / ¿Cambio de IP tras corte de luz?</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono">PUERTO :3000</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                    Si el router se reinició o cambió la IP del coche, el escáner rastrea automáticamente los puertos 3000 de tu subred para reconectar sin volver a escanear el QR.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHostScannerOpen(true)}
                className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.35)] shrink-0 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Search size={14} />
                <span>Escanear Red</span>
              </button>
            </div>
          )}

          {/* 1. SILENT SEARCH & REMOTE COMMANDER BAR (BÚSQUEDA EN LA PARTE SUPERIOR) */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-2.5">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
              <Search size={14} className="text-red-500" /> BÚSQUEDA
            </span>

            <form onSubmit={handleQuickSubmit} className="flex gap-2">
              <input
                type="text"
                value={quickSearchInput}
                onChange={(e) => setQuickSearchInput(e.target.value)}
                placeholder="Canción, artista o pega enlace de YouTube..."
                className="flex-1 bg-black/60 border border-white/15 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
              {typeof navigator !== 'undefined' && navigator.clipboard && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text && text.trim()) {
                        setQuickSearchInput(text.trim());
                        onDirectSearch(text.trim());
                      }
                    } catch (e) {
                      console.warn('Clipboard read error:', e);
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Pegar enlace copiado desde la app de YouTube"
                >
                  <Clipboard size={14} className="text-red-400" />
                  <span className="hidden sm:inline">Pegar</span>
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Send size={14} /> Enviar
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono pt-0.5">
              <span>💡 Envía canciones o pega enlaces de la app de YouTube</span>
            </div>
          </div>

          {/* 2. NOW PLAYING CARD & MULTIMEDIA CONTROLS */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
                <Music size={14} className="text-red-500" /> REPRODUCCIÓN EN COCHE
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase ${playerState.isPlaying ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-gray-400'}`}>
                {playerState.isPlaying ? 'EN MARCHA' : 'PAUSADO'}
              </span>
            </div>

            {/* Current Track Info */}
            {playerState.currentTrack ? (
              <div className="flex items-center gap-4">
                {playerState.currentTrack.thumbnail ? (
                  <img
                    src={playerState.currentTrack.thumbnail}
                    alt={playerState.currentTrack.title}
                    className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-lg shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-black border border-white/10 flex items-center justify-center text-red-500 shrink-0">
                    <Radio size={24} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-white truncate">
                    {playerState.currentTrack.title}
                  </h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {playerState.currentTrack.artist}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-black/40 rounded-xl border border-white/5">
                <p className="text-sm text-gray-400 font-medium">No hay reproducción activa</p>
                <p className="text-xs text-gray-500 mt-1">Escribe una canción o comando en la barra superior para reproducir</p>
              </div>
            )}

            {/* Track Progress Scrubber */}
            <div className="space-y-1.5 pt-1">
              <input
                type="range"
                min="0"
                max={Math.max(1, trackDuration)}
                step="1"
                value={Math.min(trackPosition, trackDuration)}
                onChange={(e) => onSeek && onSeek(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-red-600"
                aria-label="Posición de reproducción"
              />
              <div className="flex justify-between text-[11px] font-mono text-gray-400">
                <span>{formatTime(trackPosition)}</span>
                <span>{playerState.currentTrack?.duration || formatTime(trackDuration)}</span>
              </div>
            </div>

            {/* Primary Touch Multimedia Controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onToggleRepeat}
                className={`p-3 rounded-xl border transition-all ${
                  playerState.repeatMode !== 'none'
                    ? 'bg-red-600/20 border-red-500 text-red-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title="Repetir pista"
              >
                <Repeat size={20} />
              </button>

              <button
                type="button"
                onClick={onPreviousTrack}
                className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-md"
                title="Pista anterior"
              >
                <SkipBack size={24} />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className={`w-18 h-18 rounded-2xl flex items-center justify-center text-white active:scale-95 transition-all shadow-2xl cursor-pointer ${
                  playerState.isPlaying
                    ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-[0_0_25px_rgba(220,38,38,0.5)] border border-red-400'
                    : 'bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/20 hover:border-white/40'
                }`}
                title={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {playerState.isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-md"
                title="Pista siguiente"
              >
                <SkipForward size={24} />
              </button>

              <button
                type="button"
                onClick={onToggleNonStop}
                className={`p-3 rounded-xl border transition-all ${
                  playerState.nonStop !== false
                    ? 'bg-red-600/20 border-red-500 text-red-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title="Modo Non-Stop automático"
              >
                <Infinity size={20} />
              </button>
            </div>
          </div>

          {/* 2. PLAYLIST QUEUE: PRÓXIMAS 20 CANCIONES (CON MINIATURA Y NOMBRE) */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
                  <ListMusic size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    LISTA DE REPRODUCCIÓN
                    <span className="text-[10px] font-mono font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/50">
                      {displayQueue.length} {displayQueue.length === 1 ? 'CANCIÓN' : 'CANCIONES'}
                    </span>
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    Próximas canciones sincronizadas con el coche
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Satelite Sync
              </span>
            </div>

            {displayQueue.length === 0 ? (
              <div className="text-center py-6 bg-black/40 rounded-xl border border-white/5">
                <Music size={24} className="mx-auto text-gray-500 mb-2 opacity-50" />
                <p className="text-xs text-gray-400">Sin canciones en la lista</p>
                <p className="text-[11px] text-gray-500 mt-1">Busca una canción o artista para cargar las próximas pistas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 select-none">
                {displayQueue.map((track, idx) => {
                  const isCurrent = idx === 0;
                  const thumbUrl = track.thumbnail && !track.thumbnail.includes('unsplash')
                    ? track.thumbnail
                    : (track.id ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : '');

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => onSelectTrackFromQueue && onSelectTrackFromQueue(track, idx)}
                      className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer active:scale-[0.99] ${
                        isCurrent
                          ? 'bg-gradient-to-r from-red-950/50 via-zinc-900/80 to-black/60 border-red-500/60 shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                          : 'bg-black/40 hover:bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {/* Position / Soundwave */}
                      <div className="w-6 text-center shrink-0">
                        {isCurrent ? (
                          <div className="flex items-center justify-center gap-0.5 text-red-500">
                            <span className="w-1 h-3.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="w-1 h-2 bg-red-500 rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-gray-400 group-hover:text-white font-bold">
                            #{idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Video Thumbnail (Miniatura) */}
                      <div className="relative w-14 h-14 sm:w-16 sm:h-12 rounded-lg overflow-hidden bg-black/80 border border-white/10 shrink-0 shadow-sm">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <Music size={18} />
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] font-black text-white uppercase tracking-wider bg-red-600 px-1 py-0.2 rounded shadow">
                              EN VIVO
                            </span>
                          </div>
                        )}
                        {track.duration && (
                          <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/80 text-gray-300 px-1 rounded">
                            {track.duration}
                          </span>
                        )}
                      </div>

                      {/* Video Name (Nombre del video) & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs sm:text-sm font-semibold truncate ${
                          isCurrent ? 'text-red-300 font-bold' : 'text-gray-200 group-hover:text-white'
                        }`}>
                          {track.title}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {track.artist || 'YouTube'}
                        </p>
                      </div>

                      {/* Quick Play Button */}
                      <div className="shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-1 rounded-lg">
                            ACTUAL
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrackFromQueue && onSelectTrackFromQueue(track, idx);
                            }}
                            className="p-2 rounded-xl bg-white/5 group-hover:bg-red-600 group-hover:text-white text-gray-400 border border-white/10 group-hover:border-red-500 transition-all active:scale-95 shadow-sm"
                            title="Reproducir ahora en el coche"
                          >
                            <Play size={13} className="fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. VEHICLE VOLUME CONTROL CENTER (0 - 15) */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
                <Volume2 size={14} className="text-red-500" /> VOLUMEN DEL VEHÍCULO
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${playerState.isMuted ? 'text-red-400 bg-red-950/40 border border-red-800/50' : 'text-white bg-white/10'}`}>
                {playerState.isMuted ? 'SILENCIADO' : `${playerState.volume} / 15`}
              </span>
            </div>

            {/* Slider & Step Controls */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onToggleMute}
                className={`p-3 rounded-xl border transition-all ${
                  playerState.isMuted
                    ? 'bg-red-600/20 border-red-500 text-red-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title={playerState.isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {playerState.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onVolumeStep) {
                    onVolumeStep(-1);
                  } else {
                    onVolumeChange(Math.max(0, playerState.volume - 1));
                  }
                }}
                className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                title="Bajar volumen"
              >
                <Minus size={18} />
              </button>

              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={playerState.volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
                className="flex-1 h-3 bg-white/15 rounded-lg appearance-none cursor-pointer accent-red-600"
                aria-label="Nivel de volumen"
              />

              <button
                type="button"
                onClick={() => {
                  if (onVolumeStep) {
                    onVolumeStep(1);
                  } else {
                    onVolumeChange(Math.min(15, playerState.volume + 1));
                  }
                }}
                className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                title="Subir volumen"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Quick Volume Preset Pills */}
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[
                { label: 'Mute', val: 0 },
                { label: 'Suave (3)', val: 3 },
                { label: 'Medio (8)', val: 8 },
                { label: 'Alto (12)', val: 12 },
                { label: 'Máx (15)', val: 15 }
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onVolumeChange(preset.val)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold tracking-tight border transition-all ${
                    playerState.volume === preset.val && !playerState.isMuted
                      ? 'bg-red-600 text-white border-red-500 shadow-sm'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. QUICK CAR UTILITIES & MASTER MODE SWITCH */}
          <div className="w-full pt-1">
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
            >
              <Maximize2 size={16} /> Pantalla Coche (Pantalla Completa)
            </button>
          </div>

          {/* 5. SESIÓN YOUTUBE / SOLUCIÓN AVISO DE BOT */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 tracking-wider uppercase flex items-center gap-2">
                <UserCheck size={16} className="text-red-500" /> AUTENTICACIÓN YOUTUBE / GOOGLE
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase ${
                hasBotAlert
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : isYouTubeAuthVerified
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {hasBotAlert ? 'AVISO DE BOT' : isYouTubeAuthVerified ? 'VERIFICADO ✓' : 'NO VINCULADO'}
              </span>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-600/30 border border-red-500/50 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {googleProfile.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{googleProfile.email}</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {googleProfile.successfulPlaysCount} pistas reproducidas sin bloqueo
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Comprueba el estado real de tu cuenta, ejecuta el test de integridad en vivo y recarga el reproductor del coche si aparece el aviso de bot.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowYouTubeAuthModal(true)}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] cursor-pointer"
              >
                <Activity size={15} />
                <span>Test en Vivo y Estado de Cuenta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    NodeSyncService.getInstance().sendCommandToMaster({ action: 'reload_player' });
                  } catch (e) {}
                  window.dispatchEvent(new CustomEvent('serchtube:reload-player'));
                }}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-gray-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Recargar reproductor del vehículo con las credenciales de sesión"
              >
                <RefreshCw size={14} className="text-red-400" />
                <span>Recargar Coche</span>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onOpenNodeSync}
              className="text-xs text-gray-500 hover:text-gray-300 font-mono tracking-wider underline uppercase"
            >
              Cambiar este dispositivo a Host Principal (Master)
            </button>
          </div>
        </div>

        {/* Host Subnet Scanner Modal */}
        <HostScannerModal
          isOpen={isHostScannerOpen}
          onClose={() => setIsHostScannerOpen(false)}
        />
      </div>
    );
  }

  // Build upcoming 20 songs queue for Master display (including currently playing at #1)
  const displayQueueMaster: Track[] = [];
  const masterSeenIds = new Set<string>();

  const masterActiveTrack = playerState.currentTrack || (playlistQueue && playlistQueue[playlistIndex]);
  if (masterActiveTrack && masterActiveTrack.id) {
    masterSeenIds.add(masterActiveTrack.id);
    displayQueueMaster.push({
      ...masterActiveTrack,
      thumbnail: masterActiveTrack.thumbnail && !masterActiveTrack.thumbnail.includes('unsplash')
        ? masterActiveTrack.thumbnail
        : `https://i.ytimg.com/vi/${masterActiveTrack.id}/hqdefault.jpg`
    });
  }

  if (Array.isArray(playlistQueue) && playlistQueue.length > 0) {
    const startIdx = typeof playlistIndex === 'number' && playlistIndex >= 0 ? playlistIndex + 1 : 1;
    for (let i = startIdx; i < playlistQueue.length; i++) {
      if (displayQueueMaster.length >= 20) break;
      const track = playlistQueue[i];
      if (track && track.id && !masterSeenIds.has(track.id)) {
        masterSeenIds.add(track.id);
        displayQueueMaster.push({
          ...track,
          thumbnail: track.thumbnail && !track.thumbnail.includes('unsplash')
            ? track.thumbnail
            : `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`
        });
      }
    }

    if (displayQueueMaster.length < 20) {
      for (let i = 0; i < Math.min(startIdx - 1, playlistQueue.length); i++) {
        if (displayQueueMaster.length >= 20) break;
        const track = playlistQueue[i];
        if (track && track.id && !masterSeenIds.has(track.id)) {
          masterSeenIds.add(track.id);
          displayQueueMaster.push({
            ...track,
            thumbnail: track.thumbnail && !track.thumbnail.includes('unsplash')
              ? track.thumbnail
              : `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`
          });
        }
      }
    }
  }

  // MASTER / MAIN CAR SOUNDBAR DASHBOARD - ELEGANT DARK THEME
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans flex flex-col justify-between selection:bg-red-600/30 relative overflow-hidden">
      {/* Ambient background blue radial glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, #1a365d 0%, transparent 70%)' }}
      />

      {/* Top Black Diffusion Gradient */}
      <div
        className="fixed top-0 inset-x-0 h-44 sm:h-56 pointer-events-none z-10 transition-opacity duration-300"
        style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,${effectiveTopFade}) 0%, rgba(0,0,0,${effectiveTopFade * 0.7}) 50%, rgba(0,0,0,0) 100%)`
        }}
      />

      {/* Bottom Black Diffusion Gradient */}
      <div
        className="fixed bottom-0 inset-x-0 h-64 sm:h-80 pointer-events-none z-10 transition-opacity duration-300"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${effectiveBottomFade}) 0%, rgba(0,0,0,${effectiveBottomFade * 0.7}) 50%, rgba(0,0,0,0) 100%)`
        }}
      />

      {/* Edge-to-Edge Fullscreen YouTube Video Player */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-auto transition-opacity duration-500">
        <YouTubePlayer
          track={playerState.currentTrack}
          playerState={playerState}
          onStateChange={onPlayerStateChange}
          onTrackEnded={onTrackEnded}
          isDucked={playerState.isDucked}
          opacity={effectiveVideoOpacity}
          onNextTrack={onNextTrack}
          onPreviousTrack={onPreviousTrack}
          onToggleNonStop={onToggleNonStop}
          onToggleListening={onToggleListening}
          systemStatus={systemStatus}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          autoVolumeConfig={autoVolumeConfig}
          onAutoVolumeReduced={onAutoVolumeReduced}
        />
      </div>

      {/* 1. TOP NAV / HEADER (Manipulable dark background transparency - text & icons remain 100% sharp) */}
      <nav
        id="header-title-bar"
        className="w-full h-16 flex items-center justify-between px-4 sm:px-8 relative z-30 transition-all duration-300 select-none"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${effectiveHeaderBg})`,
          borderBottom: `1px solid rgba(255, 255, 255, ${Math.max(0.04, effectiveHeaderBg * 0.15)})`
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
          <span className="text-lg sm:text-xl font-bold tracking-tighter uppercase text-white drop-shadow-md">
            SerchTube <span className="text-red-600">Music</span>
          </span>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2 relative">
          {/* Quick Auto-Shutdown Indicator / Button */}
          {autoShutdownConfig?.enabled && (
            <button
              id="btn-nav-auto-shutdown"
              type="button"
              onClick={onOpenAutoShutdown || onOpenSettings}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg animate-pulse"
              title={`Auto-Apagado de PC programado para las ${autoShutdownConfig.targetTime}`}
            >
              <Power size={15} className="text-red-400" />
              <span className="hidden md:inline text-xs font-mono font-bold">
                {autoShutdownConfig.targetTime}
              </span>
            </button>
          )}

          {/* Quick Playlist Queue Button */}
          <button
            id="btn-nav-playlist-queue"
            type="button"
            onClick={() => setShowPlaylistQueueModal(true)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
              showPlaylistQueueModal
                ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-gray-200 hover:text-white'
            }`}
            title="Lista de reproducción (próximas 20 canciones)"
          >
            <ListMusic size={18} className={showPlaylistQueueModal ? "text-white" : "text-red-400"} />
            <span className="hidden sm:inline text-xs font-mono font-bold text-gray-200">
              {displayQueueMaster.length}
            </span>
          </button>

          {/* YouTube / Google Account Sign In Button */}
          <button
            id="btn-nav-youtube-auth"
            type="button"
            onClick={() => setShowYouTubeAuthModal(true)}
            className={`p-2 sm:px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${
              hasBotAlert
                ? 'border-red-500 bg-red-950/60 text-red-200 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : isYouTubeAuthVerified
                ? 'border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-200'
                : 'border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-gray-200 hover:text-white'
            }`}
            title="Estado real de autenticación oficial de Google y diagnóstico de YouTube"
          >
            <div className="relative flex items-center justify-center">
              {googleProfile.photoURL ? (
                <img
                  src={googleProfile.photoURL}
                  alt={googleProfile.displayName}
                  className="w-5 h-5 rounded-full border border-emerald-400 object-cover"
                />
              ) : (
                <UserCheck size={17} className={hasBotAlert ? "text-red-400" : isYouTubeAuthVerified ? "text-emerald-400" : "text-red-400"} />
              )}
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${hasBotAlert ? 'bg-red-500 animate-ping' : isYouTubeAuthVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>
            <span className="hidden sm:inline text-xs font-semibold">
              {hasBotAlert ? 'Aviso Bot' : isYouTubeAuthVerified ? `${googleProfile.displayName.split(' ')[0]} ✓` : 'Acceder con Google'}
            </span>
          </button>

          {/* Unified Navigation Menu Icon */}
          <button
            id="btn-nav-unified-menu"
            type="button"
            onClick={() => setShowTopMenu(!showTopMenu)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-lg ${
              showTopMenu
                ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-gray-200 hover:text-white'
            }`}
            title="Menú de herramientas, ecualizador y ajustes"
          >
            <Menu size={18} className={showTopMenu ? "text-white" : "text-gray-200"} />
          </button>

          {/* Unified Header Popover Dropdown */}
          {showTopMenu && (
            <div className="absolute right-0 top-12 w-64 bg-black/95 backdrop-blur-2xl p-2 rounded-2xl border border-white/20 shadow-2xl z-50 animate-fadeIn flex flex-col gap-1 text-xs">
              <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold text-white text-[10px] uppercase tracking-wider font-mono">Herramientas</span>
                <button
                  type="button"
                  onClick={() => setShowTopMenu(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Auto-Apagado de PC */}
              <button
                type="button"
                onClick={() => {
                  setShowTopMenu(false);
                  if (onOpenAutoShutdown) onOpenAutoShutdown();
                  else onOpenSettings();
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer text-left ${
                  autoShutdownConfig?.enabled
                    ? 'bg-red-950/40 border border-red-500/40 text-white'
                    : 'bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white'
                }`}
              >
                <Power size={16} className={autoShutdownConfig?.enabled ? "text-red-400" : "text-gray-400"} />
                <div className="flex-1">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>Auto-Apagado PC</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${autoShutdownConfig?.enabled ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                      {autoShutdownConfig?.enabled ? autoShutdownConfig.targetTime : 'OFF'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">Apagar sistema a hora fija</div>
                </div>
              </button>

              {/* Lista de Reproducción (20 canciones) */}
              <button
                type="button"
                onClick={() => {
                  setShowTopMenu(false);
                  setShowPlaylistQueueModal(true);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
              >
                <ListMusic size={16} className="text-red-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Lista de Reproducción</div>
                  <div className="text-[10px] text-gray-400 font-mono">Próximas 20 canciones sincronizadas</div>
                </div>
              </button>

              {/* Ecualizador */}
              <button
                type="button"
                onClick={() => {
                  setShowTopMenu(false);
                  onOpenEqualizer();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
              >
                <Sliders size={16} className="text-red-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Ecualizador DSP</div>
                  <div className="text-[10px] text-gray-400 font-mono">Graves, agudos y loudness</div>
                </div>
              </button>

              {/* Cuenta y Diagnóstico YouTube */}
              <button
                type="button"
                onClick={() => {
                  setShowTopMenu(false);
                  setShowYouTubeAuthModal(true);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer text-left ${
                  hasBotAlert
                    ? 'bg-red-950/40 border-red-500/50 text-white'
                    : isYouTubeAuthVerified
                    ? 'bg-emerald-950/25 hover:bg-emerald-900/40 border-emerald-500/30 text-gray-200 hover:text-white'
                    : 'bg-red-950/25 hover:bg-red-900/40 border-red-500/30 text-gray-200 hover:text-white'
                }`}
              >
                <UserCheck size={16} className={hasBotAlert ? "text-red-400" : isYouTubeAuthVerified ? "text-emerald-400" : "text-red-400"} flex-shrink-0 />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>Cuenta & Diagnóstico</span>
                    <span className={`text-[9px] font-mono px-1 rounded ${hasBotAlert ? 'bg-red-600 text-white' : isYouTubeAuthVerified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                      {hasBotAlert ? 'BOT ALERT' : isYouTubeAuthVerified ? 'VERIFICADO' : 'PENDIENTE'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono truncate">{googleProfile.email}</div>
                </div>
              </button>

              {/* Ajustes Generales */}
              <button
                type="button"
                onClick={() => {
                  setShowTopMenu(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
              >
                <Settings2 size={16} className="text-gray-300 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Ajustes del Sistema</div>
                  <div className="text-[10px] text-gray-400 font-mono">Transparencia, voz y protector</div>
                </div>
              </button>

              {/* Sincronización de Nodos */}
              {onOpenNodeSync && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTopMenu(false);
                    onOpenNodeSync();
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Wifi size={16} className="text-cyan-400 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-white">Sincronización Nodos</div>
                    <div className="text-[10px] text-gray-400 font-mono">{connectedNodesCount} dispositivo(s)</div>
                  </div>
                </button>
              )}

              {/* Activador Ondas ON/OFF */}
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyActive = (visualConfig?.showWavesAndMic !== false) && (effectiveWavesOpacity > 0.05);
                  if (isCurrentlyActive) {
                    handleUpdateConfig({ showWavesAndMic: false, wavesOpacity: 0.0 });
                  } else {
                    handleUpdateConfig({ showWavesAndMic: true, wavesOpacity: 0.85 });
                  }
                }}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <Activity size={16} className={(visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05) ? "text-cyan-400 animate-pulse flex-shrink-0" : "text-gray-500 flex-shrink-0"} />
                  <div>
                    <div className="font-semibold text-white">Ondas Reactivas</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {(visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05) ? `${Math.round(effectiveWavesOpacity * 100)}% opacidad` : 'Desactivadas'}
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  (visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05)
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-white/10 text-gray-400'
                }`}>
                  {(visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05) ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Pantalla Completa */}
              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTopMenu(false);
                    onToggleFullscreen();
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Maximize2 size={16} className="text-amber-400 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-white">{isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">Modo F11 Inmersivo</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* 2. MAIN VIEWPORT: CENTERED COCKPIT STAGE WITH FLOATING ORB & WAVES */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-1 sm:py-2 w-full max-w-5xl mx-auto relative z-20 overflow-visible">
        <div className="relative w-full flex flex-col items-center justify-center overflow-visible">
          <ReactiveOrb
            status={systemStatus}
            isPlaying={playerState.isPlaying}
            volume={playerState.volume}
            track={playerState.currentTrack}
            satelliteCount={connectedNodesCount}
            lastTranscript={lastTranscript}
            assistantResponse={assistantResponse}
            satelliteCommandNotification={satelliteCommandNotification}
            onClick={onToggleListening}
            opacity={effectiveWavesOpacity}
            orbOpacity={effectiveOrbOpacity}
            orbScale={visualConfig?.orbScale ?? 1.0}
            onUpdateOrbScale={(scale) => handleUpdateConfig({ orbScale: scale })}
            showWavesAndMic={visualConfig?.showWavesAndMic !== false}
            waveStyle={visualConfig?.waveStyle || 'sine_harmonic'}
            orbStyle={visualConfig?.orbStyle || 'classic_core'}
            waveScale={visualConfig?.waveScale ?? 1.0}
            waveHeight={visualConfig?.waveHeight ?? 320}
            waveFullscreen={visualConfig?.waveFullscreen ?? false}
            wakeWordInfo={wakeWordInfo}
          />
        </div>
      </main>

      {/* Floating Visual Controls Popover (Single Modal, clean and non-overlapping) */}
      {showVisualControls && (
        <div className="fixed bottom-28 sm:bottom-32 left-4 sm:left-6 z-40 animate-fadeIn max-w-[95vw] sm:max-w-none">
          <div className="flex flex-col gap-2.5 bg-black/95 backdrop-blur-2xl px-4 py-3 rounded-2xl border border-white/20 shadow-2xl text-xs font-mono max-h-[80vh] overflow-y-auto">
            {/* Header / Activator for Wave & Mic Animations */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Activity size={14} className={(visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05) ? "text-cyan-400 animate-pulse" : "text-gray-500"} />
                <span className="text-[11px] font-semibold text-white">Animaciones Ondas y Micrófono:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const isCurrentlyActive = (visualConfig?.showWavesAndMic !== false) && (effectiveWavesOpacity > 0.05);
                    if (isCurrentlyActive) {
                      handleUpdateConfig({ showWavesAndMic: false, wavesOpacity: 0.0 });
                    } else {
                      handleUpdateConfig({ showWavesAndMic: true, wavesOpacity: 0.85 });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    (visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05)
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white'
                  }`}
                >
                  {(visualConfig?.showWavesAndMic !== false && effectiveWavesOpacity > 0.05) ? '✓ ACTIVADAS' : 'DESACTIVADAS'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ showWavesAndMic: true, wavesOpacity: 0.85 })}
                  className="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                  title="Restaurar ondas al 85% de opacidad y activar micrófono reactivo"
                >
                  Restaurar (85%)
                </button>
                <button
                  type="button"
                  onClick={() => setShowVisualControls(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer ml-1"
                  title="Cerrar panel de ajustes"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Orb Style Selector (32 Archetypes with Covers & Artists) */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 flex items-center gap-1.5 font-bold text-[11px]">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Estilo de Orbe (32 Modelos - Carátula & Artista):</span>
                </span>
                <span className="text-amber-300 font-bold text-[10px]">
                  {ORB_STYLES_INFO.find(o => o.id === (visualConfig?.orbStyle || 'classic_core'))?.name || 'Clásico'}
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-[340px] sm:max-w-[480px]">
                {ORB_STYLES_INFO.map(orb => (
                  <button
                    key={orb.id}
                    type="button"
                    onClick={() => handleUpdateConfig({ orbStyle: orb.id })}
                    className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                      (visualConfig?.orbStyle || 'classic_core') === orb.id
                        ? 'bg-amber-600 text-white font-bold border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {orb.badge}
                  </button>
                ))}
              </div>

              {/* Orb Scale / Size Controls */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-300 flex items-center gap-1 text-[11px]">
                    <Maximize2 size={12} className="text-amber-400" />
                    <span>Tamaño Orbe:</span>
                  </span>
                  <input
                    type="range"
                    min="0.4"
                    max="2.6"
                    step="0.05"
                    value={visualConfig?.orbScale ?? 1.0}
                    onChange={(e) => handleUpdateConfig({ orbScale: parseFloat(e.target.value) })}
                    className="w-16 sm:w-24 accent-amber-500 cursor-pointer"
                    title="Escala del orbe interactivo (40% a 260%)"
                  />
                  <span className="text-amber-400 font-bold w-12 text-right font-mono text-[11px]">
                    {Math.round((visualConfig?.orbScale ?? 1.0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[0.7, 1.0, 1.4, 1.8, 2.2].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleUpdateConfig({ orbScale: s })}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer ${
                        Math.abs((visualConfig?.orbScale ?? 1.0) - s) < 0.05
                          ? 'bg-amber-600 text-white font-bold shadow-sm'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Wave Style Selector (24 animated models) */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 flex items-center gap-1.5 font-bold text-[11px]">
                  <Activity size={12} className="text-cyan-400" />
                  <span>Estilo de Onda (24 Modelos):</span>
                </span>
                <span className="text-cyan-300 font-bold text-[10px]">
                  {WAVE_STYLES_INFO.find(w => w.id === (visualConfig?.waveStyle || 'sine_harmonic'))?.name || 'Armónico'}
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-[340px] sm:max-w-[480px]">
                {WAVE_STYLES_INFO.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => handleUpdateConfig({ waveStyle: style.id, showWavesAndMic: true, wavesOpacity: Math.max(0.4, effectiveWavesOpacity) })}
                    className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                      (visualConfig?.waveStyle || 'sine_harmonic') === style.id
                        ? 'bg-cyan-600 text-white font-bold border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {style.badge}
                  </button>
                ))}
              </div>
            </div>

            {/* Wave Scale / Size & Screen Coverage Controls */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/10 flex-wrap">
              {/* Wave Scale Multiplier Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1 text-[11px]">
                  <Maximize2 size={12} className="text-cyan-400" />
                  <span>Tamaño Onda:</span>
                </span>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={visualConfig?.waveScale ?? 1.0}
                  onChange={(e) => handleUpdateConfig({ waveScale: parseFloat(e.target.value) })}
                  className="w-16 sm:w-24 accent-cyan-500 cursor-pointer"
                  title="Multiplicador libre de escala de las ondas (20% a 300%)"
                />
                <span className="text-cyan-400 font-bold w-10 text-right font-mono text-[11px]">
                  {Math.round((visualConfig?.waveScale ?? 1.0) * 100)}%
                </span>
              </div>

              {/* Quick scale buttons */}
              <div className="flex items-center gap-1">
                {[0.5, 1.0, 1.5, 2.0].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleUpdateConfig({ waveScale: s })}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                      Math.abs((visualConfig?.waveScale ?? 1.0) - s) < 0.05
                        ? 'bg-cyan-600/30 text-cyan-300 border-cyan-400 font-bold'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}

                {/* Fullscreen wave toggle */}
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ waveFullscreen: !visualConfig?.waveFullscreen })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ml-1 ${
                    visualConfig?.waveFullscreen
                      ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                  title="Las ondas cubren toda la pantalla sin restricciones"
                >
                  {visualConfig?.waveFullscreen ? '📺 Pantalla 100%' : 'Normal'}
                </button>
              </div>
            </div>

            {/* Top Row: Video, Waves, & Orb Opacity */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              {/* Video Opacity Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1">
                  <Layers size={12} className="text-red-500" />
                  <span className="hidden sm:inline">Video:</span>
                </span>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={effectiveVideoOpacity}
                  onChange={(e) => handleUpdateConfig({ videoOpacity: parseFloat(e.target.value) })}
                  className="w-14 sm:w-20 accent-red-600 cursor-pointer"
                  title="Transparencia del video (0% a 100%)"
                />
                <span className="text-red-400 font-bold w-8 text-right font-mono text-[11px]">
                  {Math.round(effectiveVideoOpacity * 100)}%
                </span>
              </div>

              <div className="w-px h-4 bg-white/20 hidden sm:block" />

              {/* Waves / Listening Animation Opacity Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1">
                  <Activity size={12} className="text-blue-400" />
                  <span className="hidden sm:inline">Ondas:</span>
                </span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={effectiveWavesOpacity}
                  onChange={(e) => handleUpdateConfig({ wavesOpacity: parseFloat(e.target.value) })}
                  className="w-14 sm:w-20 accent-blue-500 cursor-pointer"
                  title="Transparencia de ondas de escucha (0% a 100%)"
                />
                <span className="text-blue-400 font-bold w-8 text-right font-mono text-[11px]">
                  {Math.round(effectiveWavesOpacity * 100)}%
                </span>
              </div>

              <div className="w-px h-4 bg-white/20 hidden sm:block" />

              {/* Orb Transparency Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1">
                  <Sparkles size={12} className="text-red-400" />
                  <span className="hidden sm:inline">Orbe:</span>
                </span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={effectiveOrbOpacity}
                  onChange={(e) => handleUpdateConfig({ orbOpacity: parseFloat(e.target.value) })}
                  className="w-14 sm:w-20 accent-red-500 cursor-pointer"
                  title="Transparencia del cuerpo del orbe central (0% a 100%)"
                />
                <span className="text-red-400 font-bold w-8 text-right font-mono text-[11px]">
                  {Math.round(effectiveOrbOpacity * 100)}%
                </span>
              </div>
            </div>

            {/* Middle Row: Title Bar & Info Bar Background Opacities */}
            <div className="flex items-center gap-3 sm:gap-4 pt-2 border-t border-white/10 flex-wrap">
              {/* Header Title Bar Background Opacity */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1" title="Fondo oscuro de la barra superior / título">
                  <PanelTop size={12} className="text-amber-400" />
                  <span className="hidden sm:inline">Barra Título:</span>
                  <span className="sm:hidden">Título:</span>
                </span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={effectiveHeaderBg}
                  onChange={(e) => handleUpdateConfig({ headerBgOpacity: parseFloat(e.target.value) })}
                  className="w-16 sm:w-20 accent-amber-500 cursor-pointer"
                  title="Transparencia solo del fondo oscuro de la barra de título (0% a 100%)"
                />
                <span className="text-amber-400 font-bold w-8 text-right font-mono text-[11px]">
                  {Math.round(effectiveHeaderBg * 100)}%
                </span>
              </div>

              <div className="w-px h-4 bg-white/20 hidden sm:block" />

              {/* Footer Info Bar Background Opacity */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 flex items-center gap-1" title="Fondo oscuro de la barra inferior / información">
                  <PanelBottom size={12} className="text-emerald-400" />
                  <span className="hidden sm:inline">Barra Info:</span>
                  <span className="sm:hidden">Info:</span>
                </span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={effectiveFooterBg}
                  onChange={(e) => handleUpdateConfig({ footerBgOpacity: parseFloat(e.target.value) })}
                  className="w-16 sm:w-20 accent-emerald-500 cursor-pointer"
                  title="Transparencia solo del fondo oscuro de la barra de información (0% a 100%)"
                />
                <span className="text-emerald-400 font-bold w-8 text-right font-mono text-[11px]">
                  {Math.round(effectiveFooterBg * 100)}%
                </span>
              </div>
            </div>

            {/* Custom Layout Button in Visual Controls */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-red-950/30 border border-red-500/30">
              <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                <LayoutGrid size={13} className="text-red-400" />
                <span>Personalización de Barra Inferior:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowVisualControls(false);
                  setIsEditingBottomBar(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] transition-all shadow-[0_0_10px_rgba(220,38,38,0.4)] cursor-pointer flex items-center gap-1"
              >
                <Move size={11} />
                <span>Activar Modo Diseño</span>
              </button>
            </div>

            {/* Bottom Row: Quick Presets & Quality Button */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-gray-400">Fondos:</span>
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ headerBgOpacity: 0.0, footerBgOpacity: 0.0, topFadeOpacity: 0.15, bottomFadeOpacity: 0.20 })}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-cyan-300 hover:text-white border border-white/10 transition-colors"
                  title="Barras 100% transparentes (solo texto y controles visibles)"
                >
                  Cristal 0%
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ headerBgOpacity: 0.40, footerBgOpacity: 0.60, topFadeOpacity: 0.80, bottomFadeOpacity: 0.85 })}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-colors"
                  title="Opacidades equilibradas recomendadas"
                >
                  Medio
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ headerBgOpacity: 1.0, footerBgOpacity: 1.0, topFadeOpacity: 1.0, bottomFadeOpacity: 1.0 })}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-colors"
                  title="Fondo 100% negro sólido OLED"
                >
                  OLED 100%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateConfig({ videoOpacity: 1.0, headerBgOpacity: 0.15, footerBgOpacity: 0.75, topFadeOpacity: 0.0, bottomFadeOpacity: 0.15, wavesOpacity: 0.0 });
                    onPlayerStateChange({ playbackQuality: 'large' });
                  }}
                  className="px-2 py-0.5 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 hover:text-white border border-amber-500/40 transition-colors font-bold flex items-center gap-0.5"
                  title="Modo PC Antiguo / Hardware Modesto: Desactiva animaciones de ondas de fondo y ajusta video a 480p fluido (H.264 ligero)"
                >
                  📟 PC Antiguo (480p)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ videoOpacity: 1.0, headerBgOpacity: 0.15, footerBgOpacity: 0.70, topFadeOpacity: 0.0, bottomFadeOpacity: 0.20, wavesOpacity: 0.40 })}
                  className="px-2 py-0.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-white border border-red-500/40 transition-colors font-bold flex items-center gap-0.5"
                  title="Modo Máximo Rendimiento: Video nítido al 100% y 60 FPS fluidos sin sobrecarga"
                >
                  ⚡ 60 FPS
                </button>
              </div>

              {/* Quick Quality Button inside Visual popover */}
              <button
                id="btn-floating-quality"
                type="button"
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 hover:text-white transition-all cursor-pointer font-bold flex-shrink-0"
                title="Ajustar calidad de video"
              >
                <Sparkles size={10} className="text-red-400" />
                <span>{currentQualityOption.badge || currentQualityOption.shortLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Quality Menu Popover Modal */}
      {showQualityMenu && (
        <div className="fixed bottom-28 sm:bottom-32 left-4 sm:left-6 z-50 animate-fadeIn">
          <QualityMenuPopover
            currentQuality={playerState.playbackQuality || 'auto'}
            availableQualities={playerState.availableQualities}
            currentSpeed={playerState.playbackSpeed || 1.0}
            onSelectQuality={(q) => {
              handleSelectQuality(q);
              setShowQualityMenu(false);
            }}
            onSelectSpeed={handleSelectSpeed}
            onClose={() => setShowQualityMenu(false)}
          />
        </div>
      )}

      {/* 3. BOTTOM CAR-SAFE CONTROLS & STATUS FOOTER (Manipulable dark background transparency - text & scrubber remain 100% sharp) */}
      <footer
        id="footer-info-bar"
        className="w-full p-3 sm:p-5 lg:p-6 relative z-20 transition-all duration-300 select-none"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${effectiveFooterBg})`,
          borderTop: `1px solid rgba(255, 255, 255, ${Math.max(0.04, effectiveFooterBg * 0.15)})`
        }}
      >
        {/* Top Control Banner when Layout Edit Mode is Active */}
        {isEditingBottomBar && (
          <div className="w-full max-w-[1920px] mx-auto mb-4 p-3 rounded-2xl bg-black/95 backdrop-blur-2xl border border-red-500/70 shadow-[0_0_35px_rgba(220,38,38,0.35)] flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5 text-white font-mono">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="font-bold text-red-400 uppercase tracking-wider">Modo Diseño Activo:</span>
              <span className="text-gray-300 text-[11px] hidden sm:inline">
                Arrastra cualquier bloque para moverlo libremente (X/Y) o tira de sus esquinas para redimensionarlo. Usa &lt; y &gt; para cambiar el orden.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetBottomBarLayout}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white border border-white/15 transition-all flex items-center gap-1.5 font-mono text-xs cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Restablecer Diseño</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditingBottomBar(false)}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center gap-1.5 font-mono text-xs cursor-pointer"
              >
                <Check size={13} />
                <span>Listo / Guardar</span>
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-[1920px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-5 lg:gap-6">
          {(() => {
            // Dictionary of module content & renderers
            const bottomBarItemRenderers: Record<BottomBarElementId, { name: string; icon: any; content: React.ReactNode }> = {
              qr_code: {
                name: 'QR Móvil',
                icon: Smartphone,
                content: (
                  <div className="flex-shrink-0">
                    <QuickRemoteQrCode onOpenNodeSync={onOpenNodeSync} />
                  </div>
                )
              },
              track_info: {
                name: 'Pista & Progreso',
                icon: Music,
                content: (
                  <div className="flex flex-col justify-center min-w-0 flex-1 w-full">
                    <div className="flex items-center gap-3.5 mb-3 min-w-0">
                      <div className="w-14 h-14 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0">
                        {playerState.currentTrack ? (
                          <img
                            src={
                              playerState.currentTrack.thumbnail && !playerState.currentTrack.thumbnail.includes('unsplash')
                                ? playerState.currentTrack.thumbnail
                                : `https://i.ytimg.com/vi/${playerState.currentTrack.id}/hqdefault.jpg`
                            }
                            alt={playerState.currentTrack.title}
                            className="w-full h-full object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (playerState.currentTrack?.id) {
                                e.currentTarget.src = `https://img.youtube.com/vi/${playerState.currentTrack.id}/hqdefault.jpg`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-red-950/40 to-blue-950/40" />
                        )}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-base font-bold text-white truncate min-w-0">
                            {playerState.currentTrack?.title || "Sin pista seleccionada"}
                          </h2>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Interactive Layout Customizer Toggle */}
                            <button
                              id="btn-footer-edit-layout"
                              type="button"
                              onClick={() => setIsEditingBottomBar(prev => !prev)}
                              className={`p-1.5 rounded-lg border transition-all flex-shrink-0 cursor-pointer ${
                                isEditingBottomBar
                                  ? 'bg-red-600 border-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.6)]'
                                  : 'bg-white/5 hover:bg-white/15 border-white/10 text-gray-400 hover:text-white'
                              }`}
                              title={isEditingBottomBar ? "Guardar y salir de la personalización de la barra" : "Redimensionar y posicionar libremente los elementos"}
                            >
                              {isEditingBottomBar ? <Check size={14} className="text-white" /> : <LayoutGrid size={14} className="text-red-400" />}
                            </button>

                            {/* Single Unified Adjustments Icon for Info Bar */}
                            <button
                              id="btn-visual-transparency-toggle"
                              type="button"
                              onClick={() => setShowVisualControls(!showVisualControls)}
                              className={`p-1.5 rounded-lg border transition-all flex-shrink-0 cursor-pointer ${
                                showVisualControls
                                  ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                                  : 'bg-white/5 hover:bg-white/15 border-white/10 text-gray-400 hover:text-white'
                              }`}
                              title="Ajustes de transparencia, orbe, video y rendimiento"
                            >
                              <SlidersHorizontal size={14} className={showVisualControls ? 'text-white' : 'text-red-400'} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {playerState.currentTrack?.artist || "Di una orden para comenzar"}
                        </p>
                      </div>
                    </div>

                    {/* Crimson Red Progress Bar */}
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 transition-all duration-300"
                        style={{
                          width: playerState.duration > 0
                            ? `${Math.min(100, (playerState.currentTime / playerState.duration) * 100)}%`
                            : '0%'
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-1.5 text-[10px] text-gray-500 font-mono">
                      <span>{formatTime(playerState.currentTime)}</span>
                      <button
                        id="btn-footer-quality-badge"
                        type="button"
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 hover:border-red-500/40 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                        title="Cambiar resolución y velocidad de video"
                      >
                        <Sparkles size={10} className="text-red-400" />
                        <span className="font-bold text-red-400">{currentQualityOption.badge || currentQualityOption.shortLabel}</span>
                        {playerState.playbackSpeed && playerState.playbackSpeed !== 1.0 && (
                          <span className="text-blue-400 text-[9px] font-bold">({playerState.playbackSpeed}x)</span>
                        )}
                      </button>
                      <span>{formatTime(playerState.duration)}</span>
                    </div>
                  </div>
                )
              },
              playback_controls: {
                name: 'Controles & Ecualizador',
                icon: Play,
                content: (
                  <div className="flex flex-col justify-center items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-5 sm:gap-7">
                      {/* Repeat */}
                      <button
                        id="btn-ctrl-repeat"
                        type="button"
                        onClick={onToggleRepeat}
                        className={`p-2 transition-colors ${
                          playerState.repeatMode !== 'none' ? 'text-red-500' : 'text-gray-400 hover:text-white'
                        }`}
                        title="Repetir pista"
                      >
                        <Repeat size={18} />
                      </button>

                      {/* Non-Stop Toggle */}
                      {onToggleNonStop && (
                        <button
                          id="btn-ctrl-non-stop"
                          type="button"
                          onClick={onToggleNonStop}
                          className={`p-2 transition-colors cursor-pointer rounded-xl flex items-center justify-center ${
                            playerState.nonStop !== false ? 'text-red-500 bg-red-600/10' : 'text-gray-500 hover:text-gray-300'
                          }`}
                          title={
                            playerState.nonStop !== false
                              ? 'Non-Stop Activo (reproducción continua sin interrupciones)'
                              : 'Activar Non-Stop'
                          }
                        >
                          <Infinity size={18} className={playerState.nonStop !== false ? 'animate-pulse' : ''} />
                        </button>
                      )}

                      {/* Previous */}
                      <button
                        id="btn-ctrl-previous"
                        type="button"
                        onClick={onPreviousTrack}
                        className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Canción anterior"
                      >
                        <SkipBack size={22} />
                      </button>

                      {/* Giant Pure White Play/Pause Button */}
                      <button
                        id="btn-ctrl-play-pause"
                        type="button"
                        onClick={onTogglePlay}
                        className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-200 transition-transform active:scale-95 cursor-pointer"
                        title={playerState.isPlaying ? "Pausar" : "Reproducir"}
                      >
                        {playerState.isPlaying ? (
                          <Pause size={28} fill="currentColor" />
                        ) : (
                          <Play size={28} fill="currentColor" className="ml-1" />
                        )}
                      </button>

                      {/* Next */}
                      <button
                        id="btn-ctrl-next"
                        type="button"
                        onClick={onNextTrack}
                        className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Siguiente pista"
                      >
                        <SkipForward size={22} />
                      </button>

                      {/* Mic Listen Toggle */}
                      <button
                        id="btn-ctrl-mic"
                        type="button"
                        onClick={onToggleListening}
                        className={`p-2 transition-colors ${
                          isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'
                        }`}
                        title={isListening ? "Escuchando voz" : "Activar micrófono"}
                      >
                        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                      </button>
                    </div>

                    {/* Red Equalizer Visualizer Bars */}
                    <div className="flex gap-1 items-end h-7">
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-200 ${playerState.isPlaying ? 'h-3 animate-pulse' : 'h-1.5'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-300 ${playerState.isPlaying ? 'h-6' : 'h-2'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-150 ${playerState.isPlaying ? 'h-4 animate-bounce' : 'h-1.5'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-250 ${playerState.isPlaying ? 'h-7 animate-pulse' : 'h-3'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-200 ${playerState.isPlaying ? 'h-5' : 'h-2'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-150 ${playerState.isPlaying ? 'h-6 animate-pulse' : 'h-1.5'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-300 ${playerState.isPlaying ? 'h-4' : 'h-2'}`} />
                      <div className={`w-1 bg-red-600 rounded-full transition-all duration-200 ${playerState.isPlaying ? 'h-2' : 'h-1.5'}`} />
                    </div>
                  </div>
                )
              },
              volume_nodes: {
                name: 'Nodos & Volumen',
                icon: Volume2,
                content: (
                  <div className="flex flex-col justify-center gap-3 flex-shrink-0 w-full sm:w-72">
                    {/* Network Nodes Mini Status */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500">
                        <span>Network Nodes</span>
                        <span>Active</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-1 px-2.5 bg-white/5 rounded border border-white/5">
                        <span className="text-gray-300">MASTER (Dashboard)</span>
                        <span className="text-green-500 font-mono">●</span>
                      </div>
                      {connectedNodesCount > 1 && (
                        <div className="flex items-center justify-between text-xs py-1 px-2.5 bg-white/5 rounded border border-white/5">
                          <span className="text-gray-300">SATELLITE_A (Remote Mic)</span>
                          <span className="text-blue-400 font-mono">●</span>
                        </div>
                      )}
                    </div>

                    {/* Video Quality Badge & Selector */}
                    <button
                      id="btn-footer-quality-row"
                      type="button"
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="flex items-center justify-between bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded border border-white/10 hover:border-red-500/40 transition-colors cursor-pointer text-left w-full"
                      title="Cambiar calidad y resolución de video"
                    >
                      <span className="text-[9px] font-bold uppercase text-gray-300 tracking-tighter flex items-center gap-1">
                        <Tv size={11} className="text-red-400" />
                        Calidad
                      </span>
                      <span className="text-[9px] font-mono font-bold text-red-400 truncate max-w-[80px] text-right">
                        {currentQualityOption.badge || currentQualityOption.shortLabel}
                      </span>
                    </button>

                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onToggleMute}
                        className="text-gray-400 hover:text-white p-1"
                        title={playerState.isMuted ? "Activar audio" : "Silenciar"}
                      >
                        {playerState.isMuted ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="1"
                        value={playerState.isMuted ? 0 : playerState.volume}
                        onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
                        className="flex-1 accent-red-600 bg-white/10 rounded-lg cursor-pointer h-1.5"
                        title={`Volumen: ${playerState.volume}`}
                      />
                      <span className="text-[10px] font-mono text-gray-400 w-7 text-right">
                        {playerState.isMuted ? '0' : playerState.volume}
                      </span>
                    </div>
                  </div>
                )
              }
            };

            const sortedBottomBarItemIds = (Object.keys(bottomBarLayout.items) as BottomBarElementId[]).sort(
              (a, b) => (bottomBarLayout.items[a]?.order ?? 0) - (bottomBarLayout.items[b]?.order ?? 0)
            );

            return sortedBottomBarItemIds.map((id) => {
              const itemConfig = bottomBarLayout.items[id] || { id, scale: 1.0, offsetX: 0, offsetY: 0, order: 0, hidden: false };
              if (itemConfig.hidden && !isEditingBottomBar) return null;

              const itemMeta = bottomBarItemRenderers[id];
              if (!itemMeta) return null;

              const isDragging = activeDragItem === id;
              const isResizing = activeResizeItem === id;
              const IconComponent = itemMeta.icon;

              const style: React.CSSProperties = {
                order: itemConfig.order,
                transform: `translate(${itemConfig.offsetX}px, ${itemConfig.offsetY}px) scale(${itemConfig.scale})`,
                transformOrigin: 'center center',
                transition: (isDragging || isResizing) ? 'none' : 'transform 0.15s ease-out',
                zIndex: isDragging || isResizing ? 45 : 10
              };

              const isFlexGrow = id === 'track_info';

              return (
                <div
                  key={id}
                  style={style}
                  className={`relative transition-[border-color,background-color,box-shadow] ${
                    isFlexGrow ? 'flex-1 min-w-0 w-full xl:w-auto xl:max-w-2xl' : 'flex-shrink-0'
                  } ${
                    isEditingBottomBar
                      ? 'p-2 sm:p-3 rounded-3xl border-2 border-dashed bg-black/75 shadow-2xl backdrop-blur-xl ' +
                        (isDragging || isResizing ? 'border-red-500 ring-2 ring-red-500/50 shadow-[0_0_35px_rgba(220,38,38,0.6)]' : 'border-white/30 hover:border-red-400/80')
                      : ''
                  }`}
                >
                  {/* Edit Mode Floating Toolbar for this element */}
                  {isEditingBottomBar && (
                    <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-white/15 text-[10px] font-mono select-none bg-black/90 -mx-1 px-2.5 py-1.5 rounded-xl shadow-lg">
                      <div
                        onMouseDown={(e) => handleStartItemDrag(e, id)}
                        onTouchStart={(e) => handleStartItemDrag(e, id)}
                        className="flex items-center gap-1.5 font-bold text-red-400 cursor-grab active:cursor-grabbing hover:text-white transition-colors"
                        title="Arrastra para mover la posición X / Y de este bloque"
                      >
                        <Move size={13} className="text-red-400 shrink-0" />
                        <IconComponent size={12} className="shrink-0 text-gray-300" />
                        <span className="truncate max-w-[110px]">{itemMeta.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Swap Order Left */}
                        <button
                          type="button"
                          onClick={() => handleSwapItemOrder(id, 'left')}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Mover hacia la izquierda"
                        >
                          <ArrowLeft size={11} />
                        </button>

                        {/* Swap Order Right */}
                        <button
                          type="button"
                          onClick={() => handleSwapItemOrder(id, 'right')}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Mover hacia la derecha"
                        >
                          <ArrowRight size={11} />
                        </button>

                        {/* Scale Down */}
                        <button
                          type="button"
                          onClick={() => handleUpdateItemLayout(id, { scale: Math.max(0.5, Math.round((itemConfig.scale - 0.05) * 100) / 100) })}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Reducir tamaño"
                        >
                          <Minus size={11} />
                        </button>

                        <span className="text-red-400 font-bold px-1 min-w-[36px] text-center">{Math.round(itemConfig.scale * 100)}%</span>

                        {/* Scale Up */}
                        <button
                          type="button"
                          onClick={() => handleUpdateItemLayout(id, { scale: Math.min(2.2, Math.round((itemConfig.scale + 0.05) * 100) / 100) })}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Aumentar tamaño"
                        >
                          <Plus size={11} />
                        </button>

                        {/* Reset */}
                        <button
                          type="button"
                          onClick={() => handleUpdateItemLayout(id, { scale: 1.0, offsetX: 0, offsetY: 0 })}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors cursor-pointer ml-1"
                          title="Centrar y restablecer 100%"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actual Module Content */}
                  <div className={isEditingBottomBar ? 'pointer-events-none select-none' : ''}>
                    {itemMeta.content}
                  </div>

                  {/* Corner Resize Handle */}
                  {isEditingBottomBar && (
                    <div
                      onMouseDown={(e) => handleStartItemResize(e, id)}
                      onTouchStart={(e) => handleStartItemResize(e, id)}
                      className="absolute -bottom-2.5 -right-2.5 w-7 h-7 rounded-xl bg-black/95 border border-red-500 text-red-400 hover:text-white hover:bg-red-600 flex items-center justify-center cursor-nwse-resize shadow-2xl z-30 transition-all hover:scale-110 active:scale-95"
                      title="Arrastrar esquina para redimensionar libremente"
                    >
                      <Maximize2 size={12} />
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </footer>

      {/* MASTER PLAYLIST QUEUE MODAL / DRAWER (PRÓXIMAS 20 CANCIONES) */}
      {showPlaylistQueueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-zinc-900/95 border border-white/20 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
                  <ListMusic size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Lista de Reproducción
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/50">
                      {displayQueueMaster.length} {displayQueueMaster.length === 1 ? 'canción' : 'canciones'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Canción actual y próximas pistas sincronizadas en vivo con los satélites
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaylistQueueModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal List Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {displayQueueMaster.length === 0 ? (
                <div className="text-center py-12 bg-black/30 rounded-2xl border border-white/5">
                  <Music size={32} className="mx-auto text-gray-500 mb-2 opacity-50" />
                  <p className="text-sm text-gray-300 font-medium">No hay canciones en la cola</p>
                  <p className="text-xs text-gray-500 mt-1">Busca una canción o artista para iniciar la lista</p>
                </div>
              ) : (
                displayQueueMaster.map((track, idx) => {
                  const isCurrent = idx === 0;
                  const thumbUrl = track.thumbnail && !track.thumbnail.includes('unsplash')
                    ? track.thumbnail
                    : (track.id ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : '');

                  return (
                    <div
                      key={`master-${track.id}-${idx}`}
                      onClick={() => {
                        onSelectTrackFromQueue && onSelectTrackFromQueue(track, idx);
                        setShowPlaylistQueueModal(false);
                      }}
                      className={`group flex items-center gap-3.5 p-3 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                        isCurrent
                          ? 'bg-gradient-to-r from-red-950/50 via-zinc-900/80 to-black/60 border-red-500/60 shadow-[0_0_20px_rgba(220,38,38,0.25)]'
                          : 'bg-black/40 hover:bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {/* Number / Soundwave */}
                      <div className="w-7 text-center shrink-0">
                        {isCurrent ? (
                          <div className="flex items-center justify-center gap-0.5 text-red-500">
                            <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" />
                            <span className="w-1 h-2.5 bg-red-500 rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-5 bg-red-500 rounded-full animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-gray-400 group-hover:text-white font-bold">
                            #{idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Video Thumbnail (Miniatura del video) */}
                      <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden bg-black/80 border border-white/10 shrink-0 shadow">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <Music size={20} />
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] font-black text-white uppercase tracking-wider bg-red-600 px-1 py-0.2 rounded shadow">
                              EN VIVO
                            </span>
                          </div>
                        )}
                        {track.duration && (
                          <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/80 text-gray-300 px-1 rounded">
                            {track.duration}
                          </span>
                        )}
                      </div>

                      {/* Video Title (Nombre del video) & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-red-300 font-bold' : 'text-gray-100 group-hover:text-white'
                        }`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {track.artist || 'YouTube'}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {isCurrent ? (
                          <span className="text-[11px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-2.5 py-1 rounded-lg">
                            REPRODUCIENDO
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrackFromQueue && onSelectTrackFromQueue(track, idx);
                              setShowPlaylistQueueModal(false);
                            }}
                            className="p-2.5 rounded-xl bg-white/5 group-hover:bg-red-600 group-hover:text-white text-gray-400 border border-white/10 group-hover:border-red-500 transition-all active:scale-95 shadow"
                            title="Reproducir ahora"
                          >
                            <Play size={14} className="fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sincronizado vía WebSocket con satélites
              </span>
              <button
                type="button"
                onClick={() => setShowPlaylistQueueModal(false)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube / Google Account Sign In Modal */}
      <YouTubeAuthModal
        isOpen={showYouTubeAuthModal}
        onClose={() => {
          setShowYouTubeAuthModal(false);
          setGoogleProfile(youtubeAuthService.getProfile());
        }}
        onReloadPlayer={() => {
          window.dispatchEvent(new CustomEvent('serchtube:reload-player'));
          if (nodeRole === 'satellite') {
            try {
              NodeSyncService.getInstance().sendCommandToMaster({ action: 'reload_player' });
            } catch (e) {}
          }
        }}
        isSatellite={nodeRole === 'satellite'}
      />

      {/* Host Subnet Scanner Modal */}
      <HostScannerModal
        isOpen={isHostScannerOpen}
        onClose={() => setIsHostScannerOpen(false)}
      />
    </div>
  );
};

export const OledDrivingDashboard = React.memo(OledDrivingDashboardComponent);
