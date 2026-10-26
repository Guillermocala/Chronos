"""Flujo completo de proyecto sobre datos [DEMO] (ESCRIBE en la base, solo [DEMO]).

    python form_resilience.py [--base URL] [--retainer] [--keep]

1. Crea "[DEMO] UX <hora>" con un error forzado (fin antes del inicio) → los campos se conservan.
2. Corrige y crea → redirige al detalle.
3. Edita el cliente → confirmación con el cambio → "Seguir editando" no guarda → "Guardar" sí.
4. Archiva el proyecto (salvo --keep) y, con --retainer, verifica que sus cobros ya no
   aparecen en "Hoy" (coherencia entre vistas).
"""

from __future__ import annotations

import argparse
import random
import re
import string
import sys
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

from common import DEFAULT_BASE, DEMO, rects_overlap, ensure_login, launch, new_context, run_dir, save_session, settle, write_json


def check(results: list, name: str, ok: bool, detail: str = "") -> None:
    results.append({"check": name, "ok": ok, "detail": detail})
    print(f"{'OK  ' if ok else 'FALLA'} {name}{f' — {detail}' if detail else ''}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--retainer", action="store_true", help="contratación mensual (genera cobros)")
    parser.add_argument("--keep", action="store_true", help="no archivar al final")
    args = parser.parse_args()
    out = run_dir("form-resilience")
    results: list = []
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    name = f"{DEMO} UX {suffix}"
    prefix = f"UX{suffix}"
    today = date.today()

    with sync_playwright() as p:
        browser = launch(p)
        page = new_context(browser, "390").new_page()
        ensure_login(page, args.base)

        # 1) Crear con error: fin anterior al inicio.
        page.goto(f"{args.base}/projects/new")
        settle(page)
        page.fill("#name", name)
        page.fill("#code_prefix", prefix)
        page.fill("#client", "Cliente UX")
        if args.retainer:
            page.get_by_role("button", name="Contratación mensual").click()
            page.fill("#monthly_fee_cop", "1000000")
            page.fill("#expected_hours_per_month", "10")
            page.fill("#contract_months", "2")
            page.fill("#billing_day", str(min(today.day, 28)))
        else:
            page.fill("#fixed_amount_cop", "2000000")
        page.fill("#start_date", today.isoformat())
        page.fill("#end_date", (today - timedelta(days=1)).isoformat())
        page.click("#contenido form button[type=submit]")
        page.wait_for_timeout(2500)
        settle(page)
        if not page.url.endswith("/projects/new"):
            sys.exit(f"Se esperaba un error de validación y la app navegó a {page.url}. Revisar a mano.")
        check(results, "error: los campos conservan lo escrito",
              page.input_value("#name") == name and page.input_value("#code_prefix") == prefix)
        check(results, "error: fecha de fin marcada", page.get_attribute("#end_date", "aria-invalid") == "true")
        page.screenshot(path=str(out / "1-error.png"))
        # Punto de quiebre conocido: en el celular el aviso tapa el botón principal.
        submit = page.locator("#contenido form button[type=submit]")
        toast = page.locator("[data-slot=toast]").first
        if toast.count() and toast.is_visible():
            t_box, b_box = toast.bounding_box(), submit.bounding_box()
            if t_box and b_box:
                overlap = rects_overlap(t_box, b_box)
                check(results, "error: el aviso no tapa el botón principal", not overlap,
                      "tapa el botón hasta que desaparece (~5 s)" if overlap else "")
        page.mouse.move(5, 5)  # como una persona: retirar el dedo/puntero y esperar
        try:
            page.locator("[data-slot=toast]").first.wait_for(state="hidden", timeout=10000)
        except Exception:
            pass

        # 2) Corregir y crear.
        page.fill("#end_date", (today + timedelta(days=60)).isoformat())
        page.click("#contenido form button[type=submit]")
        try:
            page.wait_for_url(re.compile(r"/projects/[0-9a-f-]{36}$"), timeout=20000)
            created = True
        except Exception:
            created = False
        check(results, "crear: redirige al detalle", created, page.url)
        if not created:
            page.screenshot(path=str(out / "2-no-creado.png"))
            sys.exit("No se creó el proyecto; ver captura.")
        project_url = page.url
        settle(page)
        if args.retainer:
            page.get_by_role("tab", name=re.compile(r"^Pagos")).click()
            page.wait_for_timeout(400)
            rows = page.locator("table tbody tr").all_inner_texts()
            check(results, "crear: genera los cobros mensuales", len(rows) == 2, " | ".join(r.replace("\t", " ") for r in rows))
        page.screenshot(path=str(out / "2-creado.png"))

        # 3) Editar con confirmación.
        page.goto(project_url + "/edit")
        settle(page)
        page.fill("#client", "Cliente UX editado")
        page.click("#contenido form button[type=submit]")
        dialog = page.locator("[role=alertdialog]")
        dialog.wait_for(timeout=15000)
        text = dialog.inner_text()
        check(results, "editar: la confirmación lista el cambio de cliente", "Cliente UX editado" in text, text[:160])
        page.get_by_role("button", name="Seguir editando").click()
        page.wait_for_timeout(500)
        page.goto(project_url)
        settle(page)
        check(results, "editar: cancelar no guarda", "Cliente UX editado" not in page.inner_text("main"))
        page.goto(project_url + "/edit")
        settle(page)
        page.fill("#client", "Cliente UX editado")
        page.click("#contenido form button[type=submit]")
        page.locator("[role=alertdialog]").wait_for(timeout=15000)
        page.get_by_role("button", name=re.compile(r"^Guardar")).click()
        try:
            page.wait_for_url(project_url, timeout=20000)
        except Exception:
            pass
        settle(page)
        try:
            page.get_by_text("Cliente UX editado").first.wait_for(timeout=10000)
            saved = True
        except Exception:
            saved = False
        page.screenshot(path=str(out / "3-guardado.png"))
        check(results, "editar: confirmar guarda y vuelve al detalle", saved and page.url == project_url, page.url)

        # 4) Archivar y revisar "Hoy".
        if not args.keep:
            page.get_by_role("button", name="Más acciones").first.click()
            page.get_by_role("menuitem", name="Archivar").click()
            page.locator("[role=alertdialog]").get_by_role("button", name="Archivar").click()
            try:
                page.wait_for_url(re.compile(r"/projects$"), timeout=20000)
                archived = True
            except Exception:
                archived = False
            check(results, "archivar: vuelve a la lista", archived, page.url)
            if args.retainer:
                page.goto(f"{args.base}/today")
                settle(page)
                leftovers = page.get_by_text(name).count()
                check(results, "archivar: sus cobros ya no aparecen en Hoy", leftovers == 0,
                      f"{leftovers} elementos con '{name}'")

        save_session(page)
        browser.close()

    write_json(out / "results.json", {"project": name, "results": results})
    failed = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(failed)}/{len(results)} verificaciones OK. Evidencia en {out}")


if __name__ == "__main__":
    main()
