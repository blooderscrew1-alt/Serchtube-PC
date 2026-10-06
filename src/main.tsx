import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { claimInstance, reclaimInstance, isInstanceActive, onInstanceChange } from './utils/singleInstance';

// Instancia única: la pestaña abierta al final (la que tiene el foco) gana;
// las pestañas anteriores quedan en modo reposo sin micrófono ni WebSocket
claimInstance();

// Register Service Worker for offline PWA app shell and cache
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA Service Worker] Nueva versión disponible.');
    },
    onOfflineReady() {
      console.log('[PWA Service Worker] App lista para funcionar sin conexión.');
    }
  });
}

function SleepScreen({ onReactivate }: { onReactivate: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#e5e7eb',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24,
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: 42 }}>😴</div>
      <h1 style={{ fontSize: 20, margin: 0 }}>SerchTube está activo en otra pestaña</h1>
      <p style={{ color: '#9ca3af', maxWidth: 420, margin: 0 }}>
        Esta pestaña quedó en modo reposo para evitar que el asistente procese
        los comandos dos veces (micrófono y respuesta de voz duplicados).
      </p>
      <button
        onClick={onReactivate}
        style={{
          background: '#dc2626', color: '#fff', border: 'none',
          padding: '10px 22px', borderRadius: 12, fontSize: 14,
          fontWeight: 700, cursor: 'pointer'
        }}
      >
        Usar SerchTube en esta pestaña
      </button>
    </div>
  );
}

function SingleInstanceRoot() {
  const [active, setActive] = useState(isInstanceActive());

  useEffect(() => onInstanceChange(setActive), []);

  useEffect(() => {
    if (active) return;
    // Modo reposo: cerrar micrófono, audio y sincronización de nodos
    try {
      import('./services/speechService').then(m => m.SpeechService.getInstance().stopListening());
    } catch (_) {}
    try {
      import('./services/audioEngine').then(m => m.AudioEngine.getInstance().stopDucking());
    } catch (_) {}
    try {
      import('./services/nodeSync').then(m => m.NodeSyncService.getInstance().disconnect());
    } catch (_) {}
  }, [active]);

  if (!active) {
    return <SleepScreen onReactivate={() => reclaimInstance()} />;
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SingleInstanceRoot />
  </StrictMode>,
);
