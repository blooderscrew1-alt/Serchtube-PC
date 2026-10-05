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
        print('Section 1 replaced successfully')
    else:
        print('Section 1 already replaced or not found')

    # SECTION 7: voice_personality (end tag)
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

    s7_new_end = '''                        {isSelected && (
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
          </CollapsibleSection>'''

    if s7_old_end in content:
        content = content.replace(s7_old_end, s7_new_end)
        print('Section 7 end replaced successfully')
    else:
        print('Section 7 end check')

    # SECTION 8: audio_ducking
    s8_old = '''          {/* Section 3: Audio Ducking Configuration */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center">
                  <Volume2 size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Atenuación de Audio (Ducking)</div>
                  <div className="text-xs text-gray-400">
                    Baja automáticamente el volumen de la música cuando la IA habla.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ duckingEnabled: !speechConfig.duckingEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  speechConfig.duckingEnabled ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.duckingEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>'''

    s8_new = '''          {/* Section 3: Audio Ducking Configuration */}
          <CollapsibleSection
            id="audio_ducking"
            title="Atenuación Inteligente de Audio (Ducking)"
            icon={<VolumeX size={16} />}
            summary={
              speechConfig.duckingEnabled
                ? "Baja automáticamente el volumen de la música cuando el asistente habla para entenderlo con claridad"
                : "Mantiene el volumen de la música constante sin atenuar"
            }
            badge={
              speechConfig.duckingEnabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-bold">
                  ACTIVA
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADA
                </span>
              )
            }
            isExpanded={!!expandedSections['audio_ducking']}
            onToggle={() => toggleSection('audio_ducking')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Atenuación de Audio (Ducking)</div>
                <div className="text-xs text-gray-400">
                  Baja automáticamente el volumen de la música cuando la IA habla.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ duckingEnabled: !speechConfig.duckingEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  speechConfig.duckingEnabled ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.duckingEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </CollapsibleSection>'''

    if s8_old in content:
        content = content.replace(s8_old, s8_new)
        print('Section 8 replaced successfully')
    else:
        print('Section 8 not found')

    # SECTION 9: satellite_mic_only
    s9_old = '''          {/* Section 3.1: Satellite Mics Only Configuration */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center">
                  <Mic size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Solo Micrófonos Satélite (Desactivar Micrófono Local)</div>
                  <div className="text-xs text-gray-400">
                    Desactiva el micrófono de este dispositivo y escucha únicamente los comandos de voz provenientes de los nodos satélite externos.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ satelliteMicOnly: !speechConfig.satelliteMicOnly })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  speechConfig.satelliteMicOnly ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.satelliteMicOnly ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>'''

    s9_new = '''          {/* Section 3.1: Satellite Mics Only Configuration */}
          <CollapsibleSection
            id="satellite_mic_only"
            title="Solo Micrófonos Satélite (Consola Silenciosa)"
            icon={<Wifi size={16} />}
            summary={
              speechConfig.satelliteMicOnly
                ? "Micrófono local de la PC silenciado • Escucha únicamente comandos provenientes de nodos satélites externos"
                : "Micrófono de la PC activo y escuchando comandos normalmente"
            }
            badge={
              speechConfig.satelliteMicOnly ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono border border-red-500/30 font-bold">
                  MIC PC MUTED
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  NORMAL
                </span>
              )
            }
            isExpanded={!!expandedSections['satellite_mic_only']}
            onToggle={() => toggleSection('satellite_mic_only')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Solo Micrófonos Satélite (Desactivar Micrófono Local)</div>
                <div className="text-xs text-gray-400">
                  Desactiva el micrófono de este dispositivo y escucha únicamente los comandos de voz provenientes de los nodos satélite externos.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSpeechConfig({ satelliteMicOnly: !speechConfig.satelliteMicOnly })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  speechConfig.satelliteMicOnly ? 'bg-red-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    speechConfig.satelliteMicOnly ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </CollapsibleSection>'''

    if s9_old in content:
        content = content.replace(s9_old, s9_new)
        print('Section 9 replaced successfully')
    else:
        print('Section 9 not found')

    # SECTION 10: equalizer
    s10_old_start = '''          {/* Section 3.2: Equalizer Master Switch & Hardware Audio Processing */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">'''

    s10_new_start = '''          {/* Section 3.2: Equalizer Master Switch & Hardware Audio Processing */}
          <CollapsibleSection
            id="equalizer"
            title="Ecualizador y Procesamiento Hi-Fi"
            icon={<Sliders size={16} />}
            summary={
              eqSettings?.enabled !== false
                ? `Preset: ${eqSettings?.preset || 'Hi-Fi'} • Graves: ${eqSettings?.bassBoost ? 'ON' : 'OFF'} • Compresor: ${eqSettings?.loudnessEnhancer ? 'ON' : 'OFF'}`
                : "Procesamiento de audio desactivado (modo bypass directo sin ecualizar)"
            }
            badge={
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                eqSettings?.enabled !== false
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/10 text-gray-400 border-white/10'
              }`}>
                {eqSettings?.enabled !== false ? (eqSettings?.preset || 'ON') : 'BYPASS'}
              </span>
            }
            isExpanded={!!expandedSections['equalizer']}
            onToggle={() => toggleSection('equalizer')}
            gradient="bg-gradient-to-br from-red-950/20 via-black to-white/5"
            borderColor="border-red-500/30"
          >'''

    if s10_old_start in content:
        content = content.replace(s10_old_start, s10_new_start)
        s10_old_end = '''                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      eqSettings.bluetoothKeepAlive !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>'''
        s10_new_end = '''                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      eqSettings.bluetoothKeepAlive !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s10_old_end, s10_new_end)
        print('Section 10 replaced successfully')
    else:
        print('Section 10 not found')

    # SECTION 11: auto_volume
    s11_old_start = '''          {/* Section 3.3: Auto Volume Inactivity Reducer ("bajar el volumen después de cierto tiempo de inactividad sin música") */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/20 to-black/40 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  autoVolumeConfig.enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-white/10 text-gray-400'
                }`}>
                  <ArrowDown size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Reductor de Volumen por Inactividad</span>
                    <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold border ${
                      autoVolumeConfig.enabled
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-white/10 text-gray-400 border-white/10'
                    }`}>
                      {autoVolumeConfig.enabled ? `${autoVolumeConfig.delaySeconds}s -> Vol ${autoVolumeConfig.targetVolume}` : 'OFF'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Baja el volumen automáticamente tras un tiempo configurable en pausa para no sorprenderte al poner música luego.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAutoVolume?.({ enabled: !autoVolumeConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  autoVolumeConfig.enabled ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    autoVolumeConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>'''

    s11_new_start = '''          {/* Section 3.3: Auto Volume Inactivity Reducer ("bajar el volumen después de cierto tiempo de inactividad sin música") */}
          <CollapsibleSection
            id="auto_volume"
            title="Reductor de Volumen por Inactividad"
            icon={<ArrowDown size={16} />}
            summary={
              autoVolumeConfig?.enabled
                ? `Bajar al ${autoVolumeConfig.targetVolume}% tras ${autoVolumeConfig.delaySeconds}s sin música • Transición suave: ${autoVolumeConfig.smoothFade ? 'ON' : 'OFF'}`
                : "Reduce el volumen automáticamente tras pausar la música para evitar sobresaltos al reanudar"
            }
            badge={
              autoVolumeConfig?.enabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30 font-bold">
                  A {autoVolumeConfig.targetVolume}% EN {autoVolumeConfig.delaySeconds}s
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADO
                </span>
              )
            }
            isExpanded={!!expandedSections['auto_volume']}
            onToggle={() => toggleSection('auto_volume')}
            gradient="bg-gradient-to-br from-blue-950/20 to-black/40"
            borderColor="border-blue-500/20"
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Atenuación Automática tras Pausa</span>
                <span className="text-[11px] text-gray-400 block">
                  Baja el volumen tras un tiempo configurable en pausa para no sorprenderte al poner música luego
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAutoVolume?.({ enabled: !autoVolumeConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                  autoVolumeConfig.enabled ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    autoVolumeConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>'''

    if s11_old_start in content:
        content = content.replace(s11_old_start, s11_new_start)
        s11_old_end = '''                    <ArrowDown size={13} className="text-blue-400" />
                    Probar reducción ahora
                  </button>
                </div>
              </div>
            )}
          </div>'''
        s11_new_end = '''                    <ArrowDown size={13} className="text-blue-400" />
                    Probar reducción ahora
                  </button>
                </div>
              </div>
            )}
          </CollapsibleSection>'''
        content = content.replace(s11_old_end, s11_new_end)
        print('Section 11 replaced successfully')
    else:
        print('Section 11 not found')

    # SECTION 12: screensaver
    s12_old_start = '''          {/* Section 4: Screensaver / Sleep Mode Settings with Customizable YouTube link, Fonts & Clock toggles */}
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Moon size={18} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Protector de Pantalla & Modo Reposo</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateScreensaverConfig({ enabled: !screensaverConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  screensaverConfig.enabled ? 'bg-blue-500' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    screensaverConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>'''

    s12_new_start = '''          {/* Section 4: Screensaver / Sleep Mode Settings with Customizable YouTube link, Fonts & Clock toggles */}
          <CollapsibleSection
            id="screensaver"
            title="Protector de Pantalla & Modo Reposo OLED"
            icon={<Moon size={16} />}
            summary={
              screensaverConfig.enabled
                ? `Inactividad: ${screensaverConfig.timeoutSeconds}s • Modo: ${screensaverConfig.timeOfDayMode ? 'Por hora del día (4 franjas)' : 'Video YouTube fijo'} • Reloj: 20 estilos • Barra música: ${screensaverConfig.showMusicBar !== false ? 'Visible' : 'Oculta'} • QR Fijo: ${screensaverConfig.showLockScreenQr ? 'Visible' : 'Oculto'}`
                : "Modo reposo OLED con videos ambientales, 20 relojes digitales y QR de vinculación"
            }
            badge={
              screensaverConfig.enabled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30 font-bold">
                  ACTIVO ({screensaverConfig.timeoutSeconds}s)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
                  DESACTIVADO
                </span>
              )
            }
            isExpanded={!!expandedSections['screensaver']}
            onToggle={() => toggleSection('screensaver')}
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Activar Protector de Pantalla</span>
                <span className="text-[11px] text-gray-400 block">
                  Inicia automáticamente tras un período de inactividad o mediante el comando "música: protector"
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateScreensaverConfig({ enabled: !screensaverConfig.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-3 ${
                  screensaverConfig.enabled ? 'bg-blue-500' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    screensaverConfig.enabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>'''

    if s12_old_start in content:
        content = content.replace(s12_old_start, s12_new_start)
        s12_old_end = '''                    type="checkbox"
                    checked={screensaverConfig.showLockScreenQr ?? false}
                    onChange={(e) => onUpdateScreensaverConfig({ showLockScreenQr: e.target.checked })}
                    className="accent-red-600 w-4 h-4 rounded cursor-pointer shrink-0 ml-3"
                  />
                </div>
              </div>
            )}
          </div>'''
        s12_new_end = '''                    type="checkbox"
                    checked={screensaverConfig.showLockScreenQr ?? false}
                    onChange={(e) => onUpdateScreensaverConfig({ showLockScreenQr: e.target.checked })}
                    className="accent-red-600 w-4 h-4 rounded cursor-pointer shrink-0 ml-3"
                  />
                </div>
              </div>
            )}
          </CollapsibleSection>'''
        content = content.replace(s12_old_end, s12_new_end)
        print('Section 12 replaced successfully')
    else:
        print('Section 12 not found')

    # SECTION 13: visual_effects
    s13_old_start = '''          {/* Section 5: Transparencias y Difuminaciones (Pantalla Completa Personalizable) */}
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders size={18} className="text-red-500" />
                <div>
                  <span className="text-sm font-semibold text-white">
                    Transparencias de Barras y Difuminaciones
                  </span>
                  <p className="text-xs text-gray-400">
                    Personaliza la opacidad del fondo de la barra de título, barra de información, video y ondas. Las letras y textos se mantienen 100% nítidos y legibles.
                  </p>
                </div>
              </div>
            </div>'''

    s13_new_start = '''          {/* Section 5: Transparencias y Difuminaciones (Pantalla Completa Personalizable) */}
          <CollapsibleSection
            id="visual_effects"
            title="Transparencias, Ondas y Efectos Visuales"
            icon={<Layers size={16} />}
            summary={`Opacidades: Fondo ${Math.round(videoOpacity * 100)}%, Ondas ${Math.round((visualConfig?.wavesOpacity ?? 0.85) * 100)}% • 32 Estilos de Orbe • 24 Estilos de Onda • Pantalla completa`}
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                32 ORBES / 24 ONDAS
              </span>
            }
            isExpanded={!!expandedSections['visual_effects']}
            onToggle={() => toggleSection('visual_effects')}
          >
            <p className="text-xs text-gray-400">
              Personaliza la opacidad del fondo de la barra de título, barra de información, video y ondas. Las letras y textos se mantienen 100% nítidos y legibles.
            </p>'''

    if s13_old_start in content:
        content = content.replace(s13_old_start, s13_new_start)
        s13_old_end = '''                  className="w-full accent-white bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400">
                  Oscurece la zona inferior detrás de la barra de información para maximizar la legibilidad en carretera.
                </div>
              </div>
            </div>
          </div>'''
        s13_new_end = '''                  className="w-full accent-white bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[11px] text-gray-400">
                  Oscurece la zona inferior detrás de la barra de información para maximizar la legibilidad en carretera.
                </div>
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s13_old_end, s13_new_end)
        print('Section 13 replaced successfully')
    else:
        print('Section 13 not found')

    # SECTION 14: media_compatibility
    s14_old_start = '''          {/* Chrome Extensions & Hardware Media Compatibility Section */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Volumen Exclusivo de la App & Controles (Sin tocar Windows)
              </span>
            </div>'''

    s14_new_start = '''          {/* Chrome Extensions & Hardware Media Compatibility Section */}
          <CollapsibleSection
            id="media_compatibility"
            title="Compatibilidad Multimedia y Teclas de Hardware"
            icon={<ShieldCheck size={16} />}
            summary="Control de volumen interno exclusivo (0 a 15) mediante teclado, atajos y mandos de consola (Xbox/PlayStation) sin alterar Windows"
            badge={
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                TECLADO / MANDOS
              </span>
            }
            isExpanded={!!expandedSections['media_compatibility']}
            onToggle={() => toggleSection('media_compatibility')}
          >'''

    if s14_old_start in content:
        content = content.replace(s14_old_start, s14_new_start)
        s14_old_end = '''                  • <strong className="text-white">D-Pad Izq / Der:</strong> Canción anterior / siguiente<br />
                  • <strong className="text-white">Botón A / Start / L3:</strong> Play / Pausa / Mute
                </div>
              </div>
            </div>
          </div>'''
        s14_new_end = '''                  • <strong className="text-white">D-Pad Izq / Der:</strong> Canción anterior / siguiente<br />
                  • <strong className="text-white">Botón A / Start / L3:</strong> Play / Pausa / Mute
                </div>
              </div>
            </div>
          </CollapsibleSection>'''
        content = content.replace(s14_old_end, s14_new_end)
        print('Section 14 replaced successfully')
    else:
        print('Section 14 not found')

    with open('src/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('All sections converted to CollapsibleSection!')

if __name__ == '__main__':
    main()
