// age.ts — MUTANT (variante avec un bug d'un caractère). Ne l'ouvre pas avant ton GREEN :
// c'est ce que l'oracle utilise pour vérifier que TES tests savent détecter un vrai bug.
export function estMajeur(naissance: Date, reference: Date): boolean {
  let age = reference.getFullYear() - naissance.getFullYear();
  const avantAnniversaire =
    reference.getMonth() < naissance.getMonth() ||
    // BUG : <= au lieu de < — le jour exact de l'anniversaire est traité comme "pas encore".
    (reference.getMonth() === naissance.getMonth() && reference.getDate() <= naissance.getDate());
  if (avantAnniversaire) age--;
  return age >= 18;
}
