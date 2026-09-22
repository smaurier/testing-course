// Oracle D'INTÉGRATION (couche 2). Un vrai serveur HTTP en mémoire, de vraies requêtes —
// mais pas de navigateur. Ne pas modifier.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import request from "supertest";
import { createServer } from "../server/app";

let server: Server;

beforeAll(() => {
  server = createServer();
});
afterAll(() => {
  server.close();
});

describe("POST /api/invitations — couche intégration", () => {
  it("201 pour un email valide et nouveau", async () => {
    const res = await request(server).post("/api/invitations").send({ email: "chloe@tribuzen.app" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it("422 pour un email déjà invité (alice, seedée au démarrage)", async () => {
    const res = await request(server).post("/api/invitations").send({ email: "alice@tribuzen.app" });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ ok: false, reason: "deja-invite" });
  });

  it("422 pour un email invalide", async () => {
    const res = await request(server).post("/api/invitations").send({ email: "pas-un-email" });
    expect(res.status).toBe(422);
    expect(res.body.reason).toBe("invalide");
  });

  it("sert la page d'accueil en GET /", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("invitation-form");
  });
});
