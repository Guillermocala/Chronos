/** README.md del repo chronos-backups: estructura y cómo restaurar. */
export const BACKUP_README = `# chronos-backups

Backups automáticos de [Chronos](https://github.com/Guillermocala/Chronos). **No editar a mano.**

## Estructura
- \`manifest.json\`: último cambio y hash de cada proyecto (para el backup incremental).
- \`projects/<prefijo>/*.json\`: datos de cada proyecto (incluye filas archivadas o borradas con soft delete).
- \`global/*.json\`: tareas y notas sin proyecto.
- \`schema/\`: migraciones SQL de Chronos (la estructura de la base).
- \`summaries/AAAA-MM-DD-resumen.md\`: resumen de cada backup.

El historial de git conserva todas las versiones anteriores.

## Restaurar
1. Crear un proyecto nuevo en Supabase (o usar el existente).
2. En el repo de Chronos: \`npx supabase link --project-ref <ref>\` y \`npm run db:push\` (crea las tablas).
3. Crear el usuario en Supabase (Authentication → Users) y copiar su UUID.
4. Generar el SQL de restauración desde el repo de Chronos:
   \`\`\`bash
   npx tsx scripts/restore.ts --from ../chronos-backups --user-id <UUID>            # todo
   npx tsx scripts/restore.ts --from ../chronos-backups --user-id <UUID> --project web  # un proyecto
   \`\`\`
   Esto crea \`restore.sql\`. Revísalo y ejecútalo en el SQL Editor de Supabase, o agrega
   \`--apply\` con la variable \`SUPABASE_DB_URL\` para aplicarlo directamente.
5. La restauración es idempotente (upsert por id) y desactiva los triggers mientras corre:
   los códigos de ticket, el tipo de cada ticket y los seguimientos quedan como estaban.
`;
