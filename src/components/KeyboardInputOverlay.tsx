import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Keyboard, Send, CornerDownLeft, X, Sparkles } from 'lucide-react';

interface KeyboardInputOverlayProps {
  typedText: string;
  isSubmitting?: boolean;
  onClear?: () => void;
  onSubmit?: () => void;
}

const KeyboardInputOverlayComponent: React.FC<KeyboardInputOverlayProps> = ({
  typedText,
  isSubmitting = false,
  onClear,
  onSubmit
}) => {
  if (!typedText && !isSubmitting) {
    return null;
  }

  const characters = typedText.split('');

  return (
    <AnimatePresence>
      <motion.div
        key="keyboard-overlay"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-2xl bg-black/90 backdrop-blur-2xl border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.3)] p-5 text-white">
          {/* Subtle Ambient Top Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee]" />

          {/* Header Status Bar */}
          <div className="flex items-center justify-between mb-3 text-xs tracking-wider uppercase font-mono text-cyan-400/90">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </div>
              <Keyboard className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-cyan-300">Entrada de Teclado Activa</span>
            </div>

            <div className="flex items-center gap-3 text-gray-400 text-[11px]">
              <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10">OK / Enter: Enviar</span>
              <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10">Esc: Cancelar</span>
            </div>
          </div>

          {/* Animated Characters Output Display */}
          <div className="relative min-h-[56px] flex items-center bg-zinc-950/80 rounded-xl border border-cyan-500/20 px-4 py-3 shadow-inner overflow-x-auto scrollbar-none">
            {isSubmitting ? (
              <div className="flex items-center gap-3 text-cyan-300 font-medium">
                <Sparkles className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="text-base tracking-wide animate-pulse">
                  Procesando orden: &quot;{typedText}&quot;...
                </span>
              </div>
            ) : (
              <div className="flex items-center text-xl md:text-2xl font-semibold tracking-wide text-white whitespace-pre font-mono">
                {characters.map((char, index) => (
                  <motion.span
                    key={`${index}-${char}`}
                    initial={{ opacity: 0, y: 12, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="inline-block text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}

                {/* Blinking Cyberpunk Caret Cursor */}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.75, ease: 'easeInOut' }}
                  className="inline-block w-2.5 h-7 bg-cyan-400 ml-1 rounded-sm shadow-[0_0_10px_#22d3ee]"
                />
              </div>
            )}

            {/* Quick Action Buttons on right */}
            {typedText && !isSubmitting && (
              <div className="ml-auto flex items-center gap-2 pl-3">
                {onClear && (
                  <button
                    onClick={onClear}
                    title="Borrar texto (Esc)"
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {onSubmit && (
                  <button
                    onClick={onSubmit}
                    title="Enviar orden (Enter/OK)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>OK</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Hint */}
          <div className="mt-2 text-right text-[10px] text-gray-400 font-mono">
            Escribe directamente cualquier orden de voz o música (ej: &quot;pon Queen&quot;, &quot;volumen 12&quot;, &quot;detente&quot;)
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const KeyboardInputOverlay = React.memo(KeyboardInputOverlayComponent);
