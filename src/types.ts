export type NodeRole = 'master' | 'satellite';

export type SystemStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'satellite_active' | 'error';

export type VoicePersonality =
  | 'directa'
  | 'animada'
  | 'formal'
  | 'zen'
  | 'conductor'
  | 'jarvis'
  | 'copiloto_rally'
  | 'locutor_fm'
  | 'calida'
  | 'cyberpunk';

export type ClockStyle =
  | 'mono'               // 1. Monospace Técnico Clásico
  | 'digital'            // 2. Display Digital 7-Segmentos
  | 'sans'               // 3. Sans-Serif Limpio
  | 'serif'              // 4. Serif Clásico Editorial
  | 'futuristic'         // 5. Futurista Sci-Fi
  | 'cyber_digital'      // 6. Neón Cyberpunk LED
  | 'futuristic_hud'     // 7. HUD Vectorial Táctico
  | 'retro_nixie'        // 8. Tubos Nixie Vintage Incandescentes
  | 'minimal_scandi'     // 9. Minimalista Nórdico Ultra-Fino
  | 'arcade_8bit'        // 10. Pixel Art Arcade 8-Bit
  | 'neon_tokyo'         // 11. Neón Tokyo Shinjuku
  | 'military_tactical'  // 12. Stencil Militar Táctico
  | 'chrono_luxury'      // 13. Cronógrafo Suizo de Lujo
  | 'matrix_glyph'       // 14. Glifos Código Matrix
  | 'bold_athletic'      // 15. Deportivo Bold Italic
  | 'split_flip'         // 16. Tablillas Abatibles Flip-Clock
  | 'glitch_cyber'       // 17. Glitch RGB Cromático
  | 'hologram_laser'     // 18. Holograma Láser Azul
  | 'lcd_alarm'          // 19. Pantalla LCD Retro Despertador
  | 'speedometer_gauge'; // 20. Dial Velocímetro Racing GT

export type ClockFont = ClockStyle;
export type ClockFormat = '24h' | '12h';

export interface ClockStyleInfo {
  id: ClockStyle;
  name: string;
  category: 'Digital' | 'Minimal' | 'Cyberpunk' | 'Retro' | 'Elegante';
  description: string;
  badge: string;
}

export const CLOCK_STYLES_INFO: ClockStyleInfo[] = [
  {
    id: 'mono',
    name: 'Monospace Técnico',
    category: 'Digital',
    description: 'Fuente monoespaciada limpia y precisa con alto contraste OLED.',
    badge: '⌨️ Mono'
  },
  {
    id: 'digital',
    name: 'Display 7-Segmentos',
    category: 'Digital',
    description: 'Clásico display digital LED de 7 segmentos estilo reloj despertador.',
    badge: '📟 7-Segment'
  },
  {
    id: 'sans',
    name: 'Sans-Serif Geométrico',
    category: 'Minimal',
    description: 'Tipografía sin remates moderna, limpia y altamente legible.',
    badge: '✨ Modern Sans'
  },
  {
    id: 'serif',
    name: 'Serif Clásico Editorial',
    category: 'Elegante',
    description: 'Numeración elegante con remates refinados de corte editorial de lujo.',
    badge: '🖋️ Serif Clásico'
  },
  {
    id: 'futuristic',
    name: 'Futurista Sci-Fi',
    category: 'Cyberpunk',
    description: 'Tipografía espacial con espaciado ancho y acentos holográficos.',
    badge: '🚀 Sci-Fi'
  },
  {
    id: 'cyber_digital',
    name: 'Neón Cyberpunk LED',
    category: 'Cyberpunk',
    description: 'Dígitos en rojo carmesí brillante con aura de neón y efecto fósforo.',
    badge: '⚡ Cyber Neón'
  },
  {
    id: 'futuristic_hud',
    name: 'HUD Vectorial Táctico',
    category: 'Cyberpunk',
    description: 'Retículas angulares de caza militar con marcadores de coordenadas y acimuts.',
    badge: '🎯 HUD Táctico'
  },
  {
    id: 'retro_nixie',
    name: 'Tubos Nixie Vintage',
    category: 'Retro',
    description: 'Tubos de vacío de gas neón naranja cálido con filamentos incandescentes.',
    badge: '🔥 Nixie Tubes'
  },
  {
    id: 'minimal_scandi',
    name: 'Minimalista Nórdico',
    category: 'Minimal',
    description: 'Trazos ultra-finos con espaciado amplio y fecha en cápsula esmerilada.',
    badge: '❄️ Escandinavo'
  },
  {
    id: 'arcade_8bit',
    name: 'Pixel Art Arcade 8-Bit',
    category: 'Retro',
    description: 'Tipografía pixelada de máquinas recreativas y consolas clásicas.',
    badge: '🕹️ 8-Bit Arcade'
  },
  {
    id: 'neon_tokyo',
    name: 'Neón Tokyo Shinjuku',
    category: 'Cyberpunk',
    description: 'Cartel de neón urbano dual en magenta y cian eléctrico parpadeante.',
    badge: '🏮 Tokyo Neón'
  },
  {
    id: 'military_tactical',
    name: 'Militar Stencil Zulu',
    category: 'Retro',
    description: 'Dígitos stencil blindados con conteo de segundos en caja y hora Zulu.',
    badge: '🪖 Stencil Militar'
  },
  {
    id: 'chrono_luxury',
    name: 'Cronógrafo Suizo Lujo',
    category: 'Elegante',
    description: 'Tipografía de alta relojería suiza con detalles en oro y platino.',
    badge: '⏱️ Cronógrafo'
  },
  {
    id: 'matrix_glyph',
    name: 'Glifos Código Matrix',
    category: 'Cyberpunk',
    description: 'Fuente fósforo verde terminal con partículas de código cayendo.',
    badge: '🟢 Matrix Código'
  },
  {
    id: 'bold_athletic',
    name: 'Deportivo Bold Italic',
    category: 'Minimal',
    description: 'Numeración robusta e inclinada estilo cronometraje de carreras GT.',
    badge: '🏎️ Racing Bold'
  },
  {
    id: 'split_flip',
    name: 'Flip-Clock Tablillas',
    category: 'Retro',
    description: 'Reloj mecánico de tablillas abatibles vintage de estación de tren.',
    badge: '🔄 Flip-Clock'
  },
  {
    id: 'glitch_cyber',
    name: 'Glitch RGB Cromático',
    category: 'Cyberpunk',
    description: 'Aberración cromática con desincronización RGB analógica en tiempo real.',
    badge: '📺 RGB Glitch'
  },
  {
    id: 'hologram_laser',
    name: 'Holograma Láser Azul',
    category: 'Cyberpunk',
    description: 'Líneas horizontales de barrido holográfico con proyección flotante.',
    badge: '💠 Holograma'
  },
  {
    id: 'lcd_alarm',
    name: 'Pantalla LCD Vintage',
    category: 'Retro',
    description: 'Display de cristal líquido con sombras 88:88 inactivas de fondo.',
    badge: '📻 LCD Radio'
  },
  {
    id: 'speedometer_gauge',
    name: 'Velocímetro Digital GT',
    category: 'Cyberpunk',
    description: 'Tacómetro perimetral circular con lectura digital central de alta velocidad.',
    badge: '🏁 Cockpit GT'
  }
];

