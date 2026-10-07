"""
Multi Mic Monitor (tema oscuro) - escucha varios micrÃ³fonos a la vez (Windows)

Cada micrÃ³fono tiene DOS interruptores independientes:
  â» Activar    -> abre el micrÃ³fono y muestra su medidor (para comprobar que
                  funciona) SIN que se oiga nada en tus bocinas.
  ðŸ”Š Escuchar  -> envÃ­a ese micrÃ³fono a tus bocinas/audÃ­fonos.

Todo empieza apagado y silenciado. No se graba nada.
Esta versiÃ³n no usa numpy (solo sounddevice).

Uso:
    python multi_mic_monitor.py
    python multi_mic_monitor.py --diagnostico [--sondas]      (informe del equipo)
    python multi_mic_monitor.py --autotest [--con-virtuales]  (prueba sin interfaz)

Para desplegar en OTRA PC:
    1. EjecutÃ¡  python MultiMicMonitor.py --diagnostico --sondas  en ese equipo.
    2. MandÃ¡ el informe que guarda en %APPDATA%\\MultiMicMonitor\\.
    3. Si algÃºn dispositivo virtual tiene otro nombre, agregalo en config.json:
         "virtual_extra": ["mi_dsp", "loopback focusrite"]
       y ajustÃ¡ los tiempos si ese equipo es mÃ¡s lento (ver AJUSTES_POR_DEFECTO).
    Todo lo demÃ¡s (abrir de a uno, comprobar datos, cuarentena, modo seguro) es
    independiente del equipo y no necesita configuraciÃ³n.

Arranque con Windows (--inicio lo pone la clave Run):
    * Espera a que Windows termine de cargar el audio (lista de entradas estable).
    * "Calienta" el motor de audio antes de abrir los micrÃ³fonos.
    * Abre los micrÃ³fonos DE A UNO y comprueba que entregan datos antes de seguir.
    * NO abre dispositivos virtuales/de streaming (Steam, VB-Cable, Voicemeeterâ€¦)
      salvo que marques "Abrir dispositivos virtuales al iniciar con Windows".
    * Un dispositivo que falla varias veces queda AISLADO: no se vuelve a abrir solo.
    * Si varios micrÃ³fonos se quedan sin datos a la vez, entra en MODO SEGURO
      (cierra todo, espera y reabre de a uno) en vez de martillar el dispositivo.
    * BotÃ³n "ðŸ›  Reparar audio": reinicia el servicio de audio de Windows sin
      reiniciar la PC (tambiÃ©n estÃ¡ en "Reparar audio de Windows.bat").

Todo queda registrado en %APPDATA%\\MultiMicMonitor\\multimic.log
"""

import importlib
import json
import math
import os
import subprocess
import sys
import threading
import time
import traceback
import tkinter as tk
from array import array
from collections import deque
from tkinter import messagebox, ttk

try:  # texto nÃ­tido en pantallas con escalado
    import ctypes
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass

# mÃ³dulo -> paquete de pip
REQUIRED = {"sounddevice": "sounddevice"}


def _check_modules() -> dict:
    """Devuelve {paquete: error} de lo que no se puede importar."""
    problems = {}
    for mod, pkg in REQUIRED.items():
        try:
            importlib.import_module(mod)
        except (ImportError, OSError) as e:
            problems[pkg] = str(e)
    return problems


def ensure_dependencies():
    """Comprueba las librerÃ­as y, si faltan, las instala con ESTE mismo Python."""
    problems = _check_modules()
    if not problems:
        return

    root = tk.Tk()
    root.withdraw()
    pkgs = list(problems)
    if not messagebox.askyesno(
        "InstalaciÃ³n necesaria",
        f"No se pudieron cargar: {', '.join(pkgs)}\n\n"
        f"Python en uso:\n{sys.executable}\n\n"
        "Â¿Instalarlos ahora automÃ¡ticamente?\n"
        "(Necesita internet y puede tardar un minuto.)",
    ):
        root.destroy()
        sys.exit(1)

    win = tk.Toplevel(root)
    win.title("Instalandoâ€¦")
    win.geometry("360x90")
    win.resizable(False, False)
    ttk.Label(win, text=f"Instalando {', '.join(pkgs)}â€¦\nNo cierres esta ventana.").pack(pady=(12, 6))
    bar = ttk.Progressbar(win, mode="indeterminate", length=300)
    bar.pack()
    bar.start(15)
    win.update()

    log = []
    proc = subprocess.Popen(
        [sys.executable, "-m", "pip", "install", "--upgrade", *pkgs],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    reader = threading.Thread(target=lambda: log.extend(proc.stdout), daemon=True)
    reader.start()
    while proc.poll() is None:
        win.update()
        time.sleep(0.05)
    reader.join(timeout=2)
    win.destroy()

    output = "".join(log)[-1500:]
    if proc.returncode != 0:
        messagebox.showerror(
            "No se pudo instalar",
            f"Python: {sys.executable}\n\n{output}\n\n"
            "Prueba manualmente en CMD:\n"
            f'"{sys.executable}" -m pip install {" ".join(pkgs)}',
        )
        root.destroy()
        sys.exit(1)

    importlib.invalidate_caches()
    problems = _check_modules()
    if problems:
        detalle = "\n".join(f"- {p}: {e}" for p, e in problems.items())
        messagebox.showerror(
            "Instalado, pero no carga",
            f"Python: {sys.executable}\n\n{detalle}\n\n"
            "Cierra el programa y vuelve a abrirlo. Si persiste, envÃ­ame este texto.",
        )
        root.destroy()
        sys.exit(1)

    messagebox.showinfo("Listo", "InstalaciÃ³n completada. Se abrirÃ¡ el programa.")
    root.destroy()


ensure_dependencies()

import sounddevice as sd  # noqa: E402


# ---------------------------------------------------------------------------
# Robustez (esto es lo que evita los micrÃ³fonos "mudos" al encender la PC)
#
# El fallo real: al iniciar sesiÃ³n, Windows todavÃ­a estÃ¡ levantando el motor de
# audio y los drivers virtuales (Steam Streaming, VB-Cable, etc.). Si se abren
# varios micrÃ³fonos justo ahÃ­, PortAudio/WASAPI deja streams "zombis" (abiertos
# pero sin datos) y el watchdog los reabrÃ­a cada 6 s. Esa insistencia sobre un
# driver que aÃºn no estÃ¡ listo es lo que atasca el motor de audio de Windows y
# deja TODOS los micrÃ³fonos sin nivel hasta reiniciar.
#
# Ahora: se espera a que el audio estÃ© estable, se calienta el motor, los
# micrÃ³fonos se abren DE A UNO comprobando que entregan datos, los fallos se
# frenan con retroceso exponencial, un dispositivo problemÃ¡tico se aÃ­sla solo
# (cuarentena) y el arranque con Windows no abre dispositivos virtuales.
# ---------------------------------------------------------------------------
_DIR_CFG = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "MultiMicMonitor")
LOG_PATH = os.path.join(_DIR_CFG, "multimic.log")

# Dispositivos virtuales / de streaming: sus drivers casi nunca estÃ¡n listos en
# el arranque. Se pueden abrir a mano, pero no solos al iniciar con Windows.
#
# OJO: esto es solo una AYUDA, no el mecanismo de seguridad. La protecciÃ³n real
# (abrir de a uno + comprobar que entregan datos + cuarentena + modo seguro) es
# independiente de los nombres, asÃ­ que funciona igual en equipos con otros
# dispositivos. Si en tu PC hay un dispositivo virtual con otro nombre, agregalo
# en la configuraciÃ³n:  "virtual_extra": ["mi_dsp", "loopback focusrite"]
VIRTUAL_HINTS = (
    "steam streaming", "cable output", "cable input", "vb-audio", "voicemeeter",
    "virtual", "asignador de sonido", "sound mapper", "stereo mix", "mezcla est",
    "what u hear", "loopback", "sunshine", "nvidia broadcast", "obs virtual",
    "controlador primario",
)

# Valores por defecto de los tiempos y umbrales. Todos se pueden sobrescribir en
# el config.json para adaptarlos a equipos lentos o rÃ¡pidos sin tocar el cÃ³digo.
AJUSTES_POR_DEFECTO = {
    "seg_espera_audio": 90.0,     # mÃ¡ximo esperando a que el audio quede estable
    "seg_comprobar_datos": 1.5,   # frecuencia con la que se comprueba que llegan datos
    "intentos_comprobar": 3,      # comprobaciones antes de cerrar y aislar el micrÃ³fono
    "max_fallos": 4,              # fallos seguidos antes de aislar un dispositivo
    "seg_modo_seguro": 45.0,      # espera antes de reintentar en modo seguro
    "dias_cuarentena": 7,         # el aislamiento caduca solo (por si el driver se arregla)
    "virtual_extra": [],          # patrones adicionales de dispositivos virtuales
}

MAX_FALLOS = AJUSTES_POR_DEFECTO["max_fallos"]


def _ajuste(cfg: dict, clave: str):
    """Lee un ajuste del config, validando el tipo (configs viejos o editados a mano)."""
    valor = cfg.get(clave, AJUSTES_POR_DEFECTO[clave]) if isinstance(cfg, dict) else AJUSTES_POR_DEFECTO[clave]
    base = AJUSTES_POR_DEFECTO[clave]
    try:
        if isinstance(base, float):
            return float(valor)
        if isinstance(base, int):
            return int(valor)
        if isinstance(base, list):
            return [str(x) for x in valor] if isinstance(valor, (list, tuple)) else list(base)
    except (TypeError, ValueError):
        return base
    return valor


def es_virtual(nombre: str, extra=()) -> bool:
    n = (nombre or "").lower()
    return any(p in n for p in VIRTUAL_HINTS) or any(str(p).lower() in n for p in (extra or []) if p)


def bonito(nombre: str) -> str:
    """Solo para MOSTRAR: algunos drivers entregan el nombre en UTF-8 mal decodificado
    ("MicrÃƒÂ³fono"). Se intenta reparar; si no se puede, se deja igual.
    Nunca se usa como clave de configuraciÃ³n (los nombres reales no se tocan)."""
    try:
        return (nombre or "").encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return nombre or ""



