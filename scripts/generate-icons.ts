// Genera todos los íconos de Chronos a partir del logo original
// (public/icons/chronos-logo.jpg). Correr al cambiar el logo:
//   npx tsx scripts/generate-icons.ts
//
// Del JPG se toma solo el trazo blanco (umbral, sin ruido de compresión),
// recortado al dibujo, y se compone sobre el fondo de marca con el margen
// adecuado a cada tamaño: los íconos chicos usan menos margen para que las
// líneas se lean.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

import { ICON_BACKGROUND } from "@/lib/pwa/icon";

const SOURCE = join(process.cwd(), "public", "icons", "chronos-logo.jpg");
const ICONS = join(process.cwd(), "public", "icons");
const APP = join(process.cwd(), "app");

type Variant = {
  path: string;
  size: number;
  /** Alto del dibujo respecto al lado del ícono. */
  markScale: number;
  /** Radio de las esquinas (0 = a sangre, para maskable/iOS que recortan solas). */
  radius: number;
  /** Engrosar el trazo (para el favicon, que se ve a 16–32 px). */
  bold?: boolean;
};

const VARIANTS: Variant[] = [
  { path: join(APP, "icon.png"), size: 64, markScale: 0.78, radius: 0.22, bold: true },
  { path: join(APP, "apple-icon.png"), size: 180, markScale: 0.6, radius: 0 },
  { path: join(ICONS, "icon-192.png"), size: 192, markScale: 0.62, radius: 0.22 },
  { path: join(ICONS, "icon-512.png"), size: 512, markScale: 0.62, radius: 0.22 },
  // Android recorta los "maskable" en círculo: el dibujo va dentro del 80 % central.
  { path: join(ICONS, "icon-maskable-512.png"), size: 512, markScale: 0.5, radius: 0 },
];

/** Trazo blanco del logo sobre transparente, recortado al dibujo. */
async function extractMark(bold = false): Promise<Buffer> {
  // Engrosar: desenfocar y cortar con un umbral bajo ensancha el trazo de forma pareja.
  const grey = sharp(SOURCE).greyscale();
  const alpha = await (bold ? grey.blur(9).threshold(60) : grey.threshold(150)).toBuffer();
  const { width, height } = await sharp(SOURCE).metadata();
  const white = await sharp({
    create: { width: width!, height: height!, channels: 3, background: "#ffffff" },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return sharp(white).trim({ threshold: 0 }).png().toBuffer();
}

function background(size: number, radius: number): Buffer {
  const r = Math.round(size * radius);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${ICON_BACKGROUND}"/></svg>`,
  );
}

async function render(marks: { regular: Buffer; bold: Buffer }, { path, size, markScale, radius, bold }: Variant) {
  const mark = bold ? marks.bold : marks.regular;
  const markHeight = Math.round(size * markScale);
  const resized = await sharp(mark).resize({ height: markHeight, kernel: "lanczos3" }).toBuffer();
  const meta = await sharp(resized).metadata();
  const png = await sharp(background(size, radius))
    .composite([
      {
        input: resized,
        left: Math.round((size - meta.width!) / 2),
        top: Math.round((size - meta.height!) / 2),
      },
    ])
    .png()
    .toBuffer();
  writeFileSync(path, png);
  console.log(`${path.replace(process.cwd(), "").slice(1)} (${size}px)`);
}

async function main() {
  mkdirSync(ICONS, { recursive: true });
  const mark = await extractMark();
  const marks = { regular: mark, bold: await extractMark(true) };
  // Dibujo suelto (blanco sobre transparente) para el sidebar y la imagen para compartir.
  const markPath = join(ICONS, "chronos-mark.png");
  writeFileSync(markPath, await sharp(mark).resize({ height: 256, kernel: "lanczos3" }).png().toBuffer());
  console.log("public/icons/chronos-mark.png");
  for (const variant of VARIANTS) await render(marks, variant);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
