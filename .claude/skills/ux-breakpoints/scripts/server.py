"""Levanta o detiene el build de producción de Chronos para las pruebas.

    python server.py start [--port 3125] [--no-build]
    python server.py stop  [--port 3125]

En Windows detiene el árbol completo de procesos (taskkill /T), cosa que
with_server.py de webapp-testing no hace.
"""

from __future__ import annotations

import argparse
import socket
import subprocess
import sys
import time

from common import ROOT, UX_DIR


def port_open(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def pids_on_port(port: int) -> set[str]:
    if sys.platform != "win32":
        out = subprocess.run(["lsof", "-ti", f"tcp:{port}"], capture_output=True, text=True).stdout
        return set(out.split())
    out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True).stdout
    return {
        line.split()[-1]
        for line in out.splitlines()
        if f":{port} " in line and "LISTENING" in line
    }


def start(port: int, build: bool) -> None:
    if port_open(port):
        print(f"Ya hay un servidor en el puerto {port}.")
        return
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    if build:
        print("Compilando (next build)…")
        result = subprocess.run(
            [npx, "next", "build"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace"
        )
        if result.returncode != 0:
            print(result.stdout[-3000:], result.stderr[-3000:])
            sys.exit("El build falló.")
    UX_DIR.mkdir(exist_ok=True)
    log = open(UX_DIR / "server.log", "w", encoding="utf-8")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    subprocess.Popen([npx, "next", "start", "-p", str(port)], cwd=ROOT, stdout=log, stderr=log, creationflags=flags)
    for _ in range(60):
        if port_open(port):
            print(f"Servidor listo en http://localhost:{port} (log en .ux/server.log)")
            return
        time.sleep(1)
    sys.exit("El servidor no respondió en 60 s; revisa .ux/server.log.")


def stop(port: int) -> None:
    pids = pids_on_port(port)
    if not pids:
        print(f"No hay servidor en el puerto {port}.")
        return
    for pid in pids:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
        else:
            subprocess.run(["kill", pid])
    print(f"Servidor detenido (puerto {port}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=["start", "stop"])
    parser.add_argument("--port", type=int, default=3125)
    parser.add_argument("--no-build", action="store_true")
    args = parser.parse_args()
    start(args.port, not args.no_build) if args.action == "start" else stop(args.port)
