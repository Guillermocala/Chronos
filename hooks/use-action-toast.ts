"use client";

import { useCallback, useTransition, type FormEvent } from "react";

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

/** Marca y enfoca el campo que reportó el servidor; se desmarca al editarlo. */
export function markInvalidField(form: HTMLFormElement, field: string | undefined) {
  if (!field) return;
  const element = form.elements.namedItem(field);
  if (!(element instanceof HTMLElement) || (element as HTMLInputElement).type === "hidden") return;
  element.setAttribute("aria-invalid", "true");
  element.focus();
  element.addEventListener("input", () => element.removeAttribute("aria-invalid"), { once: true });
}

/** Ejecuta una Server Action en una transición y muestra el resultado como toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (
      action: () => Promise<ActionResult>,
      onSuccess?: () => void,
      undo?: () => Promise<ActionResult>,
      onError?: (result: Extract<ActionResult, { ok: false }>) => void,
    ) =>
      startTransition(async () => {
        const result = await action();
        showResult(result, result.ok ? undo : undefined);
        if (result.ok) onSuccess?.();
        else onError?.(result);
      }),
    [],
  );

  /**
   * Handler `onSubmit` para formularios. A diferencia de `<form action={…}>`,
   * React no reinicia el formulario al terminar: si la validación falla, lo
   * escrito se conserva. Para limpiar tras guardar, hazlo en `onSuccess`.
   */
  const submit = useCallback(
    (action: (formData: FormData) => Promise<ActionResult>, onSuccess?: (form: HTMLFormElement) => void) =>
      (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        run(
          () => action(formData),
          () => onSuccess?.(form),
          undefined,
          (result) => markInvalidField(form, result.field),
        );
      },
    [run],
  );

  return { pending, run, submit };
}
