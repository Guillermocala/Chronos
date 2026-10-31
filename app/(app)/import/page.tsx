import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ImportForm } from "@/components/granola/import-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceDictationPanel } from "@/components/voice/voice-dictation";
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
            Convierte una nota de Granola o lo que dictes aquí en tareas, seguimientos y candidatos
            a ticket. ¿Cómo dictar? Mira la{" "}
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
  const today = todayCO();
  return (
    <Tabs defaultValue="granola">
      <TabsList>
        <TabsTrigger value="granola">Pegar o subir .md</TabsTrigger>
        <TabsTrigger value="voice">Dictar aquí</TabsTrigger>
      </TabsList>
      <TabsContent value="granola" className="pt-4">
        <ImportForm projects={projects} today={today} />
      </TabsContent>
      <TabsContent value="voice" className="pt-4">
        <VoiceDictationPanel projects={projects} today={today} inline />
      </TabsContent>
    </Tabs>
  );
}
