// ORACLE DE NON-RÉGRESSION — golden master figé sur le comportement ACTUEL du code legacy
// pour des foyers dont la taille n'est PAS 5 (la taille 5 est le cas litigieux, testé à part
// dans bug.test.ts). VERT avant ta modification. Doit rester vert APRÈS ton refactor.
// Si un de ces tests casse, c'est ton refactor qui a changé un comportement — reviens en arrière.
import { describe, it, expect } from "vitest";
import { calculerCotisationAnnuelle } from "@lab/pricing";

type Membre = { role: "adulte" | "enfant" };
const adultes = (n: number): Membre[] => Array.from({ length: n }, () => ({ role: "adulte" as const }));
const enfants = (n: number): Membre[] => Array.from({ length: n }, () => ({ role: "enfant" as const }));

describe("golden master — foyers de taille ≠ 5", () => {
  it.each([
    { label: "1 adulte", membres: adultes(1), attendu: 120 },
    { label: "2 adultes", membres: adultes(2), attendu: 240 },
    { label: "1 adulte + 1 enfant", membres: [...adultes(1), ...enfants(1)], attendu: 180 },
    { label: "2 adultes + 2 enfants", membres: [...adultes(2), ...enfants(2)], attendu: 360 },
    { label: "2 adultes + 4 enfants (tarif dégressif dès le 3e)", membres: [...adultes(2), ...enfants(4)], attendu: 420 },
    { label: "3 adultes + 3 enfants (plafond atteint, taille 6)", membres: [...adultes(3), ...enfants(3)], attendu: 450 },
    { label: "4 adultes + 2 enfants (plafond atteint, taille 6)", membres: [...adultes(4), ...enfants(2)], attendu: 450 },
    { label: "2 adultes + 6 enfants (plafond atteint, taille 8)", membres: [...adultes(2), ...enfants(6)], attendu: 450 },
    { label: "4 adultes seuls (taille 4, PAS de plafond même si > 450 — quirk du legacy à préserver)", membres: adultes(4), attendu: 480 },
    { label: "foyer vide", membres: [], attendu: 0 },
  ])("$label → $attendu€", ({ membres, attendu }) => {
    expect(calculerCotisationAnnuelle(membres)).toBe(attendu);
  });
});
