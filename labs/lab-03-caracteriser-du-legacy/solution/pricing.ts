// pricing.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Même comportement que le legacy pour toute taille de foyer ≠ 5 (golden master préservé),
// bug corrigé pour taille === 5 (plafond appliqué dès 5, pas seulement au-delà).
// Refactor : extraction de deux fonctions nommées, plus de `var`/index manuel.

type Role = "adulte" | "enfant";
export type Membre = { role: Role };

const TARIF_ADULTE = 120;
const TARIF_ENFANT_PLEIN = 60;
const TARIF_ENFANT_DEGRESSIF = 30;
const RANG_DEGRESSIF = 2; // les deux premiers enfants sont à tarif plein, le 3e et suivants dégressifs
const PLAFOND_FAMILIAL = 450;
const TAILLE_FOYER_POUR_PLAFOND = 5; // ex-bug : le legacy exigeait > 5, donc > cette taille

function tarifEnfant(rangDansLaFamille: number): number {
  return rangDansLaFamille <= RANG_DEGRESSIF ? TARIF_ENFANT_PLEIN : TARIF_ENFANT_DEGRESSIF;
}

function totalBrut(membres: Membre[]): number {
  let total = 0;
  let rangEnfant = 0;
  for (const membre of membres) {
    if (membre.role === "adulte") {
      total += TARIF_ADULTE;
    } else {
      rangEnfant += 1;
      total += tarifEnfant(rangEnfant);
    }
  }
  return total;
}

export function calculerCotisationAnnuelle(membres: Membre[]): number {
  const brut = totalBrut(membres);
  // Fix : >= au lieu de > — le plafond s'applique DÈS cinq personnes, pas seulement au-delà.
  const plafondApplicable = membres.length >= TAILLE_FOYER_POUR_PLAFOND;
  return plafondApplicable ? Math.min(brut, PLAFOND_FAMILIAL) : brut;
}
