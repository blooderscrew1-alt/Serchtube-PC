import React, { useState, useEffect } from 'react';
import {
  VoicePersonality,
  ScreensaverConfig,
  ClockFont,
  ClockStyle,
  ClockFormat,
  DisplayVisualConfig,
  VideoQuality,
  EqualizerSettings,
  AutoVolumeReducerConfig,
  AutoShutdownConfig,
  AutoShutdownMode,
  WaveStyle,
  WAVE_STYLES_INFO,
  OrbStyle,
  ORB_STYLES_INFO,
  LockScreenMusicBarStyle,
  LOCKSCREEN_MUSIC_BAR_STYLES_INFO,
  CLOCK_STYLES_INFO
} from '../types';
import {
  DEFAULT_AUTO_SHUTDOWN_CONFIG,
  AUTO_SHUTDOWN_MODES_INFO,
  getMsUntilTargetTime
} from '../services/autoShutdownService';
import { SpeechConfig, SpeechService } from '../services/speechService';
import { NEURAL_VOICES, NEURAL_VOICE_GROUPS, DEFAULT_NEURAL_VOICE, isNeuralTtsSupported, getNeuralProvider, subscribeNeuralProvider } from '../services/neuralTts';
import { VIDEO_QUALITY_OPTIONS, PLAYBACK_SPEED_OPTIONS, getQualityOption } from '../utils/quality';
import { extractYouTubeId, getYouTubeWatchUrl, getYouTubeThumbnail } from '../utils/youtube';
import {
  ChevronDown,
  ChevronUp,
  X,
  Settings2,
  Mic,
  Moon,
  Volume2,
  Play,
  Type,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Sunrise,
  Sun,
  Sparkles,
  Maximize2,
  Layers,
  Activity,
  Wifi,
  Globe,
  Radio,
  VolumeX,
  RotateCcw,
  ExternalLink,
  Clipboard,
  Youtube,
  Tv,
  Gauge,
  Zap,
  ShieldCheck,
  PanelTop,
  PanelBottom,
  Power,
  Clock,
  ArrowDown,
  Music2,
  Lock,
  Calendar,
  AlertTriangle,
  QrCode,
  Copy,
  FileCode
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  speechConfig: SpeechConfig;
  screensaverConfig: ScreensaverConfig;
  visualConfig?: DisplayVisualConfig;
  videoOpacity?: number;
  playerQuality?: VideoQuality;
  playerSpeed?: number;
  eqSettings?: EqualizerSettings;
  autoVolumeConfig?: AutoVolumeReducerConfig;
  autoShutdownConfig?: AutoShutdownConfig;
  onClose: () => void;
  onOpenNodeSync?: () => void;
  onOpenEqualizer?: () => void;
  onUpdateSpeechConfig: (updated: Partial<SpeechConfig>) => void;
  onUpdateScreensaverConfig: (updated: Partial<ScreensaverConfig>) => void;
  onUpdateVisualConfig?: (updated: Partial<DisplayVisualConfig>) => void;
  onUpdateVideoOpacity?: (val: number) => void;
  onUpdateQuality?: (quality: VideoQuality) => void;
  onUpdateSpeed?: (speed: number) => void;
  onUpdateEqSettings?: (updated: Partial<EqualizerSettings>) => void;
  onUpdateAutoVolume?: (updated: Partial<AutoVolumeReducerConfig>) => void;
  onUpdateAutoShutdown?: (updated: Partial<AutoShutdownConfig>) => void;
  onTriggerTestWarning?: () => void;
  onExecuteShutdownNow?: () => void;
}

const PRESET_SHUTDOWN_TIMES = [
  { label: '22:00 (10 PM)', value: '22:00' },
  { label: '22:30', value: '22:30' },
  { label: '23:00 (11 PM)', value: '23:00' },
  { label: '23:30', value: '23:30' },
  { label: '00:00 (12 AM)', value: '00:00' },
  { label: '00:30', value: '00:30' },
  { label: '01:00 (1 AM)', value: '01:00' },
  { label: '02:00 (2 AM)', value: '02:00' }
];

