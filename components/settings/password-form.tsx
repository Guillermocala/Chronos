"use client";

import { useRef } from "react";

import { changePassword } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";

export function PasswordForm() {
  const { pending, run } = useAction();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={(formData) => run(() => changePassword(formData), () => form.current?.reset())}
      className="flex max-w-sm flex-col gap-4"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} />
          <FieldDescription>Mínimo 12 caracteres.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
