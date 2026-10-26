import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { ICON_BACKGROUND, ICON_FOREGROUND } from "@/lib/pwa/icon";

// Imagen de vista previa al compartir el enlace (Open Graph y Twitter/X).
export const alt = "Chronos · Gestor personal de tickets, sprints y valor por proyecto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  // Dibujo del logo (blanco sobre transparente), generado por scripts/generate-icons.ts.
  const mark = await readFile(join(process.cwd(), "public", "icons", "chronos-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: ICON_FOREGROUND,
          color: ICON_BACKGROUND,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 240,
            height: 240,
            flexShrink: 0,
            borderRadius: 52,
            background: ICON_BACKGROUND,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo admite <img> */}
          <img src={markSrc} alt="" width={120} height={148} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>Chronos</div>
          <div style={{ fontSize: 40, lineHeight: 1.3, color: "#525252", maxWidth: 680 }}>
            Tickets, sprints y valor por proyecto en COP
          </div>
        </div>
      </div>
    ),
    size,
  );
}
