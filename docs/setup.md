# Configuración del entorno

Guía para dejar Chronos listo en cualquier equipo. Las decisiones de arquitectura están en [architecture.md](architecture.md).

## Requisitos locales
- Node 22+ (probado con 24) y npm
- Git
- VS Code con la extensión de Claude Code
- Opcional: Docker Desktop, solo si se quiere una base de datos local con `npx supabase start`

## 1. Clonar e instalar
```bash
git clone https://github.com/Guillermocala/Chronos.git
cd Chronos
npm install
```

## 2. Variables de entorno
Los valores reales viven en Vercel. Para traerlos al equipo:
```bash
npx vercel login
npx vercel link          # elegir el proyecto Chronos
npx vercel env pull .env.local
```
La lista de variables está en `.env.example`. No se suben al repo (`.gitignore` ignora `.env*`).

## 3. MCP de Claude Code (`.mcp.json`)
El repo trae configurados tres servidores. Necesitan estas variables en el **entorno del sistema** (no en `.env.local`), porque Claude Code las lee al arrancar:

| Variable | Valor |
|---|---|
| `SUPABASE_PROJECT_REF` | El id del proyecto (Supabase → Project Settings → General → Reference ID) |
| `GITHUB_MCP_PAT` | Token fine-grained de GitHub con acceso de lectura a los repos Chronos y chronos-backups. Sin ella, el MCP de GitHub falla con "Authorization header is badly formatted". |

En Windows (PowerShell, una sola vez; reiniciar VS Code después):
```powershell
[Environment]::SetEnvironmentVariable("SUPABASE_PROJECT_REF", "<ref>", "User")
[Environment]::SetEnvironmentVariable("GITHUB_MCP_PAT", "<token>", "User")
```
- **Supabase** y **Vercel** piden iniciar sesión con OAuth la primera vez: se abre el navegador desde el comando `/mcp` de Claude Code.
- Supabase arranca en `read_only=true`. Las migraciones se aplican con el CLI (`npm run db:push`), no con el MCP.

## 4. Skills de Claude Code
Están en `.claude/skills/` y versionadas en `skills-lock.json`:
- `supabase`: Auth, clientes SSR, Data API y seguridad de Supabase
- `supabase-postgres-best-practices`: tablas, migraciones, RLS, índices, triggers y funciones
- `vercel-react-best-practices`: rendimiento en React/Next.js
- `vercel-composition-patterns`: patrones de componentes
- `web-design-guidelines`: revisión de UI y accesibilidad
- `shadcn` (oficial de shadcn/ui): agregar, componer y personalizar componentes
- `vitest` (de antfu, que mantiene Vitest): tests unitarios, mocks y configuración
- `webapp-testing` (oficial de Anthropic): manejar la app en un navegador real con Playwright para Python
- `ux-breakpoints` (propia, no viene de `skills-lock.json`): pruebas de experiencia en vivo con sesión iniciada, con el catálogo de fallas de Chronos, scripts y formato de reporte

### Pruebas de UX en vivo (`ux-breakpoints`)
- Requisitos: Python 3 con `python -m pip install --user playwright`. Usa el Chrome instalado (`channel="chrome"`), así que no hace falta `playwright install`.
- Credenciales: `USER_EMAIL` y `USER_PASSWORD` en `.env`. Los scripts las leen y nunca las imprimen. La sesión queda en `.ux/auth.json` (ignorado por git, igual que capturas y reportes en `.ux/`).
- **La base es la misma de producción:** las pruebas solo escriben sobre elementos `[DEMO]`; el resto es solo lectura.
- Uso: `python .claude/skills/ux-breakpoints/scripts/server.py start`, luego `layout_scan.py`, `flows_readonly.py` y `form_resilience.py` (en la misma carpeta), y al final `server.py stop`.

Para Next.js 16 no hace falta skill: la documentación de la versión instalada está en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
Opcional: `vercel/next.js@next-dev-loop` verifica la app en ejecución, pero requiere `npm i -g agent-browser`.

**Regla:** al incorporar una tecnología nueva, buscar su skill oficial con `npx skills find <tecnología>`, revisar su contenido y agregarla con `--agent claude-code`.
Con Node 20, la CLI actual de `skills` (1.7, pide Node ≥ 22.20) no arranca: usar `npx skills@1.4.9 …` hasta actualizar Node.

Para actualizarlas: `npx skills update`.

## 5. Servicios en la nube

### Supabase: datos a anotar (gestor de contraseñas)
- **Reference ID**: *Project Settings → General*
- **Project URL**: *Project Settings → Data API*
- **Publishable key** (`sb_publishable_...`) y **Secret key** (`sb_secret_...`): *Project Settings → API Keys*. La secret key **nunca** va a Vercel ni al navegador.
- **Contraseña de la base de datos**: si se olvidó, *Project Settings → Database → Reset database password*

### Supabase: Auth
- [ ] *Authentication → Sign In / Providers*: Email activado y **Allow new users to sign up = OFF**
- [ ] *Authentication → Users → Add user → Create new user*: email + contraseña + **Auto Confirm User**
- [ ] *Authentication → URL Configuration*: Site URL = `https://<proyecto>.vercel.app`; Redirect URLs = `https://<proyecto>.vercel.app/**` y `http://localhost:3000/**`

### Supabase: base de datos
Las tablas **no se crean en el dashboard**. Salen de las migraciones en `supabase/migrations/`:
```bash
npx supabase login                          # abre el navegador
npx supabase link --project-ref <ref>       # pide la contraseña de la DB
npm run db:push                             # aplica las migraciones pendientes
npm run db:types                            # regenera lib/supabase/database.types.ts
```

