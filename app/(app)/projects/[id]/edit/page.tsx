import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectFields } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Editar proyecto · Chronos" };

export default function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <EditProject params={params} />
    </Suspense>
  );
}

async function EditProject({ params }: Pick<PageProps<"/projects/[id]/edit">, "params">) {
  const { id } = await params;
  const project = await getProjectFields(id);
  if (!project) notFound();

  return (
    <>
      <PageHeader title={`Editar ${project.name}`} />
      <ProjectForm project={project} />
    </>
  );
}
