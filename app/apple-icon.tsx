import { ImageResponse } from "next/og";

import { ChronosIcon } from "@/lib/pwa/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS aplica sus propias esquinas redondeadas: el fondo va a sangre (como maskable).
export default function AppleIcon() {
  return new ImageResponse(<ChronosIcon size={180} maskable />, size);
}
