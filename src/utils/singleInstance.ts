/**
 * Instancia única de SerchTube por navegador.
 *
 * Al arrancar la PC a veces el navegador abre SerchTube en varias pestañas:
 * cada una abría micrófono + WebSocket y procesaba los mismos comandos
 * (respuestas duplicadas "pausa-pausa"). Con este módulo, la pestaña que se
 * abre AL FINAL (la que tiene el foco) reclama el control y las anteriores
 * quedan en modo reposo, sin servicios activos.
 *
 * Reglas:
 * - Última pestaña en reclamar gana ("latest wins").
 * - Una pestaña desplazada muestra una pantalla de reposo con botón para
 *   recuperar el control (entonces las demás se duermen).
 * - Ligado pero no dependiente: si BroadcastChannel no existe, todo funciona
 *   como siempre (posible doble instancia solo en navegadores muy viejos).
 */

const CHANNEL = 'serchtube_single_instance';
const KEY = 'serchtube_instance_claim';

type Claim = { id: string; ts: number };

let myId = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
let active = true;
const listeners = new Set<(a: boolean) => void>();

const bc: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

function readClaim(): Claim | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && typeof c.id === 'string' && typeof c.ts === 'number') return c;
  } catch (_) {}
  return null;
}

function writeClaim(c: Claim) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch (_) {}
}

function evaluate() {
  const cur = readClaim();
  const nowActive = !cur || cur.id === myId;
  if (nowActive !== active) {
    active = nowActive;
    for (const l of listeners) {
      try {
        l(active);
      } catch (_) {}
    }
  }
}

/** Reclama el control para esta pestaña (la más reciente gana). */
export function claimInstance() {
  const claim: Claim = { id: myId, ts: Date.now() };
  writeClaim(claim);
  try {
    bc?.postMessage({ type: 'claim', ...claim });
  } catch (_) {}
  evaluate();
}

/** Desplazada a modo reposo: entrega el control y deja de ser la activa. */
export function reclaimInstance() {
  myId = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  claimInstance();
}

export function isInstanceActive(): boolean {
  return active;
}

export function onInstanceChange(cb: (a: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (bc) {
  bc.onmessage = (e: MessageEvent) => {
    const d = e.data;
    if (d && d.type === 'claim' && typeof d.id === 'string') {
      const cur = readClaim();
      if (!cur || d.ts >= cur.ts) writeClaim({ id: d.id, ts: d.ts });
      evaluate();
    }
  };
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) evaluate();
  });
}
