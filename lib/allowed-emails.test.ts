import { describe, expect, it } from "vitest";

import { includesEmail, parseAllowedEmails } from "./allowed-emails";

describe("parseAllowedEmails", () => {
  it("lista separada por comas, sin mayúsculas ni duplicados; el primero es el dueño", () => {
    expect(parseAllowedEmails(" Yo@X.com, ayuda@y.com ;yo@x.com ", undefined)).toEqual(["yo@x.com", "ayuda@y.com"]);
  });

  it("compatible con ALLOWED_EMAIL", () => {
    expect(parseAllowedEmails(undefined, "Yo@x.com")).toEqual(["yo@x.com"]);
    expect(parseAllowedEmails("", "yo@x.com")).toEqual(["yo@x.com"]);
  });

  it("rechaza correos inválidos o lista vacía", () => {
    expect(() => parseAllowedEmails("yo@x.com, no-es-correo", undefined)).toThrow(/no-es-correo/);
    expect(() => parseAllowedEmails("", "")).toThrow();
  });

  it("includesEmail ignora mayúsculas y espacios", () => {
    expect(includesEmail(["ayuda@y.com"], " Ayuda@Y.com ")).toBe(true);
    expect(includesEmail(["ayuda@y.com"], "otro@y.com")).toBe(false);
    expect(includesEmail(["ayuda@y.com"], undefined)).toBe(false);
  });
});
