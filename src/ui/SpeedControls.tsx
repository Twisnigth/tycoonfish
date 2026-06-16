import { useUiStore } from '../store/uiStore';

/** Contrôle de vitesse du jeu : pause / ×1 / ×2 / ×3. */
export function SpeedControls() {
  const speed = useUiStore((s) => s.speed);
  const setSpeed = useUiStore((s) => s.setSpeed);
  const btn = (v: number, label: string, title: string) => (
    <button className={speed === v ? 'active' : ''} title={title} onClick={() => setSpeed(v)}>
      {label}
    </button>
  );
  return (
    <div className="speed-controls">
      {btn(0, '⏸', 'Pause')}
      {btn(1, '▶', '×1')}
      {btn(2, '⏩', '×2')}
      {btn(3, '⏭', '×3')}
    </div>
  );
}
