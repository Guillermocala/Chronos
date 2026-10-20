import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { listProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Proyectos · Chronos" };

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Facturación, cobros y soporte de cada proyecto."
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/projects/new" />}>
            <PlusIcon data-icon="inline-start" />
            Nuevo proyecto
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <ProjectsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProjectsContent({ searchParams }: Pick<PageProps<"/projects">, "searchParams">) {
  await requireUser();
  const showAll = (await searchParams).all === "1";
  const today = todayCO();
  const projects = await listProjects();
  const visible = showAll ? projects : projects.filter((p) => p.phase !== "closed");
  const closedCount = projects.length - projects.filter((p) => p.phase !== "closed").length;

  if (projects.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanbanIcon />
          </EmptyMedia>
          <EmptyTitle>Sin proyectos</EmptyTitle>
          <EmptyDescription>Crea tu primer proyecto de pago fijo o de contratación mensual.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" nativeButton={false} render={<Link href="/projects/new" />}>
            Nuevo proyecto
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} today={today} />
        ))}
      </div>
      {closedCount > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={showAll ? "/projects" : "/projects?all=1"} />}
          >
            {showAll ? "Ocultar cerrados" : `Mostrar cerrados (${closedCount})`}
          </Button>
        </div>
      )}
    </div>
  );
}
