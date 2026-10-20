"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/settings/backups", label: "Backups" },
  { href: "/settings/account", label: "Cuenta" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Secciones de ajustes">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Button
            key={link.href}
            size="sm"
            variant={active ? "secondary" : "ghost"}
            nativeButton={false}
            render={<Link href={link.href} aria-current={active ? "page" : undefined} />}
          >
            {link.label}
          </Button>
        );
      })}
    </nav>
  );
}
