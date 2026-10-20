import type { MetadataRoute } from "next";

import { ICON_BACKGROUND } from "@/lib/pwa/icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chronos",
    short_name: "Chronos",
    description: "Gestor personal de tickets, sprints, tareas y valor por proyecto",
    lang: "es",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoy", url: "/today" },
      { name: "Nueva tarea", url: "/today?add=1" },
      { name: "Importar dictado", url: "/import" },
    ],
  };
}
