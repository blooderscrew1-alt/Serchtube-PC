import { EqualizerSettings } from '../types';

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private audioCtx: AudioContext | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private presenceFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private bassBoostFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Bluetooth keep-alive
  private keepAliveInterval: any = null;
  private isKeepAliveActive = false;

  // Audio Ducking state and watchdog
  private isDucked = false;
  private duckingWatchdogTimer: any = null;
  private originalVolumeBeforeDucking = 100;
  private duckingEnabled = true;
  private onDuckingChangeCallback?: (isDucked: boolean, duckedVolume: number) => void;

  private constructor() {
    // Initialized on first user interaction
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public init() {
    if (this.audioCtx) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();

      // Create Multiband Filters
      // 1. Bass: Lowshelf around 100Hz
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 100;

      // 2. Mid: Peaking around 1000Hz
      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1.0;

      // 3. Presence: Peaking around 3500Hz
      this.presenceFilter = this.audioCtx.createBiquadFilter();
      this.presenceFilter.type = 'peaking';
      this.presenceFilter.frequency.value = 3500;
      this.presenceFilter.Q.value = 1.2;

      // 4. Treble: Highshelf around 9000Hz
      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 9000;

      // 5. Bass Boost filter (low-frequency punch at 60Hz)
      this.bassBoostFilter = this.audioCtx.createBiquadFilter();
      this.bassBoostFilter.type = 'peaking';
      this.bassBoostFilter.frequency.value = 60;
      this.bassBoostFilter.Q.value = 1.4;
      this.bassBoostFilter.gain.value = 0;

      // 6. Loudness Enhancer Dynamics Compressor
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.audioCtx.currentTime);
      this.compressor.release.setValueAtTime(0.08, this.audioCtx.currentTime);

      // 7. Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // Chain connections
      this.bassFilter
        .connect(this.midFilter)
        .connect(this.presenceFilter)
        .connect(this.trebleFilter)
        .connect(this.bassBoostFilter)
        .connect(this.compressor)
        .connect(this.masterGain)
        .connect(this.audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio API init error:", e);
    }
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Update EQ bands and DSP
  public applySettings(settings: EqualizerSettings) {
    this.init();
    if (!this.audioCtx) return;

    const isEqEnabled = settings.enabled !== false;

    if (!isEqEnabled) {
      // MODO BYPASS: Ecualizador desactivado (curva plana a 0 dB y sin compresión)
      if (this.bassFilter) this.bassFilter.gain.value = 0;
      if (this.midFilter) this.midFilter.gain.value = 0;
      if (this.presenceFilter) this.presenceFilter.gain.value = 0;
      if (this.trebleFilter) this.trebleFilter.gain.value = 0;
      if (this.bassBoostFilter) this.bassBoostFilter.gain.value = 0;

      if (this.compressor) {
        this.compressor.threshold.setValueAtTime(0, this.audioCtx.currentTime);
        this.compressor.ratio.setValueAtTime(1, this.audioCtx.currentTime);
      }
    } else {
      // MODO ACTIVO: Aplicar bandas y mejoras DSP
      if (this.bassFilter) this.bassFilter.gain.value = settings.bass;
      if (this.midFilter) this.midFilter.gain.value = settings.mid;
      if (this.presenceFilter) this.presenceFilter.gain.value = settings.presence;
      if (this.trebleFilter) this.trebleFilter.gain.value = settings.treble;

      if (this.bassBoostFilter) {
        this.bassBoostFilter.gain.value = settings.bassBoost ? (settings.bassBoostLevel / 100) * 9 : 0;
      }

      if (this.compressor) {
        // Toggle compression / loudness
        if (settings.loudnessEnhancer) {
          this.compressor.threshold.setValueAtTime(-24, this.audioCtx.currentTime);
          this.compressor.ratio.setValueAtTime(6, this.audioCtx.currentTime);
        } else {
          this.compressor.threshold.setValueAtTime(0, this.audioCtx.currentTime);
          this.compressor.ratio.setValueAtTime(1, this.audioCtx.currentTime);
        }
      }
    }

    // Bluetooth Keep-Alive
    if (settings.bluetoothKeepAlive) {
      this.startBluetoothKeepAlive(settings.keepAliveIntervalSeconds || 20);
    } else {
      this.stopBluetoothKeepAlive();
    }
  }

  // Bluetooth Keep-Alive: inaudible ultrasonic/infrasonic pulse to keep Bluetooth DACs awake
  public startBluetoothKeepAlive(intervalSeconds: number = 20) {
    if (this.isKeepAliveActive) return;
    this.isKeepAliveActive = true;

    this.keepAliveInterval = setInterval(() => {
      this.playInaudibleTone();
    }, intervalSeconds * 1000);
  }

  public stopBluetoothKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.isKeepAliveActive = false;
  }

  private playInaudibleTone() {
    try {
      this.init();
      if (!this.audioCtx) return;
      this.resume();

      // 19Hz tone at -60dB (imperceptible to human ear, but provides digital audio buffer stream)
      const osc = this.audioCtx.createOscillator();
      const toneGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(19, this.audioCtx.currentTime); // Infrasonic

      toneGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime); // Very low gain (-60dB)
      toneGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.3);

      osc.connect(toneGain);
      toneGain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch (e) {
      // Ignored
    }
  }

  // Audio Ducking with Anti-Lock Watchdog
  public setDuckingCallback(callback: (isDucked: boolean, duckedVolume: number) => void) {
    this.onDuckingChangeCallback = callback;
  }

  public setDuckingEnabled(enabled: boolean) {
    this.duckingEnabled = enabled;
  }

  public startDucking(currentVolume: number) {
    if (!this.duckingEnabled) return;
    if (this.isDucked) return;

    this.isDucked = true;
    this.originalVolumeBeforeDucking = currentVolume;

    // Silencio TOTAL (0%): el microfono de la PC llega a confundir palabras de la
    // musica con comandos; con 20% todavia se colaban. Se restaura al terminar.
    const duckedVol = 0;
    this.onDuckingChangeCallback?.(true, duckedVol);

    // Watchdog: Clear ducking after 7 seconds unconditionally in case speech recognition hangs
    if (this.duckingWatchdogTimer) clearTimeout(this.duckingWatchdogTimer);
    this.duckingWatchdogTimer = setTimeout(() => {
      this.stopDucking();
    }, 7000);
  }

  public stopDucking() {
    if (!this.isDucked) return;
    this.isDucked = false;

    if (this.duckingWatchdogTimer) {
      clearTimeout(this.duckingWatchdogTimer);
      this.duckingWatchdogTimer = null;
    }

    this.onDuckingChangeCallback?.(false, this.originalVolumeBeforeDucking);
  }

  /**
   * Emits a crisp, pleasant audio beep (e.g. for volume confirmation without interrupting TTS voice)
   */
  public playBeep(type: 'up' | 'down' | 'neutral' = 'neutral') {
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      let startFreq = 700;
      let endFreq = 700;

      if (type === 'up') {
        startFreq = 560;
        endFreq = 840;
      } else if (type === 'down') {
        startFreq = 760;
        endFreq = 480;
      }

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      if (startFreq !== endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {
      console.warn("AudioEngine playBeep error:", e);
    }
  }
}

export const PRESET_EQUALIZERS: Record<string, { bass: number; mid: number; presence: number; treble: number }> = {
  'Hi-Fi': { bass: 0, mid: 0, presence: 0, treble: 0 },
  'Bass Boost': { bass: 9, mid: 1, presence: -1, treble: 2 },
  'Rock': { bass: 6, mid: -2, presence: 4, treble: 6 },
  'Pop': { bass: 4, mid: 3, presence: 3, treble: 5 },
  'Cine': { bass: 7, mid: 1, presence: 3, treble: 7 },
  'Vocal': { bass: -2, mid: 6, presence: 5, treble: 1 },
  'Conducción Nocturna': { bass: 5, mid: 2, presence: 1, treble: 3 },
  'Zen / Relax': { bass: 3, mid: -1, presence: -2, treble: -1 }
};