export type LockScreenMusicBarStyle =
  | 'compact_pill'          // 1. Píldora Neón Compacta
  | 'album_card_glass'      // 2. Tarjeta Glassmorphism 3D con Portada Grande
  | 'vinyl_turntable'       // 3. Vinilo Retro Giratorio con Carátula Central
  | 'cyberpunk_hud'         // 4. Consola HUD Cyberpunk con Espectro
  | 'cassette_tape'         // 5. Casete Vintage 80s con Bobinas Giratorias
  | 'wave_glow_card'        // 6. Tarjeta Onda Espectral RGB
  | 'minimal_island'        // 7. Isla Dinámica Flotante
  | 'synthwave_neon'        // 8. Synthwave Sunset 1984
  | 'tactical_military'     // 9. Terminal Táctico de Mando
  | 'studio_console'        // 10. Consola de Mezclas Pro con VU Meters
  | 'hologram_wireframe'    // 11. Proyección Holográfica Láser
  | 'car_cockpit_gauge'     // 12. Cuadro de Instrumentos Cockpit GT
  | 'split_horizontal_bar'  // 13. Barra Ultra Panorámica HD
  | 'floating_cd_jewel'     // 14. Caja de CD Cristalina Jewel Case
  | 'neon_minimalist_line'  // 15. Línea Neón Minimalista Flotante
  | 'aurora_gradient'       // 16. Gradiente Aurora Boreal Líquida
  | 'arcade_gameboy'        // 17. GameBoy Retro Dot Matrix 8-Bit
  | 'solar_flare_gold'      // 18. Titanio Pulido y Oro Solar
  | 'stealth_blackout'      // 19. Stealth Blackout OLED Puro
  | 'quantum_matrix_pod';   // 20. Cápsula Cuántica Matrix Glifos

export interface LockScreenMusicBarStyleInfo {
  id: LockScreenMusicBarStyle;
  name: string;
  category: 'Moderno' | 'Retro' | 'Cyberpunk' | 'Audiófilo' | 'Minimal' | 'Elegante';
  description: string;
  badge: string;
}

