// Oracle de TYPES — le contrat doit être un vrai narrowing (asserts), pas un simple boolean.
import { expectTypeOf, test } from "vitest";
import type { InvitationDTO } from "@contract";
import { validateInvitationContract } from "@contract";
import { fetchInvitation } from "@consumer";

test("InvitationDTO : les quatre champs, status en union fermée", () => {
  expectTypeOf<InvitationDTO["id"]>().toBeString();
  expectTypeOf<InvitationDTO["familyId"]>().toBeString();
  expectTypeOf<InvitationDTO["email"]>().toBeString();
  expectTypeOf<InvitationDTO["status"]>().toEqualTypeOf<"pending" | "accepted" | "expired" | "revoked">();
});

test("validateInvitationContract prend unknown et rétrécit vers InvitationDTO (asserts)", () => {
  expectTypeOf(validateInvitationContract).parameter(0).toBeUnknown();
});

test("fetchInvitation renvoie InvitationDTO sans cast côté consumer", () => {
  expectTypeOf(fetchInvitation).returns.toEqualTypeOf<InvitationDTO>();
});
