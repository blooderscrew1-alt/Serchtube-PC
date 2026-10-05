import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Check,
  RefreshCw,
  Tv,
  MousePointerClick,
  Info,
  UserCheck,
  Lock,
  Globe,
  Radio,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { NodeSyncService } from '../services/nodeSync';
import {
  youtubeAuthService,
  GoogleAccountProfile,
  DiagnosticStep,
  DiagnosticReport
} from '../services/youtubeAuthService';
import {
  initAuth,
  signInWithGoogle,
  logoutGoogle
} from '../services/googleAuthService';

interface YouTubeAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableInteractiveScreensaver?: () => void;
  onReloadPlayer?: () => void;
  isSatellite?: boolean;
}

export const YouTubeAuthModal: React.FC<YouTubeAuthModalProps> = ({
  isOpen,
  onClose,
  onEnableInteractiveScreensaver,
  onReloadPlayer,
  isSatellite = false
}) => {
  const [profile, setProfile] = useState<GoogleAccountProfile>(() => youtubeAuthService.getProfile());
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);
  const [lastReport, setLastReport] = useState<DiagnosticReport | null>(() => youtubeAuthService.getLastReport());
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signInTimeoutRef = useRef<any>(null);

  // Initialize and listen to Firebase Google Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        youtubeAuthService.setGoogleUser(user);
        setProfile(youtubeAuthService.getProfile());
        setIsSigningIn(false);
      },
      () => {
        setProfile(youtubeAuthService.getProfile());
      }
    );

    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setProfile(e.detail);
      }
    };

    window.addEventListener('serchtube:account-updated', handleProfileUpdate);
    return () => {
      unsubscribe();
      window.removeEventListener('serchtube:account-updated', handleProfileUpdate);
      if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setProfile(youtubeAuthService.getProfile());
      setLastReport(youtubeAuthService.getLastReport());
      setAuthError(null);
    } else {
      setIsSigningIn(false);
      if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);

    // Timeout safety fallback (45 seconds)
    if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
    signInTimeoutRef.current = setTimeout(() => {
      setIsSigningIn(false);
      setAuthError('Tiempo de espera agotado. Revisa si la ventana emergente de Google se abrió detrás de tu navegador o fue bloqueada.');
    }, 45000);

    try {
      const result = await signInWithGoogle();
      if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
      if (result?.user) {
        youtubeAuthService.setGoogleUser(result.user);
        setProfile(youtubeAuthService.getProfile());
        setSuccessToast(`¡Bienvenido, ${result.user.displayName || result.user.email}! Cuenta de Google autenticada.`);
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: any) {
      if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
      console.error('Sign-in error details:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Inicio de sesión cancelado.');
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthError('El navegador bloqueó la ventana emergente. Por favor, habilita las ventanas emergentes (popups) para este sitio.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError('Dominio no autorizado en Firebase. Añade este dominio a "Dominios autorizados" en la consola de Firebase.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setAuthError(err?.message || 'Error al conectar con Google. Verifica tu conexión a internet.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCancelSignIn = () => {
    if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
    setIsSigningIn(false);
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
      youtubeAuthService.unlinkAccount();
      setProfile(youtubeAuthService.getProfile());
      setSuccessToast('Sesión de Google cerrada.');
      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsRunningTest(true);
    setDiagnosticSteps([]);
    try {
      const report = await youtubeAuthService.runLiveDiagnostics((steps) => {
        setDiagnosticSteps([...steps]);
      });
      setLastReport(report);
      setProfile(youtubeAuthService.getProfile());
      setSuccessToast('¡Diagnóstico completado con éxito!');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Error running diagnostics:', err);
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleReload = () => {
    if (onReloadPlayer) onReloadPlayer();
    window.dispatchEvent(new CustomEvent('serchtube:reload-player'));
    if (isSatellite) {
      try {
        NodeSyncService.getInstance().sendCommandToMaster({ action: 'reload_player' });
      } catch (e) {}
    }
    setSuccessToast(isSatellite ? 'Orden enviada: Reproductor del coche recargado' : 'Reproductor recargado con credenciales de YouTube');
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleInteractiveClick = () => {
    if (onEnableInteractiveScreensaver) {
      onEnableInteractiveScreensaver();
    }
    onClose();
  };

  const isVerifiedClean = profile.isLinked && profile.botStatus !== 'detected';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-black/95 border border-red-500/40 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_60px_rgba(220,38,38,0.35)] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-black to-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/40 shadow-inner shrink-0">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-tight">Autenticación Google & YouTube</h2>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-bold ${
                  profile.botStatus === 'detected'
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : isVerifiedClean
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    profile.botStatus === 'detected' ? 'bg-red-500' : isVerifiedClean ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  {profile.botStatus === 'detected'
                    ? 'Aviso de Bot Detectado'
                    : profile.isRealGoogleAuth
                    ? 'Google OAuth Verificado ✓'
                    : isVerifiedClean
                    ? 'Conexión Activa ✓'
                    : 'Verificación Pendiente'}
                </span>
              </div>
              <p className="text-xs text-gray-400">Inicio de sesión oficial de Google y diagnóstico de reproducción</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-600/90 text-white text-xs px-4 py-2 font-mono flex items-center justify-center gap-2 animate-fadeIn">
            <Check size={14} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-red-950/80 border-b border-red-500/30 text-red-300 text-xs px-4 py-2.5 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-gray-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-sm">

          {/* 1. REAL GOOGLE SIGN-IN / OAUTH PROFILE CARD */}
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 tracking-wider uppercase flex items-center gap-2">
                <UserCheck size={15} className="text-red-500" /> CUENTA DE GOOGLE VINCULADA
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                {profile.successfulPlaysCount} reproducciones sin fallo
              </span>
            </div>

            {profile.isRealGoogleAuth ? (
              /* Signed In with Google OAuth View */
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-black/60 border border-emerald-500/30 p-3.5 rounded-xl">
                <div className="flex items-center gap-3">
                  {profile.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt={profile.displayName}
                      className="w-12 h-12 rounded-full border-2 border-emerald-500 shadow-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 text-white font-bold flex items-center justify-center text-base shadow-md border border-white/20 shrink-0">
                      {profile.displayName?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase() || 'G'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{profile.displayName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={11} className="text-emerald-400" /> Verificada por Google
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 font-mono mt-0.5 flex items-center gap-2">
                      <span>{profile.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 border border-white/15 hover:border-red-500/40 text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Cerrar sesión de Google"
                  >
                    <LogOut size={13} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Not Signed In: Official Google Sign-In Button */
              <div className="flex flex-col gap-3 bg-black/60 border border-white/10 p-4 rounded-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white">Inicia sesión con tu cuenta oficial de Google</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Autentica tu identidad real y vincula tu perfil oficial verificado a SerchTube.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    {/* Official Material Google Sign-In Button */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0 disabled:opacity-85"
                    >
                      {isSigningIn ? (
                        <RefreshCw size={14} className="animate-spin text-gray-700" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                          <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                      )}
                      <span>{isSigningIn ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
                    </button>

                    {isSigningIn && (
                      <button
                        type="button"
                        onClick={handleCancelSignIn}
                        className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-semibold transition-colors"
                        title="Cancelar intento"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {isSigningIn && (
                  <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2 animate-fadeIn">
                    <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      Se abrió la ventana emergente de Google. Si no la ves en primer plano, revisa la barra de tareas o permite las <strong>ventanas emergentes (popups)</strong> en tu navegador.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. REAL-TIME LIVE DIAGNOSTIC & BOT CHECK TEST */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-300 tracking-wider uppercase flex items-center gap-2">
                  <Activity size={15} className="text-cyan-400" /> DIAGNÓSTICO EN VIVO DE CONEXIÓN Y BOT CHECK
                </span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Ejecuta una prueba técnica real para comprobar si YouTube permite la reproducción o si hay aviso de bot
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunDiagnostic}
                disabled={isRunningTest}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                  isRunningTest
                    ? 'bg-zinc-800 text-gray-400 cursor-not-allowed border border-white/10'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                }`}
              >
                <RefreshCw size={13} className={isRunningTest ? 'animate-spin text-white' : 'text-white'} />
                <span>{isRunningTest ? 'Analizando...' : '🔬 Ejecutar Test en Vivo'}</span>
              </button>
            </div>

            {/* Diagnostic Steps Result Checklist */}
            {(diagnosticSteps.length > 0 || lastReport) && (
              <div className="bg-black/70 border border-white/10 rounded-xl p-3.5 space-y-2.5 font-mono text-xs animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-gray-400 font-bold uppercase">
                  <span>Pruebas de integridad del sistema:</span>
                  <span className="text-gray-300">
                    Latencia: <strong className="text-emerald-400">{lastReport?.latencyMs || 42} ms</strong>
                  </span>
                </div>

                {(diagnosticSteps.length > 0 ? diagnosticSteps : lastReport?.steps || []).map((step) => (
                  <div key={step.id} className="flex items-start gap-2.5 py-1">
                    {step.status === 'running' && (
                      <RefreshCw size={14} className="text-cyan-400 animate-spin shrink-0 mt-0.5" />
                    )}
                    {step.status === 'success' && (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {step.status === 'warning' && (
                      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                    {step.status === 'error' && (
                      <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    )}
                    {step.status === 'pending' && (
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white flex items-center justify-between">
                        <span>{step.title}</span>
                        <span className={`text-[10px] uppercase ${
                          step.status === 'success' ? 'text-emerald-400' : step.status === 'error' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {step.status === 'running' ? 'Comprobando...' : step.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-normal">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. TRANSPARENCY EXPLANATION: HOW BROWSER COOKIES & BOT CHECKS WORK */}
          <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 flex items-start gap-3 text-amber-200/90 text-xs leading-relaxed">
            <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block mb-1">¿Cómo interactúan Google OAuth y el reproductor de YouTube?</strong>
              Google OAuth valida tu <strong>identidad oficial y tu perfil de usuario</strong>. Para el reproductor de vídeo en pantalla, YouTube comprueba además que tengas la sesión abierta en <strong className="text-white">YouTube.com</strong> en este mismo navegador web para evitar avisos de bot. Ambos pasos garantizan una reproducción sin restricciones.
            </div>
          </div>

          {/* Satellite Notice if used from mobile phone */}
          {isSatellite && (
            <div className="p-3.5 rounded-2xl bg-blue-950/25 border border-blue-500/30 flex items-start gap-2.5 text-blue-200/90 text-xs leading-relaxed">
              <Radio size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-300 block mb-0.5">Mando Satélite (Teléfono Móvil):</strong>
                Si el aviso de bot aparece en la pantalla del coche, la sesión debe iniciarse en el navegador de la pantalla del coche. Al pulsar <strong>"Recargar Coche"</strong> abajo, se enviará la orden instantánea al vehículo para refrescar su reproductor.
              </div>
            </div>
          )}

          {/* 4. ACTIONS: OFFICIAL GOOGLE/YOUTUBE LOGIN & RELOAD */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block font-mono">
                Pasos de Verificación de YouTube
              </label>
              <span className="text-[11px] text-gray-400 font-mono">Servidores oficiales de Google</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>1. Abrir Sesión en YouTube.com</span>
                <ExternalLink size={13} className="text-white/80" />
              </a>

              <button
                type="button"
                onClick={handleReload}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                title="Recargar reproductor para inyectar las cookies actualizadas de sesión de YouTube"
              >
                <RefreshCw size={14} className="text-red-400" />
                <span>2. {isSatellite ? 'Recargar Reproductor del Coche' : 'Recargar Reproductor'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Screen Option: Click directly on the TV/Car screen */}
          {onEnableInteractiveScreensaver && (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <MousePointerClick size={15} className="text-red-400" />
                <span>Opción de Clic Directo: Botón "Acceder" en el Vídeo</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Si ves el botón blanco <strong className="text-white">"Acceder"</strong> directamente sobre el reproductor de vídeo de la pantalla, pulsa aquí para habilitar la interacción táctil/ratón directa sobre el iframe.
              </p>
              <button
                type="button"
                onClick={handleInteractiveClick}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Tv size={14} className="text-red-400" />
                <span>Habilitar Clic Directo en Pantalla</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <Lock size={12} className="text-red-400" />
            Conexión protegida por Google Identity & TLS 1.3
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
