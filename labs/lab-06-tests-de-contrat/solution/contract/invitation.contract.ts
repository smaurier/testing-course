// invitation.contract.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
export interface InvitationDTO {
  id: string;
  familyId: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
}

const STATUTS = ["pending", "accepted", "expired", "revoked"] as const;

// Assertion function : après un appel réussi, TypeScript sait que `payload` est InvitationDTO —
// c'est ce qui permet à fetchInvitation() de retourner `rawResponse` sans cast.
export function validateInvitationContract(payload: unknown): asserts payload is InvitationDTO {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Contrat violé : la réponse n'est pas un objet.");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.id !== "string") throw new Error("Contrat violé : `id` manquant ou non-string.");
  if (typeof p.familyId !== "string") throw new Error("Contrat violé : `familyId` manquant ou non-string.");
  if (typeof p.email !== "string") {
    throw new Error("Contrat violé : `email` manquant ou non-string (attendu au premier niveau, pas imbriqué).");
  }
  if (typeof p.status !== "string" || !STATUTS.includes(p.status as (typeof STATUTS)[number])) {
    throw new Error(`Contrat violé : \`status\` doit être l'un de ${STATUTS.join(", ")}.`);
  }
}
