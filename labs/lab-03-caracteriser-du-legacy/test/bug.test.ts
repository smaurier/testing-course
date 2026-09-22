// ORACLE DU BUG RAPPORTÉ — RED sur le starter, doit devenir GREEN après ton intervention.
// Signalement produit : « le site annonce un plafond à 450€ dès CINQ personnes dans le
// foyer ; une famille de exactement cinq personnes ne l'obtient pas, à six elle l'a. »
import { describe, it, expect } from "vitest";
import { calculerCotisationAnnuelle } from "@lab/pricing";

type Membre = { role: "adulte" | "enfant" };
const adultes = (n: number): Membre[] => Array.from({ length: n }, () => ({ role: "adulte" as const }));
const enfants = (n: number): Membre[] => Array.from({ length: n }, () => ({ role: "enfant" as const }));

describe("plafond familial appliqué dès CINQ personnes (pas seulement au-delà)", () => {
  it("5 adultes : total brut 600€, doit être plafonné à 450€", () => {
    expect(calculerCotisationAnnuelle(adultes(5))).toBe(450);
  });

  it("3 adultes + 2 enfants (taille 5) : total brut 480€, doit être plafonné à 450€", () => {
    expect(calculerCotisationAnnuelle([...adultes(3), ...enfants(2)])).toBe(450);
  });

  it("2 adultes + 3 enfants (taille 5, total brut 390€) : sous le plafond, inchangé", () => {
    // Cas de non-régression À L'INTÉRIEUR même de la taille 5 : le plafond ne doit
    // jamais AUGMENTER un total déjà sous 450€.
    expect(calculerCotisationAnnuelle([...adultes(2), ...enfants(3)])).toBe(390);
  });
});
