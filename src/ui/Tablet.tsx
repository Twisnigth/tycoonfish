import { useEffect, useState } from 'react';
import { useGame, useGameVersion } from './GameContext';
import { Zoopedia } from './Zoopedia';
import { useUiStore } from '../store/uiStore';
import { formatMoney } from '../core/numbers';
import { getFish } from '../data/fish';
import { BUILDINGS } from '../data/buildings';
import { EQUIPMENT_LIST } from '../data/equipment';
import { TANK_DECOR_LIST } from '../data/tankDecor';
import { catalogFor, PRODUCTS } from '../data/products';
import { expenseBreakdown } from '../core/ParkEconomy';
import { STAFF_HIRE_COST, STAFF_SALARY } from '../core/Ecosystem';
import { RARITY_LABEL, RARITY_ORDER, Rarity } from '../data/types';
import { BAIT_COST } from '../data/balance';
import { isAlbino, type Fish } from '../core/Fish';
import type { Game } from '../core/Game';
import type { TankState } from '../core/GameState';

type Tab = 'parc' | 'aquariums' | 'inventaire' | 'elevage' | 'boutiques' | 'peche' | 'research' | 'zoo';

const TABS: [Tab, string][] = [
  ['parc', '📊'],
  ['aquariums', '🐟'],
  ['inventaire', '🎒'],
  ['elevage', '🧬'],
  ['boutiques', '🏪'],
  ['peche', '🎣'],
  ['research', '🔬'],
  ['zoo', '📖'],
];

const fishName = (id: string): string => getFish(id)?.name ?? id;

/** Classe de couleur par palier de bien-être (bon / moyen / mauvais). */
const welfareKind = (v: number): string => (v >= 0.66 ? 't-good' : v >= 0.4 ? 't-mid' : 't-bad');
const welfareEmoji = (v: number): string => (v >= 0.66 ? '😊' : v >= 0.4 ? '😐' : '😟');

function groupBySpecies(list: Fish[]): [string, number][] {
  const m = new Map<string, number>();
  for (const f of list) m.set(f.species, (m.get(f.species) ?? 0) + 1);
  return [...m.entries()];
}

function compatible(tank: TankState, sid: string): boolean {
  const sp = getFish(sid);
  if (!sp) return false;
  const r = sp.requirements;
  // Biome + volume sont des contraintes dures ; la température se règle ensuite.
  return tank.biome === r.biome && tank.volume >= r.minVolume;
}

