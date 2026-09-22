#!/usr/bin/env node
// Oracle du lab 02 : les TROIS couches de la pyramide, dans l'ordre — unitaire, intégration,
// e2e. Si l'unitaire est rouge, on ne lance même pas la suite (ça reproduit la vraie raison
// d'être de la pyramide : la base rapide te dit vite si la suite vaut la peine d'être lancée).
// Usage : node run-oracle.mjs lab | node run-oracle.mjs solution
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const SRC = join(HERE, "src/validation.ts");
const BACKUP = join(HERE, "src/validation.ts.bak");
const SOLUTION = join(HERE, "solution/src/validation.ts");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function main() {
  if (mode === "solution") {
    copyFileSync(SRC, BACKUP);
    copyFileSync(SOLUTION, SRC);
    console.log("— mode solution : src/validation.ts temporairement remplacé par la référence —\n");
  }

  try {
    console.log("\n=== Couche 1/3 — unitaire ===\n");
    if (!run("npx", ["vitest", "run", "test/unit.validation.test.ts"])) {
      console.log("\n❌ RED — la couche unitaire échoue, inutile de lancer intégration/e2e (comme en vrai).\n");
      return 1;
    }

    console.log("\n=== Couche 2/3 — intégration ===\n");
    if (!run("npx", ["vitest", "run", "test/integration.api.test.ts"])) {
      console.log("\n❌ RED — la couche intégration échoue.\n");
      return 1;
    }

    console.log("\n=== Couche 3/3 — e2e (vrai navigateur) ===\n");
    if (!run("npx", ["playwright", "test"])) {
      console.log("\n❌ RED — la couche e2e échoue.\n");
      return 1;
    }

    console.log("\n✅ GREEN — les trois couches de la pyramide passent.\n");
    return 0;
  } finally {
    if (mode === "solution" && existsSync(BACKUP)) {
      copyFileSync(BACKUP, SRC);
      unlinkSync(BACKUP);
      console.log("— src/validation.ts restauré à son état de départ —");
    }
  }
}

// process.exit() à l'intérieur d'un try tue le process AVANT le finally : on capture le code
// de sortie dans une variable normale et on sort une seule fois, après le try/finally.
process.exit(main());
