# Lab 15 — TDD et BDD

> **Outcome :** à la fin, tu sais mener un kata TDD de bout en bout — écrire le test en premier, le voir rouge, écrire le minimum de code, le voir vert, refactorer — avec Vitest réel.
> **Vrai outil :** Vitest (`describe`, `it`, `expect`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu implémentes la règle d'invitation TribuZen `canInvite` en **TDD strict** — test d'abord, code ensuite, refactor après chaque Green.

Règles métier à couvrir, dans cet ordre :

1. Un membre `INACTIVE` ne peut pas inviter.
2. Un membre `ACTIVE` peut inviter une adresse email absente de la liste des membres.
3. Un membre `ACTIVE` ne peut pas inviter une adresse déjà membre.
4. Un membre `ACTIVE` ne peut pas inviter si son quota d'invitations en attente est >= 5.

Code de départ — **fichiers vides** :

```ts
// src/domain/invitation-rules.ts
// (vide — ne pas écrire une ligne ici avant d'avoir un test rouge)
```

```ts
// src/domain/invitation-rules.test.ts
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation-rules';

describe('canInvite', () => {
  // — tu écris les tests ici, un par un —
});
```

## Étapes (en friction)

1. **Cycle 1 — RED.** Écris le premier test : `canInvite({ status: 'INACTIVE' }, 'bob@tribu.fr', [])` retourne `false`. Lance `npx vitest run`. Lis l'erreur. C'est ton feu rouge.

2. **Cycle 1 — GREEN.** Crée `invitation-rules.ts` et exporte une fonction `canInvite` qui retourne `false`. Lance. Vert. Refactor : rien à faire.

3. **Cycle 2 — RED (triangulation).** Ajoute le test : `canInvite({ status: 'ACTIVE' }, 'bob@tribu.fr', [])` retourne `true`. Lance. Rouge (le `return false` hardcodé échoue — preuve que le test est utile).

4. **Cycle 2 — GREEN.** Implémente le branchement sur `member.status === 'ACTIVE'`. Lance. Vert. Refactor : nommage lisible ?

5. **Cycle 3 — RED.** Ajoute le test : email déjà dans `existingEmails` → `false`. Lance. Rouge.

6. **Cycle 3 — GREEN.** Ajoute le prédicat `existingEmails.includes(email)`. Lance. Vert. Refactor.

7. **Cycle 4 — RED.** Ajoute le test : un membre avec 5 entrées dans `pendingInvitations` → `false`. Lance. Rouge (le type ne connaît pas encore `pendingInvitations`).

8. **Cycle 4 — GREEN + REFACTOR.** Ajoute le champ optionnel au type et le prédicat `length >= 5`. Lance. Vert. Refactor : extrait une interface `Member` nommée avec les deux champs.

9. **Validation finale.** Les 4 tests doivent être verts. Chaque test couvre une seule règle. Aucune règle n'est testée deux fois.

Contrainte : **ne pas ouvrir `invitation-rules.ts` avant d'avoir un test rouge**. Chaque cycle doit être complet (RED → GREEN → REFACTOR) avant le suivant.

## Corrigé complet commenté

```ts
// src/domain/invitation-rules.test.ts
import { describe, it, expect } from 'vitest';
import { canInvite, type Member } from './invitation-rules';

describe('canInvite', () => {
  // Cycle 1 : cas de base — le statut INACTIVE bloque tout.
  // Implémentation minimale attendue : return false hardcodé.
  it('retourne false si le membre est INACTIVE', () => {
    expect(canInvite({ status: 'INACTIVE' }, 'bob@tribu.fr', [])).toBe(false);
  });

  // Cycle 2 : triangulation — ACTIVE + email libre = peut inviter.
  // Ce test force la suppression du return false hardcodé.
  // Sans ce test, return false suffit et aucune logique réelle n'émerge.
  it('retourne true si le membre est ACTIVE et email absent de la liste', () => {
    expect(canInvite({ status: 'ACTIVE' }, 'bob@tribu.fr', [])).toBe(true);
  });

  // Cycle 3 : règle email — déjà membre → refus.
  // On passe une liste contenant l'email cible pour forcer le prédicat includes().
  it("retourne false si l'email est déjà dans la liste des membres", () => {
    expect(
      canInvite({ status: 'ACTIVE' }, 'bob@tribu.fr', ['alice@tribu.fr', 'bob@tribu.fr'])
    ).toBe(false);
  });

  // Cycle 4 : règle quota — 5 invitations en attente = quota plein.
  // Ce test révèle le besoin d'un champ pendingInvitations sur le membre.
  // L'interface Member est extraite PENDANT ce refactor, pas avant.
  it("retourne false si le quota d'invitations en attente est atteint", () => {
    const member: Member = {
      status: 'ACTIVE',
      pendingInvitations: ['a@t.fr', 'b@t.fr', 'c@t.fr', 'd@t.fr', 'e@t.fr'],
    };
    expect(canInvite(member, 'bob@tribu.fr', [])).toBe(false);
  });
});
```

```ts
// src/domain/invitation-rules.ts

// Interface extraite lors du refactor du cycle 4.
// Elle n'existait pas avant — YAGNI respecté.
export interface Member {
  status: string;
  pendingInvitations?: string[]; // optionnel : non requis aux cycles 1-3
}

export function canInvite(
  member: Member,
  email: string,
  existingEmails: string[]
): boolean {
  // Règle 1 — statut ACTIVE requis (ajoutée au cycle 2)
  if (member.status !== 'ACTIVE') return false;

  // Règle 2 — email ne doit pas être déjà membre (ajoutée au cycle 3)
  if (existingEmails.includes(email)) return false;

  // Règle 3 — quota d'invitations en attente (ajoutée au cycle 4)
  // ?? [] : pendingInvitations est optionnel, les membres sans quota ont 0 invitations
  if ((member.pendingInvitations ?? []).length >= 5) return false;

  return true;
}
```

Points de validation par le coach :

- (a) 4 cycles distincts — chaque test a été rouge avant d'être vert.
- (b) Le cycle 2 a forcé la suppression du `return false` hardcodé (triangulation effective).
- (c) L'interface `Member` a été extraite au refactor du cycle 4, pas dès le début.
- (d) Chaque test couvre exactement une règle — aucun test « tout en un ».

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 20 min**, et ajoute deux règles supplémentaires.

- Règle 5 : l'email cible doit contenir `@` et un domaine (format valide minimal). Écris d'abord le test — quelle entrée invalide prouve la règle ?
- Règle 6 : un membre ne peut pas s'auto-inviter (son propre email ne peut pas être la cible). Triangule : un email différent passe, son propre email échoue.

Bonus : après les 6 cycles, refactor en extrayant chaque prédicat (`isActive`, `isEmailAvailable`, `isUnderQuota`, `isValidEmail`, `isSelfInvite`) dans des fonctions privées nommées. Prouve que les 6 tests restent verts après chaque extraction.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/domain/invitation-rules.ts` (vide) et `src/domain/invitation-rules.test.ts`.
2. Joue les 4 cycles du kata : INACTIVE → ACTIVE libre → email déjà membre → quota dépassé.
3. Branche `canInvite` dans `InvitationService.invite()` (module 04) : `if (!canInvite(member, email, existing)) throw new Error('CANNOT_INVITE')`.
4. Commit `smaurier/tribuzen` : `feat(domain): canInvite — TDD strict 4 cycles red-green-refactor`.
