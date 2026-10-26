"""Flujos de formulario que NO guardan nada.

    python flows_readonly.py [--base URL]

1. Crear proyecto con un prefijo inválido ("1A"): el servidor lo rechaza. Se espera que
   los campos conserven lo escrito y que el prefijo quede marcado y con foco.
2. Editar un proyecto ([DEMO] si hay) sin cambios → "Revisar y guardar" → confirmación →
   "Seguir editando". Se espera que nada se guarde.
"""

from __future__ import annotations

import argparse

from playwright.sync_api import sync_playwright

from common import DEFAULT_BASE, discover, rects_overlap, ensure_login, launch, new_context, run_dir, save_session, settle, write_json

CREATE_VALUES = {
    "#name": "[DEMO] UX validación (no se guarda)",
    "#code_prefix": "1A",  # inválido a propósito: debe empezar con letra
    "#client": "Cliente UX",
    "#fixed_amount_cop": "1500000",
    "#estimated_total_hours": "40",
}


def check(results: list, name: str, ok: bool, detail: str = "") -> None:
    results.append({"check": name, "ok": ok, "detail": detail})
    print(f"{'OK  ' if ok else 'FALLA'} {name}{f' — {detail}' if detail else ''}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE)
    args = parser.parse_args()
    out = run_dir("flows-readonly")
    results: list = []

    with sync_playwright() as p:
        browser = launch(p)
        page = new_context(browser, "390").new_page()
        ensure_login(page, args.base)

        # 1) Error de validación al crear: no debe perderse lo escrito.
        page.goto(f"{args.base}/projects/new")
        settle(page)
        for selector, value in CREATE_VALUES.items():
            page.fill(selector, value)
        page.click("#contenido form button[type=submit]")
        page.wait_for_timeout(2500)
        settle(page)
        check(results, "crear: sigue en /projects/new (no se guardó)", page.url.endswith("/projects/new"), page.url)
        values = {sel: page.input_value(sel) for sel in CREATE_VALUES}
        lost = [sel for sel, v in values.items() if not v]
        check(results, "crear: los campos conservan lo escrito", not lost, f"vacíos: {lost}" if lost else "")
        check(results, "crear: prefijo marcado con aria-invalid",
              page.get_attribute("#code_prefix", "aria-invalid") == "true")
        check(results, "crear: el foco quedó en el prefijo",
              page.evaluate("document.activeElement?.id") == "code_prefix")
        toast = page.locator("[data-slot*=toast], [role=status]").all_inner_texts()
        check(results, "crear: se muestra el motivo del error", any("prefijo" in t.lower() for t in toast), " | ".join(toast)[:120])
        page.screenshot(path=str(out / "crear-error.png"))
        toast_box = page.locator("[data-slot=toast]").first.bounding_box() if page.locator("[data-slot=toast]").count() else None
        submit_box = page.locator("#contenido form button[type=submit]").bounding_box()
        if toast_box and submit_box:
            overlap = rects_overlap(toast_box, submit_box)
            check(results, "crear: el aviso de error no tapa el botón principal", not overlap,
                  "lo tapa hasta que el aviso se cierra" if overlap else "")

        # 2) Editar → confirmación → cancelar.
        found = discover(page, args.base)
        if not found["project"]:
            check(results, "editar: hay un proyecto para probar", False, "la cuenta no tiene proyectos")
        else:
            page.goto(f"{args.base}{found['project']}/edit")
            settle(page)
            page.click("#contenido form button[type=submit]")
            dialog = page.locator("[role=alertdialog]")
            try:
                dialog.wait_for(timeout=15000)
                opened = True
            except Exception:
                opened = False
            check(results, "editar: abre la confirmación antes de guardar", opened)
            if opened:
                text = dialog.inner_text()
                page.screenshot(path=str(out / "editar-confirmacion.png"))
                print("\n--- Confirmación ---\n" + text + "\n--------------------")
                results.append({"check": "editar: contenido del diálogo", "ok": True, "detail": text})
                cancel = page.get_by_role("button", name="Seguir editando")
                if not cancel.count():
                    cancel = page.get_by_role("button", name="Cerrar")
                cancel.first.click()
                page.wait_for_timeout(600)
                check(results, "editar: cancelar cierra sin salir del formulario",
                      page.url.endswith("/edit") and not page.locator("[role=alertdialog]").count(), page.url)

        save_session(page)
        browser.close()

    write_json(out / "results.json", results)
    failed = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(failed)}/{len(results)} verificaciones OK. Evidencia en {out}")


if __name__ == "__main__":
    main()
