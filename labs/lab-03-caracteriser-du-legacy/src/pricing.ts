// pricing.ts — CODE LEGACY EN PRODUCTION. Aucun test n'existe. Personne dans l'équipe ne se
// souvient exactement de toutes les règles. Ta mission : le CARACTÉRISER avant d'y toucher,
// puis le REFACTORER pour qu'il devienne lisible — sans changer une seule sortie.
// Ne réécris PAS la logique depuis une spec : capture ce que CE code fait réellement, y
// compris ce qui te semble bizarre. C'est ça, un golden master.

export function calculerCotisationAnnuelle(membres: { role: "adulte" | "enfant" }[]): number {
  var total = 0;
  var enfants = 0;
  for (var i = 0; i < membres.length; i++) {
    var m = membres[i];
    if (m.role === "adulte") {
      total = total + 120;
    } else {
      enfants = enfants + 1;
      if (enfants <= 2) {
        total = total + 60;
      } else {
        total = total + 30;
      }
    }
  }
  if (membres.length > 5) {
    if (total > 450) {
      total = 450;
    }
  }
  return total;
}
