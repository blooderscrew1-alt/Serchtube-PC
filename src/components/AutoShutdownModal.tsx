import React, { useState, useEffect } from 'react';
import { AutoShutdownConfig, AutoShutdownMode } from '../types';
import {
  AUTO_SHUTDOWN_MODES_INFO,
  getMsUntilTargetTime,
  executeSystemShutdown
} from '../services/autoShutdownService';
import {
  X,
  Power,
  Moon,
  VolumeX,
  Lock,
  Clock,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertTriangle,
  Volume2
} from 'lucide-react';

interface AutoShutdownModalProps {
  isOpen: boolean;
  config: AutoShutdownConfig;
  onClose: () => void;
  onUpdateConfig: (updated: Partial<AutoShutdownConfig>) => void;
  onTriggerTestWarning?: () => void;
  onExecuteShutdownNow?: () => void;
}

const PRESET_TIMES = [
  { label: '22:00 (10 PM)', value: '22:00' },
  { label: '22:30', value: '22:30' },
  { label: '23:00 (11 PM)', value: '23:00' },
  { label: '23:30', value: '23:30' },
  { label: '00:00 (12 AM)', value: '00:00' },
  { label: '00:30', value: '00:30' },
  { label: '01:00 (1 AM)', value: '01:00' },
  { label: '02:00 (2 AM)', value: '02:00' }
];

