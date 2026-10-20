import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ImportForm } from "@/components/granola/import-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { listProjectOptions } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Importar dictado · Chronos" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Importar dictado"
        description={
          <>
            Convierte una nota de Granola en tareas, seguimientos y candidatos a ticket. ¿Cómo dictar?
            Mira la{" "}
            <Link href="/guide" className="underline underline-offset-4">
              guía de dictado
            </Link>
            .
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ImportContent />
      </Suspense>
    </>
  );
}

async function ImportContent() {
  await requireUser();
  const projects = await listProjectOptions();
  return <ImportForm projects={projects} today={todayCO()} />;
}
