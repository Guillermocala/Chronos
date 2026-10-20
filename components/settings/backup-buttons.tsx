"use client";

import { DatabaseBackupIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { dispatchBackup } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action-toast";

export function BackupButtons({ canDispatch, running }: { canDispatch: boolean; running: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const disabled = pending || running || !canDispatch;

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled} onClick={() => run(() => dispatchBackup("incremental"))}>
        <DatabaseBackupIcon data-icon="inline-start" />
        Backup incremental
      </Button>
      <Button variant="outline" disabled={disabled} onClick={() => run(() => dispatchBackup("full"))}>
        Backup completo
      </Button>
      <Button variant="ghost" onClick={() => router.refresh()}>
        <RefreshCwIcon data-icon="inline-start" />
        Actualizar
      </Button>
      <Button variant="ghost" nativeButton={false} render={<a href="/api/export" download />}>
        <DownloadIcon data-icon="inline-start" />
        Descargar mis datos (JSON)
      </Button>
    </div>
  );
}
