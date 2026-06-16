import { useEffect, useRef, useState } from 'react';
import { useGame } from './GameContext';
import { getFish } from '../data/fish';

interface Float {
  id: number;
  text: string;
}

/** Petits feedbacks flottants (capture de poisson). */
export function FloatingTexts() {
  const game = useGame();
  const [items, setItems] = useState<Float[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const off = game.events.on('fishCaught', ({ speciesId }) => {
      const id = ++idRef.current;
      const name = getFish(speciesId)?.name ?? 'Poisson';
      setItems((s) => [...s, { id, text: `${name} pêché !` }]);
      window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 1900);
    });
    return off;
  }, [game]);

  return (
    <div className="floats">
      {items.map((i) => (
        <span key={i.id} className="float catch">
          {i.text}
        </span>
      ))}
    </div>
  );
}
