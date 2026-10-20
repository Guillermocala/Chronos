"use client";

import {
  BookOpenIcon,
  ChartColumnIcon,
  FolderKanbanIcon,
  ImportIcon,
  ListTodoIcon,
  NotebookTextIcon,
  SettingsIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Pendientes",
    items: [
      { href: "/today", label: "Hoy", icon: SunIcon },
      { href: "/tasks", label: "Tareas", icon: ListTodoIcon },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { href: "/projects", label: "Proyectos", icon: FolderKanbanIcon },
      { href: "/reports", label: "Reportes", icon: ChartColumnIcon },
    ],
  },
  {
    label: "Granola",
    items: [
      { href: "/notes", label: "Notas", icon: NotebookTextIcon },
      { href: "/import", label: "Importar dictado", icon: ImportIcon },
      { href: "/guide", label: "Guía de dictado", icon: BookOpenIcon },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/settings", label: "Ajustes", icon: SettingsIcon },
    ],
  },
];

export function AppSidebar({ footer }: { footer: ReactNode }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link href="/today" onClick={() => setOpenMobile(false)} />
              }
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                C
              </span>
              <span className="truncate font-semibold" translate="no">Chronos</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <QuickAddDialog variant="sidebar" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* usePathname es dato de la petición en rutas dinámicas: va tras Suspense. */}
        <Suspense fallback={<NavGroups pathname={null} />}>
          <ActiveNavGroups />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
    </Sidebar>
  );
}

function ActiveNavGroups() {
  return <NavGroups pathname={usePathname()} />;
}

function NavGroups({ pathname }: { pathname: string | null }) {
  const { setOpenMobile } = useSidebar();

  return (
    <>
      {NAV.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {item.soon ? (
                    <>
                      <SidebarMenuButton
                        disabled
                        tooltip={`${item.label} (próximamente)`}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Pronto</SidebarMenuBadge>
                    </>
                  ) : (
                    <SidebarMenuButton
                      isActive={pathname?.startsWith(item.href) ?? false}
                      tooltip={item.label}
                      render={
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
