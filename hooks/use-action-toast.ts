"use client";

import { useCallback, useTransition } from "react";

import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

export function showResult(result: ActionResult | undefined) {
  if (!result) return;
  if (!result.ok) {
    toast.add({ title: result.error, type: "error" });
    return;
  }
  if (result.message) {
    toast.add({
      title: result.message,
      description: result.warnings?.length ? result.warnings.join(" ") : undefined,
      type: result.warnings?.length ? "warning" : "success",
    });
  }
}

/** Ejecuta una Server Action en una transición y muestra el resultado como toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (action: () => Promise<ActionResult>, onSuccess?: () => void) =>
      startTransition(async () => {
        const result = await action();
        showResult(result);
        if (result.ok) onSuccess?.();
      }),
    [],
  );
  return { pending, run };
}