export const LOCKSCREEN_MUSIC_BAR_STYLES_INFO: LockScreenMusicBarStyleInfo[] = [
  {
    id: 'compact_pill',
    name: 'Píldora Neón Compacta',
    category: 'Moderno',
    description: 'Cápsula aerodinámica con miniatura circular giratoria, título deslizante y botón play.',
    badge: '💊 Píldora Neón'
  },
  {
    id: 'album_card_glass',
    name: 'Tarjeta Glassmorphism 3D',
    category: 'Moderno',
    description: 'Tarjeta de cristal esmerilado con miniatura HD grande, reflejo superior y ecualizador sónico.',
    badge: '🪞 Cristal 3D'
  },
  {
    id: 'vinyl_turntable',
    name: 'Vinilo Retro Giratorio',
    category: 'Retro',
    description: 'Disco de vinilo estriado que gira con la carátula en el centro y brazo fonocaptor.',
    badge: '💿 Vinilo 33 RPM'
  },
  {
    id: 'cyberpunk_hud',
    name: 'Consola HUD Cyberpunk',
    category: 'Cyberpunk',
    description: 'Marco biselado con retículas de datos, espectrograma animado y miniatura táctica.',
    badge: '⚡ HUD Cyber'
  },
  {
    id: 'cassette_tape',
    name: 'Casete Vintage 80s',
    category: 'Retro',
    description: 'Cinta de casete analógica con carretes giratorios mecánicos y etiqueta manuscrita.',
    badge: '📼 Casete 80s'
  },
  {
    id: 'wave_glow_card',
    name: 'Onda Espectral RGB',
    category: 'Audiófilo',
    description: 'Tarjeta con espectro sonoro animado de fondo y miniatura iluminada por halo RGB.',
    badge: '🌈 Espectro RGB'
  },
  {
    id: 'minimal_island',
    name: 'Isla Dinámica Flotante',
    category: 'Minimal',
    description: 'Cápsula negra mate minimalista con micro-miniatura y ecualizador fluido.',
    badge: '🏝️ Dynamic Island'
  },
  {
    id: 'synthwave_neon',
    name: 'Synthwave Sunset 1984',
    category: 'Retro',
    description: 'Gradiente magenta/naranja retro 80s, rejilla en perspectiva y filtro de líneas CRT.',
    badge: '🌅 Synthwave'
  },
  {
    id: 'tactical_military',
    name: 'Terminal Táctico de Mando',
    category: 'Cyberpunk',
    description: 'Chasis verde militar blindado con tornillos de titanio, miniatura en visor y telemetría.',
    badge: '🎖️ Terminal Militar'
  },
  {
    id: 'studio_console',
    name: 'Consola Master VU Pro',
    category: 'Audiófilo',
    description: 'Vúmetros analógicos duales con aguja dinámica, vúmetro de decibelios y miniatura en rack.',
    badge: '🎛️ Consola VU Pro'
  },
  {
    id: 'hologram_wireframe',
    name: 'Proyección Holográfica Láser',
    category: 'Cyberpunk',
    description: 'Interfaz translúcida con líneas de escaneo láser cian y carátula proyectada.',
    badge: '💠 Holograma Láser'
  },
  {
    id: 'car_cockpit_gauge',
    name: 'Cockpit Automotriz GT',
    category: 'Cyberpunk',
    description: 'Panel de instrumentación de coche deportivo con fondo de fibra de carbono.',
    badge: '🏎️ Cockpit GT'
  },
  {
    id: 'split_horizontal_bar',
    name: 'Barra Ultra Panorámica HD',
    category: 'Moderno',
    description: 'Diseño panorámico de borde a borde con miniatura 16:9 y barra de tiempo extendida.',
    badge: '📏 Ultra Panorámica'
  },
  {
    id: 'floating_cd_jewel',
    name: 'Caja CD Cristalina Jewel Case',
    category: 'Retro',
    description: 'Caja transparente de CD de policarbonato con disco plateado asomándose del estuche.',
    badge: '💿 CD Jewel Case'
  },
  {
    id: 'neon_minimalist_line',
    name: 'Línea Neón Minimalista',
    category: 'Minimal',
    description: 'Línea base ultra-delgada iluminada con miniatura cuadrada flotante sin bordes pesados.',
    badge: '➖ Línea Neón'
  },
  {
    id: 'aurora_gradient',
    name: 'Gradiente Aurora Boreal',
    category: 'Moderno',
    description: 'Fondo fluido con gradientes de aurora esmeralda y violeta con botón pulsante.',
    badge: '🌌 Aurora Boreal'
  },
  {
    id: 'arcade_gameboy',
    name: 'GameBoy Retro Dot Matrix',
    category: 'Retro',
    description: 'Chasis de consola portátil con pantalla verdosa monocromática y controles de juego.',
    badge: '🎮 GameBoy Retro'
  },
  {
    id: 'solar_flare_gold',
    name: 'Llamarada Solar y Oro',
    category: 'Elegante',
    description: 'Acabado de titanio pulido y oro cepillado de lujo con partículas de fulguración.',
    badge: '👑 Oro Solar'
  },
  {
    id: 'stealth_blackout',
    name: 'Stealth Blackout OLED',
    category: 'Minimal',
    description: 'Negro puro 100% OLED con acentos carmesí de bajo impacto visual nocturno.',
    badge: '🖤 Stealth OLED'
  },
  {
    id: 'quantum_matrix_pod',
    name: 'Cápsula Cuántica Matrix',
    category: 'Cyberpunk',
    description: 'Cápsula con lluvia de caracteres digitales verdes y miniatura enmarcada en plasma.',
    badge: '💾 Matrix Pod'
  }
];

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  isPlaylist?: boolean;
  playlistId?: string;
}

export type VideoQuality =
  | 'auto'
  | 'highres'
  | 'hd1080'
  | 'hd720'
  | 'large'
  | 'medium'
  | 'small'
  | 'tiny';

export type WaveStyle =
  | 'sine_harmonic'        // 1. Armónico Doble (Clásico)
  | 'cyber_neon'            // 2. Cyber Pulse Neón
  | 'equalizer_bars'        // 3. Barras de Espectro / Equalizer
  | 'circular_radar'        // 4. Radar Sonar / Ondas Radiales
  | 'galaxy_particles'      // 5. Polvo Galáctico / Partículas 3D
  | 'laser_ribbon'          // 6. Cinta Láser 3D / Silk Ribbon
  | 'liquid_fluid'          // 7. Onda Líquida / Organic Fluid
  | 'dna_helix'             // 8. Doble Hélice / ADN Cuántico
  | 'synthwave_grid'        // 9. Rejilla Synthwave 80s
  | 'glitch_matrix'         // 10. Matrix / Glitch Cibernético
  | 'heartbeat_ecg'         // 11. Telemetría ECG / Pulso Vital
  | 'planetary_orbit'       // 12. Órbitas Planetarias
  | 'aurora_plasma'         // 13. Aurora Boreal / Plasma
  | 'minimal_dots'          // 14. Matriz de Puntos Acústicos
  | 'supernova_burst'       // 15. Supernova / Estallido Cósmico
  | 'quantum_vortex'        // 16. Vórtice Cuántico / Remolino Espacial
  | 'electric_lightning'    // 17. Rayos Eléctricos Tesla / Plasma Arc
  | 'cyber_hexagons'        // 18. Panal Hexagonal Holográfico
  | 'hyperdrive_warp'       // 19. Túnel Hyperdrive Warp Speed
  | 'crystal_lattice'       // 20. Red Cristalina de Cuarzo
  | 'sound_bubbles'         // 21. Burbujas Acústicas Bioluminiscentes
  | 'plasma_fire'           // 22. Llamas de Plasma Solar
  | 'sacred_mandala_wave'   // 23. Mandala Sagrado Sónico
  | 'tachyon_laser_cross';  // 24. Rayos Taquiónicos Cruzados

