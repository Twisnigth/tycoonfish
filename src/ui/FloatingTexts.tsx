import { useEffect, useRef, useState } from 'react';
import { useGame } from './GameContext';
import { formatMoney } from '../core/numbers';

interface Float {
  id: number;
  text: string;
  x: number;
  kind: 'money' | 'catch' | 'tier';
  ttl: number;
}

/** Textes flottants en overlay : revenus, captures, franchissements de palier. */
export function FloatingTexts() {
  const game = useGame();
  const [items, setItems] = useState<Float[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = (text: string, kind: Float['kind'], ttl: number) => {
      const id = ++idRef.current;
      const x = 42 + Math.random() * 16;
      setItems((s) => [...s, { id, text, x, kind, ttl }]);
      window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), ttl);
    };

    const off = [
      game.events.on('income', ({ amount }) => spawn('+' + formatMoney(amount), 'money', 1400)),
      game.events.on('fishCaught', ({ species }) => spawn(`${species.name} pêché !`, 'catch', 1900)),
      game.events.on('tierUp', (tier) => spawn(`★ ${tier.name} ★`, 'tier', 2800)),
    ];
    return () => off.forEach((fn) => fn());
  }, [game]);

  return (
    <div className="floats">
      {items.map((i) => (
        <span key={i.id} className={`float ${i.kind}`} style={{ left: `${i.x}%` }}>
          {i.text}
        </span>
      ))}
    </div>
  );
}
