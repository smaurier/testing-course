// Oracle CONSUMER — ton contrat doit vraiment valider, pas juste "passer". Ne pas modifier.
import { describe, it, expect } from "vitest";
import { fetchInvitation } from "@consumer";

const conforme = { id: "i1", familyId: "f1", email: "bob@tribuzen.app", status: "pending" };

describe("fetchInvitation — le front ne fait confiance qu'au contrat", () => {
  it("accepte et type une réponse conforme", () => {
    const invitation = fetchInvitation(conforme);
    expect(invitation).toEqual(conforme);
  });

  it("rejette une réponse sans `status`", () => {
    const { status, ...sansStatus } = conforme;
    expect(() => fetchInvitation(sansStatus)).toThrow();
  });

  it("rejette une réponse où `email` est imbriqué sous `contact` (dérive provider)", () => {
    const { email, ...reste } = conforme;
    expect(() => fetchInvitation({ ...reste, contact: { email } })).toThrow();
  });

  it("rejette null, undefined et les primitifs", () => {
    expect(() => fetchInvitation(null)).toThrow();
    expect(() => fetchInvitation(undefined)).toThrow();
    expect(() => fetchInvitation("i1")).toThrow();
  });

  it("rejette un `status` hors de l'union attendue", () => {
    expect(() => fetchInvitation({ ...conforme, status: "archived" })).toThrow();
  });
});
