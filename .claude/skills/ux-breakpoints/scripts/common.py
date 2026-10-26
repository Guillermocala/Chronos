"""Utilidades compartidas: rutas, credenciales, sesión guardada y navegador."""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
UX_DIR = ROOT / ".ux"
AUTH_STATE = UX_DIR / "auth.json"
DEFAULT_BASE = "http://localhost:3125"
CHROME_CHANNEL = "chrome"
DEMO = "[DEMO]"

# La consola de Windows usa cp1252 por defecto: forzar UTF-8 para los acentos.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

VIEWPORTS = {
    "360": {"viewport": {"width": 360, "height": 740}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2},
    "390": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2},
    "1280": {"viewport": {"width": 1280, "height": 900}, "device_scale_factor": 1},
}


def load_env() -> None:
    """Carga .env.local y .env (sin sobrescribir lo que ya está en el entorno)."""
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
            if not match or line.lstrip().startswith("#"):
                continue
            key, value = match.groups()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            os.environ.setdefault(key, value)


def credentials() -> tuple[str, str]:
    load_env()
    email = os.environ.get("USER_EMAIL") or os.environ.get("CHRONOS_TEST_EMAIL")
    password = os.environ.get("USER_PASSWORD") or os.environ.get("CHRONOS_TEST_PASSWORD")
    if not email or not password:
        sys.exit("Faltan USER_EMAIL / USER_PASSWORD en .env o .env.local.")
    return email, password


def run_dir(name: str) -> Path:
    path = UX_DIR / "runs" / datetime.now().strftime("%Y-%m-%d_%H%M") / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def launch(playwright):
    return playwright.chromium.launch(channel=CHROME_CHANNEL, headless=True)


def new_context(browser, viewport: str = "390", storage_state=None):
    """Contexto con el ancho pedido, en español/Colombia y con la sesión guardada."""
    options = dict(VIEWPORTS[viewport], locale="es-CO", timezone_id="America/Bogota")
    if storage_state is not None:
        options["storage_state"] = storage_state
    elif AUTH_STATE.exists():
        options["storage_state"] = str(AUTH_STATE)
    return browser.new_context(**options)


def settle(page, timeout: int = 15000) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass


def ensure_login(page, base: str) -> None:
    """Usa la sesión guardada; si caducó, inicia sesión y la guarda de nuevo."""
    page.goto(f"{base}/today")
    settle(page)
    if "/login" not in page.url:
        return
    email, password = credentials()
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("button[type=submit]")
    try:
        page.wait_for_url(lambda url: "/login" not in url, timeout=20000)
    except Exception:
        alert = page.locator("[role=alert]").first
        detail = alert.inner_text() if alert.count() else "sin mensaje"
        sys.exit(
            f"No se pudo iniciar sesión ({detail}). Si las credenciales son correctas, revisa que "
            "NEXT_PUBLIC_SUPABASE_URL sea solo el dominio y vuelve a compilar."
        )
    settle(page)
    save_session(page)


def save_session(page) -> None:
    """Supabase rota el refresh token: guardar el estado al terminar cada corrida."""
    UX_DIR.mkdir(exist_ok=True)
    page.context.storage_state(path=str(AUTH_STATE))


def horizontal_overflow(page) -> dict:
    return page.evaluate(
        """() => {
          const vw = window.innerWidth;
          const offenders = [];
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > vw + 1 && !el.closest('[class*=overflow-x-auto],[data-slot=table-container]')) {
              offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.right)}px`);
              if (offenders.length >= 5) break;
            }
          }
          return { overflow: document.documentElement.scrollWidth > vw, scrollWidth: document.documentElement.scrollWidth, viewport: vw, offenders };
        }"""
    )


def discover(page, base: str) -> dict:
    """Ids de un proyecto (prefiere [DEMO]), un sprint y un ticket para recorrer."""
    page.goto(f"{base}/projects")
    settle(page)
    links = page.eval_on_selector_all(
        "a[href^='/projects/']",
        "els => els.map(a => ({ href: a.getAttribute('href'), text: a.textContent || '' }))",
    )
    projects = [l for l in links if re.fullmatch(r"/projects/[0-9a-f-]{36}", l["href"] or "")]
    demo = [l for l in projects if DEMO in l["text"]]
    found = {"project": (demo or projects or [{}])[0].get("href"), "project_is_demo": bool(demo)}
    found["sprint"] = found["ticket"] = None
    if found["project"]:
        page.goto(base + found["project"])
        settle(page)
        found["sprint"] = page.evaluate("document.querySelector(\"a[href*='/sprints/']\")?.getAttribute('href') ?? null")
        found["ticket"] = page.evaluate("document.querySelector(\"a[href^='/tickets/']\")?.getAttribute('href') ?? null")
    return found


def rects_overlap(a: dict | None, b: dict | None) -> bool:
    """True si dos bounding boxes de Playwright se cruzan (en x y en y)."""
    if not a or not b:
        return False
    return not (a["x"] + a["width"] <= b["x"] or b["x"] + b["width"] <= a["x"]
                or a["y"] + a["height"] <= b["y"] or b["y"] + b["height"] <= a["y"])


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
