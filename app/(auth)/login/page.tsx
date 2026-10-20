import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar · Chronos",
};

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Chronos</CardTitle>
          <CardDescription>Ingresa para gestionar tus proyectos.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
