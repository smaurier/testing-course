// Oracle de TYPES du lab 01 Testing.
import { expectTypeOf, test } from "vitest";
import type { InvitationResult, InvitationRefus, MemberStatus } from "@lab/invitation";
import { evaluerInvitation, COOLDOWN_JOURS } from "@lab/invitation";

test("InvitationResult est une union discriminée sur ok", () => {
  expectTypeOf<InvitationResult>().toEqualTypeOf<{ ok: true } | { ok: false; reason: InvitationRefus }>();
});

test("InvitationRefus liste exactement les quatre raisons de refus", () => {
  expectTypeOf<InvitationRefus>().toEqualTypeOf<"inactif" | "deja-membre" | "quota" | "recemment-revoquee">();
});

test("MemberStatus est une union fermée de trois littéraux", () => {
  expectTypeOf<MemberStatus>().toEqualTypeOf<"actif" | "inactif" | "suspendu">();
});

test("COOLDOWN_JOURS est un littéral numérique exporté (pas une valeur magique cachée)", () => {
  expectTypeOf(COOLDOWN_JOURS).toBeNumber();
});

test("evaluerInvitation prend un Date explicite : pas de Date.now() caché (déterminisme)", () => {
  expectTypeOf(evaluerInvitation).parameter(3).toEqualTypeOf<Date>();
  expectTypeOf(evaluerInvitation).returns.toEqualTypeOf<InvitationResult>();
});
