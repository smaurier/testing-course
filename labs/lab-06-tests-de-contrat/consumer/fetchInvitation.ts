// fetchInvitation.ts — LE CONSUMER (front TribuZen). Correct, NE SE MODIFIE PAS.
// Il ne fait confiance à AUCUNE réponse brute : tout passe par le contrat que tu écris.
import { validateInvitationContract } from "@contract";
import type { InvitationDTO } from "@contract";

export function fetchInvitation(rawResponse: unknown): InvitationDTO {
  validateInvitationContract(rawResponse);
  return rawResponse;
}
