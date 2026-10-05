import React, { useState, useEffect, useCallback } from 'react';
import { NodeRole } from '../types';
import { NodeSyncConfig } from '../services/nodeSync';
import {
  X,
  Wifi,
  Smartphone,
  Server,
  Copy,
  Check,
  Radio,
  QrCode,
  Globe,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';
import { detectRealDeviceIp, DetectedIpCandidate } from '../utils/networkIp';
import { HostScannerModal } from './HostScannerModal';
import { PWAInstallBanner } from './PWAInstallBanner';

interface NodeSyncModalProps {
  isOpen: boolean;
  config: NodeSyncConfig;
  isConnected: boolean;
  connectedNodesCount: number;
  onClose: () => void;
  onUpdateRole: (role: NodeRole, nodeName?: string, room?: string) => void;
}

const NodeSyncModalComponent: React.FC<NodeSyncModalProps> = ({
  isOpen,
  config,
  isConnected,
  connectedNodesCount,
  onClose,
  onUpdateRole
}) => {
  const [selectedRole, setSelectedRole] = useState<NodeRole>(config.role);
  const [roomInput, setRoomInput] = useState<string>(config.room);
  const [nameInput, setNameInput] = useState<string>(config.nodeName);
  const [copied, setCopied] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Local IP and port management
  const [localIp, setLocalIp] = useState<string>(() => {
    const saved = localStorage.getItem('serchtube_local_ip');
    if (saved && saved !== '192.168.1.100') return saved;
    // Check if current hostname is already an IPv4
    const host = window.location.hostname;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== '127.0.0.1') return host;
    return '192.168.1.100';
  });

  const [localPort, setLocalPort] = useState<string>(() => {
    return window.location.port || '3000';
  });

  const [useLocalIpLink, setUseLocalIpLink] = useState<boolean>(true);
  const [qrFormat, setQrFormat] = useState<'url' | 'json'>('url');

  // Real IP Auto-detection state
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedIpCandidate[]>([]);
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(false);
  const [detectionSource, setDetectionSource] = useState<string>('');
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);

  const performIpAutoDetection = useCallback(async (force = false) => {
    setIsDetectingIp(true);
    try {
      const result = await detectRealDeviceIp();
      setDetectedCandidates(result.candidates);
      setDetectionSource(result.source);

      const saved = localStorage.getItem('serchtube_local_ip');
      // Update IP if forced, or if user had the default placeholder '192.168.1.100' or no saved IP
      if (force || !saved || saved === '192.168.1.100' || localIp === '192.168.1.100' || !localIp) {
        if (result.primaryIp) {
          setLocalIp(result.primaryIp);
          setIsAutoDetected(true);
        }
      } else {
        // If current localIp matches any detected candidate, mark as auto-detected
        if (result.candidates.some(c => c.ip === localIp)) {
          setIsAutoDetected(true);
        }
      }
    } catch (e) {
      console.warn('Auto IP detection warning:', e);
    } finally {
      setIsDetectingIp(false);
    }
  }, [localIp]);

  useEffect(() => {
    if (isOpen) {
      performIpAutoDetection();
    }
  }, [isOpen, performIpAutoDetection]);

  if (!isOpen) return null;

  // Formulate URL & JSON payloads strictly compliant with Android Satellite specs
  const hostToUse = useLocalIpLink ? `${localIp}:${localPort}` : window.location.host;
  const protocolToUse = useLocalIpLink ? 'http' : window.location.protocol.replace(':', '');
  const wsProtocol = protocolToUse === 'https' ? 'wss' : 'ws';

  const localIpJoinUrl = `http://${localIp}:${localPort}/?room=${encodeURIComponent(roomInput)}&role=satellite`;
  const currentOriginJoinUrl = `${window.location.origin}/?room=${encodeURIComponent(roomInput)}&role=satellite`;
  const finalJoinUrl = useLocalIpLink ? localIpJoinUrl : currentOriginJoinUrl;

  const jsonSatelliteConfig = JSON.stringify({
    wsUrl: `${wsProtocol}://${hostToUse}/ws`,
    room: roomInput || 'serchtube-master',
    role: 'satellite'
  });

  const qrData = qrFormat === 'url' ? finalJoinUrl : jsonSatelliteConfig;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrFormat === 'url' ? finalJoinUrl : jsonSatelliteConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    try {
      localStorage.setItem('serchtube_local_ip', localIp);
    } catch (e) {}
    onUpdateRole(selectedRole, nameInput, roomInput);
    onClose();
  };

  // QR Code URL using quick image API for reliable scanning across mobile devices
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}&bgcolor=000000&color=ffffff&margin=10`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-black/95 border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Wifi size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase">Conexión de Nodos por IP Local</h2>
              <p className="text-xs text-gray-400">Red local WiFi / Hotspot y micrófonos sincronizados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              />
              <span className="text-xs font-medium text-gray-200">
                {isConnected ? 'Conectado a la Red de Audio' : 'Desconectado'}
              </span>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {connectedNodesCount} Dispositivo{connectedNodesCount > 1 ? 's' : ''} activo{connectedNodesCount > 1 ? 's' : ''}
            </span>
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2.5">
              Rol de este dispositivo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Master Host */}
              <button
                type="button"
                onClick={() => setSelectedRole('master')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  selectedRole === 'master'
                    ? 'bg-red-600/15 border-red-600/70 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Server size={18} className={selectedRole === 'master' ? 'text-red-500' : 'text-gray-500'} />
                  {selectedRole === 'master' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-600/20 text-red-400 font-mono uppercase font-bold">
                      Activo
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Host Principal (Master)</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Conectado a los altavoces del coche o salón. Centraliza la reproducción y el ecualizador.
                  </div>
                </div>
              </button>

              {/* Satellite Node */}
              <button
                type="button"
                onClick={() => setSelectedRole('satellite')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  selectedRole === 'satellite'
                    ? 'bg-blue-600/15 border-blue-500/70 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Smartphone size={18} className={selectedRole === 'satellite' ? 'text-blue-400' : 'text-gray-500'} />
                  {selectedRole === 'satellite' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono uppercase font-bold">
                      Activo
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Nodo Satélite (Mic Remoto)</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Teléfono secundario usado como micrófono auxiliar en el volante o asiento trasero.
                  </div>
                </div>
              </button>
            </div>

            {/* Subnet Host Scanner Button */}
            <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Radio size={16} className="text-red-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Escáner de Red Local (Host :3000)</div>
                  <div className="text-[11px] text-gray-400">Si se fue la luz o cambió la IP del coche, busca el host sin escanear el QR.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Search size={13} />
                <span>Escanear</span>
              </button>
            </div>

            {/* PWA Phone Installation Card */}
            <PWAInstallBanner />
          </div>

          {/* Room & Device Name */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                Código de Sala / Vehículo
              </label>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-600 font-mono"
                placeholder="ej. serchtube-car-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                Nombre de este Dispositivo
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-600"
                placeholder="ej. Pantalla Central / Teléfono Tablero"
              />
            </div>
          </div>

          {/* Local IP Configuration for Connecting Nodes */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wifi size={14} className="text-blue-400" />
                Configuración de IP Local
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUseLocalIpLink(true)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    useLocalIpLink ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  IP Local
                </button>
                <button
                  type="button"
                  onClick={() => setUseLocalIpLink(false)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    !useLocalIpLink ? 'bg-white/10 text-white border border-white/20' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Host Web
                </button>
              </div>
            </div>

            {useLocalIpLink && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-gray-400 block font-mono flex items-center gap-1.5">
                        <span>IP Local de este dispositivo:</span>
                        {isAutoDetected && (
                          <span className="text-[10px] text-green-400 font-sans font-semibold flex items-center gap-1 bg-green-500/10 px-1.5 py-0.2 rounded border border-green-500/20">
                            <CheckCircle2 size={10} /> Auto
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => performIpAutoDetection(true)}
                        disabled={isDetectingIp}
                        title="Detectar automáticamente la IP real de este dispositivo"
                        className="text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RefreshCw size={10} className={isDetectingIp ? 'animate-spin text-blue-400' : ''} />
                        <span>{isDetectingIp ? 'Detectando...' : 'Auto-detectar'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={localIp}
                        onChange={(e) => {
                          setLocalIp(e.target.value);
                          setIsAutoDetected(false);
                        }}
                        placeholder="ej. 192.168.1.15"
                        className="w-full px-3 py-1.5 rounded bg-black border border-white/10 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                      {localIp && (
                        <button
                          type="button"
                          onClick={() => setLocalIp('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5 text-xs"
                          title="Limpiar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400 block font-mono">
                      Puerto:
                    </label>
                    <input
                      type="text"
                      value={localPort}
                      onChange={(e) => setLocalPort(e.target.value)}
                      placeholder="3000"
                      className="w-full px-3 py-1.5 rounded bg-black border border-white/10 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Auto-detected Real IPs Display */}
                {detectedCandidates.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-blue-300 font-semibold">
                        <Sparkles size={12} className="text-yellow-400" />
                        IP real detectada en este dispositivo:
                      </span>
                      {detectionSource && (
                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">
                          Vía: {detectionSource}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {detectedCandidates.map((cand) => {
                        const isSelected = localIp === cand.ip;
                        return (
                          <button
                            key={`${cand.ip}-${cand.label}`}
                            type="button"
                            onClick={() => {
                              setLocalIp(cand.ip);
                              setIsAutoDetected(true);
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold border border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300 border border-white/10'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-green-300' : 'bg-blue-400'
                              }`}
                            ></span>
                            <span>{cand.ip}</span>
                            <span className="text-[9px] opacity-75">({cand.label})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Local IP Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-gray-500 font-mono">Presets IP:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalIp('192.168.43.1');
                      setIsAutoDetected(false);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      localIp === '192.168.43.1'
                        ? 'bg-blue-600 text-white font-bold border border-blue-400'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                    }`}
                  >
                    Hotspot Móvil (192.168.43.1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalIp('192.168.1.100');
                      setIsAutoDetected(false);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      localIp === '192.168.1.100'
                        ? 'bg-blue-600 text-white font-bold border border-blue-400'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                    }`}
                  >
                    WiFi Red (192.168.1.100)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalIp('10.0.0.2');
                      setIsAutoDetected(false);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      localIp === '10.0.0.2'
                        ? 'bg-blue-600 text-white font-bold border border-blue-400'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                    }`}
                  >
                    Subred (10.0.0.2)
                  </button>
                </div>
              </div>
            )}

            {/* Generated Link with IP & Copy action */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                  <Radio size={14} className="text-blue-400" />
                  Enlace para conectar un segundo dispositivo:
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 font-medium cursor-pointer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
                </button>
              </div>
              <div className="text-xs text-gray-300 font-mono bg-black p-2.5 rounded-lg border border-white/10 break-all select-all">
                {finalJoinUrl}
              </div>
            </div>

            {/* Quick QR Code Preview with Format Selector */}
            <div className="bg-black/60 p-3.5 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <QrCode size={14} className="text-blue-400" />
                  QR de Vinculación para Satélite
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setQrFormat('url')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      qrFormat === 'url' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Opción A: URL Directa
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrFormat('json')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      qrFormat === 'json' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Opción B: App Android (JSON)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-white p-1 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Conexión Local"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white">
                    {qrFormat === 'url'
                      ? 'Compatible con navegador móvil (Chrome / Safari / Firefox)'
                      : 'Especial para el botón "Escanear QR de Vinculación" en Android'}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {qrFormat === 'url'
                      ? 'Abre la interfaz web de satélite directamente en el teléfono.'
                      : 'El satélite Android lee la IP, puerto WebSocket y sala en 1 segundo.'}
                  </p>
                  <div className="text-[10px] font-mono text-gray-500 truncate max-w-[280px]">
                    Payload: {qrData}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
            ID: {config.nodeId}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Guardar y Conectar
            </button>
          </div>
        </div>
      </div>

      {/* Host Subnet Scanner Modal */}
      <HostScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};

export const NodeSyncModal = React.memo(NodeSyncModalComponent);