def _log(msg: str):
    linea = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    try:
        print(linea, flush=True)
    except Exception:
        pass
    try:
        os.makedirs(_DIR_CFG, exist_ok=True)
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > 400_000:
            try:
                os.replace(LOG_PATH, LOG_PATH + ".1")
            except OSError:
                os.remove(LOG_PATH)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(linea + "\n")
    except OSError:
        pass


_MUTEX = None


def instancia_unica() -> bool:
    """False si ya hay otra copia abierta: dos copias peleando por los mismos
    micrÃ³fonos es otra forma de dejar el audio atascado."""
    global _MUTEX
    try:
        import ctypes
        _MUTEX = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\MultiMicMonitor_SerchTube")
        if not _MUTEX:
            return True
        return ctypes.windll.kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS
    except Exception:
        return True


def _instantanea_entradas():
    """Lista de entradas del sistema (para saber cuÃ¡ndo dejÃ³ de cambiar)."""
    try:
        return tuple((d["name"], d["hostapi"])
                     for d in sd.query_devices() if d["max_input_channels"] > 0)
    except Exception:
        return None


def _probar_entrada(idx: int, segundos: float = 1.5):
    """Abre una entrada un momento y devuelve (recibio_datos, pico).
    Sirve para saber si un dispositivo entrega audio DE VERDAD (no solo si abre)."""
    estado = {"n": 0, "pico": 0.0}

    def cb(indata, frames, time_info, status):
        estado["n"] += 1
        try:
            a = array("h")
            a.frombytes(bytes(indata))
            if a:
                pico = max(max(a), -min(a)) / 32768.0
                if pico > estado["pico"]:
                    estado["pico"] = pico
        except Exception:
            pass

    info = sd.query_devices(idx)
    rate = int(info["default_samplerate"])
    ch = max(1, min(int(info["max_input_channels"]), 2))
    s = sd.RawInputStream(device=idx, samplerate=rate, channels=ch,
                          dtype="int16", callback=cb)
    s.start()
    time.sleep(segundos)
    s.stop()
    s.close()
    return estado["n"] > 0, estado["pico"]


def calentar_motor_de_audio(segundos: float = 0.8) -> bool:
    """Abre y cierra el micrÃ³fono predeterminado para despertar el motor de audio de
    Windows antes de abrir los micrÃ³fonos reales (evita streams zombis).
    Devuelve True si ademÃ¡s llegaron datos: si no llegan, el motor de audio ya venÃ­a
    atascado (o el micrÃ³fono predeterminado no estÃ¡ disponible)."""
    try:
        idx = sd.default.device[0]
        if idx is None or int(idx) < 0:
            _log("Calentamiento: no hay micrÃ³fono predeterminado definido en Windows.")
            return False
        llego, pico = _probar_entrada(int(idx), max(0.4, segundos))
        if llego:
            _log(f"Calentamiento del motor de audio: OK (pico {pico:.3f}).")
        else:
            _log("Calentamiento del motor de audio: el micrÃ³fono predeterminado "
                 "NO entregÃ³ datos.")
        return llego
    except Exception as e:
        _log(f"Calentamiento del motor de audio: no se pudo ({e}).")
        return False


def _soltar_audio():
    """Suelta PortAudio al salir del programa (aunque se cierre de forma brusca)."""
    try:
        sd._terminate()
    except Exception:
        pass


import atexit  # noqa: E402

atexit.register(_soltar_audio)


# ---------------------------------------------------------------------------
# Audio (sin numpy: enteros de 16 bits con array/deque de la biblioteca estÃ¡ndar)
# ---------------------------------------------------------------------------
def to_mono(raw, ch: int) -> array:
    a = array("h")
    a.frombytes(bytes(raw))
    if ch == 1:
        return a
    return array("h", [(l + r) >> 1 for l, r in zip(a[0::2], a[1::2])])


class Ring:
    """Cola de trozos de audio entre la entrada y la salida."""

    def __init__(self, cap: int):
        self.q = deque()
        self.n = 0
        self.cap = cap
        self.lock = threading.Lock()

    def clear(self):
        with self.lock:
            self.q.clear()
            self.n = 0

    def write(self, a: array):
        with self.lock:
            self.q.append(a)
            self.n += len(a)
            while self.n > self.cap and self.q:  # desborde: descarta lo mÃ¡s viejo
                self.n -= len(self.q.popleft())

    def read(self, k: int, keep: int) -> array:
        with self.lock:
            while self.q and self.n - len(self.q[0]) >= keep:  # mantiene la latencia baja
                self.n -= len(self.q.popleft())
            out = array("h")
            while self.q and len(out) < k:
                c = self.q.popleft()
                need = k - len(out)
                if len(c) <= need:
                    out.extend(c)
                    self.n -= len(c)
                else:
                    out.extend(c[:need])
                    self.q.appendleft(c[need:])
                    self.n -= need
        if len(out) < k:  # falta audio: rellena con silencio
            out.extend(array("h", bytes((k - len(out)) * 2)))
        return out


class Mic:
    def __init__(self, index: int, info: dict, wasapi: bool):
        self.index = index
        self.info = info
        self.name = info["name"]
        self.max_ch = int(info["max_input_channels"])
        self.wasapi = wasapi
        self.gain = 1.0
        self.boost = 1.0          # refuerzo extra (factor lineal)
        self.level = 0.0          # pico acumulado entre refrescos del medidor
        self.last_cb = 0.0        # Ãºltima vez que llegÃ³ audio del dispositivo
        self.heard_at = 0.0       # Ãºltima vez que hubo seÃ±al audible
        self.retry_at = 0.0       # prÃ³xima ventana de reinicio automÃ¡tico (watchdog)
        self.hold = 0.0           # marcador de pico del medidor
        self.listening = False    # Â¿se envÃ­a a las bocinas?
        self.ratio = 1.0
        self.ch = 1
        self.keep = 0
        self.ring = None
        self.stream = None
        self.row = None           # fila de la interfaz asociada (para poder avisar)
        self.fail_count = 0       # fallos seguidos del dispositivo
        self.quarantined = False  # aislado: no se vuelve a abrir solo

    def _cb(self, indata, frames, time_info, status):
        try:
            now = time.time()
            self.last_cb = now
            x = to_mono(indata, self.ch)
            # Volumen y Boost se aplican AQUÃ, en la fuente: asÃ­ afectan al medidor
            # y a la mezcla aunque no estÃ©s usando "Escuchar" hacia las bocinas
            g = self.gain * self.boost
            if x and g != 1.0:
                x = array("h", [max(-32768, min(32767, int(s * g))) for s in x])
            if x:
                lvl = max(map(abs, x)) / 32768.0
                if lvl > self.level:
                    self.level = lvl
                if lvl > 0.01:
                    self.heard_at = now
            if not self.listening:  # activo pero silenciado: no se guarda nada
                return
            if self.ratio != 1.0 and len(x) > 1:  # remuestreo simple (solo como respaldo)
                n_out = max(1, int(len(x) * self.ratio))
                x = array("h", [x[min(len(x) - 1, int(i / self.ratio))] for i in range(n_out)])
            self.ring.write(x)
        except Exception:
            pass

    def start(self, out_rate: int):
        self.ring = Ring(out_rate * 2)
        self.keep = int(out_rate * 0.25)
        native = int(self.info["default_samplerate"])
        self.ch = max(1, min(self.max_ch, 2))

        attempts = []
        if self.wasapi:
            attempts.append((out_rate, sd.WasapiSettings(auto_convert=True)))
        attempts.append((out_rate, None))
        attempts.append((native, None))

        last = None
        for rate, extra in attempts:
            try:
                # Sin latency="low": en WASAPI compartido los buffers mÃ­nimos
                # provocan cortes y abren/cierran el motor de audio de mÃ¡s.
                self.ratio = out_rate / rate
                s = sd.RawInputStream(
                    device=self.index, samplerate=rate, channels=self.ch, dtype="int16",
                    extra_settings=extra, callback=self._cb,
                )
                try:
                    s.start()
                except Exception:
                    s.close()
                    raise
                self.last_cb = time.time()
                self.heard_at = 0.0
                self.level = 0.0
                self.hold = 0.0
                self.stream = s
                return
            except Exception as e:
                last = e
        raise last

    def stop(self):
        self.listening = False
        s, self.stream = self.stream, None
        if s:
            try:
                s.stop()
            finally:
                s.close()
        self.level = 0.0


# ---------------------------------------------------------------------------
# Interfaz (tema oscuro)
# ---------------------------------------------------------------------------
COL = dict(
    bg="#101114", card="#1a1c21", card2="#262a32", line="#2f343d",
    fg="#e8eaed", muted="#8b919c", accent="#4f8cff",
    green="#2ecc71", amber="#f5a623", red="#ef4444",
)
METER_H = 14
BOOST_STEPS = [0, 6, 12, 18]  # refuerzo extra en dB


def make_button(parent, text, command, bg=None, fg=None, width=None, bold=False):
    return tk.Button(
        parent, text=text, command=command, bg=bg or COL["card2"], fg=fg or COL["fg"],
        activebackground=COL["line"], activeforeground=COL["fg"],
        disabledforeground=COL["muted"], relief="flat", bd=0, highlightthickness=0,
        padx=12, pady=6, cursor="hand2", width=width,
        font=("Segoe UI", 9, "bold" if bold else "normal"),
    )


class Tooltip:
    """Globo de texto que aparece al pasar el cursor sobre un control."""

    def __init__(self, widget, text: str):
        self.widget = widget
        self.text = text
        self.balloon = None
        widget.bind("<Enter>", self._show, add="+")
        widget.bind("<Leave>", self._hide, add="+")
        widget.bind("<ButtonPress>", self._hide, add="+")

    def _show(self, _e=None):
        if self.balloon or not self.text:
            return
        x = self.widget.winfo_rootx() + 10
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 6
        self.balloon = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.attributes("-topmost", True)
        frame = tk.Frame(tw, bg=COL["accent"])
        lbl = tk.Label(
            frame, text=self.text, bg=COL["card2"], fg=COL["fg"],
            font=("Segoe UI", 9), justify="left", padx=8, pady=5,
            wraplength=340,
        )
        lbl.pack()
        frame.pack()
        tw.wm_geometry(f"+{x}+{y}")

    def _hide(self, _e=None):
        if self.balloon:
            try:
                self.balloon.destroy()
            except Exception:
                pass
            self.balloon = None


