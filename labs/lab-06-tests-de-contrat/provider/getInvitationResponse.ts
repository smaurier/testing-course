// getInvitationResponse.ts — LE PROVIDER (API TribuZen). Correct, NE SE MODIFIE PAS.
export function getInvitationResponse(id: string): unknown {
  return {
    id,
    familyId: "f1",
    email: "bob@tribuzen.app",
    status: "pending",
  };
}
