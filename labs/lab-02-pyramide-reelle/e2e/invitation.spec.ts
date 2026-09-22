// Oracle E2E (couche 3) — VRAI navigateur, vrai serveur, vrai formulaire. Ne pas modifier.
// Lancé par Playwright, pas par vitest : npm run lab:02 orchestre les deux.
import { test, expect } from "@playwright/test";

test.describe("Formulaire d'invitation — parcours utilisateur réel", () => {
  test("inviter un email nouveau affiche un message de succès", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("dan@tribuzen.app");
    await page.getByRole("button", { name: "Inviter" }).click();
    await expect(page.getByRole("status")).toHaveText("Invitation envoyée à dan@tribuzen.app.");
  });

  test("inviter un email déjà membre affiche le refus", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("alice@tribuzen.app");
    await page.getByRole("button", { name: "Inviter" }).click();
    await expect(page.getByRole("status")).toHaveText("Refusé : deja-invite.");
  });

  test("un email au format invalide est refusé sans jamais atteindre le serveur en succès", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("pas-un-email");
    // Le champ email natif bloque déjà la soumission (type="email", required) — c'est la
    // première ligne de défense, avant même la couche serveur.
    const estValide = await page.getByLabel("Email").evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(estValide).toBe(false);
  });
});
