import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  ExternalLink,
  X,
  Play,
  ArrowRight,
  Shield,
  Zap,
  Globe
} from 'lucide-react';
import {
  HostScannerService,
  DiscoveredHost,
  ScanProgress,
  COMMON_LOCAL_SUBNETS
} from '../services/hostScanner';
import { NodeSyncService } from '../services/nodeSync';

interface HostScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHostConnected?: (host: DiscoveredHost) => void;
  autoStartScan?: boolean;
}

export const HostScannerModal: React.FC<HostScannerModalProps> = ({
  isOpen,
  onClose,
  onHostConnected,
  autoStartScan = true
}) => {
  const scanner = HostScannerService.getInstance();
  const nodeSync = NodeSyncService.getInstance();

  const [selectedSubnet, setSelectedSubnet] = useState<string>(() => scanner.getDetectedSubnetPrefix());
  const [targetPort, setTargetPort] = useState<number>(() => scanner.getTargetPort());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [foundHost, setFoundHost] = useState<DiscoveredHost | null>(null);
  const [manualIp, setManualIp] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<'idle' | 'testing' | 'found' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Listo para escanear');

  // Start scan
  const startScan = useCallback(async (subnetToScan = selectedSubnet) => {
    setIsScanning(true);
    setFoundHost(null);
    setStatusMessage(`Escaneando subred ${subnetToScan}X:${targetPort}...`);

    try {
      const host = await scanner.scanSubnet(subnetToScan, {
        port: targetPort,
        onProgress: (p) => {
          setProgress(p);
        },
        onFound: (host) => {
          setFoundHost(host);
          setStatusMessage(`¡Host detectado en ${host.ip}:${host.port}! (${host.latencyMs}ms)`);
          // Automatically re-link the WebSocket
          nodeSync.setCustomHost(`${host.ip}:${host.port}`);
          onHostConnected?.(host);
        }
      });

      if (!host) {
        setStatusMessage(`No se encontró ningún Host activo en ${subnetToScan}X. Prueba otra subred o introduce la IP manual.`);
      }
    } catch (err: any) {
      setStatusMessage('Escaneo interrumpido o error de red');
    } finally {
      setIsScanning(false);
    }
  }, [selectedSubnet, targetPort, scanner, nodeSync, onHostConnected]);

  // Handle open and auto-start
  useEffect(() => {
    if (isOpen) {
      const detected = scanner.getDetectedSubnetPrefix();
      setSelectedSubnet(detected);
      setManualIp(detected);
      if (autoStartScan) {
        startScan(detected);
      }
    } else {
      scanner.cancelScan();
      setIsScanning(false);
    }
  }, [isOpen, autoStartScan, scanner, startScan]);

  const handleStopScan = () => {
    scanner.cancelScan();
    setIsScanning(false);
    setStatusMessage('Escaneo cancelado por el usuario');
  };

  const handleSelectSubnet = (sub: string) => {
    setSelectedSubnet(sub);
    setManualIp(sub);
    startScan(sub);
  };

  // Test single manual IP
  const handleTestManualIp = async () => {
    if (!manualIp.trim()) return;
    setManualStatus('testing');
    const cleanIp = manualIp.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
    const host = await scanner.probeCandidate(cleanIp, targetPort, 2000);

    if (host) {
      setManualStatus('found');
      setFoundHost(host);
      nodeSync.setCustomHost(`${host.ip}:${host.port}`);
      onHostConnected?.(host);
      setStatusMessage(`¡Host verificado con éxito en ${host.ip}:${host.port}!`);
    } else {
      setManualStatus('error');
      setStatusMessage(`No se pudo conectar a ${cleanIp}:${targetPort}. Revisa la IP o el cortafuegos.`);
    }
  };

  // Connect and redirect
  const handleConnectAndRedirect = (host: DiscoveredHost) => {
    nodeSync.setCustomHost(`${host.ip}:${host.port}`);
    scanner.saveDiscoveredHost(host.url);

    // If current origin differs from found host, offer seamless location switch
    const currentOrigin = window.location.origin;
    if (currentOrigin !== host.url) {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('role', 'satellite');
      const targetHref = `${host.url}/?${searchParams.toString()}`;
      window.location.href = targetHref;
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Radar ambient sweep glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg ${
              isScanning
                ? 'bg-red-600/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse'
                : foundHost
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border-white/10 text-gray-300'
            }`}>
              <Radio size={22} className={isScanning ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Escáner de Red Local (Host :3000)
              </h2>
              <p className="text-xs text-gray-400">
                Reconecta con el coche tras corte de luz o cambio de IP del router
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Explanation Banner */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-gray-300 flex items-start gap-2.5">
            <Zap size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Si se fue la luz o reiniciaste el router, el Host de SerchTube (coche o PC) puede tener una nueva IP. Este escáner rastrea tu red local automáticamente para recuperar la sincronización <strong>sin tener que escanear el QR de nuevo</strong>.
            </p>
          </div>

          {/* Subnet Quick Selectors */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-300 font-semibold flex items-center justify-between">
              <span>Subred a Explorar:</span>
              <span className="font-mono text-red-400 text-[11px]">{selectedSubnet}X</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {COMMON_LOCAL_SUBNETS.map((sub) => {
                const isSelected = selectedSubnet === sub;
                let label = sub;
                if (sub === '192.168.1.') label = '192.168.1.X (Hogar/Coche)';
                else if (sub === '192.168.0.') label = '192.168.0.X (Router)';
                else if (sub === '192.168.43.') label = '192.168.43.X (Zona Android)';
                else if (sub === '172.20.10.') label = '172.20.10.X (Hotspot iOS)';
                else if (sub === '10.0.0.') label = '10.0.0.X (Red 10)';

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSelectSubnet(sub)}
                    className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-600/30 border-red-500 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="truncate">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scanner Progress / Radar Area */}
          <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 flex items-center gap-1.5 font-medium">
                {isScanning ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-red-400" />
                    <span>Rastreando puertos 3000...</span>
                  </>
                ) : (
                  <>
                    <Search size={13} className="text-gray-400" />
                    <span>Estado del Escáner:</span>
                  </>
                )}
              </span>
              <span className="font-mono text-gray-400 text-[11px]">
                {progress ? `${progress.percent}% (${progress.scanned}/${progress.total})` : '0%'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  foundHost ? 'bg-emerald-500' : 'bg-gradient-to-r from-red-600 to-amber-500'
                }`}
                style={{ width: `${progress ? progress.percent : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
              <span className="truncate max-w-[280px]">
                {progress ? `Probando ${progress.currentIp}:${targetPort}` : statusMessage}
              </span>
              <span>Puerto :{targetPort}</span>
            </div>
          </div>

          {/* Found Host Card */}
          {foundHost && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 shadow-xl space-y-3 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      ¡Host Detectado y Verificado!
                    </span>
                    <div className="text-base font-mono font-bold text-white mt-0.5">
                      {foundHost.ip}:{foundHost.port}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {foundHost.latencyMs} ms
                </span>
              </div>

              <p className="text-xs text-emerald-200/80">
                La conexión WebSocket del mando satélite ya se ha restablecido en vivo con el reproductor principal.
              </p>

              <button
                type="button"
                onClick={() => handleConnectAndRedirect(foundHost)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Usar esta Dirección & Actualizar URL</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Manual IP input fallback */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <label className="text-xs text-gray-300 font-semibold block">
              O introduce la IP manualmente si la conoces:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="ej. 192.168.1.150"
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={handleTestManualIp}
                disabled={manualStatus === 'testing'}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {manualStatus === 'testing' ? (
                  <RefreshCw size={13} className="animate-spin text-amber-400" />
                ) : (
                  <Search size={13} />
                )}
                <span>Probar</span>
              </button>
            </div>
            {manualStatus === 'error' && (
              <p className="text-[11px] text-red-400 font-mono">
                No responde en :{targetPort}. Asegúrate de que el Host está encendido y en la misma red Wi-Fi.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
          {isScanning ? (
            <button
              type="button"
              onClick={handleStopScan}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 text-xs font-bold transition-all cursor-pointer"
            >
              Detener Escaneo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startScan(selectedSubnet)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Volver a Escanear {selectedSubnet}X</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
