import { LogOutIcon } from "lucide-react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
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

import { signOut } from "./actions";

// Con Cache Components la sesión se lee detrás de <Suspense>: el shell estático
// se prerenderiza y lo que depende del usuario llega por streaming. Cada página y
// Server Action vuelve a llamar requireUser() (el proxy solo hace el chequeo optimista).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <UserMenu />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold">Chronos</span>
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
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
              <span className="truncate text-xs text-muted-foreground">{email}</span>
              <span>Cerrar sesión</span>
            </span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
