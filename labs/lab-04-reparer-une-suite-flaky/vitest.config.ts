// Oracle du lab : exécute LE FICHIER QUE TU RÉPARES directement (test/notifications.test.ts).
// Pas de src/solution à basculer ici : l'implémentation ne change pas, seul le test change.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@lab": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"] },
});
