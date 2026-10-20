import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";

import { ReloadButton } from "@/components/pwa/reload-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = { title: "Sin conexión · Chronos" };

// Estática: el service worker la guarda para mostrarla cuando no hay red.
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WifiOffIcon />
          </EmptyMedia>
          <EmptyTitle>Sin conexión</EmptyTitle>
          <EmptyDescription>
            Chronos necesita internet para mostrar tus datos. Revisa la conexión e inténtalo de nuevo.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ReloadButton />
        </EmptyContent>
      </Empty>
    </main>
  );
}
