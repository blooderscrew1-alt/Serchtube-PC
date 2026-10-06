"""
Multi Mic Monitor (tema oscuro) - escucha varios micrófonos a la vez (Windows)

Cada micrófono tiene DOS interruptores independientes:
  ⏻ Activar    -> abre el micrófono y muestra su medidor (para comprobar que
                  funciona) SIN que se oiga nada en tus bocinas.
  🔊 Escuchar  -> envía ese micrófono a tus bocinas/audífonos.

Todo empieza apagado y silenciado. No se graba nada.
Esta versión no usa numpy (solo sounddevice).

Uso:
    python multi_mic_monitor.py
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

try:  # texto nítido en pantallas con escalado
    import ctypes
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass

# módulo -> paquete de pip
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
    """Comprueba las librerías y, si faltan, las instala con ESTE mismo Python."""
    problems = _check_modules()
    if not problems:
        return

    root = tk.Tk()
    root.withdraw()
    pkgs = list(problems)
    if not messagebox.askyesno(
        "Instalación necesaria",
        f"No se pudieron cargar: {', '.join(pkgs)}\n\n"
        f"Python en uso:\n{sys.executable}\n\n"
        "¿Instalarlos ahora automáticamente?\n"
        "(Necesita internet y puede tardar un minuto.)",
    ):
        root.destroy()
        sys.exit(1)

    win = tk.Toplevel(root)
    win.title("Instalando…")
    win.geometry("360x90")
    win.resizable(False, False)
    ttk.Label(win, text=f"Instalando {', '.join(pkgs)}…\nNo cierres esta ventana.").pack(pady=(12, 6))
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
            "Cierra el programa y vuelve a abrirlo. Si persiste, envíame este texto.",
        )
        root.destroy()
        sys.exit(1)

    messagebox.showinfo("Listo", "Instalación completada. Se abrirá el programa.")
    root.destroy()


ensure_dependencies()

import sounddevice as sd  # noqa: E402


# ---------------------------------------------------------------------------
# Audio (sin numpy: enteros de 16 bits con array/deque de la biblioteca estándar)
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
            while self.n > self.cap and self.q:  # desborde: descarta lo más viejo
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
        self.last_cb = 0.0        # última vez que llegó audio del dispositivo
        self.heard_at = 0.0       # última vez que hubo señal audible
        self.retry_at = 0.0       # próxima ventana de reinicio automático (watchdog)
        self.hold = 0.0           # marcador de pico del medidor
        self.listening = False    # ¿se envía a las bocinas?
        self.ratio = 1.0
        self.ch = 1
        self.keep = 0
        self.ring = None
        self.stream = None

    def _cb(self, indata, frames, time_info, status):
        try:
            now = time.time()
            self.last_cb = now
            x = to_mono(indata, self.ch)
            # Volumen y Boost se aplican AQUÍ, en la fuente: así afectan al medidor
            # y a la mezcla aunque no estés usando "Escuchar" hacia las bocinas
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
                self.ratio = out_rate / rate
                s = sd.RawInputStream(
                    device=self.index, samplerate=rate, channels=self.ch, dtype="int16",
                    latency="low", extra_settings=extra, callback=self._cb,
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
    """Lee la configuración guardada (micrófonos con inicio automático, volúmenes, salida)."""
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
STARTUP_LAUNCH = "--inicio" in sys.argv       # lo lanzó Windows al iniciar sesión
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
        self.active_mics = []   # micrófonos abiertos (con medidor)
        self.listen_mics = []   # micrófonos que suenan en la salida
        self.out_stream = None
        self.out_rate = 48000
        self.out_ch = 2
        self.out_devs = []      # (índice, nombre)
        self.out_var = tk.StringVar()
        self.cfg = load_config()
        self._boot_retries = 0
        self._save_job = None
        self.startup_var = tk.BooleanVar(value=startup_enabled())
        self.min_var = tk.BooleanVar(value=bool(self.cfg.get("minimized", False)))
        self.rl_var = tk.BooleanVar(value=bool(self.cfg.get("remember_listen", False)))
        self.master_gain = float(self.cfg.get("master_gain", 1.0))   # volumen maestro de la mezcla
        self.ontop_var = tk.BooleanVar(value=bool(self.cfg.get("always_on_top", False)))
        if self.startup_var.get():  # mantiene al día la ruta registrada si moviste el archivo
            try:
                set_startup(True, self.min_var.get())
            except Exception:
                pass

        self._setup_style()
        self._build_ui()
        self._apply_ontop()
        self.refresh_devices()
        self._dark_titlebar()
        # Al iniciar sesión Windows, el audio puede tardar en estar listo: se espera un poco
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
        """Barra de título oscura en Windows 10/11 (si está disponible)."""
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
        self.btn_refresh = make_button(top, "↻ Actualizar", self.refresh_devices)
        self.btn_refresh.pack(side="right")
        tip(self.btn_refresh, "Vuelve a leer la lista de micrófonos y salidas. Úsalo después de conectar o desconectar un dispositivo. (Se desactiva mientras hay mics activos.)")

        out = tk.Frame(self, bg=bg)
        out.pack(fill="x", padx=14, pady=6)
        tk.Label(out, text="Salida de audio:", bg=bg, fg=COL["muted"],
                 font=("Segoe UI", 9)).pack(side="left")
        self.combo = ttk.Combobox(out, textvariable=self.out_var, state="readonly")
        self.combo.pack(side="left", fill="x", expand=True, padx=8)
        tip(self.combo, "Por dónde se oye la mezcla. Para que el asistente escuche TODOS tus mics: elige 'CABLE Input' (requiere VB-Cable) y pon 'CABLE Output' como micrófono predeterminado de Windows. El botón 'Guía Asistente' te ayuda.")
        self.combo.bind("<<ComboboxSelected>>", lambda e: self._remember())

        tk.Label(
            self, bg=bg, fg=COL["muted"], font=("Segoe UI", 9), anchor="w", justify="left",
            text="⏻ Activar = abre el micrófono y muestra su barra (no se oye).   "
                 "🔊 Escuchar = lo manda a tus bocinas.\n"
                 "Para comprobar que funciona: actívalo y habla cerca; la barra debe moverse.",
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
        tip(b_at, "Abre TODOS los micrófonos de la lista (medidor funcionando y listos para la mezcla). No se oye nada en las bocinas.")
        b_dt = make_button(bottom, "Desactivar todos", self.deactivate_all); b_dt.pack(side="left", padx=6)
        tip(b_dt, "Cierra todos los micrófonos abiertos y libera los dispositivos.")
        b_mut = make_button(bottom, "🔇 Silenciar todos", self.mute_all, bg="#3a2226"); b_mut.pack(side="left")
        tip(b_mut, "Quita el sonido de la mezcla hacia las bocinas/cable, pero deja los mics abiertos (los medidores siguen activos).")
        b_diag = make_button(bottom, "ℹ Diagnóstico", self.show_diag); b_diag.pack(side="right")
        tip(b_diag, "Datos técnicos: versión de Python, librería de audio, dispositivos detectados. Útil si algo no funciona.")
        b_guia = make_button(bottom, "🎙 Guía Asistente (VB-Cable)", self.show_assistant_guide, bg="#12324f"); b_guia.pack(side="right", padx=6)
        tip(b_guia, "Pasos para que SerchTube escuche TODOS tus mics a la vez usando el cable virtual. Si VB-Cable ya está instalado, te ofrece poner la salida con un clic.")

        opts = tk.Frame(self, bg=bg)
        opts.pack(fill="x", padx=14, pady=(2, 0))
        c_sw = make_check(opts, "Iniciar con Windows", self.startup_var, self._on_startup_change); c_sw.pack(side="left")
        tip(c_sw, "Abre este programa automáticamente cada vez que enciendas la PC (recomendado para el asistente).")
        c_min = make_check(opts, "Iniciar minimizado", self.min_var, self._on_startup_change); c_min.pack(side="left", padx=14)
        tip(c_min, "Al arrancar con Windows, abre la ventana minimizada sin estorbar.")
        opts2 = tk.Frame(self, bg=bg)
        opts2.pack(fill="x", padx=14, pady=(0, 0))
        c_rl = make_check(opts2, "Recordar qué micrófonos se escuchan (cuidado con las bocinas)",
                   self.rl_var, self._remember); c_rl.pack(side="left")
        tip(c_rl, "Guarda qué mics estaban mandando sonido y los reactiva al abrir. CUIDADO: si estaban conectados a bocinas reales, puede generarse eco.")

        opts3 = tk.Frame(self, bg=bg)
        opts3.pack(fill="x", padx=14, pady=(2, 0))
        c_top = make_check(opts3, "📌 Siempre visible", self.ontop_var, self._on_ontop_change); c_top.pack(side="left")
        tip(c_top, "Mantiene esta ventana por encima de las demás (útil mientras calibras micrófonos).")
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

        self.status = tk.Label(self, text="Todo apagado.", bg=bg, fg=COL["muted"],
                               font=("Segoe UI", 9), anchor="w")
        self.status.pack(fill="x", padx=14, pady=(2, 10))

    # ---------- Dispositivos ----------
    def refresh_devices(self):
        if self.active_mics:
            return
        try:  # forzar a PortAudio a releer los dispositivos
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
            tk.Label(self.list_frame, text="No se encontraron micrófonos.", bg=COL["bg"],
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

        # --- Fila 1: nombre (editable), estado, inicio automático ---
        head = tk.Frame(card, bg=c)
        head.pack(fill="x")
        name_lbl = tk.Label(head, text=alias or mic.name, bg=c, fg=COL["fg"], anchor="w",
                            font=("Segoe UI", 10, "bold"))
        name_lbl.pack(side="left")
        edit_btn = tk.Label(head, text="✎", bg=c, fg=COL["muted"], cursor="hand2",
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
        tip(chk_auto, "Si está marcado, este micrófono se activa solo cada vez que abres el programa (o enciendes la PC).")

        row = {
            "mic": mic, "status": status, "status_txt": "", "auto": auto_var,
            "alias": alias, "boost_i": boost_i, "want_listen": bool(saved.get("listen", False)),
            "head": head, "name_lbl": name_lbl, "edit_btn": edit_btn, "editing": False,
        }
        edit_btn.bind("<Button-1>", lambda e, r=row: self._rename(r))
        name_lbl.bind("<Double-Button-1>", lambda e, r=row: self._rename(r))
        tip(name_lbl, "Nombre real del dispositivo. Doble clic (o la ✎) para ponerle un apodo, ej: 'Micro cocina'.")

        # --- Fila 2: botones y volumen ---
        ctl = tk.Frame(card, bg=c)
        ctl.pack(fill="x", pady=(8, 0))
        btn_act = make_button(ctl, "⏻  Activar", lambda r=row: self.on_active_toggle(r), width=11)
        btn_act.pack(side="left")
        tip(btn_act, "Abre este micrófono: su medidor empieza a funcionar y su audio entra a la mezcla. No se oye en las bocinas a menos que actives 'Escuchar'.")
        btn_lis = make_button(ctl, "🔇 Silenciado", lambda r=row: self.on_listen_toggle(r), width=13)
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
        tip(vol, "Volumen de ESTE micrófono dentro de la mezcla (0% a 200%). Se guarda solo.")

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
        return row["alias"] or row["mic"].name

    def _style_boost(self, row: dict):
        extra = BOOST_STEPS[row["boost_i"]]
        if extra:
            row["btn_boost"].config(text=f"🚀 Boost +{extra} dB", bg=COL["amber"], fg="#1a1204")
        else:
            row["btn_boost"].config(text="🚀 Boost: Off", bg=COL["card2"], fg=COL["fg"])

    def _cycle_boost(self, row: dict):
        row["boost_i"] = (row["boost_i"] + 1) % len(BOOST_STEPS)
        row["mic"].boost = 10 ** (BOOST_STEPS[row["boost_i"]] / 20)
        self._style_boost(row)
        self._remember()

    def _rename(self, row: dict):
        """Edita el nombre que se muestra (Enter guarda, Esc cancela, vacío = nombre original)."""
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
                # aquí solo entra el volumen maestro de la mezcla
                g = self.master_gain
                mix = [a + int(b * g) for a, b in zip(mix, chunk)]
            peak = max(max(mix), -min(mix))
            if peak > 32767:  # limitador: baja el bloque en vez de recortarlo (menos distorsión)
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
                text=f"{len(self.active_mics)} micrófono(s) activo(s) · "
                     f"{len(self.listen_mics)} escuchándose. "
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
            row["btn_lis"].config(text="🔊 Escuchando", bg=COL["accent"], fg="#ffffff")
        else:
            mic.listening = False
            self.listen_mics = [m for m in self.listen_mics if m is not mic]
            row["btn_lis"].config(text="🔇 Silenciado", bg=COL["card2"], fg=COL["fg"])
        return True

    def _activate(self, row: dict):
        """Abre el micrófono. Devuelve None si salió bien, o el texto del error."""
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
        row["btn_act"].config(text="⏻  Activo", bg=COL["green"], fg="#08160d")
        row["btn_lis"].config(state="normal")
        return None

    def on_active_toggle(self, row: dict):
        mic = row["mic"]
        if mic.stream is None:  # activar
            err = self._activate(row)
            if err:
                messagebox.showerror(
                    "No se pudo abrir el micrófono",
                    f"{err}\n\nRevisa que Windows permita el acceso al micrófono a las "
                    "aplicaciones de escritorio (Configuración > Privacidad > Micrófono).",
                )
                return
        else:  # desactivar
            if mic.listening:
                self._set_listening(row, False)
            row["want_listen"] = False
            self.active_mics = [m for m in self.active_mics if m is not mic]
            mic.stop()
            row["btn_act"].config(text="⏻  Activar", bg=COL["card2"], fg=COL["fg"])
            row["btn_lis"].config(state="disabled", text="🔇 Silenciado", bg=COL["card2"], fg=COL["fg"])
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

    # ---------- Inicio automático y configuración ----------
    def _autostart_boot(self):
        if STARTUP_LAUNCH:  # relee los dispositivos por si el audio terminó de cargar después
            self.refresh_devices()
        self._autostart()

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
        errores = []
        for row in self.rows:
            if row["auto"].get() and row["mic"].stream is None:
                err = self._activate(row)
                if err:
                    errores.append(f"- {self._display(row)}: {err}")
                elif self.rl_var.get() and row["want_listen"]:
                    self._set_listening(row, True)
        self._after_change()
        if errores:
            messagebox.showwarning(
                "Algunos micrófonos no se pudieron activar",
                "\n".join(errores) + "\n\nRevisa que Windows permita el acceso al micrófono "
                "(Configuración > Privacidad > Micrófono) y que ningún otro programa lo use.",
            )

    def _on_gain(self, mic: Mic, value):
        mic.gain = float(value)
        self._remember()

    def _remember(self):
        """Guarda (con un pequeño retraso) qué micrófonos inician solos, volúmenes y salida."""
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

    # ---------- Guía Asistente (VB-Cable) ----------
    def _cable_devices(self):
        """Devuelve (salida_cable, entrada_cable) si VB-Cable está instalado."""
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
            "Convierte TODOS tus micrófonos en un solo 'micrófono' que SerchTube\n"
            "escucha (el navegador solo admite el micrófono predeterminado de Windows):\n\n"
            "1. Instala VB-Cable (gratis): https://vb-audio.com/Cable/\n"
            "   (descomprime y ejecuta VBCABLE_Setup_x64.exe como administrador)\n"
            "2. Aquí, en 'Salida de audio', elige: " + (cable_out or "'CABLE Input' (aparece al instalar)") + "\n"
            "3. Activa tus micrófonos con '⏻ Activar' (NO uses 'Escuchar').\n"
            "4. En Windows: Configuración > Sistema > Sonido > Entrada >\n"
            "   elige '" + (cable_in or "CABLE Output (Voicemeeter AUX Virtual Audio Device)") + "'\n"
            "   como MICRÓFONO PREDETERMINADO.\n\n"
            "Listo: la mezcla de todos tus mics llega a SerchTube como un solo micro.\n"
            "Deja este programa abierto (o activa 'Iniciar con Windows')."
        )
        msg = pasos
        if cable_out:
            if messagebox.askyesno("Guía Asistente", msg + "\n\n¿Quieres que ponga la salida del cable AHORA como salida de audio?"):
                self.out_var.set(cable_out)
                self._remember()
        else:
            msg = ("VB-Cable NO está instalado todavía.\n\n" + pasos)
            messagebox.showinfo("Guía Asistente", msg)

    # ---------- Watchdog de dispositivos (arranque de Windows) ----------
    def _watchdog_restart(self, mic: Mic):
        """Al encender la PC los streams a veces quedan zombis (abiertos pero sin
        datos). Reabrir el mic y, si estaba sonando, también la salida."""
        now = time.time()
        if now < mic.retry_at:
            return
        mic.retry_at = now + 6.0  # máximo un intento cada 6 segundos por micro
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
            if was_listening or self.listen_mics:
                # resincronizar la salida: cerrarla y volverla a abrir
                if self.out_stream:
                    try:
                        self.out_stream.stop()
                        self.out_stream.close()
                    except Exception:
                        pass
                    self.out_stream = None
                if was_listening:
                    mic.listening = True
                    if mic not in self.listen_mics:
                        self.listen_mics = self.listen_mics + [mic]
                    mic.ring.clear()
                    self._ensure_output()
            print(f"[Watchdog] Mic reiniciado: {mic.name}")
        except Exception as e:
            print(f"[Watchdog] Fallo al reiniciar {mic.name}: {e}")

    # ---------- Diagnóstico ----------
    def show_diag(self):
        try:
            devs = sd.query_devices()
            n_in = sum(d["max_input_channels"] > 0 for d in devs)
            n_out = sum(d["max_output_channels"] > 0 for d in devs)
            apis = ", ".join(h["name"] for h in sd.query_hostapis())
            txt = (
                f"Python: {sys.executable}\n"
                f"Versión de Python: {sys.version.split()[0]}\n"
                f"sounddevice: {sd.__version__}\n"
                f"PortAudio: {sd.get_portaudio_version()[1]}\n"
                f"APIs de audio: {apis}\n"
                f"Dispositivos de entrada: {n_in}\n"
                f"Dispositivos de salida: {n_out}"
            )
        except Exception:
            txt = traceback.format_exc()
        messagebox.showinfo("Diagnóstico", txt)

    # ---------- Medidores y estado ----------
    def _set_status(self, row: dict, text: str, color: str):
        if row["status_txt"] != text:
            row["status_txt"] = text
            row["status"].config(text=text, fg=color)

    def _tick(self):
        now = time.time()
        for row in self.rows:
            m = row["mic"]
            meter = row["meter"]
            if m.stream is None:
                meter.coords(row["bar"], 0, 0, 0, METER_H)
                meter.coords(row["hold"], 0, 0, 0, METER_H)
                row["db"].config(text="")
                self._set_status(row, "Apagado", COL["muted"])
                continue

            lvl, m.level = m.level, m.level * 0.6
            if lvl <= 0.001:
                val, txt = 0.0, "-∞ dB"
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
                self._set_status(row, "⚠ Sin datos: reiniciando automáticamente...", COL["red"])
                self._watchdog_restart(m)
            elif now - m.heard_at < 3.0:
                self._set_status(row, "● Señal detectada", COL["green"])
            else:
                self._set_status(row, "● Activo · en silencio", COL["muted"])
        self.after(80, self._tick)

    def _on_close(self):
        self._remember()
        save_config(self.cfg)
        self.deactivate_all()
        self.destroy()


if __name__ == "__main__":
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
        _root = tk.Tk()
        _root.withdraw()
        messagebox.showerror("Error al iniciar", err)
