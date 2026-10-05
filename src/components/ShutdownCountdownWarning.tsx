import React, { useEffect, useState } from 'react';
import { AutoShutdownMode } from '../types';
import { Power, Moon, VolumeX, Lock, Clock, AlertTriangle, X, Play, RotateCcw } from 'lucide-react';

interface ShutdownCountdownWarningProps {
  isOpen: boolean;
  remainingSeconds: number;
  totalWarningSeconds: number;
  mode: AutoShutdownMode;
  targetTime: string;
  onPostpone: (minutes: number) => void;
  onCancel: () => void;
  onExecuteNow: () => void;
}

export const ShutdownCountdownWarning: React.FC<ShutdownCountdownWarningProps> = ({
  isOpen,
  remainingSeconds,
  totalWarningSeconds,
  mode,
  targetTime,
  onPostpone,
  onCancel,
  onExecuteNow
}) => {
  if (!isOpen || remainingSeconds <= 0) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedCountdown = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, totalWarningSeconds)) * 100));

  const getModeInfo = () => {
    switch (mode) {
      case 'shutdown_pc':
        return {
          title: 'Apagado Automático de PC',
          desc: 'El ordenador se apagará por completo para ahorrar energía.',
          icon: <Power size={20} className="text-red-400" />,
          badge: '⚡ Apagado de PC',
          glowColor: 'rgba(239,68,68,0.4)'
        };
      case 'sleep_pc':
        return {
          title: 'Suspensión / Reposo de PC',
          desc: 'El ordenador entrará en modo reposo de bajo consumo.',
          icon: <Moon size={20} className="text-amber-400" />,
          badge: '🌙 Suspensión',
          glowColor: 'rgba(245,158,11,0.4)'
        };
      case 'stop_music_sleep':
        return {
          title: 'Pausar Música & Blackout OLED',
          desc: 'Se detendrá la reproducción y la pantalla quedará en negro OLED.',
          icon: <VolumeX size={20} className="text-purple-400" />,
          badge: '🖤 Modo Reposo OLED',
          glowColor: 'rgba(168,85,247,0.4)'
        };
      case 'lock_pc':
        return {
          title: 'Bloqueo de Sesión de PC',
          desc: 'Se bloqueará la sesión del sistema operativo.',
          icon: <Lock size={20} className="text-blue-400" />,
          badge: '🔒 Bloqueo',
          glowColor: 'rgba(59,130,246,0.4)'
        };
    }
  };

  const info = getModeInfo();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-lg animate-bounce-short">
      <div className="relative overflow-hidden rounded-2xl bg-black/95 border-2 border-red-500/60 p-4 sm:p-5 shadow-[0_0_50px_rgba(220,38,38,0.5)] backdrop-blur-2xl">
        {/* Glow backdrop pulse */}
        <div
          className="absolute -inset-1 opacity-20 blur-xl pointer-events-none transition-all duration-500"
          style={{ background: info.glowColor }}
        />

        {/* Top Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-3">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/40 animate-pulse">
                {info.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    {info.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    Hora: {targetTime}
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  {info.desc}
                </p>
              </div>
            </div>

            {/* Live Giant Digits Countdown */}
            <div className="flex flex-col items-end">
              <span className="text-2xl sm:text-3xl font-mono font-black text-red-400 tracking-tight drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">
                {formattedCountdown}
              </span>
              <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">
                Restante
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10">
            {/* Postpone +15 min */}
            <button
              type="button"
              onClick={() => onPostpone(15)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Clock size={14} className="text-amber-400" />
              <span>+15 min</span>
            </button>

            {/* Postpone +30 min */}
            <button
              type="button"
              onClick={() => onPostpone(30)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Clock size={14} className="text-amber-400" />
              <span>+30 min</span>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-white/20 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <X size={14} className="text-gray-400" />
              <span>Cancelar</span>
            </button>

            {/* Execute Now */}
            <button
              type="button"
              onClick={onExecuteNow}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Power size={14} />
              <span>Apagar Ya</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
