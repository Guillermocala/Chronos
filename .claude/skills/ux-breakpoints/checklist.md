# Catálogo de puntos de quiebre

Cada punto: **cómo provocarlo** → **qué se espera**. Los marcados con (script) ya los cubre
un script de `scripts/`.

## Formularios
- (script) Enviar con un dato inválido que solo valida el servidor (prefijo `1A`, fin antes
  del inicio, URL de Drive que no es carpeta) → aviso de error, **los campos conservan lo
  escrito**, el campo culpable queda con `aria-invalid` y foco.
- Doble clic rápido en el botón principal → un solo envío (botón deshabilitado y spinner).
- Éxito en formularios rápidos (ticket rápido, registrar horas) → se limpian **solo** tras guardar.
- Error de red al enviar (simular con `page.route("**/*", lambda r: r.abort())` justo antes)
  → aviso entendible y nada se pierde.
- Diálogos de creación (ticket, sprint, pago, tarea recurrente): repetir el caso de error.

## Cambios con impacto
- (script) Editar un proyecto → confirmación con los campos que cambian y los cobros
  que se quitan/agregan; aviso si algún cobro queda en el pasado.
- (script) "Seguir editando" / Cancelar → nada se guarda.
- Acciones destructivas (archivar, borrar horas, borrar pago) → aviso con "Deshacer" que funciona.

## Coherencia entre vistas
- (script, `--retainer`) Archivar un proyecto → sus cobros dejan de aparecer en "Hoy",
  "Tareas" y en los totales de reportes.
- Crear/editar algo → la vista de origen se actualiza sin recargar.
- Marcar un pago como recibido → la tarea "Cobrar…" se completa y los totales cambian.
- Duplicados visibles (dos tareas iguales, dos proyectos con el mismo nombre) → investigar el origen.

## Datos y fechas
- Montos en COP sin decimales (`$ 1.500.000`).
- "Hoy" según hora de Colombia (probar cerca de medianoche UTC si aplica).
- Mensualidades: el primer cobro cae el mes siguiente al inicio, en el día de cobro.
- Plurales correctos ("1 pago", "2 pagos").

## Navegación
- Tras crear → redirige al detalle. Atrás del navegador no reenvía el formulario.
- Id inexistente (`/projects/00000000-0000-0000-0000-000000000000`) → 404 amable.
- Sin sesión → cualquier ruta interna lleva a `/login`; tras entrar, a `/today`.

## Layout (360, 390, 1280 px)
- (script) Sin desborde horizontal de la página.
- Pestañas, tablero y tablas con scroll propio; se nota que hay más contenido.
- Diálogos con el botón principal alcanzable (alto máximo + scroll).
- Montos grandes y títulos largos no se cortan ni se salen.
- Menú lateral: se abre y cierra con el botón y con Escape.

## Estados
- Vacío (cuenta o proyecto sin datos) → mensaje y acción sugerida.
- Cargando → skeleton o spinner, sin saltos bruscos.
- Sin conexión → página "Sin conexión" (solo en producción, por el service worker).

## Accesibilidad básica
- Foco visible al tabular; orden lógico; Escape cierra diálogos y menús.
- "Saltar al contenido" funciona.
- Errores anunciados (`role="alert"` o toast) y campos con `aria-invalid`.

## Entorno y configuración
- Login local con credenciales correctas → entra. Si responde "Credenciales inválidas",
  revisar `NEXT_PUBLIC_SUPABASE_URL` (solo dominio) y recompilar.
- Avisos en la consola del navegador (`page.on("console")`) durante el recorrido.
