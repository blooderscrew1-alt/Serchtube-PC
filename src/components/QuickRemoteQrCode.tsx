import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Maximize2, Check, Copy, Wifi, X, QrCode } from 'lucide-react';
import { NodeSyncService } from '../services/nodeSync';
import { detectRealDeviceIp } from '../utils/networkIp';

interface QuickRemoteQrCodeProps {
  onOpenNodeSync?: () => void;
  className?: string;
  compactOnMobile?: boolean;
}

export const QuickRemoteQrCode: React.FC<QuickRemoteQrCodeProps> = ({
  onOpenNodeSync,
  className = '',
  compactOnMobile = true
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // Auto-detect real LAN IP for cases where user is running on localhost/127.0.0.1
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

    // Listen for room updates from localStorage or custom events
    const handleStorageChange = () => {
      try {
        const savedRoom = localStorage.getItem('serchtube_room');
        if (savedRoom) setRoom(savedRoom);
        const savedIp = localStorage.getItem('serchtube_local_ip');
        if (savedIp) setLocalIp(savedIp);
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [localIp]);

  // Compute the optimal remote control URL for mobile devices
  const remoteUrl = useMemo(() => {
    const activeRoom = room || 'serchtube-master';
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0';

    if (!isLocalhost) {
      // Running on Cloud Run, custom domain, or directly accessed via LAN IP
      return `${window.location.origin}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
    }

    // On localhost: smartphone needs LAN IP
    const bestIp = localIp || detectedIp || '192.168.1.100';
    const port = window.location.port || '3000';
    return `http://${bestIp}:${port}/?room=${encodeURIComponent(activeRoom)}&role=satellite`;
  }, [room, localIp, detectedIp]);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      {/* Quick QR Card at bottom-left */}
      <div
        id="quick-remote-qr-card"
        onClick={() => setIsModalOpen(true)}
        className={`group relative flex items-center gap-2.5 p-1.5 sm:p-2 rounded-2xl bg-black/70 hover:bg-black/90 border border-white/15 hover:border-red-500/50 shadow-lg hover:shadow-[0_0_20px_rgba(220,38,38,0.25)] transition-all duration-300 cursor-pointer flex-shrink-0 select-none ${className}`}
        title="Escanea con tu celular para abrir el control remoto (clic para agrandar)"
      >
        {/* Crisp Large QR Code Container */}
        <div className="relative bg-white p-2 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xl group-hover:scale-[1.02] transition-transform duration-200">
          <QRCodeSVG
            value={remoteUrl}
            size={116}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#000000"
          />
          {/* Subtle expand hint on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={24} className="text-white drop-shadow" />
          </div>
        </div>

        {/* Compact Text Details */}
        <div className="flex flex-col justify-center min-w-0 max-w-[110px] pr-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[9.5px] font-black text-red-400 uppercase tracking-wider flex items-center gap-0.5 truncate">
              <Smartphone size={11} className="text-red-400 shrink-0" />
              Control
            </span>
          </div>

          <h3 className="text-xs font-bold text-white tracking-tight leading-tight group-hover:text-red-400 transition-colors">
            Escanea con Celular
          </h3>
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
            Mando web
          </p>

          <div className="mt-1.5 flex items-center text-[8.5px] text-gray-400 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10 truncate">
              Toca para ampliar
            </span>
          </div>
        </div>
      </div>

      {/* Enlarged Modal Overlay when clicked */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-black/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative flex flex-col items-center text-center animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500">
                <Smartphone size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Control Remoto Web</h2>
                <p className="text-xs text-gray-400">Escanea con la cámara de tu teléfono</p>
              </div>
            </div>

            {/* Giant QR Code */}
            <div className="my-5 p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center">
              <QRCodeSVG
                value={remoteUrl}
                size={230}
                level="Q"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5 mb-5 max-w-xs text-xs text-gray-300">
              <p className="font-semibold text-white">¿Cómo conectarse?</p>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                1. Abre la cámara de tu smartphone.<br />
                2. Apunta a la pantalla y toca el enlace que aparece.<br />
                3. ¡Listo! Podrás cambiar canciones, pausar, buscar y hablar por voz.
              </p>
            </div>

            {/* URL Box & Copy */}
            <div className="w-full flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl mb-4 text-xs font-mono text-gray-300">
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
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* Footer Actions */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              {onOpenNodeSync && (
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    onOpenNodeSync();
                  }}
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer py-1"
                >
                  <Wifi size={14} />
                  <span>Configurar IP / Red LAN</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors ml-auto cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
