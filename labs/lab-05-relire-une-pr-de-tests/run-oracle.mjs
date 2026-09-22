#!/usr/bin/env node
// Oracle du lab 05 : une bonne suite de tests doit (1) passer contre l'implémentation
// correcte, ET (2) ÉCHOUER contre le mutant (preuve qu'elle détecte le bug). Une suite qui
// passe dans les deux cas ne teste rien de discriminant — c'est exactement le défaut de la
// PR d'origine.
// Usage : node run-oracle.mjs lab | node run-oracle.mjs solution
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const mode = process.argv[2] === "solution" ? "solution" : "lab";
const srcConfig = mode === "solution" ? "vitest.solution.src.config.ts" : "vitest.src.config.ts";
const mutantConfig = mode === "solution" ? "vitest.solution.mutant.config.ts" : "vitest.mutant.config.ts";
const suite = mode === "solution" ? "solution/age.test.ts" : "test/age.test.ts";

function run(config) {
  const r = spawnSync("npx", ["vitest", "run", "--config", config], { encoding: "utf8", shell: true, cwd: HERE });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

console.log(`\n— Oracle lab-05 (${mode}) — suite : ${suite}\n`);

const against = run(srcConfig);
const okAgainstSrc = against.code === 0;
console.log(okAgainstSrc ? "✅ passe contre l'implémentation correcte (src/)" : "❌ échoue contre l'implémentation correcte (src/) — la suite ne doit JAMAIS échouer sur du code correct");
if (!okAgainstSrc) console.log(against.out);

const mutant = run(mutantConfig);
const killsMutant = mutant.code !== 0;
console.log(killsMutant ? "✅ échoue contre le mutant — le bug est détecté" : "❌ passe AUSSI contre le mutant — la suite ne détecte pas le bug, elle est trop faible");

const success = okAgainstSrc && killsMutant;
console.log(`\n${success ? "GREEN" : "RED"} — ${success ? "la suite est correcte ET discriminante." : "corrige test/age.test.ts (voir README § Étapes)."}\n`);
process.exit(success ? 0 : 1);
