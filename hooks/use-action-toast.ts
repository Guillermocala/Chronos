"use client";

import { useCallback, useTransition } from "react";

import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

export function showResult(result: ActionResult | undefined, undo?: () => Promise<ActionResult>) {
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
      // Acciones destructivas: en lugar de confirmar antes, se ofrece deshacer.
      actionProps: undo
        ? { children: "Deshacer", onClick: () => void undo().then((r) => showResult(r)) }
        : undefined,
    });
  }
}

/** Ejecuta una Server Action en una transición y muestra el resultado como toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (
      action: () => Promise<ActionResult>,
      onSuccess?: () => void,
      undo?: () => Promise<ActionResult>,
    ) =>
      startTransition(async () => {
        const result = await action();
        showResult(result, result.ok ? undo : undefined);
        if (result.ok) onSuccess?.();
      }),
    [],
  );
  return { pending, run };
}
