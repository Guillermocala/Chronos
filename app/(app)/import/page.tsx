import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ImportForm } from "@/components/granola/import-form";
import { DataImport } from "@/components/import/data-import";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceDictationPanel } from "@/components/voice/voice-dictation";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { listExternalLinks } from "@/lib/data/external";
import { listProjectRates } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Importar · Chronos" };

const TABS = ["granola", "voice", "data"] as const;

export default function ImportPage({ searchParams }: PageProps<"/import">) {
  return (
    <>
      <PageHeader
        title="Importar"
        description={
          <>
            Convierte una nota de Granola o lo que dictes en tareas, o carga las actividades que
            registras en otra plataforma. ¿Cómo dictar? Mira la{" "}
            <Link href="/guide" className="underline underline-offset-4">
              guía de dictado
            </Link>
            .
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ImportContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ImportContent({ searchParams }: Pick<PageProps<"/import">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const requested = param(params.tab);
  const tab = TABS.find((t) => t === requested) ?? "granola";
  const [projects, ledenLinks] = await Promise.all([listProjectRates(), listExternalLinks("leden")]);
  const today = todayCO();
  return (
    <Tabs defaultValue={tab}>
      <TabsList>
        <TabsTrigger value="granola">Pegar o subir .md</TabsTrigger>
        <TabsTrigger value="voice">Dictar aquí</TabsTrigger>
        <TabsTrigger value="data">Cargar datos</TabsTrigger>
      </TabsList>
      <TabsContent value="granola" className="pt-4">
        <ImportForm projects={projects} today={today} />
      </TabsContent>
      <TabsContent value="voice" className="pt-4">
        <VoiceDictationPanel projects={projects} today={today} inline />
      </TabsContent>
      <TabsContent value="data" className="pt-4">
        <DataImport projects={projects} savedLinks={{ leden: ledenLinks }} defaultFormat={param(params.format)} />
      </TabsContent>
    </Tabs>
  );
}
