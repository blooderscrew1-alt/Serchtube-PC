import React from 'react';
import { VideoQuality } from '../types';
import { VIDEO_QUALITY_OPTIONS, PLAYBACK_SPEED_OPTIONS, getQualityOption } from '../utils/quality';
import { Check, Sparkles, Gauge, Wifi, Zap, X } from 'lucide-react';

interface QualityMenuPopoverProps {
  /** Calidad ELEGIDA por el usuario (la que se guarda y se aplica) */
  currentQuality: VideoQuality;
  /** Calidad REAL que informa YouTube ahora mismo (puede ser menor) */
  actualQuality?: string;
  availableQualities?: VideoQuality[];
  currentSpeed?: number;
  onSelectQuality: (quality: VideoQuality) => void;
  onSelectSpeed?: (speed: number) => void;
  onClose?: () => void;
}

export const QualityMenuPopover: React.FC<QualityMenuPopoverProps> = ({
  currentQuality,
  actualQuality,
  availableQualities = [],
  currentSpeed = 1.0,
  onSelectQuality,
  onSelectSpeed,
  onClose
}) => {
  const activeOpt = getQualityOption(currentQuality);
  const optReal = actualQuality ? getQualityOption(actualQuality) : null;
  const realDistinta = !!actualQuality && actualQuality !== currentQuality;

  return (
    <div className="w-80 sm:w-88 bg-black/95 border border-white/20 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-white font-sans animate-fadeIn select-none z-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Calidad y Resolución de Video
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">
              Elegida: <strong className="text-red-400">{activeOpt.badge || activeOpt.shortLabel}</strong>
              {realDistinta && (
                <>
                  {' · '}
                  reproduciendo: <strong className="text-amber-400">{optReal?.badge || actualQuality}</strong>
                </>
              )}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Quality Options List */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {VIDEO_QUALITY_OPTIONS.map((opt) => {
          const isSelected = currentQuality === opt.id;
          const isAvailable =
            opt.id === 'auto' ||
            availableQualities.length === 0 ||
            availableQualities.includes(opt.id);

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectQuality(opt.id)}
              className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                isSelected
                  ? 'bg-red-600/20 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                  : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                    isSelected
                      ? 'bg-red-600 text-white'
                      : opt.isHD
                      ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {opt.isHD ? 'HD' : opt.id === 'auto' ? 'A' : 'SD'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                    <span>{opt.label}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{opt.description}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {opt.badge && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-red-600 text-white font-bold'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {opt.badge}
                  </span>
                )}
                {isSelected && <Check size={14} className="text-red-400" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Playback Speed Selector */}
      {onSelectSpeed && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] text-gray-300 mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <Gauge size={13} className="text-blue-400" />
              Velocidad de Reproducción:
            </span>
            <span className="font-mono text-blue-400 font-bold">{currentSpeed}x</span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {PLAYBACK_SPEED_OPTIONS.map((spd) => (
              <button
                key={spd.value}
                type="button"
                onClick={() => onSelectSpeed(spd.value)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                  currentSpeed === spd.value
                    ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {spd.value}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick note on adaptive stream */}
      <div className="mt-3 pt-2 text-[10px] text-gray-400 flex items-center gap-1.5 font-mono">
        <Zap size={11} className="text-amber-400 shrink-0" />
        <span>El reproductor ajusta el bitrate de audio en máxima fidelidad.</span>
      </div>
    </div>
  );
};
