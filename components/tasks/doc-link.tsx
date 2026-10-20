import {
  FileIcon,
  FileTextIcon,
  FolderIcon,
  PresentationIcon,
  SheetIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DocKind } from "@/lib/drive";

const ICONS: Record<DocKind, { icon: LucideIcon; label: string }> = {
  doc: { icon: FileTextIcon, label: "Abrir documento" },
  sheet: { icon: SheetIcon, label: "Abrir hoja de cálculo" },
  slides: { icon: PresentationIcon, label: "Abrir presentación" },
  folder: { icon: FolderIcon, label: "Abrir carpeta de Drive" },
  file: { icon: FileIcon, label: "Abrir archivo" },
};

/** Botón-ícono que abre el Doc/carpeta de Drive en una pestaña nueva. */
export function DocLink({ url, kind }: { url: string; kind: DocKind }) {
  const { icon: Icon, label } = ICONS[kind];
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} />}
    >
      <Icon />
    </Button>
  );
}
