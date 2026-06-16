import type { Game } from './Game';
import { TICK_MS } from '../data/balance';

/**
 * Boucle de jeu pilotée par `requestAnimationFrame`, avec FACTEUR DE VITESSE
 * (0 = pause, 1/2/3 = ×). Le temps réel `dt` est multiplié par la vitesse :
 *  - le tick logique (économie/écosystème, 1 Hz simulé) avance via un
 *    accumulateur sur le temps mis à l'échelle ;
 *  - le rendu reçoit le `dt` mis à l'échelle (animations/agents accélèrent avec
 *    la vitesse ; à 0 tout se fige mais la scène continue d'être dessinée).
 */
export type RenderCallback = (dtSeconds: number) => void;
export type SpeedGetter = () => number;

export class GameLoop {
  running = false;
  private raf = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly game: Game,
    private readonly onRender?: RenderCallback,
    private readonly getSpeed: SpeedGetter = () => 1,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = (now: number): void => {
    const real = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const speed = Math.max(0, this.getSpeed());
    const scaled = real * speed;

    // Tick logique 1 Hz (simulé), rattrapage borné.
    this.acc += scaled * 1000;
    let guard = 0;
    while (this.acc >= TICK_MS && guard < 8) {
      this.game.tick();
      this.game.state.stats.playtimeMs += TICK_MS;
      this.acc -= TICK_MS;
      guard++;
    }
    if (this.acc > TICK_MS * 8) this.acc = 0; // évite la spirale

    this.onRender?.(scaled);
    if (this.running) this.raf = requestAnimationFrame(this.loop);
  };
}
