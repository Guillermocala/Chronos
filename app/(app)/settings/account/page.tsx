import type { Metadata } from "next";
import { Suspense } from "react";

import { PasswordForm } from "@/components/settings/password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Cuenta · Chronos" };

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>
            <Suspense fallback={<Skeleton className="h-4 w-48" />}>
              <Email />
            </Suspense>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Claro, oscuro o automático según tu dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}

async function Email() {
  const { email } = await requireUser();
  return <>Sesión iniciada como {email}</>;
}
