import { redirect } from "next/navigation";

// El inicio ahora es la vista Hoy.
export default function DashboardPage() {
  redirect("/today");
}
