import type { Game } from './Game';
import { TICK_MS } from '../data/balance';

/**
 * Boucle de jeu à pas fixe.
 *  - TICK LOGIQUE : `setInterval` à TICK_MS (1 s). Déterministe et indépendant
 *    des FPS ; les navigateurs bornent l'intervalle d'arrière-plan à ~1 s, ce
 *    qui s'aligne sur notre tick (les écarts longs sont rattrapés à la reprise
 *    via la progression hors-ligne).
 *  - RENDU : `requestAnimationFrame`, fournit un `dt` lissé aux systèmes
 *    visuels (boids, animations, textes flottants) — jamais couplé à React.
 */
export type RenderCallback = (dtSeconds: number) => void;

export class GameLoop {
  running = false;
  private intervalId: number | undefined;
  private raf = 0;
  private lastRender = 0;

  constructor(
    private readonly game: Game,
    private readonly onRender?: RenderCallback,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    this.intervalId = window.setInterval(() => {
      this.game.tick(1);
      this.game.state.stats.playtimeMs += TICK_MS;
    }, TICK_MS);

    this.lastRender = performance.now();
    this.raf = requestAnimationFrame(this.renderLoop);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== undefined) window.clearInterval(this.intervalId);
    cancelAnimationFrame(this.raf);
  }

  private renderLoop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastRender) / 1000);
    this.lastRender = now;
    this.onRender?.(dt);
    if (this.running) this.raf = requestAnimationFrame(this.renderLoop);
  };
}
