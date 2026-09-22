// Oracle PROVIDER — le provider réel doit satisfaire TON contrat. Ne pas modifier.
import { describe, it, expect } from "vitest";
import { getInvitationResponse } from "@provider";
import { validateInvitationContract } from "@contract";

describe("getInvitationResponse — le provider honore le contrat du consumer", () => {
  it("la réponse du provider passe la validation du contrat", () => {
    const response = getInvitationResponse("i1");
    expect(() => validateInvitationContract(response)).not.toThrow();
  });
});
