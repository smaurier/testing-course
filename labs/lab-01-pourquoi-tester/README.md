# Lab 01 — Pourquoi tester

> **Outcome :** à la fin, tu sais écrire un test Vitest qui révèle un vrai bug de logique métier, corriger ce bug guidé par le test rouge, et décider quoi tester (et quoi ignorer) dans du code TribuZen réel.
> **Vrai outil :** Vitest (`describe`, `it`, `expect`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Le bug d'invitation TribuZen est en prod. La fonction `canInvite` compare les emails avec `===` strict : `'Alice@famille.fr'` et `'alice@famille.fr'` sont acceptées comme deux invitations distinctes. Résultat : double email envoyé, doublon en base.

Voici le code de départ — **ne modifie pas `invitation.ts` avant l'étape 3** :

```ts
// src/invitation/invitation.ts
export function canInvite(email: string, existingEmails: string[]): boolean {
  return !existingEmails.includes(email);
}
```

Ta mission en trois temps :

1. Écrire les tests qui **décrivent le comportement attendu** (insensibilité à la casse incluse).
2. Constater que le test de casse **échoue** (rouge) — le bug est maintenant visible et localisé.
3. Corriger `canInvite` jusqu'à ce que **tous les tests passent** (vert).

Puis, en bonus, décider quoi tester dans quatre fonctions TribuZen supplémentaires (étape 4).

## Étapes (en friction)

1. **Setup.** Crée `src/invitation/invitation.test.ts`. Importe `describe`, `it`, `expect` depuis `vitest` et `canInvite` depuis `./invitation`. Lance `npx vitest run` — tu dois voir `No test files found` ou une suite vide.

2. **Écris les tests du comportement attendu.** Sans regarder la solution, écris trois cas dans un `describe('canInvite')` :
   - un email absent de la liste → doit retourner `true`
   - un email déjà présent (même casse) → doit retourner `false`
   - le même email avec une casse différente (`'Alice@famille.fr'` vs `'alice@famille.fr'`) → doit retourner `false`

   Lance `npx vitest run`. Les deux premiers passent. Le troisième est rouge. C'est normal — c'est le but.

3. **Corrige `canInvite` pour passer au vert.** Modifie uniquement `invitation.ts`. Indice : normalise les deux côtés de la comparaison avant `includes`. Relance `npx vitest run` — les trois tests doivent être verts.

4. **Décision quoi tester.** Pour chacune des quatre fonctions suivantes, décide (oui / non) si elle mérite un test unitaire, et justifie en une phrase :

```ts
// A — constante
export const INVITATION_EXPIRY_DAYS = 7;

// B — logique temporelle avec branchement
export function isInvitationExpired(invitation: { createdAt: Date }): boolean {
  const expiryMs = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - invitation.createdAt.getTime() > expiryMs;
}

// C — getter trivial
export function getInvitationId(inv: { id: string }): string { return inv.id; }

// D — validation avec règles multiples
export function validateInvitationEmail(email: string): string | null {
  if (!email.includes('@')) return 'Format invalide';
  if (email.length > 254) return 'Email trop long';
  return null;
}
```

Réponds à voix haute au coach avant de regarder la solution.

## Corrigé complet commenté

```ts
// src/invitation/invitation.test.ts
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation';

describe('canInvite', () => {
  // Cas nominal : email absent → invitation possible
  it('autorise un email absent de la liste', () => {
    expect(canInvite('bob@famille.fr', ['alice@famille.fr'])).toBe(true);
    //                ^^^               ^^^^ email différent → doit retourner true
  });

  // Cas de refus direct : même casse — vérifie le chemin heureux du "déjà présent"
  it('refuse un email déjà présent (même casse)', () => {
    expect(canInvite('alice@famille.fr', ['alice@famille.fr'])).toBe(false);
  });

  // Cas limite qui révèle le bug : casse différente
  // Sans normalisation, includes('Alice@...') ne trouve pas 'alice@...' → retourne true (bug)
  // Avec normalisation, les deux sont ramenés en minuscules → includes trouve la correspondance → retourne false
  it('refuse un email déjà présent même si la casse diffère', () => {
    expect(canInvite('Alice@famille.fr', ['alice@famille.fr'])).toBe(false);
    expect(canInvite('alice@famille.fr', ['Alice@famille.fr'])).toBe(false);
    expect(canInvite('ALICE@FAMILLE.FR', ['alice@famille.fr'])).toBe(false);
    // Trois variantes pour couvrir tous les sens de la casse asymétrique
  });
});
```

```ts
// src/invitation/invitation.ts — version corrigée
export function canInvite(email: string, existingEmails: string[]): boolean {
  // Normaliser des deux côtés garantit une comparaison insensible à la casse.
  // toLowerCase() est le standard pour les emails (RFC 5321 : local-part case-insensitive en pratique).
  const normalized = email.toLowerCase();
  return !existingEmails.map(e => e.toLowerCase()).includes(normalized);
}
```

Résultat après correction :
```
✓ autorise un email absent de la liste
✓ refuse un email déjà présent (même casse)
✓ refuse un email déjà présent même si la casse diffère
```

**Décision quoi tester (étape 4) :**

- **A — `INVITATION_EXPIRY_DAYS = 7` → NON.** Constante sans logique. Tester reviendrait à écrire `expect(INVITATION_EXPIRY_DAYS).toBe(7)` — ce test ne prouve rien, il duplique la valeur.

- **B — `isInvitationExpired` → OUI, en priorité.** Deux branches (expiré / valide), dépend de `Date.now()` (non déterministe → fake timers en module 04), règle critique (une invitation expirée acceptée = faille). Cas à couvrir : invitation créée hier (valide), invitation créée il y a 8 jours (expirée), invitation créée exactement à la frontière.

- **C — `getInvitationId` → NON.** Getter trivial, aucune transformation, aucun branchement. Le test serait `expect(getInvitationId({ id: 'x' })).toBe('x')` — copie exacte du code.

- **D — `validateInvitationEmail` → OUI.** Plusieurs règles, plusieurs branches, plusieurs valeurs de retour (null ou string). Chaque règle mérite son propre `it` : email valide → null, sans `@` → message, trop long → message. Un test par règle facilite le diagnostic quand une règle casse.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 15 min**, avec la contrainte suivante : `canInvite` doit maintenant aussi refuser les emails avec des espaces en tête ou en queue (`' alice@famille.fr'`). Modifie d'abord les tests pour inclure ce cas, constate l'échec (rouge), puis modifie la fonction pour passer au vert. Discrimine à voix haute : s'agit-il du même type de bug (normalisation) ou d'un bug différent ? La structure du fix est-elle identique ou différente ?

Bonus : écris un test pour `isInvitationExpired` en utilisant `vi.setSystemTime(new Date('2026-07-01'))` pour rendre le test déterministe. Consulte `vi.useFakeTimers()` dans la doc Vitest si besoin.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/invitation/invitation.ts` avec la fonction `canInvite` corrigée (normalisation `.toLowerCase()` + `.trim()` si tu as fait la variante J+30).
2. Écris `src/invitation/invitation.test.ts` avec les trois cas minimum (absent, présent même casse, présent casse différente). Lance `npm test` (`vitest run`, déjà configuré depuis module 00).
3. Ajoute `validateInvitationEmail` et ses tests (un `it` par règle). Vérifie que la suite reste verte.
4. Commit : `test(invitation): canInvite — normalisation casse + validateInvitationEmail`.

Le contrat de la couche domaine est maintenant spécifié et protégé. Toute modification future de ces fonctions qui casserait la normalisation sera détectée immédiatement, avant le PR.
