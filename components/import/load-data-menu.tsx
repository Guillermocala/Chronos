"use client";

import { ChevronDownIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IMPORT_FORMATS } from "@/lib/import/formats";

/** "Cargar datos ▾": un formato por plataforma externa. */
export function LoadDataMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <DatabaseIcon data-icon="inline-start" />
        <span className="max-sm:sr-only">Cargar datos</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cargar actividades de</DropdownMenuLabel>
          {IMPORT_FORMATS.map((f) => (
            <DropdownMenuItem key={f.id} render={<Link href={`/import?tab=data&format=${f.id}`} />}>
              {f.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
