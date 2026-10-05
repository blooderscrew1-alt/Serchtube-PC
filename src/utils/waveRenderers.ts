import { WaveStyle, SystemStatus } from '../types';

export interface WaveRenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  step: number;
  status: SystemStatus;
  isPlaying: boolean;
  volume: number; // 0-15
  scale: number;  // 0.2 to 3.0
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
}

export interface WaveStyleInfo {
  id: WaveStyle;
  name: string;
  category: string;
  description: string;
  badge: string;
}

export const AVAILABLE_WAVE_STYLES: WaveStyleInfo[] = [
  {
    id: 'sine_harmonic',
    name: 'Armónico Doble',
    category: 'Clásico',
    description: 'Dos ondas senoidales entrelazadas con modulación de fase armónica.',
    badge: 'Dual Sine'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Pulse Neón',
    category: 'Cyberpunk',
    description: 'Ondas láser pulsantes con resplandor neón cian/magenta y crestas vivas.',
    badge: 'Neon Glow'
  },
  {
    id: 'equalizer_bars',
    name: 'Barras de Espectro',
    category: 'Audio Pro',
    description: 'Columnas de frecuencias musicales con picos de retención flotantes.',
    badge: 'Spectrum EQ'
  },
  {
    id: 'circular_radar',
    name: 'Radar Sonar Sonoro',
    category: 'Radial',
    description: 'Ondas expansivas concéntricas que emanan del centro como sonar acústico.',
    badge: 'Sonar Ripple'
  },
  {
    id: 'galaxy_particles',
    name: 'Polvo Galáctico 3D',
    category: 'Partículas',
    description: 'Partículas estelares que flotan y giran al compás del ritmo y la voz.',
    badge: 'Cosmic Dust'
  },
  {
    id: 'laser_ribbon',
    name: 'Cinta Láser 3D',
    category: 'Fluido 3D',
    description: 'Banda ondulante multicapa con volumen tridimensional y curvas de seda.',
    badge: 'Silk Ribbon'
  },
  {
    id: 'liquid_fluid',
    name: 'Onda Líquida Orgánica',
    category: 'Fluido',
    description: 'Marea líquida viscosa que se deforma dinámicamente con los bajos.',
    badge: 'Fluid Wave'
  },
  {
    id: 'dna_helix',
    name: 'Doble Hélice ADN',
    category: 'Geometría',
    description: 'Dos hebras espirales entrelazadas con puentes de unión que giran en 3D.',
    badge: 'DNA Helix'
  },
  {
    id: 'synthwave_grid',
    name: 'Horizonte Synthwave 80s',
    category: 'Retrowave',
    description: 'Rejilla en perspectiva con relieve de montañas de alambre de neón.',
    badge: 'Outrun 80s'
  },
  {
    id: 'glitch_matrix',
    name: 'Matrix Glitch Digital',
    category: 'Digital',
    description: 'Bloques de datos cibernéticos y saltos cuantizados estilo terminal.',
    badge: 'Cyber Glitch'
  },
  {
    id: 'heartbeat_ecg',
    name: 'Telemetría Pulso ECG',
    category: 'Telemetría',
    description: 'Trazado electrocardiográfico y de telemetría con picos de aceleración.',
    badge: 'Vital Pulse'
  },
  {
    id: 'planetary_orbit',
    name: 'Órbitas Planetarias',
    category: 'Celestial',
    description: 'Anillos elípticos inclinados en rotación continua con nodos satelitales.',
    badge: 'Saturn Rings'
  },
  {
    id: 'aurora_plasma',
    name: 'Aurora Boreal de Plasma',
    category: 'Atmósfera',
    description: 'Cortinas de luz ondeantes con gradientes etéreos multicromáticos.',
    badge: 'Aurora Borealis'
  },
  {
    id: 'minimal_dots',
    name: 'Matriz de Puntos',
    category: 'Minimalista',
    description: 'Malla minimalista de puntos que se balancean con elegancia acústica.',
    badge: 'Dot Matrix'
  }
];

// Persistent state for particles and persistent bar peak animation
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
  baseRadius: number;
  angle: number;
}

let particles: Particle[] = [];
let barPeaks: number[] = [];

function initParticles(count: number, width: number, height: number) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() * 60 + 190, // Cyan to blue
      baseRadius: Math.random() * Math.min(width, height) * 0.45,
      angle: Math.random() * Math.PI * 2
    });
  }
}

/**
 * Main dispatcher to render any of the 14 wave styles on the HTML5 Canvas
 */
