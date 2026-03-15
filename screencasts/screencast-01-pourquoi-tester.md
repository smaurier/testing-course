# Screencast 01 — Pourquoi tester ?

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/01-pourquoi-tester.md`
- **Lab associe** : Lab 01
- **Prérequis** : Screencast 00

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Fichier `modules/01-pourquoi-tester.md` ouvert
- [ ] Projet de demo du screencast 00 disponible

## Script

### [00:00-02:00] Introduction — Le cout des bugs

> On entend souvent "on n'a pas le temps de tester". Mais la vraie question est : a-t-on le temps de NE PAS tester ? Plus un bug est decouvert tard, plus il coute cher. Un bug en design coute 1x, en dev 5x, en QA 10x, en production 100x, après incident 1000x.

**Action** : Afficher la table des couts.

```
PHASE              | COUT RELATIF | EXEMPLE
-------------------|-------------|------------------------------------------
Design             | 1x          | "Ce calcul devrait arrondir au centime"
Developpement      | 5x          | Bug trouve en code review
QA / Staging       | 10x         | Bug trouve en test manuel
Production         | 100x        | Bug decouvert par un client
Post-incident      | 1000x       | Fuite de donnees, perte de confiance
```

### [02:00-05:00] Demo — Un bug concret sans tests

> Regardons un exemple concret. Un panier d'achat avec un bug subtil.

**Action** : Créer `src/cart.ts`.

```typescript
interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    // BUG : oubli de la quantite !
    return sum + item.price;
  }, 0);
}
```

> Ce bug passe inapercu si on teste manuellement avec des quantites de 1. Le client commande 3 t-shirts a 20 EUR, paye 20 EUR au lieu de 60 EUR. En production, ça coute très cher.

**Action** : Montrer le test qui l'aurait détecté.

```typescript
import { describe, it, expect } from 'vitest';
import { calculateTotal } from './cart';

describe('calculateTotal', () => {
  it('should multiply price by quantity', () => {
    const items = [{ name: 'T-shirt', price: 20, quantity: 3 }];
    expect(calculateTotal(items)).toBe(60); // FAIL → detecte le bug
  });
});
```

### [05:00-08:30] La pyramide de tests

> La pyramide de tests est le modèle fondamental. En bas : beaucoup de tests unitaires, rapides et isoles. Au milieu : des tests d'intégration, qui verifient que les modules fonctionnent ensemble. En haut : peu de tests E2E, lents mais realistes.

**Action** : Afficher la pyramide.

```
                    ┌─────────┐
                    │  E2E    │  Lents, realistes, couteux
                   ┌┴─────────┴┐
                   │Integration │  Vitesse moyenne, 2+ modules
                  ┌┴───────────┴┐
                  │  Unitaires   │  Rapides, isoles, nombreux
                  └──────────────┘

REGLE D'OR : plus on monte, moins on en ecrit
```

> La regle : 70% unitaires, 20% intégration, 10% E2E. Ce ratio n'est pas absolu mais donne une bonne base de depart.

### [08:30-11:00] Variantes modernes — Le trophee de testing

> Kent C. Dodds propose une variante : le trophee de testing. Il met davantage l'accent sur les tests d'intégration car ils offrent le meilleur rapport confiance/cout.

**Action** : Afficher le trophee.

```
        ┌───────┐
        │  E2E  │
       ┌┴───────┴┐
       │Integration│  ← Le gros du trophee
      ┌┴──────────┴┐
      │  Unitaires  │
      └──────┬──────┘
         ┌───┴───┐
         │Static │  ← TypeScript, ESLint
         └───────┘
```

> L'analyse statique (TypeScript, ESLint) est à la base. Elle attrape des bugs sans même exécuter le code. Les tests d'intégration sont le coeur car ils testent des cas d'usage réels sans la lenteur du E2E.

### [11:00-13:30] Quand tester et quand NE PAS tester

> Le testing à un ROI. Tout ne merite pas d'etre teste de la même manière.

**Action** : Afficher le tableau de decision.

```
A TESTER EN PRIORITE              | A NE PAS TESTER
----------------------------------|----------------------------------
Logique metier (calculs, regles)  | Getters/setters triviaux
Cas limites (0, null, vide)       | Code genere automatiquement
Integration API/DB                | Configuration declarative
Bugs corriges (test de regression)| Styles CSS purs
Flux critiques (paiement, auth)   | Code qui va etre supprime
```

> La regle : si un bug a cet endroit couterait cher en production, il faut un test. Si c'est du code trivial qui ne peut casser qu'en changeant intentionnellement, un test n'apporte pas de valeur.

### [13:30-16:00] Le ROI du testing — Convaincre son équipe

> Comment convaincre un product owner que le testing vaut l'investissement ?

**Action** : Afficher les metriques.

```
INVESTISSEMENT :
- +15-20% de temps de developpement initial

RETOUR :
- -40% de bugs en production (etude Microsoft)
- -60% de temps de debugging
- Refactoring en confiance (filet de securite)
- Documentation executable (les tests SONT la spec)
- Onboarding accelere (comprendre le code via les tests)
```

> Les tests ne ralentissent pas un projet — ils l'accelerent a moyen terme. Le cout initial est amorti des la première regression evitee.

### [16:00-17:30] Récapitulatif

> Recapitulons. Les bugs coutent exponentiellement plus cher quand on les découvre tard. La pyramide de tests guide la repartition des efforts. On teste en priorite la logique metier et les flux critiques. Et le ROI du testing est positif des le moyen terme.

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Plus un bug est decouvert tard, plus il coute cher (1x → 1000x)
2. Pyramide : 70% unitaires, 20% integration, 10% E2E
3. Tester la logique metier, pas les getters triviaux
4. Les tests sont un investissement, pas un cout
5. Les tests sont de la documentation executable

PROCHAINE ETAPE :
→ Screencast 02 : Anatomie d'un test
```

## Points d'attention pour l'enregistrement
- Le bug du panier est très parlant — bien montrer le FAIL du test
- La pyramide de tests est un concept clé — y passer du temps
- Le trophee de testing peut créer du debat — présenter comme une variante, pas un remplacement
- Le tableau "quand tester / ne pas tester" est un référence utile
- Garder un ton pragmatique, pas dogmatique