export type OrbStyle =
  | 'classic_core'          // 1. Núcleo Reactor Clásico
  | 'iron_arc_reactor'      // 2. Reactor Arc de Fusión Mark VII
  | 'cyber_hud_eye'         // 3. Ojo Cibernético HAL / HUD Scanner
  | 'plasma_pulsar'         // 4. Esfera Pulsar de Plasma Radiante
  | 'quantum_singularity'   // 5. Singularidad Agujero Negro
  | 'hologram_wireframe'    // 6. Globo Holográfico 3D Wireframe
  | 'energy_forcefield'     // 7. Escudo Deflector de Energía Hexagonal
  | 'atomic_orbital'        // 8. Átomo Cuántico Orbital Tridimensional
  | 'neon_gyroscope'        // 9. Giroscopio Neón 3D Gimbal
  | 'crystal_quartz'        // 10. Prisma de Cristal Cuarzo Iridiscente
  | 'bioluminescent_jelly'  // 11. Medusa Abisal Bioluminiscente
  | 'tachyon_accelerator'   // 12. Acelerador de Taquiones de Alta Frecuencia
  | 'radar_tactical_cross'  // 13. Radar de Aviación Táctico con Retícula
  | 'solar_eclipse'         // 14. Corona de Eclipse Solar & Fulguración
  | 'digital_matrix_nexus'  // 15. Nexus Digital Matrix con Glifos
  | 'sound_ripple_3d'       // 16. Esfera de Resonancia Acústica 3D
  | 'stealth_hex_orb'       // 17. Orbe Hexagonal Stealth Blindado
  | 'sacred_flower_life'    // 18. Flor de la Vida / Geometría Sagrada
  | 'hypercube_tesseract'   // 19. Teseracto / Hipercubo 4D
  | 'vortex_black_hole'     // 20. Vórtice Espiral Gravitatorio
  // --- NUEVOS ORBES CON CARÁTULA Y FOTO DE ARTISTA ---
  | 'cover_vinyl_turntable' // 21. Disco Vinilo 33 RPM con Carátula Giratoria
  | 'cover_holo_projector'  // 22. Proyector Holográfico 3D con Foto de Artista
  | 'cover_cyber_aperture'  // 23. Diafragma Cibernético HUD con Carátula
  | 'cover_spectrum_ring'   // 24. Anillo Espectral Ecualizador con Foto
  | 'cover_stargate_portal' // 25. Portal Cósmico Stargate con Carátula
  | 'cover_neon_radiance'   // 26. Aura Neón RGB con Carátula Flotante
  | 'cover_radar_sonar'     // 27. Sonar Táctico Verde Fósforo con Foto
  | 'cover_compact_disc'    // 28. CD Plateado Iridiscente con Miniatura
  | 'cover_crystal_prism'   // 29. Prisma de Cristal Facetado con Carátula
  | 'cover_matrix_cyber'    // 30. Cápsula Matrix Cyber con Foto
  | 'cover_blackout_oled'   // 31. Blackout OLED Puro con Carátula HD
  | 'cover_swiss_gold_watch'; // 32. Cronómetro Suizo de Oro con Foto

export interface DisplayVisualConfig {
  videoOpacity: number;        // 0.0 to 1.0 (e.g. 0.45)
  wavesOpacity: number;        // 0.0 to 1.0 (e.g. 0.85) - escucha y ondas armónicas
  orbOpacity?: number;         // 0.0 to 1.0 (e.g. 1.0) - transparencia del cuerpo del orbe interactivo
  orbScale?: number;           // 0.4 to 3.0 (e.g. 1.0) - tamaño / escala del orbe interactivo
  showWavesAndMic?: boolean;   // Activador de animaciones de ondas y micrófono
  showOrbOnlyOnWakeWord?: boolean; // ⭐ Mostrar el orbe y animación de micrófono únicamente al detectar la palabra clave del micrófono local
  waveStyle?: WaveStyle;       // Estilo de ondas animadas (24 estilos seleccionables)
  orbStyle?: OrbStyle;         // Estilo de orbe animado (20 estilos seleccionables)
  waveScale?: number;          // Escala y tamaño de las ondas (0.2 a 3.0, default 1.0)
  waveHeight?: number;         // Altura de renderizado en px (120 a 800)
  waveFullscreen?: boolean;    // Expandir ondas por toda la pantalla completa
  topFadeOpacity: number;      // 0.0 to 1.0 (e.g. 0.80) - difuminación negra superior
  bottomFadeOpacity: number;   // 0.0 to 1.0 (e.g. 0.85) - difuminación negra inferior
  headerBgOpacity?: number;    // 0.0 to 1.0 (e.g. 0.40) - fondo oscuro de la barra de título (las letras se mantienen 100% nítidas)
  footerBgOpacity?: number;    // 0.0 to 1.0 (e.g. 0.60) - fondo oscuro de la barra de información (las letras se mantienen 100% nítidas)
  autoExpandOnPlay: boolean;   // expand player to whole screen automatically on play
  autoFullscreenOnStartup?: boolean; // automatically launch host in fullscreen (F11)
  preferredQuality?: VideoQuality; // Default / preferred resolution (e.g. 'hd1080', 'auto')
  dataSaver?: boolean;         // Prefer low resolution for bandwidth savings
}

export interface WaveStyleInfo {
  id: WaveStyle;
  name: string;
  category: 'Clásica' | 'Cyberpunk' | 'Audio' | 'Espacial' | 'Orgánica' | 'Minimal' | 'Cósmica' | 'Energía';
  description: string;
  badge: string;
}

