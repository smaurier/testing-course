// Oracle UNITAIRE (couche 1). Pure, aucune I/O, aucun serveur. Ne pas modifier.
import { describe, it, expect } from "vitest";
import { peutInviter } from "../src/validation";

describe("peutInviter — couche unitaire", () => {
  it("accepte un email valide non déjà invité", () => {
    expect(peutInviter(["alice@tribuzen.app"], "bob@tribuzen.app")).toEqual({ ok: true });
  });

  it("refuse un email déjà invité", () => {
    expect(peutInviter(["alice@tribuzen.app"], "alice@tribuzen.app")).toEqual({
      ok: false,
      reason: "deja-invite",
    });
  });

  it("refuse un format invalide (pas de @)", () => {
    expect(peutInviter([], "bob-tribuzen.app")).toEqual({ ok: false, reason: "invalide" });
  });

  it("refuse une chaîne vide", () => {
    expect(peutInviter([], "")).toEqual({ ok: false, reason: "invalide" });
  });

  it("la comparaison de doublon est insensible à la casse (b@t.fr == B@t.fr)", () => {
    expect(peutInviter(["bob@tribuzen.app"], "BOB@tribuzen.app")).toEqual({
      ok: false,
      reason: "deja-invite",
    });
  });
});
