// age.test.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Mêmes 3 tests de départ (conservés, ils restent valides) + les cas qui tuent le mutant.
import { describe, it, expect } from "vitest";
import { estMajeur } from "@lab/age";

describe("estMajeur", () => {
  it("une personne clairement adulte est majeure", () => {
    expect(estMajeur(new Date("1990-03-15"), new Date("2026-06-01"))).toBe(true);
  });

  it("une personne clairement mineure n'est pas majeure", () => {
    expect(estMajeur(new Date("2015-06-01"), new Date("2026-01-01"))).toBe(false);
  });

  // Remplacé : `new Date()` (aujourd'hui réel) est un bug de flakiness en attente — même
  // leçon que le lab 04. Une date fixe, choisie loin de tout anniversaire, suffit ici.
  it("fonctionne avec une référence fixe, loin de tout anniversaire", () => {
    expect(estMajeur(new Date("2000-01-01"), new Date("2026-06-15"))).toBe(true);
  });

  // Les trois cas qui manquaient à la PR d'origine — c'est EXACTEMENT ce qui tue le mutant
  // (`<=` au lieu de `<` sur le jour anniversaire).
  it("le jour exact du 18e anniversaire, la personne EST déjà majeure", () => {
    expect(estMajeur(new Date("2008-09-22"), new Date("2026-09-22"))).toBe(true);
  });

  it("la veille du 18e anniversaire, la personne n'est PAS encore majeure", () => {
    expect(estMajeur(new Date("2008-09-22"), new Date("2026-09-21"))).toBe(false);
  });

  it("le lendemain du 18e anniversaire, la personne est majeure", () => {
    expect(estMajeur(new Date("2008-09-22"), new Date("2026-09-23"))).toBe(true);
  });
});
