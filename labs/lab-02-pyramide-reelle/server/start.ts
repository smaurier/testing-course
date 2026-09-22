// start.ts — point d'entrée pour Playwright (webServer). Donné.
import { createServer } from "./app";

const PORT = 4173;
createServer().listen(PORT, () => {
  console.log(`Serveur de démo TribuZen sur http://localhost:${PORT}`);
});
