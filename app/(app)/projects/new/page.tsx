import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "Nuevo proyecto · Chronos" };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="Nuevo proyecto"
        description="En contrataciones mensuales con inicio y meses, se generan los pagos esperados automáticamente."
      />
      <ProjectForm />
    </>
  );
}