export const WAVE_STYLES_INFO: WaveStyleInfo[] = [
  {
    id: 'sine_harmonic',
    name: 'Armónico Doble',
    category: 'Clásica',
    description: 'Ondas senoidales fluidas entrelazadas con modulación de fase acústica.',
    badge: '🌊 Clásico'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon Pulse',
    category: 'Cyberpunk',
    description: 'Onda futurista con resplandor neón multicapa y nodos cuánticos brillantes.',
    badge: '⚡ Neón'
  },
  {
    id: 'equalizer_bars',
    name: 'Ecualizador de Espectro',
    category: 'Audio',
    description: 'Barras de espectro de frecuencia simétricas reactivas a los graves y agudos.',
    badge: '📊 Studio'
  },
  {
    id: 'circular_radar',
    name: 'Radar Sonar Acústico',
    category: 'Espacial',
    description: 'Anillos concéntricos y barrido Doppler estilo HUD táctico de aviación.',
    badge: '📡 Radar'
  },
  {
    id: 'galaxy_particles',
    name: 'Polvo Galáctico 3D',
    category: 'Espacial',
    description: 'Nube de estrellas y partículas orbitales atraídas por el pulso musical.',
    badge: '✨ Galaxia'
  },
  {
    id: 'laser_ribbon',
    name: 'Cinta Láser 3D',
    category: 'Cyberpunk',
    description: 'Cinta geométrica de seda láser ondulante con sombreado holográfico.',
    badge: '🎀 Láser'
  },
  {
    id: 'liquid_fluid',
    name: 'Fluido Líquido Orgánico',
    category: 'Orgánica',
    description: 'Superficie de mercurio líquido con oleaje y reflejos bioluminiscentes.',
    badge: '💧 Fluido'
  },
  {
    id: 'dna_helix',
    name: 'Doble Hélice ADN',
    category: 'Orgánica',
    description: 'Estructura molecular giratoria con puentes de enlace sincronizados.',
    badge: '🧬 ADN'
  },
  {
    id: 'synthwave_grid',
    name: 'Synthwave 80s Grid',
    category: 'Cyberpunk',
    description: 'Malla en perspectiva retrofuturista con ondas electromagnéticas.',
    badge: '🕹️ 80s Grid'
  },
  {
    id: 'glitch_matrix',
    name: 'Matrix Cyber Glitch',
    category: 'Cyberpunk',
    description: 'Segmentos de código binario y pulsos digitales de alta velocidad.',
    badge: '👾 Matrix'
  },
  {
    id: 'heartbeat_ecg',
    name: 'Telemetría ECG Vital',
    category: 'Minimal',
    description: 'Línea de pulso cardíaco de alta precisión con picos reactivos al ritmo.',
    badge: '💓 ECG'
  },
  {
    id: 'planetary_orbit',
    name: 'Órbitas Planetarias',
    category: 'Espacial',
    description: 'Satélites elípticos y trayectorias gravitatorias armonizadas con la música.',
    badge: '🪐 Órbitas'
  },
  {
    id: 'aurora_plasma',
    name: 'Aurora Boreal Plasma',
    category: 'Orgánica',
    description: 'Cortinas etéreas de plasma electromagnético ondulante multicolor.',
    badge: '🌌 Aurora'
  },
  {
    id: 'minimal_dots',
    name: 'Matriz de Puntos Acústica',
    category: 'Minimal',
    description: 'Cuadrícula minimalista de puntos de luz con ondas esféricas expansivas.',
    badge: '⚪ Dots'
  },
  {
    id: 'supernova_burst',
    name: 'Supernova Cósmica',
    category: 'Cósmica',
    description: 'Explosión estelar radiante con ondas de choque lumínicas expansivas.',
    badge: '💥 Supernova'
  },
  {
    id: 'quantum_vortex',
    name: 'Vórtice Cuántico',
    category: 'Cósmica',
    description: 'Remolino gravitatorio en espiral con partículas atraídas al núcleo acústico.',
    badge: '🌀 Vórtice'
  },
  {
    id: 'electric_lightning',
    name: 'Rayos Plasma Tesla',
    category: 'Energía',
    description: 'Arcos de alto voltaje y relámpagos de plasma reactivos a la potencia sonora.',
    badge: '⚡ Tesla'
  },
  {
    id: 'cyber_hexagons',
    name: 'Panal Hexagonal HUD',
    category: 'Cyberpunk',
    description: 'Malla de hexágonos cibernéticos flotantes que se iluminan al ritmo de la música.',
    badge: '⬡ Hex HUD'
  },
  {
    id: 'hyperdrive_warp',
    name: 'Hyperdrive Warp Speed',
    category: 'Cósmica',
    description: 'Líneas de velocidad luz hiperespacial acelerando hacia el centro sonoro.',
    badge: '🚀 Warp'
  },
  {
    id: 'crystal_lattice',
    name: 'Red Cristalina Cuarzo',
    category: 'Energía',
    description: 'Polígonos geométricos de cristal resonante con reflejos prismáticos.',
    badge: '💎 Cristal'
  },
  {
    id: 'sound_bubbles',
    name: 'Burbujas Acústicas',
    category: 'Orgánica',
    description: 'Esferas bioluminiscentes flotantes que vibran y rebotan armónicamente.',
    badge: '🫧 Burbujas'
  },
  {
    id: 'plasma_fire',
    name: 'Llamas Plasma Solar',
    category: 'Energía',
    description: 'Llamaradas de plasma ardiente que ondean verticalmente al compás sonoro.',
    badge: '🔥 Plasma'
  },
  {
    id: 'sacred_mandala_wave',
    name: 'Mandala Sagrado Sónico',
    category: 'Orgánica',
    description: 'Geometría sagrada fractal en rotación continua con simetría octogonal.',
    badge: '🏵️ Mandala'
  },
  {
    id: 'tachyon_laser_cross',
    name: 'Rayos Taquiónicos',
    category: 'Cyberpunk',
    description: 'Haz de lásers cruzados y fotones taquiónicos con resplandor cuántico.',
    badge: '⚔️ Taquión'
  }
];

export interface OrbStyleInfo {
  id: OrbStyle;
  name: string;
  category: 'Reactor' | 'Cyberpunk' | 'Cósmico' | 'Holograma' | 'Energía' | 'Orgánico' | 'Carátula & Artista';
  description: string;
  badge: string;
}

