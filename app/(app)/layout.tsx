import { LogOutIcon } from "lucide-react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimerChip } from "@/components/tickets/timer-chip";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth";
import { getRunningTimer } from "@/lib/data/tickets";

import { signOut } from "./actions";

// Con Cache Components la sesión se lee detrás de <Suspense>: el shell estático
// se prerenderiza y lo que depende del usuario llega por streaming. Cada página y
// Server Action vuelve a llamar requireUser() (el proxy solo hace el chequeo optimista).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      {/* Primer elemento enfocable: salta el menú lateral con el teclado. */}
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <AppSidebar
        footer={
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <ThemeToggle variant="sidebar" />
              </SidebarMenuItem>
            </SidebarMenu>
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <UserMenu />
            </Suspense>
          </>
        }
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold" translate="no">
            Chronos
          </span>
        </header>
        <div
          id="contenido"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-6"
        >
          <Suspense fallback={null}>
            <RunningTimer />
          </Suspense>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function RunningTimer() {
  const timer = await getRunningTimer();
  if (!timer) return null;
  return (
    <TimerChip
      ticketId={timer.ticket.id}
      code={timer.ticket.code}
      title={timer.ticket.title}
      startedAt={timer.started_at}
    />
  );
}

async function UserMenu() {
  const { email } = await requireUser();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <form action={signOut}>
          <SidebarMenuButton type="submit" tooltip="Cerrar sesión">
            <LogOutIcon />
            <span className="flex min-w-0 flex-col text-left">
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
              <span>Cerrar sesión</span>
            </span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
