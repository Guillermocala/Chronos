import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Los tests *.int.test.ts levantan PGlite con todas las migraciones (~4 s cada uno);
    // en paralelo pueden pasar de los 10 s por defecto.
    hookTimeout: 60_000,
  },
});
