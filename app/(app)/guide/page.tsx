import type { Metadata } from "next";
import { Suspense } from "react";

import { CopyButton } from "@/components/granola/copy-button";
import { DictationTester } from "@/components/granola/dictation-tester";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { todayCO } from "@/lib/dates";
import { listProjectOptions } from "@/lib/data/projects";
import {
  DATE_WORDS,
  DICTATION_EXAMPLES,
  GRANOLA_INSTRUCTIONS,
  MARKERS,
  SECTION_ALIASES,
  SECTION_LABELS,
  meetingTemplate,
  myDayTemplate,
  type SectionType,
} from "@/lib/granola/conventions";

export const metadata: Metadata = { title: "Guía de dictado · Chronos" };

// Fecha de ejemplo fija para que las plantillas sean parte del shell estático.
const SAMPLE_DATE = "AAAA-MM-DD";

const SECTION_HELP: Record<SectionType, string> = {
  task: "Cosas que tú debes hacer.",
  follow_up: "Cosas que esperas de otra persona.",
  ticket: "Trabajo de desarrollo de un proyecto (se convertirá en ticket).",
  notes: "Resumen y contexto: no crea pendientes.",
};

export default function GuidePage() {
  return (
    <>
      <PageHeader
        title="Guía de dictado"
        description="Cómo dictarle a Granola tus tareas para que Chronos las entienda al importarlas."
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Configura Granola</CardTitle>
          <CardDescription>
            En Granola, crea una plantilla (por ejemplo “Chronos”) y pega este texto como
            instrucciones. Úsala al dictar tu día o en reuniones.
          </CardDescription>
          <CardAction>
            <CopyButton text={GRANOLA_INSTRUCTIONS} label="Copiar instrucciones" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
            {GRANOLA_INSTRUCTIONS}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Dicta en voz natural</CardTitle>
          <CardDescription>Granola convierte lo que dices en líneas con marcadores.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {DICTATION_EXAMPLES.map((example) => (
            <div key={example.line} className="flex flex-col gap-1 rounded-lg border p-3">
              <span className="text-sm">“{example.spoken}”</span>
              <code className="text-xs text-muted-foreground">
                {SECTION_LABELS[example.section]} → {example.line}
              </code>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Secciones y marcadores</CardTitle>
          <CardDescription>
            Fechas válidas: {DATE_WORDS.join(" · ")}. Las fechas relativas se cuentan desde la fecha de
            la nota.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sección</TableHead>
                <TableHead>Para qué</TableHead>
                <TableHead>También vale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.keys(SECTION_LABELS) as SectionType[]).map((key) => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs">{SECTION_LABELS[key]}</TableCell>
                  <TableCell>{SECTION_HELP[key]}</TableCell>
                  <TableCell className="text-xs whitespace-normal text-muted-foreground">
                    {SECTION_ALIASES[key].slice(1).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marcador</TableHead>
                <TableHead>Significado</TableHead>
                <TableHead>Ejemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MARKERS.map((m) => (
                <TableRow key={m.marker}>
                  <TableCell className="font-mono text-xs">{m.marker}</TableCell>
                  <TableCell className="whitespace-normal">{m.meaning}</TableCell>
                  <TableCell className="font-mono text-xs">{m.example}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            <ProjectPrefixes />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TemplateCard
          title="Plantilla: Mi día"
          description="Dictado de la mañana. Todo lo de Tareas y Seguimientos entra en Mi día de esa fecha."
          template={myDayTemplate(SAMPLE_DATE)}
        />
        <TemplateCard
          title="Plantilla: Reunión"
          description="La fecha va en el bloque inicial; las tareas no entran en Mi día."
          template={meetingTemplate(SAMPLE_DATE)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>4. Prueba antes de importar</CardTitle>
          <CardDescription>Edita el texto y mira en vivo cómo lo interpreta Chronos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Tester />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

function TemplateCard({ title, description, template }: { title: string; description: string; template: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <CopyButton text={template} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{template}</pre>
      </CardContent>
    </Card>
  );
}

async function ProjectPrefixes() {
  await requireUser();
  const projects = await listProjectOptions();
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Crea un proyecto para tener su @PREFIJO.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Tus proyectos:</span>
      {projects.map((p) => (
        <Badge key={p.id} variant="outline" title={p.name}>
          @{p.code_prefix}
        </Badge>
      ))}
    </div>
  );
}

async function Tester() {
  await requireUser();
  const today = todayCO();
  const projects = await listProjectOptions();
  return <DictationTester projects={projects} today={today} initial={myDayTemplate(today)} />;
}
