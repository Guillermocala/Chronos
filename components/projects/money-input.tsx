"use client";

import { useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

const thousands = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function formatDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? thousands.format(Number(digits)) : "";
}

type Props = {
  id: string;
  name: string;
  defaultValue?: number | null;
  required?: boolean;
  "aria-invalid"?: boolean;
};

/** Pesos colombianos con separador de miles mientras se escribe ("1.500.000"). */
export function MoneyInput({ id, name, defaultValue, required, ...props }: Props) {
  const [value, setValue] = useState(defaultValue != null ? thousands.format(defaultValue) : "");

  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        value={value}
        onChange={(e) => setValue(formatDigits(e.target.value))}
        className="tabular-nums"
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>COP</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
