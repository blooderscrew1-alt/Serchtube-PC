import React, { useEffect, useRef } from 'react';
import { OrbStyle, SystemStatus, Track } from '../types';

interface OrbRendererProps {
  style?: OrbStyle;
  status: SystemStatus;
  isPlaying: boolean;
  volume: number; // 0 to 15
  track?: Track | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
    dot?: string;
  };
  opacity?: number;
  size?: number; // base size in px (e.g. 192 or 208)
  onClick?: () => void;
}

export const OrbRenderer: React.FC<OrbRendererProps> = React.memo(({
  style = 'classic_core',
  status,
  isPlaying,
  volume,
  track,
  colors,
  opacity = 1.0,
  size = 192,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(status);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const colorsRef = useRef(colors);
  const styleRef = useRef(style);
  const trackRef = useRef(track);

  // Cached Image for Album Cover / Artist Photo Orbs
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const isCoverLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    statusRef.current = status;
    isPlayingRef.current = isPlaying;
    volumeRef.current = volume;
    colorsRef.current = colors;
    styleRef.current = style;
    trackRef.current = track;
  }, [status, isPlaying, volume, colors, style, track]);

  // Load and cache album cover / artist thumbnail
  useEffect(() => {
    const thumbUrl = track?.thumbnail && !track.thumbnail.includes('placeholder')
      ? track.thumbnail
      : (track?.id ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      coverImageRef.current = img;
      isCoverLoadedRef.current = true;
    };
    img.onerror = () => {
      // Fallback without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        coverImageRef.current = fallbackImg;
        isCoverLoadedRef.current = true;
      };
      fallbackImg.src = thumbUrl;
    };
    img.src = thumbUrl;
  }, [track?.id, track?.thumbnail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step += 0.035;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = (Math.min(w, h) / 2) * 0.88;

      ctx.clearRect(0, 0, w, h);

      const curStatus = statusRef.current;
      const curPlaying = isPlayingRef.current;
      const curVol = volumeRef.current;
      const curColors = colorsRef.current;
      const curStyle = styleRef.current;
      const curTrack = trackRef.current;
      const coverImg = coverImageRef.current;
      const isCoverLoaded = isCoverLoadedRef.current;

      const isListening = curStatus === 'listening';
      const isProcessing = curStatus === 'processing';
      const isSpeaking = curStatus === 'speaking';
      const volFactor = curPlaying ? 0.3 + (curVol / 15) * 0.7 : (isListening ? 1.0 : 0.2);
      const pulse = Math.sin(step * (isListening ? 4 : (curPlaying ? 2.5 : 1.2))) * 0.15;
      const actRadius = radius * (1 + pulse * volFactor);

      ctx.save();

      // Dispatch specific orb renderer
      switch (curStyle) {
        // --- NUEVOS ORBES CON CARÁTULA Y FOTO DE ARTISTA (12 ESTILOS) ---
        case 'cover_vinyl_turntable':
          renderCoverVinylTurntable(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_holo_projector':
          renderCoverHoloProjector(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_cyber_aperture':
          renderCoverCyberAperture(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_spectrum_ring':
          renderCoverSpectrumRing(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_stargate_portal':
          renderCoverStargatePortal(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_neon_radiance':
          renderCoverNeonRadiance(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_radar_sonar':
          renderCoverRadarSonar(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_compact_disc':
          renderCoverCompactDisc(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_crystal_prism':
          renderCoverCrystalPrism(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_matrix_cyber':
          renderCoverMatrixCyber(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_blackout_oled':
          renderCoverBlackoutOLED(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;
        case 'cover_swiss_gold_watch':
          renderCoverSwissGoldWatch(ctx, cx, cy, actRadius, step, curColors, volFactor, coverImg, isCoverLoaded);
          break;

        // --- ORBES ORIGINALES ---
        case 'iron_arc_reactor':
          renderArcReactor(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'cyber_hud_eye':
          renderCyberHudEye(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'plasma_pulsar':
          renderPlasmaPulsar(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'quantum_singularity':
          renderQuantumSingularity(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'hologram_wireframe':
          renderHologramWireframe(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'energy_forcefield':
          renderEnergyForcefield(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'atomic_orbital':
          renderAtomicOrbital(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'neon_gyroscope':
          renderNeonGyroscope(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'crystal_quartz':
          renderCrystalQuartz(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'bioluminescent_jelly':
          renderBioluminescentJelly(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'tachyon_accelerator':
          renderTachyonAccelerator(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'radar_tactical_cross':
          renderRadarTacticalCross(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'solar_eclipse':
          renderSolarEclipse(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'digital_matrix_nexus':
          renderDigitalMatrixNexus(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'sound_ripple_3d':
          renderSoundRipple3D(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'stealth_hex_orb':
          renderStealthHexOrb(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'sacred_flower_life':
          renderSacredFlowerLife(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'hypercube_tesseract':
          renderHypercubeTesseract(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'vortex_black_hole':
          renderVortexBlackHole(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
        case 'classic_core':
        default:
          renderClassicCore(ctx, cx, cy, actRadius, step, curColors, volFactor, isListening);
          break;
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      onClick={onClick}
      className="relative rounded-full cursor-pointer select-none transition-transform active:scale-95 duration-200"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        opacity: Math.max(0, Math.min(1, opacity))
      }}
      title="Toca para activar/desactivar escucha de voz"
    >
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        className="w-full h-full pointer-events-none"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  );
});

// ============================================================================
// 1. CLASSIC REACTOR CORE
// ============================================================================
function renderClassicCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  // Outer Ambient Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.15);
  glowGrad.addColorStop(0, colors.primary + '44');
  glowGrad.addColorStop(0.6, colors.secondary + '22');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Dark Spherical Core
  const coreGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r * 0.9);
  coreGrad.addColorStop(0, '#1c1f26');
  coreGrad.addColorStop(0.7, '#080a0f');
  coreGrad.addColorStop(1, '#000000');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Rotating Dashed Outer Ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.4);
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6, 2, 6]);
  ctx.globalAlpha = 0.75 + vol * 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Inner Iris Ring (Counter-rotating)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-step * 0.6);
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Center High-Energy Pulse Dot
  const dotR = r * (0.16 + Math.sin(step * 3) * 0.03 * vol);
  const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR * 1.8);
  dotGrad.addColorStop(0, '#ffffff');
  dotGrad.addColorStop(0.4, colors.primary);
  dotGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dotGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// 2. IRON ARC REACTOR (Mark VII Coils)
// ============================================================================
function renderArcReactor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  // Metallic Outer Housing
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner Palladium Core Glow
  const palGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45);
  palGrad.addColorStop(0, '#ffffff');
  palGrad.addColorStop(0.3, colors.primary);
  palGrad.addColorStop(0.8, colors.secondary + '44');
  palGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = palGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // 10 Electromagnetic Copper Wire Coils
  const coils = 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.3);

  for (let i = 0; i < coils; i++) {
    const angle = (i * Math.PI * 2) / coils;
    ctx.save();
    ctx.rotate(angle);

    // Coil Bracket
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(r * 0.52, -r * 0.08, r * 0.34, r * 0.16);

    // Copper Wire windings
    ctx.strokeStyle = '#d97706'; // Copper Gold
    ctx.lineWidth = 1.5;
    for (let w = 0; w < 4; w++) {
      ctx.beginPath();
      ctx.moveTo(r * 0.56 + w * (r * 0.07), -r * 0.08);
      ctx.lineTo(r * 0.56 + w * (r * 0.07), r * 0.08);
      ctx.stroke();
    }

    // Light Discharge between coils
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8 + Math.sin(step * 4 + i) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, -0.15, 0.15);
    ctx.stroke();

    ctx.restore();
  }

  // Inner Locking Ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 3. CYBER HUD EYE (HAL Optical Scanner)
// ============================================================================
function renderCyberHudEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  // Dark Glass Lens
  const lensGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9);
  lensGrad.addColorStop(0, '#000000');
  lensGrad.addColorStop(0.8, '#050b14');
  lensGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = lensGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Degree Ticks on rim
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.2);

  const ticks = 36;
  ctx.strokeStyle = colors.primary;
  for (let i = 0; i < ticks; i++) {
    const angle = (i * Math.PI * 2) / ticks;
    const isMajor = i % 9 === 0;
    const len = isMajor ? r * 0.14 : r * 0.06;
    ctx.lineWidth = isMajor ? 2.5 : 1;
    ctx.globalAlpha = isMajor ? 0.9 : 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (r * 0.88), Math.sin(angle) * (r * 0.88));
    ctx.lineTo(Math.cos(angle) * (r * 0.88 - len), Math.sin(angle) * (r * 0.88 - len));
    ctx.stroke();
  }

  // Sweeping Radar Line
  const sweepAngle = step * 1.8;
  const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
  sweepGrad.addColorStop(0, colors.primary + '88');
  sweepGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.8, sweepAngle, sweepAngle + 0.6);
  ctx.closePath();
  ctx.fill();

  // Optical Aperture Iris
  const blades = 6;
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  const irisR = r * (0.35 + Math.sin(step * 2) * 0.08 * vol);
  for (let b = 0; b < blades; b++) {
    const ba = (b * Math.PI * 2) / blades + step * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ba) * irisR, Math.sin(ba) * irisR);
    ctx.lineTo(Math.cos(ba + 1.2) * (r * 0.7), Math.sin(ba + 1.2) * (r * 0.7));
    ctx.stroke();
  }

  // Center Laser Eye Pupil
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 4. PLASMA PULSAR (Stellar Flare Sphere)
// ============================================================================
function renderPlasmaPulsar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  // Boiling Solar Coronal Flares
  const flares = 24;
  ctx.save();
  ctx.translate(cx, cy);

  for (let i = 0; i < flares; i++) {
    const angle = (i * Math.PI * 2) / flares + step * 0.3;
    const flareLen = r * (0.6 + Math.sin(step * 4 + i * 2.5) * 0.35 * vol);
    const fx = Math.cos(angle) * flareLen;
    const fy = Math.sin(angle) * flareLen;

    const fGrad = ctx.createLinearGradient(0, 0, fx, fy);
    fGrad.addColorStop(0, colors.primary);
    fGrad.addColorStop(0.7, colors.secondary + '66');
    fGrad.addColorStop(1, 'transparent');

    ctx.strokeStyle = fGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  // Dense Nuclear Core
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.65);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.4, colors.primary);
  coreGrad.addColorStop(0.8, colors.secondary);
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // Rotating Plasma Jet Axis
  ctx.rotate(step * 1.2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(0, r * 0.95);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 5. QUANTUM SINGULARITY (Black Hole & Accretion Disk)
// ============================================================================
function renderQuantumSingularity(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Warped Gravitational Accretion Disk (Upper/Lower bent halo)
  ctx.save();
  ctx.rotate(-0.35);
  ctx.scale(1, 0.45);

  const accGrad = ctx.createRadialGradient(0, 0, r * 0.45, 0, 0, r * 1.3);
  accGrad.addColorStop(0, '#ffffff');
  accGrad.addColorStop(0.2, colors.primary);
  accGrad.addColorStop(0.6, colors.secondary + '88');
  accGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = accGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Spiral streak lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 12, 5, 8]);
  ctx.rotate(step * 1.5);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Absolute Black Hole Event Horizon
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
  ctx.fill();

  // Relativistic Photon Ring (Einstein Ring)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.50, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 6. HOLOGRAM WIREFRAME 3D (Geodesic Sphere)
// ============================================================================
function renderHologramWireframe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Parallels (Latitudes)
  const lats = 7;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 1.6;

  for (let i = 1; i < lats; i++) {
    const latY = -r * 0.75 + (i * (r * 1.5)) / lats;
    const latR = Math.sqrt(Math.max(0, Math.pow(r * 0.75, 2) - Math.pow(latY, 2)));
    ctx.save();
    ctx.translate(0, latY);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, latR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Meridians (Longitudes in 3D rotation)
  const longs = 8;
  for (let i = 0; i < longs; i++) {
    const angle = (i * Math.PI) / longs + step * 0.8;
    ctx.save();
    ctx.rotate(angle);
    ctx.scale(0.35, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Orbital Vector Nodes
  const nodes = 6;
  for (let n = 0; n < nodes; n++) {
    const na = (n * Math.PI * 2) / nodes + step * 1.5;
    const nx = Math.cos(na) * (r * 0.88);
    const ny = Math.sin(na) * (r * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// 7. ENERGY FORCEFIELD (Hexagonal Barrier)
// ============================================================================
function renderEnergyForcefield(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer Shield Ring
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  // Hexagonal Honeycomb Tiles
  const hexRadius = r * 0.18;
  const hexRows = 5;
  const hexCols = 5;

  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1.5;

  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const hx = col * hexRadius * 1.5;
      const hy = row * hexRadius * 1.732 + (col % 2 !== 0 ? (hexRadius * 1.732) / 2 : 0);
      const dist = Math.sqrt(hx * hx + hy * hy);
      if (dist < r * 0.75) {
        const hexAlpha = 0.3 + Math.sin(step * 3 + dist * 0.05) * 0.35 * vol;
        ctx.globalAlpha = Math.max(0.1, hexAlpha);
        drawHex(ctx, hx, hy, hexRadius * 0.85);
      }
    }
  }

  // Energy Core
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

// ============================================================================
// 8. ATOMIC ORBITAL (Quantum Bohr Model)
// ============================================================================
function renderAtomicOrbital(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Protons / Neutrons Core
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.28);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.5, colors.primary);
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // 3 Elliptical Electron Orbits
  const orbits = 3;
  ctx.lineWidth = 2;

  for (let i = 0; i < orbits; i++) {
    const orbitAngle = (i * Math.PI) / 3;
    ctx.save();
    ctx.rotate(orbitAngle);
    ctx.scale(1, 0.38);

    ctx.strokeStyle = i === 0 ? colors.primary : (i === 1 ? colors.secondary : colors.accent);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    // Fast Orbiting Electron
    const eAngle = step * (2.5 + i * 0.8);
    const ex = Math.cos(eAngle) * (r * 0.85);
    const ey = Math.sin(eAngle) * (r * 0.85);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 9. NEON GYROSCOPE 3D (Tri-Gimbal Mechanism)
// ============================================================================
function renderNeonGyroscope(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Ring 1 (X Axis Tilt)
  ctx.save();
  ctx.rotate(step * 0.6);
  ctx.scale(1, Math.cos(step * 0.9));
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ring 2 (Y Axis Tilt)
  ctx.save();
  ctx.rotate(-step * 0.8 + 1.0);
  ctx.scale(Math.sin(step * 0.7), 1);
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ring 3 (Z Axis Tilt)
  ctx.save();
  ctx.rotate(step * 1.1 + 2.0);
  ctx.scale(1, Math.sin(step * 1.2));
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Center Levitating Gyro Core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 10. CRYSTAL QUARTZ (Iridiscent Prism Facets)
// ============================================================================
function renderCrystalQuartz(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.4);

  const vertices = 8;
  const outerR = r * 0.85;
  const innerR = r * 0.45;

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;

  // Draw Octagonal Crystal Edge
  ctx.beginPath();
  for (let i = 0; i < vertices; i++) {
    const a = (i * Math.PI * 2) / vertices;
    const px = Math.cos(a) * outerR;
    const py = Math.sin(a) * outerR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Facet connecting lines
  for (let i = 0; i < vertices; i++) {
    const a = (i * Math.PI * 2) / vertices;
    const ox = Math.cos(a) * outerR;
    const oy = Math.sin(a) * outerR;
    const ix = Math.cos(a + 0.3) * innerR;
    const iy = Math.sin(a + 0.3) * innerR;

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ix, iy);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }

  // Center Rainbow Highlight
  const pGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.35);
  pGrad.addColorStop(0, '#ffffff');
  pGrad.addColorStop(0.5, colors.primary);
  pGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 11. BIOLUMINESCENT JELLY (Deep Sea Creature)
// ============================================================================
function renderBioluminescentJelly(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Umbrella Dome (Upper half)
  const domeGrad = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r * 0.85);
  domeGrad.addColorStop(0, '#ffffff');
  domeGrad.addColorStop(0.3, colors.primary + 'bb');
  domeGrad.addColorStop(0.8, colors.secondary + '44');
  domeGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.75, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Undulating Tentacles (Lower)
  const tentacles = 7;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;

  for (let t = 0; t < tentacles; t++) {
    const tx = -r * 0.55 + (t * (r * 1.1)) / (tentacles - 1);
    ctx.beginPath();
    ctx.moveTo(tx, -r * 0.1);

    for (let y = -r * 0.1; y <= r * 0.85; y += 10) {
      const wave = Math.sin(y * 0.05 + step * 3 + t) * (15 * vol);
      ctx.lineTo(tx + wave, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// 12. TACHYON ACCELERATOR (High Frequency Particle Collider)
// ============================================================================
function renderTachyonAccelerator(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Acceleration Tracks
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // Fast Counter-Rotating Particles
  const pCount = 12;
  for (let i = 0; i < pCount; i++) {
    const angle1 = (i * Math.PI * 2) / pCount + step * 4;
    const angle2 = (i * Math.PI * 2) / pCount - step * 4;

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(Math.cos(angle1) * (r * 0.85), Math.sin(angle1) * (r * 0.85), 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.arc(Math.cos(angle2) * (r * 0.65), Math.sin(angle2) * (r * 0.65), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Tachyon Fusion Beam
  const beamR = r * (0.2 + Math.sin(step * 5) * 0.05 * vol);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(0, 0, beamR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 13. RADAR TACTICAL CROSS (Fighter Jet HUD Reticle)
// ============================================================================
function renderRadarTacticalCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Reticle Circles
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs with gap in center
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Left / Right
  ctx.moveTo(-r * 0.95, 0);
  ctx.lineTo(-r * 0.35, 0);
  ctx.moveTo(r * 0.35, 0);
  ctx.lineTo(r * 0.95, 0);
  // Top / Bottom
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(0, -r * 0.35);
  ctx.moveTo(0, r * 0.35);
  ctx.lineTo(0, r * 0.95);
  ctx.stroke();

  // Rotating Target Lock Box
  ctx.save();
  ctx.rotate(step * 1.5);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(-r * 0.18, -r * 0.18, r * 0.36, r * 0.36);
  ctx.restore();

  ctx.restore();
}

// ============================================================================
// 14. SOLAR ECLIPSE (Coronal Mass Ejection)
// ============================================================================
function renderSolarEclipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Flaming Corona Streamers
  const rays = 32;
  for (let i = 0; i < rays; i++) {
    const a = (i * Math.PI * 2) / rays + step * 0.2;
    const len = r * (0.65 + Math.sin(step * 3 + i * 3) * 0.35 * vol);
    ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5));
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }

  // Black Lunar Silhouette
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  // Baily's Beads / Diamond Ring Flash
  const diamondAngle = step * 0.5;
  const dx = Math.cos(diamondAngle) * (r * 0.52);
  const dy = Math.sin(diamondAngle) * (r * 0.52);

  const dGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, r * 0.25);
  dGrad.addColorStop(0, '#ffffff');
  dGrad.addColorStop(0.5, colors.primary);
  dGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = dGrad;
  ctx.beginPath();
  ctx.arc(dx, dy, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 15. DIGITAL MATRIX NEXUS (Binary Code Orb)
// ============================================================================
function renderDigitalMatrixNexus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Rotating Concentric Glyphs
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = '0101100101101010';
  const rings = 3;

  for (let ring = 0; ring < rings; ring++) {
    const ringR = r * (0.35 + ring * 0.25);
    const count = 10 + ring * 6;
    ctx.save();
    ctx.rotate((ring % 2 === 0 ? 1 : -1) * step * (0.8 - ring * 0.2));

    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      const char = chars[(i + Math.floor(step * 4)) % chars.length];
      const px = Math.cos(a) * ringR;
      const py = Math.sin(a) * ringR;
      ctx.fillStyle = ring === 0 ? '#ffffff' : colors.primary;
      ctx.fillText(char, px, py);
    }
    ctx.restore();
  }

  // Center Data Core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 16. SOUND RIPPLE 3D (Spherical Acoustic Wave Emitter)
// ============================================================================
function renderSoundRipple3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Expanding Wave Fronts
  const waves = 5;
  for (let i = 0; i < waves; i++) {
    const waveProgress = ((step * 0.8 + (i / waves)) % 1);
    const waveR = r * 0.2 + waveProgress * (r * 0.75);
    const alpha = (1 - waveProgress) * (0.7 + vol * 0.3);

    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.5 * (1 - waveProgress);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, waveR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Vibrating Core
  ctx.globalAlpha = 1.0;
  const coreR = r * (0.2 + Math.sin(step * 6) * 0.04 * vol);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 17. STEALTH HEX ORB (Armored Hexagon Composite)
// ============================================================================
function renderStealthHexOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.2);

  // Outer Faceted Armor Plates
  const plates = 6;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;

  for (let p = 0; p < plates; p++) {
    const a = (p * Math.PI * 2) / plates;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.25);
    ctx.lineTo(r * 0.88, -r * 0.2);
    ctx.lineTo(r * 0.88, r * 0.2);
    ctx.lineTo(r * 0.45, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Center Stealth Vent Glowing Reactor
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 18. SACRED FLOWER OF LIFE
// ============================================================================
function renderSacredFlowerLife(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(step * 0.3);

  const petalR = r * 0.42;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = 0.85;

  // Center Circle
  ctx.beginPath();
  ctx.arc(0, 0, petalR, 0, Math.PI * 2);
  ctx.stroke();

  // 6 Surrounding Petal Circles
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    const px = Math.cos(a) * petalR;
    const py = Math.sin(a) * petalR;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer Bounding Ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 19. HYPERCUBE TESSERACT (4D Projected Cube)
// ============================================================================
function renderHypercubeTesseract(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const outerSize = r * 0.65;
  const innerSize = r * (0.28 + Math.sin(step * 2) * 0.06 * vol);

  ctx.save();
  ctx.rotate(step * 0.5);

  // Outer Square Vertices
  const oVerts = [
    { x: -outerSize, y: -outerSize },
    { x: outerSize, y: -outerSize },
    { x: outerSize, y: outerSize },
    { x: -outerSize, y: outerSize }
  ];

  // Inner Square Vertices
  const iVerts = [
    { x: -innerSize, y: -innerSize },
    { x: innerSize, y: -innerSize },
    { x: innerSize, y: innerSize },
    { x: -innerSize, y: innerSize }
  ];

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;

  // Draw Outer Box
  ctx.strokeRect(-outerSize, -outerSize, outerSize * 2, outerSize * 2);

  // Draw Inner Box
  ctx.strokeStyle = colors.secondary;
  ctx.strokeRect(-innerSize, -innerSize, innerSize * 2, innerSize * 2);

  // Connect 4D Edges
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(oVerts[i].x, oVerts[i].y);
    ctx.lineTo(iVerts[i].x, iVerts[i].y);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 20. VORTEX BLACK HOLE (Cosmic Matter Whirlpool)
// ============================================================================
function renderVortexBlackHole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  isListening: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Spiral Arms
  const arms = 4;
  ctx.lineWidth = 2;

  for (let a = 0; a < arms; a++) {
    const baseAngle = (a * Math.PI * 2) / arms + step * 1.5;
    ctx.strokeStyle = a % 2 === 0 ? colors.primary : colors.secondary;
    ctx.beginPath();

    for (let rad = r * 0.25; rad <= r * 0.9; rad += 4) {
      const curAngle = baseAngle + rad * 0.05;
      const px = Math.cos(curAngle) * rad;
      const py = Math.sin(curAngle) * rad;
      if (rad === r * 0.25) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Dense Vacuum Center
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// HELPER: Circular Cover Art / Artist Photo Image Drawer with Smooth Fallback
// ============================================================================
function drawCircularCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  isLoaded: boolean,
  x: number,
  y: number,
  radius: number,
  colors: { primary: string; secondary: string; accent: string },
  borderWidth: number = 2,
  borderColor?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  if (img && isLoaded && img.complete && img.naturalWidth > 0) {
    const aspect = img.naturalWidth / img.naturalHeight;
    let dw = radius * 2;
    let dh = radius * 2;
    if (aspect > 1) {
      dw = dh * aspect;
    } else {
      dh = dw / aspect;
    }
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  } else {
    // Elegant artistic gradient fallback
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, colors.secondary);
    grad.addColorStop(0.7, colors.primary);
    grad.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Modern music note icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y + radius * 0.2, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + radius * 0.22, y + radius * 0.08, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - radius * 0.1, y - radius * 0.35, radius * 0.08, radius * 0.55);
    ctx.fillRect(x + radius * 0.37, y - radius * 0.47, radius * 0.08, radius * 0.55);
    ctx.fillRect(x - radius * 0.1, y - radius * 0.47, radius * 0.55, radius * 0.12);
  }

  ctx.restore();

  // Outer border if requested
  if (borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = borderColor || colors.primary;
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================================
// 21. COVER VINYL TURNTABLE (33 RPM Vinyl Record with Center Album Art)
// ============================================================================
function renderCoverVinylTurntable(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer rim glow
  const glowGrad = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.05);
  glowGrad.addColorStop(0, 'transparent');
  glowGrad.addColorStop(0.9, colors.primary + '33');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  ctx.fill();

  // Vinyl Body (Jet Black Disc)
  const vinylGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
  vinylGrad.addColorStop(0, '#1c1c20');
  vinylGrad.addColorStop(0.5, '#111114');
  vinylGrad.addColorStop(0.98, '#09090b');
  vinylGrad.addColorStop(1, '#27272a');
  ctx.fillStyle = vinylGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Micro-Grooves (Concentric vinyl rings)
  ctx.lineWidth = 0.7;
  for (let gr = r * 0.46; gr < r * 0.94; gr += 3.2) {
    const grooveAlpha = 0.08 + (Math.sin(gr * 0.8 + step) * 0.04);
    ctx.strokeStyle = `rgba(255, 255, 255, ${grooveAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lead-in and lead-out groove bands
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating Anisotropic Light Sheen (Two opposing vinyl reflection cones)
  const sheenAngle = step * 1.4;
  ctx.save();
  ctx.rotate(sheenAngle);
  for (let side = -1; side <= 1; side += 2) {
    const sheenGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.96, -0.32 * side, 0.32 * side);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Center Record Label (Album Cover Art Rotating at 33 RPM)
  const labelRadius = r * 0.42;
  ctx.save();
  ctx.rotate(step * 1.2);
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, labelRadius, colors, 2.5, colors.primary);

  // Spindle hole
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Tonearm & Stylus Needle
  ctx.save();
  const armAngle = -0.55 + Math.sin(step * 0.8) * 0.03;
  ctx.translate(r * 0.88, -r * 0.88);
  ctx.rotate(armAngle);

  // Arm pivot base
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Metallic arm rod
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.72, r * 0.72);
  ctx.stroke();

  // Cartridge & LED light
  ctx.fillStyle = colors.primary;
  ctx.fillRect(-r * 0.78, r * 0.68, 12, 6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-r * 0.76, r * 0.71, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 22. COVER HOLO PROJECTOR (3D Holographic Cylinder with Floating Cover Art)
// ============================================================================
function renderCoverHoloProjector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Hologram Base Emitter Ring
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.85, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Upward Projection Light Beams
  const beamGrad = ctx.createLinearGradient(0, r * 0.85, 0, -r * 0.7);
  beamGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
  beamGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
  beamGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, r * 0.85);
  ctx.lineTo(-r * 0.55, -r * 0.65);
  ctx.lineTo(r * 0.55, -r * 0.65);
  ctx.lineTo(r * 0.75, r * 0.85);
  ctx.closePath();
  ctx.fill();

  // Central Floating Holographic Image (With subtle 3D tilt and pulse)
  const floatY = Math.sin(step * 2.5) * 6;
  const coverR = r * 0.58;
  ctx.save();
  ctx.translate(0, floatY - r * 0.05);

  // Holographic blue glow
  const halo = ctx.createRadialGradient(0, 0, coverR * 0.7, 0, 0, coverR * 1.25);
  halo.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, coverR * 1.25, 0, Math.PI * 2);
  ctx.fill();

  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2.5, '#22d3ee');

  // Animated Scanlines overlay across the image
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, coverR, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineWidth = 1;
  const scanOffset = (step * 35) % 8;
  for (let y = -coverR + scanOffset; y < coverR; y += 8) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-coverR, y);
    ctx.lineTo(coverR, y);
    ctx.stroke();
  }
  ctx.restore();

  // Holographic Framing Corner Brackets
  const bSize = coverR * 1.15;
  const bLen = 14;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  // Top-Left
  ctx.beginPath(); ctx.moveTo(-bSize, -bSize + bLen); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + bLen, -bSize); ctx.stroke();
  // Top-Right
  ctx.beginPath(); ctx.moveTo(bSize - bLen, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize + bLen); ctx.stroke();
  // Bottom-Left
  ctx.beginPath(); ctx.moveTo(-bSize, bSize - bLen); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize + bLen, bSize); ctx.stroke();
  // Bottom-Right
  ctx.beginPath(); ctx.moveTo(bSize - bLen, bSize); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize, bSize - bLen); ctx.stroke();

  ctx.restore();

  // Floating Cyber Particles
  for (let i = 0; i < 8; i++) {
    const pAngle = step * 1.5 + (i * Math.PI * 2) / 8;
    const pRadius = r * 0.72 + Math.sin(step * 3 + i) * 10;
    const px = Math.cos(pAngle) * pRadius;
    const py = Math.sin(pAngle) * (pRadius * 0.4) + floatY;
    ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#a855f7';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// 23. COVER CYBER APERTURE (Mechanical HUD Iris Lens with Cover Art)
// ============================================================================
function renderCoverCyberAperture(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer HUD Telemetry Rings
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating Segmented Track
  ctx.save();
  ctx.rotate(-step * 0.8);
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 12, 6, 12]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 8 Mechanical Aperture Blades
  const bladeCount = 8;
  const irisRadius = r * 0.84;
  const openAmount = 0.55 + Math.sin(step * 2) * 0.12 * vol;
  const innerApertureR = irisRadius * openAmount;

  ctx.save();
  ctx.rotate(step * 0.5);
  for (let b = 0; b < bladeCount; b++) {
    const angle = (b * Math.PI * 2) / bladeCount;
    ctx.save();
    ctx.rotate(angle);

    const bladeGrad = ctx.createLinearGradient(0, innerApertureR, 0, irisRadius);
    bladeGrad.addColorStop(0, '#18181b');
    bladeGrad.addColorStop(0.7, '#27272a');
    bladeGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = bladeGrad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(innerApertureR * 0.8, innerApertureR);
    ctx.lineTo(irisRadius * 0.95, irisRadius * 0.4);
    ctx.lineTo(irisRadius, irisRadius * 0.95);
    ctx.lineTo(innerApertureR * 0.3, irisRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Center Album Cover in Aperture Opening
  const coverR = innerApertureR * 0.92;
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2.5, colors.primary);

  // HUD Crosshair & Targeting Grid
  ctx.strokeStyle = colors.accent || '#ef4444';
  ctx.lineWidth = 1.5;
  const crossLen = coverR * 0.3;
  // Top
  ctx.beginPath(); ctx.moveTo(0, -coverR); ctx.lineTo(0, -coverR + crossLen); ctx.stroke();
  // Bottom
  ctx.beginPath(); ctx.moveTo(0, coverR); ctx.lineTo(0, coverR - crossLen); ctx.stroke();
  // Left
  ctx.beginPath(); ctx.moveTo(-coverR, 0); ctx.lineTo(-coverR + crossLen, 0); ctx.stroke();
  // Right
  ctx.beginPath(); ctx.moveTo(coverR, 0); ctx.lineTo(coverR - crossLen, 0); ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 24. COVER SPECTRUM RING (Radial VU Equalizer Bars surrounding Photo)
// ============================================================================
function renderCoverSpectrumRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const barCount = 42;
  const innerR = r * 0.62;
  const maxBarH = r * 0.34;

  // 42 Radial Equalizer Bars
  for (let i = 0; i < barCount; i++) {
    const angle = (i * Math.PI * 2) / barCount + step * 0.4;
    // Harmonic audio wave calculation
    const freq = Math.abs(Math.sin(step * 3.5 + i * 0.45)) * 0.65 + Math.abs(Math.cos(step * 2.2 + i * 0.9)) * 0.35;
    const barHeight = Math.max(4, maxBarH * freq * vol);

    const x1 = Math.cos(angle) * innerR;
    const y1 = Math.sin(angle) * innerR;
    const x2 = Math.cos(angle) * (innerR + barHeight);
    const y2 = Math.sin(angle) * (innerR + barHeight);

    const hue = (i / barCount) * 360 + step * 20;
    ctx.strokeStyle = `hsl(${hue % 360}, 90%, 60%)`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Central Album Cover Art
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, innerR - 4, colors, 3, '#ffffff');

  // Pulsing Inner Border Ring
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, innerR + 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 25. COVER STARGATE PORTAL (Cosmic Vortex & Chevron Glyph Ring)
// ============================================================================
function renderCoverStargatePortal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer Glyph Ring
  const ringGrad = ctx.createRadialGradient(0, 0, r * 0.72, 0, 0, r);
  ringGrad.addColorStop(0, '#27272a');
  ringGrad.addColorStop(0.5, '#3f3f46');
  ringGrad.addColorStop(1, '#18181b');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Rotating Star-Glyphs on Outer Ring
  ctx.save();
  ctx.rotate(step * 0.6);
  const glyphCount = 18;
  for (let g = 0; g < glyphCount; g++) {
    const gAngle = (g * Math.PI * 2) / glyphCount;
    const gx = Math.cos(gAngle) * (r * 0.86);
    const gy = Math.sin(gAngle) * (r * 0.86);

    ctx.fillStyle = g % 2 === 0 ? '#38bdf8' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(gx, gy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 9 Stargate Chevrons
  const chevronCount = 9;
  for (let c = 0; c < chevronCount; c++) {
    const cAngle = (c * Math.PI * 2) / chevronCount - Math.PI / 2;
    ctx.save();
    ctx.rotate(cAngle);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(-6, -r);
    ctx.lineTo(6, -r);
    ctx.lineTo(0, -r + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Event Horizon Ripples behind Cover
  const innerR = r * 0.65;
  for (let rip = 1; rip <= 3; rip++) {
    const ripR = innerR * (0.3 + ((step * 0.8 + rip * 0.3) % 1) * 0.7);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 * (1 - ripR / innerR)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ripR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Central Stargate Portal Cover Art
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, innerR, colors, 3, '#38bdf8');

  ctx.restore();
}

// ============================================================================
// 26. COVER NEON RADIANCE (Dual RGB Neon Rings with Plasma Sparks)
// ============================================================================
function renderCoverNeonRadiance(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer Neon Tube 1 (Cyan/Blue Orbit)
  ctx.save();
  ctx.rotate(step * 1.5);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();

  // Outer Neon Tube 2 (Magenta/Pink Counter-Orbit)
  ctx.save();
  ctx.rotate(-step * 1.2);
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, Math.PI * 0.6, Math.PI * 2.0);
  ctx.stroke();
  ctx.restore();

  // Floating Cover Art with Glass Specular Edge
  const coverR = r * 0.62;
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2.5, '#ffffff');

  // Specular Glass Arc Sheen across Cover
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, coverR, 0, Math.PI * 2);
  ctx.clip();
  const glossGrad = ctx.createLinearGradient(-coverR, -coverR, coverR, coverR);
  glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  glossGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.05)');
  glossGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glossGrad;
  ctx.fillRect(-coverR, -coverR, coverR * 2, coverR);
  ctx.restore();

  ctx.restore();
}

// ============================================================================
// 27. COVER RADAR SONAR (Green Phosphor 360° Sweep on Artist Photo)
// ============================================================================
function renderCoverRadarSonar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const radarR = r * 0.88;

  // Draw Base Cover Image
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, radarR, colors, 2.5, '#22c55e');

  // Green Phosphor Radar Tint Overlay
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radarR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(20, 83, 45, 0.35)';
  ctx.fillRect(-radarR, -radarR, radarR * 2, radarR * 2);

  // Concentric Radar Distance Rings
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
  ctx.lineWidth = 1.2;
  for (let ring = 0.25; ring <= 1; ring += 0.25) {
    ctx.beginPath();
    ctx.arc(0, 0, radarR * ring, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(-radarR, 0); ctx.lineTo(radarR, 0);
  ctx.moveTo(0, -radarR); ctx.lineTo(0, radarR);
  ctx.stroke();

  // 360° Rotating Radar Sweep Cone
  const sweepAngle = step * 2.2;
  ctx.save();
  ctx.rotate(sweepAngle);
  const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radarR);
  sweepGrad.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
  sweepGrad.addColorStop(1, 'rgba(34, 197, 94, 0.2)');
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radarR, -0.6, 0);
  ctx.closePath();
  ctx.fill();

  // Leading Sweep Beam Line
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radarR, 0);
  ctx.stroke();
  ctx.restore();

  // Sonar Blips (Target Pings)
  for (let p = 0; p < 3; p++) {
    const pAngle = p * 2.1 + 0.5;
    const pDist = radarR * (0.35 + p * 0.25);
    const px = Math.cos(pAngle) * pDist;
    const py = Math.sin(pAngle) * pDist;

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Ping ripple
    const pingScale = ((step * 2 + p) % 1);
    ctx.strokeStyle = `rgba(74, 222, 128, ${1 - pingScale})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py, 4 + pingScale * 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 28. COVER COMPACT DISC (Authentic CD Prism Refraction with Center Art)
// ============================================================================
function renderCoverCompactDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer CD Disc Body
  const cdGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
  cdGrad.addColorStop(0, '#e4e4e7');
  cdGrad.addColorStop(0.5, '#d4d4d8');
  cdGrad.addColorStop(0.95, '#a1a1aa');
  cdGrad.addColorStop(1, '#71717a');
  ctx.fillStyle = cdGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Rainbow Holographic Chromatic Sheen (CD Diffraction)
  ctx.save();
  ctx.rotate(step * 1.8);
  for (let a = 0; a < 4; a++) {
    const coneAngle = (a * Math.PI) / 2;
    const prismGrad = ctx.createLinearGradient(
      Math.cos(coneAngle) * r * 0.3,
      Math.sin(coneAngle) * r * 0.3,
      Math.cos(coneAngle) * r,
      Math.sin(coneAngle) * r
    );
    prismGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    prismGrad.addColorStop(0.25, 'rgba(234, 179, 8, 0.35)');
    prismGrad.addColorStop(0.5, 'rgba(34, 197, 94, 0.35)');
    prismGrad.addColorStop(0.75, 'rgba(59, 130, 246, 0.35)');
    prismGrad.addColorStop(1, 'rgba(168, 85, 247, 0.35)');

    ctx.fillStyle = prismGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.98, coneAngle - 0.35, coneAngle + 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Center Album Artwork Silk-Screen Label
  const labelR = r * 0.48;
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, labelR, colors, 2, '#ffffff');

  // Clear Plastic Inner Ring & Spindle Hole
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.stroke();

  // Center Hole
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// 29. COVER CRYSTAL PRISM (Diamond Crystal Geometry Refracting Cover Art)
// ============================================================================
function renderCoverCrystalPrism(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Central Album Cover
  const coverR = r * 0.65;
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2, '#38bdf8');

  // Rotating Prismatic Facet Cage
  ctx.save();
  ctx.rotate(step * 0.8);
  const sides = 8;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 2;

  for (let s = 0; s < sides; s++) {
    const a1 = (s * Math.PI * 2) / sides;
    const a2 = ((s + 1) * Math.PI * 2) / sides;
    const x1 = Math.cos(a1) * r * 0.95;
    const y1 = Math.sin(a1) * r * 0.95;
    const x2 = Math.cos(a2) * r * 0.95;
    const y2 = Math.sin(a2) * r * 0.95;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Sparkling Diamond Flares at 4 Points
  for (let f = 0; f < 4; f++) {
    const fAngle = (f * Math.PI) / 2 + step * 1.5;
    const fx = Math.cos(fAngle) * (coverR * 0.95);
    const fy = Math.sin(fAngle) * (coverR * 0.95);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Cross flare
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy); ctx.lineTo(fx + 8, fy);
    ctx.moveTo(fx, fy - 8); ctx.lineTo(fx, fy + 8);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// 30. COVER MATRIX CYBER (Digital Falling Code Streaming over Artist Art)
// ============================================================================
function renderCoverMatrixCyber(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const coverR = r * 0.8;

  // Base Cover Art
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2.5, '#22c55e');

  // Matrix Digital Stream Overlay
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, coverR, 0, Math.PI * 2);
  ctx.clip();

  // Dark matrix tint
  ctx.fillStyle = 'rgba(0, 20, 5, 0.45)';
  ctx.fillRect(-coverR, -coverR, coverR * 2, coverR * 2);

  // Digital Rain Glyphs
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';

  const cols = 10;
  for (let c = 0; c < cols; c++) {
    const colX = -coverR + (c * (coverR * 2)) / cols + 10;
    const speed = 1.5 + (c % 3) * 0.8;
    const yOffset = ((step * speed * 25 + c * 30) % (coverR * 2)) - coverR;

    for (let charIdx = 0; charIdx < 5; charIdx++) {
      const charY = yOffset + charIdx * 12;
      if (charY >= -coverR && charY <= coverR) {
        const char = String.fromCharCode(0x30a0 + ((c + charIdx + Math.floor(step)) % 90));
        ctx.fillStyle = charIdx === 4 ? '#ffffff' : `rgba(74, 222, 128, ${0.3 + charIdx * 0.15})`;
        ctx.fillText(char, colX, charY);
      }
    }
  }

  ctx.restore();

  // Outer Cyberpunk Bracket Ring
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 31. COVER BLACKOUT OLED (Pure 0% Light Bleed OLED Cover with Carmine Rim)
// ============================================================================
function renderCoverBlackoutOLED(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const coverR = r * 0.88;

  // Ultra-fine breathing pulse rim
  const pulseR = coverR + Math.sin(step * 2.5) * 4 * vol;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
  ctx.stroke();

  // Sharp Pure OLED Cover
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, coverR, colors, 2.5, '#ffffff');

  // Minimalist Cardinal Ticks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  const tickLen = 8;
  ctx.beginPath();
  ctx.moveTo(0, -coverR); ctx.lineTo(0, -coverR - tickLen);
  ctx.moveTo(0, coverR); ctx.lineTo(0, coverR + tickLen);
  ctx.moveTo(-coverR, 0); ctx.lineTo(-coverR - tickLen, 0);
  ctx.moveTo(coverR, 0); ctx.lineTo(coverR + tickLen, 0);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 32. COVER SWISS GOLD WATCH (Luxury 18K Chronometer Dial with Artist Face)
// ============================================================================
function renderCoverSwissGoldWatch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  step: number,
  colors: { primary: string; secondary: string; accent: string },
  vol: number,
  img: HTMLImageElement | null,
  isLoaded: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Gold Fluted Bezel Ring
  const goldGrad = ctx.createLinearGradient(-r, -r, r, r);
  goldGrad.addColorStop(0, '#fbbf24');
  goldGrad.addColorStop(0.3, '#d97706');
  goldGrad.addColorStop(0.7, '#fef08a');
  goldGrad.addColorStop(1, '#b45309');
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();

  // Inner Watch Dial (Artist Photo)
  const dialR = r * 0.82;
  drawCircularCoverImage(ctx, img, isLoaded, 0, 0, dialR, colors, 2, '#fef08a');

  // 12 Hour Gold Markers around Dial
  for (let h = 0; h < 12; h++) {
    const hAngle = (h * Math.PI * 2) / 12 - Math.PI / 2;
    const hx1 = Math.cos(hAngle) * (dialR * 0.82);
    const hy1 = Math.sin(hAngle) * (dialR * 0.82);
    const hx2 = Math.cos(hAngle) * (dialR * 0.94);
    const hy2 = Math.sin(hAngle) * (dialR * 0.94);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = h % 3 === 0 ? 3.5 : 1.8;
    ctx.beginPath();
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
  }

  // Watch Hands (Real-time movement or simulated chronometer)
  const now = new Date();
  const secAngle = ((now.getSeconds() + now.getMilliseconds() / 1000 + step) % 60) * ((Math.PI * 2) / 60) - Math.PI / 2;
  const minAngle = (now.getMinutes() + now.getSeconds() / 60) * ((Math.PI * 2) / 60) - Math.PI / 2;
  const hourAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * ((Math.PI * 2) / 12) - Math.PI / 2;

  // Hour Hand (Gold)
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(hourAngle) * (dialR * 0.5), Math.sin(hourAngle) * (dialR * 0.5));
  ctx.stroke();

  // Minute Hand (Gold)
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(minAngle) * (dialR * 0.72), Math.sin(minAngle) * (dialR * 0.72));
  ctx.stroke();

  // Second Hand (Crimson Red with counter-balance)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(secAngle) * 14, -Math.sin(secAngle) * 14);
  ctx.lineTo(Math.cos(secAngle) * (dialR * 0.84), Math.sin(secAngle) * (dialR * 0.84));
  ctx.stroke();

  // Central Gold Pin Cap
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
