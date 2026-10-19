import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard · Chronos",
};

export default function DashboardPage() {
  return (
    <section className="flex flex-col gap-2">
      <Suspense
        fallback={<div className="h-8 w-64 animate-pulse rounded bg-muted" />}
      >
        <Greeting />
      </Suspense>
      <p className="text-muted-foreground">
        Aquí verás el valor comprometido, las horas y los tickets en curso.
      </p>
    </section>
  );
}

async function Greeting() {
  const { email } = await requireUser();
  return (
    <h1 className="text-2xl font-semibold tracking-tight">Hola, {email}</h1>
  );
}
