import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0, // le module 14 est clair : pas de retry en pansement, même ici.
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npx tsx server/start.ts",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
