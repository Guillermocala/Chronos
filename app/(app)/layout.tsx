import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

import { signOut } from "./actions";

// Con Cache Components la sesión se lee detrás de <Suspense>: el header estático
// se prerenderiza y la parte que depende del usuario se transmite por streaming.
// Cada página/componente que lee datos vuelve a llamar requireUser() (el proxy
// solo hace el chequeo optimista).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Chronos
        </Link>
        <Suspense fallback={<div className="h-8" />}>
          <UserMenu />
        </Suspense>
      </header>
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const { email } = await requireUser();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {email}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
