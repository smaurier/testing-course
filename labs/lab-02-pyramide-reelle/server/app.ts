// app.ts — LE SERVEUR (couche 2 : intégration). Donné, NE SE MODIFIE PAS.
// Utilise ta fonction pure `peutInviter` — le serveur ne réimplémente aucune règle métier,
// il orchestre (parse la requête, appelle la règle, sérialise la réponse).
import { createServer as createHttpServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { peutInviter } from "../src/validation";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

// État en mémoire : la liste des emails déjà invités pour la famille de démo.
const emailsInvites: string[] = ["alice@tribuzen.app"];

async function lireCorpsJSON(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const texte = Buffer.concat(chunks).toString("utf8");
  return texte ? JSON.parse(texte) : {};
}

export function createServer(): Server {
  return createHttpServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/invitations") {
      let body: unknown;
      try {
        body = await lireCorpsJSON(req);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, reason: "invalide" }));
        return;
      }
      const email = typeof body === "object" && body !== null ? (body as Record<string, unknown>).email : undefined;
      const resultat = peutInviter(emailsInvites, typeof email === "string" ? email : "");
      if (resultat.ok) emailsInvites.push(email as string);
      res.writeHead(resultat.ok ? 201 : 422, { "Content-Type": "application/json" });
      res.end(JSON.stringify(resultat));
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const html = await readFile(`${PUBLIC_DIR}/index.html`, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/app.js") {
      const js = await readFile(`${PUBLIC_DIR}/app.js`, "utf8");
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(js);
      return;
    }

    res.writeHead(404);
    res.end();
  });
}