def tip(widget, text):
    """Adjunta un globo de texto a un control."""
    try:
        Tooltip(widget, text)
    except Exception:
        pass


CONFIG_PATH = os.path.join(
    os.environ.get("APPDATA") or os.path.expanduser("~"), "MultiMicMonitor", "config.json"
)


def load_config() -> dict:
    """Lee la configuraciÃ³n guardada (micrÃ³fonos con inicio automÃ¡tico, volÃºmenes, salida)."""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        if isinstance(cfg, dict) and isinstance(cfg.get("mics"), dict):
            return cfg
    except (OSError, ValueError):
        pass
    return {"output": "", "mics": {}}


def save_config(cfg: dict):
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        tmp = CONFIG_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CONFIG_PATH)
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Inicio con Windows (clave Run del usuario actual; no requiere administrador)
# ---------------------------------------------------------------------------
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_NAME = "MultiMicMonitor"
STARTUP_LAUNCH = "--inicio" in sys.argv       # lo lanzÃ³ Windows al iniciar sesiÃ³n
START_MINIMIZED = "--minimizado" in sys.argv


def _startup_command(minimized: bool) -> str:
    py = sys.executable
    pyw = os.path.join(os.path.dirname(py), "pythonw.exe")  # sin ventana de consola
    if os.path.exists(pyw):
        py = pyw
    cmd = f'"{py}" "{os.path.abspath(__file__)}" --inicio'
    return cmd + " --minimizado" if minimized else cmd


def startup_enabled() -> bool:
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_READ) as k:
            winreg.QueryValueEx(k, RUN_NAME)
        return True
    except Exception:
        return False


def set_startup(enable: bool, minimized: bool):
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
        if enable:
            winreg.SetValueEx(k, RUN_NAME, 0, winreg.REG_SZ, _startup_command(minimized))
        else:
            try:
                winreg.DeleteValue(k, RUN_NAME)
            except FileNotFoundError:
                pass


