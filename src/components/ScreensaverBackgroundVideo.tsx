import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, Play } from 'lucide-react';

interface ScreensaverBackgroundVideoProps {
  videoId: string;
  isMuted: boolean;
  isInteractiveMode: boolean;
  darknessLevel: number;
  quality?: 'auto' | '720p' | '480p' | '1080p';
  autoRecover?: boolean;
  forceReloadTrigger?: number;
  onVideoStatusChange?: (status: 'playing' | 'buffering' | 'stalled' | 'ready') => void;
  onFallbackToCertifiedLoop?: () => void;
}

const ScreensaverBackgroundVideoComponent: React.FC<ScreensaverBackgroundVideoProps> = ({
  videoId,
  isMuted,
  isInteractiveMode,
  darknessLevel,
  quality = 'auto',
  autoRecover = true,
  forceReloadTrigger = 0,
  onVideoStatusChange,
  onFallbackToCertifiedLoop
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [internalReloadKey, setInternalReloadKey] = useState<number>(0);
  const [isBufferingStalled, setIsBufferingStalled] = useState<boolean>(false);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState<boolean>(false);
  const [stalledSeconds, setStalledSeconds] = useState<number>(0);
  const [hasEmbedError, setHasEmbedError] = useState<boolean>(false);

  // Playback monitoring refs
  const lastStateRef = useRef<number>(-1); // -1 = unstarted, 1 = playing, 2 = paused, 3 = buffering, 0 = ended
  const lastCurrentTimeRef = useRef<number>(-1);
  const lastRealMovementTimeRef = useRef<number>(Date.now());
  const initialLoadTimeRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<any>(null);
  const hasAppliedInitialQualityRef = useRef<boolean>(false);

  // Map quality to YouTube internal quality name
  const ytQualityName =
    quality === '480p' ? 'medium' : quality === '720p' ? 'hd720' : quality === '1080p' ? 'hd1080' : 'default';

  // Build clean, high-performance, non-blocking YouTube embed URL
  // Note: We intentionally avoid the deprecated 'vq' parameter in the URL as it conflicts with adaptive MPEG-DASH and causes stuttering
  const originStr = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = React.useMemo(() => {
    if (!videoId) return '';
    const params = new URLSearchParams({
      autoplay: '1',
      mute: isMuted ? '1' : '0',
      controls: isInteractiveMode ? '1' : '0',
      showinfo: '0',
      rel: '0',
      loop: '1',
      playlist: videoId,
      enablejsapi: '1',
      playsinline: '1',
      modestbranding: '1',
      iv_load_policy: '3',
      disablekb: '1',
      fs: '0'
    });
    if (originStr) {
      params.set('origin', originStr);
      params.set('widget_referrer', originStr);
    }
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, isMuted, isInteractiveMode, originStr]);

  // PostMessage helper to command YouTube iframe safely
  const sendYtCommand = useCallback((func: string, args: any = '') => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func,
            args: Array.isArray(args) ? args : [args]
          }),
          '*'
        );
      }
    } catch (_) {}
  }, []);

  // PostMessage handshake initialization so YouTube starts emitting events
  const sendHandshake = useCallback(() => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          '*'
        );
        sendYtCommand('addEventListener', 'onStateChange');
        sendYtCommand('addEventListener', 'onError');
      }
    } catch (_) {}
  }, [sendYtCommand]);

  // Gentle play nudge without resetting buffer or re-requesting stream
  const resumePlaybackSmooth = useCallback(() => {
    sendYtCommand('playVideo');
  }, [sendYtCommand]);

  // Set video quality ONLY on deliberate user change or initial start (never repeatedly!)
  const applyQualityOnce = useCallback(() => {
    if (quality && quality !== 'auto') {
      sendYtCommand('setPlaybackQuality', ytQualityName);
    }
  }, [quality, sendYtCommand, ytQualityName]);

  // Listen to YouTube postMessage events for actual state & progress delivery
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);

        // 1. Initial onReady event
        if (data.event === 'onReady' || data.event === 'initialDelivery') {
          sendHandshake();
          if (!hasAppliedInitialQualityRef.current) {
            hasAppliedInitialQualityRef.current = true;
            applyQualityOnce();
          }
          sendYtCommand('playVideo');
          return;
        }

        // 2. Playback state updates & time delivery
        if (data.event === 'infoDelivery' && data.info) {
          const { playerState, currentTime } = data.info;

          // Track actual time progression
          if (typeof currentTime === 'number') {
            const lastTime = lastCurrentTimeRef.current;
            // Video is actually moving if currentTime changed
            if (lastTime < 0 || Math.abs(currentTime - lastTime) > 0.08 || (currentTime < 1 && lastTime > 5)) {
              lastCurrentTimeRef.current = currentTime;
              lastRealMovementTimeRef.current = Date.now();
              setIsBufferingStalled(false);
              setStalledSeconds(0);
              setHasPlaybackStarted(true);
              onVideoStatusChange?.('playing');
            }
          }

          if (typeof playerState === 'number') {
            lastStateRef.current = playerState;

            if (playerState === 1) {
              // 1 = PLAYING: Video is actively running
              lastRealMovementTimeRef.current = Date.now();
              setIsBufferingStalled(false);
              setStalledSeconds(0);
              setHasPlaybackStarted(true);
              onVideoStatusChange?.('playing');
            } else if (playerState === 3) {
              // 3 = BUFFERING: In transit
              onVideoStatusChange?.('buffering');
            } else if (playerState === 2) {
              // 2 = PAUSED: Ambient background should stay playing continuously
              if (autoRecover) {
                resumePlaybackSmooth();
              }
            } else if (playerState === 0) {
              // 0 = ENDED: Instant seamless loop back to start without black screen pause
              sendYtCommand('seekTo', [0, true]);
              sendYtCommand('playVideo');
            }
          }
        }

        // 3. Error detection (e.g. video blocked or cannot be embedded)
        if (data.event === 'onError' || (data.info && typeof data.info.errorCode === 'number')) {
          console.warn('[Screensaver Background Video] YouTube error code received:', data.info?.errorCode || data);
          setHasEmbedError(true);
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [applyQualityOnce, autoRecover, onVideoStatusChange, resumePlaybackSmooth, sendHandshake, sendYtCommand]);

  // Apply quality change when user modifies settings (once)
  useEffect(() => {
    applyQualityOnce();
  }, [quality, applyQualityOnce]);

  // Active Heartbeat & Watchdog (Zero False Positives):
  // Polls real currentTime every 1.5s so we KNOW with 100% certainty if frames are advancing
  useEffect(() => {
    if (!autoRecover) return;

    lastRealMovementTimeRef.current = Date.now();
    initialLoadTimeRef.current = Date.now();
    lastCurrentTimeRef.current = -1;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Ping iframe for current position
    heartbeatIntervalRef.current = setInterval(() => {
      // Send query to get real position
      sendYtCommand('getCurrentTime');

      const now = Date.now();
      const elapsedSinceLoad = (now - initialLoadTimeRef.current) / 1000;
      const timeSinceRealMovement = (now - lastRealMovementTimeRef.current) / 1000;

      // Allow 8 seconds grace period on initial load
      if (elapsedSinceLoad < 8) {
        return;
      }

      // If the video has truly not advanced for more than 8 seconds
      if (timeSinceRealMovement > 8) {
        setIsBufferingStalled(true);
        setStalledSeconds(Math.floor(timeSinceRealMovement));
        onVideoStatusChange?.('stalled');

        // Step 1: Soft resume (DO NOT reset quality or buffer!)
        resumePlaybackSmooth();

        // Step 2: If stuck for more than 16 seconds, try a micro-seek to unblock player pipe
        if (timeSinceRealMovement > 16 && timeSinceRealMovement < 28) {
          if (lastCurrentTimeRef.current > 0) {
            sendYtCommand('seekTo', [lastCurrentTimeRef.current + 0.2, true]);
          }
          sendYtCommand('playVideo');
        }

        // Step 3: ONLY after 28 continuous seconds of dead silence and zero frame progress, soft reload
        if (timeSinceRealMovement > 28) {
          console.warn('[Screensaver Background Video] ⚡ Video congelado confirmado (>28s sin avance). Auto-recuperando...');
          setInternalReloadKey(k => k + 1);
          lastRealMovementTimeRef.current = Date.now();
          initialLoadTimeRef.current = Date.now();
          setIsBufferingStalled(false);
          setStalledSeconds(0);
        }
      } else {
        if (isBufferingStalled) {
          setIsBufferingStalled(false);
          setStalledSeconds(0);
        }
      }
    }, 1500);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [autoRecover, onVideoStatusChange, resumePlaybackSmooth, sendYtCommand, internalReloadKey]);

  // Handle external force reload trigger (from "Descongelar" button)
  useEffect(() => {
    if (forceReloadTrigger > 0) {
      setInternalReloadKey(k => k + 1);
      lastRealMovementTimeRef.current = Date.now();
      initialLoadTimeRef.current = Date.now();
      lastCurrentTimeRef.current = -1;
      setIsBufferingStalled(false);
      setStalledSeconds(0);
      setHasEmbedError(false);
      resumePlaybackSmooth();
    }
  }, [forceReloadTrigger, resumePlaybackSmooth]);

  // Manual unfreeze button click
  const handleManualUnfreeze = (e: React.MouseEvent) => {
    e.stopPropagation();
    resumePlaybackSmooth();
    setInternalReloadKey(k => k + 1);
    lastRealMovementTimeRef.current = Date.now();
    initialLoadTimeRef.current = Date.now();
    lastCurrentTimeRef.current = -1;
    setIsBufferingStalled(false);
    setStalledSeconds(0);
    setHasEmbedError(false);
  };

  if (!videoId || !embedUrl) return null;

  return (
    <div
      className={`absolute inset-0 z-0 overflow-hidden transition-opacity duration-300 ${
        isInteractiveMode ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        opacity: Math.max(0, (1 - darknessLevel * 0.88) * 0.70),
        contain: 'strict',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      }}
      onClick={(e) => {
        if (isInteractiveMode) {
          e.stopPropagation();
        }
      }}
    >
      {/* 
        Hardware-Accelerated Fullscreen Iframe:
        We use negative absolute margins (top: -8%, left: -8%, width: 116%, height: 116%)
        with translate3d(0, 0, 0) instead of CSS scale-125.
        This forces pure GPU composition and ELIMINATES frame drops & layout thrashing.
      */}
      <iframe
        key={`screensaver-yt-${videoId}-${internalReloadKey}`}
        ref={iframeRef}
        src={embedUrl}
        onLoad={() => {
          sendHandshake();
          applyQualityOnce();
          resumePlaybackSmooth();
        }}
        className="absolute border-0"
        style={{
          top: '-8%',
          left: '-8%',
          width: '116%',
          height: '116%',
          pointerEvents: isInteractiveMode ? 'auto' : 'none',
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
        title="Screensaver Ambient Video"
        loading="eager"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        tabIndex={-1}
      />

      {/* Auto-Recovery Banner when video experiences true network stall */}
      {isBufferingStalled && !isInteractiveMode && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-amber-500/50 text-amber-300 text-xs shadow-2xl flex items-center gap-2 pointer-events-auto cursor-pointer animate-fadeIn"
          onClick={handleManualUnfreeze}
          title="El video experimentó una pausa de conexión. Pulsa para forzar descongelamiento inmediato."
        >
          <RefreshCw size={13} className="animate-spin text-amber-400 shrink-0" />
          <span className="font-mono text-[11px]">
            Optimizando fluidez ({stalledSeconds}s)... Pulsa para reanudar
          </span>
        </div>
      )}

      {/* Video Embed Error Notice with Quick Certified Loop Fallback */}
      {hasEmbedError && (
        <div
          className="absolute top-32 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-red-950/90 backdrop-blur-md border border-red-500 text-red-200 text-xs shadow-2xl flex items-center gap-3 pointer-events-auto animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <div>
            <div className="font-bold text-red-100">Este video no permite reproducción externa</div>
            <div className="text-[10px] text-gray-300">YouTube bloqueó este enlace en modo embebido.</div>
          </div>
          {onFallbackToCertifiedLoop && (
            <button
              type="button"
              onClick={onFallbackToCertifiedLoop}
              className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition-colors cursor-pointer shrink-0"
            >
              Usar Fondo Certificado
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ScreensaverBackgroundVideo = React.memo(ScreensaverBackgroundVideoComponent);
