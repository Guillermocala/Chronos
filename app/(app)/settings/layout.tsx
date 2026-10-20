import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader title="Ajustes" description="Backups de tus datos y tu cuenta." />
      {/* usePathname es dato de la petición: va tras Suspense (Cache Components). */}
      <Suspense fallback={<div className="h-7" />}>
        <SettingsNav />
      </Suspense>
      {children}
    </>
  );
}
