import React, { useState } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle, MoreVertical, MoreHorizontal, Sparkles, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  onDismiss,
  className = '',
  compact = false
}) => {
  const { isInstalled, canPromptDirectly, isIOS, isAndroid, browserName, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If already running in standalone mode (already installed), no need to show
  if (isInstalled) {
    return null;
  }

  // Handle click on install buttons
  const handleInstallClick = async () => {
    if (canPromptDirectly) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setIsDismissed(true);
        return;
      }
    }
    // If browser didn't supply direct prompt or on iOS/Edge Canary over LAN IP, show instructions modal
    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const getBrowserLabel = () => {
    if (browserName === 'edge') return 'Microsoft Edge';
    if (browserName === 'chrome') return 'Google Chrome';
    if (browserName === 'samsung') return 'Samsung Internet';
    if (browserName === 'firefox') return 'Mozilla Firefox';
    if (browserName === 'safari' || isIOS) return 'Safari (iPhone/iPad)';
    return 'Navegador del teléfono';
  };

  // Compact version (for header / navbar)
  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/20 hover:from-red-600/50 hover:to-amber-600/40 border border-red-500/40 text-red-200 text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer ${className}`}
          title="Instalar como app en la pantalla de inicio del teléfono"
        >
          <Download size={13} className="text-red-400 shrink-0 animate-bounce" />
          <span>Instalar App</span>
        </button>

        {showGuideModal && (
          <InstallGuideModal
            isIOS={isIOS}
            isAndroid={isAndroid}
            browserName={browserName}
            browserLabel={getBrowserLabel()}
            canPromptDirectly={canPromptDirectly}
            onDirectInstall={async () => {
              const res = await install();
              if (res === 'accepted') {
                setShowGuideModal(false);
                setIsDismissed(true);
              }
            }}
            onClose={() => setShowGuideModal(false)}
          />
        )}
      </>
    );
  }

  // Full banner card (if user hasn't explicitly dismissed it in this view)
  if (isDismissed) {
    return (
      <>
        {showGuideModal && (
          <InstallGuideModal
            isIOS={isIOS}
            isAndroid={isAndroid}
            browserName={browserName}
            browserLabel={getBrowserLabel()}
            canPromptDirectly={canPromptDirectly}
            onDirectInstall={async () => {
              const res = await install();
              if (res === 'accepted') {
                setShowGuideModal(false);
              }
            }}
            onClose={() => setShowGuideModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-black to-zinc-950/90 border border-red-500/40 shadow-2xl text-white animate-fadeIn ${className}`}>
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Smartphone size={22} className="text-red-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Instalar en Pantalla de Inicio
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-mono font-bold flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-400" /> PWA OFFLINE + ESCÁNER
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-snug">
                Agrega el <strong>Mando Satélite</strong> a la pantalla de inicio de tu teléfono. Si se va la luz o cambia la IP del host :3000, la app cargará al instante y <strong>activará el escáner de red</strong> para reconectar sin volver a escanear el QR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
            title="Ocultar aviso"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 mt-3.5 pt-2.5 border-t border-white/10">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.35)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download size={14} className="animate-bounce" />
            <span>Agregar a Pantalla de Inicio</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Ver pasos detallados según tu navegador"
          >
            <HelpCircle size={13} />
            <span className="hidden sm:inline">Instrucciones</span>
          </button>
        </div>
      </div>

      {showGuideModal && (
        <InstallGuideModal
          isIOS={isIOS}
          isAndroid={isAndroid}
          browserName={browserName}
          browserLabel={getBrowserLabel()}
          canPromptDirectly={canPromptDirectly}
          onDirectInstall={async () => {
            const res = await install();
            if (res === 'accepted') {
              setShowGuideModal(false);
              setIsDismissed(true);
            }
          }}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </>
  );
};

// Modal with step-by-step instructions for Android (Edge Canary, Chrome, etc.) and iOS
interface InstallGuideModalProps {
  isIOS: boolean;
  isAndroid: boolean;
  browserName: string;
  browserLabel: string;
  canPromptDirectly: boolean;
  onDirectInstall: () => void;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isIOS,
  isAndroid,
  browserName,
  browserLabel,
  canPromptDirectly,
  onDirectInstall,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Instalar Mando Satélite</h3>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <span>Navegador: </span>
                <span className="text-red-400 font-semibold">{browserLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {canPromptDirectly && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3">
            <div className="text-xs text-emerald-200">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-400" />
                Instalación directa disponible
              </div>
              <p className="text-[11px] text-emerald-300/80">Tu navegador admite la instalación en un solo toque.</p>
            </div>
            <button
              type="button"
              onClick={onDirectInstall}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shrink-0 cursor-pointer"
            >
              Instalar Ahora
            </button>
          </div>
        )}

        <div className="space-y-2.5 text-xs text-gray-200">
          <p className="text-gray-300 text-[11px]">
            Para guardar la aplicación con su icono en el escritorio de tu teléfono y permitir que funcione offline con el escáner de host:
          </p>

          {isIOS ? (
            // iOS Safari steps
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <Share size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">1. Pulsa Compartir</div>
                  <div className="text-gray-400 text-[11px]">En la barra inferior de Safari, pulsa el botón con el icono de compartir (flecha hacia arriba).</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <PlusSquare size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">2. Añadir a pantalla de inicio</div>
                  <div className="text-gray-400 text-[11px]">Desliza las opciones y selecciona <strong>Añadir a la pantalla de inicio</strong>.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <CheckCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">3. Confirmar</div>
                  <div className="text-gray-400 text-[11px]">Pulsa <strong>Añadir</strong> en la esquina superior derecha.</div>
                </div>
              </div>
            </div>
          ) : browserName === 'edge' ? (
            // Microsoft Edge (Canary / Stable) on Android steps
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <MoreHorizontal size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">1. Abre el menú de Edge</div>
                  <div className="text-gray-400 text-[11px]">Toca el botón de tres puntos (<strong>⋯</strong>) en la barra inferior (o superior) del navegador.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <Download size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">2. Agregar a pantalla principal</div>
                  <div className="text-gray-400 text-[11px]">Selecciona <strong>"Agregar a la pantalla principal"</strong> o <strong>"Instalar aplicación"</strong>.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <CheckCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">3. Toca Agregar / Instalar</div>
                  <div className="text-gray-400 text-[11px]">Acepta para crear el acceso directo de SerchTube en tu escritorio de Android.</div>
                </div>
              </div>
            </div>
          ) : (
            // Google Chrome / Android generic steps
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <MoreVertical size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">1. Abre el menú del navegador</div>
                  <div className="text-gray-400 text-[11px]">Toca los tres puntos verticales (<strong>⋮</strong>) en la esquina superior derecha.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <Download size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">2. Instalar aplicación / Agregar</div>
                  <div className="text-gray-400 text-[11px]">Toca en <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/50 border border-white/5">
                <CheckCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">3. Confirmar</div>
                  <div className="text-gray-400 text-[11px]">Pulsa en <strong>Instalar</strong>. El icono de SerchTube se colocará en tu pantalla.</div>
                </div>
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 text-[11px] text-gray-300 leading-snug">
            💡 <strong>Ventaja clave:</strong> Al tenerla instalada, si se va la luz en el coche o el router asigna una IP diferente, la app abrirá sin error <em>"sin conexión"</em> e iniciará el escaneo automático del puerto 3000.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          ¡Entendido!
        </button>
      </div>
    </div>
  );
};
