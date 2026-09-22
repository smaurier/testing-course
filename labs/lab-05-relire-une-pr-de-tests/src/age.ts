// age.ts — L'IMPLÉMENTATION SOUS TEST. Correcte, NE SE MODIFIE PAS dans ce lab.
export function estMajeur(naissance: Date, reference: Date): boolean {
  let age = reference.getFullYear() - naissance.getFullYear();
  const avantAnniversaire =
    reference.getMonth() < naissance.getMonth() ||
    (reference.getMonth() === naissance.getMonth() && reference.getDate() < naissance.getDate());
  if (avantAnniversaire) age--;
  return age >= 18;
}
