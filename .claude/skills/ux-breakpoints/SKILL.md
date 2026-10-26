---
name: ux-breakpoints
description: Prueba la experiencia de Chronos en vivo (sesión iniciada, navegador real) buscando puntos de quiebre de UX como formularios que se vacían tras un error, cambios sin confirmación, desbordes en el celular, vistas incoherentes tras archivar o configuración local rota. Úsala para "probar la experiencia", "revisar UX en vivo", "verificar en el celular" o después de cambiar formularios, diálogos, layout o flujos de datos. Complementa a webapp-testing (Playwright) con el catálogo y las reglas de seguridad de este proyecto.
---

# UX breakpoints (Chronos)

Pruebas de experiencia sobre la app corriendo, con la cuenta del usuario. Usa Playwright
para Python (skill `webapp-testing`) con el Chrome del sistema (`channel="chrome"`).

## Reglas de seguridad (obligatorias)
La app local y la de producción usan **la misma base de Supabase**: todo lo que se guarde es real.
- **Solo se escribe sobre elementos `[DEMO]`** (nombre o título que empieza con `[DEMO]`).
  Fuera de eso, solo lectura: navegar, abrir diálogos y cerrarlos con Escape o "Cancelar",
  y enviar formularios **que el servidor va a rechazar** (validación forzada).
- Nunca archivar, borrar, marcar como recibido ni editar algo que no sea `[DEMO]`.
- No tocar Ajustes → Backups (lanza un workflow) ni Ajustes → Cuenta (contraseña).
- **Nunca abrir ni imprimir** `.env*` ni `.ux/auth.json`. Los scripts leen las credenciales
  (`USER_EMAIL`, `USER_PASSWORD`) por su cuenta y nunca las muestran.
- Si un flujo pide un dato real (un proyecto existente), elegir uno `[DEMO]`; si no hay,
  usar el existente solo en modo lectura.

## Flujo
1. **Servidor.** `python .claude/skills/ux-breakpoints/scripts/server.py start` (build de
   producción + `next start` en el puerto 3125; `--no-build` si ya está compilado). Al final:
   `server.py stop`. En Windows no usar `with_server.py` de webapp-testing: no detiene el
   proceso de node hijo.
2. **Lectura general.** `scripts/layout_scan.py` recorre las pantallas a 360, 390 y 1280 px,
   detecta desborde horizontal y guarda capturas en `.ux/runs/<fecha>/layout/`.
3. **Flujos sin escritura.** `scripts/flows_readonly.py`: error de validación al crear
   proyecto (los campos deben conservarse) y vista previa al editar (se cancela).
4. **Flujos con escritura `[DEMO]`.** `scripts/form_resilience.py` crea un proyecto `[DEMO] UX …`,
   provoca un error, lo corrige, lo edita con confirmación y al final lo archiva.
   `--retainer` agrega mensualidades para revisar la coherencia de "Hoy" tras archivar.
5. **Exploración guiada.** Para lo que los scripts no cubren, recorrer [checklist.md](checklist.md)
   con Playwright (patrón de webapp-testing: esperar `networkidle`, capturar, inspeccionar,
   actuar). Mirar las capturas: un script que dice "ok" no reemplaza verlas.
6. **Reporte.** `.ux/reports/AAAA-MM-DD-<tema>.md` con [report-template.md](report-template.md):
   hallazgos por severidad, pasos para reproducir, esperado vs. obtenido, captura y archivo
   sospechoso. Separar lo verificado en vivo de lo inferido del código.

Todos los scripts aceptan `--base URL` (por defecto `http://localhost:3125`) y escriben en
`.ux/` (ignorado por git). La sesión se guarda en `.ux/auth.json` para no iniciar sesión en
cada corrida; si caduca, el script vuelve a iniciar sesión.

## Si el login falla
"Credenciales inválidas" con credenciales correctas suele ser configuración:
`NEXT_PUBLIC_SUPABASE_URL` debe ser solo el dominio (sin `/rest/v1`). Las variables
`NEXT_PUBLIC_*` se fijan al compilar: tras corregirlas, volver a hacer build.