export function renderWaveStyle(style: WaveStyle, ctxInfo: WaveRenderContext) {
  const { ctx, width, height, step, status, isPlaying, volume, scale, colors } = ctxInfo;

  const isIdle = status === 'idle' && !isPlaying;
  const volNorm = Math.min(15, Math.max(0, volume)) / 15;
  const activityMultiplier = status === 'listening' ? 1.8 : (isPlaying ? 0.7 + volNorm * 1.2 : 0.35);
  const effectiveScale = Math.max(0.2, Math.min(3.5, scale || 1.0));

  ctx.save();

  switch (style) {
    case 'cyber_neon':
      renderCyberNeon(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'equalizer_bars':
      renderEqualizerBars(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'circular_radar':
      renderCircularRadar(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'galaxy_particles':
      renderGalaxyParticles(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'laser_ribbon':
      renderLaserRibbon(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'liquid_fluid':
      renderLiquidFluid(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'dna_helix':
      renderDnaHelix(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'synthwave_grid':
      renderSynthwaveGrid(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'glitch_matrix':
      renderGlitchMatrix(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'heartbeat_ecg':
      renderHeartbeatEcg(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'planetary_orbit':
      renderPlanetaryOrbit(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'aurora_plasma':
      renderAuroraPlasma(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'minimal_dots':
      renderMinimalDots(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'supernova_burst':
      renderSupernovaBurst(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'quantum_vortex':
      renderQuantumVortex(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'electric_lightning':
      renderElectricLightning(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'cyber_hexagons':
      renderCyberHexagons(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'hyperdrive_warp':
      renderHyperdriveWarp(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'crystal_lattice':
      renderCrystalLattice(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'sound_bubbles':
      renderSoundBubbles(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'plasma_fire':
      renderPlasmaFire(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'sacred_mandala_wave':
      renderSacredMandala(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'tachyon_laser_cross':
      renderTachyonLaserCross(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;

    case 'sine_harmonic':
    default:
      renderSineHarmonic(ctxInfo, activityMultiplier, effectiveScale, isIdle);
      break;
  }

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 1. SINE HARMONIC (Classic Dual Harmonics)
// ----------------------------------------------------------------------------
function renderSineHarmonic(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const baseAmp = (isIdle ? 8 : 28 * act) * scale;

  const waveConfigs = [
    { freq: 0.006 / Math.sqrt(scale), amp: baseAmp * 1.0, phase: 0, alpha: isIdle ? 0.25 : 0.70, color: colors.primary, width: 2.5 * scale },
    { freq: 0.012 / Math.sqrt(scale), amp: baseAmp * 0.75, phase: Math.PI / 3, alpha: isIdle ? 0.25 : 0.65, color: colors.secondary, width: 2.0 * scale },
    { freq: 0.018 / Math.sqrt(scale), amp: baseAmp * 0.45, phase: Math.PI * 0.7, alpha: isIdle ? 0.15 : 0.45, color: colors.accent, width: 1.5 * scale }
  ];

  waveConfigs.forEach(w => {
    ctx.beginPath();
    ctx.strokeStyle = w.color;
    ctx.globalAlpha = w.alpha;
    ctx.lineWidth = Math.max(1, w.width);
    ctx.shadowBlur = 10 * scale;
    ctx.shadowColor = w.color;

    const stepSize = Math.max(8, Math.round(12 / scale));
    for (let x = 0; x <= width; x += stepSize) {
      const edge = Math.sin((x / width) * Math.PI);
      const y = midY + Math.sin(x * w.freq + step + w.phase) * w.amp * edge;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

// ----------------------------------------------------------------------------
// 2. CYBER NEON (Futuristic Laser Pulse)
// ----------------------------------------------------------------------------
function renderCyberNeon(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const amp = (isIdle ? 10 : 36 * act) * scale;

  ctx.shadowBlur = 18 * scale;
  ctx.shadowColor = colors.primary;

  // Background glow beam
  ctx.beginPath();
  ctx.lineWidth = 6 * scale;
  ctx.strokeStyle = colors.primary;
  ctx.globalAlpha = 0.35;
  for (let x = 0; x <= width; x += 10) {
    const edge = Math.sin((x / width) * Math.PI);
    const pulse = Math.sin(x * 0.015 + step * 2) * Math.cos(x * 0.005 - step);
    const y = midY + pulse * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Sharp Laser Core
  ctx.beginPath();
  ctx.lineWidth = 2.5 * scale;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.95;
  for (let x = 0; x <= width; x += 8) {
    const edge = Math.sin((x / width) * Math.PI);
    const pulse = Math.sin(x * 0.015 + step * 2) * Math.cos(x * 0.005 - step);
    const y = midY + pulse * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Secondary harmonic laser
  ctx.beginPath();
  ctx.lineWidth = 2.0 * scale;
  ctx.strokeStyle = colors.secondary;
  ctx.globalAlpha = 0.8;
  for (let x = 0; x <= width; x += 8) {
    const edge = Math.sin((x / width) * Math.PI);
    const pulse2 = Math.cos(x * 0.02 - step * 1.5) * Math.sin(x * 0.008 + step);
    const y = midY + pulse2 * (amp * 0.8) * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ----------------------------------------------------------------------------
// 3. EQUALIZER BARS (Spectrum Analyzer with Floating Peaks)
// ----------------------------------------------------------------------------
function renderEqualizerBars(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const barCount = Math.max(16, Math.min(64, Math.round((width / (22 * scale)))));
  const barWidth = Math.max(4, (width / barCount) * 0.65);
  const gap = (width - barCount * barWidth) / (barCount + 1);
  const maxHeight = (height * 0.42) * Math.min(2.0, scale);
  const midY = height / 2;

  if (barPeaks.length !== barCount) {
    barPeaks = new Array(barCount).fill(0);
  }

  for (let i = 0; i < barCount; i++) {
    const x = gap + i * (barWidth + gap);
    const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
    const bellFactor = Math.cos(distFromCenter * (Math.PI / 2.2));

    // Dynamic frequency synthesis
    const freq = Math.sin(step * 3 + i * 0.45) * 0.4 + Math.cos(step * 1.8 - i * 0.3) * 0.35 + 0.25;
    const barH = Math.max(4, (isIdle ? 8 : (freq * act * maxHeight + 10)) * bellFactor);

    // Peak decay
    if (barH > barPeaks[i]) {
      barPeaks[i] = barH;
    } else {
      barPeaks[i] = Math.max(barH, barPeaks[i] - 1.2);
    }

    // Gradient bar
    const grad = ctx.createLinearGradient(x, midY - barH, x, midY + barH);
    grad.addColorStop(0, colors.secondary);
    grad.addColorStop(0.5, colors.primary);
    grad.addColorStop(1, colors.secondary);

    ctx.fillStyle = grad;
    ctx.globalAlpha = isIdle ? 0.3 : 0.85;
    ctx.shadowBlur = 6 * scale;
    ctx.shadowColor = colors.primary;

    // Mirrored vertical bar
    const roundedR = Math.min(barWidth / 2, 4);
    ctx.beginPath();
    ctx.roundRect(x, midY - barH, barWidth, barH * 2, roundedR);
    ctx.fill();

    // Floating Peak Cap
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    const peakYTop = midY - barPeaks[i] - 3;
    const peakYBottom = midY + barPeaks[i] + 1;
    ctx.fillRect(x, peakYTop, barWidth, 2);
    ctx.fillRect(x, peakYBottom, barWidth, 2);
  }
}

// ----------------------------------------------------------------------------
// 4. CIRCULAR RADAR (Expanding Sonar Ripple Waves)
// ----------------------------------------------------------------------------
function renderCircularRadar(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.48 * scale;
  const ringCount = 5;

  for (let i = 0; i < ringCount; i++) {
    const progress = ((step * 0.8 + i / ringCount) % 1);
    const radius = Math.max(10, progress * maxRadius);
    const alpha = Math.max(0, (1 - progress) * (isIdle ? 0.3 : 0.85) * act);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
    ctx.lineWidth = Math.max(1, (3 - progress * 2) * scale);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 12 * scale;
    ctx.shadowColor = colors.primary;
    ctx.stroke();

    // Radar scan sweep beam
    const scanAngle = (step * 2) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(scanAngle) * maxRadius, centerY + Math.sin(scanAngle) * maxRadius);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5 * scale;
    ctx.globalAlpha = 0.4 * act;
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 5. GALAXY PARTICLES (Cosmic Audio Reactive Dust)
// ----------------------------------------------------------------------------
function renderGalaxyParticles(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const particleCount = Math.round(60 * Math.min(2.0, scale));
  if (particles.length !== particleCount) {
    initParticles(particleCount, width, height);
  }

  const centerX = width / 2;
  const centerY = height / 2;

  particles.forEach((p, idx) => {
    // Orbital rotation around center
    p.angle += (0.01 + (idx % 5) * 0.003) * act;
    const dynamicRadius = p.baseRadius * scale * (1 + Math.sin(step * 2 + idx) * 0.2 * act);
    
    p.x = centerX + Math.cos(p.angle) * dynamicRadius * 1.6;
    p.y = centerY + Math.sin(p.angle) * dynamicRadius * 0.8;

    const size = Math.max(1.5, p.size * scale * (isIdle ? 0.8 : 1 + act * 0.5));

    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = idx % 3 === 0 ? colors.primary : (idx % 3 === 1 ? colors.secondary : '#ffffff');
    ctx.globalAlpha = p.alpha * (isIdle ? 0.35 : 0.85);
    ctx.shadowBlur = 8 * scale;
    ctx.shadowColor = colors.primary;
    ctx.fill();

    // Connecting constellations when close
    if (idx % 4 === 0 && particles[idx + 1]) {
      const pNext = particles[idx + 1];
      const dist = Math.hypot(p.x - pNext.x, p.y - pNext.y);
      if (dist < 80 * scale) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(pNext.x, pNext.y);
        ctx.strokeStyle = colors.primary;
        ctx.globalAlpha = (1 - dist / (80 * scale)) * 0.35;
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
      }
    }
  });
}

// ----------------------------------------------------------------------------
// 6. LASER RIBBON (3D Flowing Silk Wave Ribbon)
// ----------------------------------------------------------------------------
function renderLaserRibbon(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const ribbonCount = 7;
  const amp = (isIdle ? 12 : 38 * act) * scale;

  for (let r = 0; r < ribbonCount; r++) {
    const offset = (r - ribbonCount / 2) * (10 * scale);
    const phaseShift = r * 0.35;

    ctx.beginPath();
    ctx.lineWidth = Math.max(1, (1.8 - Math.abs(r - ribbonCount / 2) * 0.2) * scale);
    ctx.strokeStyle = r % 2 === 0 ? colors.primary : colors.secondary;
    ctx.globalAlpha = (isIdle ? 0.15 : 0.45) + (1 - Math.abs(r - ribbonCount / 2) / ribbonCount) * 0.4;
    ctx.shadowBlur = 10 * scale;
    ctx.shadowColor = colors.primary;

    for (let x = 0; x <= width; x += 10) {
      const edge = Math.sin((x / width) * Math.PI);
      const y = midY + offset + Math.sin(x * 0.008 + step + phaseShift) * Math.cos(x * 0.003 - step * 0.5) * amp * edge;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 7. LIQUID FLUID (Organic Fluid Wave)
// ----------------------------------------------------------------------------
function renderLiquidFluid(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const amp = (isIdle ? 14 : 45 * act) * scale;

  const grad = ctx.createLinearGradient(0, midY - amp, 0, midY + amp);
  grad.addColorStop(0, colors.primary);
  grad.addColorStop(0.5, colors.secondary);
  grad.addColorStop(1, colors.accent);

  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let x = 0; x <= width; x += 12) {
    const edge = Math.sin((x / width) * Math.PI);
    const noise = Math.sin(x * 0.007 + step) * 0.6 + Math.cos(x * 0.014 - step * 1.5) * 0.4;
    const y = midY + noise * amp * edge;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(width, height);
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.globalAlpha = isIdle ? 0.15 : 0.35;
  ctx.fill();

  // Outline edge
  ctx.beginPath();
  for (let x = 0; x <= width; x += 10) {
    const edge = Math.sin((x / width) * Math.PI);
    const noise = Math.sin(x * 0.007 + step) * 0.6 + Math.cos(x * 0.014 - step * 1.5) * 0.4;
    const y = midY + noise * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = isIdle ? 0.3 : 0.85;
  ctx.shadowBlur = 12 * scale;
  ctx.shadowColor = colors.primary;
  ctx.stroke();
}

// ----------------------------------------------------------------------------
// 8. DNA HELIX (Rotating Quantum Strands)
// ----------------------------------------------------------------------------
function renderDnaHelix(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const amp = (isIdle ? 12 : 35 * act) * scale;
  const nodeStep = Math.max(18, Math.round(26 / Math.sqrt(scale)));

  // Connecting rungs
  for (let x = 30; x <= width - 30; x += nodeStep) {
    const edge = Math.sin((x / width) * Math.PI);
    const y1 = midY + Math.sin(x * 0.012 + step * 2) * amp * edge;
    const y2 = midY + Math.sin(x * 0.012 + step * 2 + Math.PI) * amp * edge;

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = (isIdle ? 0.15 : 0.45) * edge;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Node spheres
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = isIdle ? 0.3 : 0.85;
    ctx.beginPath();
    ctx.arc(x, y1, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.arc(x, y2, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Strand 1
  ctx.beginPath();
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = isIdle ? 0.3 : 0.9;
  ctx.shadowBlur = 10 * scale;
  ctx.shadowColor = colors.primary;
  for (let x = 0; x <= width; x += 10) {
    const edge = Math.sin((x / width) * Math.PI);
    const y = midY + Math.sin(x * 0.012 + step * 2) * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Strand 2
  ctx.beginPath();
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = isIdle ? 0.3 : 0.9;
  ctx.shadowColor = colors.secondary;
  for (let x = 0; x <= width; x += 10) {
    const edge = Math.sin((x / width) * Math.PI);
    const y = midY + Math.sin(x * 0.012 + step * 2 + Math.PI) * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ----------------------------------------------------------------------------
// 9. SYNTHWAVE GRID (80s Horizon Perspective)
// ----------------------------------------------------------------------------
function renderSynthwaveGrid(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const horizonY = height * 0.45;
  const lines = 8;
  const speed = (step * 25) % 40;

  // Perspective Horizon Mountains Wave
  const amp = (isIdle ? 8 : 28 * act) * scale;
  ctx.beginPath();
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = isIdle ? 0.3 : 0.85;
  ctx.shadowBlur = 12 * scale;
  ctx.shadowColor = colors.secondary;

  for (let x = 0; x <= width; x += 12) {
    const edge = Math.sin((x / width) * Math.PI);
    const y = horizonY - Math.abs(Math.sin(x * 0.015 + step) * Math.cos(x * 0.008)) * amp * edge;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Grid horizontal lines moving toward viewer
  for (let i = 0; i < lines; i++) {
    const yNorm = Math.pow((i + speed / 40) / lines, 2);
    const y = horizonY + yNorm * (height - horizonY);

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = (1 + yNorm * 2) * scale;
    ctx.globalAlpha = yNorm * (isIdle ? 0.25 : 0.7);
    ctx.stroke();
  }

  // Grid vertical vanishing perspective lines
  const centerV = width / 2;
  const vCols = 12;
  for (let i = -vCols; i <= vCols; i++) {
    const spreadBottom = centerV + i * (width / (vCols * 1.5));
    ctx.beginPath();
    ctx.moveTo(centerV + i * 8, horizonY);
    ctx.lineTo(spreadBottom, height);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.2 * scale;
    ctx.globalAlpha = isIdle ? 0.15 : 0.45;
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 10. GLITCH MATRIX (Digital Cyberpunk Step Wave)
// ----------------------------------------------------------------------------
function renderGlitchMatrix(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const blockSize = Math.max(8, Math.round(16 * scale));
  const cols = Math.ceil(width / blockSize);
  const amp = (isIdle ? 10 : 35 * act) * scale;

  ctx.shadowBlur = 10 * scale;
  ctx.shadowColor = colors.primary;

  for (let i = 0; i < cols; i++) {
    const x = i * blockSize;
    const edge = Math.sin((x / width) * Math.PI);
    // Quantized step wave
    const rawY = Math.sin(i * 0.18 + step * 2) * amp * edge;
    const quantY = Math.round(rawY / (8 * scale)) * (8 * scale);
    const blockH = Math.max(4, Math.abs(quantY) * 0.8 + 6);

    ctx.fillStyle = i % 2 === 0 ? colors.primary : colors.secondary;
    ctx.globalAlpha = isIdle ? 0.25 : 0.75;
    ctx.fillRect(x, midY + quantY - blockH / 2, blockSize - 2, blockH);

    // Occasional glitch artifacts
    if (Math.sin(step * 5 + i * 2) > 0.85 && act > 0.5) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x + Math.sin(step * 10) * 10, midY - quantY * 1.2, blockSize * 1.5, 3 * scale);
    }
  }
}

// ----------------------------------------------------------------------------
// 11. HEARTBEAT ECG (Biometric Hypercar Telemetry)
// ----------------------------------------------------------------------------
function renderHeartbeatEcg(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const amp = (isIdle ? 14 : 45 * act) * scale;

  ctx.beginPath();
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = isIdle ? 0.35 : 0.95;
  ctx.shadowBlur = 14 * scale;
  ctx.shadowColor = colors.primary;

  const cycleWidth = 240 * scale;
  for (let x = 0; x <= width; x += 4) {
    const cyclePos = ((x - step * 120) % cycleWidth + cycleWidth) % cycleWidth;
    let y = midY;

    // ECG QRS Complex Peak Pattern
    if (cyclePos > 70 && cyclePos <= 85) {
      // P wave
      y -= Math.sin(((cyclePos - 70) / 15) * Math.PI) * (amp * 0.2);
    } else if (cyclePos > 95 && cyclePos <= 105) {
      // Q drop
      y += ((cyclePos - 95) / 10) * (amp * 0.3);
    } else if (cyclePos > 105 && cyclePos <= 120) {
      // R spike
      y -= Math.sin(((cyclePos - 105) / 15) * Math.PI) * (amp * 1.3);
    } else if (cyclePos > 120 && cyclePos <= 130) {
      // S dip
      y += Math.sin(((cyclePos - 120) / 10) * Math.PI) * (amp * 0.45);
    } else if (cyclePos > 145 && cyclePos <= 175) {
      // T wave
      y -= Math.sin(((cyclePos - 145) / 30) * Math.PI) * (amp * 0.35);
    }

    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Baseline telemetry glow
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1 * scale;
  ctx.globalAlpha = isIdle ? 0.15 : 0.35;
  ctx.stroke();
}

// ----------------------------------------------------------------------------
// 12. PLANETARY ORBIT (Spinning Rings of Saturn)
// ----------------------------------------------------------------------------
function renderPlanetaryOrbit(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const orbits = 4;

  for (let i = 0; i < orbits; i++) {
    const rx = (Math.min(width, height) * (0.2 + i * 0.08)) * scale;
    const ry = (rx * (0.35 + Math.sin(step * 0.5 + i) * 0.05));
    const rotation = (step * (0.2 + i * 0.1) + (i * Math.PI) / 4);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
    ctx.lineWidth = (2.2 - i * 0.3) * scale;
    ctx.globalAlpha = isIdle ? 0.25 : 0.75;
    ctx.shadowBlur = 10 * scale;
    ctx.shadowColor = colors.primary;
    ctx.stroke();

    // Orbiting Moon / Satellite Node
    const moonAngle = step * (1.5 + i * 0.5);
    const mx = Math.cos(moonAngle) * rx;
    const my = Math.sin(moonAngle) * ry;

    ctx.beginPath();
    ctx.arc(mx, my, (4 - i * 0.5) * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.95;
    ctx.fill();

    ctx.restore();
  }
}

// ----------------------------------------------------------------------------
// 13. AURORA PLASMA (Floating Aurora Borealis)
// ----------------------------------------------------------------------------
function renderAuroraPlasma(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const curtains = 4;
  const amp = (isIdle ? 16 : 42 * act) * scale;

  for (let c = 0; c < curtains; c++) {
    const shift = c * 1.2;
    const grad = ctx.createLinearGradient(0, midY - amp * 1.5, 0, midY + amp * 1.5);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, c % 2 === 0 ? colors.primary : colors.secondary);
    grad.addColorStop(0.7, c % 2 === 0 ? colors.accent : colors.primary);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const edge = Math.sin((x / width) * Math.PI);
      const wave = Math.sin(x * 0.005 + step * 1.2 + shift) * Math.cos(x * 0.002 - step * 0.8);
      const y = midY + wave * amp * edge;

      if (x === 0) ctx.moveTo(x, y - (30 * scale));
      else ctx.lineTo(x, y - (30 * scale));
    }

    for (let x = width; x >= 0; x -= 12) {
      const edge = Math.sin((x / width) * Math.PI);
      const wave = Math.sin(x * 0.005 + step * 1.2 + shift) * Math.cos(x * 0.002 - step * 0.8);
      const y = midY + wave * amp * edge;
      ctx.lineTo(x, y + (30 * scale));
    }

    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.globalAlpha = (isIdle ? 0.15 : 0.35) * (1 - c * 0.15);
    ctx.fill();
  }
}

// ----------------------------------------------------------------------------
// 14. MINIMAL DOTS (Acoustic Matrix Points)
// ----------------------------------------------------------------------------
function renderMinimalDots(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const dotSpacing = Math.max(12, Math.round(18 * scale));
  const cols = Math.floor(width / dotSpacing);
  const rows = 5;
  const amp = (isIdle ? 8 : 28 * act) * scale;

  for (let c = 0; c < cols; c++) {
    const x = c * dotSpacing;
    const edge = Math.sin((x / width) * Math.PI);

    for (let r = 0; r < rows; r++) {
      const rowOffset = (r - rows / 2) * (12 * scale);
      const wave = Math.sin(x * 0.01 + step * 2 + r * 0.4) * amp * edge;
      const y = Math.max(10, Math.min(height - 10, midY + rowOffset + wave));

      const dotRadius = Math.max(1.2, (2.8 - Math.abs(r - rows / 2) * 0.6) * scale);

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = r === 2 ? '#ffffff' : (r % 2 === 0 ? colors.primary : colors.secondary);
      ctx.globalAlpha = (isIdle ? 0.25 : 0.8) * edge;
      ctx.fill();
    }
  }
}

// ----------------------------------------------------------------------------
// 15. SUPERNOVA BURST (Cosmic Stellar Shockwave)
// ----------------------------------------------------------------------------
function renderSupernovaBurst(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.46 * scale;
  const rays = 24;

  // Expanding shockwave rings
  for (let r = 0; r < 4; r++) {
    const prog = ((step * 0.6 + r * 0.25) % 1);
    const radius = prog * maxR * (isIdle ? 0.8 : 1.2);
    const alpha = (1 - prog) * (isIdle ? 0.2 : 0.6 * act);

    ctx.strokeStyle = r % 2 === 0 ? colors.primary : colors.accent;
    ctx.lineWidth = Math.max(1, (3 - r * 0.5) * scale);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial shockwave rays
  for (let i = 0; i < rays; i++) {
    const angle = (i * Math.PI * 2) / rays + step * 0.2;
    const len = maxR * (0.4 + Math.sin(step * 3 + i * 2) * 0.3 * act);
    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;

    const grad = ctx.createLinearGradient(cx, cy, ex, ey);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, colors.primary);
    grad.addColorStop(1, 'transparent');

    ctx.strokeStyle = grad;
    ctx.lineWidth = (2 + Math.sin(step * 4 + i) * 1.5) * scale;
    ctx.globalAlpha = isIdle ? 0.25 : 0.75;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 16. QUANTUM VORTEX (Gravitational Whirlpool)
// ----------------------------------------------------------------------------
function renderQuantumVortex(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const arms = 5;
  const maxRadius = Math.min(width, height) * 0.48 * scale;

  for (let a = 0; a < arms; a++) {
    const armAngle = (a * Math.PI * 2) / arms + step * (isIdle ? 0.8 : 1.6);
    ctx.strokeStyle = a % 2 === 0 ? colors.primary : colors.secondary;
    ctx.lineWidth = Math.max(1, 2.2 * scale);
    ctx.globalAlpha = isIdle ? 0.3 : 0.75;
    ctx.beginPath();

    for (let r = 15; r < maxRadius; r += 6) {
      const theta = armAngle + (r / 35);
      const x = cx + Math.cos(theta) * r;
      const y = Math.max(8, Math.min(height - 8, cy + Math.sin(theta) * (r * 0.65)));
      if (r === 15) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Vortex Spark Nodes
  for (let i = 0; i < 16; i++) {
    const pRad = 20 + ((step * 40 + i * 25) % (maxRadius - 20));
    const pAng = step * 2 + i * 0.8 + (pRad / 30);
    const px = cx + Math.cos(pAng) * pRad;
    const py = Math.max(8, Math.min(height - 8, cy + Math.sin(pAng) * (pRad * 0.65)));

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(px, py, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----------------------------------------------------------------------------
// 17. ELECTRIC LIGHTNING (Tesla High Voltage Plasma Arcs)
// ----------------------------------------------------------------------------
function renderElectricLightning(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const numBolts = isIdle ? 2 : 4;

  for (let b = 0; b < numBolts; b++) {
    ctx.strokeStyle = b % 2 === 0 ? '#ffffff' : colors.primary;
    ctx.lineWidth = (2.5 - b * 0.5) * scale;
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 12 * scale;
    ctx.globalAlpha = isIdle ? 0.4 : 0.85;

    ctx.beginPath();
    let curX = 0;
    let curY = midY;
    ctx.moveTo(curX, curY);

    const segments = 28;
    const segWidth = width / segments;

    for (let s = 1; s <= segments; s++) {
      const nextX = s * segWidth;
      const edge = Math.sin((nextX / width) * Math.PI);
      const jitter = (Math.sin(s * 7.5 + step * 12 + b * 4) * 35 * act * edge) * scale;
      const nextY = Math.max(10, Math.min(height - 10, midY + jitter));

      ctx.lineTo(nextX, nextY);

      // Random Branching Fork
      if (s % 7 === 0 && act > 0.6) {
        ctx.save();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(nextX, nextY);
        ctx.lineTo(nextX + 25 * scale, nextY + (s % 2 === 0 ? 30 : -30) * scale);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 18. CYBER HEXAGONS (Isometric Holographic Honeycomb)
// ----------------------------------------------------------------------------
function renderCyberHexagons(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const hexSize = Math.max(14, Math.round(22 * scale));
  const cols = Math.floor(width / (hexSize * 1.5)) + 1;
  const rows = 5;

  ctx.lineWidth = 1.4;

  for (let r = -2; r <= 2; r++) {
    for (let c = 0; c < cols; c++) {
      const hx = c * hexSize * 1.5;
      const hy = midY + r * hexSize * 1.732 + (c % 2 !== 0 ? (hexSize * 1.732) / 2 : 0);
      const edge = Math.sin((hx / width) * Math.PI);
      const pulse = Math.sin(hx * 0.02 + step * 2.5 + r) * act;
      const alpha = (isIdle ? 0.15 : (0.25 + Math.max(0, pulse) * 0.6)) * edge;

      if (hy > 10 && hy < height - 10) {
        ctx.strokeStyle = pulse > 0.4 ? '#ffffff' : (r % 2 === 0 ? colors.primary : colors.secondary);
        ctx.globalAlpha = Math.max(0.08, alpha);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = hx + Math.cos(a) * (hexSize * 0.85);
          const py = hy + Math.sin(a) * (hexSize * 0.85);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 19. HYPERDRIVE WARP (Relativistic Warp Speed Streaks)
// ----------------------------------------------------------------------------
function renderHyperdriveWarp(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const numStars = 48;
  const speed = (isIdle ? 1.0 : 2.5 * act);

  for (let i = 0; i < numStars; i++) {
    const angle = (i * Math.PI * 2) / numStars + i * 0.15;
    const progress = ((step * speed * 0.2 + i * 0.08) % 1);
    const dist1 = Math.pow(progress, 2) * Math.min(width, height) * 0.6 * scale;
    const dist2 = Math.pow(Math.min(1, progress + 0.12), 2) * Math.min(width, height) * 0.6 * scale;

    const x1 = cx + Math.cos(angle) * dist1;
    const y1 = cy + Math.sin(angle) * dist1;
    const x2 = cx + Math.cos(angle) * dist2;
    const y2 = cy + Math.sin(angle) * dist2;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, colors.primary);
    grad.addColorStop(1, '#ffffff');

    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, progress * 3 * scale);
    ctx.globalAlpha = Math.min(1, progress * 1.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 20. CRYSTAL LATTICE (Refractive Quartz Polygons)
// ----------------------------------------------------------------------------
function renderCrystalLattice(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const segments = 16;
  const segW = width / segments;

  ctx.lineWidth = 1.6 * scale;

  for (let s = 0; s < segments; s++) {
    const x1 = s * segW;
    const x2 = (s + 1) * segW;
    const edge1 = Math.sin((x1 / width) * Math.PI);
    const edge2 = Math.sin((x2 / width) * Math.PI);

    const amp = (isIdle ? 15 : 45 * act) * scale;
    const yTop1 = Math.max(10, midY - Math.abs(Math.sin(x1 * 0.01 + step * 2)) * amp * edge1);
    const yBot1 = Math.min(height - 10, midY + Math.abs(Math.cos(x1 * 0.01 + step * 2)) * amp * edge1);
    const yTop2 = Math.max(10, midY - Math.abs(Math.sin(x2 * 0.01 + step * 2)) * amp * edge2);
    const yBot2 = Math.min(height - 10, midY + Math.abs(Math.cos(x2 * 0.01 + step * 2)) * amp * edge2);

    // Diagonal lattice struts
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = isIdle ? 0.3 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x1, yTop1);
    ctx.lineTo(x2, yBot2);
    ctx.lineTo(x2, yTop2);
    ctx.lineTo(x1, yBot1);
    ctx.closePath();
    ctx.stroke();

    // Vertices Nodes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x1, yTop1, 2.5 * scale, 0, Math.PI * 2);
    ctx.arc(x1, yBot1, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----------------------------------------------------------------------------
// 21. SOUND BUBBLES (Bioluminescent Floating Spheres)
// ----------------------------------------------------------------------------
function renderSoundBubbles(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const numBubbles = 24;

  for (let i = 0; i < numBubbles; i++) {
    const normX = (i / numBubbles + step * 0.05) % 1;
    const x = normX * width;
    const edge = Math.sin(normX * Math.PI);
    const floatY = Math.sin(step * 2 + i * 1.5) * (30 * scale) + Math.cos(normX * 10 + step) * (15 * act * scale);
    const y = Math.max(15, Math.min(height - 15, midY + floatY));
    const r = Math.max(3, (6 + Math.sin(step * 3 + i) * 4 * act) * scale);

    // Glow bubble
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, colors.primary);
    grad.addColorStop(1, colors.secondary + '33');

    ctx.fillStyle = grad;
    ctx.globalAlpha = (isIdle ? 0.35 : 0.8) * edge;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 22. PLASMA FIRE (Dancing Solar Plasma Flames)
// ----------------------------------------------------------------------------
function renderPlasmaFire(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const midY = height / 2;
  const numTongues = 32;
  const tongueW = width / numTongues;

  for (let i = 0; i < numTongues; i++) {
    const x = i * tongueW + tongueW / 2;
    const edge = Math.sin((x / width) * Math.PI);
    const flameH = (isIdle ? 20 : (40 + Math.sin(x * 0.03 + step * 5 + i) * 35 * act)) * scale * edge;

    const grad = ctx.createLinearGradient(x, midY + flameH / 2, x, midY - flameH);
    grad.addColorStop(0, colors.secondary + '22');
    grad.addColorStop(0.5, colors.primary);
    grad.addColorStop(1, '#ffffff');

    ctx.fillStyle = grad;
    ctx.globalAlpha = isIdle ? 0.3 : 0.75;
    ctx.beginPath();
    ctx.moveTo(x - tongueW * 0.8, midY + 10 * scale);
    ctx.quadraticCurveTo(x, midY - flameH, x + tongueW * 0.8, midY + 10 * scale);
    ctx.closePath();
    ctx.fill();
  }
}

// ----------------------------------------------------------------------------
// 23. SACRED MANDALA (Harmonic Sacred Geometry)
// ----------------------------------------------------------------------------
function renderSacredMandala(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.44 * scale;
  const petals = 8;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * (isIdle ? 0.2 : 0.6));

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 1.8 * scale;
  ctx.globalAlpha = isIdle ? 0.3 : 0.8;

  // Concentric petal layers
  for (let layer = 1; layer <= 3; layer++) {
    const lRadius = (maxR * layer) / 3 * (0.8 + 0.2 * act);
    for (let p = 0; p < petals; p++) {
      const angle = (p * Math.PI * 2) / petals;
      const px = Math.cos(angle) * (lRadius * 0.5);
      const py = Math.sin(angle) * (lRadius * 0.5);

      ctx.beginPath();
      ctx.arc(px, py, lRadius * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Bounding Golden Ratio Ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, maxR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 24. TACHYON LASER CROSS (Diffraction Spikes & Photon Beams)
// ----------------------------------------------------------------------------
function renderTachyonLaserCross(
  { ctx, width, height, step, colors }: WaveRenderContext,
  act: number,
  scale: number,
  isIdle: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const beams = 8;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.4);

  for (let b = 0; b < beams; b++) {
    const angle = (b * Math.PI * 2) / beams;
    const len = Math.max(width, height) * 0.6 * scale;
    const ex = Math.cos(angle) * len;
    const ey = Math.sin(angle) * len;

    const grad = ctx.createLinearGradient(0, 0, ex, ey);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, colors.primary);
    grad.addColorStop(0.8, colors.secondary + '44');
    grad.addColorStop(1, 'transparent');

    ctx.strokeStyle = grad;
    ctx.lineWidth = (b % 2 === 0 ? 3.5 : 1.5) * scale;
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 15 * scale;
    ctx.globalAlpha = isIdle ? 0.35 : 0.85;

    ctx.beginPath();
    ctx.moveTo(-ex, -ey);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.restore();
}