const SHUTDOWN_DAYS_NAMES = [
  { day: 1, short: 'Lun', full: 'Lunes' },
  { day: 2, short: 'Mar', full: 'Martes' },
  { day: 3, short: 'Mié', full: 'Miércoles' },
  { day: 4, short: 'Jue', full: 'Jueves' },
  { day: 5, short: 'Vie', full: 'Viernes' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
  { day: 0, short: 'Dom', full: 'Domingo' }
];

const DEFAULT_DISPLAY_VISUAL_CONFIG: DisplayVisualConfig = {
  videoOpacity: 0.45,
  wavesOpacity: 0.85,
  orbOpacity: 1.0,
  orbScale: 1.0,
  showWavesAndMic: true,
  showOrbOnlyOnWakeWord: true,
  waveStyle: 'sine_harmonic',
  orbStyle: 'classic_core',
  waveScale: 1.0,
  waveHeight: 320,
  waveFullscreen: false,
  topFadeOpacity: 0.80,
  bottomFadeOpacity: 0.85,
  headerBgOpacity: 0.40,
  footerBgOpacity: 0.60,
  autoExpandOnPlay: true,
  autoFullscreenOnStartup: true,
  dataSaver: false,
  preferredQuality: 'auto'
};

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  badge?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  gradient?: string;
  borderColor?: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  summary,
  badge,
  isExpanded,
  onToggle,
  gradient = "bg-white/5",
  borderColor = "border-white/10",
  children
}) => {
  return (
    <div
      className={`rounded-2xl transition-all duration-200 border overflow-hidden ${
        isExpanded
          ? `${gradient} ${borderColor} shadow-xl ring-1 ring-white/10`
          : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors cursor-pointer group select-none"
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              isExpanded
                ? 'bg-red-600/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(220,38,38,0.25)]'
                : 'bg-white/5 text-gray-400 border border-white/10 group-hover:text-white group-hover:bg-white/10'
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                {title}
              </span>
              {badge}
            </div>
            <p className="text-[11px] text-gray-400 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-snug font-normal">
              {summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-gray-400 uppercase hidden sm:inline-block">
            {isExpanded ? 'Contraer' : 'Expandir'}
          </span>
          <div
            className={`p-1.5 rounded-lg text-gray-400 group-hover:text-white transition-all transform duration-200 ${
              isExpanded ? 'rotate-180 text-white bg-white/15' : 'rotate-0 bg-white/5'
            }`}
          >
            <ChevronDown size={15} />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-2 border-t border-white/10 space-y-4 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};

const SettingsModalComponent: React.FC<SettingsModalProps> = ({
  isOpen,
  speechConfig,
  screensaverConfig,
  visualConfig = DEFAULT_DISPLAY_VISUAL_CONFIG,
  videoOpacity = 0.45,
  playerQuality = 'auto',
  playerSpeed = 1.0,
  eqSettings = {
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
  },
  autoVolumeConfig = {
    enabled: false,
    targetVolume: 5,
    delaySeconds: 15,
    onlyIfAboveTarget: true,
    smoothFade: true,
    applyOnEveryTrack: true
  },
  autoShutdownConfig = DEFAULT_AUTO_SHUTDOWN_CONFIG,
  onClose,
  onOpenNodeSync,
  onOpenEqualizer,
  onUpdateSpeechConfig,
  onUpdateScreensaverConfig,
  onUpdateVisualConfig,
  onUpdateVideoOpacity,
  onUpdateQuality,
  onUpdateSpeed,
  onUpdateEqSettings,
  onUpdateAutoVolume,
  onUpdateAutoShutdown,
  onTriggerTestWarning,
  onExecuteShutdownNow
}) => {
  // Expandable / collapsible sections state (normally collapsed by default to save screen space)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAllSections = () => {
    setExpandedSections({
      video_quality: true,
      video_opacity: true,
      auto_shutdown: true,
      audio_input: true,
      wake_word: true,
      tts_voice: true,
      voice_personality: true,
      audio_ducking: true,
      satellite_mic_only: true,
      equalizer: true,
      auto_volume: true,
      screensaver: true,
      visual_effects: true,
      media_compatibility: true
    });
  };

  const collapseAllSections = () => {
    setExpandedSections({});
  };

  const [testingVoice, setTestingVoice] = useState<VoicePersonality | 'custom_browser' | 'neural' | null>(null);
  const [neuralProvider, setNeuralProvider] = useState<string>(getNeuralProvider());
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saving' | 'ok' | 'invalid' | 'error'>('idle');
  const [apiKeyQuota, setApiKeyQuota] = useState<boolean>(false);
  const [apiKeyInfo, setApiKeyInfo] = useState<{ configured: boolean; count: number; max: number; masked: string[] } | null>(null);

  // ─── Respaldo de claves en el navegador (localStorage) ───
  // Las claves ya persisten en el .env del PC, pero si la carpeta del proyecto se
  // re-crea (zip nuevo) o se corre desde otra ubicación, este respaldo las
  // restaura automáticamente al abrir Ajustes.
  const ELEVEN_BACKUP = 'serchtube_eleven_keys_backup';
  const GEMINI_BACKUP = 'serchtube_gemini_keys_backup';

  const classifyKeys = (text: string): { eleven: string[]; gemini: string[] } => {
    const tokens: string[] = text.match(/\b(?:sk_[A-Za-z0-9]{20,}|AQ\.[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g) || [];
    return {
      eleven: [...new Set(tokens.filter(t => t.startsWith('sk_')))],
      gemini: [...new Set(tokens.filter(t => !t.startsWith('sk_')))]
    };
  };

  const mergeBackup = (storageKey: string, incoming: string[]) => {
    if (incoming.length === 0) return;
    try {
      const current: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const merged = [...current];
      for (const k of incoming) {
        if (!merged.includes(k)) merged.push(k);
      }
      localStorage.setItem(storageKey, JSON.stringify(merged.slice(0, 10)));
    } catch (_) {}
  };

  const restoreFromBackup = async (provider: 'eleven' | 'gemini'): Promise<boolean> => {
    try {
      const storageKey = provider === 'eleven' ? ELEVEN_BACKUP : GEMINI_BACKUP;
      const backup: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (backup.length === 0) return false;
      const endpoint = provider === 'eleven' ? '/api/eleven-key' : '/api/tts-key';
      const body = provider === 'eleven' ? { keys: backup.join('\n') } : { keys: backup.join('\n') };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  };

  useEffect(() => {
    const unsub = subscribeNeuralProvider(setNeuralProvider);
    fetch('/api/tts-key')
      .then(r => r.json())
      .then(async (info) => {
        if (!info?.configured) {
          const restored = await restoreFromBackup('gemini');
          if (restored) {
            const fresh = await fetch('/api/tts-key').then(r => r.json()).catch(() => null);
            setApiKeyInfo(fresh);
            return;
          }
        }
        setApiKeyInfo(info);
      })
      .catch(() => setApiKeyInfo(null));
    return unsub;
  }, []);

  const [elevenKeyInput, setElevenKeyInput] = useState<string>('');
  const [elevenStatus, setElevenStatus] = useState<'idle' | 'saving' | 'ok' | 'invalid' | 'error'>('idle');
  const [elevenInfo, setElevenInfo] = useState<{ configured: boolean; count: number; max: number; masked: string[] } | null>(null);
  const [elevenVoices, setElevenVoices] = useState<Array<{ id: string; name: string; accent: string; gender: string }>>([]);

  useEffect(() => {
    fetch('/api/eleven-key')
      .then(r => r.json())
      .then(async (info) => {
        if (!info?.configured) {
          const restored = await restoreFromBackup('eleven');
          if (restored) {
            info = await fetch('/api/eleven-key').then(r => r.json()).catch(() => info);
          }
        }
        setElevenInfo(info);
        if (info?.configured) {
          fetch('/api/eleven-voices').then(r => r.json()).then(d => setElevenVoices(d.voices || [])).catch(() => {});
        }
      })
      .catch(() => setElevenInfo(null));
  }, []);

  const saveElevenKey = async () => {
    if (!elevenKeyInput.trim()) return;
    setElevenStatus('saving');
    try {
      const res = await fetch('/api/eleven-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: elevenKeyInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setElevenStatus('ok');
      setElevenKeyInput('');
      mergeBackup(ELEVEN_BACKUP, classifyKeys(elevenKeyInput.trim()).eleven);
      fetch('/api/eleven-key').then(r => r.json()).then(info => setElevenInfo(info)).catch(() => {});
      fetch('/api/eleven-voices').then(r => r.json()).then(d => setElevenVoices(d.voices || [])).catch(() => {});
    } catch (err: any) {
      setElevenStatus(err?.message?.includes('rechaz') ? 'invalid' : 'error');
    }
  };

  const [bulkKeysInput, setBulkKeysInput] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [bulkResult, setBulkResult] = useState<{ detected: number; ignored: number; eleven: { count: number; added: number }; gemini: { count: number; added: number } } | null>(null);

  const saveBulkKeys = async () => {
    if (!bulkKeysInput.trim()) return;
    setBulkStatus('saving');
    try {
      const res = await fetch('/api/tts-keys-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkKeysInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setBulkResult(data);
      setBulkStatus('ok');
      setBulkKeysInput('');
      const classified = classifyKeys(bulkKeysInput);
      mergeBackup(ELEVEN_BACKUP, classified.eleven);
      mergeBackup(GEMINI_BACKUP, classified.gemini);
      fetch('/api/eleven-key').then(r => r.json()).then(info => setElevenInfo(info)).catch(() => {});
      fetch('/api/tts-key').then(r => r.json()).then(info => setApiKeyInfo(info)).catch(() => {});
      fetch('/api/eleven-voices').then(r => r.json()).then(d => setElevenVoices(d.voices || [])).catch(() => {});
    } catch (_) {
      setBulkStatus('error');
    }
  };

  const saveGeminiApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setApiKeyStatus('saving');
    try {
      const res = await fetch('/api/tts-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: apiKeyInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setApiKeyStatus(data.valid ? 'ok' : 'invalid');
      setApiKeyQuota(!!data.quota);
      mergeBackup(GEMINI_BACKUP, classifyKeys(apiKeyInput.trim()).gemini);
      setApiKeyInfo({
        configured: true,
        count: data.count ?? 1,
        max: 10,
        masked: Array.from({ length: data.count ?? 1 }, (_, i) => `clave ${i + 1}`)
      });
      if (data.valid) setApiKeyInput('');
      fetch('/api/tts-key').then(r => r.json()).then(info => setApiKeyInfo(info)).catch(() => {});
    } catch (_) {
      setApiKeyStatus('error');
    }
  };
  const [customVideoInput, setCustomVideoInput] = useState<string>(screensaverConfig.customVideoUrl || '');
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [shutdownCountdown, setShutdownCountdown] = useState<string>('');
  const [slotInputs, setSlotInputs] = useState<Record<string, string>>(() => ({
    morning: screensaverConfig.timeOfDayVideos?.morning?.videoUrl || 'wA0C0u6624Q',
    afternoon: screensaverConfig.timeOfDayVideos?.afternoon?.videoUrl || 'MV_3Dpw-BRY',
    night: screensaverConfig.timeOfDayVideos?.night?.videoUrl || 'f02mOEt11OQ',
    late_night: screensaverConfig.timeOfDayVideos?.late_night?.videoUrl || 'WPni755-Krg',
  }));
  const [savedSlotFeedback, setSavedSlotFeedback] = useState<Record<string, boolean>>({});
  const [customVideoSaved, setCustomVideoSaved] = useState<boolean>(false);

  // Audio Input Devices & Mic Test state
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micTestVolume, setMicTestVolume] = useState<number>(0);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean>(false);
  const micTestStreamRef = React.useRef<MediaStream | null>(null);
  const micAudioCtxRef = React.useRef<AudioContext | null>(null);
  const micAnimFrameRef = React.useRef<number | null>(null);
  const isTestingMicRef = React.useRef<boolean>(false);
  isTestingMicRef.current = isTestingMic;

  const loadAudioInputDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioInputDevices(mics);
      const hasLabels = mics.some(m => m.label && m.label.trim().length > 0);
      setMicPermissionGranted(hasLabels);
    } catch (err) {
      console.warn("Error enumerating audio devices:", err);
    }
  };

  // Refrescar la lista de micrófonos automáticamente al conectar/desconectar uno
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) return;
    const onChange = () => loadAudioInputDevices();
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, []);

  const handleRequestMicPermissionAndRefresh = async () => {
    const res = await SpeechService.getInstance().requestMicPermission(speechConfig.audioInputDeviceId);
    if (res.granted) {
      setMicPermissionGranted(true);
      await loadAudioInputDevices();
    }
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    isTestingMicRef.current = false;
    setMicTestVolume(0);
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micTestStreamRef.current) {
      micTestStreamRef.current.getTracks().forEach(t => t.stop());
      micTestStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      try {
        micAudioCtxRef.current.close();
      } catch (_) {}
      micAudioCtxRef.current = null;
    }
  };

  const startMicTest = async (deviceId?: string) => {
    stopMicTest();
    try {
      setIsTestingMic(true);
      isTestingMicRef.current = true;
      const targetDev = deviceId !== undefined ? deviceId : speechConfig.audioInputDeviceId;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      micAudioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;

      const audioConstraints = (targetDev && targetDev !== 'default')
        ? { deviceId: { exact: targetDev } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      micTestStreamRef.current = stream;
      setMicPermissionGranted(true);
      await loadAudioInputDevices();

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!isTestingMicRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setMicTestVolume(vol);
        micAnimFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.warn("Error starting mic test:", e);
      stopMicTest();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopMicTest();
      return;
    }
    loadAudioInputDevices();
    const handleDeviceChange = () => {
      loadAudioInputDevices();
    };
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const calc = getMsUntilTargetTime(autoShutdownConfig.targetTime, autoShutdownConfig.daysOfWeek);
    setShutdownCountdown(calc.formattedRemaining);

    const interval = setInterval(() => {
      const c = getMsUntilTargetTime(autoShutdownConfig.targetTime, autoShutdownConfig.daysOfWeek);
      setShutdownCountdown(c.formattedRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoShutdownConfig.targetTime, autoShutdownConfig.daysOfWeek]);

  useEffect(() => {
    if (!isOpen) return;
    const speechService = SpeechService.getInstance();
    const unsubscribe = speechService.subscribeVoicesChanged((voices) => {
      setBrowserVoices(voices);
    });
    setBrowserVoices(speechService.getAvailableVoices());
    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  useEffect(() => {
    if (screensaverConfig.timeOfDayVideos) {
      setSlotInputs({
        morning: screensaverConfig.timeOfDayVideos.morning?.videoUrl || 'wA0C0u6624Q',
        afternoon: screensaverConfig.timeOfDayVideos.afternoon?.videoUrl || 'MV_3Dpw-BRY',
        night: screensaverConfig.timeOfDayVideos.night?.videoUrl || 'f02mOEt11OQ',
        late_night: screensaverConfig.timeOfDayVideos.late_night?.videoUrl || 'WPni755-Krg',
      });
    }
    if (screensaverConfig.customVideoUrl !== undefined) {
      setCustomVideoInput(screensaverConfig.customVideoUrl || '');
    }
  }, [screensaverConfig.timeOfDayVideos, screensaverConfig.customVideoUrl]);

  if (!isOpen) return null;

  const currentVideoOpacity = visualConfig?.videoOpacity ?? videoOpacity ?? 0.45;
  const currentWavesOpacity = visualConfig?.wavesOpacity ?? 0.85;
  const currentOrbOpacity = visualConfig?.orbOpacity ?? 1.0;
  const currentTopFade = visualConfig?.topFadeOpacity ?? 0.80;
  const currentBottomFade = visualConfig?.bottomFadeOpacity ?? 0.85;
  const currentHeaderBg = visualConfig?.headerBgOpacity ?? 0.40;
  const currentFooterBg = visualConfig?.footerBgOpacity ?? 0.60;
  const isAutoExpand = visualConfig?.autoExpandOnPlay !== false;
  const isAutoFullscreenStartup = visualConfig?.autoFullscreenOnStartup !== false;

  const handleUpdateVisual = (updates: Partial<DisplayVisualConfig>) => {
    if (onUpdateVisualConfig) {
      onUpdateVisualConfig(updates);
    }
    if (updates.videoOpacity !== undefined && onUpdateVideoOpacity) {
      onUpdateVideoOpacity(updates.videoOpacity);
    }
  };

  const personalities: { id: VoicePersonality; title: string; desc: string; samplePhrase: string; style: string }[] = [
    {
      id: 'animada',
      title: 'Alegre, Fiestera & Graciosa',
      desc: 'Súper entusiasta, cariñosa, divertida y con chispa cómica. ¡La mejor vibra en cabina!',
      samplePhrase: '¡Oído cocina, jefe! ¡Marchando temazo con todo el ritmo para alegrar el día!',
      style: 'Pura Alegría y Humor'
    },
    {
      id: 'directa',
      title: 'Directa y Enérgica',
      desc: 'Ágil y resolutiva con chispa positiva ("¡Oído! Poniéndote temazo a todo dar").',
      samplePhrase: '¡Oído! Marchando la canción con toda la energía.',
      style: 'Ágil y Positiva'
    },
    {
      id: 'conductor',
      title: 'Conducción Asistida',
      desc: 'Optimizada para carretera: ágil, clara y con máxima inteligibilidad sonora.',
      samplePhrase: 'Ruta despejada, reproduciendo lista de carretera sin distracciones.',
      style: 'Alta claridad'
    },
    {
      id: 'jarvis',
      title: 'JARVIS Cockpit AI',
      desc: 'Sintética, futurista y técnica con tono calmado de asistente de a bordo.',
      samplePhrase: 'Sistemas acústicos en línea. Protocolos de audio optimizados, señor.',
      style: 'Tecnológica / IA'
    },
    {
      id: 'copiloto_rally',
      title: 'Copiloto de Rally',
      desc: 'Energética, rápida y dinámica para viajes en carretera y curvas rápidas.',
      samplePhrase: '¡Curva a fondo y gas! ¡Ponemos temazo a todo volumen!',
      style: 'Enérgica & Rápida'
    },
    {
      id: 'locutor_fm',
      title: 'Locutor de Radio FM',
      desc: 'Entusiasta, cálida y con cadencia de estación de radio en directo.',
      samplePhrase: '¡Estás en sintonía con SerchTube Music, sonando los grandes éxitos!',
      style: 'Emisora FM'
    },
    {
      id: 'calida',
      title: 'Cálida y Acompañante',
      desc: 'Amable, cercana y reconfortante para trayectos largos y viajes en solitario.',
      samplePhrase: 'Con mucho gusto, aquí tienes tus canciones favoritas para el camino.',
      style: 'Amigable'
    },
    {
      id: 'cyberpunk',
      title: 'Cyberpunk Synth',
      desc: 'Cadencia grave y resonante inspirada en terminales de ciencia ficción retrofuturista.',
      samplePhrase: 'Transmisión establecida en red neural. Canales de audio acoplados.',
      style: 'Sci-Fi Sintético'
    },
    {
      id: 'formal',
      title: 'Formal & Cortés',
      desc: 'Educada y detallada ("Con gusto, reproduciendo éxitos de Queen").',
      samplePhrase: 'Procedo con la reproducción solicitada. Que tenga un trayecto placentero.',
      style: 'Educada'
    },
    {
      id: 'zen',
      title: 'Zen & Relajación',
      desc: 'Tono suave, sereno y pausado a baja cadencia para momentos de descanso.',
      samplePhrase: 'Sonido en reposo. Respira hondo y disfruta de la serenidad.',
      style: 'Meditativa'
    }
  ];

  const handleTestVoice = (p: typeof personalities[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingVoice(p.id);

    // Temporarily update personality and speak sample
    const speechService = SpeechService.getInstance();
    speechService.updateConfig({ ...speechConfig, personality: p.id });
    speechService.speak(p.samplePhrase);

    setTimeout(() => {
      setTestingVoice(null);
    }, 2800);
  };

  const saveSlotVideo = (slotKey: 'morning' | 'afternoon' | 'night' | 'late_night', label: string, explicitValue?: string) => {
    const raw = explicitValue !== undefined ? explicitValue : (slotInputs[slotKey] || '');
    const cleanId = extractYouTubeId(raw);
    const finalId = cleanId || raw.trim();

    if (finalId) {
      const updatedVideos = {
        ...screensaverConfig.timeOfDayVideos,
        [slotKey]: {
          videoUrl: finalId,
          name: label
        }
      };
      onUpdateScreensaverConfig({ timeOfDayVideos: updatedVideos });
      setSlotInputs(prev => ({ ...prev, [slotKey]: finalId }));
      setSavedSlotFeedback(prev => ({ ...prev, [slotKey]: true }));
      setTimeout(() => {
        setSavedSlotFeedback(prev => ({ ...prev, [slotKey]: false }));
      }, 2200);
    }
  };

  const handlePasteSlotClipboard = async (slotKey: 'morning' | 'afternoon' | 'night' | 'late_night', label: string) => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const cleanId = extractYouTubeId(text.trim());
          const finalId = cleanId || text.trim();
          saveSlotVideo(slotKey, label, finalId);
        }
      }
    } catch (e) {
      console.warn("Clipboard read error:", e);
    }
  };

  const handleResetSlotVideo = (slotKey: 'morning' | 'afternoon' | 'night' | 'late_night', defaultId: string, label: string) => {
    saveSlotVideo(slotKey, label, defaultId);
  };

  const handleApplyCustomVideo = () => {
    const cleanId = extractYouTubeId(customVideoInput.trim());
    const finalId = cleanId || customVideoInput.trim();
    if (finalId) {
      onUpdateScreensaverConfig({ customVideoUrl: finalId });
      setCustomVideoInput(finalId);
      setCustomVideoSaved(true);
      setTimeout(() => setCustomVideoSaved(false), 2200);
    }
  };

  const showClock = screensaverConfig.showClock !== false;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-black/95 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center border border-red-500/30 shadow-md">
              <Settings2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase">Ajustes del Sistema</h2>
              <p className="text-xs text-gray-400">Pestañas contraíbles para ahorrar espacio • Clic para expandir cada sección</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={Object.values(expandedSections).some(Boolean) ? collapseAllSections : expandAllSections}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title={Object.values(expandedSections).some(Boolean) ? "Contraer todas las herramientas" : "Expandir todas las herramientas"}
            >
              {Object.values(expandedSections).some(Boolean) ? (
                <>
                  <ChevronUp size={13} className="text-amber-400" />
                  <span>Contraer todo</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} className="text-red-400" />
                  <span>Expandir todo</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Calidad y Resolución de Reproducción de Video */}
          <CollapsibleSection
            id="video_quality"
            title="Calidad y Resolución de Video"
            icon={<Tv size={16} />}
            summary={`Resolución: ${getQualityOption(playerQuality).label} (${getQualityOption(playerQuality).resolution}) • Velocidad: ${playerSpeed}x • ${visualConfig?.dataSaver ? 'Ahorro Datos Activo' : 'Calidad Estándar'}`}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                  {getQualityOption(playerQuality).badge || getQualityOption(playerQuality).shortLabel}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                  {playerSpeed}x
                </span>
              </div>
            }
            isExpanded={!!expandedSections['video_quality']}
            onToggle={() => toggleSection('video_quality')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-white/5"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Selecciona la resolución objetivo de streaming del reproductor de YouTube.
              </p>

              {/* Data Saver Mode Quick Switch */}
              <button
                type="button"
                onClick={() => {
                  const isDataSaver = visualConfig?.dataSaver !== true;
                  handleUpdateVisual({ dataSaver: isDataSaver });
                  if (isDataSaver) {
                    onUpdateQuality?.('small');
                  } else {
                    onUpdateQuality?.('auto');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${
                  visualConfig?.dataSaver
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title="Modo ahorro de datos (fuerza 240p para ahorrar batería y megas)"
              >
                <Zap size={13} className={visualConfig?.dataSaver ? 'text-amber-400' : 'text-gray-500'} />
                <span>{visualConfig?.dataSaver ? 'Ahorro Activo' : 'Ahorro Datos'}</span>
              </button>
            </div>

            {/* Quality Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {VIDEO_QUALITY_OPTIONS.map((opt) => {
                const isSelected = playerQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onUpdateQuality?.(opt.id);
                      handleUpdateVisual({ preferredQuality: opt.id });
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-600/20 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isSelected
                            ? 'bg-red-600 text-white'
                            : opt.isHD
                            ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                            : 'bg-white/10 text-gray-400'
                        }`}
                      >
                        {opt.badge || opt.shortLabel}
                      </span>
                      {isSelected && <Check size={13} className="text-red-400" />}
                    </div>
                    <div className="text-xs font-semibold truncate text-white">{opt.shortLabel}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">{opt.resolution}</div>
                  </button>
                );
              })}
            </div>

            {/* Playback Speed Slider / Selector */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge size={15} className="text-blue-400" />
                <span className="text-xs font-medium text-gray-300">Velocidad de Reproducción:</span>
                <span className="text-xs font-mono font-bold text-blue-400">{playerSpeed}x</span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {PLAYBACK_SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd.value}
                    type="button"
                    onClick={() => onUpdateSpeed?.(spd.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                      playerSpeed === spd.value
                        ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {spd.value}x
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 2: Video Behind Waves Transparency Slider */}
          <CollapsibleSection
            id="video_opacity"
            title="Transparencia del Video tras las Ondas"
            icon={<Sliders size={16} />}
            summary={`Opacidad del video de YouTube detrás de las ondas: ${Math.round(videoOpacity * 100)}%`}
            badge={
              <span className="text-xs font-mono font-bold text-red-400 bg-red-600/10 px-2 py-0.5 rounded border border-red-600/20">
                {Math.round(videoOpacity * 100)}%
              </span>
            }
            isExpanded={!!expandedSections['video_opacity']}
            onToggle={() => toggleSection('video_opacity')}
          >
            <p className="text-xs text-gray-400">
              Controla la opacidad del video de YouTube que se reproduce detrás de la animación de ondas.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 font-mono">10%</span>
              <input
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={videoOpacity}
                onChange={(e) => onUpdateVideoOpacity?.(parseFloat(e.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
              <span className="text-[11px] text-gray-400 font-mono">100%</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400 font-mono uppercase">Presets rápidos:</span>
              {[0.2, 0.35, 0.5, 0.75, 1.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdateVideoOpacity?.(val)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    Math.abs(videoOpacity - val) < 0.04
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {Math.round(val * 100)}%
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Section: Auto-Apagado de PC a una Hora Específica */}
          <CollapsibleSection
            id="auto_shutdown"
            title="Auto-Apagado de PC Programado"
            icon={<Power size={16} />}
            summary={
              autoShutdownConfig.enabled
                ? `Apagado a las ${autoShutdownConfig.targetTime} • ${AUTO_SHUTDOWN_MODES_INFO[autoShutdownConfig.mode]?.name || autoShutdownConfig.mode} • ${autoShutdownConfig.daysOfWeek?.length === 7 ? 'Todos los días' : `${autoShutdownConfig.daysOfWeek?.length || 0} días/sem`}`
                : "Programa el apagado, hibernación o suspensión automática a una hora fija con aviso previo"
            }
            badge={
              autoShutdownConfig.enabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-bold">
                  ACTIVO ({autoShutdownConfig.targetTime})
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADO
                </span>
              )
            }
            isExpanded={!!expandedSections['auto_shutdown']}
            onToggle={() => toggleSection('auto_shutdown')}
            gradient="bg-gradient-to-br from-red-950/25 via-black to-black"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Interruptor de Auto-Apagado</span>
                <span className="text-[11px] text-gray-400">Activa o desactiva la cuenta regresiva para apagar el sistema</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAutoShutdown?.({ enabled: !autoShutdownConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ml-3 ${
                  autoShutdownConfig.enabled ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoShutdownConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* If enabled or configured: Details, Pickers and Controls */}
            {autoShutdownConfig.enabled && (
              <div className="space-y-4 pt-2 border-t border-white/10 animate-fadeIn">
                {/* Live Countdown & Hour Picker */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                      <Clock size={14} className="text-red-400" />
                      Hora Exacta de Apagado:
                    </span>
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                      ⏳ Faltan: {shutdownCountdown || 'calculando...'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={autoShutdownConfig.targetTime || '23:30'}
                      onChange={(e) => onUpdateAutoShutdown?.({ targetTime: e.target.value })}
                      className="bg-black/90 border-2 border-red-500/50 rounded-xl px-3.5 py-1.5 text-xl font-mono font-bold text-white focus:outline-none focus:border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.2)] cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">
                      Se ejecutará puntualmente según el reloj de tu sistema operativo.
                    </span>
                  </div>

                  {/* Preset chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-gray-400 font-mono uppercase">Horas comunes:</span>
                    {PRESET_SHUTDOWN_TIMES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => onUpdateAutoShutdown?.({ targetTime: p.value })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                          autoShutdownConfig.targetTime === p.value
                            ? 'bg-red-600 text-white border-red-500 font-bold shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {p.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="space-y-2">
                  <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                    <Sparkles size={14} className="text-red-400" />
                    Acción a Ejecutar al Llegar la Hora:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AUTO_SHUTDOWN_MODES_INFO.map((m) => {
                      const isSelected = autoShutdownConfig.mode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onUpdateAutoShutdown?.({ mode: m.id })}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-950/40 border-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.25)]'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white">{m.name}</span>
                            {isSelected && <Check size={13} className="text-red-400" />}
                          </div>
                          <span className="text-[10px] text-gray-400">{m.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Days of week */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                      <Calendar size={14} className="text-red-400" />
                      Días Activos:
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <button
                        type="button"
                        onClick={() => onUpdateAutoShutdown?.({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}
                        className="hover:text-white underline cursor-pointer"
                      >
                        Todos
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => onUpdateAutoShutdown?.({ daysOfWeek: [1, 2, 3, 4, 5] })}
                        className="hover:text-white underline cursor-pointer"
                      >
                        Lun-Vie
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    {SHUTDOWN_DAYS_NAMES.map((d) => {
                      const isSel = (autoShutdownConfig.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => {
                            const cur = autoShutdownConfig.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
                            const next = cur.includes(d.day)
                              ? (cur.length > 1 ? cur.filter(x => x !== d.day) : cur)
                              : [...cur, d.day].sort();
                            onUpdateAutoShutdown?.({ daysOfWeek: next });
                          }}
                          className={`flex-1 min-w-[38px] py-1.5 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer ${
                            isSel
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Warning & voice options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Aviso flotante previo:</div>
                      <div className="text-[10px] text-gray-400">Cuenta atrás con botones de posponer</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onUpdateAutoShutdown?.({ warningMinutesBefore: m })}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                            autoShutdownConfig.warningMinutesBefore === m
                              ? 'bg-amber-600 text-white border-amber-500 font-bold'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Atenuar audio suave:</div>
                      <div className="text-[10px] text-gray-400">Baja volumen 60s antes</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateAutoShutdown?.({ fadeVolumeBeforeShutdown: !(autoShutdownConfig.fadeVolumeBeforeShutdown !== false) })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        autoShutdownConfig.fadeVolumeBeforeShutdown !== false ? 'bg-amber-600' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          autoShutdownConfig.fadeVolumeBeforeShutdown !== false ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Test & Execute actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {onTriggerTestWarning && (
                    <button
                      type="button"
                      onClick={onTriggerTestWarning}
                      className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Play size={12} />
                      <span>Probar Aviso Flotante (15s)</span>
                    </button>
                  )}

                  {onExecuteShutdownNow && (
                    <button
                      type="button"
                      onClick={onExecuteShutdownNow}
                      className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Power size={12} />
                      <span>Apagar PC Ahora</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Section: Selección de Micrófono de Entrada (Hardware) */}
          <CollapsibleSection
            id="audio_input"
            title="Micrófono de Entrada (Hardware)"
            icon={<Mic size={16} />}
            summary={
              `${audioInputDevices.find(d => d.deviceId === speechConfig.audioInputDeviceId)?.label || 'Micrófono por defecto del sistema'} • Vúmetro en tiempo real y selector`
            }
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
                {audioInputDevices.length > 0 ? `${audioInputDevices.length} detectados` : 'Por defecto'}
              </span>
            }
            isExpanded={!!expandedSections['audio_input']}
            onToggle={() => toggleSection('audio_input')}
            gradient="bg-gradient-to-br from-red-950/30 via-black to-neutral-900/40"
            borderColor="border-red-500/30"
          >

            {/* Selector dropdown */}
            <div className="space-y-2">
              <label className="text-xs text-gray-300 font-medium flex items-center justify-between">
                <span>Dispositivo de Captura de Audio:</span>
                <button
                  type="button"
                  onClick={loadAudioInputDevices}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Refrescar lista de dispositivos de micrófono"
                >
                  <RotateCcw size={11} />
                  <span>Refrescar</span>
                </button>
              </label>

              <div className="relative">
                <select
                  value={speechConfig.audioInputDeviceId || 'default'}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    onUpdateSpeechConfig({ audioInputDeviceId: chosen });
                    if (isTestingMic) {
                      startMicTest(chosen);
                    }
                  }}
                  className="w-full bg-black/80 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-red-500 focus:outline-none font-medium appearance-none cursor-pointer"
                >
                  <option value="default" className="bg-neutral-900 text-white">
                    🎙️ Micrófono por defecto del sistema
                  </option>
                  {audioInputDevices.map((dev, idx) => {
                    const label = dev.label || `Micrófono ${idx + 1} (${dev.deviceId ? dev.deviceId.slice(0, 8) : 'Hardware'}...)`;
                    return (
                      <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-neutral-900 text-white">
                        🎙️ {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Aviso honesto: la Web Speech API del navegador siempre escucha el micrófono
                  predeterminado de Windows, elija lo que elija este selector */}
              {(speechConfig.audioInputDeviceId && speechConfig.audioInputDeviceId !== 'default') && (
                <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/30 text-[11px] text-sky-200 animate-fadeIn">
                  <span className="font-bold block mb-0.5">ℹ️ Cómo escucha de verdad el asistente</span>
                  El motor de voz del navegador siempre escucha el <b>micrófono predeterminado de Windows</b> (limitación del navegador, no de SerchTube).
                  {' '}Este selector solo cambia el dispositivo del <b>vúmetro y las pruebas</b>: para que el asistente use otro micrófono, dejalo como predeterminado en Windows (Configuración → Sistema → Sonido → Entrada).
                </div>
              )}

              {!micPermissionGranted && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300 animate-fadeIn">
                  <span>Concede permiso al navegador para ver las etiquetas y marcas completas de tus micrófonos.</span>
                  <button
                    type="button"
                    onClick={handleRequestMicPermissionAndRefresh}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition-colors cursor-pointer shrink-0 ml-2"
                  >
                    Permitir Nombres
                  </button>
                </div>
              )}
            </div>

            {/* Live VU Meter & Audio Test */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                  <Activity size={13} className={isTestingMic ? "text-emerald-400 animate-pulse" : "text-gray-400"} />
                  <span>Prueba de Nivel en Tiempo Real (VUMeter)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isTestingMic) {
                      stopMicTest();
                    } else {
                      startMicTest();
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isTestingMic
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  {isTestingMic ? (
                    <>
                      <VolumeX size={12} />
                      <span>Detener Prueba</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} />
                      <span>Probar Micrófono</span>
                    </>
                  )}
                </button>
              </div>

              {/* VU Meter Visual Bar */}
              <div className="space-y-1.5">
                <div className="h-3.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5 flex items-center">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      micTestVolume > 70
                        ? 'bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500'
                        : micTestVolume > 30
                        ? 'bg-gradient-to-r from-emerald-500 to-yellow-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${isTestingMic ? Math.max(4, micTestVolume) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                  <span>{isTestingMic ? (micTestVolume > 15 ? '🟢 Voz detectada' : '⚪ Silencio / Esperando voz...') : 'Prueba inactiva (pulsa Probar Micrófono para verificar)'}</span>
                  <span>{isTestingMic ? `${micTestVolume}% nivel` : '0%'}</span>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section: Palabra Maestra de Activación (Wake Word) */}
          <CollapsibleSection
            id="wake_word"
            title="Palabra Clave de Activación (Wake Word)"
            icon={<Radio size={16} />}
            summary={
              speechConfig.wakeWordEnabled !== false
                ? `Palabra clave: "${speechConfig.wakeWord || 'música'}" • Enfoque AGC/AEC: ${speechConfig.micFocusBoost !== false ? 'ON' : 'OFF'} • Inmunidad anti-eco activa`
                : "Escucha manos libres desactivada (solo comandos manuales o por pulsación)"
            }
            badge={
              speechConfig.wakeWordEnabled !== false ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-bold">
                  ACTIVA: "{speechConfig.wakeWord || 'música'}"
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADA
                </span>
              )
            }
            isExpanded={!!expandedSections['wake_word']}
            onToggle={() => toggleSection('wake_word')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-black"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Escucha Continua con Palabra Clave</span>
                <span className="text-[11px] text-gray-400 block">
                  La web solo procesará comandos cuando pronuncies la palabra de activación (ej: "música").
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ wakeWordEnabled: !(speechConfig.wakeWordEnabled !== false) })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                  speechConfig.wakeWordEnabled !== false ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.wakeWordEnabled !== false ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {speechConfig.wakeWordEnabled !== false && (
              <div className="space-y-3 pt-2 border-t border-white/10 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-medium flex items-center justify-between">
                    <span>Palabra Clave Personalizada:</span>
                    <span className="text-[10px] text-gray-400 font-mono">Sensible a la voz</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={speechConfig.wakeWord || 'música'}
                      onChange={(e) => onUpdateSpeechConfig({ wakeWord: e.target.value })}
                      placeholder="Ejemplo: música, serchtube, oye música"
                      className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-red-500 focus:outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Preset Quick Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-400 font-medium">Sugerencias rápidas:</span>
                  {['música', 'serchtube', 'oye música', 'hey música', 'computadora'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onUpdateSpeechConfig({ wakeWord: preset })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                        (speechConfig.wakeWord || 'música').toLowerCase() === preset
                          ? 'bg-red-600 text-white border-red-500 font-bold shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>

                {/* Examples & Help */}
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] text-gray-300 space-y-1">
                  <div className="font-semibold text-red-400 flex items-center gap-1.5">
                    <Sparkles size={12} />
                    <span>Ejemplos de uso directo:</span>
                  </div>
                  <ul className="list-disc list-inside text-gray-400 space-y-0.5 pl-1">
                    <li><code className="text-white">&ldquo;{speechConfig.wakeWord || 'música'}, reproduce Mana&rdquo;</code> (Comando directo)</li>
                    <li><code className="text-white">&ldquo;reproduce Coldplay&rdquo;</code> o <code className="text-white">&ldquo;pon Soda Stereo&rdquo;</code> (Detección natural sin gritar)</li>
                    <li><code className="text-white">&ldquo;{speechConfig.wakeWord || 'música'}, siguiente canción&rdquo;</code> (Control de reproductor)</li>
                    <li><code className="text-white">&ldquo;{speechConfig.wakeWord || 'música'}&rdquo;</code> (El asistente atenuará la música y escuchará tu orden durante 5 segundos)</li>
                  </ul>
                </div>

                {/* Section: Enfoque de Micrófono Local y Ganancia Automática (AGC + AEC) */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                      <Zap size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Enfoque de Micrófono y Ganancia Automática (AGC)</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 font-bold">
                          Sin Gritar
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Amplifica la voz suave a distancia y activa cancelación acústica para no tener que gritarle al micrófono de la PC.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSpeechConfig({ micFocusBoost: !(speechConfig.micFocusBoost !== false) })}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      speechConfig.micFocusBoost !== false ? 'bg-red-600' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        speechConfig.micFocusBoost !== false ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Notice: Inmunidad Acústica tras Poner Canción */}
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    <strong>Protección Anti-Eco Activa:</strong> Al iniciar una canción, el micrófono ignora los primeros 4.5s de audio para evitar que los altavoces de la PC o la letra de la música cambien de pista accidentalmente.
                  </span>
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Section 2: Browser & Edge "Leer en voz alta" Voice Engine */}
          <CollapsibleSection
            id="tts_voice"
            title="Voz del Asistente y Lectura Natural"
            icon={<Volume2 size={16} />}
            summary={`Prioridad: ${(speechConfig.voicePriority && speechConfig.voicePriority.length ? speechConfig.voicePriority : ['elevenlabs', 'gemini', 'edge']).map(e => e === 'elevenlabs' ? 'ElevenLabs' : e === 'gemini' ? 'Gemini' : 'Edge').join(' → ')} • Velocidad: ${speechConfig.speechRate}x • Volumen: ${Math.round((speechConfig.speechVolume ?? 1) * 100)}%`}
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono border bg-violet-500/20 text-violet-300 border-violet-500/30">
                🥇{(speechConfig.voicePriority && speechConfig.voicePriority.length ? speechConfig.voicePriority : ['elevenlabs', 'gemini', 'edge'])[0]?.toUpperCase() || '—'} • {speechConfig.speechRate}x
              </span>
            }
            isExpanded={!!expandedSections['tts_voice']}
            onToggle={() => toggleSection('tts_voice')}
            gradient="bg-gradient-to-br from-white/5 to-white/[0.02]"
            borderColor="border-white/10"
          >

            {/* Orden de prioridad de voces: 1º, 2º y 3º motor con su voz */}
            {(() => {
              const ENGINE_LABELS: Record<string, string> = {
                elevenlabs: '🎙️ ElevenLabs',
                gemini: '🧠 Gemini (Google IA)',
                edge: '🖥️ Voces Edge (navegador)'
              };
              const priority = speechConfig.voicePriority && speechConfig.voicePriority.length
                ? speechConfig.voicePriority
                : ['elevenlabs', 'gemini', 'edge'];
              const setSlot = (slotIdx: number, value: string) => {
                const next = [...priority];
                if (value === 'none') {
                  next.splice(slotIdx, 1);
                } else {
                  const prevIdx = next.indexOf(value as any);
                  if (prevIdx !== -1) {
                    // Intercambiar posiciones si ese motor ya estaba en otro puesto
                    next[prevIdx] = next[slotIdx];
                  }
                  next[slotIdx] = value as any;
                }
                onUpdateSpeechConfig({ voicePriority: next.filter(Boolean) as any });
              };

              return (
                <div className="space-y-2 p-3 rounded-xl bg-violet-500/[0.06] border border-violet-500/25">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-violet-200 font-semibold">Orden de prioridad de voces</label>
                    <span className="text-[10px] text-gray-400 font-mono">1º intenta → si falla, baja al siguiente</span>
                  </div>

                  {[0, 1, 2].map(slot => {
                    const current = priority[slot] || 'none';
                    const medal = ['🥇 1er lugar', '🥈 2do lugar', '🥉 3er lugar'][slot];
                    return (
                      <div key={slot} className="space-y-1.5 p-2.5 rounded-lg bg-black/40 border border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white w-24 shrink-0">{medal}</span>
                          <select
                            value={current}
                            onChange={(e) => setSlot(slot, e.target.value)}
                            className="flex-1 bg-black/80 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none cursor-pointer"
                          >
                            {slot === 0 ? null : <option value="none">— Ninguno —</option>}
                            {Object.entries(ENGINE_LABELS).map(([id, label]) => (
                              <option key={id} value={id}>{label}</option>
                            ))}
                          </select>
                          {current !== 'none' && (
                            <button
                              type="button"
                              title={`Probar solo este motor (${ENGINE_LABELS[current]})`}
                              onClick={() => {
                                setTestingVoice('neural');
                                const speechService = SpeechService.getInstance();
                                speechService.updateConfig(speechConfig);
                                speechService.speak("Hola, así suena este motor de voz.", current as any);
                                setTimeout(() => setTestingVoice(null), 8000);
                              }}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all flex-shrink-0 cursor-pointer ${
                                testingVoice === 'neural'
                                  ? 'bg-violet-600 text-white animate-pulse'
                                  : 'bg-violet-600/25 hover:bg-violet-600/50 text-violet-100 border border-violet-500/40'
                              }`}
                            >
                              <Volume2 size={11} />
                              <span>Probar</span>
                            </button>
                          )}
                        </div>

                        {/* Voz específica del motor elegido en este puesto */}
                        {current === 'elevenlabs' && (
                          elevenVoices.length > 0 ? (
                            <select
                              value={speechConfig.elevenVoice || ''}
                              onChange={(e) => onUpdateSpeechConfig({ elevenVoice: e.target.value || undefined })}
                              className="w-full bg-black/80 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-amber-100 focus:border-amber-500 focus:outline-none cursor-pointer truncate"
                            >
                              <option value="">— Elige la voz de ElevenLabs —</option>
                              {elevenVoices.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name} {v.accent ? `(${v.accent})` : ''}{v.category && v.category !== 'premade' ? ' ★' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[10px] text-amber-300 px-1">⚠ Guarda tu clave de ElevenLabs abajo para ver sus voces.</p>
                          )
                        )}
                        {current === 'gemini' && (
                          <select
                            value={speechConfig.neuralVoice || DEFAULT_NEURAL_VOICE}
                            onChange={(e) => onUpdateSpeechConfig({ neuralVoice: e.target.value })}
                            className="w-full bg-black/80 border border-violet-500/30 rounded-lg px-2.5 py-1.5 text-xs text-violet-100 focus:border-violet-500 focus:outline-none cursor-pointer truncate"
                          >
                            {NEURAL_VOICE_GROUPS.map(group => (
                              <optgroup key={group.label} label={group.label}>
                                {group.voices.map(v => (
                                  <option key={v.id} value={v.id}>
                                    {v.gender === 'H' ? '♂' : '♀'} {v.name} — {v.description}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}
                        {current === 'edge' && (
                          <select
                            value={speechConfig.voiceURI || 'auto'}
                            onChange={(e) => onUpdateSpeechConfig({ voiceURI: e.target.value })}
                            className="w-full bg-black/80 border border-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs text-blue-100 focus:border-blue-500 focus:outline-none cursor-pointer truncate"
                          >
                            <option value="auto">⭐ Automático: mejor voz Natural de Edge</option>
                            {browserVoices.filter(v => (v.lang.startsWith('es') || /spanish/i.test(v.name))).map(v => (
                              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setTestingVoice('neural');
                      const speechService = SpeechService.getInstance();
                      speechService.updateConfig({ ...speechConfig, ttsEngine: 'neural' });
                      speechService.speak("Hola, así suena mi voz con el orden de prioridad que elegiste. Listo para reproducir tus canciones.");
                      setTimeout(() => setTestingVoice(null), 8000);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-violet-600/25 hover:bg-violet-600/50 text-violet-100 border border-violet-500/40"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>▶ Probar cadena completa</span>
                  </button>

                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    El asistente intenta hablar con el <strong className="text-gray-300">1er lugar</strong>; si ese motor no tiene cuota, clave inválida o falla, baja automáticamente al <strong className="text-gray-300">2do</strong> y luego al <strong className="text-gray-300">3er</strong>. Las voces Edge son las naturales del navegador (requieren Microsoft Edge).
                  </p>
                </div>
              );
            })()}

            {/* ElevenLabs: gestión de claves (las voces se eligen en el orden de prioridad) */}
                <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25">
                  <label className="text-xs text-gray-300 font-medium flex items-center justify-between">
                    <span>🎙️ Claves de ElevenLabs (para el puesto que le asignes arriba):</span>
                    {elevenInfo && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                        elevenInfo.configured
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                      }`}>
                        {elevenInfo.configured ? `✓ ${elevenInfo.count} clave${elevenInfo.count !== 1 ? 's' : ''} guardada${elevenInfo.count !== 1 ? 's' : ''}` : 'sin clave'}
                      </span>
                    )}
                  </label>

                  <div className="flex items-start gap-2">
                    <textarea
                      value={elevenKeyInput}
                      onChange={(e) => { setElevenKeyInput(e.target.value); setElevenStatus('idle'); }}
                      placeholder="Añadir claves sk_... (separadas por coma o salto de línea; reemplaza las actuales)"
                      rows={2}
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none placeholder:text-gray-500 placeholder:font-sans resize-none"
                    />
                    <button
                      type="button"
                      onClick={saveElevenKey}
                      disabled={!elevenKeyInput.trim() || elevenStatus === 'saving'}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        elevenStatus === 'ok'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600/25 hover:bg-amber-600/50 text-amber-100 border border-amber-500/40'
                      }`}
                    >
                      <Check size={12} />
                      <span>{elevenStatus === 'saving' ? 'Validando...' : elevenStatus === 'ok' ? 'Guardadas' : 'Guardar'}</span>
                    </button>
                  </div>

                  {elevenStatus === 'ok' && (
                    <p className="text-[10px] text-emerald-300">✓ Claves guardadas. La primera fue validada contra ElevenLabs. Cuando una clave agote sus caracteres, la app rota sola a la siguiente.</p>
                  )}
                  {elevenStatus === 'invalid' && (
                    <p className="text-[10px] text-amber-300">⚠ ElevenLabs rechazó la primera clave. Debe empezar por sk_ y estar activa (revísala en elevenlabs.io → API Keys).</p>
                  )}
                  {elevenStatus === 'error' && (
                    <p className="text-[10px] text-red-300">✗ No se pudo contactar al servidor para guardar las claves.</p>
                  )}

                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Cuentas gratis en <strong className="text-gray-300">elevenlabs.io</strong>: ~10.000 caracteres/mes por cuenta. Con varias claves la app rota sola y multiplica tus respuestas (hasta 10 claves). Cuando todas se agoten, cae a Gemini y luego a las voces del navegador.
                  </p>
                </div>

                {/* Carga en lote: auto-detecta el proveedor de cada clave */}
                <div className="space-y-1.5 p-3 rounded-xl bg-sky-500/[0.06] border border-sky-500/25">
                  <label className="text-xs text-sky-200 font-medium flex items-center justify-between">
                    <span>📝 Añadir claves en lote (auto-detecta el proveedor):</span>
                  </label>
                  <div className="flex items-start gap-2">
                    <textarea
                      value={bulkKeysInput}
                      onChange={(e) => { setBulkKeysInput(e.target.value); setBulkStatus('idle'); }}
                      placeholder={'Pega aquí todo el texto tal cual, con nombres y etiquetas incluidos. Ej:\nelevenlabs cuenta1\nsk_73f16b...\ngemini cuenta2\nAQ.Ab8RN6...\n\nLa app detecta cada clave por su formato: sk_ → ElevenLabs, AQ./AIza → Gemini'}
                      rows={5}
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none placeholder:text-gray-500 placeholder:font-sans resize-y"
                    />
                    <button
                      type="button"
                      onClick={saveBulkKeys}
                      disabled={!bulkKeysInput.trim() || bulkStatus === 'saving'}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        bulkStatus === 'ok'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-sky-600/25 hover:bg-sky-600/50 text-sky-100 border border-sky-500/40'
                      }`}
                    >
                      <Check size={12} />
                      <span>{bulkStatus === 'saving' ? 'Procesando...' : bulkStatus === 'ok' ? 'Añadidas' : 'Agregar en lote'}</span>
                    </button>
                  </div>

                  {bulkStatus === 'ok' && bulkResult && (
                    <p className="text-[10px] text-emerald-300">
                      ✓ Detectadas {bulkResult.detected} claves: <strong>{bulkResult.eleven.added}</strong> nuevas de ElevenLabs (total {bulkResult.eleven.count}) y <strong>{bulkResult.gemini.added}</strong> nuevas de Gemini (total {bulkResult.gemini.count}).{bulkResult.ignored > 0 ? ` ${bulkResult.ignored} duplicadas omitidas.` : ''}
                    </p>
                  )}
                  {bulkStatus === 'error' && (
                    <p className="text-[10px] text-red-300">✗ No se pudo procesar el texto. ¿La app está corriendo con su servidor?</p>
                  )}

                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    No importa el formato: pega el bloque completo con nombres de cuentas, líneas vacías o separadores. La app extrae solo las claves válidas por su patrón y las añade a cada proveedor (máx. 10 por proveedor, sin duplicados). Las claves se validan solas al usarse.
                  </p>
                </div>

                {/* Claves de API personales (Gemini) sin tocar el .env */}
                <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <label className="text-xs text-gray-300 font-medium flex items-center justify-between">
                    <span>Tus Claves de API (activan las voces neuronales reales):</span>
                    {apiKeyInfo && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                        apiKeyInfo.configured
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                      }`}>
                        {apiKeyInfo.configured ? `✓ ${apiKeyInfo.count} clave${apiKeyInfo.count !== 1 ? 's' : ''} guardada${apiKeyInfo.count !== 1 ? 's' : ''}` : 'sin claves'}
                      </span>
                    )}
                  </label>

                  <div className="flex items-start gap-2">
                    <textarea
                      value={apiKeyInput}
                      onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyStatus('idle'); }}
                      placeholder={'Pega hasta 10 claves separadas por comas o saltos de línea.\nEj: AIza..., AQ.Ab8..., AIza...'}
                      rows={3}
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none placeholder:text-gray-500 placeholder:font-sans resize-none"
                    />
                    <button
                      type="button"
                      onClick={saveGeminiApiKey}
                      disabled={!apiKeyInput.trim() || apiKeyStatus === 'saving'}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        apiKeyStatus === 'ok'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-600/25 hover:bg-emerald-600/50 text-emerald-100 border border-emerald-500/40'
                      }`}
                    >
                      <Check size={12} />
                      <span>{apiKeyStatus === 'saving' ? 'Guardando...' : apiKeyStatus === 'ok' ? 'Guardadas' : 'Guardar'}</span>
                    </button>
                  </div>

                  {apiKeyStatus === 'ok' && !apiKeyQuota && (
                    <p className="text-[10px] text-emerald-300">✓ Claves guardadas y la primera validada contra Google. Las voces neuronales reales están activas; cuando una clave agote su cuota del día, la app rota sola a la siguiente.</p>
                  )}
                  {apiKeyStatus === 'ok' && apiKeyQuota && (
                    <p className="text-[10px] text-emerald-300">✓ Claves válidas y guardadas. La cuota gratuita de hoy ya está agotada; cuando se renueve (o con otras claves con cuota) volverán las voces neuronales automáticamente.</p>
                  )}
                  {apiKeyStatus === 'invalid' && (
                    <p className="text-[10px] text-amber-300">⚠ Las claves se guardaron, pero Google rechazó la primera al probarla. Revisa que esté completa y que la API de Gemini esté habilitada.</p>
                  )}
                  {apiKeyStatus === 'error' && (
                    <p className="text-[10px] text-red-300">✗ No se pudo contactar al servidor para guardar las claves. ¿La app está corriendo con su servidor?</p>
                  )}

                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Consigue claves gratuitas en <strong className="text-gray-300">aistudio.google.com/apikey</strong> → Create API key (cada proyecto de Google tiene su propia cuota diaria de ~10 voces; con varias claves la app rota sola y multiplica tus respuestas neuronales al día, hasta 10 claves).
                    Cuando <strong className="text-gray-300">todas</strong> las claves se agoten, el asistente usa las <strong className="text-gray-300">voces locales del navegador</strong> (Microsoft Edge) hasta el día siguiente — nunca la voz robótica de Google Translate.
                    Se guardan en el .env automáticamente (nunca se suben a GitHub). En AI Studio no hace falta: la clave se inyecta sola.
                  </p>
                </div>

                {neuralProvider === 'google-translate' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                    ⚠️ <strong>Modo básico activo:</strong> no hay claves de Gemini/ElevenLabs configuradas, así que se está usando el respaldo gratuito de Google Translate (una sola voz, sin tono ni velocidad). Añade claves arriba para activar las voces neuronales reales.
                  </div>
                )}

            {/* Voice Dropdown Selector (voces Edge del navegador) */}
            <div className={`space-y-1.5 transition-opacity ${speechConfig.voicePriority?.includes('edge') ? 'opacity-45' : ''}`}>
              <label className="text-xs text-gray-300 font-medium flex items-center justify-between">
                <span>{speechConfig.voicePriority?.includes('edge') ? '🖥️ Voces Edge (la voz exacta también se elige en su puesto):' : '🖥️ Voces Edge del Navegador:'}</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {browserVoices.length > 0 ? `${browserVoices.length} voces detectadas` : 'Cargando voces...'}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={speechConfig.voiceURI || 'auto'}
                  onChange={(e) => onUpdateSpeechConfig({ voiceURI: e.target.value })}
                  className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none cursor-pointer truncate"
                >
                  <option value="auto">⭐ Automático: Microsoft Edge Natural / Mejor Voz en Español</option>
                  
                  {/* Group 1: Microsoft Edge Online / Natural Voices */}
                  {browserVoices.filter(v => /online.*natural|microsoft.*natural|natural/i.test(v.name)).length > 0 && (
                    <optgroup label="🌟 Microsoft Edge 'Leer en voz alta' (Natural / Neural - Entonación Fija)">
                      {browserVoices
                        .filter(v => /online.*natural|microsoft.*natural|natural/i.test(v.name))
                        .map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                    </optgroup>
                  )}

                  {/* Group 2: Other Spanish Voices */}
                  {browserVoices.filter(v => (v.lang.startsWith('es') || /spanish/i.test(v.name)) && !(/online.*natural|microsoft.*natural|natural/i.test(v.name))).length > 0 && (
                    <optgroup label="⚡ Voces en Español del Sistema y Microsoft (Control Total de Tono Grave/Agudo)">
                      {browserVoices
                        .filter(v => (v.lang.startsWith('es') || /spanish/i.test(v.name)) && !(/online.*natural|microsoft.*natural|natural/i.test(v.name)))
                        .map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                    </optgroup>
                  )}

                  {/* Group 3: All other browser voices */}
                  {browserVoices.filter(v => !v.lang.startsWith('es') && !/spanish/i.test(v.name) && !(/online.*natural|microsoft.*natural|natural/i.test(v.name))).length > 0 && (
                    <optgroup label="🌐 Otras Voces del Navegador">
                      {browserVoices
                        .filter(v => !v.lang.startsWith('es') && !/spanish/i.test(v.name))
                        .slice(0, 25)
                        .map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                {/* Test Voice Button */}
                <button
                  type="button"
                  onClick={() => {
                    setTestingVoice('custom_browser');
                    const speechService = SpeechService.getInstance();
                    speechService.updateConfig(speechConfig);
                    speechService.speak("Comando recibido en cabina. Reproduciendo en SerchTube.");
                    setTimeout(() => setTestingVoice(null), 3000);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                    testingVoice === 'custom_browser'
                      ? 'bg-blue-600 text-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  <Play size={12} fill="currentColor" />
                  <span>{testingVoice === 'custom_browser' ? 'Hablando...' : 'Probar Voz'}</span>
                </button>
              </div>
            </div>

            {/* Sliders: Volume, Rate, Pitch */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
              {/* Volume */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Volumen TTS</span>
                  <span className="font-mono text-blue-400">
                    {Math.round((speechConfig.speechVolume ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={speechConfig.speechVolume ?? 1.0}
                  onChange={(e) => onUpdateSpeechConfig({ speechVolume: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Speech Rate (Speed) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Velocidad</span>
                  <span className="font-mono text-blue-400">{speechConfig.speechRate ?? 1.05}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.7"
                  step="0.05"
                  value={speechConfig.speechRate ?? 1.05}
                  onChange={(e) => onUpdateSpeechConfig({ speechRate: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-400 px-0.5 font-mono">
                  <span>0.6x (Lenta)</span>
                  <span>1.0x (Normal)</span>
                  <span>1.7x (Rápida)</span>
                </div>
              </div>

              {/* Speech Pitch */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-300">
                  <span className="flex items-center gap-1">
                    <span>Tono</span>
                    <span className="text-[10px] text-blue-300">
                      {(speechConfig.speechPitch ?? 1.0) < 0.9 ? '• Grave' : (speechConfig.speechPitch ?? 1.0) > 1.15 ? '• Agudo' : '• Medio'}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-blue-400 font-semibold">{speechConfig.speechPitch ?? 1.0}x</span>
                    <button
                      type="button"
                      onClick={() => {
                        const speechService = SpeechService.getInstance();
                        speechService.updateConfig(speechConfig);
                        speechService.speak("Tono acústico ajustado en SerchTube.");
                      }}
                      className="px-1.5 py-0.5 rounded bg-blue-600/25 hover:bg-blue-600/50 text-blue-200 text-[10px] font-medium transition-colors cursor-pointer"
                      title="Probar tono actual"
                    >
                      Probar
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={speechConfig.speechPitch ?? 1.0}
                  onChange={(e) => onUpdateSpeechConfig({ speechPitch: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-400 px-0.5 font-mono">
                  <span>0.5x (Grave)</span>
                  <span>1.0x (Normal)</span>
                  <span>2.0x (Agudo)</span>
                </div>
              </div>
            </div>

            {/* Informative notice on voice pitch compatibility */}
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200/90 leading-relaxed flex items-start gap-2">
              <span className="text-base shrink-0 mt-0.5">💡</span>
              <div>
                <span className="font-semibold text-white">Comportamiento del tono según la voz seleccionada:</span>
                <p className="mt-0.5 text-gray-300">
                  • <strong>Motor Neuronal IA</strong> (Jorge, Dalia, Elvira…): la Velocidad y el Tono se aplican como <em>prosodia natural</em> sobre la voz neuronal (sin distorsión robótica), conservando el realismo humano de la entonación.
                </p>
                <p className="mt-0.5 text-gray-300">
                  • <strong>Voces del Sistema y Microsoft de Escritorio</strong> (ej. <em>Microsoft Helena, Sabina, Laura, Google Español</em>): Permiten modular el <strong>Tono</strong> libremente de <strong>0.5x (grave)</strong> a <strong>2.0x (agudo)</strong>.
                </p>
                <p className="mt-0.5 text-gray-300">
                  • <strong>Voces "Naturales" Online de Microsoft Edge</strong> (ej. <em>Microsoft Álvaro, Jorge, Elvira Natural</em>): Son sintetizadas por IA neural en los servidores de Microsoft con entonación hiperrealista fija; el navegador Edge no altera su tono artificialmente para preservar el realismo vocal.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3: Neural Voice Personalities */}
          <CollapsibleSection
            id="voice_personality"
            title="Personalidad de Respuesta Neural"
            icon={<Sparkles size={16} />}
            summary={
              speechConfig.personality === 'animada'
                ? "Perfil Animada: Con entusiasmo, dinamismo, energía y frases alegres variadas"
                : "Perfil Directa: Breve, concisa y sin rodeos"
            }
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30 uppercase font-bold">
                {speechConfig.personality || 'animada'}
              </span>
            }
            isExpanded={!!expandedSections['voice_personality']}
            onToggle={() => toggleSection('voice_personality')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">9 estilos de respuesta disponibles para confirmar acciones:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {personalities.map((p) => {
                const isSelected = speechConfig.personality === p.id;
                const isTesting = testingVoice === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => onUpdateSpeechConfig({ personality: p.id })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-red-600/15 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{p.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                          {p.style}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => handleTestVoice(p, e)}
                        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${
                          isTesting ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                        title="Escuchar muestra de voz"
                      >
                        <Play size={10} fill="currentColor" />
                        <span>{isTesting ? 'Hablando...' : 'Probar'}</span>
                      </button>

                      {isSelected && (
                        <span className="text-[10px] text-red-400 font-mono font-bold flex items-center gap-0.5">
                          <Check size={12} /> Activo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Section 3: Audio Ducking Configuration */}
          <CollapsibleSection
            id="audio_ducking"
            title="Atenuación Inteligente (Audio Ducking)"
            icon={<Volume2 size={16} />}
            summary={
              speechConfig.duckingEnabled
                ? `Baja automáticamente la música al ${speechConfig.duckingVolume ?? 0}% al hablar o responder, y la restaura sin demora`
                : "Música continúa a volumen normal sin atenuación durante el reconocimiento de voz"
            }
            badge={
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                speechConfig.duckingEnabled
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-white/10 text-gray-400 border-white/10'
              }`}>
                {speechConfig.duckingEnabled
                  ? ((speechConfig.duckingVolume ?? 0) === 0
                      ? 'ACTIVO (SILENCIO 0%)'
                      : `ACTIVO (${speechConfig.duckingVolume ?? 0}%)`)
                  : 'DESACTIVADO'}
              </span>
            }
            isExpanded={!!expandedSections['audio_ducking']}
            onToggle={() => toggleSection('audio_ducking')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center">
                  <Volume2 size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Atenuación Inteligente (Audio Ducking)</div>
                  <div className="text-xs text-gray-400">
                    Baja automáticamente la música al {speechConfig.duckingVolume ?? 0}% al hablar o responder, y la restaura sin demora.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ duckingEnabled: !speechConfig.duckingEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  speechConfig.duckingEnabled ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.duckingEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Volumen del ducking: 0-100 en pasos de 10 (0% = silencio total) */}
            <div className={`mt-4 space-y-1 ${speechConfig.duckingEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex items-center justify-between text-[11px] text-gray-300">
                <span>Volumen de la música durante la atenuación</span>
                <span className="font-mono text-red-400 font-bold">
                  {(speechConfig.duckingVolume ?? 0) === 0 ? '0% (SILENCIO)' : `${speechConfig.duckingVolume ?? 0}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={speechConfig.duckingVolume ?? 0}
                onChange={(e) => onUpdateSpeechConfig({ duckingVolume: parseInt(e.target.value, 10) })}
                className="w-full accent-red-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-400 px-0.5 font-mono">
                <span>0% Silencio</span>
                <span>50%</span>
                <span>100% Sin atenuar</span>
              </div>
              <div className="text-[10px] text-gray-400">
                La música baja a este porcentaje de su volumen mientras hablas o el asistente responde.
                Con 0% queda en silencio total (recomendado: evita que el micrófono confunda la música con comandos).
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3.1: Satellite Mics Only Configuration */}
          <CollapsibleSection
            id="satellite_mic_only"
            title="Solo Micrófonos Satélite (Consola Silenciosa)"
            icon={<Wifi size={16} />}
            summary={
              speechConfig.satelliteMicOnly
                ? "Micrófono local de la PC silenciado • Escucha únicamente comandos provenientes de nodos satélites externos"
                : "Micrófono de la PC activo y escuchando comandos normalmente"
            }
            badge={
              speechConfig.satelliteMicOnly ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono border border-red-500/30 font-bold">
                  MIC PC MUTED
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  NORMAL
                </span>
              )
            }
            isExpanded={!!expandedSections['satellite_mic_only']}
            onToggle={() => toggleSection('satellite_mic_only')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Solo Micrófonos Satélite (Desactivar Micrófono Local)</div>
                <div className="text-xs text-gray-400">
                  Desactiva el micrófono de este dispositivo y escucha únicamente los comandos de voz provenientes de los nodos satélite externos.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ satelliteMicOnly: !speechConfig.satelliteMicOnly })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  speechConfig.satelliteMicOnly ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.satelliteMicOnly ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </CollapsibleSection>

          {/* Section 3.2: Equalizer Master Switch & Hardware Audio Processing */}
          <CollapsibleSection
            id="equalizer"
            title="Ecualizador y Procesamiento Hi-Fi"
            icon={<Sliders size={16} />}
            summary={
              eqSettings?.enabled !== false
                ? `Preset: ${eqSettings?.preset || 'Hi-Fi'} • Graves: ${eqSettings?.bassBoost ? 'ON' : 'OFF'} • Compresor: ${eqSettings?.loudnessEnhancer ? 'ON' : 'OFF'}`
                : "Procesamiento de audio desactivado (modo bypass directo sin ecualizar)"
            }
            badge={
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                eqSettings?.enabled !== false
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/10 text-gray-400 border-white/10'
              }`}>
                {eqSettings?.enabled !== false ? (eqSettings?.preset || 'ON') : 'BYPASS'}
              </span>
            }
            isExpanded={!!expandedSections['equalizer']}
            onToggle={() => toggleSection('equalizer')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-white/5"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  eqSettings.enabled !== false ? 'bg-red-600/20 text-red-500' : 'bg-white/10 text-gray-400'
                }`}>
                  <Sliders size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Interruptor General del Ecualizador</span>
                    <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold border ${
                      eqSettings.enabled !== false
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/10 text-gray-400 border-white/10'
                    }`}>
                      {eqSettings.enabled !== false ? 'ON' : 'BYPASS'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Activa o desactiva por completo el procesamiento de audio del ecualizador (curva plana vs bandas personalizadas).
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenEqualizer?.()}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Abrir Bandas
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEqSettings?.({ enabled: eqSettings.enabled === false })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    eqSettings.enabled !== false ? 'bg-red-600' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      eqSettings.enabled !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3.3: Auto Volume Inactivity Reducer ("bajar el volumen después de cierto tiempo de inactividad sin música") */}
          <CollapsibleSection
            id="auto_volume"
            title="Bajar Volumen por Inactividad sin Música"
            icon={<Volume2 size={16} />}
            summary={
              autoVolumeConfig.enabled
                ? `Reduce automáticamente el volumen a ${autoVolumeConfig.targetVolume}/15 tras ${autoVolumeConfig.delaySeconds < 60 ? `${autoVolumeConfig.delaySeconds} seg` : `${Math.round(autoVolumeConfig.delaySeconds / 60)} min`} de inactividad • Desvanecimiento suave`
                : "Protección de descanso desactivada • El volumen se mantiene fijo tras pausar la música"
            }
            badge={
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                autoVolumeConfig.enabled
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-white/10 text-gray-400 border-white/10'
              }`}>
                {autoVolumeConfig.enabled ? `${autoVolumeConfig.targetVolume}/15 TRAS ${autoVolumeConfig.delaySeconds}s` : 'DESACTIVADO'}
              </span>
            }
            isExpanded={!!expandedSections['auto_volume']}
            onToggle={() => toggleSection('auto_volume')}
            gradient="bg-gradient-to-br from-blue-950/20 to-black/40"
            borderColor="border-blue-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  autoVolumeConfig.enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-white/10 text-gray-400'
                }`}>
                  <Volume2 size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Bajar Volumen por Inactividad sin Música</span>
                    <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold border ${
                      autoVolumeConfig.enabled
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-white/10 text-gray-400 border-white/10'
                    }`}>
                      {autoVolumeConfig.enabled ? 'ACTIVADO' : 'DESACTIVADO'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Si la música está pausada o detenida, tras el tiempo de inactividad establecido baja el volumen automáticamente a un nivel seguro para evitar sustos al volver a reproducir.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAutoVolume?.({ enabled: !autoVolumeConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  autoVolumeConfig.enabled ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    autoVolumeConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {autoVolumeConfig.enabled && (
              <div className="pt-3 border-t border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">Volumen seguro de descanso:</span>
                      <span className="font-mono text-blue-400 font-bold">{autoVolumeConfig.targetVolume}/15</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={autoVolumeConfig.targetVolume}
                      onChange={(e) => onUpdateAutoVolume?.({ targetVolume: parseInt(e.target.value, 10) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="text-[10px] text-gray-400 font-mono flex justify-between">
                      <span>0 (Silencio)</span>
                      <span className="text-blue-400">4-5 (Ideal)</span>
                      <span>15 (Máx)</span>
                    </div>
                  </div>

                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">Tiempo de inactividad sin música:</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {autoVolumeConfig.delaySeconds < 60
                          ? `${autoVolumeConfig.delaySeconds} seg`
                          : `${Math.round(autoVolumeConfig.delaySeconds / 60)} min (${autoVolumeConfig.delaySeconds}s)`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="600"
                      step="10"
                      value={autoVolumeConfig.delaySeconds}
                      onChange={(e) => onUpdateAutoVolume?.({ delaySeconds: parseInt(e.target.value, 10) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex gap-1.5 pt-0.5">
                      {[30, 60, 120, 300, 600].map(sec => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => onUpdateAutoVolume?.({ delaySeconds: sec })}
                          className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            autoVolumeConfig.delaySeconds === sec
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                              : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-gray-400">
                    Atenuación suave progresiva al expirar el tiempo sin música.
                  </div>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('serchtube:test-auto-volume'))}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowDown size={13} className="text-blue-400" />
                    Probar reducción ahora
                  </button>
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Section 4: Screensaver / Sleep Mode Settings with Customizable YouTube link, Fonts & Clock toggles */}
          <CollapsibleSection
            id="screensaver"
            title="Protector de Pantalla & Modo Reposo OLED"
            icon={<Moon size={16} />}
            summary={
              screensaverConfig.enabled
                ? `Inactividad: ${screensaverConfig.timeoutSeconds}s • Modo: ${screensaverConfig.timeOfDayMode ? 'Por hora del día (4 franjas)' : 'Video YouTube fijo'} • Reloj: 20 estilos • Barra música: ${screensaverConfig.showMusicBar !== false ? 'Visible' : 'Oculta'} • QR Fijo: ${screensaverConfig.showLockScreenQr ? 'Visible' : 'Oculto'}`
                : "Modo reposo OLED con videos ambientales, 20 relojes digitales y QR de vinculación"
            }
            badge={
              screensaverConfig.enabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30 font-bold">
                  ACTIVO ({screensaverConfig.timeoutSeconds}s)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADO
                </span>
              )
            }
            isExpanded={!!expandedSections['screensaver']}
            onToggle={() => toggleSection('screensaver')}
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Activar Protector de Pantalla</span>
                <span className="text-[11px] text-gray-400 block">
                  Inicia automáticamente tras un período de inactividad o mediante el comando "música: protector"
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateScreensaverConfig({ enabled: !screensaverConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                  screensaverConfig.enabled ? 'bg-blue-500' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    screensaverConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {screensaverConfig.enabled && (
              <div className="space-y-4 pt-3 border-t border-white/10">
                {/* Time of Day Screensavers Section ("diferentes protectores según la hora del día") */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Sunrise size={14} className="text-amber-400" />
                        Protectores según la Hora del Día:
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Asigna videos de fondo ambientales específicos para cada momento de la jornada.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateScreensaverConfig({
                          selectedTimeOfDaySlot: screensaverConfig.selectedTimeOfDaySlot === 'auto' ? 'custom' : 'auto',
                          timeOfDayMode: screensaverConfig.selectedTimeOfDaySlot !== 'auto'
                        })
                      }
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                        !screensaverConfig.selectedTimeOfDaySlot || screensaverConfig.selectedTimeOfDaySlot === 'auto'
                          ? 'bg-red-600 text-white font-bold'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {!screensaverConfig.selectedTimeOfDaySlot || screensaverConfig.selectedTimeOfDaySlot === 'auto'
                        ? '● Modo Automático (Por Hora)'
                        : 'Manual / Fijo'}
                    </button>
                  </div>

                  {/* 4 Time of Day Slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {[
                      {
                        slot: 'morning' as const,
                        label: 'Mañana',
                        hours: '06:00 - 12:00',
                        desc: 'Amanecer Relajante & Lofi',
                        defaultId: 'wA0C0u6624Q',
                        icon: Sunrise
                      },
                      {
                        slot: 'afternoon' as const,
                        label: 'Tarde',
                        hours: '12:00 - 19:00',
                        desc: 'Carretera Soleada & Retrowave',
                        defaultId: 'MV_3Dpw-BRY',
                        icon: Sun
                      },
                      {
                        slot: 'night' as const,
                        label: 'Noche',
                        hours: '19:00 - 00:00',
                        desc: 'Ciudad Nocturna & Luces Neón 4K',
                        defaultId: 'f02mOEt11OQ',
                        icon: Moon
                      },
                      {
                        slot: 'late_night' as const,
                        label: 'Madrugada',
                        hours: '00:00 - 06:00',
                        desc: 'Cosmos Profundo 432Hz & Nebulosa',
                        defaultId: 'WPni755-Krg',
                        icon: Sparkles
                      }
                    ].map((slotMeta) => {
                      const currentVal = slotInputs[slotMeta.slot] ?? '';
                      const extractedId = extractYouTubeId(currentVal);
                      const isSelectedSlot = screensaverConfig.selectedTimeOfDaySlot === slotMeta.slot;
                      const isSaved = !!savedSlotFeedback[slotMeta.slot];
                      const isCustomized = currentVal !== slotMeta.defaultId && currentVal.length > 0;

                      return (
                        <div
                          key={slotMeta.slot}
                          className={`p-3 rounded-xl border transition-all ${
                            isSelectedSlot
                              ? 'bg-red-600/10 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.15)]'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <slotMeta.icon size={14} className="text-red-400" />
                              <span className="text-xs font-bold text-white">{slotMeta.label}</span>
                              <span className="text-[10px] font-mono text-gray-400">({slotMeta.hours})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateScreensaverConfig({
                                  selectedTimeOfDaySlot: slotMeta.slot,
                                  timeOfDayMode: false
                                })
                              }
                              className={`text-[10px] font-mono px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                                isSelectedSlot ? 'bg-red-600 text-white font-bold' : 'bg-white/10 text-gray-400 hover:text-white'
                              }`}
                            >
                              {isSelectedSlot ? 'Activo Fijo' : 'Fijar'}
                            </button>
                          </div>

                          <div className="text-[11px] text-gray-300 mb-2 truncate">{slotMeta.desc}</div>

                          {/* YouTube Input Row */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSlotInputs(prev => ({ ...prev, [slotMeta.slot]: val }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveSlotVideo(slotMeta.slot, slotMeta.label);
                                    }
                                  }}
                                  onBlur={() => {
                                    saveSlotVideo(slotMeta.slot, slotMeta.label);
                                  }}
                                  placeholder="Pega link de YouTube o ID..."
                                  className="w-full pl-2.5 pr-6 py-1.5 rounded-lg bg-black border border-white/15 text-[11px] text-white font-mono placeholder-gray-600 focus:outline-none focus:border-red-600"
                                />
                                {currentVal && (
                                  <button
                                    type="button"
                                    onClick={() => setSlotInputs(prev => ({ ...prev, [slotMeta.slot]: '' }))}
                                    title="Limpiar"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5"
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>

                              {/* Paste Button */}
                              <button
                                type="button"
                                onClick={() => handlePasteSlotClipboard(slotMeta.slot, slotMeta.label)}
                                title="Pegar enlace de YouTube del portapapeles"
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                              >
                                <Clipboard size={12} />
                              </button>

                              {/* Save Button */}
                              <button
                                type="button"
                                onClick={() => saveSlotVideo(slotMeta.slot, slotMeta.label)}
                                title="Guardar enlace"
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                                  isSaved
                                    ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]'
                                    : 'bg-red-600 hover:bg-red-500 text-white'
                                }`}
                              >
                                <Check size={12} />
                                <span className="text-[10px]">{isSaved ? 'OK' : 'Guardar'}</span>
                              </button>

                              {/* Open / Preview on YouTube */}
                              {extractedId && (
                                <a
                                  href={getYouTubeWatchUrl(extractedId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Ver video en YouTube (nueva pestaña)"
                                  className="p-1.5 rounded-lg bg-white/10 hover:bg-red-600/30 text-gray-300 hover:text-red-400 text-[11px] transition-colors cursor-pointer"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}

                              {/* Reset to default video */}
                              {isCustomized && (
                                <button
                                  type="button"
                                  onClick={() => handleResetSlotVideo(slotMeta.slot, slotMeta.defaultId, slotMeta.label)}
                                  title="Restablecer video original recomendado"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-gray-200 text-[11px] transition-colors cursor-pointer"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>

                            {/* Thumbnail & Clean ID Feedback */}
                            {extractedId && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <img
                                    src={getYouTubeThumbnail(extractedId)}
                                    alt="Preview"
                                    className="w-10 h-6 object-cover rounded border border-white/10 bg-black shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="text-[10px] font-mono text-gray-400 truncate flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                                    <span className="text-gray-400">ID:</span>
                                    <span className="text-red-400 font-bold truncate">{extractedId}</span>
                                  </div>
                                </div>

                                {isSaved && (
                                  <span className="text-[10px] font-mono text-green-400 shrink-0 font-semibold animate-pulse">
                                    ✓ ¡Guardado!
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customizable YouTube video URL fallback */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 block flex items-center gap-1.5">
                      <Youtube size={14} className="text-red-500" />
                      Link de video personalizable general (Manual / Alternativo):
                    </label>
                    {customVideoSaved && (
                      <span className="text-[11px] font-mono text-green-400 font-bold animate-pulse">
                        ✓ ¡Guardado!
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customVideoInput}
                      onChange={(e) => setCustomVideoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCustomVideo();
                        }
                      }}
                      placeholder="https://www.youtube.com/watch?v=... o ID del video"
                      className="flex-1 px-3 py-2 rounded-lg bg-black border border-white/15 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-red-600"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (navigator.clipboard?.readText) {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setCustomVideoInput(text.trim());
                            }
                          }
                        } catch (e) {}
                      }}
                      title="Pegar del portapapeles"
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <Clipboard size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomVideo}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        customVideoSaved
                          ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]'
                          : 'bg-red-600 hover:bg-red-500 text-white'
                      }`}
                    >
                      <Check size={14} />
                      <span>{customVideoSaved ? 'Guardado' : 'Guardar Link'}</span>
                    </button>
                  </div>
                  {extractYouTubeId(customVideoInput) && (
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-gray-400">
                      <img
                        src={getYouTubeThumbnail(customVideoInput)}
                        alt="Preview"
                        className="w-10 h-6 object-cover rounded border border-white/10 bg-black shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span className="text-gray-300">ID Detectado:</span>
                      <span className="text-red-400 font-bold">{extractYouTubeId(customVideoInput)}</span>
                      <a
                        href={getYouTubeWatchUrl(customVideoInput)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-gray-400 hover:text-red-400 flex items-center gap-1"
                      >
                        <span>Abrir en YouTube</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Clock Configuration: 20 Estilos de Reloj o Quitar Opcionalmente */}
                <div className="p-3.5 rounded-xl bg-black border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-400" />
                      Visualización del Reloj (20 Estilos Disponibles):
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ showClock: !showClock })}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                        showClock ? 'bg-white/10 text-white border border-white/20' : 'bg-red-600/20 text-red-400 border border-red-600/40'
                      }`}
                    >
                      {showClock ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{showClock ? 'Reloj Activo' : 'Reloj Oculto'}</span>
                    </button>
                  </div>

                  {showClock && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] text-gray-300 font-medium">
                            Estilo Tipográfico y Visual:
                          </label>
                          <span className="text-[10px] font-mono text-blue-400">
                            {CLOCK_STYLES_INFO.find(c => c.id === (screensaverConfig.clockStyle || screensaverConfig.clockFont || 'mono'))?.name || 'Monospace'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1">
                          {CLOCK_STYLES_INFO.map((item) => {
                            const isSelected = (screensaverConfig.clockStyle || screensaverConfig.clockFont || 'mono') === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => onUpdateScreensaverConfig({ clockStyle: item.id, clockFont: item.id })}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
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
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onUpdateScreensaverConfig({ clockFormat: screensaverConfig.clockFormat === '12h' ? '24h' : '12h' })}
                          className="p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-mono text-center cursor-pointer"
                        >
                          Formato: {screensaverConfig.clockFormat || '24h'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateScreensaverConfig({ showSeconds: screensaverConfig.showSeconds === false ? true : false })}
                          className="p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-mono text-center cursor-pointer"
                        >
                          Segundos: {screensaverConfig.showSeconds === false ? 'No' : 'Sí'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateScreensaverConfig({ showDate: screensaverConfig.showDate === false ? true : false })}
                          className="p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-mono text-center cursor-pointer"
                        >
                          Fecha: {screensaverConfig.showDate === false ? 'No' : 'Sí'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lock Screen Music Bar Configuration: 20 Estilos con Miniaturas & Toggle Desactivar */}
                <div className="p-3.5 rounded-xl bg-black border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Music2 size={14} className="text-red-400" />
                      Barra de Música en Pantalla de Bloqueo (20 Estilos):
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ showMusicBar: !(screensaverConfig.showMusicBar !== false) })}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                        screensaverConfig.showMusicBar !== false
                          ? 'bg-red-600 text-white border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                          : 'bg-zinc-800 text-gray-400 border border-white/10'
                      }`}
                    >
                      {screensaverConfig.showMusicBar !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{screensaverConfig.showMusicBar !== false ? 'Barra Activa' : 'Barra Desactivada'}</span>
                    </button>
                  </div>

                  {screensaverConfig.showMusicBar !== false && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-gray-300 font-medium">
                          Selecciona el Diseño Visual de la Barra:
                        </label>
                        <span className="text-[10px] font-mono text-red-400">
                          {LOCKSCREEN_MUSIC_BAR_STYLES_INFO.find(s => s.id === (screensaverConfig.musicBarStyle || 'album_card_glass'))?.name || 'Cristal 3D'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {LOCKSCREEN_MUSIC_BAR_STYLES_INFO.map((item) => {
                          const isSelected = (screensaverConfig.musicBarStyle || 'album_card_glass') === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onUpdateScreensaverConfig({ musicBarStyle: item.id })}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
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

                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300">
                        💡 <strong>Personalización en Vivo:</strong> En la pantalla de bloqueo puedes arrastrar la barra para moverla libremente (arriba, abajo o a los lados), ajustar su transparencia de fondo negro (0% a 100% OLED) y ensanchar sus bordes.
                      </div>
                    </div>
                  )}
                </div>

                {/* Darkness Level / Blackout OLED */}
                <div className="p-3.5 rounded-lg bg-black/60 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-200 font-semibold flex items-center gap-2">
                      <Moon size={15} className="text-amber-400" />
                      Nivel de Oscuridad / Blackout OLED del Protector:
                    </span>
                    <span className="text-amber-400 font-mono font-bold text-xs bg-amber-400/10 px-2 py-0.5 rounded border border-amber-500/30">
                      {Math.round((screensaverConfig.darknessLevel ?? 0.65) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={screensaverConfig.darknessLevel ?? 0.65}
                    onChange={(e) => onUpdateScreensaverConfig({ darknessLevel: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>0% (Brillante / Video sin oscurecer)</span>
                    <span>100% (Negro OLED puro)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 pt-1 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ darknessLevel: 0.25 })}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        Math.abs((screensaverConfig.darknessLevel ?? 0.65) - 0.25) < 0.05
                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      25% Suave
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ darknessLevel: 0.50 })}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        Math.abs((screensaverConfig.darknessLevel ?? 0.65) - 0.50) < 0.05
                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      50% Medio
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ darknessLevel: 0.75 })}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        Math.abs((screensaverConfig.darknessLevel ?? 0.65) - 0.75) < 0.05
                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      75% Noche
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ darknessLevel: 1.0 })}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        (screensaverConfig.darknessLevel ?? 0.65) >= 0.95
                          ? 'bg-red-600/30 border-red-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      100% OLED
                    </button>
                  </div>
                </div>

                {/* Inactivity timeout */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-300 font-medium">
                      Tiempo de inactividad para activar el protector:
                    </span>
                    <span className="text-blue-400 font-mono font-semibold">
                      {screensaverConfig.inactivityTimeoutSeconds} segundos
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={screensaverConfig.inactivityTimeoutSeconds}
                    onChange={(e) => onUpdateScreensaverConfig({ inactivityTimeoutSeconds: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-500 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">
                    Regla: Al pausar o terminar la canción, la app espera {screensaverConfig.inactivityTimeoutSeconds}s de inactividad antes de desplegar el protector.
                  </div>
                </div>

                {/* Return to web first toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">
                    Volver primero a la web antes del protector:
                  </span>
                  <input
                    type="checkbox"
                    checked={screensaverConfig.returnToWebFirst}
                    onChange={(e) => onUpdateScreensaverConfig({ returnToWebFirst: e.target.checked })}
                    className="accent-red-600 w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                {/* Screensaver Video Smoothness & Anti-Freeze Quality */}
                <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-400" />
                      Fluidez y Calidad del Video de Fondo (Anti-Tirones):
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      {(!screensaverConfig.videoQuality || screensaverConfig.videoQuality === 'auto'
                        ? 'AUTO ADAPTABLE'
                        : `${screensaverConfig.videoQuality.toUpperCase()} FLUIDO`)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Ajusta la resolución del video de fondo en YouTube. El modo adaptativo evita tirones, buffering y sobrecalentamiento.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ videoQuality: 'auto' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        !screensaverConfig.videoQuality || screensaverConfig.videoQuality === 'auto'
                          ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-emerald-400">⚡ Auto Adaptable</div>
                      <div className="text-[9px] text-gray-300">Recomendado (Cero parones)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ videoQuality: '720p' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        screensaverConfig.videoQuality === '720p'
                          ? 'bg-blue-600/30 border-blue-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-blue-400">✨ 720p HD</div>
                      <div className="text-[9px] text-gray-300">Equilibrado</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ videoQuality: '480p' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        screensaverConfig.videoQuality === '480p'
                          ? 'bg-amber-600/30 border-amber-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-amber-400">🔋 480p Fluido</div>
                      <div className="text-[9px] text-gray-300">Máxima estabilidad</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateScreensaverConfig({ videoQuality: '1080p' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        screensaverConfig.videoQuality === '1080p'
                          ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-purple-400">🎬 1080p Full HD</div>
                      <div className="text-[9px] text-gray-300">Requiere buena conexión</div>
                    </button>
                  </div>

                  {/* Auto-recover watchdog toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-300">
                      Perro guardián anti-congelamiento (auto-recuperar si el video se traba):
                    </span>
                    <input
                      type="checkbox"
                      checked={screensaverConfig.autoRecoverFreeze !== false}
                      onChange={(e) => onUpdateScreensaverConfig({ autoRecoverFreeze: e.target.checked })}
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer ml-2"
                    />
                  </div>
                </div>

                {/* Fixed Lock Screen QR Code Toggle & Customization */}
                <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                        <QrCode size={14} className="text-red-400" />
                        Mostrar Código QR Fijo en Pantalla de Bloqueo:
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Permite a los pasajeros escanear el QR y conectarse al control remoto mientras el coche está en reposo.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={screensaverConfig.showLockScreenQr ?? false}
                      onChange={(e) => onUpdateScreensaverConfig({ showLockScreenQr: e.target.checked })}
                      className="accent-red-600 w-4 h-4 rounded cursor-pointer shrink-0 ml-3"
                    />
                  </div>

                  {screensaverConfig.showLockScreenQr && (
                    <div className="pt-2.5 border-t border-white/10 space-y-2.5 animate-fadeIn">
                      {/* Background Transparency Slider */}
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-gray-300 font-medium">Transparencia del fondo negro:</span>
                        <span className="text-amber-400 font-mono font-semibold">
                          {(screensaverConfig.qrBgOpacity ?? 0.90) === 0
                            ? '0% (Totalmente transparente)'
                            : `${Math.round((screensaverConfig.qrBgOpacity ?? 0.90) * 100)}%`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-mono">0% (Sin fondo)</span>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={screensaverConfig.qrBgOpacity ?? 0.90}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdateScreensaverConfig({ qrBgOpacity: val });
                            try {
                              const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
                              const parsed = saved ? JSON.parse(saved) : {};
                              localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify({ ...parsed, bgOpacity: val }));
                            } catch (_) {}
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400 font-mono">100% (Negro)</span>
                      </div>

                      {/* Hide text toggle */}
                      <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <Type size={13} className="text-amber-400" />
                          <div>
                            <span className="text-xs text-white font-medium block">Quitar letras (Dejar solo el QR)</span>
                            <span className="text-[10px] text-gray-400 block">Oculta los títulos y textos para un diseño minimalista</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={screensaverConfig.qrHideText ?? false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            onUpdateScreensaverConfig({ qrHideText: val });
                            try {
                              const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
                              const parsed = saved ? JSON.parse(saved) : {};
                              localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify({ ...parsed, hideText: val }));
                            } catch (_) {}
                          }}
                          className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-[10px] text-gray-400 font-mono uppercase">Presets rápidos:</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateScreensaverConfig({ qrHideText: true, qrBgOpacity: 0.0 });
                            try {
                              const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
                              const parsed = saved ? JSON.parse(saved) : {};
                              localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify({ ...parsed, hideText: true, bgOpacity: 0.0 }));
                            } catch (_) {}
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                            (screensaverConfig.qrHideText ?? false) && (screensaverConfig.qrBgOpacity ?? 0.90) === 0
                              ? 'bg-amber-500 text-black border-amber-400 font-bold'
                              : 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10'
                          }`}
                        >
                          ✨ Solo QR (Sin letras ni fondo)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateScreensaverConfig({ qrBgOpacity: 0.0 });
                            try {
                              const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
                              const parsed = saved ? JSON.parse(saved) : {};
                              localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify({ ...parsed, bgOpacity: 0.0 }));
                            } catch (_) {}
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-mono border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          Fondo Transparente (0%)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateScreensaverConfig({ qrHideText: false, qrBgOpacity: 0.90 });
                            try {
                              const saved = localStorage.getItem('serchtube_screensaver_qr_customization');
                              const parsed = saved ? JSON.parse(saved) : {};
                              localStorage.setItem('serchtube_screensaver_qr_customization', JSON.stringify({ ...parsed, hideText: false, bgOpacity: 0.90 }));
                            } catch (_) {}
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-mono border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          Tarjeta Estándar (90%)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Section 5: Transparencias y Difuminaciones (Pantalla Completa Personalizable) */}
          <CollapsibleSection
            id="visual_effects"
            title="Transparencias, Ondas y Efectos Visuales"
            icon={<Layers size={16} />}
            summary={`Opacidades: Fondo ${Math.round(videoOpacity * 100)}%, Ondas ${Math.round((visualConfig?.wavesOpacity ?? 0.85) * 100)}% • 32 Estilos de Orbe • 24 Estilos de Onda • Pantalla completa`}
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                32 ORBES / 24 ONDAS
              </span>
            }
            isExpanded={!!expandedSections['visual_effects']}
            onToggle={() => toggleSection('visual_effects')}
          >
            <p className="text-xs text-gray-400">
              Personaliza la opacidad del fondo de la barra de título, barra de información, video y ondas. Las letras y textos se mantienen 100% nítidos y legibles.
            </p>

            <div className="space-y-4 pt-1">
              {/* Quick Master Performance Presets */}
              <div className="p-3.5 rounded-xl bg-black/70 border border-white/10 space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <Zap size={14} className="text-yellow-400" />
                  <span>Perfiles de Rendimiento y Transparencia:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateVisual({ videoOpacity: 1.0, headerBgOpacity: 0.15, footerBgOpacity: 0.75, topFadeOpacity: 0.0, bottomFadeOpacity: 0.15, wavesOpacity: 0.0 });
                      if (onUpdateQuality) onUpdateQuality('large');
                    }}
                    className="p-2.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-left transition-all group"
                  >
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>📟 PC Antiguo (480p)</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 leading-tight">
                      Cero lag. Desactiva ondas animadas y fuerza códec H.264 ligero en 480p.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateVisual({ videoOpacity: 1.0, headerBgOpacity: 0.15, footerBgOpacity: 0.70, topFadeOpacity: 0.0, bottomFadeOpacity: 0.20, wavesOpacity: 0.40 });
                      if (onUpdateQuality) onUpdateQuality('hd720');
                    }}
                    className="p-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-left transition-all group"
                  >
                    <div className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                      <span>⚡ 60 FPS / Equilibrado</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 leading-tight">
                      Video nítido 100%, 720p HD y renderizado GPU optimizado.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateVisual({ videoOpacity: 0.45, headerBgOpacity: 0.40, footerBgOpacity: 0.60, topFadeOpacity: 0.80, bottomFadeOpacity: 0.85, wavesOpacity: 0.85 });
                      if (onUpdateQuality) onUpdateQuality('auto');
                    }}
                    className="p-2.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-left transition-all group"
                  >
                    <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <span>🎨 Estilo OLED Cabina</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 leading-tight">
                      Diseño con orbe reactivo, ondas de sonido y difuminaciones cinemáticas.
                    </div>
                  </button>
                </div>
              </div>

              {/* Auto-expand / Fullscreen on Play toggle */}
              <div className="p-3.5 rounded-lg bg-black/60 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Maximize2 size={14} className="text-red-400" />
                    Pantalla Completa Automática al Reproducir Música (Fullscreen)
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    Al solicitar o reanudar una canción, activa automáticamente el modo Pantalla Completa. También puedes usar el botón de cabina o dictar <i className="text-red-300">&ldquo;música, pantalla completa&rdquo;</i>.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAutoExpand}
                  onChange={(e) => handleUpdateVisual({ autoExpandOnPlay: e.target.checked })}
                  className="accent-red-600 w-5 h-5 rounded cursor-pointer ml-3 shrink-0"
                />
              </div>

              {/* Auto Fullscreen on Host Startup (F11) toggle */}
              <div className="p-3.5 rounded-lg bg-black/60 border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Tv size={14} className="text-cyan-400" />
                    Auto Pantalla Completa al Iniciar el Host (F11)
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    Inicia el Host directamente en modo Pantalla Completa (F11) al cargar la aplicación para una experiencia inmersiva en monitores, Smart TVs y pantallas táctiles de cabina.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAutoFullscreenStartup}
                  onChange={(e) => handleUpdateVisual({ autoFullscreenOnStartup: e.target.checked })}
                  className="accent-cyan-500 w-5 h-5 rounded cursor-pointer ml-3 shrink-0"
                />
              </div>

              {/* Slider 1: Header / Title Bar Dark Background Opacity */}
              <div className="p-3.5 rounded-lg bg-black/60 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold flex items-center gap-2">
                    <PanelTop size={15} className="text-amber-400" />
                    Transparencia de Fondo: Barra de Título (Superior)
                  </span>
                  <span className="text-amber-400 font-mono font-bold text-xs bg-amber-400/10 px-2 py-0.5 rounded border border-amber-500/30">
                    {Math.round(currentHeaderBg * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentHeaderBg}
                  onChange={(e) => handleUpdateVisual({ headerBgOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>0% (Completamente translúcida / Cristal)</span>
                  <span>100% (Negro OLED sólido)</span>
                </div>
                <p className="text-[11px] text-amber-200/80 bg-amber-950/30 p-2 rounded border border-amber-800/30">
                  ✦ Solo se manipula la transparencia del fondo oscuro. Las letras de SerchTube Music, el reloj y los botones de acción permanecen 100% nítidos.
                </p>
                {/* Quick Presets for Header */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Ajuste rápido:</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ headerBgOpacity: 0.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentHeaderBg === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    0% Cristal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ headerBgOpacity: 0.40 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentHeaderBg === 0.4 ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    40% Suave (Defecto)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ headerBgOpacity: 0.75 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentHeaderBg === 0.75 ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    75% Alto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ headerBgOpacity: 1.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentHeaderBg === 1.0 ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    100% Sólido
                  </button>
                </div>
              </div>

              {/* Slider 2: Footer / Info Bar Dark Background Opacity */}
              <div className="p-3.5 rounded-lg bg-black/60 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold flex items-center gap-2">
                    <PanelBottom size={15} className="text-emerald-400" />
                    Transparencia de Fondo: Barra de Información (Inferior)
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-xs bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    {Math.round(currentFooterBg * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentFooterBg}
                  onChange={(e) => handleUpdateVisual({ footerBgOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>0% (Completamente translúcida / Cristal)</span>
                  <span>100% (Negro OLED sólido)</span>
                </div>
                <p className="text-[11px] text-emerald-200/80 bg-emerald-950/30 p-2 rounded border border-emerald-800/30">
                  ✦ Solo se manipula la transparencia del fondo oscuro. El título de la pista, artista, tiempo transcurrido, scrubber y botones permanecen 100% nítidos.
                </p>
                {/* Quick Presets for Footer */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Ajuste rápido:</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ footerBgOpacity: 0.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentFooterBg === 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    0% Cristal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ footerBgOpacity: 0.60 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentFooterBg === 0.6 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    60% Suave (Defecto)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ footerBgOpacity: 0.85 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentFooterBg === 0.85 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    85% Alto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ footerBgOpacity: 1.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentFooterBg === 1.0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    100% Sólido
                  </button>
                </div>
              </div>

              {/* Slider 3: Video Opacity */}
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold flex items-center gap-2">
                    <Layers size={14} className="text-red-500" />
                    Transparencia del Video de fondo:
                  </span>
                  <span className="text-red-400 font-mono font-bold text-xs">
                    {Math.round(currentVideoOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={currentVideoOpacity}
                  onChange={(e) => handleUpdateVisual({ videoOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-red-600 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400 flex justify-between">
                  <span>0% (Muy tenue / translúcido)</span>
                  <span>100% (Completamente sólido)</span>
                </div>
              </div>

              {/* Activator for Wave & Mic Animations */}
              <div className="p-3.5 rounded-lg bg-black/60 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className={(visualConfig?.showWavesAndMic !== false && currentWavesOpacity > 0.05) ? "text-cyan-400 animate-pulse" : "text-gray-500"} />
                    <div>
                      <span className="text-xs font-semibold text-white">
                        Activador de Ondas y Micrófono Reactivo:
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Permite reactivar y ver las ondas visuales y el micrófono del orbe tras haber cambiado a otros perfiles o apagado las animaciones.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyActive = (visualConfig?.showWavesAndMic !== false) && (currentWavesOpacity > 0.05);
                        if (isCurrentlyActive) {
                          handleUpdateVisual({ showWavesAndMic: false, wavesOpacity: 0.0 });
                        } else {
                          handleUpdateVisual({ showWavesAndMic: true, wavesOpacity: 0.85 });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        (visualConfig?.showWavesAndMic !== false && currentWavesOpacity > 0.05)
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                          : 'bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white'
                      }`}
                    >
                      {(visualConfig?.showWavesAndMic !== false && currentWavesOpacity > 0.05) ? '✓ ACTIVADAS' : 'DESACTIVADAS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateVisual({ showWavesAndMic: true, wavesOpacity: 0.85 })}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      title="Restaurar ondas al 85% de opacidad y activar micrófono reactivo"
                    >
                      Restaurar (85%)
                    </button>
                  </div>
                </div>
              </div>

              {/* Slider 4: Waves & Listening Animation Opacity */}
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold flex items-center gap-2">
                    <Activity size={14} className="text-blue-400" />
                    Transparencia de la Animación de Escucha y Ondas:
                  </span>
                  <span className="text-blue-400 font-mono font-bold text-xs">
                    {Math.round(currentWavesOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentWavesOpacity}
                  onChange={(e) => handleUpdateVisual({ wavesOpacity: parseFloat(e.target.value), showWavesAndMic: parseFloat(e.target.value) > 0.01 })}
                  className="w-full accent-blue-500 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400 flex justify-between">
                  <span>0% (Inaudible / Ocultas)</span>
                  <span>100% (Presencia máxima)</span>
                </div>
              </div>

              {/* 32 Animated Orb Styles Gallery (Including Album Cover & Artist Photo Orbs) */}
              <div className="p-4 rounded-xl bg-black/70 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Estilos de Orbes Reactivos (32 Modelos - Carátula & Artista)
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Selecciona entre 32 arqueotipos dinámicos, incluyendo orbes con disco de vinilo giratorio, proyector holográfico, diafragma cibernético, ecualizador radial y la foto o carátula del artista.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-500/40">
                    {ORB_STYLES_INFO.find(o => o.id === (visualConfig?.orbStyle || 'classic_core'))?.name || 'Clásico'}
                  </span>
                </div>

                {/* Grid of 32 Orb Styles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-72 overflow-y-auto pr-1">
                  {ORB_STYLES_INFO.map((orb) => {
                    const isSelected = (visualConfig?.orbStyle || 'classic_core') === orb.id;
                    return (
                      <button
                        key={orb.id}
                        type="button"
                        onClick={() => handleUpdateVisual({
                          orbStyle: orb.id,
                        })}
                        className={`p-2.5 rounded-lg text-left transition-all border cursor-pointer relative group ${
                          isSelected
                            ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-gray-200 group-hover:text-white'}`}>
                            {orb.badge}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                            isSelected ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' : 'bg-white/5 text-gray-400'
                          }`}>
                            {orb.category}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-white truncate">
                          {orb.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">
                          {orb.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Orb Scale / Size Slider and Quick Presets */}
                <div className="pt-3 border-t border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-200 font-semibold flex items-center gap-2">
                      <Maximize2 size={14} className="text-amber-400" />
                      Tamaño / Escala del Orbe Reactivo:
                    </span>
                    <span className="text-amber-400 font-mono font-bold text-xs">
                      {Math.round((visualConfig?.orbScale ?? 1.0) * 100)}% ({Math.round(184 * (visualConfig?.orbScale ?? 1.0))}px)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="2.6"
                    step="0.05"
                    value={visualConfig?.orbScale ?? 1.0}
                    onChange={(e) => handleUpdateVisual({ orbScale: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-1 flex-wrap pt-1">
                    <div className="text-[11px] text-gray-400">
                      <span>💡 <em>Consejo:</em> También puedes pasar el cursor sobre el orbe para redimensionarlo con la rueda del ratón o arrastrando las esquinas.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[0.7, 1.0, 1.4, 1.8, 2.2].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleUpdateVisual({ orbScale: s })}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
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

                {/* Comportamiento de Aparición del Orbe */}
                <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div>
                    <span className="text-gray-200 font-semibold text-xs flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      Aparición del Orbe en Pantalla:
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {visualConfig?.showOrbOnlyOnWakeWord !== false
                        ? 'El orbe y la animación de micrófono aparecen exclusivamente cuando el sistema detecta la palabra clave ("Música") o al pulsar hablar.'
                        : 'El orbe se mantiene permanentemente visible en pantalla en todo momento.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ showOrbOnlyOnWakeWord: !(visualConfig?.showOrbOnlyOnWakeWord !== false) })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                      visualConfig?.showOrbOnlyOnWakeWord !== false
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {visualConfig?.showOrbOnlyOnWakeWord !== false ? '⚡ SOLO CON PALABRA CLAVE' : '👁️ SIEMPRE VISIBLE'}
                  </button>
                </div>
              </div>

              {/* 24 Animated Wave Styles Gallery */}
              <div className="p-4 rounded-xl bg-black/70 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Estilos de Ondas Animadas (24 Modelos)
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Elige entre 24 animaciones reactivas a la música y al micrófono con estética OLED futurista.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-500/40">
                    {WAVE_STYLES_INFO.find(w => w.id === (visualConfig?.waveStyle || 'sine_harmonic'))?.name || 'Armónico Doble'}
                  </span>
                </div>

                {/* Grid of 24 styles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-72 overflow-y-auto pr-1">
                  {WAVE_STYLES_INFO.map((style) => {
                    const isSelected = (visualConfig?.waveStyle || 'sine_harmonic') === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => handleUpdateVisual({
                          waveStyle: style.id,
                          showWavesAndMic: true,
                          wavesOpacity: Math.max(0.4, currentWavesOpacity)
                        })}
                        className={`p-2.5 rounded-lg text-left transition-all border cursor-pointer relative group ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-gray-200 group-hover:text-white'}`}>
                            {style.badge}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                            isSelected ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40' : 'bg-white/5 text-gray-400'
                          }`}>
                            {style.category}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-white truncate">
                          {style.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">
                          {style.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Wave Scaling & Screen Size Control */}
              <div className="p-4 rounded-xl bg-black/70 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Maximize2 size={16} className="text-purple-400" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Tamaño y Escala Libre por Pantalla
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Ajusta libremente la escala, amplitud y cobertura de las ondas en cualquier tamaño de monitor o pantalla.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-md border border-purple-500/40">
                    {Math.round((visualConfig?.waveScale ?? 1.0) * 100)}%
                  </span>
                </div>

                {/* Wave Scale Slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>Multiplicador de Escala de Ondas:</span>
                    <span className="font-mono text-purple-400 font-bold">{(visualConfig?.waveScale ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={visualConfig?.waveScale ?? 1.0}
                    onChange={(e) => handleUpdateVisual({ waveScale: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>20% (Muy compacto)</span>
                    <span>100% (Estándar)</span>
                    <span>300% (Extra gigante)</span>
                  </div>

                  {/* Quick Scale Presets */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Presets de escala:</span>
                    {[
                      { label: '50% Mini', val: 0.5 },
                      { label: '80% Compacto', val: 0.8 },
                      { label: '100% Normal', val: 1.0 },
                      { label: '140% Amplio', val: 1.4 },
                      { label: '200% Gigante', val: 2.0 },
                      { label: '250% Max', val: 2.5 },
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handleUpdateVisual({ waveScale: p.val })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                          Math.abs((visualConfig?.waveScale ?? 1.0) - p.val) < 0.05
                            ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                            : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wave Render Height & Fullscreen toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  {/* Wave Height */}
                  <div className="p-3 rounded-lg bg-black/50 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Altura del Canvas:</span>
                      <span className="font-mono text-purple-400 font-bold">{visualConfig?.waveHeight ?? 320}px</span>
                    </div>
                    <input
                      type="range"
                      min="140"
                      max="720"
                      step="20"
                      value={visualConfig?.waveHeight ?? 320}
                      onChange={(e) => handleUpdateVisual({ waveHeight: parseInt(e.target.value, 10) })}
                      className="w-full accent-purple-500 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>140px (Bajo)</span>
                      <span>320px (Normal)</span>
                      <span>720px (Pantalla Alta)</span>
                    </div>
                  </div>

                  {/* Wave Fullscreen Option */}
                  <div className="p-3 rounded-lg bg-black/50 border border-white/5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Tv size={14} className="text-purple-400" />
                        Ondas a Pantalla Completa (100%)
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                        Permite que el canvas de ondas se extienda de borde a borde por toda la ventana.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={visualConfig?.waveFullscreen ?? false}
                      onChange={(e) => handleUpdateVisual({ waveFullscreen: e.target.checked })}
                      className="accent-purple-500 w-5 h-5 rounded cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* Slider 4B: Orb Body Transparency & Animation Opacity */}
              <div className="p-3 rounded-lg bg-black/60 border border-red-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-red-500" />
                    Transparencia de la Animación del Orbe Central:
                  </span>
                  <span className="text-red-400 font-mono font-bold text-xs">
                    {Math.round(currentOrbOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentOrbOpacity}
                  onChange={(e) => handleUpdateVisual({ orbOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-red-600 bg-white/10 rounded-lg cursor-pointer"
                  title="Ajusta la visibilidad del cuerpo del orbe interactivo (0% a 100%)"
                />
                <div className="text-[11px] text-gray-400 flex justify-between">
                  <span>0% (Completamente transparente / solo video)</span>
                  <span>100% (Orbe HUD nítido)</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400">Acceso rápido:</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ orbOpacity: 0.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentOrbOpacity === 0.0 ? 'bg-red-500/20 text-red-300 border-red-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    0% Oculto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ orbOpacity: 0.35 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentOrbOpacity === 0.35 ? 'bg-red-500/20 text-red-300 border-red-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    35% Sutil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ orbOpacity: 0.70 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentOrbOpacity === 0.70 ? 'bg-red-500/20 text-red-300 border-red-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    70% Equilibrado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateVisual({ orbOpacity: 1.0 })}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${currentOrbOpacity === 1.0 ? 'bg-red-500/20 text-red-300 border-red-400/50' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'}`}
                  >
                    100% Nítido
                  </button>
                </div>
              </div>

              {/* Slider 5: Top Black Blur / Gradient */}
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold">
                    Difuminación Negra Superior (Gradiente Arriba):
                  </span>
                  <span className="text-gray-300 font-mono font-bold text-xs">
                    {Math.round(currentTopFade * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentTopFade}
                  onChange={(e) => handleUpdateVisual({ topFadeOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-white bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400">
                  Oscurece la zona superior detrás de la barra de navegación para mejorar el contraste.
                </div>
              </div>

              {/* Slider 6: Bottom Black Blur / Gradient */}
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-200 font-semibold">
                    Difuminación Negra Inferior (Gradiente Abajo):
                  </span>
                  <span className="text-gray-300 font-mono font-bold text-xs">
                    {Math.round(currentBottomFade * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentBottomFade}
                  onChange={(e) => handleUpdateVisual({ bottomFadeOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-white bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400">
                  Oscurece la zona inferior detrás de la barra de información para maximizar la legibilidad en carretera.
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Chrome Extensions & Hardware Media Compatibility Section */}
          <CollapsibleSection
            id="media_compatibility"
            title="Compatibilidad Multimedia y Teclas de Hardware"
            icon={<ShieldCheck size={16} />}
            summary="Control de volumen interno exclusivo (0 a 15) mediante teclado, atajos y mandos de consola (Xbox/PlayStation) sin alterar Windows"
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                TECLADO / MANDOS
              </span>
            }
            isExpanded={!!expandedSections['media_compatibility']}
            onToggle={() => toggleSection('media_compatibility')}
          >
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Los cambios de volumen desde teclado o mando ahora actúan <strong className="text-white">directamente sobre el reproductor interno de SerchTube (0 a 15)</strong> con feedback sonoro y visual, evitando mover el mezclador maestro de Windows:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-gray-300">
              <div className="p-2 bg-black/60 rounded border border-white/10 space-y-1">
                <div className="text-red-400 font-bold flex items-center gap-1.5">
                  <span>⌨️ Teclado:</span>
                </div>
                <div className="text-gray-300 text-[10.5px]">
                  • <strong className="text-white">Teclas Vol / Ctrl + ↑ / ↓:</strong> Subir / Bajar volumen<br />
                  • <strong className="text-white">PageUp / PageDown / + -:</strong> Vol + / Vol -<br />
                  • <strong className="text-white">Ctrl + M / Vol Mute:</strong> Silenciar / Reactivar
                </div>
              </div>

              <div className="p-2 bg-black/60 rounded border border-white/10 space-y-1">
                <div className="text-blue-400 font-bold flex items-center gap-1.5">
                  <span>🎮 Mandos / Controles (Xbox, PS, USB):</span>
                </div>
                <div className="text-gray-300 text-[10.5px]">
                  • <strong className="text-white">D-Pad Arriba / RB:</strong> Subir volumen app<br />
                  • <strong className="text-white">D-Pad Abajo / LB:</strong> Bajar volumen app<br />
                  • <strong className="text-white">D-Pad Izq / Der:</strong> Canción anterior / siguiente<br />
                  • <strong className="text-white">Botón A / Start / L3:</strong> Play / Pausa / Mute
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black border-t border-white/10 flex items-center justify-between">
          {onOpenNodeSync ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNodeSync();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <Wifi size={14} className="text-blue-400" />
              <span>Sincronización LAN / Nodos</span>
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>

    </div>
  );
};

export const SettingsModal = React.memo(SettingsModalComponent);
