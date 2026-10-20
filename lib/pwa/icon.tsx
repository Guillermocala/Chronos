// Ícono de Chronos: una "C" blanca sobre el color primario (igual que el logo del
// sidebar). Lo usan app/icon.tsx, app/apple-icon.tsx y scripts/generate-icons.ts.

export const ICON_BACKGROUND = "#171717";
export const ICON_FOREGROUND = "#fafafa";

/**
 * @param size lado en px
 * @param maskable deja margen de seguridad (Android recorta los íconos "maskable"
 *   en círculo o "squircle"), por eso el fondo llena todo y la letra es más chica.
 */
export function ChronosIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BACKGROUND,
        borderRadius: radius,
        color: ICON_FOREGROUND,
        fontSize: Math.round(size * (maskable ? 0.46 : 0.62)),
        fontWeight: 700,
        fontFamily: "sans-serif",
        lineHeight: 1,
      }}
    >
      C
    </div>
  );
}
