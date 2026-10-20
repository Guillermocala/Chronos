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

Para Next.js 16 no hace falta skill: la documentación de la versión instalada está en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
Opcional: `vercel/next.js@next-dev-loop` verifica la app en ejecución, pero requiere `npm i -g agent-browser`.

**Regla:** al incorporar una tecnología nueva, buscar su skill oficial con `npx skills find <tecnología>`, revisar su contenido y agregarla con `--agent claude-code`.

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

### GitHub
- [ ] Repo privado `chronos-backups` creado
- [ ] Secrets de Actions en Chronos (fase de backups):
  - `SUPABASE_SECRET_KEY`
  - `SUPABASE_DB_URL`: *Connect → Session pooler*, con la contraseña
  - `BACKUPS_REPO_TOKEN`

## Nota sobre OneDrive
El proyecto está dentro de OneDrive. Conviene excluir `node_modules/` y `.next/` de la sincronización: clic derecho → "Liberar espacio", o mover el repo fuera de OneDrive. Git ya es el respaldo del código.
