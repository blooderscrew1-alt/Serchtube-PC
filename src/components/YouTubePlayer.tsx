import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Track, PlayerState, SystemStatus, VideoQuality, AutoVolumeReducerConfig } from '../types';
import { getQualityOption } from '../utils/quality';
import { Sparkles, Gauge, VolumeX, ArrowDown } from 'lucide-react';
import { youtubeAuthService } from '../services/youtubeAuthService';
import { AudioEngine } from '../services/audioEngine';

/**
 * La API de YouTube IGNORA `setPlaybackQuality()` desde hace años (está obsoleta):
 * la única forma real de fijar la calidad es recargar el video con
 * `suggestedQuality`. Nuestros ids ya son valores válidos de la API
 * (highres, hd1080, hd720, large, medium, small, tiny) y 'auto' -> 'default'.
 */
function ytSuggestedQuality(calidad?: string): string {
  if (!calidad || calidad === 'auto') return 'default';
  return calidad;
}

interface YouTubePlayerProps {
  track: Track | null;
  playerState: PlayerState;
  onStateChange: (updates: Partial<PlayerState>) => void;
  onTrackEnded: () => void;
  isDucked: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onToggleNonStop?: () => void;
  onToggleListening?: () => void;
  systemStatus?: SystemStatus;
  autoVolumeConfig?: AutoVolumeReducerConfig;
  onAutoVolumeReduced?: (newVolume: number) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

const YouTubePlayerComponent: React.FC<YouTubePlayerProps> = ({
  track,
  playerState,
  onStateChange,
  onTrackEnded,
  isDucked,
  isFullscreen = false,
  onToggleFullscreen,
  opacity = 0.85,
  onNextTrack,
  onPreviousTrack,
  onToggleNonStop,
  onToggleListening,
  systemStatus = 'idle',
  autoVolumeConfig,
  onAutoVolumeReduced
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  // Keep a stable ref of all latest props to eliminate stale closures without recreating callbacks
  const latestPropsRef = useRef({
    track,
    playerState,
    onStateChange,
    onTrackEnded,
    isDucked,
    opacity,
    onNextTrack,
    isFullscreen,
    onToggleFullscreen
  });
  latestPropsRef.current = {
    track,
    playerState,
    onStateChange,
    onTrackEnded,
    isDucked,
    opacity,
    onNextTrack,
    isFullscreen,
    onToggleFullscreen
  };

  // Performance and state tracking refs (pure mutable variables that NEVER trigger React renders)
  const isApiReadyRef = useRef<boolean>(false);
  const isPlayerReadyRef = useRef<boolean>(false);
  const isPlayingIntentRef = useRef<boolean>(playerState.isPlaying);
  const lastVideoIdRef = useRef<string | null>(null);
  const pendingVideoIdRef = useRef<string | null>(track?.id || null);
  const currentTimeRef = useRef<number>(playerState.currentTime || 0);
  const durationRef = useRef<number>(playerState.duration || 0);
  const lastSecondRef = useRef<number>(-1);
  const lastAppliedQualityRef = useRef<VideoQuality>(playerState.playbackQuality || 'auto');
  const lastAppliedSpeedRef = useRef<number>(playerState.playbackSpeed || 1.0);
  const timeUpdateInterval = useRef<any>(null);

  // UI Feedback States (only for ephemeral user notifications)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qualityFeedback, setQualityFeedback] = useState<{ label: string; badge?: string; timestamp: number } | null>(null);
  const [speedFeedback, setSpeedFeedback] = useState<{ speed: number; timestamp: number } | null>(null);
  const failedVideoIdsRef = useRef<Set<string>>(new Set());
  const isRecoveringRef = useRef<boolean>(false);

  // Keep playing intent in sync
  useEffect(() => {
    isPlayingIntentRef.current = playerState.isPlaying;
  }, [playerState.isPlaying]);

  // Enforce locked user quality across video events
  const enforceUserQuality = useCallback((playerInstance?: any) => {
    const target = playerInstance || playerRef.current;
    if (!target) return;
    const desired = latestPropsRef.current.playerState.playbackQuality;
    if (desired && desired !== 'auto') {
      try {
        // OJO: estas dos llamadas estan obsoletas en la API de YouTube y el
        // reproductor las ignora. Se dejan solo por compatibilidad: la calidad real
        // se fija al cargar el video con suggestedQuality y al cambiarla a mano con
        // aplicarCalidadReal().
        if (typeof target.setPlaybackQuality === 'function') {
          target.setPlaybackQuality(desired);
        }
        if (typeof target.setPlaybackQualityRange === 'function') {
          target.setPlaybackQualityRange(desired, desired);
        }
        lastAppliedQualityRef.current = desired;
      } catch (e) {}
    }
  }, []);

  /**
   * Cambia la calidad DE VERDAD. La API ignora setPlaybackQuality, asi que hay que
   * recargar el video indicando suggestedQuality y conservando el segundo actual
   * (puede haber un instante de carga, es inevitable).
   */
  const aplicarCalidadReal = useCallback((calidad: string): boolean => {
    const player: any = playerRef.current;
    const videoId = latestPropsRef.current.track?.id || lastVideoIdRef.current;
    if (!player || !videoId || typeof player.loadVideoById !== 'function') return false;

    let tiempo = 0;
    let estabaSonando = isPlayingIntentRef.current;
    try {
      tiempo = Math.max(0, Math.floor(player.getCurrentTime?.() ?? currentTimeRef.current ?? 0));
      const estado = player.getPlayerState?.();
      if (typeof estado === 'number') estabaSonando = estado === 1 || estado === 3;
    } catch (e) {}

    try {
      const opciones = {
        videoId,
        suggestedQuality: ytSuggestedQuality(calidad),
        startSeconds: tiempo
      };
      if (estabaSonando) {
        player.loadVideoById(opciones);
      } else if (typeof player.cueVideoById === 'function') {
        player.cueVideoById(opciones);
      } else {
        player.loadVideoById(opciones);
      }
      lastAppliedQualityRef.current = calidad as VideoQuality;
      currentTimeRef.current = tiempo;
      console.log(`[YouTube] Calidad cambiada a ${calidad} (recargando desde ${tiempo}s)`);
      return true;
    } catch (err) {
      console.warn('[YouTube] No pude cambiar la calidad:', err);
      return false;
    }
  }, []);

  // Calidad deseada por el usuario (se conserva aunque YouTube informe otra real)
  const desiredQualityRef = useRef<VideoQuality>(playerState.playbackQuality || 'auto');
  // Última calidad REAL informada por YouTube (solo informativa)
  const calidadInicialAplicadaRef = useRef<boolean>(false);

  // Centralized Video Loader - single entry point for all video loading
  const loadVideo = useCallback((videoId: string) => {
    if (!videoId) return;

    // Guard: Do not reload if the exact same video is already loaded and active
    if (lastVideoIdRef.current === videoId && isPlayerReadyRef.current && playerRef.current) {
      if (isPlayingIntentRef.current) {
        try {
          const state = playerRef.current.getPlayerState?.();
          if (state !== 1 && state !== 3) {
            playerRef.current.playVideo();
          }
        } catch (e) {}
      }
      return;
    }

    pendingVideoIdRef.current = videoId;

    if (!isPlayerReadyRef.current || !playerRef.current || typeof playerRef.current.loadVideoById !== 'function') {
      return;
    }

    try {
      lastVideoIdRef.current = videoId;
      playerRef.current.loadVideoById({
        videoId,
        suggestedQuality: ytSuggestedQuality(desiredQualityRef.current),
        startSeconds: 0
      });
      enforceUserQuality();
      setLoadError(null);
      currentTimeRef.current = 0;
      lastSecondRef.current = -1;
      latestPropsRef.current.onStateChange({ isPlaying: true, currentTime: 0 });
    } catch (e) {
      try {
        playerRef.current.loadVideoById({
          videoId: videoId,
          suggestedQuality: ytSuggestedQuality(desiredQualityRef.current),
          startSeconds: 0
        });
        enforceUserQuality();
        setLoadError(null);
        currentTimeRef.current = 0;
        lastSecondRef.current = -1;
        latestPropsRef.current.onStateChange({ isPlaying: true, currentTime: 0 });
      } catch (err) {
        console.warn('Could not load video via loadVideoById:', err);
      }
    }
  }, [enforceUserQuality]);

  // Initialize YT.Player once and only once - identity is completely stable (deps: [])
  const initPlayer = useCallback(() => {
    if (!window.YT || !window.YT.Player) return;
    if (playerRef.current && isPlayerReadyRef.current) return;

    const targetElement = document.getElementById('yt-player-iframe');
    if (!targetElement) return;

    const initialVideoId = pendingVideoIdRef.current || latestPropsRef.current.track?.id || null;
    lastVideoIdRef.current = initialVideoId;

    const playerConfig: any = {
      ...(initialVideoId ? { videoId: initialVideoId } : {}),
      playerVars: {
        autoplay: initialVideoId && isPlayingIntentRef.current ? 1 : 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        playsinline: 1,
        fs: 1,
        iv_load_policy: 3,
        disablekb: 0,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined
      },
      events: {
        onReady: (event: any) => {
          isPlayerReadyRef.current = true;
          const currentProps = latestPropsRef.current;
          
          // Initial volume setup
          const rawVolume100 = Math.min(100, Math.max(0, Math.round((currentProps.playerState.volume / 15) * 100)));
          const effectiveVol = currentProps.playerState.isMuted
            ? 0
            : currentProps.isDucked
            ? Math.round(rawVolume100 * 0.2)
            : rawVolume100;
          event.target.setVolume(effectiveVol);

          // Initial playback rate
          if (currentProps.playerState.playbackSpeed && currentProps.playerState.playbackSpeed !== 1.0 && typeof event.target.setPlaybackRate === 'function') {
            try {
              event.target.setPlaybackRate(currentProps.playerState.playbackSpeed);
              lastAppliedSpeedRef.current = currentProps.playerState.playbackSpeed;
            } catch (e) {}
          }

          // Initial quality enforcement: la API ya no acepta la calidad en el
          // constructor, asi que si hay una preferencia guardada (no 'auto') se
          // aplica con una recarga suave en el segundo 0.
          enforceUserQuality(event.target);
          if (desiredQualityRef.current && desiredQualityRef.current !== 'auto' && !calidadInicialAplicadaRef.current) {
            calidadInicialAplicadaRef.current = true;
            aplicarCalidadReal(desiredQualityRef.current);
          }

          // If there was a pending track waiting for player initialization
          if (pendingVideoIdRef.current && pendingVideoIdRef.current !== initialVideoId) {
            loadVideo(pendingVideoIdRef.current);
          } else if (isPlayingIntentRef.current && initialVideoId) {
            try {
              event.target.playVideo();
            } catch (e) {}
          }
        },
        onStateChange: (event: any) => {
          // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 video cued
          if (event.data === 1) {
            // Actively playing
            youtubeAuthService.recordPlaybackSuccess();
            isPlayingIntentRef.current = true;
            enforceUserQuality();
            const dur = playerRef.current?.getDuration?.() || 0;
            if (dur > 0) {
              durationRef.current = dur;
            }
            latestPropsRef.current.onStateChange({
              isPlaying: true,
              ...(dur > 0 ? { duration: dur } : {})
            });
          } else if (event.data === 3 || event.data === 5) {
            // Buffering or cued
            enforceUserQuality();
          } else if (event.data === 2) {
            // Paused naturally
            if (!isPlayingIntentRef.current) {
              latestPropsRef.current.onStateChange({ isPlaying: false });
            }
          } else if (event.data === 0) {
            // Track ended naturally
            latestPropsRef.current.onTrackEnded();
          }
        },
        onPlaybackQualityChange: (event: any) => {
          // Solo se informa la calidad REAL observada. La preferencia del usuario
          // (playerState.playbackQuality) NO se toca aqui: antes se sobrescribia con
          // lo que reportaba YouTube (p. ej. 144p al recargar o en segundo plano) y el
          // panel mostraba una calidad distinta a la elegida.
          const observada = String(event.data || '');
          if (observada) {
            latestPropsRef.current.onStateChange({ actualQuality: observada });
          }
        },
        onPlaybackRateChange: (event: any) => {
          const newSpeed = event.data;
          if (typeof newSpeed !== 'number') return;
          lastAppliedSpeedRef.current = newSpeed;
          latestPropsRef.current.onStateChange({ playbackSpeed: newSpeed });
          setSpeedFeedback({
            speed: newSpeed,
            timestamp: Date.now()
          });
          setTimeout(() => {
            setSpeedFeedback(prev => (prev && Date.now() - prev.timestamp >= 2400 ? null : prev));
          }, 2500);
        },
        onError: async (e: any) => {
          const errorCode = e.data;
          console.warn('[YouTube Player] Error code encountered:', errorCode);

          const currentTrack = latestPropsRef.current.track;
          const currentId = currentTrack?.id || lastVideoIdRef.current || '';

          if (currentId) {
            failedVideoIdsRef.current.add(currentId);
          }

          if (isRecoveringRef.current) return;
          isRecoveringRef.current = true;

          // Error codes 101/150 = Embedding not allowed by video owner; 100 = Video removed/private; 2/5 = Invalid param/HTML5 error
          const isEmbedRestriction = errorCode === 101 || errorCode === 150;
          youtubeAuthService.recordPlaybackError(errorCode, isEmbedRestriction);
          const songName = currentTrack?.title ? `"${currentTrack.title}"` : 'la canción';
          const errMsg = isEmbedRestriction
            ? `Restricción de reproducción en YouTube (o comprobación de bot). Sintonizando versión alternativa...`
            : `Video no disponible. Sintonizando versión alternativa de ${songName}...`;

          setLoadError(errMsg);

          try {
            if (currentTrack && (currentTrack.title || currentTrack.artist)) {
              // 1. Buscar específicamente una versión alternativa compatible de LA MISMA canción
              const queryParams = new URLSearchParams({
                failedId: currentId,
                title: currentTrack.title || '',
                artist: currentTrack.artist || ''
              });
              const resp = await fetch(`/api/youtube/find-alternative?${queryParams.toString()}`);
              if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.alternative && data.alternative.id && !failedVideoIdsRef.current.has(data.alternative.id)) {
                  const validAlt = data.alternative;
                  console.log('[YouTube Player] 🎯 Sintonizando versión compatible de la misma canción:', validAlt.id, validAlt.title);
                  setLoadError(`Sintonizando versión compatible: "${validAlt.title}"`);
                  latestPropsRef.current.onStateChange({
                    currentTrack: {
                      ...validAlt,
                      thumbnail: validAlt.thumbnail || `https://i.ytimg.com/vi/${validAlt.id}/hqdefault.jpg`
                    },
                    isPlaying: true,
                    currentTime: 0
                  });
                  loadVideo(validAlt.id);
                  setTimeout(() => {
                    setLoadError(null);
                    isRecoveringRef.current = false;
                  }, 4000);
                  return;
                }
              }

              // 2. Respaldo secundario: búsqueda limpia sin entidades bloqueadas
              const cleanTitle = (currentTrack.title || '')
                .replace(/\b(?:nfl\s+y\s+\d+\s+m[aá]s|nfl\s+network|nfl\s+highlights|nfl|nba|fifa)\b/gi, '')
                .replace(/[\[\(](?:official\s*video|video\s*oficial|audio\s*oficial)[\]\)]/gi, '')
                .trim();
              const resp2 = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanTitle)}&isArtist=false`);
              if (resp2.ok) {
                const data2 = await resp2.json();
                const items = data2.items || [];
                const sameSongAlt = items.find((c: Track) =>
                  c.id &&
                  !failedVideoIdsRef.current.has(c.id) &&
                  !/nfl|nba|fifa/i.test(c.artist || '')
                );
                if (sameSongAlt) {
                  console.log('[YouTube Player] 🎯 Sintonizando alternativa directa compatible:', sameSongAlt.id, sameSongAlt.title);
                  setLoadError(`Sintonizando versión compatible: "${sameSongAlt.title}"`);
                  latestPropsRef.current.onStateChange({
                    currentTrack: {
                      ...sameSongAlt,
                      thumbnail: sameSongAlt.thumbnail || `https://i.ytimg.com/vi/${sameSongAlt.id}/hqdefault.jpg`
                    },
                    isPlaying: true,
                    currentTime: 0
                  });
                  loadVideo(sameSongAlt.id);
                  setTimeout(() => {
                    setLoadError(null);
                    isRecoveringRef.current = false;
                  }, 4000);
                  return;
                }
              }
            }
          } catch (searchErr) {
            console.warn('[YouTube Player] Auto-fallback search failed:', searchErr);
          }

          // Solo si no existe ninguna alternativa compatible de la canción solicitada, saltar a la siguiente canción
          console.log('[YouTube Player] No se encontró versión alternativa compatible para la canción solicitada. Avanzando a la siguiente canción.');
          if (latestPropsRef.current.onNextTrack) {
            latestPropsRef.current.onNextTrack();
          } else {
            const fallbackCatalog = ["Kpdq_OeaGkU", "1G4isv_Fylg", "DUT5rEU6pqM", "fJ9rUzIMcZQ"];
            const altId = fallbackCatalog.find(id => !failedVideoIdsRef.current.has(id)) || "Kpdq_OeaGkU";
            loadVideo(altId);
          }

          setTimeout(() => {
            setLoadError(null);
            isRecoveringRef.current = false;
          }, 3500);
        }
      }
    };

    playerRef.current = new window.YT.Player('yt-player-iframe', playerConfig);
  }, [enforceUserQuality, loadVideo]);

  // Load YouTube Iframe API once on mount
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      isApiReadyRef.current = true;
      initPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      isApiReadyRef.current = true;
      initPlayer();
    };

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    };
  }, [initPlayer]);

  // Controlled, lightweight playback time tracking interval
  // Runs ONLY when playing, pauses automatically on pause, cleans on unmount
  useEffect(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
      timeUpdateInterval.current = null;
    }

    if (!playerState.isPlaying) {
      return;
    }

    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current && isPlayerReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const pState = playerRef.current.getPlayerState?.();
          if (pState === 1) { // 1 = playing
            const rawCurrent = playerRef.current.getCurrentTime();
            const sec = Math.floor(rawCurrent);
            if (sec !== lastSecondRef.current) {
              lastSecondRef.current = sec;
              currentTimeRef.current = rawCurrent;
              const dur = playerRef.current.getDuration?.() || durationRef.current;
              durationRef.current = dur;
              latestPropsRef.current.onStateChange({ currentTime: rawCurrent, duration: dur });
            }
          }
        } catch (e) {}
      }
    }, 1000);

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    };
  }, [playerState.isPlaying]);

  // Single flow for switching tracks when track prop changes
  useEffect(() => {
    if (!track || !track.id) return;
    pendingVideoIdRef.current = track.id;
    isPlayingIntentRef.current = true;

    if (isPlayerReadyRef.current && playerRef.current) {
      loadVideo(track.id);
    }
  }, [track?.id, loadVideo]);

  // Synchronize Playback Quality ONLY when explicitly changed
  useEffect(() => {
    const targetQuality = playerState.playbackQuality;
    if (!targetQuality) return;

    try {
      localStorage.setItem('serchtube_video_quality', targetQuality);
    } catch (e) {}

    // La preferencia del usuario nunca se sobrescribe con la calidad real observada,
    // asi que aqui solo hay que aplicar de verdad cuando cambia la eleccion.
    const yaEraLaDeseada = desiredQualityRef.current === targetQuality;
    desiredQualityRef.current = targetQuality as VideoQuality;

    if (!playerRef.current || !isPlayerReadyRef.current) return;
    // Misma calidad que ya estaba aplicada: no se recarga el video
    if (yaEraLaDeseada && lastAppliedQualityRef.current === targetQuality) return;

    if (aplicarCalidadReal(targetQuality)) {
      const opt = getQualityOption(targetQuality);
      setQualityFeedback({
        label: opt.label,
        badge: opt.badge || opt.shortLabel,
        timestamp: Date.now()
      });
      setTimeout(() => {
        setQualityFeedback(prev => (prev && Date.now() - prev.timestamp >= 2400 ? null : prev));
      }, 2500);
    }
  }, [playerState.playbackQuality, aplicarCalidadReal]);

  // Synchronize Playback Speed ONLY when explicitly changed
  useEffect(() => {
    const targetSpeed = playerState.playbackSpeed;
    if (typeof targetSpeed !== 'number') return;

    if (targetSpeed !== lastAppliedSpeedRef.current && playerRef.current && isPlayerReadyRef.current) {
      try {
        lastAppliedSpeedRef.current = targetSpeed;
        if (typeof playerRef.current.setPlaybackRate === 'function') {
          playerRef.current.setPlaybackRate(targetSpeed);
        }
      } catch (e) {}
    }
  }, [playerState.playbackSpeed]);

  // Synchronize Play / Pause state without duplicate calls
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;
    try {
      const state = playerRef.current.getPlayerState?.();
      if (playerState.isPlaying) {
        isPlayingIntentRef.current = true;
        if (state !== 1 && state !== 3 && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } else {
        isPlayingIntentRef.current = false;
        if ((state === 1 || state === 3) && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      }
    } catch (e) {}
  }, [playerState.isPlaying]);

  // Synchronize Volume and Ducking
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current || typeof playerRef.current.setVolume !== 'function') return;
    try {
      if (playerState.isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        const rawVolume100 = Math.min(100, Math.max(0, Math.round((playerState.volume / 15) * 100)));
        // El volumen de la atenuacion es configurable (Ajustes > Atenuacion Inteligente):
        // 0% = silencio total mientras habla el asistente, 100% = sin atenuacion.
        const duckingVolume = AudioEngine.getInstance().getDuckingVolume();
        const effectiveVolume = isDucked ? Math.round(rawVolume100 * (duckingVolume / 100)) : rawVolume100;
        playerRef.current.setVolume(effectiveVolume);
      }
    } catch (e) {}
  }, [playerState.volume, playerState.isMuted, isDucked]);

  // Handle seek requests from relative events or direct position
  useEffect(() => {
    const handleSeekRelative = (e: any) => {
      const offset = e.detail?.offset || 0;
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const curr = playerRef.current.getCurrentTime();
          const target = Math.max(0, curr + offset);
          playerRef.current.seekTo(target, true);
          currentTimeRef.current = target;
          latestPropsRef.current.onStateChange({ currentTime: target });
        } catch (err) {}
      }
    };

    const handleSeekTo = (e: any) => {
      const target = e.detail?.time;
      if (playerRef.current && typeof target === 'number') {
        try {
          playerRef.current.seekTo(target, true);
          currentTimeRef.current = target;
          latestPropsRef.current.onStateChange({ currentTime: target });
        } catch (err) {}
      }
    };

    const handleReloadPlayer = () => {
      const currentId = latestPropsRef.current.track?.id || lastVideoIdRef.current;
      setLoadError(null);
      isRecoveringRef.current = false;
      failedVideoIdsRef.current.clear();
      if (currentId && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById({
            videoId: currentId,
            suggestedQuality: ytSuggestedQuality(desiredQualityRef.current),
            startSeconds: Math.max(0, currentTimeRef.current)
          });
          playerRef.current.playVideo?.();
        } catch (e) {
          console.warn('Could not reload video:', e);
        }
      }
    };

    window.addEventListener('serchtube:seek-relative', handleSeekRelative);
    window.addEventListener('serchtube:seek-to', handleSeekTo);
    window.addEventListener('serchtube:reload-player', handleReloadPlayer);
    return () => {
      window.removeEventListener('serchtube:seek-relative', handleSeekRelative);
      window.removeEventListener('serchtube:seek-to', handleSeekTo);
      window.removeEventListener('serchtube:reload-player', handleReloadPlayer);
    };
  }, []);

  // Keyboard Shortcuts for Media Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
        e.preventDefault();
        e.stopPropagation();
        const currentVol = latestPropsRef.current.playerState.volume;
        const nextVol = Math.min(15, currentVol + 1);
        latestPropsRef.current.onStateChange({ volume: nextVol, isMuted: false });
      } else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault();
        e.stopPropagation();
        const currentVol = latestPropsRef.current.playerState.volume;
        const nextVol = Math.max(0, currentVol - 1);
        latestPropsRef.current.onStateChange({ volume: nextVol, isMuted: false });
      } else if (e.key === 'AudioVolumeMute' || e.key === 'VolumeMute') {
        e.preventDefault();
        e.stopPropagation();
        latestPropsRef.current.onStateChange({ isMuted: !latestPropsRef.current.playerState.isMuted });
      } else if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        latestPropsRef.current.onStateChange({ isPlaying: !latestPropsRef.current.playerState.isPlaying });
      } else if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        latestPropsRef.current.onNextTrack?.();
      } else if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
      } else if (e.key === 'F11') {
        e.preventDefault();
        latestPropsRef.current.onToggleFullscreen?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      id="youtube-player-container"
      className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center select-none pointer-events-auto"
    >
      {/* 1. YouTube Iframe element target - 100% opaque for native GPU hardware acceleration */}
      <div
        id="yt-player-iframe"
        className="w-full h-full pointer-events-auto"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* 2. Visual Transparency Overlay - replicates exact dark dimming without altering iframe opacity */}
      {opacity < 1.0 && (
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-colors duration-300"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${Math.max(0, 1 - opacity)})`
          }}
        />
      )}

      {/* Floating Quality Change Toast Pill */}
      {qualityFeedback && (
        <div className="absolute top-20 right-6 z-30 flex items-center gap-2 bg-black/90 border border-red-500/50 text-white text-xs px-3.5 py-2 rounded-xl font-mono shadow-2xl animate-fadeIn pointer-events-none">
          <Sparkles size={14} className="text-red-500" />
          <span>Calidad: <strong className="text-red-400">{qualityFeedback.badge || qualityFeedback.label}</strong></span>
        </div>
      )}

      {/* Floating Speed Change Toast Pill */}
      {speedFeedback && (
        <div className="absolute top-28 right-6 z-30 flex items-center gap-2 bg-black/90 border border-blue-500/50 text-white text-xs px-3.5 py-2 rounded-xl font-mono shadow-2xl animate-fadeIn pointer-events-none">
          <Gauge size={14} className="text-blue-400" />
          <span>Velocidad: <strong className="text-blue-300">{speedFeedback.speed}x</strong></span>
        </div>
      )}

      {loadError && (
        <div className="absolute top-4 left-4 z-20 bg-red-950/95 border border-red-600/50 text-red-300 text-xs px-3.5 py-2.5 rounded-2xl font-mono flex items-center gap-3 shadow-2xl pointer-events-auto animate-fadeIn max-w-[90vw]">
          <span className="truncate">{loadError}</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('serchtube:open-youtube-auth'))}
            className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] uppercase transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            title="Iniciar sesión en YouTube para eliminar avisos de bot"
          >
            Iniciar Sesión
          </button>
        </div>
      )}
    </div>
  );
};

// React.memo with custom comparison: completely skips re-renders on high-frequency currentTime/duration ticks!
export const YouTubePlayer = React.memo<YouTubePlayerProps>(
  YouTubePlayerComponent,
  (prev, next) => {
    return (
      prev.track?.id === next.track?.id &&
      prev.playerState.isPlaying === next.playerState.isPlaying &&
      prev.playerState.volume === next.playerState.volume &&
      prev.playerState.isMuted === next.playerState.isMuted &&
      prev.playerState.playbackQuality === next.playerState.playbackQuality &&
      prev.playerState.playbackSpeed === next.playerState.playbackSpeed &&
      prev.isDucked === next.isDucked &&
      prev.opacity === next.opacity &&
      prev.isFullscreen === next.isFullscreen &&
      prev.systemStatus === next.systemStatus &&
      prev.autoVolumeConfig?.enabled === next.autoVolumeConfig?.enabled &&
      prev.autoVolumeConfig?.targetVolume === next.autoVolumeConfig?.targetVolume &&
      prev.autoVolumeConfig?.delaySeconds === next.autoVolumeConfig?.delaySeconds &&
      prev.autoVolumeConfig?.smoothFade === next.autoVolumeConfig?.smoothFade
    );
  }
);
