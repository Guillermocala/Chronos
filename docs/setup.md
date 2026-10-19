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
| `GITHUB_MCP_PAT` | Token fine-grained de GitHub con acceso de lectura a los repos Chronos y chronos-backups |

En Windows (PowerShell, una sola vez; reiniciar VS Code después):
```powershell
[Environment]::SetEnvironmentVariable("SUPABASE_PROJECT_REF", "<ref>", "User")
[Environment]::SetEnvironmentVariable("GITHUB_MCP_PAT", "<token>", "User")
```
- **Supabase** y **Vercel** piden iniciar sesión con OAuth la primera vez: se abre el navegador desde el comando `/mcp` de Claude Code.
- Supabase arranca en `read_only=true`. Cuando empiece la fase de migraciones, se quita ese parámetro de `.mcp.json`.

## 4. Skills de Claude Code
Están en `.claude/skills/` y versionadas en `skills-lock.json`:
- `supabase`: esquemas, migraciones, RLS, Auth
- `vercel-react-best-practices`: rendimiento en React/Next.js
- `vercel-composition-patterns`: patrones de componentes
- `web-design-guidelines`: revisión de UI y accesibilidad

Para actualizarlas: `npx skills update`.

## 5. Servicios en la nube (ya creados)

### Supabase
- [ ] En Auth → Sign In / Providers, desactivar "Allow new users to sign up"
- [ ] Activar Email (magic link). GitHub OAuth es opcional.
- [ ] Crear el único usuario manualmente: Auth → Users → Add user
- [ ] En Auth → URL Configuration, poner como Site URL el dominio de Vercel y en Redirect URLs `https://<dominio>/**` y `http://localhost:3000/**`

### Vercel (plan Hobby)
- [ ] Proyecto importado desde GitHub (Framework: Next.js; el resto de valores por defecto)
- [ ] Settings → Environment Variables: las de `.env.example`

### GitHub
- [ ] El repo privado `chronos-backups` existe
- [ ] Secrets de Actions en Chronos: `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUPS_REPO_TOKEN`. Se usan en la fase de backups.

## Nota sobre OneDrive
El proyecto está dentro de OneDrive. Conviene excluir `node_modules/` y `.next/` de la sincronización: clic derecho → "Liberar espacio", o mover el repo fuera de OneDrive. Git ya es el respaldo del código.
