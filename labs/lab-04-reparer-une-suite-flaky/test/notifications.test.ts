// notifications.test.ts — LA SUITE À RÉPARER. C'est CE fichier que tu modifies (pas de src/,
// pas de solution/ séparée dans ce lab : le test EST le livrable). Elle contient deux causes
// classiques de flakiness (module 14) : état partagé entre tests, et async non maîtrisé.
// Contrainte : AUCUNE assertion ne doit être affaiblie ni retirée. Zéro `.skip`, zéro `.todo`,
// zéro `retry`, zéro timeout augmenté en pansement — le module est clair là-dessus : la
// quarantaine et les retries ne sont pas des corrections, ils cachent le symptôme.
import { describe, it, expect } from "vitest";
import { NotificationCenter } from "@lab/notifications";

describe("NotificationCenter", () => {
  // Instance créée UNE FOIS au niveau du describe, partagée par tous les tests ci-dessous.
  const center = new NotificationCenter();

  it("un premier rappel système est déjà présent au démarrage", () => {
    center.notifier("Rappel système au démarrage");
    expect(center.nonLues).toBe(1);
  });

  it("notifier() crée une notification non lue avec l'id 1", () => {
    const n = center.notifier("Bienvenue dans TribuZen");
    expect(n.id).toBe(1);
    expect(center.nonLues).toBe(1);
  });

  it("notifierApresDelai() crée une notification après le délai", () => {
    center.notifierApresDelai("Rappel de routine", 10);
    expect(center.nonLues).toBe(3);
  });

  it("marquerLue() fonctionne sur une notification qu'on vient de créer", () => {
    const n = center.notifier("Test isolé");
    center.marquerLue(n.id);
    expect(center.nonLues).toBe(0);
  });
});
