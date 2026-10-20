// Genera los PNG del manifest (public/icons). Correr al cambiar el ícono:
//   npx tsx scripts/generate-icons.tsx

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { ChronosIcon } from "@/lib/pwa/icon";

const out = join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });

const icons = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

async function main() {
  for (const { file, size, maskable } of icons) {
    const response = new ImageResponse(
      <ChronosIcon size={size} maskable={maskable} />,
      { width: size, height: size },
    );
    writeFileSync(join(out, file), Buffer.from(await response.arrayBuffer()));
    console.log(`public/icons/${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
