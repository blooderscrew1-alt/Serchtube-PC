import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Check, Copy, Wifi, X, QrCode, Pause, Play, Sparkles, Type, Layers } from 'lucide-react';
import { NodeSyncService } from '../services/nodeSync';
import { detectRealDeviceIp } from '../utils/networkIp';

interface AnimatedQrCountdownModalProps {
  isOpen: boolean;
  durationSeconds?: number;
  onClose: () => void;
  onOpenNodeSync?: () => void;
}

export const AnimatedQrCountdownModal: React.FC<AnimatedQrCountdownModalProps> = ({
  isOpen,
  durationSeconds = 10,
  onClose,
  onOpenNodeSync
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isMinimal, setIsMinimal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('serchtube_modal_qr_minimal') === 'true';
    } catch {
      return false;
    }
  });
  const [isTransparentBg, setIsTransparentBg] = useState<boolean>(() => {
    try {
      return localStorage.getItem('serchtube_modal_qr_transparent') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMinimal = () => {
    setIsMinimal(prev => {
      const next = !prev;
      try {
        localStorage.setItem('serchtube_modal_qr_minimal', String(next));
      } catch (_) {}
      return next;
    });
  };

  const toggleTransparent = () => {
    setIsTransparentBg(prev => {
      const next = !prev;
      try {
        localStorage.setItem('serchtube_modal_qr_transparent', String(next));
      } catch (_) {}
      return next;
    });
  };

  const [room, setRoom] = useState<string>(() => {
    try {
      return localStorage.getItem('serchtube_room') || NodeSyncService.getInstance().getConfig().room || 'serchtube-master';
    } catch {
      return 'serchtube-master';
    }
  });

  const [localIp, setLocalIp] = useState<string>(() => {
    try {
      return localStorage.getItem('serchtube_local_ip') || '';
    } catch {
      return '';
    }
  });

  const [detectedIp, setDetectedIp] = useState<string>('');

  // Auto-detect real LAN IP
  useEffect(() => {
    let isMounted = true;
    detectRealDeviceIp()
      .then(res => {
        if (!isMounted) return;
        if (res.primaryIp) {
          setDetectedIp(res.primaryIp);
          if (!localIp || localIp === '192.168.1.100') {
            setLocalIp(res.primaryIp);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [localIp]);

  // Compute remote connection URL
  const remoteUrl = useMemo(() => {
    const activeRoom = room || 'serchtube-master';
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0');

    if (!isLocalhost && typeof window !== 'undefined') {
      return `${window.location.origin}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
    }

    const bestIp = localIp || detectedIp || '192.168.1.100';
    const port = (typeof window !== 'undefined' && window.location.port) ? window.location.port : '3000';
    return `http://${bestIp}:${port}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
  }, [room, localIp, detectedIp]);

  // Reset countdown whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setRemainingSeconds(durationSeconds);
      setIsPaused(false);
      setCopied(false);
    }
  }, [isOpen, durationSeconds]);

  // Active 10-second countdown with auto-dismiss
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, onClose]);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write error:', e);
    }
  };

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / durationSeconds) * 100));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`${
          isTransparentBg
            ? 'bg-black/20 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]'
            : 'bg-black/95 border border-red-500/40 shadow-[0_0_50px_rgba(220,38,38,0.3)]'
        } rounded-3xl p-5 sm:p-7 max-w-md w-full relative flex flex-col items-center text-center animate-scaleUp overflow-hidden transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Progress Bar at Top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isPaused ? 'bg-amber-400' : 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Top Controls Bar */}
        <div className="flex items-center justify-between w-full mb-2">
          {/* Left: Title or Quick Badges */}
          {!isMinimal ? (
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 shadow-sm">
                <QrCode size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>Vinculación QR</span>
                  <Sparkles size={14} className="text-amber-400 animate-pulse" />
                </h2>
                <p className="text-[11px] text-gray-400 font-mono">Control Remoto & Micrófono</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
              <Sparkles size={12} className="text-amber-400" />
              <span>Solo QR</span>
            </div>
          )}

          {/* Right: Quick Action Buttons & Close */}
          <div className="flex items-center gap-1.5">
            {/* Toggle Text: Quitar letras / Mostrar letras */}
            <button
              type="button"
              onClick={toggleMinimal}
              className={`p-1.5 px-2 rounded-xl text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                isMinimal
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={isMinimal ? "Mostrar textos completos" : "Quitar letras y dejar solo el QR"}
            >
              <Type size={11} />
              <span className="hidden sm:inline">{isMinimal ? 'Solo QR' : 'Letras'}</span>
            </button>

            {/* Toggle Transparent Background */}
            <button
              type="button"
              onClick={toggleTransparent}
              className={`p-1.5 px-2 rounded-xl text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                isTransparentBg
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={isTransparentBg ? "Fondo negro" : "Fondo transparente"}
            >
              <Layers size={11} />
              <span className="hidden sm:inline">{isTransparentBg ? 'Transparente' : 'Fondo'}</span>
            </button>

            {/* Countdown Badge */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                isPaused
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
              }`}
              title={isPaused ? 'Reanudar temporizador' : 'Pausar auto-cierre'}
            >
              {isPaused ? <Play size={11} /> : <Pause size={11} />}
              <span>{isPaused ? 'Pausado' : `${remainingSeconds}s`}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Cerrar ventana"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* High-Contrast Crisp QR Code Card */}
        <div className="relative my-2 p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.25)] flex items-center justify-center border-4 border-white">
          <QRCodeSVG
            value={remoteUrl}
            size={isMinimal ? 250 : 210}
            level="Q"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        {/* Scan Instructions (only if not minimal) */}
        {!isMinimal && (
          <div className="space-y-1 mb-3 max-w-xs text-center animate-fadeIn">
            <p className="font-bold text-xs text-white">Apunta con la cámara de tu teléfono</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Escanea el código para controlar SerchTube Music, cambiar canciones o hablar por voz desde cualquier asiento.
            </p>
          </div>
        )}

        {/* Direct URL Box & Copy Link (only if not minimal) */}
        {!isMinimal && (
          <div className="w-full flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl mb-3 text-xs font-mono text-gray-300 animate-fadeIn">
            <input
              type="text"
              readOnly
              value={remoteUrl}
              className="bg-transparent flex-1 outline-none text-gray-300 truncate select-all px-1 text-[11px]"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        )}

        {/* Footer Actions (only if not minimal) */}
        {!isMinimal && (
          <div className="w-full flex items-center justify-between pt-2 border-t border-white/10 text-xs animate-fadeIn">
            {onOpenNodeSync && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNodeSync();
                }}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] transition-colors cursor-pointer py-1"
              >
                <Wifi size={13} />
                <span>Configurar IP / Red</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-gray-200 transition-colors ml-auto cursor-pointer shadow-md"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
