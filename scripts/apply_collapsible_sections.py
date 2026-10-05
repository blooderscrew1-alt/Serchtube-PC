import re
import sys

def main():
    with open('src/components/SettingsModal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # SECTION 1: video_quality
    s1_old_start = '''          {/* Section: Calidad y Resolución de Reproducción de Video */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/20 via-black to-white/5 border border-red-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <Tv size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Calidad y Resolución de Video</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                      {getQualityOption(playerQuality).badge || getQualityOption(playerQuality).shortLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Selecciona la resolución objetivo de streaming del reproductor de YouTube.
                  </p>
                </div>
              </div>

              {/* Data Saver Mode Quick Switch */}
              <button
                type="button"
                onClick={() => {
                  const isDataSaver = visualConfig?.dataSaver !== true;
                  handleUpdateVisual({ dataSaver: isDataSaver });
                  if (isDataSaver) {
                    onUpdateQuality?.('small');
                  } else {
                    onUpdateQuality?.('auto');
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                  visualConfig?.dataSaver
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title={visualConfig?.dataSaver ? "Modo ahorro activo (240p bajo consumo)" : "Activar modo ahorro de datos"}
              >
                <Zap size={13} className={visualConfig?.dataSaver ? "text-amber-400" : "text-gray-400"} />
                <span>{visualConfig?.dataSaver ? "Ahorro: ON" : "Ahorro: OFF"}</span>
              </button>
            </div>'''

    s1_new_start = '''          {/* Section: Calidad y Resolución de Reproducción de Video */}
          <CollapsibleSection
            id="video_quality"
            title="Calidad y Resolución de Video"
            icon={<Tv size={16} />}
            summary={`Resolución: ${getQualityOption(playerQuality).label} • Modo Ahorro: ${visualConfig?.dataSaver ? 'Activado (240p)' : 'Desactivado'} • Velocidad: ${playerSpeed}x`}
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                {getQualityOption(playerQuality).badge || getQualityOption(playerQuality).shortLabel}
              </span>
            }
            isExpanded={!!expandedSections['video_quality']}
            onToggle={() => toggleSection('video_quality')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-white/5"
            borderColor="border-red-500/30"
          >
            {/* Quick Switch for Data Saver Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Modo Ahorro de Datos (Bajo Consumo)</span>
                <span className="text-[11px] text-gray-400">Fuerza 240p para optimizar el consumo de red en carretera o datos móviles</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const isDataSaver = visualConfig?.dataSaver !== true;
                  handleUpdateVisual({ dataSaver: isDataSaver });
                  if (isDataSaver) {
                    onUpdateQuality?.('small');
                  } else {
                    onUpdateQuality?.('auto');
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer shrink-0 ${
                  visualConfig?.dataSaver
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title={visualConfig?.dataSaver ? "Modo ahorro activo (240p bajo consumo)" : "Activar modo ahorro de datos"}
              >
                <Zap size={13} className={visualConfig?.dataSaver ? "text-amber-400" : "text-gray-400"} />
                <span>{visualConfig?.dataSaver ? "Ahorro: ON" : "Ahorro: OFF"}</span>
              </button>
            </div>'''

    if s1_old_start in content:
        content = content.replace(s1_old_start, s1_new_start)
        # replace closing tag of section 1
        s1_old_end = '''                  >
                    {spd.value}x
                  </button>
                ))}
              </div>
            </div>
          </div>'''
        s1_new_end = '''                  >
                    {spd.value}x
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s1_old_end, s1_new_end)
        print('Section 1 replaced')
    else:
        print('Section 1 start not found')

    # SECTION 2: video_opacity
    s2_old = '''          {/* Section 1: Video Behind Waves Transparency Slider */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders size={18} className="text-red-500" />
                <div>
                  <span className="text-sm font-semibold text-white">Transparencia del Video tras las Ondas</span>
                  <p className="text-xs text-gray-400">
                    Controla la opacidad del video de YouTube que se reproduce detrás de la animación de ondas.
                  </p>
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-red-500 bg-red-600/10 px-2.5 py-1 rounded border border-red-600/20">
                {Math.round(videoOpacity * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 font-mono">10%</span>
              <input
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={videoOpacity}
                onChange={(e) => onUpdateVideoOpacity?.(parseFloat(e.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
              <span className="text-[11px] text-gray-400 font-mono">100%</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400 font-mono uppercase">Presets rápidos:</span>
              {[0.2, 0.35, 0.5, 0.75, 1.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdateVideoOpacity?.(val)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    Math.abs(videoOpacity - val) < 0.04
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {Math.round(val * 100)}%
                </button>
              ))}
            </div>
          </div>'''

    s2_new = '''          {/* Section 2: Video Behind Waves Transparency Slider */}
          <CollapsibleSection
            id="video_opacity"
            title="Transparencia del Video tras las Ondas"
            icon={<Sliders size={16} />}
            summary={`Opacidad del video de YouTube detrás de las ondas: ${Math.round(videoOpacity * 100)}%`}
            badge={
              <span className="text-xs font-mono font-bold text-red-400 bg-red-600/10 px-2 py-0.5 rounded border border-red-600/20">
                {Math.round(videoOpacity * 100)}%
              </span>
            }
            isExpanded={!!expandedSections['video_opacity']}
            onToggle={() => toggleSection('video_opacity')}
          >
            <p className="text-xs text-gray-400">
              Controla la opacidad del video de YouTube que se reproduce detrás de la animación de ondas.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 font-mono">10%</span>
              <input
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={videoOpacity}
                onChange={(e) => onUpdateVideoOpacity?.(parseFloat(e.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
              <span className="text-[11px] text-gray-400 font-mono">100%</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400 font-mono uppercase">Presets rápidos:</span>
              {[0.2, 0.35, 0.5, 0.75, 1.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdateVideoOpacity?.(val)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    Math.abs(videoOpacity - val) < 0.04
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {Math.round(val * 100)}%
                </button>
              ))}
            </div>
          </CollapsibleSection>'''

    if s2_old in content:
        content = content.replace(s2_old, s2_new)
        print('Section 2 replaced')
    else:
        print('Section 2 not found')

    # SECTION 3: auto_shutdown
    s3_old_start = '''          {/* Section: Auto-Apagado de PC a una Hora Específica */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/25 via-black to-black border border-red-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                  autoShutdownConfig.enabled
                    ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse'
                    : 'bg-red-600/20 text-red-400 border-red-500/30'
                }`}>
                  <Power size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Auto-Apagado de PC / Sistema</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                      Hora Fija
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Apaga, suspende o pone en reposo el ordenador automáticamente a una hora programada.
                  </div>
                </div>
              </div>

              {/* Master Toggle */}
              <button
                type="button"
                onClick={() => onUpdateAutoShutdown?.({ enabled: !autoShutdownConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoShutdownConfig.enabled ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoShutdownConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>'''

    s3_new_start = '''          {/* Section: Auto-Apagado de PC a una Hora Específica */}
          <CollapsibleSection
            id="auto_shutdown"
            title="Auto-Apagado de PC Programado"
            icon={<Power size={16} />}
            summary={
              autoShutdownConfig.enabled
                ? `Apagado a las ${autoShutdownConfig.targetTime} • ${AUTO_SHUTDOWN_MODES_INFO[autoShutdownConfig.mode]?.name || autoShutdownConfig.mode} • ${autoShutdownConfig.activeDays?.length === 7 ? 'Todos los días' : `${autoShutdownConfig.activeDays?.length || 0} días/sem`}`
                : "Programa el apagado, hibernación o suspensión automática a una hora fija con aviso previo"
            }
            badge={
              autoShutdownConfig.enabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-bold">
                  ACTIVO ({autoShutdownConfig.targetTime})
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADO
                </span>
              )
            }
            isExpanded={!!expandedSections['auto_shutdown']}
            onToggle={() => toggleSection('auto_shutdown')}
            gradient="bg-gradient-to-br from-red-950/25 via-black to-black"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Interruptor de Auto-Apagado</span>
                <span className="text-[11px] text-gray-400">Activa o desactiva la cuenta regresiva para apagar el sistema</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAutoShutdown?.({ enabled: !autoShutdownConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ml-3 ${
                  autoShutdownConfig.enabled ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoShutdownConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>'''

    if s3_old_start in content:
        content = content.replace(s3_old_start, s3_new_start)
        # replace closing tag of section 3
        s3_old_end = '''                        Ejecutar Ahora
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>'''
        s3_new_end = '''                        Ejecutar Ahora
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleSection>'''
        content = content.replace(s3_old_end, s3_new_end)
        print('Section 3 replaced')
    else:
        print('Section 3 start not found')

    # SECTION 4: audio_input
    s4_old_start = '''          {/* Section: Selección de Micrófono de Entrada (Hardware) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/30 via-black to-neutral-900/40 border border-red-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <Mic size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Micrófono de Entrada</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                      Dispositivo Físico
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Selecciona qué micrófono utilizará SerchTube para capturar tu voz y comandos.
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-gray-400 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                  {audioInputDevices.length > 0 ? `${audioInputDevices.length} micrófono${audioInputDevices.length > 1 ? 's' : ''}` : 'Detectando...'}
                </span>
              </div>
            </div>'''

    s4_new_start = '''          {/* Section: Selección de Micrófono de Entrada (Hardware) */}
          <CollapsibleSection
            id="audio_input"
            title="Micrófono de Entrada (Hardware)"
            icon={<Mic size={16} />}
            summary={
              speechConfig.audioInputDeviceId === 'all'
                ? "🎙️ Todos (Mezcla de todos los micrófonos conectados en simultáneo) • Calibración y Vúmetro dB"
                : `${audioInputDevices.find(d => d.deviceId === speechConfig.audioInputDeviceId)?.label || 'Micrófono por defecto del sistema'} • Vúmetro en tiempo real y selector`
            }
            badge={
              speechConfig.audioInputDeviceId === 'all' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 font-bold">
                  TODOS (MULTI-MIC)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
                  {audioInputDevices.length > 0 ? `${audioInputDevices.length} detectados` : 'Por defecto'}
                </span>
              )
            }
            isExpanded={!!expandedSections['audio_input']}
            onToggle={() => toggleSection('audio_input')}
            gradient="bg-gradient-to-br from-red-950/30 via-black to-neutral-900/40"
            borderColor="border-red-500/30"
          >'''

    if s4_old_start in content:
        content = content.replace(s4_old_start, s4_new_start)
        # replace closing tag of section 4
        s4_old_end = '''                  <span>{isTestingMic ? (micTestVolume > 15 ? '🟢 Voz detectada' : '⚪ Silencio / Esperando voz...') : 'Prueba inactiva (pulsa Probar Micrófono para verificar)'}</span>
                  <span>{isTestingMic ? `${micTestVolume}% nivel` : '0%'}</span>
                </div>
              </div>
            </div>
          </div>'''
        s4_new_end = '''                  <span>{isTestingMic ? (micTestVolume > 15 ? '🟢 Voz detectada' : '⚪ Silencio / Esperando voz...') : 'Prueba inactiva (pulsa Probar Micrófono para verificar)'}</span>
                  <span>{isTestingMic ? `${micTestVolume}% nivel` : '0%'}</span>
                </div>
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s4_old_end, s4_new_end)
        print('Section 4 replaced')
    else:
        print('Section 4 start not found')

    # SECTION 5: wake_word
    s5_old_start = '''          {/* Section: Palabra Maestra de Activación (Wake Word) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/20 via-black to-black border border-red-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <Mic size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Palabra Maestra de Activación (Wake Word)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                      Filtro de Micrófono
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    La web solo procesará comandos cuando pronuncies la palabra de activación (ej: "música").
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ wakeWordEnabled: !(speechConfig.wakeWordEnabled !== false) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  speechConfig.wakeWordEnabled !== false ? 'bg-red-600' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    speechConfig.wakeWordEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>'''

    s5_new_start = '''          {/* Section: Palabra Maestra de Activación (Wake Word) */}
          <CollapsibleSection
            id="wake_word"
            title="Palabra Clave de Activación (Wake Word)"
            icon={<Radio size={16} />}
            summary={
              speechConfig.wakeWordEnabled !== false
                ? `Palabra clave: "${speechConfig.wakeWord || 'música'}" • Enfoque AGC/AEC: ${speechConfig.micFocusBoost !== false ? 'ON' : 'OFF'} • Inmunidad anti-eco activa`
                : "Escucha manos libres desactivada (solo comandos manuales o por pulsación)"
            }
            badge={
              speechConfig.wakeWordEnabled !== false ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-bold">
                  ACTIVA: "{speechConfig.wakeWord || 'música'}"
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADA
                </span>
              )
            }
            isExpanded={!!expandedSections['wake_word']}
            onToggle={() => toggleSection('wake_word')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-black"
            borderColor="border-red-500/30"
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Escucha Continua con Palabra Clave</span>
                <span className="text-[11px] text-gray-400 block">
                  La web solo procesará comandos cuando pronuncies la palabra de activación (ej: "música").
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ wakeWordEnabled: !(speechConfig.wakeWordEnabled !== false) })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                  speechConfig.wakeWordEnabled !== false ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.wakeWordEnabled !== false ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>'''

    if s5_old_start in content:
        content = content.replace(s5_old_start, s5_new_start)
        # replace closing tag of section 5
        s5_old_end = '''                  <span>
                    <strong>Protección Anti-Eco Activa:</strong> Al iniciar una canción, el micrófono ignora los primeros 4.5s de audio para evitar que los altavoces de la PC o la letra de la música cambien de pista accidentalmente.
                  </span>
                </div>
              </div>
            )}
          </div>'''
        s5_new_end = '''                  <span>
                    <strong>Protección Anti-Eco Activa:</strong> Al iniciar una canción, el micrófono ignora los primeros 4.5s de audio para evitar que los altavoces de la PC o la letra de la música cambien de pista accidentalmente.
                  </span>
                </div>
              </div>
            )}
          </CollapsibleSection>'''
        content = content.replace(s5_old_end, s5_new_end)
        print('Section 5 replaced')
    else:
        print('Section 5 start not found')

    # SECTION 6: tts_voice
    s6_old_start = '''          {/* Section 2: Browser & Edge "Leer en voz alta" Voice Engine */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Globe size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Motor de Voz del Navegador (Edge / Sistema)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                      Edge "Leer en voz alta"
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Utiliza las voces de alta calidad integradas en tu navegador (como las voces Naturales de Microsoft Edge).
                  </div>
                </div>
              </div>
            </div>'''

    s6_new_start = '''          {/* Section 2: Browser & Edge "Leer en voz alta" Voice Engine */}
          <CollapsibleSection
            id="tts_voice"
            title="Voz del Asistente y Lectura Natural"
            icon={<Volume2 size={16} />}
            summary={`Voz: ${browserVoices.find(v => v.voiceURI === speechConfig.voiceUri)?.name || 'Voz por defecto del navegador / Edge Natural'} • Velocidad: ${speechConfig.speechRate}x • Tono: ${speechConfig.speechPitch} • Volumen: ${Math.round((speechConfig.speechVolume ?? 1) * 100)}%`}
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                {speechConfig.speechRate}x • Vol {Math.round((speechConfig.speechVolume ?? 1) * 100)}%
              </span>
            }
            isExpanded={!!expandedSections['tts_voice']}
            onToggle={() => toggleSection('tts_voice')}
            gradient="bg-gradient-to-br from-white/5 to-white/[0.02]"
            borderColor="border-white/10"
          >'''

    if s6_old_start in content:
        content = content.replace(s6_old_start, s6_new_start)
        # replace closing tag of section 6
        s6_old_end = '''                  <span>
                    El tono (pitch) solo es compatible con ciertas voces locales (SAPI/Chrome). Las voces neurales en línea de Microsoft Edge leen con entonación natural calibrada de fábrica.
                  </span>
                </div>
              </div>
            </div>
          </div>'''
        s6_new_end = '''                  <span>
                    El tono (pitch) solo es compatible con ciertas voces locales (SAPI/Chrome). Las voces neurales en línea de Microsoft Edge leen con entonación natural calibrada de fábrica.
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s6_old_end, s6_new_end)
        print('Section 6 replaced')
    else:
        print('Section 6 start not found')

    # SECTION 7: voice_personality
    s7_old_start = '''          {/* Section 3: Neural Voice Personalities */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mic size={14} className="text-red-500" />
                Estilos y Personalidades de Voz Neural (TTS)
              </span>
              <span className="text-[10px] text-red-400 font-mono">9 Estilos Disponibles</span>
            </label>'''

    s7_new_start = '''          {/* Section 3: Neural Voice Personalities */}
          <CollapsibleSection
            id="voice_personality"
            title="Personalidad de Respuesta Neural"
            icon={<Sparkles size={16} />}
            summary={
              speechConfig.personality === 'animada'
                ? "Perfil Animada: Con entusiasmo, dinamismo, energía y frases alegres variadas"
                : "Perfil Directa: Breve, concisa y sin rodeos"
            }
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30 uppercase font-bold">
                {speechConfig.personality || 'animada'}
              </span>
            }
            isExpanded={!!expandedSections['voice_personality']}
            onToggle={() => toggleSection('voice_personality')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">9 estilos de respuesta disponibles para confirmar acciones:</span>
            </div>'''

    if s7_old_start in content:
        content = content.replace(s7_old_start, s7_new_start)
        # replace closing tag of section 7
        s7_old_end = '''                        {isSelected && (
                          <span className="text-[10px] text-red-400 font-mono font-bold flex items-center gap-0.5">
                            <Check size={12} /> Activo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>'''
        # Let's verify what s7 end looks like
        # In s7: lines 1546-1549 is:
        #                 );
        #               })}
        #             </div>
        #           </div>
        s7_actual_end = '''                        {isSelected && (
                          <span className="text-[10px] text-red-400 font-mono font-bold flex items-center gap-0.5">
                            <Check size={12} /> Activo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>'''
        if s7_actual_end in content:
            content = content.replace(s7_actual_end, s7_actual_end[:-16] + '  </div>\n          </CollapsibleSection>')
            print('Section 7 replaced')
        else:
            print('Section 7 end not matched directly, checking...')

    with open('src/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Sections 1-7 handled')

if __name__ == '__main__':
    main()
