"""Recorre las pantallas principales en 360, 390 y 1280 px (solo lectura).

    python layout_scan.py [--base URL] [--widths 360,390,1280]

Detecta desborde horizontal de la página, abre los diálogos del proyecto (sin guardar)
y el menú lateral, y guarda capturas + report.json en .ux/runs/<fecha>/layout/.
"""

from __future__ import annotations

import argparse
import re

from playwright.sync_api import sync_playwright

from common import DEFAULT_BASE, discover, ensure_login, horizontal_overflow, launch, new_context, run_dir, save_session, settle, write_json

DESKTOP_ONLY = {"project", "reports"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--widths", default="360,390,1280")
    args = parser.parse_args()
    out = run_dir("layout")
    report = []

    with sync_playwright() as p:
        browser = launch(p)
        context = new_context(browser)
        page = context.new_page()
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        ensure_login(page, args.base)
        found = discover(page, args.base)
        print("Recorrido:", {k: v for k, v in found.items() if k != "project_is_demo"})
        screens = [("today", "/today"), ("projects", "/projects"), ("tasks", "/tasks"), ("notes", "/notes"),
                   ("reports", "/reports"), ("backups", "/settings/backups")]
        for key in ("project", "sprint", "ticket"):
            if found[key]:
                screens.insert(2, (key, found[key]))

        def capture(name: str, width: str, full: bool) -> None:
            settle(page)
            info = horizontal_overflow(page)
            page.screenshot(path=str(out / f"{width}-{name}.png"), full_page=full)
            report.append({"screen": name, "width": width, **info})
            status = f"DESBORDA ({info['scrollWidth']}px) {info['offenders'][:2]}" if info["overflow"] else "ok"
            print(f"{width:>4} {name}: {status}")

        storage = context.storage_state()
        context.close()
        for width in args.widths.split(","):
            mobile = width != "1280"
            ctx = new_context(browser, width, storage_state=storage)
            page = ctx.new_page()
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            for name, path in screens:
                if not mobile and name not in DESKTOP_ONLY:
                    continue
                page.goto(args.base + path)
                capture(name, width, mobile)
                if name == "project":
                    tab = page.get_by_role("tab", name=re.compile(r"^Pagos"))
                    if tab.count():
                        tab.first.click()
                        capture("project-pagos", width, mobile)
                    if mobile:
                        triggers = page.locator("button[aria-haspopup=dialog]")
                        for i in range(min(triggers.count(), 4)):
                            trigger = triggers.nth(i)
                            text = trigger.inner_text().strip() or trigger.get_attribute("aria-label") or f"dialogo{i}"
                            label = re.sub(r"\W+", "_", text)[:30]
                            trigger.click()
                            page.wait_for_timeout(500)
                            if page.locator("[role=dialog],[role=alertdialog]").count():
                                capture(f"project-dialog-{label}", width, False)
                            page.keyboard.press("Escape")
                            page.wait_for_timeout(300)
            if mobile:
                page.goto(args.base + "/today")
                settle(page)
                toggle = page.locator("[data-sidebar=trigger]")
                if toggle.count():
                    toggle.first.click()
                    page.wait_for_timeout(500)
                    capture("menu", width, False)
            save_session(page)
            ctx.close()
        browser.close()

    write_json(out / "report.json", {"found": found, "screens": report, "console_errors": sorted(set(console_errors))[:20]})
    overflowing = [r for r in report if r["overflow"]]
    print(f"\n{len(report)} capturas en {out}. Desbordes: {len(overflowing)}. Errores de consola: {len(set(console_errors))}.")


if __name__ == "__main__":
    main()
