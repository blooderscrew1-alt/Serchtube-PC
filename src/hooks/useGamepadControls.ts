import { useEffect, useRef } from 'react';

interface GamepadControlsProps {
  onVolumeStep: (delta: number, source: 'teclado' | 'control') => void;
  onMuteToggle: (source: 'teclado' | 'control') => void;
  onPlayPauseToggle: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onNotify?: (message: string) => void;
}

/**
 * Hook para soportar Mandos y Controles USB / Bluetooth (Xbox, PlayStation, Mandos genéricos, Volantes)
 * Permite cambiar el volumen EXCLUSIVO de la aplicación SerchTube sin alterar el volumen de Windows.
 */
export function useGamepadControls({
  onVolumeStep,
  onMuteToggle,
  onPlayPauseToggle,
  onNextTrack,
  onPreviousTrack,
  onNotify
}: GamepadControlsProps) {
  const callbacksRef = useRef({
    onVolumeStep,
    onMuteToggle,
    onPlayPauseToggle,
    onNextTrack,
    onPreviousTrack,
    onNotify
  });

  useEffect(() => {
    callbacksRef.current = {
      onVolumeStep,
      onMuteToggle,
      onPlayPauseToggle,
      onNextTrack,
      onPreviousTrack,
      onNotify
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.getGamepads) {
      return;
    }

    // Estado previo de botones para detectar transiciones y autorepetición
    const prevButtonStates = new Map<number, boolean>();
    const lastVolumeRepeatTime = { up: 0, down: 0 };
    let animationFrameId: number | null = null;

    const handleGamepadConnected = (e: GamepadEvent) => {
      const name = e.gamepad.id ? e.gamepad.id.replace(/\s*\(Vendor:.*$/, '') : 'Control';
      console.log(`[Gamepad] 🎮 Conectado: ${name} (Índice: ${e.gamepad.index})`);
      callbacksRef.current.onNotify?.(`🎮 Control conectado: ${name}`);
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log(`[Gamepad] 🎮 Desconectado (Índice: ${e.gamepad.index})`);
      callbacksRef.current.onNotify?.('🎮 Control desconectado');
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const now = performance.now();

      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        const isPressed = (index: number) => {
          const btn = gp.buttons[index];
          return typeof btn === 'object' ? btn.pressed : btn === 1.0;
        };

        // Identificador único por botón de este gamepad
        const btnKey = (btnIndex: number) => gp.index * 100 + btnIndex;

        const checkTriggerOnce = (btnIndex: number, action: () => void) => {
          const key = btnKey(btnIndex);
          const currentlyPressed = isPressed(btnIndex);
          const wasPressed = prevButtonStates.get(key) || false;

          if (currentlyPressed && !wasPressed) {
            action();
          }
          prevButtonStates.set(key, currentlyPressed);
        };

        // 1. Subir volumen App (D-Pad Arriba: botón 12, o RB/R1: botón 5)
        const isVolUpPressed = isPressed(12) || isPressed(5);
        const wasVolUpPressed = (prevButtonStates.get(btnKey(12)) || prevButtonStates.get(btnKey(5))) || false;
        if (isVolUpPressed) {
          if (!wasVolUpPressed || now - lastVolumeRepeatTime.up > 180) {
            callbacksRef.current.onVolumeStep(1, 'control');
            lastVolumeRepeatTime.up = now;
          }
        }
        prevButtonStates.set(btnKey(12), isPressed(12));
        prevButtonStates.set(btnKey(5), isPressed(5));

        // 2. Bajar volumen App (D-Pad Abajo: botón 13, o LB/L1: botón 4)
        const isVolDownPressed = isPressed(13) || isPressed(4);
        const wasVolDownPressed = (prevButtonStates.get(btnKey(13)) || prevButtonStates.get(btnKey(4))) || false;
        if (isVolDownPressed) {
          if (!wasVolDownPressed || now - lastVolumeRepeatTime.down > 180) {
            callbacksRef.current.onVolumeStep(-1, 'control');
            lastVolumeRepeatTime.down = now;
          }
        }
        prevButtonStates.set(btnKey(13), isPressed(13));
        prevButtonStates.set(btnKey(4), isPressed(4));

        // 3. Silenciar / Activar sonido (L3: botón 10, o Select/Back: botón 8)
        checkTriggerOnce(10, () => callbacksRef.current.onMuteToggle('control'));
        checkTriggerOnce(8, () => callbacksRef.current.onMuteToggle('control'));

        // 4. Play / Pausa (Botón A / Cruz: botón 0, o Start: botón 9)
        checkTriggerOnce(0, () => callbacksRef.current.onPlayPauseToggle());
        checkTriggerOnce(9, () => callbacksRef.current.onPlayPauseToggle());

        // 5. Siguiente canción (D-Pad Derecha: botón 15)
        checkTriggerOnce(15, () => callbacksRef.current.onNextTrack());

        // 6. Canción anterior (D-Pad Izquierda: botón 14)
        checkTriggerOnce(14, () => callbacksRef.current.onPreviousTrack());
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);
}
