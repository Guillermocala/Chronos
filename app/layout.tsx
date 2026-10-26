import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Gestor personal de tickets, sprints y valor por proyecto";

// URL pública para las vistas previas al compartir (WhatsApp, Slack…). En Vercel
// es el dominio de producción; en local, localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT ?? 3000}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Chronos",
  description: DESCRIPTION,
  applicationName: "Chronos",
  openGraph: {
    type: "website",
    siteName: "Chronos",
    title: "Chronos",
    description: DESCRIPTION,
    locale: "es_CO",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "Chronos", description: DESCRIPTION },
  // iPhone: al agregarla a inicio abre sin barra de Safari.
  appleWebApp: { capable: true, title: "Chronos", statusBarStyle: "default" },
};

// Color de la barra del navegador en el celular según el tema del sistema.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes pone la clase "dark" antes de hidratar: de ahí suppressHydrationWarning.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster>
            <TooltipProvider>{children}</TooltipProvider>
          </Toaster>
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
