// Exécute la référence fixée (solution/notifications.test.ts) contre la MÊME implémentation.
// Prouve que l'oracle est sain : mêmes assertions, aucune affaiblie, toutes vertes.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["solution/**/*.test.ts"] },
});
