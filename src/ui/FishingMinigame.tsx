import { useCallback, useEffect, useRef, useState } from 'react';
import { FishingSession, type StrikeResult } from '../systems/FishingSystem';
import { RARITY_LABEL, type FishSpecies } from '../data/types';
import { useGame } from './GameContext';

function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Mini-jeu de pêche — TIMING / PRÉCISION. Le curseur balaie la barre ; le
 * joueur frappe (Espace / clic / bouton) quand il chevauche la zone. La barre
 * est animée en impératif (rAF + refs) pour rester fluide sans solliciter le
 * cycle de rendu React à chaque frame.
 */
export function FishingMinigame({
  species,
  onClose,
}: {
  species: FishSpecies;
  onClose: () => void;
}) {
  const game = useGame();
  const sessionRef = useRef<FishingSession | null>(null);
  if (sessionRef.current === null) sessionRef.current = new FishingSession(species);
  const session = sessionRef.current;

  const cursorRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const perfectRef = useRef<HTMLDivElement>(null);

  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<StrikeResult | null>(null);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);

  const applyZone = useCallback(() => {
    if (zoneRef.current) {
      zoneRef.current.style.left = `${session.zoneStart * 100}%`;
      zoneRef.current.style.width = `${session.zoneSize * 100}%`;
    }
    if (perfectRef.current) {
      perfectRef.current.style.left = `${session.perfectStart * 100}%`;
      perfectRef.current.style.width = `${session.perfectSize * 100}%`;
    }
  }, [session]);

  // Boucle d'animation de la barre.
  useEffect(() => {
    applyZone();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!session.finished) {
        session.update(dt);
        if (cursorRef.current) cursorRef.current.style.left = `${session.cursor * 100}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session, applyZone]);

  const strike = useCallback(() => {
    if (session.finished) return;
    const result = session.strike();
    setHits(session.hits);
    setMisses(session.misses);
    setFlash(result);
    window.setTimeout(() => setFlash(null), 180);
    applyZone(); // repositionne la zone si zoneShuffle

    if (session.finished) {
      if (session.phase === 'won') {
        game.resolveCatch(species);
        setOutcome('won');
      } else {
        setOutcome('lost');
      }
    }
  }, [session, applyZone, game, species]);

  // Frappe au clavier (Espace / Entrée).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (outcome) onClose();
        else strike();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [strike, outcome, onClose]);

  const color = hex(species.tint);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && outcome && onClose()}>
      <div className="fishing">
        <div className="fishing-head">
          <span className="fishing-rarity" style={{ background: color }}>
            {RARITY_LABEL[species.rarity]}
          </span>
          <h2>{species.name}</h2>
        </div>

        {!outcome && (
          <>
            <div className="fishing-stats">
              <span>🎯 {hits}/{session.requiredHits}</span>
              <span>💔 {misses}/{session.missTolerance}</span>
            </div>

            <div className={`fishing-bar flash-${flash ?? 'none'}`} onMouseDown={strike}>
              <div ref={zoneRef} className="fishing-zone" />
              <div ref={perfectRef} className="fishing-perfect" />
              <div ref={cursorRef} className="fishing-cursor" />
              {flash && <div className={`fishing-flash flash-${flash}`}>{flashLabel(flash)}</div>}
            </div>

            <div className="fishing-progress">
              {Array.from({ length: session.requiredHits }).map((_, i) => (
                <span key={i} className={i < hits ? 'pip on' : 'pip'} />
              ))}
            </div>

            <button className="btn btn-primary fishing-strike" onMouseDown={strike}>
              FERRER&nbsp;<kbd>Espace</kbd>
            </button>
            <p className="fishing-hint">
              Frappe quand le curseur est sur la zone. Le cœur de la zone (or) = bonus « Parfait ».
            </p>
          </>
        )}

        {outcome === 'won' && (
          <Result
            title="Prise réussie !"
            tone="win"
            lines={[
              `${species.name} ajouté à l'inventaire de pêche`,
              `Qualité : ${session.quality}`,
              'Sélectionne un bac compatible pour l’y placer.',
            ]}
            onClose={onClose}
          />
        )}
        {outcome === 'lost' && (
          <Result
            title="La ligne a cassé…"
            tone="lose"
            lines={['Le poisson s’est échappé.', 'Les appâts ont été consommés.']}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function flashLabel(r: StrikeResult): string {
  return r === 'perfect' ? 'PARFAIT !' : r === 'hit' ? 'Touché' : 'Raté';
}

function Result({
  title,
  tone,
  lines,
  onClose,
}: {
  title: string;
  tone: 'win' | 'lose';
  lines: string[];
  onClose: () => void;
}) {
  return (
    <div className={`fishing-result ${tone}`}>
      <h3>{title}</h3>
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
      <button className="btn btn-primary" onClick={onClose} autoFocus>
        Continuer <kbd>Espace</kbd>
      </button>
    </div>
  );
}
