type Handler<P> = (payload: P) => void;

/**
 * Émetteur d'événements typé, minimal. Sert à découpler la LOGIQUE (qui émet
 * « poisson pêché », « palier franchi », « revenu ») de la VUE 3D et des
 * feedbacks (textes flottants, animations de transition), sans dépendance.
 */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    (this.handlers[type] ??= new Set()).add(fn);
    return () => this.handlers[type]?.delete(fn);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.handlers[type]?.forEach((fn) => fn(payload));
  }
}
