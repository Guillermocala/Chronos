import { describe, expect, it } from "vitest";

import { deliverySchema, paymentSchema, projectSchema } from "./schema";

const base = {
  name: "Web Acme",
  client: "",
  code_prefix: "web",
  color: "",
  start_date: "2026-11-01",
  end_date: "",
  default_sprint_days: "14",
  support_days: "14",
  drive_folder_url: "",
};

describe("projectSchema", () => {
  it("fijo: normaliza prefijo, dinero y limpia campos de retainer", () => {
    const result = projectSchema.parse({
      ...base,
      billing_type: "fixed",
      fixed_amount_cop: "$ 5.000.000",
      estimated_total_hours: "100",
      monthly_fee_cop: "2.000.000",
    });
    expect(result).toMatchObject({
      code_prefix: "WEB",
      billing_type: "fixed",
      fixed_amount_cop: 5_000_000,
      estimated_total_hours: 100,
      monthly_fee_cop: null,
      billing_day: null,
      client: null,
      end_date: null,
    });
  });

  it("retainer: exige mensualidad y horas; día de cobro por defecto 1", () => {
    const result = projectSchema.parse({
      ...base,
      billing_type: "retainer",
      monthly_fee_cop: "2.000.000",
      expected_hours_per_month: "40",
      contract_months: "6",
      billing_day: "",
    });
    expect(result).toMatchObject({ monthly_fee_cop: 2_000_000, contract_months: 6, billing_day: 1, fixed_amount_cop: null });

    const missing = projectSchema.safeParse({ ...base, billing_type: "retainer", monthly_fee_cop: "" });
    expect(missing.success).toBe(false);
  });

  it.each([
    [{ code_prefix: "1AB" }, "prefijo"],
    [{ end_date: "2026-10-01" }, "fecha de fin"],
    [{ drive_folder_url: "https://docs.google.com/document/d/x" }, "carpeta"],
    [{ billing_day: "30", billing_type: "retainer", monthly_fee_cop: "1", expected_hours_per_month: "1" }, "día de cobro"],
  ])("rechaza %j", (override, fragment) => {
    const result = projectSchema.safeParse({
      ...base,
      billing_type: "fixed",
      fixed_amount_cop: "1000",
      ...override,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message.toLowerCase()).toContain(fragment);
  });

  it("limpia el enlace de la carpeta de Drive", () => {
    const result = projectSchema.parse({
      ...base,
      billing_type: "fixed",
      fixed_amount_cop: "1000",
      drive_folder_url: "https://drive.google.com/drive/folders/abc?usp=sharing",
    });
    expect(result.drive_folder_url).toBe("https://drive.google.com/drive/folders/abc");
  });
});

describe("paymentSchema", () => {
  const payment = {
    id: "",
    project_id: "8f1c2c1e-6f0a-4d3b-9a77-2b2a0f6d1e11",
    kind: "advance",
    amount_cop: "2.500.000",
    status: "received",
    due_date: "",
    paid_at: "2026-10-20",
    note: "",
  };

  it("acepta un anticipo recibido", () => {
    expect(paymentSchema.parse(payment)).toMatchObject({ id: null, amount_cop: 2_500_000, paid_at: "2026-10-20" });
  });

  it("un pago recibido necesita fecha de pago", () => {
    expect(paymentSchema.safeParse({ ...payment, paid_at: "" }).success).toBe(false);
  });
});

describe("deliverySchema", () => {
  it("interpreta las casillas", () => {
    expect(
      deliverySchema.parse({
        id: "8f1c2c1e-6f0a-4d3b-9a77-2b2a0f6d1e11",
        delivered_at: "2026-10-20",
        support_days: "14",
        register_final: "on",
        final_amount: "2.500.000",
        create_support_sprint: "on",
      }),
    ).toMatchObject({ register_final: true, final_amount: 2_500_000, final_status: "received", create_support_sprint: true });
  });
});
