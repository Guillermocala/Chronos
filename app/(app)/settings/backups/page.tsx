import { DatabaseBackupIcon, InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Markdown } from "@/components/markdown";
import { BackupButtons } from "@/components/settings/backup-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { isBackupRunning, listBackupRuns, type BackupRun } from "@/lib/data/backups";
import { githubEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Backups · Chronos" };

const STATUS: Record<BackupRun["status"], { label: string; variant: "secondary" | "destructive" | "outline" }> = {
  running: { label: "En curso", variant: "outline" },
  success: { label: "Correcto", variant: "secondary" },
  failed: { label: "Falló", variant: "destructive" },
};

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export default function BackupsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BackupsContent />
    </Suspense>
  );
}

async function BackupsContent() {
  await requireUser();
  const runs = await listBackupRuns();
  const { GITHUB_DISPATCH_TOKEN, GITHUB_REPOSITORY } = githubEnv();
  const owner = GITHUB_REPOSITORY.split("/")[0];
  const running = isBackupRunning(runs);
  const lastWithSummary = runs.find((r) => r.status === "success" && r.summary_md);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Copias de seguridad</CardTitle>
          <CardDescription>
            Automático cada domingo a las 10 p. m. (completo el primer domingo del mes) hacia el repo
            privado <code>{owner}/chronos-backups</code>. Solo se copian los proyectos que cambiaron.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!GITHUB_DISPATCH_TOKEN && (
            <Alert>
              <InfoIcon />
              <AlertTitle>Backup manual sin configurar</AlertTitle>
              <AlertDescription>
                Agrega <code>GITHUB_DISPATCH_TOKEN</code> en Vercel (ver docs/setup.md). El backup
                automático funciona igual desde GitHub Actions.
              </AlertDescription>
            </Alert>
          )}
          <BackupButtons canDispatch={!!GITHUB_DISPATCH_TOKEN} running={running} />
        </CardContent>
      </Card>

      {runs.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseBackupIcon />
            </EmptyMedia>
            <EmptyTitle>Aún no hay backups</EmptyTitle>
            <EmptyDescription>
              Lanza el primero con “Backup incremental” o desde GitHub → Actions → Backup.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Proyectos</TableHead>
                  <TableHead>Commit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap">{dateTime.format(new Date(run.started_at))}</TableCell>
                    <TableCell>
                      {run.mode === "full" ? "Completo" : "Incremental"} ·{" "}
                      {run.trigger === "manual" ? "manual" : "automático"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[run.status].variant} title={run.error ?? undefined}>
                        {STATUS[run.status].label}
                      </Badge>
                      {run.error && (
                        <span className="block max-w-64 truncate text-xs text-destructive">{run.error}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.status === "success" ? `${run.projects_exported} / ${run.projects_exported + run.projects_skipped}` : "—"}
                    </TableCell>
                    <TableCell>
                      {run.commit_sha ? (
                        <a
                          href={`https://github.com/${owner}/chronos-backups/commit/${run.commit_sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs underline"
                        >
                          {run.commit_sha.slice(0, 7)}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {run.status === "success" ? "sin cambios" : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {lastWithSummary?.summary_md && (
        <Card>
          <CardHeader>
            <CardTitle>Último resumen</CardTitle>
            <CardDescription>{dateTime.format(new Date(lastWithSummary.started_at))}</CardDescription>
          </CardHeader>
          <CardContent>
            <Markdown>{lastWithSummary.summary_md}</Markdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