def make_check(parent, text, variable, command):
    return tk.Checkbutton(
        parent, text=text, variable=variable, command=command,
        bg=COL["bg"], fg=COL["muted"], activebackground=COL["bg"],
        activeforeground=COL["fg"], selectcolor=COL["card2"],
        font=("Segoe UI", 9), bd=0, highlightthickness=0, cursor="hand2",
    )


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Multi Mic Monitor")
        self.geometry("700x640")
        self.minsize(640, 460)

        self.rows = []
        self.active_mics = []   # micrÃ³fonos abiertos (con medidor)
        self.listen_mics = []   # micrÃ³fonos que suenan en la salida
        self.out_stream = None
        self.out_rate = 48000
        self.out_ch = 2
        self.out_devs = []      # (Ã­ndice, nombre)
        self.out_var = tk.StringVar()
        self.cfg = load_config()
        self._boot_retries = 0
        self._save_job = None
        # Ajustes (configurables en config.json para adaptarse a cada equipo)
        self.seg_espera_audio = _ajuste(self.cfg, "seg_espera_audio")
        self.seg_comprobar_datos = _ajuste(self.cfg, "seg_comprobar_datos")
        self.intentos_comprobar = _ajuste(self.cfg, "intentos_comprobar")
        self.max_fallos = _ajuste(self.cfg, "max_fallos")
        self.seg_modo_seguro = _ajuste(self.cfg, "seg_modo_seguro")
        self.dias_cuarentena = _ajuste(self.cfg, "dias_cuarentena")
        self.virtual_extra = _ajuste(self.cfg, "virtual_extra")
        # estado de la apertura en serie / modo seguro
        self._cola_auto = []
        self._errores_auto = []
        self._audio_snap = None
        self._audio_estable = 0
        self._audio_espera = 0
        self._safe_until = 0.0
        self.startup_var = tk.BooleanVar(value=startup_enabled())
        self.min_var = tk.BooleanVar(value=bool(self.cfg.get("minimized", False)))
        self.rl_var = tk.BooleanVar(value=bool(self.cfg.get("remember_listen", False)))
        self.virt_var = tk.BooleanVar(value=bool(self.cfg.get("abrir_virtuales", False)))
        self.master_gain = float(self.cfg.get("master_gain", 1.0))   # volumen maestro de la mezcla
        self.ontop_var = tk.BooleanVar(value=bool(self.cfg.get("always_on_top", False)))
        if self.startup_var.get():  # mantiene al dÃ­a la ruta registrada si moviste el archivo
            try:
                set_startup(True, self.min_var.get())
            except Exception:
                pass

        self._setup_style()
        self._build_ui()
        self._apply_ontop()
        self.refresh_devices()
        self._dark_titlebar()
        # Al iniciar sesiÃ³n Windows, el audio puede tardar en estar listo: se espera un poco
        self.after(8000 if STARTUP_LAUNCH else 400, self._autostart_boot)
        self.after(80, self._tick)
        if START_MINIMIZED:
            self.iconify()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ---------- Estilo ----------
    def _setup_style(self):
        self.configure(bg=COL["bg"])
        st = ttk.Style(self)
        st.theme_use("clam")
        st.configure("TCombobox", fieldbackground=COL["card2"], background=COL["card2"],
                     foreground=COL["fg"], arrowcolor=COL["fg"], bordercolor=COL["line"],
                     lightcolor=COL["card2"], darkcolor=COL["card2"])
        st.map("TCombobox",
               fieldbackground=[("readonly", COL["card2"]), ("disabled", COL["card"])],
               foreground=[("readonly", COL["fg"]), ("disabled", COL["muted"])],
               background=[("readonly", COL["card2"])],
               selectbackground=[("readonly", COL["card2"])],
               selectforeground=[("readonly", COL["fg"])])
        self.option_add("*TCombobox*Listbox.background", COL["card2"])
        self.option_add("*TCombobox*Listbox.foreground", COL["fg"])
        self.option_add("*TCombobox*Listbox.selectBackground", COL["accent"])
        self.option_add("*TCombobox*Listbox.selectForeground", "#ffffff")
        st.configure("Horizontal.TScale", background=COL["card"], troughcolor=COL["line"],
                     bordercolor=COL["card"], lightcolor=COL["accent"], darkcolor=COL["accent"])
        st.configure("Vertical.TScrollbar", background=COL["card2"], troughcolor=COL["bg"],
                     bordercolor=COL["bg"], arrowcolor=COL["fg"],
                     lightcolor=COL["card2"], darkcolor=COL["card2"])

    def _dark_titlebar(self):
        """Barra de tÃ­tulo oscura en Windows 10/11 (si estÃ¡ disponible)."""
        try:
            import ctypes
            self.update()
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            val = ctypes.c_int(1)
            for attr in (20, 19):
                ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, attr, ctypes.byref(val), 4)
        except Exception:
            pass

    # ---------- UI ----------
    def _build_ui(self):
        bg = COL["bg"]
        top = tk.Frame(self, bg=bg)
        top.pack(fill="x", padx=14, pady=(14, 4))
        tk.Label(top, text="Multi Mic Monitor", bg=bg, fg=COL["fg"],
                 font=("Segoe UI", 15, "bold")).pack(side="left")
        self.btn_refresh = make_button(top, "â†» Actualizar", self.refresh_devices)
        self.btn_refresh.pack(side="right")
        tip(self.btn_refresh, "Vuelve a leer la lista de micrÃ³fonos y salidas. Ãšsalo despuÃ©s de conectar o desconectar un dispositivo. (Se desactiva mientras hay mics activos.)")

        out = tk.Frame(self, bg=bg)
        out.pack(fill="x", padx=14, pady=6)
        tk.Label(out, text="Salida de audio:", bg=bg, fg=COL["muted"],
                 font=("Segoe UI", 9)).pack(side="left")
        self.combo = ttk.Combobox(out, textvariable=self.out_var, state="readonly")
        self.combo.pack(side="left", fill="x", expand=True, padx=8)
        tip(self.combo, "Por dÃ³nde se oye la mezcla. Para que el asistente escuche TODOS tus mics: elige 'CABLE Input' (requiere VB-Cable) y pon 'CABLE Output' como micrÃ³fono predeterminado de Windows. El botÃ³n 'GuÃ­a Asistente' te ayuda.")
        self.combo.bind("<<ComboboxSelected>>", lambda e: self._remember())

        tk.Label(
            self, bg=bg, fg=COL["muted"], font=("Segoe UI", 9), anchor="w", justify="left",
            text="â» Activar = abre el micrÃ³fono y muestra su barra (no se oye).   "
                 "ðŸ”Š Escuchar = lo manda a tus bocinas.\n"
                 "Para comprobar que funciona: actÃ­valo y habla cerca; la barra debe moverse.",
        ).pack(fill="x", padx=14, pady=(0, 4))

        box = tk.Frame(self, bg=bg)
        box.pack(fill="both", expand=True, padx=14, pady=4)
        self.canvas = tk.Canvas(box, highlightthickness=0, bg=bg)
        sb = ttk.Scrollbar(box, orient="vertical", command=self.canvas.yview)
        self.list_frame = tk.Frame(self.canvas, bg=bg)
        self.list_frame.bind(
            "<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.win = self.canvas.create_window((0, 0), window=self.list_frame, anchor="nw")
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(self.win, width=e.width))
        self.canvas.configure(yscrollcommand=sb.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        self.bind_all("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-e.delta / 120), "units"))

        bottom = tk.Frame(self, bg=bg)
        bottom.pack(fill="x", padx=14, pady=(4, 4))
        b_at = make_button(bottom, "Activar todos", self.activate_all); b_at.pack(side="left")
        tip(b_at, "Abre TODOS los micrÃ³fonos de la lista (medidor funcionando y listos para la mezcla). No se oye nada en las bocinas.")
        b_dt = make_button(bottom, "Desactivar todos", self.deactivate_all); b_dt.pack(side="left", padx=6)
        tip(b_dt, "Cierra todos los micrÃ³fonos abiertos y libera los dispositivos.")
        b_mut = make_button(bottom, "ðŸ”‡ Silenciar todos", self.mute_all, bg="#3a2226"); b_mut.pack(side="left")
        tip(b_mut, "Quita el sonido de la mezcla hacia las bocinas/cable, pero deja los mics abiertos (los medidores siguen activos).")
        b_diag = make_button(bottom, "â„¹ DiagnÃ³stico", self.show_diag); b_diag.pack(side="right")
        tip(b_diag, "Datos tÃ©cnicos: versiÃ³n de Python, librerÃ­a de audio, dispositivos detectados. Ãštil si algo no funciona.")
        b_fix = make_button(bottom, "ðŸ›  Reparar audio", self.reparar_audio, bg="#3a2f16")
        b_fix.pack(side="right", padx=6)
        tip(b_fix, "Si los micrÃ³fonos dejaron de registrar volumen, reinicia el servicio de audio de Windows (pide permiso de administrador). AsÃ­ no tenÃ©s que reiniciar la PC.")
        b_guia = make_button(bottom, "ðŸŽ™ GuÃ­a Asistente (VB-Cable)", self.show_assistant_guide, bg="#12324f"); b_guia.pack(side="right", padx=6)
        tip(b_guia, "Pasos para que SerchTube escuche TODOS tus mics a la vez usando el cable virtual. Si VB-Cable ya estÃ¡ instalado, te ofrece poner la salida con un clic.")

        opts = tk.Frame(self, bg=bg)
        opts.pack(fill="x", padx=14, pady=(2, 0))
        c_sw = make_check(opts, "Iniciar con Windows", self.startup_var, self._on_startup_change); c_sw.pack(side="left")
        tip(c_sw, "Abre este programa automÃ¡ticamente cada vez que enciendas la PC (recomendado para el asistente).")
        c_min = make_check(opts, "Iniciar minimizado", self.min_var, self._on_startup_change); c_min.pack(side="left", padx=14)
        tip(c_min, "Al arrancar con Windows, abre la ventana minimizada sin estorbar.")
        opts2 = tk.Frame(self, bg=bg)
        opts2.pack(fill="x", padx=14, pady=(0, 0))
        c_rl = make_check(opts2, "Recordar quÃ© micrÃ³fonos se escuchan (cuidado con las bocinas)",
                   self.rl_var, self._remember); c_rl.pack(side="left")
        tip(c_rl, "Guarda quÃ© mics estaban mandando sonido y los reactiva al abrir. CUIDADO: si estaban conectados a bocinas reales, puede generarse eco.")

        opts3 = tk.Frame(self, bg=bg)
        opts3.pack(fill="x", padx=14, pady=(2, 0))
        c_top = make_check(opts3, "ðŸ“Œ Siempre visible", self.ontop_var, self._on_ontop_change); c_top.pack(side="left")
        tip(c_top, "Mantiene esta ventana por encima de las demÃ¡s (Ãºtil mientras calibras micrÃ³fonos).")
        tk.Label(opts3, text="Vol. maestro de la mezcla:", bg=bg, fg=COL["muted"],
                 font=("Segoe UI", 9)).pack(side="left", padx=(14, 4))
        self.master_var = tk.DoubleVar(value=self.master_gain)
        sc_master = ttk.Scale(opts3, from_=0.0, to=2.0, value=self.master_gain,
                  command=self._on_master_gain)
        sc_master.pack(side="left", fill="x", expand=True)
        tip(sc_master, "Volumen general de TODA la mezcla que sale hacia las bocinas o el cable (100% = sin cambio).")
        self.master_lbl = tk.Label(opts3, text=f"{int(self.master_gain * 100)}%", bg=bg,
                                   fg=COL["fg"], font=("Segoe UI", 9, "bold"), width=5)
        self.master_lbl.pack(side="left", padx=(6, 0))

        opts4 = tk.Frame(self, bg=bg)
        opts4.pack(fill="x", padx=14, pady=(0, 0))
        c_virt = make_check(opts4, "ðŸŽ› Abrir dispositivos virtuales al iniciar con Windows",
                            self.virt_var, self._remember)
        c_virt.pack(side="left")
        tip(c_virt, "Los dispositivos virtuales (Steam Streaming, VB-Cable, Voicemeeter, Sunshineâ€¦) muchas veces no estÃ¡n listos al encender la PC: abrirlos ahÃ­ es lo que dejaba los micrÃ³fonos sin volumen. Dejalo DESMARCADO salvo que los necesites en el arranque. Igual podÃ©s abrirlos a mano cuando quieras.")

        self.status = tk.Label(self, text="Todo apagado.", bg=bg, fg=COL["muted"],
                               font=("Segoe UI", 9), anchor="w")
        self.status.pack(fill="x", padx=14, pady=(2, 10))
    # ---------- Dispositivos ----------
    def refresh_devices(self):
        if self.active_mics:
            return
        if self.out_stream is None:
            # Releer dispositivos con PortAudio SOLO si no hay ningÃºn stream abierto:
            # terminar/reiniciar PortAudio con streams vivos deja WASAPI colgado.
            try:
                sd._terminate()
                sd._initialize()
            except Exception:
                pass

        for w in self.list_frame.winfo_children():
            w.destroy()
        self.rows.clear()

        hostapis = sd.query_hostapis()
        wasapi_idx = next((i for i, h in enumerate(hostapis) if "WASAPI" in h["name"]), None)
        target = wasapi_idx if wasapi_idx is not None else sd.default.hostapi

        devices = sd.query_devices()
        self.out_devs = [
            (i, d["name"]) for i, d in enumerate(devices)
            if d["max_output_channels"] > 0 and d["hostapi"] == target
        ]
        names = [n for _, n in self.out_devs]
        self.combo["values"] = names
        default_out = sd.default.device[1]
        sel = next((n for i, n in self.out_devs if i == default_out), names[0] if names else "")
        if self.cfg.get("output") in names:
            sel = self.cfg["output"]
        self.out_var.set(sel)

        found = False
        for i, dev in enumerate(devices):
            if dev["max_input_channels"] > 0 and dev["hostapi"] == target:
                found = True
                self._add_row(Mic(i, dev, wasapi_idx is not None))
        if not found:
            tk.Label(self.list_frame, text="No se encontraron micrÃ³fonos.", bg=COL["bg"],
                     fg=COL["muted"]).pack(pady=20)
        self._after_change()

    def _add_row(self, mic: Mic):
        c = COL["card"]
        saved = self.cfg["mics"].get(mic.name, {})
        mic.gain = float(saved.get("gain", 1.0))
        boost_i = int(saved.get("boost", 0))
        if not 0 <= boost_i < len(BOOST_STEPS):
            boost_i = 0
        mic.boost = 10 ** (BOOST_STEPS[boost_i] / 20)
        alias = str(saved.get("alias", "") or "")

        card = tk.Frame(self.list_frame, bg=c, padx=12, pady=10)
        card.pack(fill="x", pady=5, padx=(0, 6))

        # --- Fila 1: nombre (editable), estado, inicio automÃ¡tico ---
        head = tk.Frame(card, bg=c)
        head.pack(fill="x")
        name_lbl = tk.Label(head, text=alias or bonito(mic.name), bg=c, fg=COL["fg"], anchor="w",
                            font=("Segoe UI", 10, "bold"))
        name_lbl.pack(side="left")
        edit_btn = tk.Label(head, text="âœŽ", bg=c, fg=COL["muted"], cursor="hand2",
                            font=("Segoe UI", 10))
        edit_btn.pack(side="left", padx=6)
        status = tk.Label(head, text="Apagado", bg=c, fg=COL["muted"], font=("Segoe UI", 9))
        status.pack(side="right")
        auto_var = tk.BooleanVar(value=bool(saved.get("auto", True)))
        chk_auto = tk.Checkbutton(
            head, text="Iniciar al abrir", variable=auto_var, command=self._remember,
            bg=c, fg=COL["muted"], activebackground=c, activeforeground=COL["fg"],
            selectcolor=COL["card2"], font=("Segoe UI", 9), bd=0, highlightthickness=0,
            cursor="hand2",
        )
        chk_auto.pack(side="right", padx=14)
        tip(chk_auto, "Si estÃ¡ marcado, este micrÃ³fono se activa solo cada vez que abres el programa (o enciendes la PC).")

        row = {
            "mic": mic, "status": status, "status_txt": "", "auto": auto_var,
            "alias": alias, "boost_i": boost_i, "want_listen": bool(saved.get("listen", False)),
            "head": head, "name_lbl": name_lbl, "edit_btn": edit_btn, "editing": False,
            "virtual": es_virtual(mic.name, self.virtual_extra),
        }
        mic.row = row
        # Si este dispositivo ya fallÃ³ antes, no se vuelve a abrir solo hasta que
        # el usuario lo pida a mano (asÃ­ un driver roto no vuelve a dejar el audio mudo).
        # El aislamiento caduca solo: si actualizÃ¡s el driver, se reintenta.
        cuarentena = self.cfg.get("cuarentena")
        if isinstance(cuarentena, dict) and mic.name in cuarentena:
            info_cuar = cuarentena[mic.name]
            cuando = info_cuar.get("cuando", 0) if isinstance(info_cuar, dict) else 0
            dias = (time.time() - float(cuando or 0)) / 86400.0
            if dias <= self.dias_cuarentena:
                mic.quarantined = True
                auto_var.set(False)
                motivo = info_cuar.get("motivo", "fallÃ³ antes") if isinstance(info_cuar, dict) else "fallÃ³ antes"
                status.config(text=f"âš  Aislado: {motivo}", fg=COL["amber"])
            else:
                cuarentena.pop(mic.name, None)
                _log(f"El aislamiento de '{mic.name}' caducÃ³ tras {dias:.1f} dÃ­as: se vuelve a intentar.")
        edit_btn.bind("<Button-1>", lambda e, r=row: self._rename(r))
        name_lbl.bind("<Double-Button-1>", lambda e, r=row: self._rename(r))
        tip(name_lbl, "Nombre real del dispositivo. Doble clic (o la âœŽ) para ponerle un apodo, ej: 'Micro cocina'.")

        # --- Fila 2: botones y volumen ---
        ctl = tk.Frame(card, bg=c)
        ctl.pack(fill="x", pady=(8, 0))
        btn_act = make_button(ctl, "â»  Activar", lambda r=row: self.on_active_toggle(r), width=11)
        btn_act.pack(side="left")
        tip(btn_act, "Abre este micrÃ³fono: su medidor empieza a funcionar y su audio entra a la mezcla. No se oye en las bocinas a menos que actives 'Escuchar'.")
        btn_lis = make_button(ctl, "ðŸ”‡ Silenciado", lambda r=row: self.on_listen_toggle(r), width=13)
        btn_lis.config(state="disabled")
        btn_lis.pack(side="left", padx=6)
        tip(btn_lis, "Escuchar = este mic se oye por la salida elegida. Para el asistente con VB-Cable NO hace falta: con 'Activar' basta.")
        btn_boost = make_button(ctl, "", lambda r=row: self._cycle_boost(r), width=14)
        btn_boost.pack(side="left")
        tip(btn_boost, "Refuerzo extra de ganancia en pasos de +6 dB para mics flojos. Mira el medidor: si llega al rojo, baja un paso o se distorsiona.")
        tk.Label(ctl, text="Vol", bg=c, fg=COL["muted"], font=("Segoe UI", 9)).pack(side="left", padx=(12, 2))
        vol = ttk.Scale(ctl, from_=0.0, to=2.0, value=mic.gain,
                        command=lambda v, m=mic: self._on_gain(m, v))
        vol.pack(side="left", fill="x", expand=True)
        tip(vol, "Volumen de ESTE micrÃ³fono dentro de la mezcla (0% a 200%). Se guarda solo.")

        # --- Fila 3: medidor de nivel ---
        mrow = tk.Frame(card, bg=c)
        mrow.pack(fill="x", pady=(8, 0))
        db = tk.Label(mrow, text="", bg=c, fg=COL["muted"], width=8, font=("Consolas", 9))
        db.pack(side="right")
        meter = tk.Canvas(mrow, height=METER_H, bg=COL["line"], highlightthickness=0)
        meter.pack(side="left", fill="x", expand=True, padx=(0, 8))
        bar_id = meter.create_rectangle(0, 0, 0, METER_H, fill=COL["green"], width=0)
        hold_id = meter.create_line(0, 0, 0, METER_H, fill="#ffffff", width=2)

        row.update(btn_act=btn_act, btn_lis=btn_lis, btn_boost=btn_boost,
                   meter=meter, bar=bar_id, hold=hold_id, db=db)
        self._style_boost(row)
        self.rows.append(row)

    def _display(self, row: dict) -> str:
        return row["alias"] or bonito(row["mic"].name)

    def _style_boost(self, row: dict):
        extra = BOOST_STEPS[row["boost_i"]]
        if extra:
            row["btn_boost"].config(text=f"ðŸš€ Boost +{extra} dB", bg=COL["amber"], fg="#1a1204")
        else:
            row["btn_boost"].config(text="ðŸš€ Boost: Off", bg=COL["card2"], fg=COL["fg"])

    def _cycle_boost(self, row: dict):
        row["boost_i"] = (row["boost_i"] + 1) % len(BOOST_STEPS)
        row["mic"].boost = 10 ** (BOOST_STEPS[row["boost_i"]] / 20)
        self._style_boost(row)
        self._remember()

    def _rename(self, row: dict):
        """Edita el nombre que se muestra (Enter guarda, Esc cancela, vacÃ­o = nombre original)."""
        if row["editing"]:
            return
        row["editing"] = True
        mic, lbl, btn = row["mic"], row["name_lbl"], row["edit_btn"]
        entry = tk.Entry(row["head"], bg=COL["card2"], fg=COL["fg"], insertbackground=COL["fg"],
                         relief="flat", font=("Segoe UI", 10, "bold"), width=30)
        entry.insert(0, self._display(row))
        lbl.pack_forget()
        btn.pack_forget()
        entry.pack(side="left")
        entry.focus_set()
        entry.select_range(0, "end")

        def done(save: bool):
            if not row["editing"]:
                return
            row["editing"] = False
            if save:
                text = entry.get().strip()
                row["alias"] = "" if text in ("", mic.name) else text
            entry.destroy()
            lbl.config(text=self._display(row))
            lbl.pack(side="left")
            btn.pack(side="left", padx=6)
            self._remember()

        entry.bind("<Return>", lambda e: done(True))
        entry.bind("<Escape>", lambda e: done(False))
        entry.bind("<FocusOut>", lambda e: done(True))

    # ---------- Salida de audio ----------
    def _selected_out(self):
        idx = next((i for i, n in self.out_devs if n == self.out_var.get()), None)
        if idx is None:
            return None
        return idx, sd.query_devices(idx)

    def _ensure_output(self) -> bool:
        if self.out_stream:
            return True
        sel = self._selected_out()
        if sel is None:
            messagebox.showerror("Error", "Selecciona una salida de audio.")
            return False
        idx, info = sel
        self.out_rate = int(info["default_samplerate"])
        self.out_ch = max(1, min(int(info["max_output_channels"]), 2))
        wasapi = "WASAPI" in sd.query_hostapis(info["hostapi"])["name"]

        last = None
        for extra in ([sd.WasapiSettings(auto_convert=True)] if wasapi else []) + [None]:
            try:
                s = sd.RawOutputStream(
                    device=idx, samplerate=self.out_rate, channels=self.out_ch, dtype="int16",
                    latency="low", extra_settings=extra, callback=self._out_cb,
                )
                s.start()
                self.out_stream = s
                return True
            except Exception as e:
                last = e
        messagebox.showerror("Error al abrir la salida", str(last))
        return False

    def _out_cb(self, outdata, frames, time_info, status):
        try:
            mics = self.listen_mics  # lista reemplazada completa al cambiar: seguro entre hilos
            if not mics:
                outdata[:] = bytes(len(outdata))
                return
            mix = [0] * frames
            for m in mics:
                if m.ring is None:
                    continue
                chunk = m.ring.read(frames, m.keep)
                # El volumen y boost de cada micro ya se aplicaron en la fuente (_cb);
                # aquÃ­ solo entra el volumen maestro de la mezcla
                g = self.master_gain
                mix = [a + int(b * g) for a, b in zip(mix, chunk)]
            peak = max(max(mix), -min(mix))
            if peak > 32767:  # limitador: baja el bloque en vez de recortarlo (menos distorsiÃ³n)
                f = 32767.0 / peak
                mix = [int(s * f) for s in mix]
            mono = array("h", [32767 if s > 32767 else -32768 if s < -32768 else s for s in mix])
            if self.out_ch == 2:
                out = array("h", bytes(frames * 4))
                out[0::2] = mono
                out[1::2] = mono
            else:
                out = mono
            outdata[:] = out.tobytes()
        except Exception:
            outdata[:] = bytes(len(outdata))

    def _after_change(self):
        if not self.listen_mics and self.out_stream:
            s, self.out_stream = self.out_stream, None
            try:
                s.stop()
            finally:
                s.close()
        busy = bool(self.active_mics)
        self.combo.config(state="disabled" if busy else "readonly")
        self.btn_refresh.config(state="disabled" if busy else "normal")
        if busy:
            self.status.config(
                text=f"{len(self.active_mics)} micrÃ³fono(s) activo(s) Â· "
                     f"{len(self.listen_mics)} escuchÃ¡ndose. "
                     "(Desactiva todos para cambiar la salida.)")
        else:
            self.status.config(text="Todo apagado.")

    # ---------- Interruptores ----------
    def _set_listening(self, row: dict, on: bool) -> bool:
        mic = row["mic"]
        if on:
            if not self._ensure_output():
                return False
            mic.ring.clear()
            mic.listening = True
            self.listen_mics = self.listen_mics + [mic]
            row["btn_lis"].config(text="ðŸ”Š Escuchando", bg=COL["accent"], fg="#ffffff")
        else:
            mic.listening = False
            self.listen_mics = [m for m in self.listen_mics if m is not mic]
            row["btn_lis"].config(text="ðŸ”‡ Silenciado", bg=COL["card2"], fg=COL["fg"])
        return True

    def _activate(self, row: dict):
        """Abre el micrÃ³fono. Devuelve None si saliÃ³ bien, o el texto del error."""
        mic = row["mic"]
        if not self.active_mics:
            sel = self._selected_out()
            if sel is None:
                return "Selecciona una salida de audio."
            self.out_rate = int(sel[1]["default_samplerate"])
        try:
            mic.start(self.out_rate)
        except Exception as e:
            return str(e)
        self.active_mics = self.active_mics + [mic]
        row["btn_act"].config(text="â»  Activo", bg=COL["green"], fg="#08160d")
        row["btn_lis"].config(state="normal")
        return None

    def on_active_toggle(self, row: dict):
        mic = row["mic"]
        if mic.stream is None:  # activar
            # El usuario lo pide a mano: se quita el aislamiento y se reintenta limpio
            mic.quarantined = False
            mic.fail_count = 0
            mic.retry_at = 0.0
            cuar = self.cfg.get("cuarentena")
            if isinstance(cuar, dict):
                cuar.pop(mic.name, None)
            err = self._activate(row)
            if err:
                messagebox.showerror(
                    "No se pudo abrir el micrÃ³fono",
                    f"{err}\n\nRevisa que Windows permita el acceso al micrÃ³fono a las "
                    "aplicaciones de escritorio (ConfiguraciÃ³n > Privacidad > MicrÃ³fono).",
                )
                return
        else:  # desactivar
            if mic.listening:
                self._set_listening(row, False)
            row["want_listen"] = False
            self.active_mics = [m for m in self.active_mics if m is not mic]
            mic.stop()
            row["btn_act"].config(text="â»  Activar", bg=COL["card2"], fg=COL["fg"])
            row["btn_lis"].config(state="disabled", text="ðŸ”‡ Silenciado", bg=COL["card2"], fg=COL["fg"])
        self._after_change()

    def on_listen_toggle(self, row: dict):
        mic = row["mic"]
        if mic.stream is None:
            return
        self._set_listening(row, not mic.listening)
        row["want_listen"] = mic.listening
        self._after_change()
        self._remember()

    def activate_all(self):
        for row in self.rows:
            if row["mic"].stream is None:
                self.on_active_toggle(row)

    def deactivate_all(self):
        for row in self.rows:
            if row["mic"].stream is not None:
                self.on_active_toggle(row)

    def mute_all(self):
        for row in self.rows:
            if row["mic"].listening:
                self._set_listening(row, False)
            row["want_listen"] = False
        self._after_change()
        self._remember()

    # ---------- Inicio automÃ¡tico (seguro) y configuraciÃ³n ----------
    def _autostart_boot(self):
        if STARTUP_LAUNCH:
            _log("Arranque con Windows: esperando a que el audio estÃ© listo...")
            self._audio_snap = None
            self._audio_estable = 0
            self._audio_espera = 0
            self._esperar_audio_y_arrancar()
        else:
            self._autostart()

    def _esperar_audio_y_arrancar(self):
        """Sin bloquear la ventana: espera a que la lista de entradas deje de cambiar."""
        snap = _instantanea_entradas()
        if snap and snap == self._audio_snap:
            self._audio_estable += 1
        else:
            self._audio_estable = 0
        self._audio_snap = snap
        self._audio_espera += 1
        limite = max(4, int(self.seg_espera_audio / 1.5))
        if (snap and self._audio_estable >= 2) or self._audio_espera > limite:
            _log(f"Audio estable tras {self._audio_espera * 1.5:.0f}s "
                 f"({len(snap) if snap else 0} entradas).")
            self.refresh_devices()
            if not calentar_motor_de_audio():
                _log("AVISO: el micrÃ³fono predeterminado no entregÃ³ datos. El motor de audio "
                     "podrÃ­a estar atascado: probÃ¡ 'ðŸ›  Reparar audio' o revisa el micrÃ³fono "
                     "predeterminado de Windows.")
                self.status.config(
                    text="âš  El audio de Windows no responde: probÃ¡ 'ðŸ›  Reparar audio'",
                    fg=COL["red"])
            self._autostart()
            return
        self.status.config(
            text=f"Esperando a que Windows termine de cargar el audioâ€¦ ({int(self._audio_espera * 1.5)}s)",
            fg=COL["amber"])
        self.after(1500, self._esperar_audio_y_arrancar)

    def _on_startup_change(self):
        try:
            if self.startup_var.get():
                set_startup(True, self.min_var.get())
            else:
                set_startup(False, self.min_var.get())
        except Exception as e:
            self.startup_var.set(startup_enabled())
            messagebox.showerror("No se pudo cambiar el inicio con Windows", str(e))
        self._remember()

    def _autostart(self):
        """Abre los micrÃ³fonos marcados 'Iniciar al abrir' DE A UNO y comprobando
        que entregan datos: abrirlos todos a la vez es lo que atasca el motor de
        audio de Windows cuando la PC acaba de encender."""
        self._errores_auto = []
        self._cola_auto = []
        for row in self.rows:
            if not row["auto"].get() or row["mic"].stream is not None:
                continue
            mic = row["mic"]
            if mic.quarantined:
                self._set_status(row, "âš  Aislado: no se abre solo", COL["amber"])
                continue
            if STARTUP_LAUNCH and not self.virt_var.get() and row.get("virtual"):
                _log(f"No se abre '{mic.name}' al iniciar: dispositivo virtual "
                     "(su driver no estÃ¡ listo al encender la PC).")
                self._set_status(row, "ðŸŽ› Virtual: no se abre al iniciar", COL["muted"])
                continue
            self._cola_auto.append(row)
        if self._cola_auto:
            _log("Abriendo de a uno: " + ", ".join(r["mic"].name for r in self._cola_auto))
        self._abrir_siguiente()

    def _abrir_siguiente(self):
        if not self._cola_auto:
            self._after_change()
            self._avisar_errores_auto()
            return
        row = self._cola_auto.pop(0)
        err = self._activate(row)
        if err:
            self._errores_auto.append(f"- {self._display(row)}: {err}")
            _log(f"No se pudo abrir '{row['mic'].name}': {err}")
            self.after(700, self._abrir_siguiente)
            return
        self._set_status(row, "â— Comprobandoâ€¦", COL["amber"])
        self._comprobar_arranque(row, 0)

    def _comprobar_arranque(self, row, intentos: int):
        """Confirma que el micrÃ³fono entrega datos ANTES de abrir el siguiente."""
        mic = row["mic"]
        if mic.stream is None or mic.quarantined:
            self.after(400, self._abrir_siguiente)
            return
        if time.time() - mic.last_cb < self.seg_comprobar_datos:
            if self.rl_var.get() and row["want_listen"]:
                self._set_listening(row, True)
            self.after(1200, self._abrir_siguiente)
            return
        if intentos >= self.intentos_comprobar:   # sin datos: cerrar y aislar
            self._cerrar_mic(row, "no entregÃ³ datos al abrir")
            self.after(900, self._abrir_siguiente)
            return
        self.after(int(self.seg_comprobar_datos * 1000),
                   lambda: self._comprobar_arranque(row, intentos + 1))

    def _avisar_errores_auto(self):
        errores = getattr(self, "_errores_auto", [])
        if not errores:
            return
        if STARTUP_LAUNCH:
            _log("MicrÃ³fonos que no se pudieron abrir al iniciar:\n" + "\n".join(errores))
            self.status.config(text="âš  Algunos micrÃ³fonos no se abrieron: mira DiagnÃ³stico",
                               fg=COL["amber"])
        else:
            messagebox.showwarning(
                "Algunos micrÃ³fonos no se pudieron abrir",
                "\n".join(errores) + "\n\nRevisa que Windows permita el acceso al micrÃ³fono "
                "(ConfiguraciÃ³n > Privacidad > MicrÃ³fono) y que ningÃºn otro programa lo use.",
            )

    def _cerrar_mic(self, row, motivo: str):
        mic = row["mic"]
        try:
            mic.stop()
        except Exception:
            pass
        self.active_mics = [m for m in self.active_mics if m is not mic]
        self.listen_mics = [m for m in self.listen_mics if m is not mic]
        try:
            row["btn_act"].config(text="â»  Activar", bg=COL["card2"], fg=COL["fg"])
            row["btn_lis"].config(state="disabled", text="ðŸ”‡ Silenciado",
                                  bg=COL["card2"], fg=COL["fg"])
        except Exception:
            pass
        self._cuarentena(row, motivo)

    def _cuarentena(self, row, motivo: str):
        """AÃ­sla un dispositivo problemÃ¡tico para que no vuelva a tumbar el audio."""
        mic = row["mic"]
        mic.quarantined = True
        mic.fail_count = max(mic.fail_count, self.max_fallos)
        try:
            row["auto"].set(False)
        except Exception:
            pass
        self._set_status(row, "âš  Desactivado: " + motivo, COL["red"])
        cuar = self.cfg.get("cuarentena")
        if not isinstance(cuar, dict):
            cuar = {}
            self.cfg["cuarentena"] = cuar
        cuar[mic.name] = {"motivo": motivo, "cuando": time.time()}
        self._remember()
        _log(f"Mic aislado '{mic.name}': {motivo}. No se abrirÃ¡ solo; "
             "actÃ­valo a mano y revisa cable, permisos o driver.")

    def _on_gain(self, mic: Mic, value):
        mic.gain = float(value)
        self._remember()

    def _remember(self):
        """Guarda (con un pequeÃ±o retraso) quÃ© micrÃ³fonos inician solos, volÃºmenes y salida."""
        for row in self.rows:
            self.cfg["mics"][row["mic"].name] = {
                "auto": bool(row["auto"].get()),
                "gain": round(row["mic"].gain, 2),
                "boost": row["boost_i"],
                "alias": row["alias"],
                "listen": bool(row["want_listen"]),
            }
        self.cfg["output"] = self.out_var.get()
        self.cfg["minimized"] = bool(self.min_var.get())
        self.cfg["remember_listen"] = bool(self.rl_var.get())
        self.cfg["abrir_virtuales"] = bool(self.virt_var.get())
        self.cfg["master_gain"] = round(self.master_gain, 2)
        self.cfg["always_on_top"] = bool(self.ontop_var.get())
        if self._save_job:
            self.after_cancel(self._save_job)
        self._save_job = self.after(500, lambda: save_config(self.cfg))

    # ---------- Volumen maestro / siempre visible ----------
    def _on_master_gain(self, value):
        self.master_gain = float(value)
        self.master_lbl.config(text=f"{int(self.master_gain * 100)}%")
        self._remember()

    def _apply_ontop(self):
        try:
            self.attributes("-topmost", bool(self.ontop_var.get()))
        except Exception:
            pass

    def _on_ontop_change(self):
        self._apply_ontop()
        self._remember()

    # ---------- GuÃ­a Asistente (VB-Cable) ----------
    def _cable_devices(self):
        """Devuelve (salida_cable, entrada_cable) si VB-Cable estÃ¡ instalado."""
        devs = sd.query_devices()
        outs = [(i, d["name"]) for i, d in enumerate(devs)
                if d["max_output_channels"] > 0 and "cable" in d["name"].lower()]
        ins = [(i, d["name"]) for i, d in enumerate(devs)
               if d["max_input_channels"] > 0 and "cable" in d["name"].lower()]
        return outs, ins

    def show_assistant_guide(self):
        outs, ins = self._cable_devices()
        cable_out = next((n for _, n in outs if "cable input" in n.lower()), None)
        cable_in = next((n for _, n in ins if "cable output" in n.lower()), None)
        pasos = (
            "Convierte TODOS tus micrÃ³fonos en un solo 'micrÃ³fono' que SerchTube\n"
            "escucha (el navegador solo admite el micrÃ³fono predeterminado de Windows):\n\n"
            "1. Instala VB-Cable (gratis): https://vb-audio.com/Cable/\n"
            "   (descomprime y ejecuta VBCABLE_Setup_x64.exe como administrador)\n"
            "2. AquÃ­, en 'Salida de audio', elige: " + (cable_out or "'CABLE Input' (aparece al instalar)") + "\n"
            "3. Activa tus micrÃ³fonos con 'â» Activar' (NO uses 'Escuchar').\n"
            "4. En Windows: ConfiguraciÃ³n > Sistema > Sonido > Entrada >\n"
            "   elige '" + (cable_in or "CABLE Output (Voicemeeter AUX Virtual Audio Device)") + "'\n"
            "   como MICRÃ“FONO PREDETERMINADO.\n\n"
            "Listo: la mezcla de todos tus mics llega a SerchTube como un solo micro.\n"
            "Deja este programa abierto (o activa 'Iniciar con Windows')."
        )
        msg = pasos
        if cable_out:
            if messagebox.askyesno("GuÃ­a Asistente", msg + "\n\nÂ¿Quieres que ponga la salida del cable AHORA como salida de audio?"):
                self.out_var.set(cable_out)
                self._remember()
        else:
            msg = ("VB-Cable NO estÃ¡ instalado todavÃ­a.\n\n" + pasos)
            messagebox.showinfo("GuÃ­a Asistente", msg)

    # ---------- Watchdog de dispositivos (arranque de Windows) ----------
    def _watchdog_restart(self, mic: Mic):
        """Reabre un micrÃ³fono cuyos datos se cortaron, con FRENO exponencial.
        Insistir sobre un dispositivo que falla es justo lo que dejaba el motor de
        audio de Windows atascado y los micrÃ³fonos mudos hasta reiniciar: por eso
        tras varios fallos seguidos el dispositivo se aÃ­sla y se deja en paz."""
        now = time.time()
        if mic.quarantined or now < mic.retry_at:
            return
        mic.fail_count += 1
        mic.retry_at = now + min(300.0, 15.0 * (2 ** min(mic.fail_count - 1, 4)))

        if mic.fail_count >= self.max_fallos:
            if mic.row is not None:
                self._cerrar_mic(mic.row, f"fallÃ³ {mic.fail_count} veces seguidas")
            else:
                try:
                    mic.stop()
                except Exception:
                    pass
            return

        was_listening = mic.listening
        try:
            mic.stop()
        except Exception:
            pass
        # quitarlo de la lista de escucha para no duplicarlo al reactivarlo
        self.listen_mics = [m for m in self.listen_mics if m is not mic]
        try:
            mic.start(self.out_rate)
            mic.last_cb = time.time()
            _log(f"Mic reiniciado: {mic.name} (intento {mic.fail_count}, "
                 f"prÃ³ximo reintento en {int(mic.retry_at - now)}s si falla)")
            if was_listening:
                mic.listening = True
                if mic not in self.listen_mics:
                    self.listen_mics = self.listen_mics + [mic]
                mic.ring.clear()
                if self.out_stream:
                    try:
                        self.out_stream.stop()
                        self.out_stream.close()
                    except Exception:
                        pass
                    self.out_stream = None
                self._ensure_output()
        except Exception as e:
            _log(f"Fallo al reiniciar {mic.name} (intento {mic.fail_count}): {e}")

    def _modo_seguro(self, motivo: str):
        """Varios micrÃ³fonos sin datos a la vez = el motor de audio de Windows estÃ¡
        atascado. En vez de martillarlo, se cierra TODO, se espera y se reabre de a uno."""
        now = time.time()
        if now < self._safe_until:
            return
        self._safe_until = now + max(30.0, self.seg_modo_seguro * 1.7)
        _log(f"MODO SEGURO: {motivo}. Se cierran todos los micrÃ³fonos y se reabrirÃ¡n "
             f"de a uno en {int(self.seg_modo_seguro)} s.")
        self._cola_auto = []
        for row in self.rows:
            mic = row["mic"]
            if mic.stream is not None:
                try:
                    mic.stop()
                except Exception:
                    pass
            mic.stream = None
            mic.listening = False
            mic.fail_count = 0
            mic.retry_at = 0.0
            mic.level = 0.0
            try:
                row["btn_act"].config(text="â»  Activar", bg=COL["card2"], fg=COL["fg"])
                row["btn_lis"].config(state="disabled", text="ðŸ”‡ Silenciado",
                                      bg=COL["card2"], fg=COL["fg"])
            except Exception:
                pass
        self.active_mics = []
        self.listen_mics = []
        if self.out_stream:
            try:
                self.out_stream.stop()
                self.out_stream.close()
            except Exception:
                pass
            self.out_stream = None
        self._after_change()
        self.status.config(text="ðŸ›  Modo seguro: el audio de Windows se atascÃ³. "
                                f"Reintentando de a uno en {int(self.seg_modo_seguro)} sâ€¦",
                           fg=COL["amber"])
        self.after(int(self.seg_modo_seguro * 1000), self._reintentar_todo)

    def _reintentar_todo(self):
        _log("Modo seguro: reintentando abrir los micrÃ³fonos de a uno.")
        calentar_motor_de_audio()
        self._autostart()

    # ---------- ReparaciÃ³n de emergencia (sin reiniciar la PC) ----------
    def reparar_audio(self):
        """Reinicia el servicio de audio de Windows. Es la salida de emergencia si el
        motor de audio quedÃ³ atascado y los micrÃ³fonos no registran volumen."""
        if not messagebox.askyesno(
            "Reparar el audio de Windows",
            "Se reiniciarÃ¡ el servicio de audio de Windows (Windows Audio).\n"
            "PedirÃ¡ permiso de administrador y el sonido se cortarÃ¡ 1-2 segundos.\n\n"
            "Ãšsalo si los micrÃ³fonos no registran volumen.\n\nÂ¿Continuar?"
        ):
            return
        self._cola_auto = []
        for row in list(self.rows):        # cerrar todo ANTES de tocar el servicio
            if row["mic"].stream is not None:
                try:
                    self.on_active_toggle(row)
                except Exception:
                    pass
        try:
            if self.out_stream:
                self.out_stream.stop()
                self.out_stream.close()
        except Exception:
            pass
        self.out_stream = None
        try:
            import ctypes
            guion = ("Start-Sleep -Seconds 1; Restart-Service -Name Audiosrv -Force; "
                     "Start-Sleep -Seconds 3; "
                     "Restart-Service -Name AudioEndpointBuilder -Force -ErrorAction SilentlyContinue")
            ctypes.windll.shell32.ShellExecuteW(
                None, "runas", "powershell.exe",
                '-NoProfile -ExecutionPolicy Bypass -Command "%s"' % guion, None, 1)
            _log("ReparaciÃ³n de audio: reiniciando el servicio Windows Audio.")
            self.status.config(text="ðŸ›  Reiniciando el audio de Windowsâ€¦ se reintentarÃ¡ solo.",
                               fg=COL["amber"])
            self._safe_until = time.time() + 20.0
            self.after(15000, self._reintentar_todo)
        except Exception as e:
            messagebox.showerror("No se pudo reparar el audio", str(e))

    # ---------- DiagnÃ³stico ----------
    def show_diag(self):
        try:
            devs = sd.query_devices()
            n_in = sum(d["max_input_channels"] > 0 for d in devs)
            n_out = sum(d["max_output_channels"] > 0 for d in devs)
            apis = ", ".join(h["name"] for h in sd.query_hostapis())
            txt = (
                f"Python: {sys.executable}\n"
                f"VersiÃ³n de Python: {sys.version.split()[0]}\n"
                f"sounddevice: {sd.__version__}\n"
                f"PortAudio: {sd.get_portaudio_version()[1]}\n"
                f"APIs de audio: {apis}\n"
                f"Dispositivos de entrada: {n_in}\n"
                f"Dispositivos de salida: {n_out}"
            )
        except Exception:
            txt = traceback.format_exc()
        messagebox.showinfo("DiagnÃ³stico", txt)

    # ---------- Medidores y estado ----------
    def _set_status(self, row: dict, text: str, color: str):
        if row["status_txt"] != text:
            row["status_txt"] = text
            row["status"].config(text=text, fg=color)

    def _tick(self):
        now = time.time()
        # Varios micrÃ³fonos sin datos A LA VEZ = el motor de audio de Windows estÃ¡
        # atascado (tÃ­pico al encender la PC). En vez de reiniciarlos todos en bucle,
        # se pasa a modo seguro: cerrar todo, esperar y reabrir de a uno.
        sin_datos = [r for r in self.rows
                     if r["mic"].stream is not None and now - r["mic"].last_cb > 3.0]
        if len(sin_datos) >= 2 and max(r["mic"].fail_count for r in sin_datos) >= 1:
            self._modo_seguro(f"{len(sin_datos)} micrÃ³fonos sin datos a la vez")

        for row in self.rows:
            m = row["mic"]
            meter = row["meter"]
            if m.stream is None:
                meter.coords(row["bar"], 0, 0, 0, METER_H)
                meter.coords(row["hold"], 0, 0, 0, METER_H)
                row["db"].config(text="")
                if m.quarantined:
                    self._set_status(row, "âš  Aislado: no se abre solo", COL["amber"])
                else:
                    self._set_status(row, "Apagado", COL["muted"])
                continue

            lvl, m.level = m.level, m.level * 0.6
            if lvl <= 0.001:
                val, txt = 0.0, "-âˆž dB"
            else:
                db = 20 * math.log10(lvl)
                val = max(0.0, min(100.0, (db + 60) / 60 * 100))
                txt = f"{db:4.0f} dB"
            m.hold = max(val, m.hold - 2.5)

            color = COL["green"] if val < 70 else COL["amber"] if val < 90 else COL["red"]
            mw = max(meter.winfo_width(), 10)
            meter.coords(row["bar"], 0, 0, val / 100 * mw, METER_H)
            meter.itemconfig(row["bar"], fill=color)
            hx = m.hold / 100 * mw
            meter.coords(row["hold"], hx, 0, hx, METER_H)
            row["db"].config(text=txt)

            if now - m.last_cb > 3.0:
                self._set_status(row, "âš  Sin datos: reintentandoâ€¦", COL["red"])
                self._watchdog_restart(m)
            else:
                m.fail_count = 0          # el dispositivo estÃ¡ sano: se limpia el freno
                m.retry_at = 0.0
                if now - m.heard_at < 3.0:
                    self._set_status(row, "â— SeÃ±al detectada", COL["green"])
                else:
                    self._set_status(row, "â— Activo Â· en silencio", COL["muted"])
        self.after(80, self._tick)

    def _on_close(self):
        self._remember()
        save_config(self.cfg)
        try:
            self.deactivate_all()          # cierra los micrÃ³fonos (libera WASAPI)
        except Exception:
            pass
        try:
            if self.out_stream:
                self.out_stream.stop()
                self.out_stream.close()
        except Exception:
            pass
        self.out_stream = None
        try:
            sd._terminate()                # libera PortAudio y sus objetos COM
        except Exception:
            pass
        _log("Cerrado: dispositivos liberados.")
        self.destroy()


def _diagnostico(sondas: bool) -> int:
    """Informe portable del equipo: sirve para validar cualquier PC objetivo.
    Uso:  python MultiMicMonitor.py --diagnostico            (informe, sin abrir nada)
          python MultiMicMonitor.py --diagnostico --sondas   (ademÃ¡s prueba cada entrada)
    Guarda el informe en %APPDATA%\\MultiMicMonitor\\diagnostico-<fecha>.txt"""
    import platform

    lineas = []

    def w(t=""):
        lineas.append(str(t))
        print(t, flush=True)

    w("=" * 74)
    w("Multi Mic Monitor - DIAGNOSTICO DEL EQUIPO")
    w("=" * 74)
    w(f"Fecha: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    w(f"Equipo: {os.environ.get('COMPUTERNAME', '?')} | Usuario: {os.environ.get('USERNAME', '?')}")
    w(f"Sistema: {platform.platform()} ({platform.machine()})")
    w(f"Python: {sys.version.split()[0]}  ({sys.executable})")
    try:
        w(f"sounddevice: {sd.__version__} | PortAudio: {sd.get_portaudio_version()[1]}")
    except Exception as e:
        w(f"sounddevice/PortAudio: error al consultar ({e})")

    hostapis = []
    try:
        hostapis = sd.query_hostapis()
        w("")
        w("APIs de audio:")
        for i, h in enumerate(hostapis):
            w(f"  [{i}] {h['name']}  ({len(h.get('devices', []))} dispositivos)")
    except Exception as e:
        w(f"No se pudieron leer las APIs de audio: {e}")

    try:
        din, dout = sd.default.device[0], sd.default.device[1]
        nombre_in = sd.query_devices(int(din))["name"] if din is not None and int(din) >= 0 else "(ninguno)"
        nombre_out = sd.query_devices(int(dout))["name"] if dout is not None and int(dout) >= 0 else "(ninguno)"
        w("")
        w(f"MicrÃ³fono predeterminado de Windows: [{din}] {nombre_in}")
        w(f"Salida predeterminada de Windows : [{dout}] {nombre_out}")
    except Exception as e:
        w(f"No se pudo leer el dispositivo predeterminado: {e}")

    cfg = load_config()
    extra = _ajuste(cfg, "virtual_extra")
    devs = sd.query_devices()
    w("")
    w("Dispositivos  (idx | ent | sal | API | virtual? | nombre)")
    for i, d in enumerate(devs):
        api = hostapis[d["hostapi"]]["name"] if hostapis else "?"
        marca = " SI" if es_virtual(d["name"], extra) else "  -"
        w(f"  {i:3d} | {d['max_input_channels']:3d} | {d['max_output_channels']:3d} | "
          f"{str(api)[:22]:22s} | {marca} | {bonito(d['name'])}")

    if sondas:
        w("")
        w("PRUEBA REAL de cada entrada (2 s por dispositivo; se abre y se cierra):")
        w("  idx | resultado | pico  | nombre")
        fallan = []
        for i, d in enumerate(devs):
            if d["max_input_channels"] <= 0:
                continue
            try:
                llego, pico = _probar_entrada(i, 2.0)
            except Exception as e:
                w(f"  {i:3d} | ERROR     |       | {d['name']}  ({e})")
                continue
            w(f"  {i:3d} | {'DATOS OK ' if llego else 'SIN DATOS'} | {pico:.3f} | {d['name']}")
            if not llego:
                fallan.append(d["name"])
            time.sleep(0.5)
        w("")
        if fallan:
            w("Dispositivos que NO entregaron datos: " + ", ".join(fallan))
            w("Sugerencia: agregalos a \"virtual_extra\" en el config para que el arranque "
              "con Windows no los abra:")
            w("   \"virtual_extra\": [" + ", ".join(
                '"%s"' % n.split("(")[0].strip()[:18] for n in fallan) + "]")
        else:
            w("Todas las entradas probadas entregaron datos.")

    w("")
    w("Ajustes efectivos (config.json + valores por defecto):")
    for clave, base in AJUSTES_POR_DEFECTO.items():
        w(f"  {clave:22s} = {_ajuste(cfg, clave)!r}   (por defecto {base!r})")
    cuar = cfg.get("cuarentena")
    if isinstance(cuar, dict) and cuar:
        w("")
        w("Dispositivos aislados por fallos anteriores:")
        for nombre, info in cuar.items():
            motivo = info.get("motivo", "?") if isinstance(info, dict) else "?"
            w(f"  - {nombre}: {motivo}")

    try:
        os.makedirs(_DIR_CFG, exist_ok=True)
        ruta = os.path.join(_DIR_CFG, "diagnostico-" + time.strftime("%Y%m%d-%H%M%S") + ".txt")
        with open(ruta, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas) + "\n")
        print(f"\nInforme guardado en: {ruta}")
    except OSError as e:
        print(f"\nNo se pudo guardar el informe: {e}")
    return 0


def _autotest() -> int:
    """Autoprueba por consola (no abre la ventana): comprueba que los micrÃ³fonos
    marcados 'Iniciar al abrir' entregan datos y cierra todo limpiamente.
    Uso:  python MultiMicMonitor.py --autotest [--con-virtuales]"""
    print("Multi Mic Monitor - autoprueba (sin interfaz)")
    con_virtuales = "--con-virtuales" in sys.argv
    cfg = load_config()
    hostapis = sd.query_hostapis()
    wasapi = next((i for i, h in enumerate(hostapis) if "WASAPI" in h["name"]), None)
    if wasapi is None:
        print("No hay WASAPI disponible.")
        return 1

    t0, prev, estable = time.time(), None, 0
    while time.time() - t0 < 60:
        snap = _instantanea_entradas()
        if snap and snap == prev:
            estable += 1
            if estable >= 2:
                break
        else:
            estable = 0
            prev = snap
        time.sleep(1.5)
    print(f"1) Entradas estables: {len(prev or [])} (tras {time.time() - t0:.1f}s)")

    calentar_motor_de_audio()

    devs = sd.query_devices()
    outs = [(i, d) for i, d in enumerate(devs)
            if d["max_output_channels"] > 0 and d["hostapi"] == wasapi]
    out_rate = int(outs[0][1]["default_samplerate"]) if outs else 48000

    probados, fallos = 0, []
    for i, d in enumerate(devs):
        if d["max_input_channels"] <= 0 or d["hostapi"] != wasapi:
            continue
        guardado = (cfg.get("mics") or {}).get(d["name"], {})
        if not isinstance(guardado, dict) or not guardado.get("auto", False):
            continue
        if es_virtual(d["name"]) and not con_virtuales:
            print(f"   - {d['name']}: OMITIDO (virtual; con --con-virtuales se prueba igual)")
            continue
        m = Mic(i, d, True)
        try:
            m.start(out_rate)
        except Exception as e:
            print(f"   - {d['name']}: ERROR al abrir: {e}")
            fallos.append(d["name"])
            continue
        t1 = time.time()
        while time.time() - t1 < 2.0:
            time.sleep(0.1)
        ok = m.last_cb > t1
        print(f"   - {d['name']}: {'datos OK' if ok else 'SIN DATOS'} (pico {m.level:.3f})")
        try:
            m.stop()
        except Exception:
            pass
        probados += 1
        if not ok:
            fallos.append(d["name"])
        time.sleep(1.0)

    try:
        sd._terminate()
    except Exception:
        pass
    print(f"RESULTADO: probados={probados} fallos={len(fallos)}"
          + ("" if not fallos else " -> " + " | ".join(fallos)))
    return 0 if (probados and not fallos) else 1


if __name__ == "__main__":
    if not instancia_unica():
        _log("Ya hay otra copia de Multi Mic Monitor abierta; esta no se inicia.")
        if not STARTUP_LAUNCH:
            _r = tk.Tk()
            _r.withdraw()
            messagebox.showinfo("Multi Mic Monitor",
                                "Ya hay una copia abierta (mirÃ¡ la barra de tareas).")
            _r.destroy()
        sys.exit(0)
    if "--diagnostico" in sys.argv:
        sys.exit(_diagnostico("--sondas" in sys.argv))
    if "--autotest" in sys.argv:
        sys.exit(_autotest())
    try:
        App().mainloop()
    except Exception:
        err = traceback.format_exc()
        try:
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "multi_mic_monitor_error.txt"), "w", encoding="utf-8") as f:
                f.write(err)
        except OSError:
            pass
        try:
            _log("ERROR al iniciar: " + err.splitlines()[-1])
        except Exception:
            pass
        _root = tk.Tk()
        _root.withdraw()
        messagebox.showerror("Error al iniciar", err)


