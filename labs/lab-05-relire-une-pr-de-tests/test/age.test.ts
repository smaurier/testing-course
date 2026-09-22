// age.test.ts — LA PR SOUMISE PAR UN COLLÈGUE, DÉJÀ MERGÉE. Elle passe en CI. Ton rôle :
// la relire, écrire tes findings (voir README), puis la RENFORCER — dans ce même fichier —
// jusqu'à ce qu'elle détecte un vrai bug qu'elle laisse aujourd'hui passer inaperçu.
import { describe, it, expect } from "vitest";
import { estMajeur } from "@lab/age";

describe("estMajeur", () => {
  it("une personne clairement adulte est majeure", () => {
    expect(estMajeur(new Date("1990-03-15"), new Date("2026-06-01"))).toBe(true);
  });

  it("une personne clairement mineure n'est pas majeure", () => {
    expect(estMajeur(new Date("2015-06-01"), new Date("2026-01-01"))).toBe(false);
  });

  it("fonctionne avec la date d'aujourd'hui", () => {
    expect(estMajeur(new Date("2000-01-01"), new Date())).toBe(true);
  });
});
