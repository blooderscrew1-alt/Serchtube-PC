import { VideoQuality } from '../types';

export interface QualityOption {
  id: VideoQuality;
  label: string;
  shortLabel: string;
  resolution: string;
  badge?: string;
  isHD?: boolean;
  description: string;
}

export const VIDEO_QUALITY_OPTIONS: QualityOption[] = [
  {
    id: 'auto',
    label: 'Automática (Recomendado)',
    shortLabel: 'Auto',
    resolution: 'Adaptativa',
    description: 'Ajusta la calidad según la velocidad de red en tiempo real.',
    badge: 'AUTO'
  },
  {
    id: 'highres',
    label: '4K / Máxima Disponible',
    shortLabel: '4K / Max',
    resolution: '2160p / 1440p',
    badge: 'UHD',
    isHD: true,
    description: 'Máxima nitidez para pantallas de alta resolución.'
  },
  {
    id: 'hd1080',
    label: '1080p Full HD',
    shortLabel: '1080p',
    resolution: '1920x1080',
    badge: '1080p HD',
    isHD: true,
    description: 'Calidad cristalina para pantallas grandes y cuadros de instrumentos.'
  },
  {
    id: 'hd720',
    label: '720p HD',
    shortLabel: '720p',
    resolution: '1280x720',
    badge: '720p HD',
    isHD: true,
    description: 'Excelente equilibrio entre nitidez HD y fluidez de carga.'
  },
  {
    id: 'large',
    label: '480p Definición Estándar',
    shortLabel: '480p',
    resolution: '854x480',
    badge: '480p',
    description: 'Calidad estándar equilibrada con bajo consumo de datos.'
  },
  {
    id: 'medium',
    label: '360p Modo Equilibrado',
    shortLabel: '360p',
    resolution: '640x360',
    badge: '360p',
    description: 'Reproducción suave en redes móviles o conexiones lentas.'
  },
  {
    id: 'small',
    label: '240p Ahorro de Datos',
    shortLabel: '240p',
    resolution: '426x240',
    badge: '240p',
    description: 'Prioriza la música y reduce al mínimo el uso de megas.'
  },
  {
    id: 'tiny',
    label: '144p Modo Audio Puro',
    shortLabel: '144p',
    resolution: '256x144',
    badge: '144p',
    description: 'Consumo ultra reducido de batería y datos móviles.'
  }
];

export const PLAYBACK_SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x (Lento)' },
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x (Normal)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x (Rápido)' },
  { value: 1.75, label: '1.75x' },
  { value: 2.0, label: '2.0x (Doble)' }
];

export function getQualityOption(quality: VideoQuality | string): QualityOption {
  const found = VIDEO_QUALITY_OPTIONS.find(q => q.id === quality);
  return (
    found || {
      id: (quality as VideoQuality) || 'auto',
      label: quality || 'Automática',
      shortLabel: quality || 'Auto',
      resolution: quality || 'Auto',
      description: 'Resolución activa'
    }
  );
}

export function parseQualityFromText(text: string): VideoQuality | null {
  const lower = text.toLowerCase();
  if (lower.includes('1080') || lower.includes('full hd') || lower.includes('máxima') || lower.includes('maxima') || lower.includes('ultra')) {
    return 'hd1080';
  }
  if (lower.includes('720') || lower.includes('alta') || lower.includes(' hd')) {
    return 'hd720';
  }
  if (lower.includes('480') || lower.includes('estandar') || lower.includes('estándar') || lower.includes('media')) {
    return 'large';
  }
  if (lower.includes('360')) {
    return 'medium';
  }
  if (lower.includes('240') || lower.includes('baja') || lower.includes('ahorro') || lower.includes('economico') || lower.includes('económico')) {
    return 'small';
  }
  if (lower.includes('144') || lower.includes('minima') || lower.includes('mínima')) {
    return 'tiny';
  }
  if (lower.includes('4k') || lower.includes('uhd') || lower.includes('highres')) {
    return 'highres';
  }
  if (lower.includes('auto') || lower.includes('automática') || lower.includes('automatica') || lower.includes('adaptativa')) {
    return 'auto';
  }
  return null;
}
