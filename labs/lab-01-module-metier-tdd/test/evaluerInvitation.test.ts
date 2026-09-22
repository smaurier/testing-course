// Oracle RUNTIME du lab 01 Testing. Ne pas modifier.
// Ce n'est PAS le kata canInvite du module 15 : la règle de cooldown après révocation est
// nouvelle, elle force de vrais cycles de triangulation.
import { describe, it, expect } from "vitest";
import { evaluerInvitation, COOLDOWN_JOURS } from "@lab/invitation";
import type { Member } from "@lab/invitation";

const NOW = new Date("2026-09-22T10:00:00Z");

const actif = (extra: Partial<Member> = {}): Member => ({ status: "actif", ...extra });

describe("membre non actif", () => {
  it("refuse si le membre est inactif", () => {
    expect(evaluerInvitation({ status: "inactif" }, "bob@tribuzen.app", [], NOW)).toEqual({
      ok: false,
      reason: "inactif",
    });
  });
  it("refuse si le membre est suspendu", () => {
    expect(evaluerInvitation({ status: "suspendu" }, "bob@tribuzen.app", [], NOW)).toEqual({
      ok: false,
      reason: "inactif",
    });
  });
});

describe("membre actif, cas nominal", () => {
  it("accepte si l'email est libre et le quota non atteint", () => {
    expect(evaluerInvitation(actif(), "bob@tribuzen.app", [], NOW)).toEqual({ ok: true });
  });
});

describe("email déjà membre", () => {
  it("refuse si l'email est déjà dans la liste des membres", () => {
    const existing = ["alice@tribuzen.app", "bob@tribuzen.app"];
    expect(evaluerInvitation(actif(), "bob@tribuzen.app", existing, NOW)).toEqual({
      ok: false,
      reason: "deja-membre",
    });
  });
});

describe("quota d'invitations en attente", () => {
  it("refuse au 5e (quota atteint)", () => {
    const pending = ["a@t.fr", "b@t.fr", "c@t.fr", "d@t.fr", "e@t.fr"];
    expect(evaluerInvitation(actif({ pendingInvitations: pending }), "bob@tribuzen.app", [], NOW)).toEqual({
      ok: false,
      reason: "quota",
    });
  });
  it("accepte à 4 invitations en attente (sous le quota)", () => {
    const pending = ["a@t.fr", "b@t.fr", "c@t.fr", "d@t.fr"];
    expect(evaluerInvitation(actif({ pendingInvitations: pending }), "bob@tribuzen.app", [], NOW)).toEqual({
      ok: true,
    });
  });
});

describe("invitation récemment révoquée — cooldown", () => {
  it(`refuse si révoquée il y a moins de ${COOLDOWN_JOURS} jours`, () => {
    const revokedAt = new Date(NOW.getTime() - (COOLDOWN_JOURS - 1) * 86_400_000);
    const member = actif({ revokedInvitations: [{ email: "bob@tribuzen.app", revokedAt }] });
    expect(evaluerInvitation(member, "bob@tribuzen.app", [], NOW)).toEqual({
      ok: false,
      reason: "recemment-revoquee",
    });
  });

  it(`accepte si révoquée il y a exactement ${COOLDOWN_JOURS} jours ou plus`, () => {
    const revokedAt = new Date(NOW.getTime() - COOLDOWN_JOURS * 86_400_000);
    const member = actif({ revokedInvitations: [{ email: "bob@tribuzen.app", revokedAt }] });
    expect(evaluerInvitation(member, "bob@tribuzen.app", [], NOW)).toEqual({ ok: true });
  });

  it("une révocation sur un AUTRE email n'affecte pas celui-ci", () => {
    const revokedAt = new Date(NOW.getTime() - 1 * 86_400_000);
    const member = actif({ revokedInvitations: [{ email: "chloe@tribuzen.app", revokedAt }] });
    expect(evaluerInvitation(member, "bob@tribuzen.app", [], NOW)).toEqual({ ok: true });
  });
});

describe("priorité des règles (ordre déterministe)", () => {
  it("un membre inactif est refusé même si l'email est aussi déjà membre", () => {
    expect(
      evaluerInvitation({ status: "inactif" }, "bob@tribuzen.app", ["bob@tribuzen.app"], NOW),
    ).toEqual({ ok: false, reason: "inactif" });
  });
});
