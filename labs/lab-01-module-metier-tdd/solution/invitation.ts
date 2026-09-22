// invitation.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Chaque bloc correspond à un cycle RED-GREEN-REFACTOR distinct — c'est l'ordre dans lequel
// l'écrire, pas juste le résultat final.

export type MemberStatus = "actif" | "inactif" | "suspendu";

export interface Member {
  status: MemberStatus;
  pendingInvitations?: string[];
  revokedInvitations?: { email: string; revokedAt: Date }[];
}

export type InvitationRefus = "inactif" | "deja-membre" | "quota" | "recemment-revoquee";

export type InvitationResult = { ok: true } | { ok: false; reason: InvitationRefus };

// Cycle 4 (quota) et cycle "cooldown" font émerger ces deux constantes — pas anticipées
// avant que le test ne les exige (YAGNI).
export const QUOTA_INVITATIONS_EN_ATTENTE = 5;
export const COOLDOWN_JOURS = 30;
const JOUR_MS = 86_400_000;

export function evaluerInvitation(
  member: Member,
  email: string,
  existingEmails: string[],
  now: Date,
): InvitationResult {
  // Cycle 1 : membre non actif → refus immédiat, avant toute autre règle.
  if (member.status !== "actif") return { ok: false, reason: "inactif" };

  // Cycle 2 : email déjà membre.
  if (existingEmails.includes(email)) return { ok: false, reason: "deja-membre" };

  // Cycle 3 : quota d'invitations en attente.
  if ((member.pendingInvitations ?? []).length >= QUOTA_INVITATIONS_EN_ATTENTE) {
    return { ok: false, reason: "quota" };
  }

  // Cycle 4 : cooldown après révocation — le paramètre `now` explicite (jamais Date.now()
  // dans le corps) rend cette règle testable sans mock de l'horloge globale.
  const revocationRecente = (member.revokedInvitations ?? []).some((r) => {
    if (r.email !== email) return false;
    const ageJours = (now.getTime() - r.revokedAt.getTime()) / JOUR_MS;
    return ageJours < COOLDOWN_JOURS;
  });
  if (revocationRecente) return { ok: false, reason: "recemment-revoquee" };

  return { ok: true };
}
