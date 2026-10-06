import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Track,
  PlayerState,
  SystemStatus,
  NodeRole,
  EqualizerSettings,
  ScreensaverConfig,
  DisplayVisualConfig,
  AutoVolumeReducerConfig,
  AutoShutdownConfig,
  AutoShutdownMode
} from './types';
import { AudioEngine, PRESET_EQUALIZERS } from './services/audioEngine';
import { SpeechService, SpeechConfig, parseWakeWord, normalizeText } from './services/speechService';
import {
  DEFAULT_AUTO_SHUTDOWN_CONFIG,
  getMsUntilTargetTime,
  playWarningChime,
  executeSystemShutdown,
  cancelSystemShutdown
} from './services/autoShutdownService';
import { NodeSyncService } from './services/nodeSync';
import { HostScannerService } from './services/hostScanner';
import { ChromeMediaService } from './services/chromeMediaService';
import { OledDrivingDashboard } from './components/OledDrivingDashboard';
import { ScreensaverOverlay } from './components/ScreensaverOverlay';
import { EqualizerModal } from './components/EqualizerModal';
import { NodeSyncModal } from './components/NodeSyncModal';
import { SettingsModal } from './components/SettingsModal';
import { AutoShutdownModal } from './components/AutoShutdownModal';
import { ShutdownCountdownWarning } from './components/ShutdownCountdownWarning';
import { KeyboardInputOverlay } from './components/KeyboardInputOverlay';
import { GoogleHomeModal } from './components/GoogleHomeModal';
import { AnimatedQrCountdownModal } from './components/AnimatedQrCountdownModal';
import { googleHomeService } from './services/googleHomeService';
import { isPureResumePhrase, extractYouTubeId, isValidYouTubeId } from './utils/youtube';
import { WAKE_GREETINGS, getEnthusiasticFeedback } from './utils/speechPhrases';

interface GamepadControlsProps {
  onVolumeStep: (delta: number, source: 'teclado' | 'control') => void;
  onMuteToggle: (source: 'teclado' | 'control') => void;
  onPlayPauseToggle: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onNotify?: (message: string) => void;
}

/**
 * Hook para soportar Mandos y Controles USB / Bluetooth (Xbox, PlayStation, Mandos genéricos, Volantes)
 * Permite cambiar el volumen EXCLUSIVO de la aplicación SerchTube sin alterar el volumen de Windows.
 */
