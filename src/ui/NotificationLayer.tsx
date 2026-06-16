import { useEffect, useRef, useState } from 'react';
import { useGame } from './GameContext';
import type { NotifyKind } from '../core/Game';

interface Notif {
  id: number;
  text: string;
  kind: NotifyKind;
}

/** Toasts d'alerte (mort de poisson, bac sale, trésorerie basse, naissances…). */
export function NotificationLayer() {
  const game = useGame();
  const [items, setItems] = useState<Notif[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const off = game.events.on('notify', ({ text, kind }) => {
      const id = ++idRef.current;
      setItems((s) => [...s.slice(-4), { id, text, kind }]); // 5 max à l'écran
      window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4500);
    });
    return off;
  }, [game]);

  return (
    <div className="notifs">
      {items.map((i) => (
        <div key={i.id} className={`notif ${i.kind}`}>
          {i.text}
        </div>
      ))}
    </div>
  );
}
