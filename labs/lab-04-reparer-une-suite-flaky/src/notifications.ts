// notifications.ts — L'IMPLÉMENTATION SOUS TEST. Elle est correcte et NE SE MODIFIE PAS dans ce lab.
// Le bug n'est jamais ici : il est dans la suite de tests (test/notifications.test.ts), que tu
// vas réparer en place. C'est le geste réel : la majorité des tests flaky viennent du TEST,
// pas du code testé.
export interface Notification {
  id: number;
  message: string;
  lue: boolean;
}

export class NotificationCenter {
  private items: Notification[] = [];
  private prochainId = 1;

  get toutes(): readonly Notification[] {
    return this.items;
  }

  get nonLues(): number {
    return this.items.filter((n) => !n.lue).length;
  }

  notifier(message: string): Notification {
    const n: Notification = { id: this.prochainId++, message, lue: false };
    this.items.push(n);
    return n;
  }

  /** Programme une notification après un délai (rappel différé). */
  notifierApresDelai(message: string, delaiMs: number): void {
    setTimeout(() => {
      this.notifier(message);
    }, delaiMs);
  }

  marquerLue(id: number): void {
    const n = this.items.find((x) => x.id === id);
    if (n) n.lue = true;
  }
}
