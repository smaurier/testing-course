// getInvitationResponse.ts — VARIANTE AVEC DÉRIVE (ne l'ouvre pas avant ton GREEN).
// Un développeur provider a imbriqué l'email sous `contact`, sans prévenir le front —
// exactement le scénario que le contract testing existe pour attraper AVANT le déploiement.
export function getInvitationResponse(id: string): unknown {
  return {
    id,
    familyId: "f1",
    contact: { email: "bob@tribuzen.app" },
    status: "pending",
  };
}
