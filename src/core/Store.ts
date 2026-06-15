type Listener = () => void;

/**
 * Store réactif minimal et sans dépendance, pensé pour le pont React via
 * `useSyncExternalStore`. La logique de jeu mute l'état en place (perf), puis
 * appelle `bump()` pour notifier — typiquement une poignée de fois par seconde,
 * jamais à 60 fps. Le rendu 3D, lui, NE passe PAS par ce store : il lit l'état
 * directement dans sa propre boucle rAF.
 */
export class Store<T> {
  private state: T;
  private listeners = new Set<Listener>();
  /** Compteur de version : change d'identité à chaque notification. */
  private _version = 0;

  constructor(initial: T) {
    this.state = initial;
  }

  /** Lecture directe (utilisée par la boucle de jeu et le rendu). */
  getState = (): T => this.state;

  get version(): number {
    return this._version;
  }

  /** Remplace l'état (rare — ex. chargement d'une sauvegarde). */
  replace = (next: T): void => {
    this.state = next;
    this.bump();
  };

  /** Mutation en place puis notification. */
  update = (mut: (s: T) => void): void => {
    mut(this.state);
    this.bump();
  };

  /** Notifie les abonnés (UI React) qu'un changement observable a eu lieu. */
  bump = (): void => {
    this._version++;
    for (const l of this.listeners) l();
  };

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}