### Vercel (plan Hobby)
- [ ] Proyecto importado desde GitHub (Framework: Next.js)
- [ ] *Settings → Environment Variables*: las de `.env.example`. Las `NEXT_PUBLIC_*` llevan visibilidad `config`; `CRON_SECRET` y `GITHUB_DISPATCH_TOKEN` van como `secret`.
- [ ] Después del deploy, *Settings → Cron Jobs* muestra `/api/health`. Con "Run" se prueba a mano.

### GitHub: backups
El workflow `.github/workflows/backup.yml` copia los datos al repo privado `chronos-backups`:
- **automático:** domingo 10 p. m. (hora de Colombia);
- **manual:** desde Ajustes → Backups, o desde *Actions → Backup → Run workflow*.

1. **Repo de destino:** en github.com → *New repository* → nombre `chronos-backups`, **Private**. Puede quedar vacío.
2. **Token para escribir en el repo de backups:**
   - Avatar → *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   - Nombre `chronos-backups-writer`; *Repository access: Only select repositories* → `chronos-backups`.
   - *Permissions → Repository permissions → Contents: Read and write*.
   - Generarlo y copiarlo.
3. **Secrets de Actions** en el repo **Chronos** (*Settings → Secrets and variables → Actions → New repository secret*):
   - `BACKUPS_REPO_TOKEN`: el token del paso 2.
   - `SUPABASE_DB_URL`: en Supabase, *Connect* (botón arriba) → *Session pooler* → copiar la URI y reemplazar `[YOUR-PASSWORD]` por la contraseña de la base.
   - `BACKUP_USER_EMAIL`: tu email de login en Chronos.
4. **Token para el botón manual:**
   - Otro fine-grained token, `chronos-backup-dispatch`.
   - Acceso solo al repo `Chronos`, con *Permissions → Actions: Read and write*.
   - Guardarlo en **Vercel** como `GITHUB_DISPATCH_TOKEN` (visibilidad `secret`) y hacer *Redeploy*.
5. **Probar:** en Chronos → *Actions → Backup → Run workflow*.
   - Debe aparecer un commit en `chronos-backups` con `summaries/AAAA-MM-DD-resumen.md`.
   - En la app debe aparecer en *Ajustes → Backups*.

Cómo restaurar: ver el `README.md` dentro de `chronos-backups` (`npx tsx scripts/restore.ts …`).

## Nota sobre OneDrive
El proyecto está dentro de OneDrive. Conviene excluir `node_modules/` y `.next/` de la sincronización: clic derecho → "Liberar espacio", o mover el repo fuera de OneDrive. Git ya es el respaldo del código.

## Dar acceso a otra persona (usuario de prueba)
Cada usuario tiene **su propio espacio vacío**: no ve tus proyectos, pagos ni tickets.
1. En Vercel, *Settings → Environment Variables* → `ALLOWED_EMAILS` = `tu@correo.com, ayudante@correo.com`. **Tu correo va primero**: el primero es el dueño y el único que puede lanzar backups. Si existe la variable anterior `ALLOWED_EMAIL`, puedes borrarla. Luego haz *Redeploy*.
2. En Supabase, *Authentication → Users → Add user → Create new user* → su email, una **contraseña temporal** de 12 caracteres o más y **Auto Confirm User** marcado.
3. Envíale la contraseña por un canal seguro. Al entrar, la cambia en **Ajustes → Cuenta**.
4. Para quitarle el acceso, sácalo de `ALLOWED_EMAILS` y haz *Redeploy*. Si quieres borrar también su usuario, ve a Supabase → *Users* → ⋯ → *Delete user*.

Los backups automáticos solo copian los datos del dueño (`BACKUP_USER_EMAIL`).

### Datos de prueba
Para llenar el espacio de un usuario con proyectos de ejemplo (todo marcado `[DEMO]`):
1. Agrega `SUPABASE_DB_URL` (la misma URI del secreto de GitHub) a `.env.local`.
2. `npm run db:seed-demo -- --email persona@correo.com` genera `seed-demo.sql` para revisarlo. Agrega `--apply` para ejecutarlo.
3. Para retirarlos (soft delete): `npm run db:seed-demo -- --email persona@correo.com --reset --apply`.

Escenarios incluidos: un mensual en curso con cobros recibidos y vencidos, un mensual con fechas de la regla anterior (al editarlo, la confirmación propone corregirlas), un mensual que empieza hoy, uno de precio fijo con sprints, tickets, horas y una nota de reunión, y uno entregado en soporte.

## Instalar Chronos en el celular (PWA)
- **Android (Chrome):** abre el sitio → menú ⋮ → **Instalar app**.
- **iPhone (Safari):** abre el sitio → botón Compartir → **Agregar a inicio**.

Abre directo en **Hoy**, sin la barra del navegador. Si mantienes presionado el ícono aparecen los atajos "Nueva tarea" e "Importar dictado". Sin conexión se muestra una página de aviso: los datos siempre se leen en vivo y no se guardan en el teléfono.

Para cambiar el logo, reemplaza `public/icons/chronos-logo.jpg` (cuadrado, trazo claro sobre fondo oscuro), ajusta `ICON_BACKGROUND` en `lib/pwa/icon.ts` si cambia el fondo y ejecuta `npx tsx scripts/generate-icons.ts`.
