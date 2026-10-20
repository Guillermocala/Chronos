import "server-only";

import { requireUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";

export type RecurringTask = Tables<"recurring_tasks"> & {
  project: { id: string; name: string; code_prefix: string; color: string | null } | null;
};

export async function listRecurring(): Promise<RecurringTask[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("recurring_tasks")
    .select("*, project:projects(id, name, code_prefix, color)")
    .is("deleted_at", null)
    .order("active", { ascending: false })
    .order("next_due");
  if (error) throw error;
  return data;
}