function useGamepadControls({
  onVolumeStep,
  onMuteToggle,
  onPlayPauseToggle,
  onNextTrack,
  onPreviousTrack,
  onNotify
}: GamepadControlsProps) {
  const callbacksRef = useRef({
    onVolumeStep,
    onMuteToggle,
    onPlayPauseToggle,
    onNextTrack,
    onPreviousTrack,
    onNotify
  });

  useEffect(() => {
    callbacksRef.current = {
      onVolumeStep,
      onMuteToggle,
      onPlayPauseToggle,
      onNextTrack,
      onPreviousTrack,
      onNotify
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.getGamepads) {
      return;
    }

    const prevButtonStates = new Map<number, boolean>();
    const lastVolumeRepeatTime = { up: 0, down: 0 };
    let animationFrameId: number | null = null;

    const handleGamepadConnected = (e: GamepadEvent) => {
      const name = e.gamepad.id ? e.gamepad.id.replace(/\s*\(Vendor:.*$/, '') : 'Control';
      console.log(`[Gamepad] 🎮 Conectado: ${name} (Índice: ${e.gamepad.index})`);
      callbacksRef.current.onNotify?.(`🎮 Control conectado: ${name}`);
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log(`[Gamepad] 🎮 Desconectado (Índice: ${e.gamepad.index})`);
      callbacksRef.current.onNotify?.('🎮 Control desconectado');
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const now = performance.now();

      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        const isPressed = (index: number) => {
          const btn = gp.buttons[index];
          return typeof btn === 'object' ? btn.pressed : btn === 1.0;
        };

        const btnKey = (btnIndex: number) => gp.index * 100 + btnIndex;

        const checkTriggerOnce = (btnIndex: number, action: () => void) => {
          const key = btnKey(btnIndex);
          const currentlyPressed = isPressed(btnIndex);
          const wasPressed = prevButtonStates.get(key) || false;

          if (currentlyPressed && !wasPressed) {
            action();
          }
          prevButtonStates.set(key, currentlyPressed);
        };

        // 1. Subir volumen App (D-Pad Arriba: botón 12, o RB/R1: botón 5)
        const isVolUpPressed = isPressed(12) || isPressed(5);
        const wasVolUpPressed = (prevButtonStates.get(btnKey(12)) || prevButtonStates.get(btnKey(5))) || false;
        if (isVolUpPressed) {
          if (!wasVolUpPressed || now - lastVolumeRepeatTime.up > 180) {
            callbacksRef.current.onVolumeStep(1, 'control');
            lastVolumeRepeatTime.up = now;
          }
        }
        prevButtonStates.set(btnKey(12), isPressed(12));
        prevButtonStates.set(btnKey(5), isPressed(5));

        // 2. Bajar volumen App (D-Pad Abajo: botón 13, o LB/L1: botón 4)
        const isVolDownPressed = isPressed(13) || isPressed(4);
        const wasVolDownPressed = (prevButtonStates.get(btnKey(13)) || prevButtonStates.get(btnKey(4))) || false;
        if (isVolDownPressed) {
          if (!wasVolDownPressed || now - lastVolumeRepeatTime.down > 180) {
            callbacksRef.current.onVolumeStep(-1, 'control');
            lastVolumeRepeatTime.down = now;
          }
        }
        prevButtonStates.set(btnKey(13), isPressed(13));
        prevButtonStates.set(btnKey(4), isPressed(4));

        // 3. Silenciar / Activar sonido (L3: botón 10, o Select/Back: botón 8)
        checkTriggerOnce(10, () => callbacksRef.current.onMuteToggle('control'));
        checkTriggerOnce(8, () => callbacksRef.current.onMuteToggle('control'));

        // 4. Play / Pausa (Botón A / Cruz: botón 0, o Start: botón 9)
        checkTriggerOnce(0, () => callbacksRef.current.onPlayPauseToggle());
        checkTriggerOnce(9, () => callbacksRef.current.onPlayPauseToggle());

        // 5. Siguiente canción (D-Pad Derecha: botón 15)
        checkTriggerOnce(15, () => callbacksRef.current.onNextTrack());

        // 6. Canción anterior (D-Pad Izquierda: botón 14)
        checkTriggerOnce(14, () => callbacksRef.current.onPreviousTrack());
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);
}

export default function App() {
  // 1. Core Player State
  const [playerState, setPlayerState] = useState<PlayerState>(() => {
    let savedNonStop = true;
    let savedQuality: any = 'auto';
    let savedSpeed = 1.0;
    try {
      const stored = localStorage.getItem('serchtube_nonstop');
      if (stored !== null) savedNonStop = stored === 'true';
      const q = localStorage.getItem('serchtube_video_quality');
      if (q) savedQuality = q;
      const spd = localStorage.getItem('serchtube_video_speed');
      if (spd) savedSpeed = parseFloat(spd) || 1.0;
    } catch (e) {}

    return {
      isPlaying: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      volume: 10,
      isMuted: false,
      playbackQuality: savedQuality,
      availableQualities: [],
      playbackSpeed: savedSpeed,
      repeatMode: 'none',
      isDucked: false,
      nonStop: savedNonStop
    };
  });

  // Current playlist queue & index from YouTube / catalog
  const [playlistQueue, setPlaylistQueue] = useState<Track[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState<number>(0);

  const playlistQueueRef = useRef<Track[]>(playlistQueue);
  playlistQueueRef.current = playlistQueue;
  const playlistIndexRef = useRef<number>(playlistIndex);
  playlistIndexRef.current = playlistIndex;

  // Helper para normalizar el título y evitar canciones repetidas en la cola
  const normalizeSongKeyForDedup = (title: string): string => {
    if (!title) return "";
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, " ")
      .replace(/lyrics?\s+on\s+screen|with\s+lyrics?|con\s+letras?|lyrics?|letras?/gi, " ")
      .replace(/official\s+(music\s+)?video|official\s+audio|video\s+oficial|audio\s+oficial/gi, " ")
      .replace(/explicit(\s+version)?|clean(\s+version)?|remaster(ed)?/gi, " ")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  // Build upcoming 20 songs queue helper (index 0 is current song playing, with real thumbnail and title)
  const getUpcomingQueue = useCallback((): Track[] => {
    const list: Track[] = [];
    const seen = new Set<string>();
    const seenKeys = new Set<string>();
    const current = playerStateRef.current.currentTrack || playlistQueueRef.current[playlistIndexRef.current];
    if (current && current.id) {
      seen.add(current.id);
      const key = normalizeSongKeyForDedup(current.title);
      if (key) seenKeys.add(key);
      list.push({
        ...current,
        thumbnail: current.thumbnail && !current.thumbnail.includes('unsplash')
          ? current.thumbnail
          : `https://i.ytimg.com/vi/${current.id}/hqdefault.jpg`
      });
    }

    const q = playlistQueueRef.current;
    const pIdx = playlistIndexRef.current;
    if (Array.isArray(q) && q.length > 0) {
      const start = pIdx >= 0 ? pIdx + 1 : 1;
      for (let i = start; i < q.length; i++) {
        if (list.length >= 20) break;
        const t = q[i];
        if (!t || !t.id || seen.has(t.id)) continue;
        const key = normalizeSongKeyForDedup(t.title);
        if (key && seenKeys.has(key)) continue;

        seen.add(t.id);
        if (key) seenKeys.add(key);
        list.push({
          ...t,
          thumbnail: t.thumbnail && !t.thumbnail.includes('unsplash')
            ? t.thumbnail
            : `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`
        });
      }

      if (list.length < 20) {
        for (let i = 0; i < Math.min(start - 1, q.length); i++) {
          if (list.length >= 20) break;
          const t = q[i];
          if (!t || !t.id || seen.has(t.id)) continue;
          const key = normalizeSongKeyForDedup(t.title);
          if (key && seenKeys.has(key)) continue;

          seen.add(t.id);
          if (key) seenKeys.add(key);
          list.push({
            ...t,
            thumbnail: t.thumbnail && !t.thumbnail.includes('unsplash')
              ? t.thumbnail
              : `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`
          });
        }
      }
    }

    return list;
  }, []);

  const getUpcomingQueueRef = useRef(getUpcomingQueue);
  getUpcomingQueueRef.current = getUpcomingQueue;

  // Keep track of last known track and exact playback second for resume
  const lastKnownTrackRef = useRef<Track | null>(playerState.currentTrack);
  const lastKnownTimeRef = useRef<number>(0);

  // 2. System Status & Reactive Orb
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('idle');
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('Asistente SerchTube listo');
  const [isListening, setIsListening] = useState<boolean>(false);
  // 🎙️ Fuente de activación del micro: 'host' (micro de la PC, orbe rojo) o 'node' (nodo satélite, orbe morado)
  const [micActivationSource, setMicActivationSource] = useState<'host' | 'node' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [isDirectMicActive, setIsDirectMicActive] = useState<boolean>(false);
  const isDirectMicActiveRef = useRef<boolean>(false);
  isDirectMicActiveRef.current = isDirectMicActive;

  // Auto-clear received voice/command text (lastTranscript) after exactly 5 seconds
  const transcriptTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!lastTranscript) return;
    if (transcriptTimerRef.current) {
      clearTimeout(transcriptTimerRef.current);
    }
    transcriptTimerRef.current = setTimeout(() => {
      setLastTranscript('');
    }, 5000);

    return () => {
      if (transcriptTimerRef.current) {
        clearTimeout(transcriptTimerRef.current);
      }
    };
  }, [lastTranscript]);

  // Auto-clear assistant feedback message after 5 seconds
  const assistantResponseTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!assistantResponse) return;
    // Keep the wake word prompt active if currently listening for command (it handles its own timeout)
    if (assistantResponse.includes('Escuchando tu orden')) return;

    if (assistantResponseTimerRef.current) {
      clearTimeout(assistantResponseTimerRef.current);
    }
    assistantResponseTimerRef.current = setTimeout(() => {
      setAssistantResponse('');
    }, 5000);

    return () => {
      if (assistantResponseTimerRef.current) {
        clearTimeout(assistantResponseTimerRef.current);
      }
    };
  }, [assistantResponse]);

  // Synchronize isFullscreen state with actual browser document.fullscreenElement
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const next = !prev;
      if (next) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // 3. Modals
  const [isEqualizerOpen, setIsEqualizerOpen] = useState<boolean>(false);
  const [isNodeSyncOpen, setIsNodeSyncOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAutoShutdownModalOpen, setIsAutoShutdownModalOpen] = useState<boolean>(false);
  const [isGoogleHomeOpen, setIsGoogleHomeOpen] = useState<boolean>(false);
  const [isQrCountdownModalOpen, setIsQrCountdownModalOpen] = useState<boolean>(false);
  const [qrCountdownDuration, setQrCountdownDuration] = useState<number>(10);

  // 4. Remote Node Synchronization State
  const [nodeRole, setNodeRole] = useState<NodeRole>('master');
  const nodeRoleRef = useRef<NodeRole>(nodeRole);
  nodeRoleRef.current = nodeRole;
  const [connectedNodesCount, setConnectedNodesCount] = useState<number>(1);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const disconnectProbeTimerRef = useRef<any>(null);
  const handleNextTrackRef = useRef<() => void>(() => {});
  const handlePreviousTrackRef = useRef<() => void>(() => {});

  // 5. Hardware Equalizer Settings & Auto Volume Reducer
  const [eqSettings, setEqSettings] = useState<EqualizerSettings>(() => {
    const defaultEq: EqualizerSettings = {
      enabled: true,
      bass: 0,
      mid: 0,
      presence: 0,
      treble: 0,
      bassBoost: true,
      bassBoostLevel: 70,
      loudnessEnhancer: true,
      bluetoothKeepAlive: true,
      keepAliveIntervalSeconds: 20,
      preset: 'Hi-Fi'
    };
    try {
      const saved = localStorage.getItem('serchtube_eq_settings');
      if (saved) {
        return { ...defaultEq, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultEq;
  });

  const [autoVolumeConfig, setAutoVolumeConfig] = useState<AutoVolumeReducerConfig>(() => {
    const defaultConfig: AutoVolumeReducerConfig = {
      enabled: false,
      targetVolume: 5,
      delaySeconds: 15,
      onlyIfAboveTarget: true,
      smoothFade: true,
      applyOnEveryTrack: true
    };
    try {
      const saved = localStorage.getItem('serchtube_autovolume_config');
      if (saved) {
        return { ...defaultConfig, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultConfig;
  });

  // 6. Speech & TTS Config with Wake Word Activation
  const [speechConfig, setSpeechConfig] = useState<SpeechConfig>(() => {
    const defaultConfig: SpeechConfig = {
      personality: 'animada',
      speechRate: 1.0,
      speechPitch: 1.0,
      speechVolume: 1.0,
      duckingEnabled: true,
      continuousListening: false,
      useEdgeReadAloudVoice: true,
      ttsEngine: 'neural',
      neuralVoice: 'es-MX-JorgeNeural',
      voicePriority: ['elevenlabs', 'gemini', 'edge'],
      wakeWordEnabled: false,
      wakeWord: 'música',
      satelliteMicOnly: false
    };
    try {
      const saved = localStorage.getItem('serchtube_speech_config');
      if (saved) {
        return { ...defaultConfig, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultConfig;
  });

  const [isAwaitingCommandAfterWakeWord, setIsAwaitingCommandAfterWakeWord] = useState<boolean>(false);
  const activeListeningTimerRef = useRef<any>(null);
  const speechConfigRef = useRef<SpeechConfig>(speechConfig);
  speechConfigRef.current = speechConfig;
  const isAwaitingCommandRef = useRef<boolean>(isAwaitingCommandAfterWakeWord);
  isAwaitingCommandRef.current = isAwaitingCommandAfterWakeWord;
  // Inmunidad acústica de micrófono: evita que la música que empieza a sonar por los altavoces dispare comandos falsos
  const playbackCooldownUntilRef = useRef<number>(0);
  // Saludo de bienvenida diferido: se cancela si el comando llega justo detrás de la palabra clave
  const pendingGreetingTimerRef = useRef<any>(null);

  // Sincronizar el "micrófono caliente" con el servicio de voz: mientras se espera un
  // comando tras la palabra clave, la escucha no se bloquea por el saludo del TTS
  useEffect(() => {
    SpeechService.getInstance().setAwaitingCommand(isAwaitingCommandAfterWakeWord);
  }, [isAwaitingCommandAfterWakeWord]);

  // 🛡️ Ventana de 3 Segundos / Arbitraje Global:
  // Si se reciben más de una solicitud en menos de 3 segundos, solo se acepta la primera
  // que llegue (ya sea de nodos remotos o micrófono local) para evitar solicitudes múltiples o repetidas.
  const turnLockUntilRef = useRef<number>(0);
  const isTurnBusyRef = useRef<boolean>(false);
  const activeTurnOriginRef = useRef<string | null>(null);

  const tryAcquireTurn = useCallback((source: string, description?: string): boolean => {
    const now = Date.now();
    if (isTurnBusyRef.current || now < turnLockUntilRef.current) {
      const remainingMs = Math.max(0, turnLockUntilRef.current - now);
      console.log(
        `[SerchTube Master] 🛡️ Ventana de 3s activa: Solicitud descartada de "${source}" (${description || ''}). Ya se aceptó la primera solicitud del turno hace menos de 3s (origen: "${activeTurnOriginRef.current || 'previo'}", tiempo restante: ${remainingMs}ms).`
      );
      return false;
    }

    isTurnBusyRef.current = true;
    activeTurnOriginRef.current = source;
    turnLockUntilRef.current = now + 3000;

    setTimeout(() => {
      isTurnBusyRef.current = false;
    }, 3000);

    return true;
  }, []);

  // 🛡️ Seguridad Post-Reproducción de Micrófono Local:
  // Al poner o cambiar de canción, cerrar inmediatamente la escucha activa y volver a modo reposo
  // (hasta que la palabra clave "música" se vuelva a escuchar explícitamente), protegiendo contra audio de altavoces
  const enforcePostPlaybackMicSafety = useCallback(() => {
    setIsAwaitingCommandAfterWakeWord(false);
    isAwaitingCommandRef.current = false;
    setIsDirectMicActive(false);
    isDirectMicActiveRef.current = false;
    setSystemStatus('idle');
    setIsListening(false);
    if (activeListeningTimerRef.current) {
      clearTimeout(activeListeningTimerRef.current);
      activeListeningTimerRef.current = null;
    }
    AudioEngine.getInstance().stopDucking();
    SpeechService.getInstance().setCommandCooldown(3000);
    playbackCooldownUntilRef.current = Date.now() + 3000;
    turnLockUntilRef.current = Date.now() + 3000;
    isTurnBusyRef.current = false;
    SpeechService.getInstance().resetSession();
  }, []);

  // 5b. Auto Shutdown PC / System Timer State
  const [autoShutdownConfig, setAutoShutdownConfig] = useState<AutoShutdownConfig>(() => {
    try {
      const saved = localStorage.getItem('serchtube_auto_shutdown_config');
      if (saved) {
        return { ...DEFAULT_AUTO_SHUTDOWN_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return DEFAULT_AUTO_SHUTDOWN_CONFIG;
  });

  const [shutdownWarningState, setShutdownWarningState] = useState<{
    isOpen: boolean;
    remainingSeconds: number;
    totalWarningSeconds: number;
    isTesting: boolean;
  }>({
    isOpen: false,
    remainingSeconds: 0,
    totalWarningSeconds: 120,
    isTesting: false
  });

  const warningChimePlayedRef = useRef<boolean>(false);
  const warningVoiceSpokenRef = useRef<boolean>(false);
  const shutdownFadingActiveRef = useRef<boolean>(false);
  const originalVolumeBeforeFadeRef = useRef<number>(10);

  const handleUpdateAutoShutdown = useCallback((updated: Partial<AutoShutdownConfig>) => {
    setAutoShutdownConfig(prev => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_auto_shutdown_config', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const handlePostponeShutdown = useCallback((minutes: number) => {
    // Postpone target time by given minutes
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    const newTarget = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    handleUpdateAutoShutdown({ targetTime: newTarget, enabled: true });
    setShutdownWarningState({
      isOpen: false,
      remainingSeconds: 0,
      totalWarningSeconds: 120,
      isTesting: false
    });
    warningChimePlayedRef.current = false;
    warningVoiceSpokenRef.current = false;
    shutdownFadingActiveRef.current = false;

    setSatelliteCommandNotification({
      nodeName: 'Sistema',
      text: `Apagado pospuesto ${minutes} min (Nueva hora: ${newTarget})`,
      timestamp: Date.now()
    });
  }, [handleUpdateAutoShutdown]);

  const handleCancelShutdown = useCallback(() => {
    handleUpdateAutoShutdown({ enabled: false });
    cancelSystemShutdown();
    setShutdownWarningState({
      isOpen: false,
      remainingSeconds: 0,
      totalWarningSeconds: 120,
      isTesting: false
    });
    warningChimePlayedRef.current = false;
    warningVoiceSpokenRef.current = false;
    shutdownFadingActiveRef.current = false;

    setSatelliteCommandNotification({
      nodeName: 'Sistema',
      text: 'Auto-Apagado de PC Cancelado',
      timestamp: Date.now()
    });
  }, [handleUpdateAutoShutdown]);

  const handleExecuteShutdownNow = useCallback(async () => {
    setShutdownWarningState({
      isOpen: false,
      remainingSeconds: 0,
      totalWarningSeconds: 0,
      isTesting: false
    });

    // 1. Mute and stop music
    setPlayerState(prev => ({ ...prev, isPlaying: false, isMuted: true }));

    // 2. Perform action
    if (autoShutdownConfig.mode === 'stop_music_sleep') {
      setIsScreensaverActive(true);
      return;
    }

    setSatelliteCommandNotification({
      nodeName: 'Sistema',
      text: 'Iniciando apagado del sistema...',
      timestamp: Date.now()
    });

    await executeSystemShutdown(autoShutdownConfig.mode, 0);
  }, [autoShutdownConfig.mode]);

  const handleTriggerTestWarning = useCallback(() => {
    playWarningChime();
    setShutdownWarningState({
      isOpen: true,
      remainingSeconds: 15,
      totalWarningSeconds: 15,
      isTesting: true
    });
  }, []);

  // Main Auto-Shutdown Scheduling Loop (Checks every second)
  useEffect(() => {
    const timer = setInterval(() => {
      // If testing countdown is active, tick it down
      if (shutdownWarningState.isTesting && shutdownWarningState.remainingSeconds > 0) {
        setShutdownWarningState(prev => {
          if (prev.remainingSeconds <= 1) {
            return { ...prev, isOpen: false, remainingSeconds: 0, isTesting: false };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
        return;
      }

      if (!autoShutdownConfig.enabled) {
        if (shutdownWarningState.isOpen && !shutdownWarningState.isTesting) {
          setShutdownWarningState({ isOpen: false, remainingSeconds: 0, totalWarningSeconds: 120, isTesting: false });
        }
        return;
      }

      const calc = getMsUntilTargetTime(autoShutdownConfig.targetTime, autoShutdownConfig.daysOfWeek);
      const remainingSecs = calc.seconds;
      const warningSecs = Math.max(30, (autoShutdownConfig.warningMinutesBefore || 2) * 60);

      // Warning window triggered
      if (remainingSecs <= warningSecs && remainingSecs > 0) {
        if (!warningChimePlayedRef.current) {
          warningChimePlayedRef.current = true;
          if (autoShutdownConfig.playChimeOnWarning !== false) {
            playWarningChime();
          }
        }

        if (!warningVoiceSpokenRef.current && autoShutdownConfig.speakWarning !== false) {
          warningVoiceSpokenRef.current = true;
          const mins = Math.ceil(remainingSecs / 60);
          SpeechService.getInstance().speak(
            `Aviso: El ordenador se apagará automáticamente en ${mins === 1 ? '1 minuto' : `${mins} minutos`} según lo programado.`
          );
        }

        // Soft volume fade in last 60 seconds if configured
        if (autoShutdownConfig.fadeVolumeBeforeShutdown !== false && remainingSecs <= 60 && !shutdownFadingActiveRef.current) {
          shutdownFadingActiveRef.current = true;
          originalVolumeBeforeFadeRef.current = playerStateRef.current.volume;
          const fadeSteps = [
            { delay: 0, vol: Math.max(2, Math.floor(playerStateRef.current.volume * 0.7)) },
            { delay: 20000, vol: Math.max(1, Math.floor(playerStateRef.current.volume * 0.4)) },
            { delay: 40000, vol: 1 }
          ];
          fadeSteps.forEach(s => {
            setTimeout(() => {
              if (shutdownFadingActiveRef.current) {
                setPlayerState(prev => ({ ...prev, volume: s.vol }));
              }
            }, s.delay);
          });
        }

        setShutdownWarningState({
          isOpen: true,
          remainingSeconds: remainingSecs,
          totalWarningSeconds: warningSecs,
          isTesting: false
        });
      } else if (remainingSecs === 0 && warningChimePlayedRef.current) {
        // Shutdown instant trigger!
        warningChimePlayedRef.current = false;
        warningVoiceSpokenRef.current = false;
        shutdownFadingActiveRef.current = false;
        setShutdownWarningState({ isOpen: false, remainingSeconds: 0, totalWarningSeconds: 120, isTesting: false });

        // Execute action
        handleExecuteShutdownNow();
      } else {
        // Far away from shutdown time, reset flags
        if (remainingSecs > warningSecs + 10) {
          warningChimePlayedRef.current = false;
          warningVoiceSpokenRef.current = false;
          shutdownFadingActiveRef.current = false;
          if (shutdownWarningState.isOpen && !shutdownWarningState.isTesting) {
            setShutdownWarningState({ isOpen: false, remainingSeconds: 0, totalWarningSeconds: 120, isTesting: false });
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    autoShutdownConfig,
    shutdownWarningState.isTesting,
    shutdownWarningState.remainingSeconds,
    shutdownWarningState.isOpen,
    handleExecuteShutdownNow
  ]);

  const handleUpdateEqSettings = useCallback((updated: Partial<EqualizerSettings>) => {
    setEqSettings(prev => {
      const next = { ...prev, ...updated };
      AudioEngine.getInstance().applySettings(next);
      try {
        localStorage.setItem('serchtube_eq_settings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const handleUpdateAutoVolume = useCallback((updated: Partial<AutoVolumeReducerConfig>) => {
    setAutoVolumeConfig(prev => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_autovolume_config', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // 7. Screensaver & Sleep Mode Configuration with Time of Day Profiles
  const [screensaverConfig, setScreensaverConfig] = useState<ScreensaverConfig>(() => {
    const defaultConfig: ScreensaverConfig = {
      enabled: true,
      inactivityTimeoutSeconds: 30, // Default 30s rule after music stops
      returnToWebFirst: true,
      darknessLevel: 0.65, // Deslizador de nivel de oscuridad (0.0 a 1.0)
      showClock: true,
      clockFont: 'mono',
      clockFormat: '24h',
      showSeconds: true,
      showDate: true,
      timeOfDayMode: true,
      selectedTimeOfDaySlot: 'auto',
      timeOfDayVideos: {
        morning: {
          videoUrl: 'wA0C0u6624Q',
          name: 'Mañana - Amanecer Lofi'
        },
        afternoon: {
          videoUrl: 'MV_3Dpw-BRY',
          name: 'Tarde - Carretera Retrowave'
        },
        night: {
          videoUrl: 'f02mOEt11OQ',
          name: 'Noche - Luces de Neón Tokio'
        },
        late_night: {
          videoUrl: 'WPni755-Krg',
          name: 'Madrugada - Cosmos 432Hz'
        }
      },
      activeItemId: 'sc-lofi',
      items: [
        {
          id: 'sc-lofi',
          name: 'Lofi Lluvia & Carretera',
          videoUrl: 'jfKfPfyJRdk',
          enabled: true,
          startHour: 6,
          endHour: 12,
          isMuted: true
        },
        {
          id: 'sc-synthwave',
          name: 'Night Drive Retrowave',
          videoUrl: 'MV_3Dpw-BRY',
          enabled: true,
          startHour: 12,
          endHour: 19,
          isMuted: true
        },
        {
          id: 'sc-city',
          name: 'Luces de Neón Ciudad',
          videoUrl: 'f02mOEt11OQ',
          enabled: true,
          startHour: 19,
          endHour: 24,
          isMuted: true
        },
        {
          id: 'sc-zen',
          name: 'Paisaje Cósmico 432Hz',
          videoUrl: 'WPni755-Krg',
          enabled: true,
          startHour: 0,
          endHour: 6,
          isMuted: true
        }
      ]
    };

    try {
      const saved = localStorage.getItem('serchtube_screensaver_config');
      if (saved) {
        return { ...defaultConfig, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultConfig;
  });

  const handleUpdateScreensaverConfig = (updated: Partial<ScreensaverConfig>) => {
    setScreensaverConfig(prev => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_screensaver_config', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleToggleNonStop = () => {
    setPlayerState(prev => {
      const nextNonStop = !(prev.nonStop !== false);
      try {
        localStorage.setItem('serchtube_nonstop', String(nextNonStop));
      } catch (e) {}
      return { ...prev, nonStop: nextNonStop };
    });
  };

  // 8. Visual display configuration (Transparencies & Fade gradients)
  const defaultVisualConfig: DisplayVisualConfig = {
    videoOpacity: 0.45,
    wavesOpacity: 0.85,
    orbOpacity: 1.0,
    showWavesAndMic: true,
    waveStyle: 'sine_harmonic',
    waveScale: 1.0,
    waveHeight: 320,
    waveFullscreen: false,
    topFadeOpacity: 0.80,
    bottomFadeOpacity: 0.85,
    headerBgOpacity: 0.40,
    footerBgOpacity: 0.60,
    autoExpandOnPlay: true,
    autoFullscreenOnStartup: true
  };

  const [visualConfig, setVisualConfig] = useState<DisplayVisualConfig>(() => {
    try {
      const saved = localStorage.getItem('serchtube_visual_config');
      if (saved) {
        return { ...defaultVisualConfig, ...JSON.parse(saved) };
      }
      const savedOpacity = localStorage.getItem('serchtube_video_opacity');
      if (savedOpacity) {
        return { ...defaultVisualConfig, videoOpacity: parseFloat(savedOpacity) };
      }
    } catch (e) {}
    return defaultVisualConfig;
  });

  // Auto Fullscreen for Host (Master) on launch / startup (F11)
  useEffect(() => {
    if (nodeRole !== 'master') return;
    if (visualConfig.autoFullscreenOnStartup === false) return;

    let hasExecuted = false;

    const requestFullscreenSafely = () => {
      if (document.fullscreenElement) return;
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
          })
          .catch(() => {
            // Autoplay / user gesture policy might delay execution until first user click/touch
          });
      }
    };

    // 1. Attempt on immediate load
    requestFullscreenSafely();

    // 2. Also register one-time gesture trigger so the very first interaction (click / touch / key)
    // enters fullscreen if the browser blocked the initial unprompted attempt
    const onFirstUserGesture = () => {
      if (hasExecuted) return;
      hasExecuted = true;
      if (!document.fullscreenElement && visualConfig.autoFullscreenOnStartup !== false) {
        requestFullscreenSafely();
      }
      if (speechConfigRef.current.continuousListening) {
        SpeechService.getInstance().startListening();
      }
      window.removeEventListener('pointerdown', onFirstUserGesture, true);
      window.removeEventListener('touchstart', onFirstUserGesture, true);
      window.removeEventListener('keydown', onFirstUserGesture, true);
    };

    window.addEventListener('pointerdown', onFirstUserGesture, true);
    window.addEventListener('touchstart', onFirstUserGesture, true);
    window.addEventListener('keydown', onFirstUserGesture, true);

    return () => {
      window.removeEventListener('pointerdown', onFirstUserGesture, true);
      window.removeEventListener('touchstart', onFirstUserGesture, true);
      window.removeEventListener('keydown', onFirstUserGesture, true);
    };
  }, [nodeRole, visualConfig.autoFullscreenOnStartup]);

  const handleUpdateVisualConfig = (updated: Partial<DisplayVisualConfig>) => {
    setVisualConfig(prev => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('serchtube_visual_config', JSON.stringify(next));
        if (next.videoOpacity !== undefined) {
          localStorage.setItem('serchtube_video_opacity', String(next.videoOpacity));
        }
      } catch (e) {}
      return next;
    });
  };

  const videoOpacity = visualConfig.videoOpacity;
  const handleVideoOpacityChange = (val: number) => {
    handleUpdateVisualConfig({ videoOpacity: val });
  };

  const [isScreensaverActive, setIsScreensaverActive] = useState<boolean>(false);
  const [satelliteCommandNotification, setSatelliteCommandNotification] = useState<{ nodeName: string; text?: string; timestamp: number } | null>(null);

  // Auto-hide mouse cursor and clear sticky hover highlights on idle (initial launch + 2.5s inactivity)
  useEffect(() => {
    let idleTimer: any = null;
    const IDLE_DELAY = 2500; // 2.5 seconds of inactivity to disappear cursor

    const setCursorIdle = () => {
      document.body.classList.add('cursor-idle-hidden');
      window.dispatchEvent(new CustomEvent('serchtube:cursor-idle', { detail: { idle: true } }));
    };

    const setCursorActive = () => {
      document.body.classList.remove('cursor-idle-hidden');
      window.dispatchEvent(new CustomEvent('serchtube:cursor-idle', { detail: { idle: false } }));
      
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(setCursorIdle, IDLE_DELAY);
    };

    // Immediately start in idle state upon application launch so initial stationary cursor doesn't highlight center widgets
    setCursorIdle();

    const activityEvents = ['mousemove', 'mousedown', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'keydown'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, setCursorActive, { passive: true });
    });

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, setCursorActive);
      });
      document.body.classList.remove('cursor-idle-hidden');
    };
  }, []);

  // Auto-clear satellite command notification after 5 seconds
  useEffect(() => {
    if (!satelliteCommandNotification) return;
    const timer = setTimeout(() => {
      setSatelliteCommandNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [satelliteCommandNotification]);

  const screensaverTimerRef = useRef<any>(null);
  const handleDirectEventRef = useRef<(evt: any) => void>(() => {});

  // Deduplicación multi-nodo para evitar procesar comandos repetidos si varios satélites o el master oyen lo mismo
  const recentExecutedCommandsRef = useRef<{ action: string; query: string; volumeVal?: number; timestamp: number; fromNode?: string }[]>([]);
  const lastHandledTranscriptRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });

  // Keyboard typing state for global foreground typing capture
  const [typedText, setTypedText] = useState<string>('');
  const [isSubmittingText, setIsSubmittingText] = useState<boolean>(false);

  // Ref tracking current player state for speech recognition and ducking callbacks
  const playerStateRef = useRef<PlayerState>(playerState);
  playerStateRef.current = playerState;

  // Initialize Services on Mount
  useEffect(() => {
    // Check URL parameters for fast role/room setup (e.g. ?room=xyz&role=satellite)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const roleParam = urlParams.get('role') as NodeRole;

    const nodeSync = NodeSyncService.getInstance();
    if (roleParam === 'satellite' || roleParam === 'master') {
      nodeSync.setRole(roleParam, undefined, roomParam || undefined);
      setNodeRole(roleParam);
    } else {
      setNodeRole(nodeSync.getConfig().role);
    }

    // Set NodeSync callbacks before connecting WebSocket
    nodeSync.setCallbacks({
      onStateUpdate: (remoteState) => {
        if (remoteState.playlistQueue && Array.isArray(remoteState.playlistQueue) && remoteState.playlistQueue.length > 0) {
          setPlaylistQueue(remoteState.playlistQueue);
          setPlaylistIndex(0);
        }
        setPlayerState(prev => ({ ...prev, ...remoteState }));
      },
      onPlaylistQueue: (queue) => {
        if (Array.isArray(queue) && queue.length > 0) {
          setPlaylistQueue(queue);
          setPlaylistIndex(0);
        }
      },
      onNodeJoined: () => {
        // A satellite just joined: immediately broadcast current state and 20 upcoming tracks!
        if (nodeRoleRef.current === 'master') {
          const list = getUpcomingQueueRef.current();
          NodeSyncService.getInstance().broadcastMasterState(playerStateRef.current, list);
        }
      },
      onDirectEvent: (evt) => {
        handleDirectEventRef.current(evt);
      },
      onCommandReceived: (commandPayload, fromNode) => {
        const nodeName = fromNode || 'Satélite';
        const action = (commandPayload.action || '').toLowerCase().trim();
        const rawText = (commandPayload.transcript || commandPayload.query || commandPayload.artist || '').trim();

        const isVolumeAction =
          action === 'volume_set' ||
          action === 'volume_up' ||
          action === 'volume_down' ||
          action === 'mute' ||
          action === 'unmute';

        const isDirectControlAction =
          isVolumeAction ||
          action === 'reload_player' ||
          action === 'refresh_player' ||
          action === 'open_youtube_auth';

        // 🛡️ Arbitraje de Turno Único: Solo para peticiones de voz o búsquedas entre micrófonos concurrentes
        if (!isDirectControlAction && !tryAcquireTurn(`nodo_${nodeName}`, rawText || action)) {
          console.log(`[SerchTube Master] 🛡️ Arbitraje de turno: Petición concurrente de "${nodeName}" descartada. Turno ocupado.`);
          return;
        }

        const normQuery = normalizeText(rawText);
        const now = Date.now();

        const isRecentDuplicate = recentExecutedCommandsRef.current.some(prev => {
          if (now - prev.timestamp > 4000) return false;
          if (action === 'reload_player' || action === 'refresh_player') {
            return prev.action === action && now - prev.timestamp < 1000;
          }
          if (isVolumeAction) {
            // Solo descartar volumen si es exactamente el mismo valor enviado en menos de 250ms
            if (action === 'volume_set' && prev.action === 'volume_set') {
              const currentVol = commandPayload.volumeValue ?? commandPayload.volume ?? commandPayload.value;
              return prev.volumeVal === currentVol && now - prev.timestamp < 250;
            }
            return false;
          }
          if (action && prev.action === action) return true;
          if (normQuery && prev.query && normalizeText(prev.query) === normQuery) return true;
          return false;
        });

        if (isRecentDuplicate) {
          console.log(`[SerchTube Master] 🛡️ Notificación duplicada de satélite omitida de "${nodeName}"`);
          return;
        }

        const commandText =
          commandPayload.transcript ||
          commandPayload.query ||
          commandPayload.artist ||
          commandPayload.speechFeedback ||
          (commandPayload.action ? `Acción: ${commandPayload.action}` : 'Comando recibido');

        setSatelliteCommandNotification({
          nodeName,
          text: commandText,
          timestamp: Date.now()
        });

        setTimeout(() => {
          setSatelliteCommandNotification(prev =>
            prev && Date.now() - prev.timestamp >= 5500 ? null : prev
          );
        }, 6000);

        executeVoiceCommand(commandPayload, fromNode);
      },
      onConnectionChange: (connected, count) => {
        setIsWsConnected(connected);
        setConnectedNodesCount(count);

        if (!connected && nodeRoleRef.current === 'satellite') {
          // If disconnected for more than 5 seconds, attempt background probe / auto-discover
          if (disconnectProbeTimerRef.current) clearTimeout(disconnectProbeTimerRef.current);
          disconnectProbeTimerRef.current = setTimeout(async () => {
            const scanner = HostScannerService.getInstance();
            if (scanner.isScanActive()) return;

            // Probe current host first
            const activeHost = NodeSyncService.getInstance().getActiveHost();
            const hostIp = activeHost.split(':')[0];
            const port = parseInt(activeHost.split(':')[1], 10) || 3000;
            const currentAlive = await scanner.probeCandidate(hostIp, port, 1000);
            if (!currentAlive) {
              console.log('[Satellite Auto-Reconnect] 🔍 Host actual no responde. Iniciando auto-descubrimiento en red local...');
              scanner.autoDiscoverHost({
                port,
                onFound: (found) => {
                  console.log('[Satellite Auto-Reconnect] ⚡ ¡Nuevo Host encontrado en:', found.url);
                  NodeSyncService.getInstance().setCustomHost(`${found.ip}:${found.port}`);
                  setAssistantResponse(`¡Reconectado con el coche en ${found.ip}:${found.port}!`);
                }
              });
            }
          }, 5000);
        } else if (connected) {
          if (disconnectProbeTimerRef.current) {
            clearTimeout(disconnectProbeTimerRef.current);
            disconnectProbeTimerRef.current = null;
          }
        }
      },
      onSatelliteMicEvent: ({ isListening: satListening }) => {
        if (satListening) {
          setSystemStatus('satellite_active');
        } else {
          setSystemStatus('idle');
        }
      }
    });

    // Connect WebSocket now that callbacks are ready
    nodeSync.connect();
    setIsWsConnected(nodeSync.getConnected());

    // Check if a shared YouTube video was passed via URL parameter (e.g. from PWA Web Share Target)
    const sharedParam = urlParams.get('url') || urlParams.get('text') || urlParams.get('v') || urlParams.get('q');
    if (sharedParam) {
      const extractedId = extractYouTubeId(sharedParam);
      if (isValidYouTubeId(extractedId)) {
        setTimeout(() => {
          if (roleParam === 'satellite') {
            nodeSync.sendCommandToMaster({
              action: 'play',
              query: sharedParam
            });
            setAssistantResponse('Enviando vídeo compartido al coche...');
          } else {
            handleMusicSearch(sharedParam, false);
          }
        }, 800);
      }
    }

    // Audio Engine Ducking callback
    const audioEngine = AudioEngine.getInstance();
    audioEngine.setDuckingCallback((isDucked) => {
      setPlayerState(prev => ({ ...prev, isDucked }));
    });
    audioEngine.applySettings(eqSettings);

    // Speech Service setup
    const speechService = SpeechService.getInstance();
    speechService.updateConfig(speechConfig);

    speechService.setCallbacks(
      (transcript, isFinal) => {
        const currentConfig = speechConfigRef.current;
        const wakeEnabled = currentConfig.wakeWordEnabled !== false;
        const wakeWordStr = currentConfig.wakeWord || 'música';

        const isAwaiting = isAwaitingCommandRef.current;
        const isDirectActive = isDirectMicActiveRef.current;

        // 🛡️ Inmunidad Acústica: Descartar audios de altavoces solo cuando NO estamos en escucha activa de orden
        if (!isAwaiting && !isDirectActive) {
          if (SpeechService.getInstance().isInCooldown() || Date.now() < playbackCooldownUntilRef.current) {
            return;
          }
        }

        // Si la palabra clave está activa pero no estamos escuchando una petición activa (ni por voz previamente activada ni por botón directo)
        if (wakeEnabled && !isAwaiting && !isDirectActive) {
          const parsed = parseWakeWord(transcript, wakeWordStr);
          if (!parsed.hasWakeWord) {
            // Ignorar por completo cualquier ruido o palabra antes de que se diga la palabra clave
            return;
          }
          // Si contiene la palabra clave, salir de pantalla de bloqueo y activar de inmediato el orbe con animación de micrófono
          setIsScreensaverActive(false);
          setIsAwaitingCommandAfterWakeWord(true);
          isAwaitingCommandRef.current = true;
          setMicActivationSource('host');
          setSystemStatus('listening');
          setIsListening(true);
          setLastTranscript(parsed.isWakeWordOnly ? '' : parsed.commandText);
          // 🎚️ Atenuar la música YA (ruta interina): esta es la vía por la que pasa casi
          // siempre la detección con "micrófono caliente"; antes solo bajaba al llegar el final
          if (playerStateRef.current.isPlaying) {
            AudioEngine.getInstance().startDucking(150);
          }
        } else {
          // Si la palabra clave está desactivada o ya estamos en el flujo activo de escucha
          setLastTranscript(transcript);
        }

        // Check if user spoke an explicit cancellation phrase
        const norm = normalizeText(transcript);
        const isCancelPhrase =
          /^(cancelar|cancela|olvidalo|olvídalo|nada|no importa|cerrar|apagar|salir|stop)$/i.test(norm) ||
          /^(música|musica)\s+(cancelar|cancela|olvidalo|olvídalo|nada)$/i.test(norm);

        if ((isAwaitingCommandRef.current || isDirectMicActiveRef.current) && isCancelPhrase) {
          if (pendingGreetingTimerRef.current) { clearTimeout(pendingGreetingTimerRef.current); pendingGreetingTimerRef.current = null; }
          if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
          setIsAwaitingCommandAfterWakeWord(false);
          isAwaitingCommandRef.current = false;
          setIsDirectMicActive(false);
          isDirectMicActiveRef.current = false;
          setSystemStatus('idle');
          setIsListening(false);
          setAssistantResponse('❌ Petición cancelada');
          AudioEngine.getInstance().stopDucking();
          SpeechService.getInstance().resetSession();
          setTimeout(() => {
            setAssistantResponse(prev => (prev && prev.includes('cancelada') ? null : prev));
          }, 3000);
          return;
        }

        // Direct Push-To-Talk Handling (User tapped the microphone button)
        if (isDirectMicActiveRef.current) {
          if (!isFinal) {
            // Keep timer alive while user is actively talking
            if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
            activeListeningTimerRef.current = setTimeout(() => {
              setIsDirectMicActive(false);
              isDirectMicActiveRef.current = false;
              setSystemStatus('idle');
              setIsListening(false);
              setAssistantResponse('⏱️ Micrófono cerrado (sin palabras)');
              SpeechService.getInstance().resetSession();
              setTimeout(() => {
                setAssistantResponse(prev => (prev && prev.includes('cerrado') ? null : prev));
              }, 3000);
            }, 6000);
            return;
          }

          // Final sentence captured via direct push-to-talk button!
          if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
          setIsDirectMicActive(false);
          isDirectMicActiveRef.current = false;
          setIsAwaitingCommandAfterWakeWord(false);
          isAwaitingCommandRef.current = false;
          setSystemStatus('processing');
          // Un comando real llegó: cancelar cualquier saludo de bienvenida pendiente
          if (pendingGreetingTimerRef.current) { clearTimeout(pendingGreetingTimerRef.current); pendingGreetingTimerRef.current = null; }
          SpeechService.getInstance().setCommandCooldown(3000);
          playbackCooldownUntilRef.current = Date.now() + 3000;
          SpeechService.getInstance().resetSession();

          // 🛡️ Ventana de 3 Segundos / Arbitraje Global
          if (!tryAcquireTurn('boton_micro_local', transcript)) {
            return;
          }

          handleSpokenCommand(transcript);
          return;
        }

        if (!isFinal) {
          // While user is actively speaking interim words after wake word, refresh the 5-second inactivity timeout!
          if (wakeEnabled && isAwaitingCommandRef.current) {
            if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
            activeListeningTimerRef.current = setTimeout(() => {
              setIsAwaitingCommandAfterWakeWord(false);
              isAwaitingCommandRef.current = false;
              setSystemStatus('idle');
              setIsListening(false);
              setAssistantResponse('⏱️ Petición cancelada por inactividad (5s)');
              AudioEngine.getInstance().stopDucking();
              SpeechService.getInstance().resetSession();
              setTimeout(() => {
                setAssistantResponse(prev => (prev && prev.includes('inactividad') ? null : prev));
              }, 3000);
            }, 5000);
          }
          return;
        }

        // Processing FINAL transcript:
        if (wakeEnabled) {
          const parsed = parseWakeWord(transcript, wakeWordStr);

          if (parsed.hasWakeWord) {
            // Wake word detected in this phrase!
            if (parsed.isWakeWordOnly) {
              // User just said "Música" or "Música!" -> Exit screensaver and activate listening
              setIsScreensaverActive(false);
              setIsAwaitingCommandAfterWakeWord(true);
              isAwaitingCommandRef.current = true;
              setMicActivationSource('host');
              setSystemStatus('listening');
              setIsListening(true);
              setAssistantResponse(`⚡ ¡"${wakeWordStr}" detectada! Escuchando tu orden (5s)...`);

              // Atenuar música de inmediato para que el usuario pueda hablar suave sin gritar sobre la música
              if (playerStateRef.current.isPlaying) {
                AudioEngine.getInstance().startDucking(150);
              }

              const personality = currentConfig.personality || 'animada';
              const options = WAKE_GREETINGS[personality] || WAKE_GREETINGS.animada || WAKE_GREETINGS.directa;
              const greeting = options[Math.floor(Math.random() * options.length)];

              // Saludo DIFERIDO: si el comando llega enseguida ("música ... eminem" con pausa),
              // se cancela el saludo y se ejecuta directo, sin que el TTS tape el micrófono
              if (pendingGreetingTimerRef.current) clearTimeout(pendingGreetingTimerRef.current);
              pendingGreetingTimerRef.current = setTimeout(() => {
                pendingGreetingTimerRef.current = null;
                if (isAwaitingCommandRef.current) {
                  SpeechService.getInstance().speak(greeting);
                }
              }, 1400);

              // Establish strict 5-second frame to capture request or auto-cancel on inactivity
              if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
              activeListeningTimerRef.current = setTimeout(() => {
                setIsAwaitingCommandAfterWakeWord(false);
                isAwaitingCommandRef.current = false;
                setSystemStatus('idle');
                setIsListening(false);
                setAssistantResponse('⏱️ Petición cancelada por inactividad (5s)');
                AudioEngine.getInstance().stopDucking();
                SpeechService.getInstance().resetSession();
                setTimeout(() => {
                  setAssistantResponse(prev => (prev && prev.includes('inactividad') ? null : prev));
                }, 3000);
              }, 5000);
            } else {
              // User said "Música, reproduce Maná" or "Música siguiente" -> Immediate execution
              setIsScreensaverActive(false);
              if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
              setIsAwaitingCommandAfterWakeWord(false);
              isAwaitingCommandRef.current = false;
              setSystemStatus('processing');
              SpeechService.getInstance().setCommandCooldown(3000);
              playbackCooldownUntilRef.current = Date.now() + 3000;
              SpeechService.getInstance().resetSession(); // CLOSE PETITION & RESET AUDIO BUFFER IMMEDIATELY!

              // 🛡️ Ventana de 3 Segundos / Arbitraje Global
              if (!tryAcquireTurn('micro_local', parsed.commandText)) {
                return;
              }

              handleSpokenCommand(parsed.commandText);
            }
          } else if (isAwaitingCommandRef.current) {
            // User previously activated wake word, and now spoke the command in a follow-up sentence
            setIsScreensaverActive(false);
            if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
            setIsAwaitingCommandAfterWakeWord(false);
            isAwaitingCommandRef.current = false;
            setSystemStatus('processing');
            SpeechService.getInstance().setCommandCooldown(3000);
            playbackCooldownUntilRef.current = Date.now() + 3000;
            SpeechService.getInstance().resetSession(); // CLOSE PETITION & RESET AUDIO BUFFER IMMEDIATELY!

            // 🛡️ Ventana de 3 Segundos / Arbitraje Global
            if (!tryAcquireTurn('micro_local', transcript)) {
              return;
            }

            handleSpokenCommand(transcript);
          } else {
            // Silently ignore ambient conversation without spamming on-screen "Di Música para activar"
          }
        } else {
          // Wake word disabled -> Process all speech directly
          // Un comando real llegó: cancelar cualquier saludo de bienvenida pendiente
          if (pendingGreetingTimerRef.current) { clearTimeout(pendingGreetingTimerRef.current); pendingGreetingTimerRef.current = null; }
          SpeechService.getInstance().setCommandCooldown(3000);
          playbackCooldownUntilRef.current = Date.now() + 3000;
          SpeechService.getInstance().resetSession();

          // 🛡️ Ventana de 3 Segundos / Arbitraje Global
          if (!tryAcquireTurn('micro_local', transcript)) {
            return;
          }

          handleSpokenCommand(transcript);
        }
      },
      (status) => {
        if (status === 'listening') {
          const isAwaiting = isAwaitingCommandRef.current;
          const isDirect = isDirectMicActiveRef.current;
          const wakeEnabled = speechConfigRef.current.wakeWordEnabled !== false;
          if (!wakeEnabled || isAwaiting || isDirect) {
            setSystemStatus('listening');
            setIsListening(true);
          } else {
            setSystemStatus('idle');
            setIsListening(false);
          }
        } else {
          setSystemStatus(status);
          setIsListening(false);
        }
      }
    );

    if (speechConfig.continuousListening) {
      speechService.startListening();
    }

    // Register Chrome Media Session & Extension Handlers
    const chromeService = ChromeMediaService.getInstance();
    chromeService.registerHandlers({
      onPlay: () => {
        AudioEngine.getInstance().resume();
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
      },
      onPause: () => {
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      },
      onNext: () => handleNextTrack(),
      onPrev: () => handlePreviousTrack(),
      onSeek: (time: number) => {
        setPlayerState(prev => ({ ...prev, currentTime: time }));
      }
    });

    return () => {
      if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current);
    };
  }, []);

  // Synchronize Chrome Media Session & Background Extension State
  useEffect(() => {
    ChromeMediaService.getInstance().updateState(playerState, playerState.currentTrack);
  }, [
    playerState.isPlaying,
    playerState.currentTrack?.id,
    playerState.currentTime,
    playerState.duration,
    playerState.volume,
    playerState.isMuted,
    playerState.nonStop
  ]);

  // Update last known track and time whenever playing
  useEffect(() => {
    if (playerState.currentTrack) {
      lastKnownTrackRef.current = playerState.currentTrack;
    }
    if (playerState.currentTime > 0) {
      lastKnownTimeRef.current = playerState.currentTime;
    }

    // Broadcast state changes and upcoming 20 songs queue to satellite nodes if master
    if (nodeRole === 'master') {
      NodeSyncService.getInstance().broadcastMasterState(playerState, getUpcomingQueue());
    }
  }, [playerState.isPlaying, playerState.currentTrack?.id, playerState.volume, playerState.isMuted, playlistQueue, playlistIndex, getUpcomingQueue]);

  // Periodic position broadcast for Android satellite seekbar/progress synchronization
  useEffect(() => {
    if (nodeRole !== 'master' || !playerState.isPlaying) return;
    const interval = setInterval(() => {
      NodeSyncService.getInstance().broadcastMasterState(playerStateRef.current, getUpcomingQueueRef.current());
    }, 2000);
    return () => clearInterval(interval);
  }, [playerState.isPlaying, nodeRole]);

  // Handle Strict Screensaver Inactivity Timer
  // Rule: When music is paused or stopped, after inactivityTimeoutSeconds of no user activity,
  // the screensaver strictly activates. Dismissing it while music is still paused restarts the timer so it strictly returns.
  useEffect(() => {
    if (screensaverTimerRef.current) {
      clearTimeout(screensaverTimerRef.current);
      screensaverTimerRef.current = null;
    }

    // 1. If screensaver is disabled in settings OR on mobile satellite remote, ensure it's not active
    if (nodeRole === 'satellite' || !screensaverConfig.enabled) {
      setIsScreensaverActive(false);
      return;
    }

    // 2. If music is actively playing, dismiss screensaver and clear timer
    if (playerState.isPlaying) {
      setIsScreensaverActive(false);
      return;
    }

    // 3. If screensaver is already active, no countdown needed
    if (isScreensaverActive) {
      return;
    }

    // 4. Music is paused/stopped and screensaver is not active:
    // Strictly countdown and reset on user interaction
    const timeoutSeconds = Math.max(5, screensaverConfig.inactivityTimeoutSeconds || 30);
    const timeoutMs = timeoutSeconds * 1000;

    const startInactivityCountdown = () => {
      if (screensaverTimerRef.current) {
        clearTimeout(screensaverTimerRef.current);
      }
      screensaverTimerRef.current = setTimeout(() => {
        setIsScreensaverActive(true);
      }, timeoutMs);
    };

    const handleUserInteraction = () => {
      // Whenever user interacts while paused, reset the countdown timer
      startInactivityCountdown();
    };

    // Initial countdown start
    startInactivityCountdown();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    return () => {
      if (screensaverTimerRef.current) {
        clearTimeout(screensaverTimerRef.current);
        screensaverTimerRef.current = null;
      }
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [
    playerState.isPlaying,
    screensaverConfig.enabled,
    screensaverConfig.inactivityTimeoutSeconds,
    isScreensaverActive
  ]);

  // =========================================================================
  // ATENUACIÓN AUTOMÁTICA DE VOLUMEN POR INACTIVIDAD SIN MÚSICA
  // =========================================================================
  // Cuando la música no está reproduciéndose (pausada, detenida o finalizada),
  // tras el tiempo de inactividad establecido (delaySeconds), el volumen se reduce
  // suavemente al nivel de seguridad (targetVolume) para evitar que al iniciar
  // una nueva canción más tarde suene a un volumen ensordecedor o sorprendente.
  const autoVolumeInactivityTimerRef = useRef<any>(null);
  const autoVolumeFadeIntervalRef = useRef<any>(null);

  useEffect(() => {
    // 1. Limpiar timers previos
    if (autoVolumeInactivityTimerRef.current) {
      clearTimeout(autoVolumeInactivityTimerRef.current);
      autoVolumeInactivityTimerRef.current = null;
    }
    if (autoVolumeFadeIntervalRef.current) {
      clearInterval(autoVolumeFadeIntervalRef.current);
      autoVolumeFadeIntervalRef.current = null;
    }

    // 2. Si la función está desactivada o la música está sonando actualmente, no hacer nada
    if (!autoVolumeConfig.enabled || playerState.isPlaying) {
      return;
    }

    // 3. Si el volumen actual ya es menor o igual al objetivo de seguridad, no se requiere bajar
    const currentVol = playerState.volume;
    const targetVol = autoVolumeConfig.targetVolume ?? 5;
    if (currentVol <= targetVol) {
      return;
    }

    // 4. Iniciar cuenta atrás de inactividad sin música
    const delaySeconds = Math.max(5, autoVolumeConfig.delaySeconds || 60);
    const delayMs = delaySeconds * 1000;

    autoVolumeInactivityTimerRef.current = setTimeout(() => {
      // Re-verificar que no esté reproduciendo música
      if (playerStateRef.current.isPlaying) return;

      const startVol = playerStateRef.current.volume;
      if (startVol <= targetVol) return;

      console.log(`[AutoVolume Inactivity] 📉 Reduciendo volumen de ${startVol} a ${targetVol}/15 tras ${delaySeconds}s de inactividad sin música`);

      // Feedback visual discreto en pantalla
      setSatelliteCommandNotification({
        nodeName: 'Auto-Volumen',
        text: `🛡️ Volumen atenuado a ${targetVol}/15 por inactividad sin música`,
        timestamp: Date.now()
      });

      if (autoVolumeConfig.smoothFade !== false) {
        // Reducción suave progresiva
        const steps = 10;
        const stepMs = 120;
        const diff = startVol - targetVol;
        let step = 0;

        autoVolumeFadeIntervalRef.current = setInterval(() => {
          step++;
          const progress = step / steps;
          const nextVol = Math.max(targetVol, Math.round(startVol - diff * progress));
          setPlayerState(prev => ({ ...prev, volume: nextVol }));

          if (step >= steps || nextVol <= targetVol) {
            clearInterval(autoVolumeFadeIntervalRef.current);
            autoVolumeFadeIntervalRef.current = null;
            setPlayerState(prev => ({ ...prev, volume: targetVol }));
          }
        }, stepMs);
      } else {
        setPlayerState(prev => ({ ...prev, volume: targetVol }));
      }
    }, delayMs);

    return () => {
      if (autoVolumeInactivityTimerRef.current) {
        clearTimeout(autoVolumeInactivityTimerRef.current);
        autoVolumeInactivityTimerRef.current = null;
      }
      if (autoVolumeFadeIntervalRef.current) {
        clearInterval(autoVolumeFadeIntervalRef.current);
        autoVolumeFadeIntervalRef.current = null;
      }
    };
  }, [
    playerState.isPlaying,
    playerState.volume,
    autoVolumeConfig.enabled,
    autoVolumeConfig.delaySeconds,
    autoVolumeConfig.targetVolume,
    autoVolumeConfig.smoothFade
  ]);

  // Listener para pruebas manuales inmediatas desde el panel de ajustes
  useEffect(() => {
    const handleTestTrigger = () => {
      const targetVol = autoVolumeConfig.targetVolume ?? 5;
      const startVol = playerStateRef.current.volume;
      if (startVol <= targetVol) {
        setSatelliteCommandNotification({
          nodeName: 'Auto-Volumen',
          text: `ℹ️ El volumen actual (${startVol}/15) ya es menor o igual al objetivo (${targetVol}/15)`,
          timestamp: Date.now()
        });
        return;
      }

      setSatelliteCommandNotification({
        nodeName: 'Auto-Volumen (Prueba)',
        text: `🛡️ Probando atenuación: reduciendo de ${startVol} a ${targetVol}/15`,
        timestamp: Date.now()
      });

      const steps = 10;
      const stepMs = 100;
      const diff = startVol - targetVol;
      let step = 0;

      const fadeInterval = setInterval(() => {
        step++;
        const progress = step / steps;
        const nextVol = Math.max(targetVol, Math.round(startVol - diff * progress));
        setPlayerState(prev => ({ ...prev, volume: nextVol }));

        if (step >= steps || nextVol <= targetVol) {
          clearInterval(fadeInterval);
          setPlayerState(prev => ({ ...prev, volume: targetVol }));
        }
      }, stepMs);
    };

    const handleOpenGoogleHome = () => setIsGoogleHomeOpen(true);
    window.addEventListener('serchtube:open-google-home', handleOpenGoogleHome);
    window.addEventListener('serchtube:test-auto-volume', handleTestTrigger);
    return () => {
      window.removeEventListener('serchtube:open-google-home', handleOpenGoogleHome);
      window.removeEventListener('serchtube:test-auto-volume', handleTestTrigger);
    };
  }, [autoVolumeConfig.targetVolume]);

  // Execute Search for Artist or Track
  // Rule: "cuando el usuario ingresa solo el nombre de un artista sin especificar cancion se debe abrir la primera cancion de playlist que se encuentra de ese artista"
  const handleMusicSearch = async (query: string, isArtist: boolean = false) => {
    setSystemStatus('processing');
    try {
      const cleanedQuery = query.trim();

      // 1. Direct YouTube link or video ID detection (Fast-lane without text search)
      const directVideoId = extractYouTubeId(cleanedQuery);
      if (isValidYouTubeId(directVideoId) && (cleanedQuery.includes('youtu') || directVideoId === cleanedQuery)) {
        console.log('[SerchTube Master] 🎯 Reproducción directa de enlace de YouTube:', directVideoId);
        const directTrack: Track = {
          id: directVideoId,
          title: 'Vídeo de YouTube',
          artist: 'YouTube',
          thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          duration: 'Directo'
        };

        setPlaylistQueue([directTrack]);
        setPlaylistIndex(0);
        setPlayerState(prev => ({
          ...prev,
          currentTrack: directTrack,
          isPlaying: true,
          currentTime: 0
        }));

        enforcePostPlaybackMicSafety();
        setIsScreensaverActive(false);
        setSystemStatus('idle');

        if (visualConfig.autoExpandOnPlay !== false) {
          setIsFullscreen(true);
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }

        // Fetch related songs in background to populate upcoming queue
        fetch(`/api/youtube/related?videoId=${directVideoId}`)
          .then(r => r.ok ? r.json() : null)
          .then(relData => {
            if (relData && relData.items && Array.isArray(relData.items) && relData.items.length > 0) {
              setPlaylistQueue([directTrack, ...relData.items.filter((t: Track) => t.id !== directVideoId)]);
            }
          })
          .catch(() => {});

        return;
      }

      // Búsqueda directa ultrarrápida: el backend ya normaliza ortografía con Google y resuelve la lista
      const resp = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanedQuery)}&isArtist=${isArtist}`);
      const data = await resp.json();

      const rawItems: Track[] = (data.items && Array.isArray(data.items) && data.items.length > 0)
        ? data.items
        : (data.firstTrack ? [data.firstTrack] : []);

      if (rawItems.length > 0) {
        // Guarantee real YouTube thumbnail for every track in queue and prevent duplicates
        const seenIds = new Set<string>();
        const seenKeys = new Set<string>();
        const normalizedQueue: Track[] = [];

        for (const item of rawItems) {
          if (!item || !item.id || seenIds.has(item.id)) continue;
          const key = normalizeSongKeyForDedup(item.title);
          if (normalizedQueue.length > 0 && key && seenKeys.has(key)) continue;

          seenIds.add(item.id);
          if (key) seenKeys.add(key);
          normalizedQueue.push({
            ...item,
            thumbnail: item.thumbnail && !item.thumbnail.includes('unsplash')
              ? item.thumbnail
              : `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
          });
        }

        setPlaylistQueue(normalizedQueue);
        setPlaylistIndex(0);

        const selected = normalizedQueue[0];
        setPlayerState(prev => ({
          ...prev,
          currentTrack: selected,
          isPlaying: true,
          currentTime: 0
        }));

        // 🛡️ Seguridad post-reproducción: cerrar escucha activa, volver a modo espera de palabra clave y blindar micro contra altavoces
        enforcePostPlaybackMicSafety();

        // Stop screensaver if active
        setIsScreensaverActive(false);
        setSystemStatus('idle');

        // Expand player to full screen layout when song begins playing
        if (visualConfig.autoExpandOnPlay !== false) {
          setIsFullscreen(true);
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }
      } else {
        setSystemStatus('idle');
      }
    } catch (err) {
      console.warn("Music search error:", err);
      setSystemStatus('idle');
    }
  };

  // Process voice command transcript via Local NLP Parser
  const handleSpokenCommand = useCallback(async (transcript: string) => {
    const rawTranscript = (transcript || '').trim();
    if (!rawTranscript) return;

    // 🛡️ Deduplicación Rápida de Transcripción: Evitar llamadas concurrentes con el mismo texto
    const now = Date.now();
    const normText = normalizeText(rawTranscript);
    // Comparar ignorando la palabra de activación ("música pausa" ≡ "pausa")
    const normCmp = normText.replace(/^(oye\s+)?(musica|music|hey)\s+/, '');
    const lastNorm = normalizeText(lastHandledTranscriptRef.current.text).replace(/^(oye\s+)?(musica|music|hey)\s+/, '');
    if (normCmp && lastNorm && normCmp === lastNorm && now - lastHandledTranscriptRef.current.timestamp < 4000) {
      console.log(`[SerchTube] 🛡️ Transcripción duplicada ignorada (<4s): "${rawTranscript}"`);
      return;
    }
    lastHandledTranscriptRef.current = { text: rawTranscript, timestamp: now };

    const speech = SpeechService.getInstance();
    speech.setProcessingCommand(true);
    setSystemStatus('processing');

    try {
      const response = await fetch('/api/gemini/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: rawTranscript,
          personality: speechConfig.personality,
          currentTrack: playerStateRef.current.currentTrack,
          currentVolume: playerStateRef.current.volume
        })
      });

      const parsedCommand = await response.json();

      if (nodeRole === 'satellite') {
        // Satellite sends command to master
        NodeSyncService.getInstance().sendCommandToMaster(parsedCommand);
        const actionStr = (parsedCommand.action || '').toLowerCase();
        const isVolAction = actionStr.startsWith('volume') || actionStr === 'mute' || actionStr === 'unmute';
        if (isVolAction) {
          const beepType = actionStr === 'volume_up' ? 'up' : (actionStr === 'volume_down' ? 'down' : 'neutral');
          AudioEngine.getInstance().playBeep(beepType);
          setAssistantResponse(`Volumen enviado al coche`);
        } else {
          setAssistantResponse(`Transmitido al coche: "${rawTranscript}"`);
          await speech.speak(parsedCommand.speechFeedback || "Orden enviada.");
        }
      } else {
        // Master executes command directly
        await executeVoiceCommand(parsedCommand);
      }
    } catch (e) {
      console.warn("Voice command dispatch error:", e);
    } finally {
      setSystemStatus('idle');
      speech.setProcessingCommand(false);
    }
  }, [speechConfig.personality, nodeRole]);

  // Modificar el volumen EXCLUSIVO de la aplicación SerchTube (0 a 15) desde teclado o control, sin alterar el volumen de Windows
  const handleAppVolumeStep = useCallback((delta: number, source: 'teclado' | 'control' = 'teclado') => {
    let finalVol = 10;
    setPlayerState(prev => {
      finalVol = Math.max(0, Math.min(15, prev.volume + delta));
      const nextMuted = prev.isMuted && delta > 0 ? false : prev.isMuted;
      return {
        ...prev,
        volume: finalVol,
        isMuted: nextMuted
      };
    });

    const beepType = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'neutral');
    AudioEngine.getInstance().playBeep(beepType);

    const percent = Math.round((finalVol / 15) * 100);
    const label = `🔊 Volumen App: ${finalVol}/15 (${percent}%) [${source}]`;
    setAssistantResponse(label);

    if (nodeRole === 'satellite') {
      NodeSyncService.getInstance().sendCommandToMaster({
        action: 'volume_set',
        volumeValue: finalVol
      });
    }
  }, [nodeRole]);

  const handleAppMuteToggle = useCallback((source: 'teclado' | 'control' = 'teclado') => {
    let isNowMuted = false;
    let currentVol = 10;
    setPlayerState(prev => {
      isNowMuted = !prev.isMuted;
      currentVol = prev.volume;
      return {
        ...prev,
        isMuted: isNowMuted
      };
    });

    AudioEngine.getInstance().playBeep(isNowMuted ? 'down' : 'up');
    const label = isNowMuted ? `🔇 App Silenciada [${source}]` : `🔊 Audio App Activado (${currentVol}/15) [${source}]`;
    setAssistantResponse(label);

    if (nodeRole === 'satellite') {
      NodeSyncService.getInstance().sendCommandToMaster({
        action: isNowMuted ? 'mute' : 'unmute'
      });
    }
  }, [nodeRole]);

  // Soporte universal para Mandos/Controles USB y Bluetooth (Xbox, PlayStation, Mandos multimedia, Volantes)
  // Controlan directamente el volumen interno de SerchTube sin alterar Windows
  useGamepadControls({
    onVolumeStep: (delta, source) => handleAppVolumeStep(delta, source),
    onMuteToggle: (source) => handleAppMuteToggle(source),
    onPlayPauseToggle: () => setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying })),
    onNextTrack: () => handleNextTrackRef.current(),
    onPreviousTrack: () => handlePreviousTrackRef.current(),
    onNotify: (msg) => setAssistantResponse(msg)
  });

  // Global foreground keyboard typing capture listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if document is not visible or user is focused on an input element
      if (document.visibilityState !== 'visible') return;

      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toUpperCase();
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      // 1. Interceptar teclas de volumen multimedia del teclado/control para cambiar el volumen de la App sin tocar Windows
      if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
        e.preventDefault();
        e.stopPropagation();
        handleAppVolumeStep(1, 'teclado');
        return;
      }

      if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault();
        e.stopPropagation();
        handleAppVolumeStep(-1, 'teclado');
        return;
      }

      if (e.key === 'AudioVolumeMute' || e.key === 'VolumeMute') {
        e.preventDefault();
        e.stopPropagation();
        handleAppMuteToggle('teclado');
        return;
      }

      // 2. Atajos directos de teclado para volumen exclusivo de la app (100% inmunes al mezclador de Windows):
      // Ctrl + Flecha Arriba / Alt + Flecha Arriba: Subir volumen app
      if ((e.ctrlKey || e.altKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        handleAppVolumeStep(1, 'teclado');
        return;
      }

      // Ctrl + Flecha Abajo / Alt + Flecha Abajo: Bajar volumen app
      if ((e.ctrlKey || e.altKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        handleAppVolumeStep(-1, 'teclado');
        return;
      }

      // PageUp / PageDown (cuando no se está escribiendo texto en la barra de búsqueda)
      if (typedText.length === 0 && e.key === 'PageUp') {
        e.preventDefault();
        handleAppVolumeStep(1, 'teclado');
        return;
      }

      if (typedText.length === 0 && e.key === 'PageDown') {
        e.preventDefault();
        handleAppVolumeStep(-1, 'teclado');
        return;
      }

      // Teclado numérico (+ y -) cuando no se está escribiendo búsqueda
      if (typedText.length === 0 && e.code === 'NumpadAdd') {
        e.preventDefault();
        handleAppVolumeStep(1, 'teclado');
        return;
      }

      if (typedText.length === 0 && e.code === 'NumpadSubtract') {
        e.preventDefault();
        handleAppVolumeStep(-1, 'teclado');
        return;
      }

      // Ctrl + M: Silenciar / Activar sonido de la app
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        e.stopPropagation();
        handleAppMuteToggle('teclado');
        return;
      }

      // Teclas multimedia de reproducción
      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
        return;
      }

      if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        handleNextTrackRef.current();
        return;
      }

      if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        handlePreviousTrackRef.current();
        return;
      }

      // Enter / OK Key: submit typed command
      if (e.key === 'Enter' || e.key === 'Select' || e.code === 'NumpadEnter') {
        if (typedText.trim().length > 0) {
          e.preventDefault();
          const submittedQuery = typedText.trim();

          // 🛡️ Arbitraje de Turno Único
          if (!tryAcquireTurn('teclado_local', submittedQuery)) {
            setAssistantResponse('Turno en curso: ya se procesa otra petición');
            return;
          }

          setIsSubmittingText(true);
          setLastTranscript(submittedQuery);

          handleSpokenCommand(submittedQuery).finally(() => {
            setTimeout(() => {
              setTypedText('');
              setIsSubmittingText(false);
            }, 600);
          });
        }
        return;
      }

      // Backspace Key: delete last character
      if (e.key === 'Backspace') {
        if (typedText.length > 0) {
          e.preventDefault();
          setTypedText(prev => prev.slice(0, -1));
        }
        return;
      }

      // Escape Key: cancel / clear buffer
      if (e.key === 'Escape') {
        if (typedText.length > 0) {
          e.preventDefault();
          setTypedText('');
        }
        return;
      }

      // F11 Key shortcut: toggle Fullscreen cleanly (HTML5 Fullscreen API)
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
        return;
      }

      // Printable character typing (letters, numbers, space, accents)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();

        // Dismiss screensaver if active when typing starts
        if (isScreensaverActive) {
          setIsScreensaverActive(false);
        }

        setTypedText(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [typedText, isScreensaverActive, handleSpokenCommand, handleToggleFullscreen]);

  // Execute Core Voice Action on Master
  const executeVoiceCommand = async (command: any, fromNode?: string) => {
    let rawText = (
      command.query ||
      command.rawQuery ||
      command.transcript ||
      command.track ||
      command.artist ||
      ''
    ).trim();

    let action = (command.action || '').toLowerCase().trim();
    let volumeVal = command.volumeValue ?? command.volume ?? command.value;
    const textLower = rawText.toLowerCase();

    // Comprehensive check: Is this a volume command (by action, value or by speech text)?
    const hasVolumeWord = /(?:volumen|sonido|audio|decibelios|s[uú]bele|s[uú]bale|b[aá]jale)/i.test(textLower);
    const isVolExplicit = action === 'volume_set' || action === 'volume_up' || action === 'volume_down' || action === 'mute' || action === 'unmute' || action.startsWith('volume');

    if (hasVolumeWord || isVolExplicit || typeof volumeVal === 'number') {
      if (/(?:silenciar|mutear|c[aá]llate|que\s+te\s+calles|mute\b)/i.test(textLower) || action === 'mute') {
        action = 'mute';
      } else if (/(?:desmutear|quitar\s+silencio|reactivar\s+audio|activar\s+sonido|unmute\b)/i.test(textLower) || action === 'unmute') {
        action = 'unmute';
      } else if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[aá]ximo|alto|a\s+tope|a\s+todo\s+volumen|a\s+reventar|todo|full|tope|mango))|(?:al\s+(?:m[aá]ximo|tope))|(?:a\s+todo\s+volumen)|(?:a\s+tope)|(?:full\s+volumen)/i.test(textLower)) {
        action = 'volume_set';
        volumeVal = 15;
      } else if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:m[ií]nimo|bajo|bajito))|(?:al\s+m[ií]nimo)/i.test(textLower)) {
        action = 'volume_set';
        volumeVal = 1;
      } else if (/(?:volumen\s+(?:al\s+|en\s+|a\s+)?(?:medio|normal|regular|a\s+la\s+mitad))|(?:al\s+medio)|(?:a\s+la\s+mitad)/i.test(textLower)) {
        action = 'volume_set';
        volumeVal = 8;
      } else {
        const numWordsMap: Record<string, number> = {
          cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
          seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
          once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
          dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
          veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50,
          sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100
        };
        const wordsPattern = '(?:\\d+|cero|uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)';
        const volNumMatch = textLower.match(new RegExp(`(?:volumen|sonido|nivel|audio)?\\s*(?:al|en|a|de|nivel)?\\s*(${wordsPattern})(?:%|\\s*por\\s*ciento)?`, 'i'));

        if (volNumMatch && volNumMatch[1]) {
          const raw = volNumMatch[1].toLowerCase().trim();
          const parsed = typeof numWordsMap[raw] === 'number' ? numWordsMap[raw] : parseInt(raw, 10);
          if (!isNaN(parsed)) {
            action = 'volume_set';
            volumeVal = parsed > 15 ? Math.round((parsed / 100) * 15) : parsed;
          }
        } else if (typeof volumeVal === 'number' && (action === 'volume_set' || action === 'set_volume' || action === 'volume' || !action)) {
          action = 'volume_set';
          volumeVal = volumeVal > 15 ? Math.round((volumeVal / 100) * 15) : volumeVal;
        }

        if (action !== 'volume_set') {
          if (
            /(?:baja|bajar|b[aá]jale|reduce|reducir|red[uú]cele|menos|abajo|bajo|suave|despacio|bajito)/i.test(textLower) ||
            action === 'volume_down' || action === 'down'
          ) {
            action = 'volume_down';
          } else {
            action = 'volume_up';
          }
        }
      }
    } else {
      const isQrCommand =
        action === 'show_qr' ||
        action === 'qr' ||
        action === 'showqr' ||
        action === 'display_qr' ||
        action === 'mostrar_qr' ||
        action === 'muestra_qr' ||
        action === 'ver_qr' ||
        action === 'abrir_qr' ||
        /(?:^|\b)(?:m[uú]sica[:\s,]*)?(?:muestra|mostrar|abre|abrir|enseña|enseñar|ver|pon|poner|sacar?|despliega|desplegar|pop\s*up)\s+(?:el\s+)?(?:c[oó]digo\s+)?qr(?:\b|$)/i.test(textLower) ||
        /(?:^|\b)(?:m[uú]sica[:\s,]*)?(?:c[oó]digo\s+qr|qr\s+code|vincular\s+(?:m[oó]vil|tel[eé]fono|celular)|conectar\s+(?:m[oó]vil|tel[eé]fono|celular)|c[oó]digo\s+de\s+vinculaci[oó]n|vinculaci[oó]n\s+qr)(?:\b|$)/i.test(textLower) ||
        /^(?:m[uú]sica[:\s,]*)?(?:qr|codigo qr|código qr|muestra qr|mostrar qr|ver qr|abrir qr|abre qr|pon qr|enseña qr|vincular|conectar|vinculacion|musica muestra qr|música muestra qr|musica: muestra qr|música: muestra qr)$/i.test(textLower);

      if (isQrCommand) {
        action = 'show_qr';
      } else if (!action) {
        action = 'play';
      }
    }

    const isVolumeAction =
      action === 'volume_set' ||
      action === 'volume_up' ||
      action === 'volume_down' ||
      action === 'mute' ||
      action === 'unmute';

    // Deduplicación multi-nodo satélite en el Master:
    // Si varios teléfonos satélites o el master oyen y envían la misma orden (<3s),
    // solo se ejecuta una vez y se descartan las duplicadas.
    const now = Date.now();
    recentExecutedCommandsRef.current = recentExecutedCommandsRef.current.filter(
      entry => now - entry.timestamp <= 10000
    );

    const normQuery = normalizeText(rawText);

    const isControlAction =
      action === 'next' ||
      action === 'prev' ||
      action === 'previous' ||
      action === 'pause' ||
      action === 'stop' ||
      action === 'resume' ||
      action === 'play_pause' ||
      action === 'repeat' ||
      action === 'shuffle';

    const isDuplicate = recentExecutedCommandsRef.current.some(prev => {
      const elapsed = now - prev.timestamp;
      if (elapsed > 3000) return false;

      // Volumen: NUNCA descartar con ventana de 3s (solo si es el mismo volume_set en menos de 150ms)
      if (isVolumeAction) {
        if (action === 'volume_set' && prev.action === 'volume_set') {
          return prev.volumeVal === volumeVal && elapsed < 150;
        }
        if (action === prev.action && elapsed < 150) {
          return true;
        }
        return false;
      }

      // 1. Misma acción de control
      if (isControlAction && prev.action === action) {
        return true;
      }

      // 2. Petición de música equivalente
      if (
        (action === 'play' || action === 'search' || action === 'play_track' || action === 'play_artist' || !action) &&
        (prev.action === 'play' || prev.action === 'search' || prev.action === 'play_track' || prev.action === 'play_artist' || !prev.action)
      ) {
        const prevNorm = normalizeText(prev.query);
        if (normQuery && prevNorm) {
          if (normQuery === prevNorm) return true;
          if (normQuery.length >= 4 && prevNorm.length >= 4) {
            if (normQuery.includes(prevNorm) || prevNorm.includes(normQuery)) return true;
          }
        }
      }

      return false;
    });

    if (isDuplicate) {
      console.log(`[SerchTube Master] 🛡️ Deduplicación multi-nodo: Orden duplicada "${action || rawText}" descartada de "${fromNode || 'local'}".`);
      if (command.nodeId) {
        NodeSyncService.getInstance().sendCommandAck(command.nodeId, 'Orden ya ejecutada', true);
      }
      return;
    }

    recentExecutedCommandsRef.current.push({
      action,
      query: rawText,
      volumeVal: typeof volumeVal === 'number' ? volumeVal : undefined,
      timestamp: now,
      fromNode
    });

    let feedback = command.speechFeedback;
    const query = rawText;

    // Generate natural, cheerful and friendly feedback if not provided
    if (!feedback) {
      const personality = speechConfigRef.current?.personality || 'animada';
      feedback = getEnthusiasticFeedback(action, query, personality, {
        volume: volumeVal,
        preset: command.presetName
      });
    }

    const isVolumeCmd = isVolumeAction || hasVolumeWord || action.startsWith('volume') || action === 'mute' || action === 'unmute';

    if (isVolumeCmd) {
      // User request: No TTS voice confirmation for volume commands, use a discreet audio beep
      const beepType = action === 'volume_up' ? 'up' : (action === 'volume_down' ? 'down' : 'neutral');
      AudioEngine.getInstance().playBeep(beepType);
      const volLabel = action === 'volume_up'
        ? 'Volumen +'
        : (action === 'volume_down'
            ? 'Volumen -'
            : (action === 'mute'
                ? 'Silenciado'
                : (action === 'unmute'
                    ? 'Audio activado'
                    : `Volumen: ${volumeVal ?? playerStateRef.current.volume}/15`)));
      setAssistantResponse(fromNode ? `[${fromNode}] ${volLabel}` : volLabel);
    } else {
      setAssistantResponse(fromNode ? `[${fromNode}] ${feedback}` : feedback);
      // Speak audio feedback with TTS only for non-volume commands
      SpeechService.getInstance().speak(feedback);
    }

    // Send ACK back to Android satellite
    if (command.nodeId) {
      NodeSyncService.getInstance().sendCommandAck(command.nodeId, isVolumeCmd ? 'ok' : feedback, true);
    }

    switch (action) {
      case 'play': {
        // Absolute safeguard against volume commands being treated as songs
        if (/(?:volumen|sonido|audio|decibelios|s[uú]bele|b[aá]jale)/i.test(query)) {
          setPlayerState(prev => ({ ...prev, volume: Math.min(15, prev.volume + 1), isMuted: false }));
          break;
        }
        enforcePostPlaybackMicSafety();
        if (query && !isPureResumePhrase(query)) {
          // Clean standard prefixes e.g. "reproduce hotel california", "pon a Maná"
          const cleanQuery = query
            .replace(/^(reproduce|reproducir|pon|ponme|ponte|escuchar|quiero escuchar|toca|play)\s+(a\s+|de\s+|la canción\s+|el tema\s+|el disco\s+|algo de\s+)?/i, '')
            .trim();
          handleMusicSearch(cleanQuery || query, false);
        } else {
          // Resume if no query specified or if it is a resume phrase
          handleResumeMusic();
        }
        break;
      }

      case 'search': {
        if (query) {
          if (/(?:volumen|sonido|audio|decibelios|s[uú]bele|b[aá]jale)/i.test(query)) {
            break;
          }
          enforcePostPlaybackMicSafety();
          const cleanQuery = query.replace(/^(busca|buscar|encuentra|encontrar)\s+/i, '').trim();
          handleMusicSearch(cleanQuery || query, false);
        }
        break;
      }

      case 'play_artist':
        if (command.artist || query) {
          if (/(?:volumen|sonido|audio|decibelios|s[uú]bele|b[aá]jale)/i.test(command.artist || query)) {
            break;
          }
          enforcePostPlaybackMicSafety();
          handleMusicSearch(command.artist || query, true);
        }
        break;

      case 'play_track':
        if (query && !isPureResumePhrase(query)) {
          if (/(?:volumen|sonido|audio|decibelios|s[uú]bele|b[aá]jale)/i.test(query)) {
            break;
          }
          enforcePostPlaybackMicSafety();
          handleMusicSearch(query, false);
        } else {
          enforcePostPlaybackMicSafety();
          handleResumeMusic();
        }
        break;

      case 'pause':
      case 'stop':
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        enforcePostPlaybackMicSafety();
        break;

      case 'resume':
        enforcePostPlaybackMicSafety();
        handleResumeMusic();
        break;

      case 'next':
        enforcePostPlaybackMicSafety();
        handleNextTrack();
        break;

      case 'prev':
      case 'previous':
        enforcePostPlaybackMicSafety();
        handlePreviousTrack();
        break;

      case 'repeat':
        setPlayerState(prev => ({
          ...prev,
          repeatMode: prev.repeatMode === 'none' ? 'one' : 'none'
        }));
        break;

      case 'smarthome_device': {
        const { deviceId, state } = command;
        if (deviceId) {
          if (state === 'open' || state === 'turn_on') {
            googleHomeService.setDeviceState(deviceId, { isOn: true });
          } else if (state === 'close' || state === 'turn_off') {
            googleHomeService.setDeviceState(deviceId, { isOn: false });
          } else {
            googleHomeService.toggleDevice(deviceId);
          }
        }
        break;
      }

      case 'smarthome_routine': {
        const { routineId } = command;
        if (routineId) {
          googleHomeService.executeRoutine(routineId);
        }
        break;
      }

      case 'volume_up': {
        const currentVol = playerStateRef.current?.volume ?? 10;
        const newVol = typeof volumeVal === 'number'
          ? Math.max(0, Math.min(15, volumeVal))
          : Math.min(15, currentVol + 1);

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: newVol,
          isMuted: false
        };
        setPlayerState(prev => ({
          ...prev,
          volume: newVol,
          isMuted: false
        }));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: `Subiendo volumen (${newVol}/15)`,
          timestamp: Date.now()
        });
        AudioEngine.getInstance().playBeep('up');
        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'volume_down': {
        const currentVol = playerStateRef.current?.volume ?? 10;
        const newVol = typeof volumeVal === 'number'
          ? Math.max(0, Math.min(15, volumeVal))
          : Math.max(0, currentVol - 1);

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: newVol,
          isMuted: false
        };
        setPlayerState(prev => ({
          ...prev,
          volume: newVol,
          isMuted: false
        }));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: `Bajando volumen (${newVol}/15)`,
          timestamp: Date.now()
        });
        AudioEngine.getInstance().playBeep('down');
        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'volume_set': {
        let targetVol = typeof volumeVal === 'number' ? volumeVal : 8;
        if (targetVol > 15) {
          targetVol = Math.round((targetVol / 100) * 15);
        }
        targetVol = Math.min(15, Math.max(0, targetVol));

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: targetVol,
          isMuted: false
        };
        setPlayerState(prev => ({ ...prev, volume: targetVol, isMuted: false }));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: `Volumen fijado: ${targetVol}/15`,
          timestamp: Date.now()
        });
        AudioEngine.getInstance().playBeep('neutral');
        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'mute': {
        playerStateRef.current = { ...playerStateRef.current, isMuted: true };
        setPlayerState(prev => ({ ...prev, isMuted: true }));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: 'Audio silenciado (Mute)',
          timestamp: Date.now()
        });
        AudioEngine.getInstance().playBeep('down');
        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'unmute': {
        playerStateRef.current = { ...playerStateRef.current, isMuted: false };
        setPlayerState(prev => ({ ...prev, isMuted: false }));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: 'Audio activado',
          timestamp: Date.now()
        });
        AudioEngine.getInstance().playBeep('up');
        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'screensaver_start':
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        setIsScreensaverActive(true);
        break;

      case 'screensaver_stop':
        setIsScreensaverActive(false);
        break;

      case 'nonstop':
        handleToggleNonStop();
        break;

      case 'seek':
        if (typeof command.seekTime === 'number') {
          const sTime = Math.max(0, command.seekTime);
          setPlayerState(prev => ({ ...prev, currentTime: sTime }));
          window.dispatchEvent(new CustomEvent('serchtube:seek-to', { detail: { time: sTime } }));
        }
        break;

      case 'fullscreen_toggle':
        setIsFullscreen(prev => !prev);
        break;

      case 'show_qr':
        setQrCountdownDuration(10);
        setIsQrCountdownModalOpen(true);
        feedback = getEnthusiasticFeedback('show_qr', speechConfig.personality || 'animada');
        AudioEngine.getInstance().playBeep('up');
        break;

      case 'reload_player':
      case 'refresh_player':
        window.dispatchEvent(new CustomEvent('serchtube:reload-player'));
        setSatelliteCommandNotification({
          nodeName: fromNode || 'Satélite',
          text: 'Reproductor de YouTube recargado con credenciales',
          timestamp: Date.now()
        });
        break;

      case 'open_youtube_auth':
        window.dispatchEvent(new CustomEvent('serchtube:open-youtube-auth'));
        break;

      case 'quality_set':
        if (command.qualityValue) {
          const q = command.qualityValue;
          setPlayerState(prev => ({ ...prev, playbackQuality: q }));
          try {
            localStorage.setItem('serchtube_video_quality', q);
          } catch (e) {}
        }
        break;

      case 'speed_set':
        if (typeof command.speedValue === 'number') {
          const s = command.speedValue;
          setPlayerState(prev => ({ ...prev, playbackSpeed: s }));
          try {
            localStorage.setItem('serchtube_video_speed', String(s));
          } catch (e) {}
        }
        break;

      case 'header_opacity_set':
        if (typeof command.opacityValue === 'number') {
          handleUpdateVisualConfig({ headerBgOpacity: command.opacityValue });
        }
        break;

      case 'footer_opacity_set':
        if (typeof command.opacityValue === 'number') {
          handleUpdateVisualConfig({ footerBgOpacity: command.opacityValue });
        }
        break;

      case 'bars_transparency_set':
        {
          const updates: Partial<DisplayVisualConfig> = {};
          if (typeof command.headerOpacity === 'number') updates.headerBgOpacity = command.headerOpacity;
          else if (typeof command.opacityValue === 'number') updates.headerBgOpacity = command.opacityValue;
          
          if (typeof command.footerOpacity === 'number') updates.footerBgOpacity = command.footerOpacity;
          else if (typeof command.opacityValue === 'number') updates.footerBgOpacity = command.opacityValue;
          
          handleUpdateVisualConfig(updates);
        }
        break;

      case 'video_opacity_set':
        if (typeof command.opacityValue === 'number') {
          handleUpdateVisualConfig({ videoOpacity: command.opacityValue });
        }
        break;

      case 'eq_preset':
        if (command.presetName) {
          const presetVals = PRESET_EQUALIZERS[command.presetName];
          if (presetVals) {
            handleUpdateEqSettings({
              enabled: true,
              preset: command.presetName,
              ...presetVals
            });
          }
        }
        break;

      case 'eq_toggle':
        {
          const targetEnabled = command.enabled !== undefined ? !!command.enabled : eqSettings.enabled === false;
          handleUpdateEqSettings({ enabled: targetEnabled });
          setSatelliteCommandNotification({
            nodeName: fromNode || 'Sistema',
            text: targetEnabled ? 'Ecualizador Activado' : 'Ecualizador en Bypass (Desactivado)',
            timestamp: Date.now()
          });
        }
        break;

      case 'auto_volume_set':
        {
          const autoVolumeUpdates = command.autoVolume || {};
          handleUpdateAutoVolume(autoVolumeUpdates);
          setSatelliteCommandNotification({
            nodeName: fromNode || 'Sistema',
            text: autoVolumeUpdates.enabled !== false
              ? `Auto-Volumen: ${autoVolumeUpdates.targetVolume ?? autoVolumeConfig.targetVolume}/15 tras ${autoVolumeUpdates.delaySeconds ?? autoVolumeConfig.delaySeconds}s`
              : 'Auto-Volumen Desactivado',
            timestamp: Date.now()
          });
        }
        break;

      case 'auto_shutdown_set':
        if (command.targetTime) {
          handleUpdateAutoShutdown({ targetTime: command.targetTime, enabled: true });
          setSatelliteCommandNotification({
            nodeName: fromNode || 'Sistema',
            text: `Auto-Apagado programado: ${command.targetTime}`,
            timestamp: Date.now()
          });
        }
        break;

      case 'auto_shutdown_cancel':
        handleCancelShutdown();
        break;

      case 'pc_shutdown_now':
        handleExecuteShutdownNow();
        break;

      case 'fullscreen':
      case 'fullscreen_on':
        setIsFullscreen(true);
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        break;

      case 'fullscreen_off':
      case 'exit_fullscreen':
        setIsFullscreen(false);
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        break;
    }
  };

  // Helper to ensure next track does not repeat the same song
  const isSameSongInQueue = (titleA?: string, titleB?: string): boolean => {
    if (!titleA || !titleB) return false;
    const clean = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\(.*?\)|\[.*?\]/g, "")
        .replace(/official\s*(video|audio|music\s*video|lyric\s*video|lyrics)?/gi, "")
        .replace(/video\s*oficial|audio\s*oficial|en\s*vivo|live|remastered|remasterizado|remaster/gi, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const cA = clean(titleA);
    const cB = clean(titleB);
    if (cA === cB) return true;

    const partsA = titleA.split(/\s*-\s*|\s*\|\s*/);
    const partsB = titleB.split(/\s*-\s*|\s*\|\s*/);
    const songA = clean(partsA.length > 1 ? partsA[1] : partsA[0]);
    const songB = clean(partsB.length > 1 ? partsB[1] : partsB[0]);
    if (songA && songB && songA === songB) return true;

    const wordsA = songA.split(" ").filter(w => w.length > 2);
    const wordsB = songB.split(" ").filter(w => w.length > 2);
    if (wordsA.length >= 2 && wordsB.length >= 2) {
      const common = wordsA.filter(w => wordsB.includes(w));
      if (common.length / Math.max(wordsA.length, wordsB.length) >= 0.75) {
        return true;
      }
    }
    return false;
  };

  // Dynamic queue expansion (Endless YouTube Radio autoplay)
  const isFetchingMoreRef = useRef(false);

  const fetchMoreRelatedTracks = useCallback(async (currentTrack: Track) => {
    if (isFetchingMoreRef.current || !currentTrack) return;
    isFetchingMoreRef.current = true;
    try {
      const resp = await fetch(
        `/api/youtube/related?videoId=${encodeURIComponent(currentTrack.id || '')}&artist=${encodeURIComponent(currentTrack.artist || '')}&title=${encodeURIComponent(currentTrack.title || '')}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          setPlaylistQueue(prevQueue => {
            const seen = new Set(prevQueue.map(t => t.id));
            const newTracks: Track[] = [];
            for (const item of data.items) {
              if (item.id && !seen.has(item.id)) {
                seen.add(item.id);
                newTracks.push({
                  ...item,
                  thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
                });
              }
            }
            return newTracks.length > 0 ? [...prevQueue, ...newTracks] : prevQueue;
          });
        }
      }
    } catch (err) {
      console.warn("Error prefetching related tracks:", err);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, []);

  // Whenever playlistIndex approaches the end of the queue, prefetch more related songs in background
  useEffect(() => {
    if (playlistQueue.length > 0 && playlistIndex >= playlistQueue.length - 4) {
      const current = playlistQueue[playlistIndex] || playerState.currentTrack;
      if (current) {
        fetchMoreRelatedTracks(current);
      }
    }
  }, [playlistIndex, playlistQueue.length, fetchMoreRelatedTracks, playerState.currentTrack]);

  // Next / Previous Track handlers navigating the continuous YouTube playlist queue
  const handleNextTrack = async () => {
    const currentTrack = playerState.currentTrack;
    if (playlistQueue && playlistQueue.length > 1) {
      let nextIndex = playlistIndex + 1;

      // Skip any track in the queue that has the same video ID or is the same song
      while (nextIndex < playlistQueue.length) {
        const candidate = playlistQueue[nextIndex];
        if (
          candidate.id !== currentTrack?.id &&
          !isSameSongInQueue(candidate.title, currentTrack?.title)
        ) {
          break;
        }
        nextIndex++;
      }

      if (nextIndex < playlistQueue.length) {
        setPlaylistIndex(nextIndex);
        const nextTrack = playlistQueue[nextIndex];
        setPlayerState(prev => ({
          ...prev,
          currentTrack: nextTrack,
          isPlaying: true,
          currentTime: 0
        }));
        enforcePostPlaybackMicSafety();

        if (nextIndex >= playlistQueue.length - 3 && nextTrack) {
          fetchMoreRelatedTracks(nextTrack);
        }
        return;
      }
    }

    // When reaching the end of queue, dynamically fetch next continuous YouTube songs
    if (currentTrack) {
      try {
        const resp = await fetch(
          `/api/youtube/related?videoId=${encodeURIComponent(currentTrack.id || '')}&artist=${encodeURIComponent(currentTrack.artist || '')}&title=${encodeURIComponent(currentTrack.title || '')}`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const seen = new Set(playlistQueue.map(t => t.id));
            if (currentTrack.id) seen.add(currentTrack.id);
            const freshTracks = data.items.filter((t: Track) => t.id && !seen.has(t.id));
            if (freshTracks.length > 0) {
              const nextSong = freshTracks[0];
              const updatedQueue = [...playlistQueue, ...freshTracks];
              setPlaylistQueue(updatedQueue);
              setPlaylistIndex(playlistQueue.length);
              setPlayerState(prev => ({
                ...prev,
                currentTrack: nextSong,
                isPlaying: true,
                currentTime: 0
              }));
              enforcePostPlaybackMicSafety();
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Fallback related search error:', e);
      }
    }

    // Query more hits of the same artist or current theme to maintain strict musical continuity
    const currentArtist = playerState.currentTrack?.artist || '';
    const currentTitle = playerState.currentTrack?.title || '';
    if (currentArtist && !currentArtist.toLowerCase().includes('desconocido')) {
      const cleanArtist = currentArtist.split('ft.')[0].split('feat.')[0].split('&')[0].trim();
      handleMusicSearch(`${cleanArtist} greatest hits`, true);
    } else if (currentTitle) {
      handleMusicSearch(`${currentTitle} official music video`, true);
    }
  };

  const handlePreviousTrack = () => {
    if (playlistQueue && playlistQueue.length > 0) {
      if (playlistIndex > 0) {
        const prevIndex = playlistIndex - 1;
        setPlaylistIndex(prevIndex);
        const prevTrack = playlistQueue[prevIndex];
        setPlayerState(prev => ({
          ...prev,
          currentTrack: prevTrack,
          isPlaying: true,
          currentTime: 0
        }));
        enforcePostPlaybackMicSafety();
        return;
      } else {
        // If at the first track, restart it from 0 seconds
        setPlayerState(prev => ({
          ...prev,
          currentTime: 0,
          isPlaying: true
        }));
        enforcePostPlaybackMicSafety();
        return;
      }
    }

    const currentArtist = playerState.currentTrack?.artist || '';
    if (currentArtist && !currentArtist.toLowerCase().includes('desconocido')) {
      const cleanArtist = currentArtist.split('ft.')[0].split('feat.')[0].split('&')[0].trim();
      handleMusicSearch(`${cleanArtist} greatest hits`, true);
    }
  };

  handleNextTrackRef.current = handleNextTrack;
  handlePreviousTrackRef.current = handlePreviousTrack;

  const handleResumeMusic = () => {
    setIsScreensaverActive(false);
    setPlayerState(prev => ({
      ...prev,
      isPlaying: true,
      currentTrack: prev.currentTrack || lastKnownTrackRef.current,
      currentTime: lastKnownTimeRef.current || prev.currentTime
    }));
    // Expand player to full screen layout
    if (visualConfig.autoExpandOnPlay !== false) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  };

  // Direct Player Event Dispatcher from Satellite / Command Dispatcher
  const handleDirectPlayerEvent = (evt: any) => {
    if (!evt || !evt.event) return;
    const fromNode = evt.fromNode || 'Satélite Android';
    const evtType = String(evt.event).toUpperCase();

    // 🛡️ Ventana de 3 Segundos / Arbitraje Global: Solo aceptar la primera solicitud musical/transporte que llegue en menos de 3s.
    // Los controles de volumen y silencio NUNCA deben bloquearse.
    const isVolumeEvt =
      evtType === 'SET_VOLUME' ||
      evtType === 'VOLUME_UP' ||
      evtType === 'VOLUME_DOWN' ||
      evtType === 'MUTE' ||
      evtType === 'UNMUTE';

    if (!isVolumeEvt && evtType !== 'SCREENSAVER_START' && evtType !== 'SCREENSAVER_STOP' && evtType !== 'ACTIVATE_MIC') {
      if (!tryAcquireTurn(`nodo_direct_${fromNode}`, evt.title || evt.videoId || evtType)) {
        console.log(`[SerchTube Master] 🛡️ Ventana de 3s: Evento ${evtType} descartado de "${fromNode}". Ya se aceptó una solicitud previa.`);
        return;
      }
    }

    switch (evt.event) {
      case 'ACTIVATE_MIC': {
        // 🎙️ Un nodo satélite detectó la palabra clave y solo pide encender el
        // micrófono del host: NO se procesa ningún comando y NO se habla por voz
        // (así los nodos no capturan la respuesta del asistente).
        setIsScreensaverActive(false);
        setIsAwaitingCommandAfterWakeWord(true);
        isAwaitingCommandRef.current = true;
        setMicActivationSource('node');
        setSystemStatus('listening');
        setIsListening(true);
        setLastTranscript('🎙️ Micrófono activado por estación externa');
        // Asegurar que el reconocimiento esté corriendo (por si estaba detenido)
        SpeechService.getInstance().startListening();
        // Atenuar la música para que el usuario pueda hablar suave
        if (playerStateRef.current.isPlaying) {
          AudioEngine.getInstance().startDucking(150);
        }
        // Ventana de inactividad: si nadie da una orden, cerrar solo
        if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
        activeListeningTimerRef.current = setTimeout(() => {
          setIsAwaitingCommandAfterWakeWord(false);
          isAwaitingCommandRef.current = false;
          setSystemStatus('idle');
          setIsListening(false);
          setAssistantResponse('⏱️ Micrófono abierto por estación externa cerrado (sin orden)');
          AudioEngine.getInstance().stopDucking();
          setTimeout(() => {
            setAssistantResponse(prev => (prev && prev.includes('estación externa') ? null : prev));
          }, 3000);
        }, 8000);
        break;
      }
      case 'LOAD_VIDEO': {
        const newTrack: Track = {
          id: evt.videoId,
          title: evt.title || 'Canción',
          artist: evt.artist || 'Artista',
          thumbnail: evt.thumbnail || `https://i.ytimg.com/vi/${evt.videoId}/hqdefault.jpg`,
          duration: evt.duration || '3:45'
        };

        if (Array.isArray(evt.items) && evt.items.length > 0) {
          const seenIds = new Set<string>();
          const seenKeys = new Set<string>();
          const formattedItems: Track[] = [];

          for (const it of evt.items) {
            if (!it || !it.id || seenIds.has(it.id)) continue;
            const key = normalizeSongKeyForDedup(it.title);
            if (formattedItems.length > 0 && key && seenKeys.has(key)) continue;

            seenIds.add(it.id);
            if (key) seenKeys.add(key);
            formattedItems.push({
              id: it.id,
              title: it.title,
              artist: it.artist || newTrack.artist,
              thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
              duration: it.duration || '3:45'
            });
          }

          setPlaylistQueue(formattedItems.length > 0 ? formattedItems : [newTrack]);
          setPlaylistIndex(0);
        } else {
          setPlaylistQueue([newTrack]);
          setPlaylistIndex(0);
        }

        setIsScreensaverActive(false);
        setPlayerState(prev => ({
          ...prev,
          currentTrack: newTrack,
          isPlaying: true,
          currentTime: 0
        }));

        // 🛡️ Seguridad post-reproducción de micrófono local
        enforcePostPlaybackMicSafety();

        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: `Reproduciendo: ${newTrack.title}`,
          timestamp: Date.now()
        });

        const personality = speechConfigRef.current?.personality || 'animada';
        const feedbackMsg = getEnthusiasticFeedback('play', newTrack.title, personality);
        setAssistantResponse(`[${fromNode}] ${feedbackMsg}`);
        SpeechService.getInstance().speak(feedbackMsg);
        break;
      }

      case 'PAUSE': {
        recentExecutedCommandsRef.current.push({
          action: 'pause',
          query: '',
          timestamp: Date.now(),
          fromNode
        });
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        enforcePostPlaybackMicSafety();
        const personality = speechConfigRef.current?.personality || 'animada';
        const currentTitle = playerStateRef.current?.currentTrack?.title || '';
        const feedbackMsg = getEnthusiasticFeedback('pause', currentTitle, personality);
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: feedbackMsg,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] ${feedbackMsg}`);
        SpeechService.getInstance().speak(feedbackMsg);
        break;
      }

      case 'PLAY':
      case 'RESUME': {
        recentExecutedCommandsRef.current.push({
          action: 'resume',
          query: '',
          timestamp: Date.now(),
          fromNode
        });
        enforcePostPlaybackMicSafety();
        handleResumeMusic();
        const currentTitle = playerStateRef.current?.currentTrack?.title || lastKnownTrackRef.current?.title || '';
        const personality = speechConfigRef.current?.personality || 'animada';
        const msg = getEnthusiasticFeedback('resume', currentTitle, personality);
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: msg,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] ${msg}`);
        SpeechService.getInstance().speak(msg);
        break;
      }

      case 'SET_VOLUME': {
        const rawVal = typeof evt.value === 'number'
          ? evt.value
          : (typeof evt.volume === 'number'
              ? evt.volume
              : (typeof evt.volumeValue === 'number'
                  ? evt.volumeValue
                  : (typeof evt.val === 'number' ? evt.val : 8)));
        const targetVol = rawVal <= 15 ? rawVal : Math.round((rawVal / 100) * 15);
        const safeVol = Math.max(0, Math.min(15, targetVol));

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: safeVol,
          isMuted: false
        };
        setPlayerState(prev => ({
          ...prev,
          volume: safeVol,
          isMuted: false
        }));

        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: `Volumen: ${safeVol}/15`,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] Volumen: ${safeVol}/15`);
        AudioEngine.getInstance().playBeep('neutral');

        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'VOLUME_UP': {
        const currentVol = playerStateRef.current?.volume ?? 10;
        const newVol = typeof evt.volumeValue === 'number'
          ? Math.max(0, Math.min(15, evt.volumeValue))
          : Math.min(15, currentVol + 1);

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: newVol,
          isMuted: false
        };
        setPlayerState(prev => ({
          ...prev,
          volume: newVol,
          isMuted: false
        }));

        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: `Subiendo volumen (${newVol}/15)`,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] Volumen: ${newVol}/15`);
        AudioEngine.getInstance().playBeep('up');

        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'VOLUME_DOWN': {
        const currentVol = playerStateRef.current?.volume ?? 10;
        const newVol = typeof evt.volumeValue === 'number'
          ? Math.max(0, Math.min(15, evt.volumeValue))
          : Math.max(0, currentVol - 1);

        playerStateRef.current = {
          ...playerStateRef.current,
          volume: newVol,
          isMuted: false
        };
        setPlayerState(prev => ({
          ...prev,
          volume: newVol,
          isMuted: false
        }));

        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: `Bajando volumen (${newVol}/15)`,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] Volumen: ${newVol}/15`);
        AudioEngine.getInstance().playBeep('down');

        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'NEXT': {
        handleNextTrack();
        const personality = speechConfigRef.current?.personality || 'animada';
        const nextMsg = getEnthusiasticFeedback('next', '', personality);
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: nextMsg,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] ${nextMsg}`);
        SpeechService.getInstance().speak(nextMsg);
        break;
      }

      case 'PREV': {
        handlePreviousTrack();
        const personality = speechConfigRef.current?.personality || 'animada';
        const prevMsg = getEnthusiasticFeedback('previous', '', personality);
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: prevMsg,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] ${prevMsg}`);
        SpeechService.getInstance().speak(prevMsg);
        break;
      }

      case 'MUTE': {
        playerStateRef.current = {
          ...playerStateRef.current,
          isMuted: true
        };
        setPlayerState(prev => ({ ...prev, isMuted: true }));
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: 'Audio silenciado (Mute)',
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] Audio silenciado`);
        AudioEngine.getInstance().playBeep('down');

        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'UNMUTE': {
        playerStateRef.current = {
          ...playerStateRef.current,
          isMuted: false
        };
        setPlayerState(prev => ({ ...prev, isMuted: false }));
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: 'Audio activado',
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] Audio activado`);
        AudioEngine.getInstance().playBeep('up');

        NodeSyncService.getInstance().broadcastMasterState(
          playerStateRef.current,
          getUpcomingQueue()
        );
        break;
      }

      case 'SEEK': {
        const seekTime = typeof evt.time === 'number'
          ? evt.time
          : (typeof evt.seekTime === 'number'
              ? evt.seekTime
              : (typeof evt.position === 'number'
                  ? evt.position
                  : (typeof evt.value === 'number' ? evt.value : 0)));
        setPlayerState(prev => ({ ...prev, currentTime: seekTime }));
        window.dispatchEvent(new CustomEvent('serchtube:seek-to', { detail: { time: seekTime } }));
        break;
      }

      case 'SEEK_RELATIVE': {
        const offset = typeof evt.offset === 'number' ? evt.offset : 10;
        window.dispatchEvent(new CustomEvent('serchtube:seek-relative', { detail: { offset } }));
        break;
      }

      case 'SET_QUALITY': {
        const quality = evt.quality || evt.playbackQuality;
        if (quality) {
          try {
            localStorage.setItem('serchtube_video_quality', quality);
          } catch (e) {}
          setPlayerState(prev => ({ ...prev, playbackQuality: quality }));
        }
        break;
      }

      case 'SET_SPEED': {
        const speed = typeof evt.speed === 'number' ? evt.speed : (typeof evt.playbackSpeed === 'number' ? evt.playbackSpeed : 1.0);
        setPlayerState(prev => ({ ...prev, playbackSpeed: speed }));
        break;
      }

      case 'NON_STOP':
      case 'TOGGLE_NON_STOP': {
        setPlayerState(prev => ({
          ...prev,
          nonStop: prev.nonStop === false ? true : false
        }));
        break;
      }

      case 'RELOAD_PLAYER': {
        window.dispatchEvent(new CustomEvent('serchtube:reload-player'));
        break;
      }

      case 'FULLSCREEN_TOGGLE': {
        setIsFullscreen(prev => !prev);
        break;
      }

      case 'SHOW_QR': {
        const dur = typeof evt.duration === 'number' ? evt.duration : 10;
        setQrCountdownDuration(dur);
        setIsQrCountdownModalOpen(true);
        const msg = 'Mostrando código QR de vinculación por 10 segundos';
        setSatelliteCommandNotification({
          nodeName: fromNode,
          text: msg,
          timestamp: Date.now()
        });
        setAssistantResponse(`[${fromNode}] ${msg}`);
        SpeechService.getInstance().speak(msg);
        AudioEngine.getInstance().playBeep('up');
        break;
      }

      case 'SCREENSAVER_START': {
        setIsScreensaverActive(true);
        break;
      }

      case 'SCREENSAVER_STOP': {
        setIsScreensaverActive(false);
        break;
      }

      case 'REPEAT': {
        setPlayerState(prev => ({
          ...prev,
          repeatMode: prev.repeatMode === 'none' ? 'one' : 'none'
        }));
        break;
      }

      case 'SHUFFLE': {
        setPlaylistQueue(prev => {
          if (!prev || prev.length <= 1) return prev;
          const shuffled = [...prev];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        });
        break;
      }

      default: {
        console.log(`[SerchTube Host] Evento de satélite recibido (${fromNode}):`, evt.event);
        break;
      }
    }
  };
  handleDirectEventRef.current = handleDirectPlayerEvent;

  const handleSelectTrackFromQueue = useCallback((track: Track, index: number) => {
    if (nodeRoleRef.current === 'satellite') {
      NodeSyncService.getInstance().sendCommandToMaster({
        action: 'load_video',
        videoId: track.id,
        title: track.title,
        artist: track.artist
      });
      AudioEngine.getInstance().playBeep('up');
      setAssistantResponse(`Enviando al coche: "${track.title}"`);
    } else {
      setPlaylistIndex(index);
      setPlayerState(prev => ({
        ...prev,
        currentTrack: track,
        isPlaying: true,
        currentTime: 0
      }));
      enforcePostPlaybackMicSafety();
      AudioEngine.getInstance().playBeep('up');
      setTimeout(() => {
        NodeSyncService.getInstance().broadcastMasterState(
          { ...playerStateRef.current, currentTrack: track, isPlaying: true, currentTime: 0 },
          getUpcomingQueue()
        );
      }, 50);
    }
  }, [getUpcomingQueue]);

  // Rule: Non-stop continuous playback handler
  const handleTrackEnded = () => {
    if (playerState.repeatMode === 'one') {
      setPlayerState(prev => ({ ...prev, currentTime: 0, isPlaying: true }));
      return;
    }

    if (playerState.nonStop !== false) {
      // Non-stop active: immediately play next track without interruption!
      handleNextTrack();
    } else {
      // Non-stop inactive: stop and start screensaver inactivity countdown
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const handleToggleListening = async () => {
    const speech = SpeechService.getInstance();
    if (isListening && isDirectMicActiveRef.current) {
      speech.stopListening();
      setIsListening(false);
      setIsDirectMicActive(false);
      isDirectMicActiveRef.current = false;
      setSystemStatus('idle');
      if (nodeRole === 'satellite') {
        NodeSyncService.getInstance().broadcastMicEvent(false);
      }
    } else {
      try {
        await speech.requestMicPermission();
      } catch (_) {}

      AudioEngine.getInstance().playBeep('up');
      speech.startListening();
      setIsListening(true);
      setIsDirectMicActive(true);
      setMicActivationSource('host');
      isDirectMicActiveRef.current = true;
      setSystemStatus('listening');
      setAssistantResponse('🎙️ Escuchando orden... (Di tu canción o comando)');

      if (nodeRole === 'satellite') {
        NodeSyncService.getInstance().broadcastMicEvent(true);
      }

      if (activeListeningTimerRef.current) clearTimeout(activeListeningTimerRef.current);
      activeListeningTimerRef.current = setTimeout(() => {
        setIsDirectMicActive(false);
        isDirectMicActiveRef.current = false;
        setIsAwaitingCommandAfterWakeWord(false);
        setAssistantResponse('⏱️ Micrófono cerrado (sin palabras)');
        if (nodeRole === 'satellite') {
          NodeSyncService.getInstance().broadcastMicEvent(false);
        }
        setTimeout(() => {
          setAssistantResponse(prev => (prev && prev.includes('cerrado') ? '' : prev));
        }, 3000);
      }, 6000);
    }
  };

  const handlePlayerStateChange = useCallback((updates: Partial<PlayerState>) => {
    if (updates.playbackQuality) {
      try {
        localStorage.setItem('serchtube_video_quality', updates.playbackQuality);
      } catch (e) {}
      if (nodeRoleRef.current === 'satellite') {
        NodeSyncService.getInstance().sendCommandToMaster({
          action: 'set_quality',
          quality: updates.playbackQuality
        });
      }
    }
    if (typeof updates.playbackSpeed === 'number') {
      if (nodeRoleRef.current === 'satellite') {
        NodeSyncService.getInstance().sendCommandToMaster({
          action: 'set_speed',
          speed: updates.playbackSpeed
        });
      }
    }
    setPlayerState(prev => {
      let changed = false;
      for (const k in updates) {
        const key = k as keyof PlayerState;
        if (prev[key] !== updates[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  return (
    <div className="w-full min-h-screen bg-black text-white font-sans">
      {/* 1. Main OLED Driving Dashboard */}
      <OledDrivingDashboard
        isConnected={isWsConnected}
        playerState={playerState}
        systemStatus={systemStatus}
        nodeRole={nodeRole}
        connectedNodesCount={connectedNodesCount}
        lastTranscript={lastTranscript}
        assistantResponse={assistantResponse}
        isListening={isListening}
        isFullscreen={isFullscreen}
        visualConfig={visualConfig}
        onUpdateVisualConfig={handleUpdateVisualConfig}
        isExpanded={isFullscreen}
        onToggleExpanded={() => setIsFullscreen(!isFullscreen)}
        onTogglePlay={() => {
          if (nodeRole === 'satellite') {
            const nextPlaying = !playerState.isPlaying;
            setPlayerState(prev => ({ ...prev, isPlaying: nextPlaying }));
            NodeSyncService.getInstance().sendCommandToMaster({
              action: nextPlaying ? 'resume' : 'pause'
            });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            AudioEngine.getInstance().resume();
            setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
          }
        }}
        onNextTrack={() => {
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({ action: 'next' });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            handleNextTrack();
          }
        }}
        onPreviousTrack={() => {
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({ action: 'previous' });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            handlePreviousTrack();
          }
        }}
        onToggleRepeat={() => {
          const nextRepeat = playerState.repeatMode === 'none' ? 'one' : 'none';
          setPlayerState(prev => ({ ...prev, repeatMode: nextRepeat }));
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({ action: 'repeat' });
            AudioEngine.getInstance().playBeep('neutral');
          }
        }}
        onToggleNonStop={() => {
          handleToggleNonStop();
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({ action: 'nonstop' });
            AudioEngine.getInstance().playBeep('neutral');
          }
        }}
        onToggleMute={() => {
          const nextMuted = !playerStateRef.current.isMuted;
          playerStateRef.current = { ...playerStateRef.current, isMuted: nextMuted };
          setPlayerState(prev => ({ ...prev, isMuted: nextMuted }));
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: nextMuted ? 'mute' : 'unmute',
              query: nextMuted ? 'silencio' : 'activar sonido',
              rawQuery: nextMuted ? 'silencio' : 'activar sonido'
            });
            AudioEngine.getInstance().playBeep(nextMuted ? 'down' : 'up');
          } else {
            AudioEngine.getInstance().playBeep(nextMuted ? 'down' : 'up');
            NodeSyncService.getInstance().broadcastMasterState(
              playerStateRef.current,
              getUpcomingQueue()
            );
          }
        }}
        onVolumeChange={(newVol) => {
          const safeVol = Math.max(0, Math.min(15, newVol));
          playerStateRef.current = { ...playerStateRef.current, volume: safeVol, isMuted: false };
          setPlayerState(prev => ({ ...prev, volume: safeVol, isMuted: false }));
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: 'volume_set',
              query: `volumen ${safeVol}`,
              rawQuery: `volumen ${safeVol}`,
              volumeValue: safeVol,
              volume: safeVol,
              value: safeVol
            });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            NodeSyncService.getInstance().broadcastMasterState(
              playerStateRef.current,
              getUpcomingQueue()
            );
          }
        }}
        onVolumeStep={(delta) => {
          const currentVol = playerStateRef.current?.volume ?? 10;
          const nextVol = Math.max(0, Math.min(15, currentVol + delta));
          playerStateRef.current = { ...playerStateRef.current, volume: nextVol, isMuted: false };
          setPlayerState(prev => ({ ...prev, volume: nextVol, isMuted: false }));
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: delta > 0 ? 'volume_up' : 'volume_down',
              query: delta > 0 ? 'subir volumen' : 'bajar volumen',
              rawQuery: delta > 0 ? 'subir volumen' : 'bajar volumen',
              volumeValue: nextVol,
              volume: nextVol,
              value: nextVol
            });
            AudioEngine.getInstance().playBeep(delta > 0 ? 'up' : 'down');
          } else {
            AudioEngine.getInstance().playBeep(delta > 0 ? 'up' : 'down');
            NodeSyncService.getInstance().broadcastMasterState(
              playerStateRef.current,
              getUpcomingQueue()
            );
          }
        }}
        onToggleListening={handleToggleListening}
        onToggleFullscreen={() => {
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({ action: 'fullscreen_toggle' });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            setIsFullscreen(!isFullscreen);
          }
        }}
        onOpenEqualizer={() => setIsEqualizerOpen(true)}
        onOpenNodeSync={() => setIsNodeSyncOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDirectSearch={(query, isArtist) => {
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: isArtist ? 'play_artist' : 'play',
              query,
              rawQuery: query,
              artist: isArtist ? query : undefined
            });
            setAssistantResponse(`Enviando al coche: "${query}"`);
            AudioEngine.getInstance().playBeep('up');
          } else {
            if (!tryAcquireTurn('busqueda_directa_ui', query)) {
              return;
            }
            handleMusicSearch(query, isArtist);
          }
        }}
        onSeek={(time) => {
          setPlayerState(prev => ({ ...prev, currentTime: time }));
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: 'seek',
              seekTime: time
            });
          } else {
            window.dispatchEvent(new CustomEvent('serchtube:seek-to', { detail: { time } }));
          }
        }}
        onToggleScreensaver={() => {
          if (nodeRole === 'satellite') {
            NodeSyncService.getInstance().sendCommandToMaster({
              action: isScreensaverActive ? 'screensaver_stop' : 'screensaver_start'
            });
            AudioEngine.getInstance().playBeep('neutral');
          } else {
            setIsScreensaverActive(prev => !prev);
          }
        }}
        onToggleWakeWord={() => {
          const nextVal = !(speechConfig.wakeWordEnabled !== false);
          setSpeechConfig(prev => {
            const next = { ...prev, wakeWordEnabled: nextVal };
            try {
              localStorage.setItem('serchtube_speech_config', JSON.stringify(next));
            } catch (e) {}
            SpeechService.getInstance().updateConfig(next);
            return next;
          });
          AudioEngine.getInstance().playBeep(nextVal ? 'up' : 'down');
        }}
        onTrackEnded={handleTrackEnded}
        onPlayerStateChange={handlePlayerStateChange}
        videoOpacity={videoOpacity}
        onVideoOpacityChange={handleVideoOpacityChange}
        satelliteCommandNotification={satelliteCommandNotification}
        autoVolumeConfig={autoVolumeConfig}
        autoShutdownConfig={autoShutdownConfig}
        onOpenAutoShutdown={() => setIsAutoShutdownModalOpen(true)}
        onAutoVolumeReduced={(vol) => setPlayerState(prev => ({ ...prev, volume: vol }))}
        isEqEnabled={eqSettings.enabled !== false}
        wakeWordInfo={{
          enabled: speechConfig.wakeWordEnabled !== false,
          wakeWord: speechConfig.wakeWord || 'música',
          isAwaitingCommand: isAwaitingCommandAfterWakeWord,
          micSource: micActivationSource || 'host'
        }}
        playlistQueue={playlistQueue}
        playlistIndex={playlistIndex}
        onSelectTrackFromQueue={handleSelectTrackFromQueue}
        onOpenGoogleHome={() => setIsGoogleHomeOpen(true)}
      />

      {/* 2. Screensaver & Sleep Mode Overlay (Only on Car / Master Host Screen) */}
      {isScreensaverActive && nodeRole !== 'satellite' && (
        <ScreensaverOverlay
          config={screensaverConfig}
          lastKnownTrack={lastKnownTrackRef.current}
          lastKnownTime={lastKnownTimeRef.current}
          onResumeMusic={handleResumeMusic}
          onDismiss={() => setIsScreensaverActive(false)}
          onUpdateConfig={handleUpdateScreensaverConfig}
        />
      )}

      {/* 3. Hardware Equalizer & DSP Modal */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        settings={eqSettings}
        autoVolumeConfig={autoVolumeConfig}
        onClose={() => setIsEqualizerOpen(false)}
        onUpdate={handleUpdateEqSettings}
        onUpdateAutoVolume={handleUpdateAutoVolume}
        onTestAutoVolume={() => window.dispatchEvent(new CustomEvent('serchtube:test-auto-volume'))}
      />

      {/* 4. Multi-Device Node Sync Modal */}
      <NodeSyncModal
        isOpen={isNodeSyncOpen}
        config={NodeSyncService.getInstance().getConfig()}
        isConnected={isWsConnected}
        connectedNodesCount={connectedNodesCount}
        onClose={() => setIsNodeSyncOpen(false)}
        onUpdateRole={(newRole, newName, newRoom) => {
          NodeSyncService.getInstance().setRole(newRole, newName, newRoom);
          setNodeRole(newRole);
        }}
      />

      {/* 5. System Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        speechConfig={speechConfig}
        screensaverConfig={screensaverConfig}
        visualConfig={visualConfig}
        videoOpacity={videoOpacity}
        playerQuality={playerState.playbackQuality || 'auto'}
        playerSpeed={playerState.playbackSpeed || 1.0}
        eqSettings={eqSettings}
        autoVolumeConfig={autoVolumeConfig}
        autoShutdownConfig={autoShutdownConfig}
        onClose={() => setIsSettingsOpen(false)}
        onOpenNodeSync={() => setIsNodeSyncOpen(true)}
        onOpenEqualizer={() => setIsEqualizerOpen(true)}
        onUpdateSpeechConfig={(updated) => {
          const newSpeech = { ...speechConfig, ...updated };
          setSpeechConfig(newSpeech);
          SpeechService.getInstance().updateConfig(newSpeech);
          try {
            localStorage.setItem('serchtube_speech_config', JSON.stringify(newSpeech));
          } catch (e) {}
        }}
        onUpdateScreensaverConfig={handleUpdateScreensaverConfig}
        onUpdateVisualConfig={handleUpdateVisualConfig}
        onUpdateVideoOpacity={handleVideoOpacityChange}
        onUpdateQuality={(q) => {
          setPlayerState(prev => ({ ...prev, playbackQuality: q }));
          try {
            localStorage.setItem('serchtube_video_quality', q);
          } catch (e) {}
        }}
        onUpdateSpeed={(spd) => {
          setPlayerState(prev => ({ ...prev, playbackSpeed: spd }));
          try {
            localStorage.setItem('serchtube_video_speed', String(spd));
          } catch (e) {}
        }}
        onUpdateEqSettings={handleUpdateEqSettings}
        onUpdateAutoVolume={handleUpdateAutoVolume}
        onUpdateAutoShutdown={handleUpdateAutoShutdown}
        onTriggerTestWarning={handleTriggerTestWarning}
        onExecuteShutdownNow={handleExecuteShutdownNow}
      />

      {/* 5b. Dedicated Quick Auto Shutdown Modal */}
      <AutoShutdownModal
        isOpen={isAutoShutdownModalOpen}
        config={autoShutdownConfig}
        onClose={() => setIsAutoShutdownModalOpen(false)}
        onUpdateConfig={handleUpdateAutoShutdown}
        onTriggerTestWarning={handleTriggerTestWarning}
        onExecuteShutdownNow={handleExecuteShutdownNow}
      />

      {/* 5c. Live Floating Countdown Warning Overlay (Pre-Shutdown Alert) */}
      <ShutdownCountdownWarning
        isOpen={shutdownWarningState.isOpen}
        remainingSeconds={shutdownWarningState.remainingSeconds}
        totalWarningSeconds={shutdownWarningState.totalWarningSeconds}
        mode={autoShutdownConfig.mode}
        targetTime={autoShutdownConfig.targetTime}
        onPostpone={handlePostponeShutdown}
        onCancel={handleCancelShutdown}
        onExecuteNow={handleExecuteShutdownNow}
      />

      {/* 6. Dynamic Keyboard Typing Capture Overlay (Appears only when user types) */}
      <KeyboardInputOverlay
        typedText={typedText}
        isSubmitting={isSubmittingText}
        onClear={() => setTypedText('')}
        onSubmit={() => {
          if (typedText.trim().length > 0) {
            const submittedQuery = typedText.trim();
            setIsSubmittingText(true);
            setLastTranscript(submittedQuery);
            handleSpokenCommand(submittedQuery).finally(() => {
              setTimeout(() => {
                setTypedText('');
                setIsSubmittingText(false);
              }, 600);
            });
          }
        }}
      />
      {/* 7. Google Home & Smart Devices Hub Modal */}
      <GoogleHomeModal
        isOpen={isGoogleHomeOpen}
        onClose={() => setIsGoogleHomeOpen(false)}
        isSatellite={nodeRole === 'satellite'}
      />
      {/* 8. Animated QR Countdown Modal (10s auto-dismiss animated popup for "música: muestra QR") */}
      <AnimatedQrCountdownModal
        isOpen={isQrCountdownModalOpen}
        durationSeconds={qrCountdownDuration}
        onClose={() => setIsQrCountdownModalOpen(false)}
        onOpenNodeSync={() => {
          setIsQrCountdownModalOpen(false);
          setIsNodeSyncOpen(true);
        }}
      />
    </div>
  );
}
