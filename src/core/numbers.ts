import Decimal from 'break_infinity.js';
import type { DecimalSource } from 'break_infinity.js';

export { Decimal };
export type { DecimalSource };

/** Raccourci de construction. `D(10)`, `D('1e42')`, `D(other)`. */
export const D = (v: DecimalSource): Decimal =>
  v instanceof Decimal ? v : new Decimal(v);

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);

/**
 * Suffixes courts pour la notation lisible. Au-delà, on bascule en
 * notation scientifique (`1.23e45`) — indispensable pour l'économie
 * exponentielle longue durée.
 */
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
];

/** Formate un grand nombre de façon compacte : 1.23K, 4.56M, 7.89e42. */
export function formatNumber(value: DecimalSource, decimals = 2): string {
  const d = D(value);

  if (d.lt(0)) return '-' + formatNumber(d.neg(), decimals);
  if (d.lt(1000)) {
    const n = d.toNumber();
    return Number.isInteger(n) ? n.toString() : trimZeros(n.toFixed(decimals));
  }

  const tier = Math.floor(d.exponent / 3);
  if (tier < SUFFIXES.length) {
    const scaled = d.div(D(10).pow(tier * 3)).toNumber();
    return trimZeros(scaled.toFixed(decimals)) + SUFFIXES[tier];
  }

  // Au-delà des suffixes connus : notation scientifique normalisée.
  return `${trimZeros(d.mantissa.toFixed(decimals))}e${d.exponent}`;
}

/** Montant monétaire : `$1.23M`. */
export function formatMoney(value: DecimalSource, decimals = 2): string {
  return '$' + formatNumber(value, decimals);
}

/** Enlève les zéros décimaux superflus : "1.20" -> "1.2", "3.00" -> "3". */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