const DAYS_NAMES = [
  { day: 1, short: 'Lun', full: 'Lunes' },
  { day: 2, short: 'Mar', full: 'Martes' },
  { day: 3, short: 'Mié', full: 'Miércoles' },
  { day: 4, short: 'Jue', full: 'Jueves' },
  { day: 5, short: 'Vie', full: 'Viernes' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
  { day: 0, short: 'Dom', full: 'Domingo' }
];

export const AutoShutdownModal: React.FC<AutoShutdownModalProps> = ({
  isOpen,
  config,
  onClose,
  onUpdateConfig,
  onTriggerTestWarning,
  onExecuteShutdownNow
}) => {
  const [countdownText, setCountdownText] = useState<string>('');
  const [isToday, setIsToday] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    const updateTimer = () => {
      const calc = getMsUntilTargetTime(config.targetTime, config.daysOfWeek);
      setCountdownText(calc.formattedRemaining);
      setIsToday(calc.isToday);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, config.targetTime, config.daysOfWeek]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    const current = config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    let next: number[];
    if (current.includes(day)) {
      if (current.length === 1) return; // al menos 1 día seleccionado
      next = current.filter((d) => d !== day);
    } else {
      next = [...current, day].sort();
    }
    onUpdateConfig({ daysOfWeek: next });
  };

  const selectAllDays = () => {
    onUpdateConfig({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  };

  const selectWeekdays = () => {
    onUpdateConfig({ daysOfWeek: [1, 2, 3, 4, 5] });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-black/95 border border-red-500/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <Power size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
                <span>Auto-Apagado de PC / Sistema</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                  Hora Fija
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Programa el apagado, suspensión o reposo automático del ordenador a la hora que elijas
              </p>
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

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Master ON / OFF Switch */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/30 via-black to-black border border-red-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  config.enabled
                    ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                <Power size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {config.enabled ? 'Auto-Apagado Activado' : 'Auto-Apagado Desactivado'}
                </div>
                <div className="text-xs text-gray-400">
                  {config.enabled
                    ? `Programado para las ${config.targetTime} (${isToday ? 'hoy' : 'próximo día'}) • Faltan ${countdownText}`
                    : 'Activa esta opción para que la PC se apague a una hora exacta'}
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => onUpdateConfig({ enabled: !config.enabled })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${
                config.enabled ? 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.5)]' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Time Picker & Presets */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} className="text-red-400" />
                <span>Hora Específica de Apagado:</span>
              </label>
              {config.enabled && (
                <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                  ⏳ En {countdownText}
                </span>
              )}
            </div>

            {/* Big Time Input Display */}
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={config.targetTime || '23:30'}
                onChange={(e) => onUpdateConfig({ targetTime: e.target.value })}
                className="bg-black/90 border-2 border-red-500/50 rounded-xl px-4 py-2.5 text-2xl font-mono font-bold text-white focus:outline-none focus:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer"
              />
              <div className="text-xs text-gray-400">
                <span>Formato de 24 horas (HH:MM). Se ejecutará con precisión exacta según el reloj de tu PC.</span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <span className="text-[11px] text-gray-400 font-mono uppercase">Horas Rápidas Populares:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_TIMES.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onUpdateConfig({ targetTime: preset.value, enabled: true })}
                    className={`px-3 py-2 rounded-xl text-xs font-mono border transition-all cursor-pointer text-center ${
                      config.targetTime === preset.value
                        ? 'bg-red-600 text-white border-red-500 font-bold shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Shutdown Action Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-red-400" />
              <span>Modo / Acción al Llegar la Hora:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AUTO_SHUTDOWN_MODES_INFO.map((m) => {
                const isSelected = config.mode === m.id;
                const getIcon = () => {
                  switch (m.id) {
                    case 'shutdown_pc':
                      return <Power size={18} className={isSelected ? 'text-red-400' : 'text-gray-400'} />;
                    case 'sleep_pc':
                      return <Moon size={18} className={isSelected ? 'text-amber-400' : 'text-gray-400'} />;
                    case 'stop_music_sleep':
                      return <VolumeX size={18} className={isSelected ? 'text-purple-400' : 'text-gray-400'} />;
                    case 'lock_pc':
                      return <Lock size={18} className={isSelected ? 'text-blue-400' : 'text-gray-400'} />;
                  }
                };

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateConfig({ mode: m.id })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-950/40 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getIcon()}
                        <span className="text-xs font-bold text-white">{m.name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-red-400" />}
                    </div>
                    <p className="text-[11px] text-gray-400">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Days of Week Selector */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} className="text-red-400" />
                <span>Días Activos de la Semana:</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllDays}
                  className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={selectWeekdays}
                  className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
                >
                  Lun a Vie
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              {DAYS_NAMES.map((d) => {
                const isSelected = (config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(d.day);
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => toggleDay(d.day)}
                    className={`flex-1 min-w-[42px] py-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-500 shadow-sm'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    title={d.full}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warnings & Extra Audio Preferences */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3.5">
            <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>Aviso Previo & Opciones de Audio:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Warning window selector */}
              <div className="space-y-1.5">
                <span className="text-xs text-gray-300 font-medium">Avisar antes de apagar:</span>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateConfig({ warningMinutesBefore: mins })}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                        config.warningMinutesBefore === mins
                          ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume fadeout toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Atenuar Volumen Suave</span>
                  <span className="text-[10px] text-gray-400">Bajar volumen 60s antes</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ fadeVolumeBeforeShutdown: !config.fadeVolumeBeforeShutdown })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    config.fadeVolumeBeforeShutdown !== false ? 'bg-amber-600' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      config.fadeVolumeBeforeShutdown !== false ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Voice announcement toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-red-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Locución de Voz Asistida</span>
                  <span className="text-[10px] text-gray-400">La asistente avisa por voz al iniciar la cuenta atrás</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ speakWarning: !config.speakWarning })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  config.speakWarning !== false ? 'bg-red-600' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    config.speakWarning !== false ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {onTriggerTestWarning && (
              <button
                type="button"
                onClick={onTriggerTestWarning}
                className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Prueba cómo se verá y escuchará el aviso flotante de cuenta atrás"
              >
                <Play size={12} />
                <span>Probar Aviso (15s)</span>
              </button>
            )}

            {onExecuteShutdownNow && (
              <button
                type="button"
                onClick={onExecuteShutdownNow}
                className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Ejecutar el apagado del sistema de inmediato"
              >
                <Power size={12} />
                <span>Apagar PC Ahora</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
          >
            Listo / Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