export const ORB_STYLES_INFO: OrbStyleInfo[] = [
  {
    id: 'classic_core',
    name: 'Núcleo Reactor Clásico',
    category: 'Reactor',
    description: 'Orbe original con iris interior concéntrico, anillos sutiles y punto guía pulsante.',
    badge: '🔘 Clásico'
  },
  {
    id: 'iron_arc_reactor',
    name: 'Reactor Arc Mark VII',
    category: 'Reactor',
    description: 'Bobinas electromagnéticas segmentadas con bobinado de cobre y núcleo de paladio.',
    badge: '⚙️ Arc Reactor'
  },
  {
    id: 'cyber_hud_eye',
    name: 'Ojo Cibernético HAL HUD',
    category: 'Cyberpunk',
    description: 'Lente óptica cibernética con retícula de escaneo angular y lectura de telemetría.',
    badge: '👁️ Cyber Eye'
  },
  {
    id: 'plasma_pulsar',
    name: 'Esfera Pulsar de Plasma',
    category: 'Cósmico',
    description: 'Núcleo denso hiperbrillante con filamentos coronales y emisión de ondas solares.',
    badge: '🌟 Pulsar'
  },
  {
    id: 'quantum_singularity',
    name: 'Singularidad Agujero Negro',
    category: 'Cósmico',
    description: 'Horizonte de sucesos oscuro rodeado por un disco de acreción rotatorio ardiente.',
    badge: '🕳️ Singularidad'
  },
  {
    id: 'hologram_wireframe',
    name: 'Globo Holográfico 3D',
    category: 'Holograma',
    description: 'Esfera geodésica transparente de alambre vectorial en rotación 3D continua.',
    badge: '🌐 Holograma'
  },
  {
    id: 'energy_forcefield',
    name: 'Escudo Deflector Hex',
    category: 'Energía',
    description: 'Malla defensiva hexagonal con ondas de choque luminosas y amortiguación cuántica.',
    badge: '🛡️ Forcefield'
  },
  {
    id: 'atomic_orbital',
    name: 'Átomo Cuántico Orbital',
    category: 'Energía',
    description: 'Núcleo atómico con 3 órbitas elípticas de electrones girando a alta velocidad.',
    badge: '⚛️ Átomo'
  },
  {
    id: 'neon_gyroscope',
    name: 'Giroscopio Neón 3D',
    category: 'Cyberpunk',
    description: 'Tres anillos gimbals concéntricos independientes en rotación giroscópica 3D.',
    badge: '🔄 Giroscopio'
  },
  {
    id: 'crystal_quartz',
    name: 'Prisma Cristal de Cuarzo',
    category: 'Energía',
    description: 'Estructura facetada de cuarzo iridiscente con refracción y destellos prismáticos.',
    badge: '💎 Cristal'
  },
  {
    id: 'bioluminescent_jelly',
    name: 'Medusa Abisal Bioluminiscente',
    category: 'Orgánico',
    description: 'Cúpula viva con tentáculos flotantes y pulsos bioluminiscentes orgánicos suaves.',
    badge: '🪼 Medusa'
  },
  {
    id: 'tachyon_accelerator',
    name: 'Acelerador de Taquiones',
    category: 'Reactor',
    description: 'Anillo de confinamiento magnético con pulsos lumínicos a hipervelocidad.',
    badge: '🚀 Acelerador'
  },
  {
    id: 'radar_tactical_cross',
    name: 'Mira Táctica HUD Vectorial',
    category: 'Cyberpunk',
    description: 'Retícula de precisión balística de avión de caza con anillo de marcación 360°.',
    badge: '🎯 Tactical HUD'
  },
  {
    id: 'solar_eclipse',
    name: 'Corona Solar de Eclipse',
    category: 'Cósmico',
    description: 'Disco negro total rodeado por la corona ardiente dorada y fulguraciones solares.',
    badge: '🌑 Eclipse'
  },
  {
    id: 'digital_matrix_nexus',
    name: 'Nexus Digital Matrix',
    category: 'Cyberpunk',
    description: 'Núcleo cibernético con glifos de código binario giratorios e hipervínculos.',
    badge: '💾 Matrix'
  },
  {
    id: 'sound_ripple_3d',
    name: 'Esfera Acústica 3D',
    category: 'Orgánico',
    description: 'Esfera de resonancia sónica que emite ondas esféricas concéntricas continuas.',
    badge: '🔊 Esfera Sónica'
  },
  {
    id: 'stealth_hex_orb',
    name: 'Orbe Hexagonal Stealth',
    category: 'Cyberpunk',
    description: 'Blindaje facetado angular de aleación oscura con ranuras de ventilación de neón.',
    badge: '⬢ Stealth Hex'
  },
  {
    id: 'sacred_flower_life',
    name: 'Flor de la Vida Sagrada',
    category: 'Holograma',
    description: 'Patrón geométrico sagrado universal con círculos entrelazados en rotación áurea.',
    badge: '🌸 Flor de Vida'
  },
  {
    id: 'hypercube_tesseract',
    name: 'Teseracto Hipercubo 4D',
    category: 'Holograma',
    description: 'Proyección isométrica de un cubo de cuatro dimensiones en rotación continua.',
    badge: '🧊 Teseracto'
  },
  {
    id: 'vortex_black_hole',
    name: 'Vórtice Espiral Gravitacional',
    category: 'Cósmico',
    description: 'Espiral de gas cósmico acelerado succionado hacia el centro de masa estelar.',
    badge: '🌀 Espiral'
  },
  // --- 12 NUEVOS ORBES CON CARÁTULA Y FOTO DE ARTISTA ---
  {
    id: 'cover_vinyl_turntable',
    name: 'Vinilo 33 RPM con Carátula',
    category: 'Carátula & Artista',
    description: 'Disco de vinilo estriado negro en rotación continua con la carátula circular central y reflejos lumínicos.',
    badge: '💿 Vinilo Álbum'
  },
  {
    id: 'cover_holo_projector',
    name: 'Holograma 3D con Foto Artista',
    category: 'Carátula & Artista',
    description: 'Proyector holográfico con haz de luz azul-cian proyectando la foto y carátula con scanlines.',
    badge: '🌐 Holo Artista'
  },
  {
    id: 'cover_cyber_aperture',
    name: 'Diafragma Cyber HUD con Portada',
    category: 'Carátula & Artista',
    description: 'Lente cibernético de precisión con iris mecánico pulsante alrededor de la carátula recortada.',
    badge: '⚡ Cyber Iris'
  },
  {
    id: 'cover_spectrum_ring',
    name: 'Anillo Espectral Ecualizador con Foto',
    category: 'Carátula & Artista',
    description: 'Círculo de 40 barras de espectro ecualizador multicolor bailando alrededor de la foto del artista.',
    badge: '📊 Anillo VU'
  },
  {
    id: 'cover_stargate_portal',
    name: 'Portal Cósmico Stargate con Carátula',
    category: 'Carátula & Artista',
    description: 'Horizonte de sucesos espacial con anillo exterior de glifos en rotación que enmarcan la carátula.',
    badge: '🌌 Portal Stargate'
  },
  {
    id: 'cover_neon_radiance',
    name: 'Aura Neón RGB con Carátula Flotante',
    category: 'Carátula & Artista',
    description: 'Doble anillo de neón pulsante con destellos de plasma reactivos y la foto del artista con reflejo esmerilado.',
    badge: '🌈 Aura Neón'
  },
  {
    id: 'cover_radar_sonar',
    name: 'Sonar Táctico Verde con Foto',
    category: 'Carátula & Artista',
    description: 'Pantalla de sonar militar con barrido radial de 360° continuo sobre la foto del artista en alta definición.',
    badge: '🎯 Sonar Radar'
  },
  {
    id: 'cover_compact_disc',
    name: 'CD Plateado Iridiscente con Miniatura',
    category: 'Carátula & Artista',
    description: 'Disco compacto transparente y plateado con arcoíris de refracción girando con la carátula.',
    badge: '📀 Disco CD'
  },
  {
    id: 'cover_crystal_prism',
    name: 'Prisma de Diamante con Foto',
    category: 'Carátula & Artista',
    description: 'Cristal facetado geométrico con destellos prismáticos y la carátula refractada en su interior.',
    badge: '💎 Cristal Cover'
  },
  {
    id: 'cover_matrix_cyber',
    name: 'Cápsula Digital Matrix con Carátula',
    category: 'Carátula & Artista',
    description: 'Lluvia digital de glifos verdes cayendo en cascada sobre la foto y carátula del artista.',
    badge: '💾 Matrix Cover'
  },
  {
    id: 'cover_blackout_oled',
    name: 'Blackout OLED Puro con Carátula HD',
    category: 'Carátula & Artista',
    description: 'Carátula circular nítida de alto contraste con anillo respiratorio sutil para pantallas OLED nocturnas.',
    badge: '🖤 Blackout OLED'
  },
  {
    id: 'cover_swiss_gold_watch',
    name: 'Cronómetro Suizo de Oro con Foto',
    category: 'Carátula & Artista',
    description: 'Bisel de alta relojería suiza en oro con manecillas de precisión y la foto del artista como esfera.',
    badge: '⏱️ Cronómetro Oro'
  }
];

export interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 15
  isMuted: boolean;
  playbackSpeed: number;
  playbackQuality: VideoQuality;
  /**
   * Calidad que el reproductor de YouTube informa como REAL en este momento.
   * Puede ser menor que la elegida (YouTube la baja al recargar, en segundo plano
   * o si la conexión no da). Se usa solo para mostrarla: la preferencia del usuario
   * vive en `playbackQuality` y nunca se sobrescribe con este valor.
   */
  actualQuality?: string;
  availableQualities: VideoQuality[];
  repeatMode: 'none' | 'one' | 'all';
  isDucked: boolean;
  nonStop: boolean; // Continuous non-stop song after song
  playlistQueue?: Track[]; // Upcoming queue synced with satellites
}

export interface SatelliteQueueTrack {
  id: string;
  videoId?: string;
  title: string;
  name?: string; // alias for title ("nombre del video")
  artist: string;
  thumbnail: string;
  miniatura?: string; // alias for thumbnail ("miniatura")
  duration: string;
  isCurrent: boolean;
  index: number;
}

export interface EqualizerSettings {
  enabled: boolean; // Interruptor general ON/OFF (Bypass plano vs DSP activo)
  bass: number; // -12 to +12 dB
  mid: number;  // -12 to +12 dB
  presence: number; // -12 to +12 dB
  treble: number; // -12 to +12 dB
  bassBoost: boolean;
  bassBoostLevel: number; // 0 to 100
  loudnessEnhancer: boolean;
  bluetoothKeepAlive: boolean;
  keepAliveIntervalSeconds: number;
  preset: string;
}

export interface AutoVolumeReducerConfig {
  enabled: boolean;            // Activar / Desactivar reducción automática por inactividad sin música
  targetVolume: number;        // Volumen seguro de descanso (0 a 15, ej: 4 o 5)
  delaySeconds: number;        // Segundos de inactividad sin música antes de bajar el volumen (ej: 30, 60, 120, 300, 600)
  onlyIfAboveTarget: boolean;  // Bajar solo si el volumen actual es mayor al objetivo
  smoothFade: boolean;         // Transición progresiva/suave vs salto brusco
  applyOnEveryTrack?: boolean; // Compatibilidad
}

export type AutoShutdownMode =
  | 'shutdown_pc'       // 1. Apagado total de PC / Sistema Operativo
  | 'sleep_pc'          // 2. Suspender / Modo Reposo de PC
  | 'stop_music_sleep'  // 3. Pausar Música y Activar Pantalla Negra OLED
  | 'lock_pc';          // 4. Bloquear Sesión de PC

