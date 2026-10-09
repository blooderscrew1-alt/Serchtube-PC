import React, { useState, useEffect } from 'react';
import { EqualizerSettings, AutoVolumeReducerConfig } from '../types';
import { PRESET_EQUALIZERS } from '../services/audioEngine';
import { X, Sliders, Radio, Zap, Volume2, Power, Clock, VolumeX, ShieldCheck, Play, ArrowDown } from 'lucide-react';

interface EqualizerModalProps {
  isOpen: boolean;
  settings: EqualizerSettings;
  autoVolumeConfig?: AutoVolumeReducerConfig;
  currentVolume?: number;
  onClose: () => void;
  onUpdate: (updated: Partial<EqualizerSettings>) => void;
  onUpdateAutoVolume?: (updated: Partial<AutoVolumeReducerConfig>) => void;
  onTestAutoVolume?: () => void;
}

const PRESET_TIME_DELAYS = [
  { label: '30s', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];

const EqualizerModalComponent: React.FC<EqualizerModalProps> = ({
  isOpen,
  settings,
  autoVolumeConfig = {
    enabled: false,
    targetVolume: 5,
    delaySeconds: 15,
    onlyIfAboveTarget: true,
    smoothFade: true,
    applyOnEveryTrack: true
  },
  currentVolume = 10,
  onClose,
  onUpdate,
  onUpdateAutoVolume,
  onTestAutoVolume
}) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'auto_volume'>('eq');
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTestCountdown(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isEqEnabled = settings.enabled !== false;

  const handlePresetSelect = (presetName: string) => {
    if (!isEqEnabled) return;
    const presetValues = PRESET_EQUALIZERS[presetName];
    if (presetValues) {
      onUpdate({
        preset: presetName,
        bass: presetValues.bass,
        mid: presetValues.mid,
        presence: presetValues.presence,
        treble: presetValues.treble
      });
    }
  };

  const handleTriggerTest = () => {
    if (testCountdown !== null) return;
    setTestCountdown(3);
    const interval = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          onTestAutoVolume?.();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatDelayTime = (secs: number) => {
    if (secs < 60) return `${secs} segundos`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return remSecs > 0 ? `${mins} min ${remSecs}s` : `${mins} minuto${mins > 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-black/95 border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
              isEqEnabled 
                ? 'bg-red-600/20 text-red-500 border-red-600/30 shadow-[0_0_12px_rgba(220,38,38,0.3)]' 
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase">Ecualizador & Control de Volumen</h2>
              <p className="text-xs text-gray-400">Interruptor general, bandas DSP y bajada automática</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/[0.02] px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('eq')}
            className={`pb-3 px-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'eq'
                ? 'border-red-500 text-white font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders size={14} className={isEqEnabled ? 'text-red-500' : 'text-gray-500'} />
            <span>Ecualizador DSP</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-normal ${
              isEqEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-gray-400'
            }`}>
              {isEqEnabled ? 'ON' : 'BYPASS'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auto_volume')}
            className={`pb-3 px-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'auto_volume'
                ? 'border-blue-500 text-white font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock size={14} className={autoVolumeConfig.enabled ? 'text-blue-400' : 'text-gray-500'} />
            <span>Bajar Volumen tras Tiempo</span>
            {autoVolumeConfig.enabled && (
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {activeTab === 'eq' && (
            <>
              {/* Alcance real del ecualizador (honestidad con el usuario) */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="text-[11px] font-semibold text-amber-200 mb-1">
                  Este ecualizador procesa la voz del asistente y los avisos, no la música de YouTube
                </div>
                <div className="text-[10px] text-amber-100/80 leading-relaxed">
                  El navegador no permite procesar el audio de un reproductor incrustado (iframe) por
                  seguridad. Para ecualizar la música usa un EQ del sistema (Equalizer APO, gratis,
                  aplica a todo el sonido de Windows) o una extensión que procese el audio de la pestaña.
                </div>
              </div>

              {/* MASTER EQUALIZER TOGGLE SWITCH BANNER */}
              <div className={`p-4 rounded-xl border transition-all ${
                isEqEnabled
                  ? 'bg-gradient-to-r from-red-950/40 via-red-900/10 to-black border-red-500/40 shadow-[0_0_20px_rgba(220,38,38,0.15)]'
                  : 'bg-white/5 border-white/10 opacity-90'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      isEqEnabled
                        ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                        : 'bg-white/10 text-gray-400 border-white/10'
                    }`}>
                      <Power size={20} className={isEqEnabled ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">
                          Interruptor General del Ecualizador
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                          isEqEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/10 text-gray-400 border-white/10'
                        }`}>
                          {isEqEnabled ? '● ACTIVADO' : '○ DESACTIVADO (BYPASS)'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isEqEnabled
                          ? 'El audio está siendo procesado con las bandas de frecuencia y filtros DSP.'
                          : 'El ecualizador está apagado. El audio se reproduce directo y plano (bypass sin filtros).'}
                      </p>
                    </div>
                  </div>

                  {/* Big Toggle Switch Button */}
                  <button
                    type="button"
                    onClick={() => onUpdate({ enabled: !isEqEnabled })}
                    className={`w-14 h-8 rounded-full transition-all relative cursor-pointer flex-shrink-0 p-1 ${
                      isEqEnabled
                        ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]'
                        : 'bg-white/20 hover:bg-white/30'
                    }`}
                    title={isEqEnabled ? 'Apagar ecualizador (Bypass)' : 'Encender ecualizador'}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${
                        isEqEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    >
                      <Power size={12} className={isEqEnabled ? 'text-red-600' : 'text-gray-600'} />
                    </div>
                  </button>
                </div>
              </div>

              {/* EQ Presets & Sliders Container with Disabled State when EQ is OFF */}
              <div className={`space-y-6 transition-opacity ${!isEqEnabled ? 'opacity-40 pointer-events-none select-none grayscale-[60%]' : ''}`}>
                {/* Preset Buttons */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block">
                      Perfiles Predefinidos
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Perfil actual: <strong className="text-white">{settings.preset}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.keys(PRESET_EQUALIZERS).map((pName) => (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => handlePresetSelect(pName)}
                        disabled={!isEqEnabled}
                        className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-center cursor-pointer ${
                          settings.preset === pName && isEqEnabled
                            ? 'bg-red-600 text-white border-red-600 font-bold shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        {pName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4-Band Sliders */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                    <span>Bandas de Frecuencia</span>
                    <span className="text-[10px] text-gray-500 font-mono">Rango: -12dB a +12dB</span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-center">
                    {/* Bass */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs text-red-500 font-mono font-semibold">
                        {settings.bass > 0 ? `+${settings.bass}` : settings.bass} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        disabled={!isEqEnabled}
                        value={settings.bass}
                        onChange={(e) => onUpdate({ bass: parseInt(e.target.value, 10), preset: 'Personalizado' })}
                        className="w-full h-24 accent-red-600 bg-white/10 rounded-lg cursor-pointer appearance-none [writing-mode:vertical-lr] [direction:rtl]"
                      />
                      <span className="text-xs font-medium text-gray-300">Graves</span>
                      <span className="text-[10px] text-gray-500 font-mono">100 Hz</span>
                    </div>

                    {/* Mid */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs text-red-400 font-mono font-semibold">
                        {settings.mid > 0 ? `+${settings.mid}` : settings.mid} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        disabled={!isEqEnabled}
                        value={settings.mid}
                        onChange={(e) => onUpdate({ mid: parseInt(e.target.value, 10), preset: 'Personalizado' })}
                        className="w-full h-24 accent-red-600 bg-white/10 rounded-lg cursor-pointer appearance-none [writing-mode:vertical-lr] [direction:rtl]"
                      />
                      <span className="text-xs font-medium text-gray-300">Medios</span>
                      <span className="text-[10px] text-gray-500 font-mono">1 kHz</span>
                    </div>

                    {/* Presence */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs text-blue-400 font-mono font-semibold">
                        {settings.presence > 0 ? `+${settings.presence}` : settings.presence} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        disabled={!isEqEnabled}
                        value={settings.presence}
                        onChange={(e) => onUpdate({ presence: parseInt(e.target.value, 10), preset: 'Personalizado' })}
                        className="w-full h-24 accent-blue-500 bg-white/10 rounded-lg cursor-pointer appearance-none [writing-mode:vertical-lr] [direction:rtl]"
                      />
                      <span className="text-xs font-medium text-gray-300">Presencia</span>
                      <span className="text-[10px] text-gray-500 font-mono">3.5 kHz</span>
                    </div>

                    {/* Treble */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs text-gray-200 font-mono font-semibold">
                        {settings.treble > 0 ? `+${settings.treble}` : settings.treble} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        disabled={!isEqEnabled}
                        value={settings.treble}
                        onChange={(e) => onUpdate({ treble: parseInt(e.target.value, 10), preset: 'Personalizado' })}
                        className="w-full h-24 accent-white bg-white/10 rounded-lg cursor-pointer appearance-none [writing-mode:vertical-lr] [direction:rtl]"
                      />
                      <span className="text-xs font-medium text-gray-300">Agudos</span>
                      <span className="text-[10px] text-gray-500 font-mono">9 kHz</span>
                    </div>
                  </div>
                </div>

                {/* Bass Boost & Loudness Enhancer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center">
                        <Zap size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Refuerzo de Graves (Bass Boost)</div>
                        <div className="text-xs text-gray-400">Pegada profunda de sub-graves sin distorsión (60Hz)</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!isEqEnabled}
                      onClick={() => onUpdate({ bassBoost: !settings.bassBoost })}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.bassBoost && isEqEnabled ? 'bg-red-600' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.bassBoost && isEqEnabled ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Volume2 size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Loudness Enhancer Dinámico</div>
                        <div className="text-xs text-gray-400">Compresor multibanda que nivela la ganancia en marcha</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!isEqEnabled}
                      onClick={() => onUpdate({ loudnessEnhancer: !settings.loudnessEnhancer })}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.loudnessEnhancer && isEqEnabled ? 'bg-blue-500' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.loudnessEnhancer && isEqEnabled ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Bluetooth Keep-Alive */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
                        <Radio size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Modo Bluetooth Keep-Alive</div>
                        <div className="text-xs text-gray-400">
                          Emite pulsos inaudibles de 19Hz para evitar suspensión o cortes en altavoces del coche
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdate({ bluetoothKeepAlive: !settings.bluetoothKeepAlive })}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.bluetoothKeepAlive ? 'bg-green-500' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.bluetoothKeepAlive ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'auto_volume' && (
            <div className="space-y-5">
              {/* MASTER AUTO VOLUME LOWERING SWITCH */}
              <div className={`p-4 rounded-xl border transition-all ${
                autoVolumeConfig.enabled
                  ? 'bg-gradient-to-r from-blue-950/40 via-blue-900/15 to-black border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      autoVolumeConfig.enabled
                        ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                        : 'bg-white/10 text-gray-400 border-white/10'
                    }`}>
                      <Clock size={20} className={autoVolumeConfig.enabled ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">
                          Bajar Volumen por Inactividad sin Música
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                          autoVolumeConfig.enabled
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-white/10 text-gray-400 border-white/10'
                        }`}>
                          {autoVolumeConfig.enabled ? '● ACTIVADO' : '○ DESACTIVADO'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Si la música está pausada o detenida, tras el tiempo establecido baja el volumen a un nivel seguro para no asustarte al volver a reproducir.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateAutoVolume?.({ enabled: !autoVolumeConfig.enabled })}
                    className={`w-14 h-8 rounded-full transition-all relative cursor-pointer flex-shrink-0 p-1 ${
                      autoVolumeConfig.enabled
                        ? 'bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.6)]'
                        : 'bg-white/20 hover:bg-white/30'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${
                        autoVolumeConfig.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    >
                      <ArrowDown size={12} className={autoVolumeConfig.enabled ? 'text-blue-600' : 'text-gray-600'} />
                    </div>
                  </button>
                </div>
              </div>

              {/* TARGET VOLUME SLIDER */}
              <div className={`p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 transition-opacity ${
                !autoVolumeConfig.enabled ? 'opacity-50' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      1. Volumen Seguro de Descanso
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Volumen actual: <strong className="text-gray-300 font-mono">{currentVolume}/15</strong></span>
                    <span className="text-sm font-mono font-bold text-blue-400 bg-blue-600/10 px-2.5 py-0.5 rounded border border-blue-500/30">
                      {autoVolumeConfig.targetVolume}/15 ({Math.round((autoVolumeConfig.targetVolume / 15) * 100)}%)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Nivel de volumen seguro al que se bajará el equipo tras el tiempo de descanso sin música.
                </p>

                <div className="space-y-2 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    disabled={!autoVolumeConfig.enabled}
                    value={autoVolumeConfig.targetVolume}
                    onChange={(e) => onUpdateAutoVolume?.({ targetVolume: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>0 (Silencio)</span>
                    <span className="text-blue-400 font-semibold">4 - 5 (Recomendado)</span>
                    <span>10 (Medio)</span>
                    <span>15 (Máximo)</span>
                  </div>
                </div>
              </div>

              {/* DELAY TIME SELECTOR */}
              <div className={`p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 transition-opacity ${
                !autoVolumeConfig.enabled ? 'opacity-50' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      2. Tiempo de Inactividad sin Música
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-amber-400 bg-amber-600/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                    {formatDelayTime(autoVolumeConfig.delaySeconds)}
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  Tras este tiempo sin reproducir canciones, el volumen se atenúa automáticamente.
                </p>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {PRESET_TIME_DELAYS.map((p) => {
                    const isSelected = autoVolumeConfig.delaySeconds === p.seconds;
                    return (
                      <button
                        key={p.seconds}
                        type="button"
                        disabled={!autoVolumeConfig.enabled}
                        onClick={() => onUpdateAutoVolume?.({ delaySeconds: p.seconds })}
                        className={`py-2 px-2 rounded-lg text-xs font-mono border transition-all text-center cursor-pointer ${
                          isSelected && autoVolumeConfig.enabled
                            ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-[0_0_12px_rgba(217,119,6,0.3)]'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Precision Slider */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Ajuste personalizado preciso:</span>
                    <span className="font-mono text-white">{autoVolumeConfig.delaySeconds} segundos ({Math.round(autoVolumeConfig.delaySeconds / 60)} min)</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="900"
                    step="10"
                    disabled={!autoVolumeConfig.enabled}
                    value={autoVolumeConfig.delaySeconds}
                    onChange={(e) => onUpdateAutoVolume?.({ delaySeconds: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* ADDITIONAL OPTIONS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Bajar solo si el volumen actual es más alto</div>
                      <div className="text-[10px] text-gray-400">Si el volumen ya estaba bajito, no lo sube al objetivo</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateAutoVolume?.({ onlyIfAboveTarget: !autoVolumeConfig.onlyIfAboveTarget })}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoVolumeConfig.onlyIfAboveTarget ? 'bg-emerald-500' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        autoVolumeConfig.onlyIfAboveTarget ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Sliders size={16} className="text-blue-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Transición suave (Fading progresivo)</div>
                      <div className="text-[10px] text-gray-400">Atenúa el volumen suavemente durante 2 segundos sin cortes bruscos</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateAutoVolume?.({ smoothFade: !autoVolumeConfig.smoothFade })}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoVolumeConfig.smoothFade ? 'bg-blue-500' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        autoVolumeConfig.smoothFade ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Zap size={16} className="text-purple-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Aplicar en cada nueva canción</div>
                      <div className="text-[10px] text-gray-400">Inicia la cuenta regresiva automáticamente cada vez que empiece un tema</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateAutoVolume?.({ applyOnEveryTrack: !autoVolumeConfig.applyOnEveryTrack })}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoVolumeConfig.applyOnEveryTrack ? 'bg-purple-500' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        autoVolumeConfig.applyOnEveryTrack ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* TEST TRIGGER BUTTON */}
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Probar Atenuación en Directo</div>
                  <div className="text-[11px] text-gray-400">Comprueba cómo sonará la bajada automática a volumen {autoVolumeConfig.targetVolume}/15.</div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerTest}
                  disabled={testCountdown !== null}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                    testCountdown !== null
                      ? 'bg-amber-600 text-white animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  }`}
                >
                  {testCountdown !== null ? (
                    <>
                      <Clock size={14} className="animate-spin" />
                      <span>Bajando en {testCountdown}s...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Probar en 3s</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            {activeTab === 'eq' ? (
              <span>Estado: <strong className={isEqEnabled ? 'text-emerald-400' : 'text-gray-400'}>{isEqEnabled ? 'DSP Activo' : 'Bypass Plano'}</strong></span>
            ) : (
              <span>Reducción: <strong className={autoVolumeConfig.enabled ? 'text-blue-400' : 'text-gray-400'}>{autoVolumeConfig.enabled ? `Activa (${autoVolumeConfig.targetVolume}/15 en ${autoVolumeConfig.delaySeconds}s)` : 'Desactivada'}</strong></span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export const EqualizerModal = React.memo(EqualizerModalComponent);

