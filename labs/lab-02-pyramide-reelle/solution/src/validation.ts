// validation.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
export type InvitationRefus = "invalide" | "deja-invite";
export type InvitationResult = { ok: true } | { ok: false; reason: InvitationRefus };

// Format simple, suffisant pour ce lab (pas de RFC 5322 complète — hors périmètre).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function peutInviter(emailsExistants: string[], email: string): InvitationResult {
  if (!EMAIL_RE.test(email)) return { ok: false, reason: "invalide" };
  const dejaPresent = emailsExistants.some((e) => e.toLowerCase() === email.toLowerCase());
  if (dejaPresent) return { ok: false, reason: "deja-invite" };
  return { ok: true };
}