export interface AutoShutdownConfig {
  enabled: boolean;                      // Interruptor maestro ON / OFF
  targetTime: string;                    // Hora específica 'HH:MM' (ej: '23:30', '00:00')
  mode: AutoShutdownMode;                // Acción a ejecutar al alcanzar la hora
  warningMinutesBefore: number;          // Aviso previo en minutos (1, 2, 5, 10)
  playChimeOnWarning: boolean;           // Tono de aviso sonoro
  speakWarning: boolean;                 // Avisar por voz ("El sistema se apagará en 2 minutos")
  fadeVolumeBeforeShutdown: boolean;     // Atenuar volumen progresivamente antes de apagar
  daysOfWeek: number[];                  // Días activos [0..6] (0: Dom, 1: Lun, ..., 6: Sáb)
}

export type TimeOfDaySlot = 'auto' | 'morning' | 'afternoon' | 'night' | 'late_night' | 'custom';

export interface ScreensaverItem {
  id: string;
  name: string;
  videoUrl: string; // YouTube ID or direct mp4
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number;   // 0-23
  isMuted: boolean;
}

export interface TimeOfDayProfile {
  slot: 'morning' | 'afternoon' | 'night' | 'late_night';
  name: string;
  description: string;
  hours: string;
  startHour: number;
  endHour: number;
  videoUrl: string;
}

export interface ScreensaverConfig {
  enabled: boolean;
  inactivityTimeoutSeconds: number; // e.g. 30 seconds after music stops
  returnToWebFirst: boolean;
  darknessLevel?: number; // 0.0 to 1.0 (e.g. 0.65) - Deslizador de nivel de oscuridad y blackout OLED
  items: ScreensaverItem[];
  activeItemId: string | null;
  customVideoUrl?: string;
  showClock?: boolean;
  clockFont?: ClockFont;
  clockStyle?: ClockStyle;
  clockFormat?: ClockFormat;
  showSeconds?: boolean;
  showDate?: boolean;
  clockScale?: number;
  clockOffsetX?: number;
  clockOffsetY?: number;
  showMusicBar?: boolean; // Activar / Desactivar la barra de música en pantalla de bloqueo
  musicBarStyle?: LockScreenMusicBarStyle; // 20 Estilos dinámicos de barra de música
  showLockScreenQr?: boolean; // Mostrar código QR de vinculación fijo en la pantalla de bloqueo / protector
  qrScale?: number;
  qrOffsetX?: number;
  qrOffsetY?: number;
  qrBgOpacity?: number; // 0.0 (fondo completamente transparente) a 1.0 (fondo negro sólido)
  qrHideText?: boolean; // true = quitar letras y dejar solo el QR limpio sin textos
  videoQuality?: 'auto' | '720p' | '480p' | '1080p'; // Calidad optimizada para evitar tirones (720p fluido por defecto)
  hardwareAcceleration?: boolean; // Aceleración por hardware aislada sin repintado
  autoRecoverFreeze?: boolean; // Perro guardián anti-congelamiento automático (watchdog)
  timeOfDayMode?: boolean; // Automatically switch according to time of day
  selectedTimeOfDaySlot?: TimeOfDaySlot; // 'auto', 'morning', 'afternoon', 'night', 'late_night', 'custom'
  timeOfDayVideos?: {
    morning: { videoUrl: string; name: string };
    afternoon: { videoUrl: string; name: string };
    night: { videoUrl: string; name: string };
    late_night: { videoUrl: string; name: string };
  };
}

export type BottomBarElementId = 'qr_code' | 'track_info' | 'playback_controls' | 'volume_nodes';

export interface BottomBarItemConfig {
  id: BottomBarElementId;
  scale: number; // 0.5 to 2.0 (default 1.0)
  offsetX: number; // in px (-500 to 500)
  offsetY: number; // in px (-200 to 200)
  order: number; // 0, 1, 2, 3
  hidden?: boolean;
}

export interface BottomBarLayoutConfig {
  items: Record<BottomBarElementId, BottomBarItemConfig>;
  overallHeightScale: number; // 0.7 to 1.8
  overallOffsetY: number; // -100 to 100
  gap: number; // 8 to 48 px
  alignItems: 'center' | 'flex-start' | 'flex-end';
}

export interface NodeDevice {
  id: string;
  name: string;
  role: NodeRole;
  batteryLevel?: number;
  isListening: boolean;
  lastPing: number;
}

export interface VoiceCommandResult {
  action:
    | 'play_artist'
    | 'play_track'
    | 'pause'
    | 'resume'
    | 'stop'
    | 'next'
    | 'previous'
    | 'repeat'
    | 'volume_up'
    | 'volume_down'
    | 'volume_set'
    | 'mute'
    | 'unmute'
    | 'quality_set'
    | 'speed_set'
    | 'header_opacity_set'
    | 'footer_opacity_set'
    | 'bars_transparency_set'
    | 'video_opacity_set'
    | 'eq_preset'
    | 'screensaver_start'
    | 'screensaver_stop'
    | 'zen_mode'
    | 'auto_shutdown_set'
    | 'auto_shutdown_cancel'
    | 'pc_shutdown_now'
    | 'unknown';
  query?: string;
  artist?: string;
  track?: string;
  volumeValue?: number;
  qualityValue?: VideoQuality;
  speedValue?: number;
  opacityValue?: number;
  headerOpacity?: number;
  footerOpacity?: number;
  presetName?: string;
  targetTime?: string;
  delayMinutes?: number;
  shutdownMode?: AutoShutdownMode;
  speechFeedback: string;
  confidence?: number;
}

export interface SyncMessage {
  type:
    | 'state_update'
    | 'command'
    | 'register_satellite'
    | 'satellite_registered'
    | 'ping'
    | 'pong'
    | 'satellite_mic_event'
    | 'playlist_queue'
    | 'queue_update'
    | 'playback_state';
  nodeId: string;
  nodeName: string;
  role: NodeRole;
  timestamp: number;
  payload: any;
  commandId?: string; // for deduplication
}
