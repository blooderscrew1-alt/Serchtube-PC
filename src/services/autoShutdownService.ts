import { AutoShutdownConfig, AutoShutdownMode } from '../types';

export const DEFAULT_AUTO_SHUTDOWN_CONFIG: AutoShutdownConfig = {
  enabled: false,
  targetTime: '23:30',
  mode: 'shutdown_pc',
  warningMinutesBefore: 2,
  playChimeOnWarning: true,
  speakWarning: true,
  fadeVolumeBeforeShutdown: true,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // Todos los días
};

export const AUTO_SHUTDOWN_MODES_INFO: {
  id: AutoShutdownMode;
  name: string;
  badge: string;
  description: string;
  iconName: string;
  requiresHost?: boolean;
}[] = [
  {
    id: 'shutdown_pc',
    name: 'Apagar PC Completa',
    badge: '⚡ Apagado Total',
    description: 'Cierra todas las aplicaciones y apaga por completo el ordenador (Windows, Linux o Mac).',
    iconName: 'Power',
    requiresHost: true
  },
  {
    id: 'sleep_pc',
    name: 'Suspender / Reposo de PC',
    badge: '🌙 Modo Reposo',
    description: 'Pone la PC en suspensión profunda de bajo consumo para reanudar al instante.',
    iconName: 'Moon',
    requiresHost: true
  },
  {
    id: 'stop_music_sleep',
    name: 'Pausar Música & Blackout OLED',
    badge: '🖤 Pantalla Negra',
    description: 'Atenúa y detiene la música, silencia el audio y activa pantalla 100% negra OLED.',
    iconName: 'VolumeX'
  },
  {
    id: 'lock_pc',
    name: 'Bloquear Sesión de PC',
    badge: '🔒 Bloqueo Seguro',
    description: 'Bloquea la sesión de usuario de Windows/Linux/Mac protegiendo la pantalla.',
    iconName: 'Lock',
    requiresHost: true
  }
];

/**
 * Calcula los milisegundos restantes hasta la hora objetivo configurada.
 * Si la hora ya pasó hoy, calcula para el siguiente día habilitado en `daysOfWeek`.
 */
export function getMsUntilTargetTime(targetTime: string, daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6], fromDate = new Date()): {
  ms: number;
  seconds: number;
  minutes: number;
  hours: number;
  targetDate: Date;
  isToday: boolean;
  formattedRemaining: string;
} {
  const [targetHourStr, targetMinStr] = (targetTime || '23:30').split(':');
  const targetH = parseInt(targetHourStr, 10) || 0;
  const targetM = parseInt(targetMinStr, 10) || 0;

  const now = fromDate;
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetH, targetM, 0, 0);

  // Si ya pasó la hora hoy, avanzamos al siguiente día
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  // Buscar el siguiente día que esté habilitado en daysOfWeek
  let attempts = 0;
  while (!daysOfWeek.includes(target.getDay()) && attempts < 7) {
    target.setDate(target.getDate() + 1);
    attempts++;
  }

  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const isToday = target.getDate() === now.getDate() && target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (minutes > 0) {
    formatted = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  } else {
    formatted = `${seconds}s`;
  }

  return {
    ms: diffMs,
    seconds: totalSecs,
    minutes: Math.floor(totalSecs / 60),
    hours,
    targetDate: target,
    isToday,
    formattedRemaining: formatted
  };
}

/**
 * Reproduce un acorde de aviso futurista suave antes de ejecutar el apagado.
 */
export function playWarningChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Do mayor cálido)

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 1.3);
    });
  } catch (err) {
    console.warn('[AutoShutdown] Error playing chime:', err);
  }
}

/**
 * Invoca el backend de Node.js para ejecutar el comando nativo de apagado de la PC.
 */
export async function executeSystemShutdown(mode: AutoShutdownMode, delaySeconds: number = 0): Promise<{
  success: boolean;
  message: string;
  os?: string;
  simulated?: boolean;
}> {
  try {
    const res = await fetch('/api/system/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: mode,
        delaySeconds
      })
    });

    if (res.ok) {
      return await res.json();
    }
    return {
      success: false,
      message: `Error HTTP ${res.status}`
    };
  } catch (err: any) {
    console.warn('[AutoShutdown] Backend endpoint unreachable:', err);
    return {
      success: false,
      message: err?.message || 'Servidor no disponible'
    };
  }
}

/**
 * Cancela cualquier orden de apagado en curso en el sistema operativo.
 */
export async function cancelSystemShutdown(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/system/cancel-shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: `Error HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error de red' };
  }
}