function Bar({ value, kind }: { value: number; kind?: string }) {
  return (
    <div className="bar">
      <div className={`bar-fill ${kind ?? ''}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

/** Interface principale : une tablette à onglets pour piloter tout le parc. */
export function Tablet({ onStartExpedition }: { onStartExpedition: (r: Rarity) => void }) {
  useGameVersion();
  const game = useGame();
  const [tab, setTab] = useState<Tab>('parc');
  const selectedId = useUiStore((s) => s.selectedBuildingId);

  // Sélectionner un objet en 3D bascule sur le bon onglet.
  useEffect(() => {
    if (!selectedId) return;
    const b = game.state.buildings.find((x) => x.id === selectedId);
    if (b?.tank) setTab('aquariums');
    else if (b?.salePrice !== undefined) setTab('boutiques');
    else if (b?.type === 'expedition') setTab('peche');
  }, [selectedId, game]);

  return (
    <div className="tablet">
      <div className="tablet-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} title={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="tablet-body">
        {tab === 'parc' && <ParcTab game={game} />}
        {tab === 'aquariums' && <AquariumsTab game={game} />}
        {tab === 'inventaire' && <InventoryTab game={game} />}
        {tab === 'elevage' && <ElevageTab game={game} />}
        {tab === 'boutiques' && <ShopsTab game={game} />}
        {tab === 'peche' && <FishingTab game={game} onStart={onStartExpedition} />}
        {tab === 'research' && <ResearchTab game={game} />}
        {tab === 'zoo' && <Zoopedia />}
      </div>
    </div>
  );
}

// ---- Onglet Parc ----------------------------------------------------------
function ParcTab({ game }: { game: Game }) {
  const p = game.state.park;
  return (
    <div className="tab-parc">
      <div className="tab-head">
        <h3>Parc — Jour {p.day}</h3>
        <button className="btn btn-sm" onClick={() => game.setParkOpen(!p.isOpen)}>
          {p.isOpen ? '⛔ Fermer' : '✅ Ouvrir'}
        </button>
      </div>
      {p.isOpen && !game.agents.spawnReady && (
        <p className="warn">⚠ Relie un chemin à l'entrée pour accueillir des visiteurs.</p>
      )}

      <div className="stat-grid">
        <Stat label="Niveau" value={String(game.parkLevel())} />
        <Stat label="Attrait" value={String(Math.round(p.appeal))} />
        <Stat label="Visiteurs" value={String(p.guestsInPark)} />
        <Stat label="Satisfaction" value={`${Math.round(p.avgSatisfaction * 100)}%`} />
        <Stat label="Recettes/j" value={formatMoney(p.incomeToday)} good />
        <Stat label="Dépenses/j" value={formatMoney(p.expensesToday)} bad />
      </div>

      <div className="row-between">
        <span>Prix du billet</span>
        <div className="stepper">
          <button onClick={() => game.setTicketPrice(p.ticketPrice - 1)}>−</button>
          <strong>{p.ticketPrice}$</strong>
          <button onClick={() => game.setTicketPrice(p.ticketPrice + 1)}>+</button>
        </div>
      </div>

      <EmployeesPanel game={game} />

      <FinancePanel game={game} />

      <h4>Commentaires des visiteurs</h4>
      {game.thoughts.length === 0 ? (
        <p className="muted">Aucun visiteur pour l'instant.</p>
      ) : (
        <ul className="thoughts">
          {game.thoughts.slice(0, 8).map((t, i) => (
            <li key={i}>“{t}”</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Panel employés (dans l'onglet Parc) ---------------------------------
function EmployeesPanel({ game }: { game: Game }) {
  const emps = game.state.staff.employees;
  const tanks = game.state.buildings.filter((b) => b.tank);
  const money = game.state.money;
  return (
    <div className="employees">
      <h4>Employés</h4>
      <div className="row emp-hire">
        <button className="btn btn-sm" disabled={money.lt(STAFF_HIRE_COST.keeper)} onClick={() => game.hireEmployee('keeper')}>
          🧑‍🔧 Soigneur ({STAFF_HIRE_COST.keeper}$ · {STAFF_SALARY.keeper}$/j)
        </button>
        <button className="btn btn-sm" disabled={money.lt(STAFF_HIRE_COST.janitor)} onClick={() => game.hireEmployee('janitor')}>
          🧹 Agent ({STAFF_HIRE_COST.janitor}$ · {STAFF_SALARY.janitor}$/j)
        </button>
      </div>
      {emps.length === 0 ? (
        <p className="muted">Aucun employé. Les soigneurs entretiennent les bacs, les agents ramassent les déchets.</p>
      ) : (
        <ul className="emp-list">
          {emps.map((e) => (
            <li key={e.id}>
              <span>{e.role === 'janitor' ? '🧹 Agent' : '🧑‍🔧 Soigneur'}</span>
              {e.role === 'keeper' && (
                <select
                  value={e.tankId ?? ''}
                  onChange={(ev) => game.assignKeeper(e.id, ev.target.value || null)}
                  title="Affecter à un bac précis"
                >
                  <option value="">Tous les bacs</option>
                  {tanks.map((b) => (
                    <option key={b.id} value={b.tank!.id}>{BUILDINGS[b.type].name}</option>
                  ))}
                </select>
              )}
              <button className="btn-close" title="Renvoyer" onClick={() => game.fireEmployee(e.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Bilan financier (dans l'onglet Parc) --------------------------------
function FinancePanel({ game }: { game: Game }) {
  const inc = game.state.park.income;
  const exp = expenseBreakdown(game.state);
  const totalInc = inc.tickets + inc.donations + inc.shops;
  const totalExp = exp.buildings + exp.equipment + exp.salaries;
  const r = (n: number) => `${Math.round(n)}$`;
  return (
    <div className="finance">
      <h4>Finances (aujourd'hui)</h4>
      <div className="fin-cols">
        <ul className="fin-list">
          <li><span>🎟️ Billets</span><strong className="good">{r(inc.tickets)}</strong></li>
          <li><span>💝 Dons</span><strong className="good">{r(inc.donations)}</strong></li>
          <li><span>🏪 Boutiques</span><strong className="good">{r(inc.shops)}</strong></li>
          <li className="fin-total"><span>Recettes</span><strong className="good">{r(totalInc)}</strong></li>
        </ul>
        <ul className="fin-list">
          <li><span>🏗️ Entretien</span><strong className="bad">{r(exp.buildings)}</strong></li>
          <li><span>⚙️ Équipement</span><strong className="bad">{r(exp.equipment)}</strong></li>
          <li><span>👷 Salaires</span><strong className="bad">{r(exp.salaries)}</strong></li>
          <li className="fin-total"><span>Dépenses/j</span><strong className="bad">{r(totalExp)}</strong></li>
        </ul>
      </div>
    </div>
  );
}

// ---- Onglet Aquariums (master-détail) ------------------------------------
function AquariumsTab({ game }: { game: Game }) {
  const selectedId = useUiStore((s) => s.selectedBuildingId);
  const select = useUiStore((s) => s.select);
  const tanks = game.state.buildings.filter((b) => b.tank);
  const sel = tanks.find((b) => b.id === selectedId);

  if (tanks.length === 0) return <p className="muted">Aucun bac. Construis-en un (onglet « Bacs » en bas).</p>;

  return (
    <div className="tab-aqua">
      <div className="aqua-list">
        {tanks.map((b) => {
          const t = b.tank!;
          const welfare = game.tankWelfare(t).score;
          const connected = game.isBuildingConnected(b.id);
          return (
            <button
              key={b.id}
              className={`aqua-card ${b.id === selectedId ? 'active' : ''}`}
              onClick={() => select(b.id)}
            >
              <strong>{BUILDINGS[b.type].name}{!connected && <span className="unlinked" title="Pas de chemin reliant ce bac à l'entrée"> ⚠</span>}</strong>
              <small>{t.biome} · {t.waterTemp}°C · {t.fish.length} 🐟</small>
              <div className="mini-bars">
                <span title="Bien-être">{welfareEmoji(welfare)}<Bar value={welfare} kind={welfareKind(welfare)} /></span>
                <span title="Qualité d'eau">💧<Bar value={t.water.quality} kind="water" /></span>
              </div>
            </button>
          );
        })}
      </div>

      {sel?.tank && <TankDetail game={game} buildingId={sel.id} tank={sel.tank} />}
    </div>
  );
}

function TankDetail({ game, buildingId, tank }: { game: Game; buildingId: string; tank: TankState }) {
  const inv = groupBySpecies(game.state.caughtInventory);
  const welfare = game.tankWelfare(tank);
  return (
    <div className="aqua-detail">
      <h4>{BUILDINGS[game.state.buildings.find((b) => b.id === buildingId)!.type].name} — {tank.biome}</h4>

      <div className="welfare-head">
        <span>{welfareEmoji(welfare.score)} Bien-être</span>
        <strong className={welfareKind(welfare.score)}>{Math.round(welfare.score * 100)}%</strong>
      </div>
      <Bar value={welfare.score} kind={welfareKind(welfare.score)} />
      <ul className="welfare-factors">
        {welfare.factors.map((f) => (
          <li key={f.key} className={f.score < 0.5 ? 'low' : ''}>
            <span className="wf-label">{f.icon} {f.label}</span>
            <Bar value={f.score} kind={welfareKind(f.score)} />
            <span className="wf-detail">{f.detail}</span>
          </li>
        ))}
      </ul>

      <div className="row-between">
        <span>🌡️ Température</span>
        <div className="stepper">
          <button onClick={() => game.setTankTemp(buildingId, tank.waterTemp - 1)}>−</button>
          <strong>{tank.waterTemp}°C</strong>
          <button onClick={() => game.setTankTemp(buildingId, tank.waterTemp + 1)}>+</button>
        </div>
      </div>
      <div className="row-between">
        <span>⚗️ pH</span>
        <div className="stepper">
          <button onClick={() => game.setTankPh(buildingId, tank.ph - 0.1)}>−</button>
          <strong>{tank.ph.toFixed(1)}</strong>
          <button onClick={() => game.setTankPh(buildingId, tank.ph + 0.1)}>+</button>
        </div>
      </div>
      <div className="row-between">
        <span>🧂 Salinité</span>
        <div className="stepper">
          <button onClick={() => game.setTankSalinity(buildingId, tank.salinity - 1)}>−</button>
          <strong>{tank.salinity} ppt</strong>
          <button onClick={() => game.setTankSalinity(buildingId, tank.salinity + 1)}>+</button>
        </div>
      </div>

      <div className="detail-bars">
        <label>💧 Qualité d'eau<Bar value={tank.water.quality} kind="water" /></label>
        <label>🍤 Nourriture<Bar value={tank.water.foodStock} kind="food" /></label>
        <label>🌿 Enrichissement<Bar value={tank.enrichment} kind="health" /></label>
      </div>
      <div className="row">
        <button className="btn btn-sm" onClick={() => game.feedTank(buildingId)}>Nourrir</button>
        <button className="btn btn-sm" onClick={() => game.cleanTank(buildingId)}>Nettoyer</button>
        <button className="btn btn-sm" disabled={game.state.money.lt(game.enrichCost)} onClick={() => game.enrichTank(buildingId)}>
          🌿 Enrichir ({game.enrichCost}$)
        </button>
      </div>

      <h4>Équipements</h4>
      <ul className="equip-list">
        {EQUIPMENT_LIST.map((eq) => {
          const installed = tank.equipment.includes(eq.id);
          const locked = !game.equipmentUnlocked(eq.id);
          return (
            <li key={eq.id} className={installed ? 'installed' : ''}>
              <span className="equip-info" title={eq.desc}>
                {eq.icon} {eq.name} <em className="muted">({eq.maintenance}$/j)</em>
              </span>
              {installed ? (
                <button className="btn btn-sm" onClick={() => game.removeEquipment(buildingId, eq.id)}>Retirer</button>
              ) : locked ? (
                <button className="btn btn-sm" disabled title="À débloquer dans l'onglet Recherche">
                  🔬 À rechercher
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  disabled={game.state.money.lt(eq.cost)}
                  onClick={() => game.installEquipment(buildingId, eq.id)}
                >
                  {eq.cost}$
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="row-between">
        <h4>Décor ({tank.decor.length}/{game.maxTankDecor})</h4>
        {tank.decor.length > 0 && (
          <button className="btn btn-sm" onClick={() => game.removeTankDecor(buildingId)}>Retirer</button>
        )}
      </div>
      <div className="decor-grid">
        {TANK_DECOR_LIST.map((d) => (
          <button
            key={d.id}
            className="decor-btn"
            disabled={tank.decor.length >= game.maxTankDecor || game.state.money.lt(d.cost)}
            title={`${d.name} — +${Math.round(d.enrich * 100)}% enrichissement`}
            onClick={() => game.addTankDecor(buildingId, d.id)}
          >
            {d.icon} {d.name}<small>{d.cost}$</small>
          </button>
        ))}
      </div>

      <h4>Poissons ({tank.fish.length})</h4>
      {tank.fish.length === 0 ? (
        <p className="muted">Bac vide — affecte des poissons depuis l'inventaire.</p>
      ) : (
        <ul className="fish-list">
          {tank.fish.map((f) => (
            <li key={f.id}>
              <span>{fishName(f.species)}</span>
              <span className="fish-vitals">
                <em title="Santé">❤</em><Bar value={f.vitals.health} kind="health" />
                <em title="Faim">🍴</em><Bar value={1 - f.vitals.hunger} kind="food" />
                <em title="Stress">😰</em><Bar value={f.vitals.stress} kind="t-bad" />
                <button className="fish-remove" title="Retirer vers l'inventaire" onClick={() => game.removeFishFromTank(buildingId, f.id)}>↩</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h4>Affecter depuis l'inventaire</h4>
      {inv.length === 0 ? (
        <p className="muted">Inventaire vide — lance une expédition (onglet Pêche).</p>
      ) : (
        <ul className="insp-list">
          {inv.map(([sid, n]) => {
            const ok = compatible(tank, sid);
            return (
              <li key={sid} className="insp-assign">
                <span>{fishName(sid)} ×{n}</span>
                <button
                  className="btn btn-sm"
                  disabled={!ok}
                  title={ok ? '' : 'Biome ou volume incompatible'}
                  onClick={() => game.assignFish(buildingId, sid)}
                >
                  Placer →
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---- Onglet Inventaire ----------------------------------------------------
function InventoryTab({ game }: { game: Game }) {
  const inv = groupBySpecies(game.state.caughtInventory);
  if (inv.length === 0) return <p className="muted">Inventaire vide. Pêche des poissons puis affecte-les à un bac.</p>;
  return (
    <div className="tab-inv">
      <p className="muted">{game.state.caughtInventory.length} poisson(s) en attente. Place-les dans un bac (Aquariums) ou vends le surplus 💰.</p>
      <ul className="inv-grid">
        {inv.map(([sid, n]) => {
          const sp = getFish(sid);
          return (
            <li key={sid} className="inv-card">
              <strong>{fishName(sid)}</strong>
              <small>{sp ? RARITY_LABEL[sp.rarity] : ''} · {sp?.requirements.biome}</small>
              <span className="inv-count">×{n}</span>
              <button className="btn btn-sm" onClick={() => game.sellFish(sid)} title="Vendre ce poisson">💰 Vendre</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Onglet Élevage (Nursery) --------------------------------------------
function ElevageTab({ game }: { game: Game }) {
  const breedable = game.breedableSpecies();
  return (
    <div className="tab-elevage">
      <h3>Élevage — Nursery</h3>
      {!game.hasNursery && <p className="warn">Construis une Nursery (onglet Bacs/Infra) pour reproduire des poissons.</p>}
      <p className="muted">
        Reproduis 2 poissons identiques pour un descendant aux gènes hérités. ⚠ Croiser la même
        lignée (consanguinité) réduit l'immunité et peut rendre stérile.
      </p>
      <p className="muted">
        🥚 La reproduction lance une <strong>incubation</strong> : l'œuf met du temps à éclore
        (plus l'espèce est rare, plus c'est long) et a une chance de donner des <strong>gènes supérieurs</strong>.
      </p>
      {breedable.length === 0 ? (
        <p className="muted">Il te faut au moins 2 poissons fertiles de la même espèce (inventaire ou bacs).</p>
      ) : (
        <ul className="insp-list">
          {breedable.map((sid) => (
            <li key={sid} className="insp-assign">
              <span>{fishName(sid)}</span>
              <button className="btn btn-sm" disabled={!game.hasNursery} onClick={() => game.breed(sid)}>
                🥚 Reproduire
              </button>
            </li>
          ))}
        </ul>
      )}

      {game.state.eggs.length > 0 && (
        <>
          <h4>Incubation ({game.state.eggs.length})</h4>
          <ul className="egg-list">
            {game.state.eggs.map((e) => {
              const prog = 1 - e.remainingMs / e.totalMs;
              return (
                <li key={e.id}>
                  <span className="egg-name">🥚 {fishName(e.species)}{e.boosted && <em title="Gènes supérieurs"> ★</em>}</span>
                  <Bar value={prog} kind="t-good" />
                  <span className="egg-time">{Math.ceil(e.remainingMs / 1000)}s</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <GeneticsPanel game={game} />
    </div>
  );
}

/** Qualité génétique (0..1) = moyenne taille/longévité/immunité normalisées. */
function geneQuality(g: Fish['genes']): number {
  const s = (g.size - 0.5) / 1.4;
  const l = (g.longevity - 0.5) / 1.2;
  const im = (g.immunity - 0.25) / 1.35;
  return Math.max(0, Math.min(1, (s + l + im) / 3));
}

// ---- Panneau génétique (dans l'onglet Élevage) ---------------------------
function GeneticsPanel({ game }: { game: Game }) {
  const owned: { f: Fish; loc: string }[] = [];
  for (const f of game.state.caughtInventory) owned.push({ f, loc: 'Inventaire' });
  for (const b of game.state.buildings) if (b.tank) for (const f of b.tank.fish) owned.push({ f, loc: BUILDINGS[b.type].name });
  if (owned.length === 0) return null;
  owned.sort((a, b) => geneQuality(b.f.genes) - geneQuality(a.f.genes));

  return (
    <>
      <h4>Génétique — vos spécimens ({owned.length})</h4>
      <p className="muted">Trié du meilleur patrimoine génétique au moins bon. ★ = qualité globale.</p>
      <ul className="genes-list">
        {owned.slice(0, 40).map(({ f, loc }) => {
          const g = f.genes;
          const stars = Math.max(1, Math.round(geneQuality(g) * 5));
          return (
            <li key={f.id}>
              <div className="gene-head">
                <strong>{fishName(f.species)}</strong>
                <span className="stars" title="Qualité génétique">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
              </div>
              <div className="gene-bars">
                <span title="Taille">📏<Bar value={(g.size - 0.5) / 1.4} kind="t-good" /></span>
                <span title="Longévité">⏳<Bar value={(g.longevity - 0.5) / 1.2} kind="t-good" /></span>
                <span title="Immunité">🛡️<Bar value={(g.immunity - 0.25) / 1.35} kind="t-good" /></span>
              </div>
              <div className="gene-meta">
                {loc} · lignée #{f.family % 1000}
                {isAlbino(g) && ' · 🤍 albinos'}
                {f.origin === 'bred' ? ' · élevé' : ' · pêché'}
                {!f.fertile && ' · stérile'}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---- Onglet Boutiques -----------------------------------------------------
function ShopsTab({ game }: { game: Game }) {
  const shops = game.state.buildings.filter((b) => !b.tank && b.salePrice !== undefined);
  if (shops.length === 0) return <p className="muted">Aucune boutique. Construis un stand snack ou une boutique souvenirs.</p>;
  return (
    <div className="tab-shops">
      <p className="muted">Choisis les produits proposés par chaque boutique. Les visiteurs en achètent un au hasard.</p>
      {shops.map((b) => {
        const enabled = new Set(b.products ?? []);
        return (
          <div key={b.id} className="shop-card">
            <strong>{BUILDINGS[b.type].name}</strong>
            <div className="product-grid">
              {catalogFor(b.type).map((pid) => {
                const p = PRODUCTS[pid];
                const on = enabled.has(pid);
                return (
                  <button
                    key={pid}
                    className={`product-btn ${on ? 'on' : ''}`}
                    onClick={() => game.toggleProduct(b.id, pid)}
                    title={on ? 'Retirer du rayon' : 'Ajouter au rayon'}
                  >
                    {p.icon} {p.name} <small>{p.price}$</small>
                  </button>
                );
              })}
            </div>
            {enabled.size === 0 && <p className="warn">Aucun produit en vente — n'attire aucun achat.</p>}
          </div>
        );
      })}
    </div>
  );
}

// ---- Onglet Pêche (gating clair, plus d'erreur trompeuse) -----------------
function FishingTab({ game, onStart }: { game: Game; onStart: (r: Rarity) => void }) {
  if (!game.hasExpedition) {
    return (
      <div className="tab-peche">
        <p className="warn">🚢 Construis un <strong>Quai d'Expédition</strong> (onglet Infrastructures) pour partir pêcher.</p>
      </div>
    );
  }
  return (
    <div className="tab-peche">
      <div className="row-between">
        <span>Appâts : <strong>{game.state.bait}</strong></span>
        <button className="btn btn-sm" onClick={() => game.buyBait(10)}>+10 appâts ({formatMoney(80)})</button>
      </div>
      <p className="muted">Les raretés supérieures se débloquent dans l'onglet Recherche 🔬.</p>
      <div className="peche-grid">
        {RARITY_ORDER.map((r) => {
          const unlocked = game.rarityUnlocked(r);
          const cost = BAIT_COST[r];
          const enoughBait = game.state.bait >= cost;
          const catchable = game.catchableSpecies(r).length > 0;
          const reason = !unlocked
            ? '🔬 À rechercher'
            : !enoughBait
              ? `Manque d'appâts (${cost})`
              : !catchable
                ? 'Aucune espèce'
                : `🪱 ${cost} appâts`;
          const disabled = !unlocked || !enoughBait || !catchable;
          return (
            <button
              key={r}
              className={`peche-card ${unlocked ? '' : 'locked'}`}
              disabled={disabled}
              onClick={() => onStart(r)}
            >
              <span className="exp-rarity">{RARITY_LABEL[r]}</span>
              <span className="exp-cost">{reason}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Onglet Recherche (payer + temps + prérequis) -------------------------
function ResearchTab({ game }: { game: Game }) {
  const labs = game.labCount;
  const active = game.state.activeResearch;
  const all = game.researchUnlocks();
  const activeItem = active ? all.find((u) => u.id === active.id) : null;
  const rarities = all.filter((u) => u.category === 'rarity');
  const equip = all.filter((u) => u.category === 'equipment');

  const row = (u: { id: string; label: string; cost: number; durationMs: number; requires?: string }) => {
    const done = game.researchUnlocked(u.id);
    const isActive = active?.id === u.id;
    const available = game.researchAvailable(u.id);
    const enough = game.state.money.gte(u.cost);
    return (
      <li key={u.id} className={done ? 'done' : ''}>
        <span className="rsh-info">
          {done ? '✅' : isActive ? '⏳' : available ? '🔬' : '🔒'} {u.label}
          <em className="muted"> ({Math.round(u.durationMs / 60000)} min)</em>
        </span>
        {done ? null : isActive ? (
          <strong className="t-mid">{Math.round(game.researchProgress() * 100)}%</strong>
        ) : (
          <button
            className="btn btn-sm"
            disabled={!available || !enough}
            title={!available ? 'Recherche précédente ou Labo requis / une recherche est déjà en cours' : ''}
            onClick={() => game.startResearch(u.id)}
          >
            {formatMoney(u.cost)}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="tab-research">
      <h3>Recherche 🔬</h3>
      {labs === 0 ? (
        <p className="warn">Construis un <strong>Laboratoire</strong> (onglet Infrastructures) pour pouvoir lancer des recherches.</p>
      ) : (
        <p className="muted">{labs} laboratoire(s){labs > 1 ? ` · recherche ×${labs} plus rapide` : ''}. On paie pour lancer, puis ça prend du temps.</p>
      )}
      {activeItem && (
        <div className="rsh-active">
          <div className="welfare-head"><span>⏳ {activeItem.label}</span><strong className="t-mid">{Math.round(game.researchProgress() * 100)}%</strong></div>
          <Bar value={game.researchProgress()} kind="t-mid" />
        </div>
      )}
      <h4>Raretés de poissons</h4>
      <ul className="research-list">{rarities.map(row)}</ul>
      <h4>Équipements d'aquarium</h4>
      <ul className="research-list">{equip.map(row)}</ul>
    </div>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={good ? 'good' : bad ? 'bad' : ''}>{value}</strong>
    </div>
  );
}
