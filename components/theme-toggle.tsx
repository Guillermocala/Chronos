"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

const OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

// El ícono cambia con clases dark: (CSS), no leyendo el tema en el render:
// así el HTML del servidor y el del cliente coinciden.
function ThemeIcon() {
  return (
    <>
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </>
  );
}

export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "sidebar";
}) {
  const { theme, setTheme } = useTheme();

  const trigger =
    variant === "sidebar" ? (
      <SidebarMenuButton tooltip="Tema" />
    ) : (
      <Button variant="outline" size="icon-sm" aria-label="Cambiar tema" />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>
        <ThemeIcon />
        {variant === "sidebar" && <span>Tema</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "sidebar" ? "start" : "end"}
        side={variant === "sidebar" ? "top" : "bottom"}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value)}
          >
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
