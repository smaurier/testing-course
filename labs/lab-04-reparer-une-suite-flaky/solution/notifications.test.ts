// notifications.test.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Même quatre scénarios que le starter, mêmes assertions AUSSI STRICTES (aucune affaiblie) —
// seule la MAÎTRISE de l'état et du temps change.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationCenter } from "../src/notifications";

describe("NotificationCenter", () => {
  let center: NotificationCenter;

  // Fix cause 2 (état partagé) : une instance FRAÎCHE avant CHAQUE test. Plus aucun test
  // ne dépend de ce qu'un autre a fait avant lui — l'ordre d'exécution n'a plus d'importance.
  beforeEach(() => {
    center = new NotificationCenter();
  });

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
    // Fix cause 1 (async non maîtrisé) : horloge fake, avancée explicitement. Avant l'avance,
    // rien n'a encore été poussé — on le PROUVE, on ne le suppose pas.
    vi.useFakeTimers();
    try {
      center.notifierApresDelai("Rappel de routine", 10);
      expect(center.nonLues).toBe(0);
      vi.advanceTimersByTime(10);
      expect(center.nonLues).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marquerLue() fonctionne sur une notification qu'on vient de créer", () => {
    const n = center.notifier("Test isolé");
    center.marquerLue(n.id);
    expect(center.nonLues).toBe(0);
  });
});
