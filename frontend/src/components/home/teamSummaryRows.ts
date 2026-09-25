/**
 * Team Summary — pure row/total derivation
 *
 * Re-expresses the row builder and totals from the V1
 * `TeamSummaryEnhanced.tsx` as data-only helpers so a V2 card (and a V1
 * parity test) can consume the same numbers without depending on React.
 */

import { calculatePlayerCompletion, calculatePlayerBooks, calculatePlayerMaterials, sortPlayersByRole } from '../../utils/calculations';
import { playerHasMainRole, getPrimaryRegistration } from '../../utils/staticCharacterContextService';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, PageBalance, MaterialBalance, StaticCharacterRegistration } from '../../types';

export type BookKey = 'I' | 'II' | 'III' | 'IV';
export type MaterialKey = 'twine' | 'glaze' | 'solvent';
export type SummaryRoleLabel = 'main' | 'alt' | 'substitute';

export interface TeamSummaryRow {
  player: SnapshotPlayer;
  gearPercent: number;
  booksBalance: Record<BookKey, number>;
  booksNeeded: Record<BookKey, number>;
  matsReceived: Record<MaterialKey, number>;
  matsNeeded: Record<MaterialKey, number>;
}

export interface TeamSummaryTotals {
  playerCount: number;
  gearPercent: number;
  booksBalance: Record<BookKey, number>;
  booksNeeded: Record<BookKey, number>;
  matsReceived: Record<MaterialKey, number>;
  matsNeeded: Record<MaterialKey, number>;
  booksHave: number;
  booksNeed: number;
  matsHave: number;
  matsNeed: number;
}

const BOOK_KEYS: BookKey[] = ['I', 'II', 'III', 'IV'];
const MATERIAL_KEYS: MaterialKey[] = ['twine', 'glaze', 'solvent'];

// Maps a BookKey to the PageBalance field and calculatePlayerBooks() field
// that feed it. Looping over this (rather than one line per key) is what
// keeps this file from cloning TeamSummaryEnhanced's row builder.
const BOOK_FIELD_MAP: Record<BookKey, { balance: keyof PageBalance; needed: 'floor1' | 'floor2' | 'floor3' | 'floor4' }> = {
  I: { balance: 'bookI', needed: 'floor1' },
  II: { balance: 'bookII', needed: 'floor2' },
  III: { balance: 'bookIII', needed: 'floor3' },
  IV: { balance: 'bookIV', needed: 'floor4' },
};

function zeroBooks(): Record<BookKey, number> {
  const zeros = {} as Record<BookKey, number>;
  BOOK_KEYS.forEach((key) => { zeros[key] = 0; });
  return zeros;
}

function zeroMaterials(): Record<MaterialKey, number> {
  const zeros = {} as Record<MaterialKey, number>;
  MATERIAL_KEYS.forEach((key) => { zeros[key] = 0; });
  return zeros;
}

/**
 * Build one row per configured, non-substitute player (R-D13-F), ordered
 * with the static's standard display order.
 */
export function buildTeamSummaryRows(
  players: SnapshotPlayer[],
  pageBalances: PageBalance[],
  materialBalances: MaterialBalance[],
): TeamSummaryRow[] {
  const pageBalanceByPlayer = new Map(pageBalances.map((b) => [b.playerId, b]));
  const materialBalanceByPlayer = new Map(materialBalances.map((b) => [b.playerId, b]));

  const eligible = players.filter((p) => p.configured && !p.isSubstitute);
  const ordered = sortPlayersByRole(eligible, DEFAULT_SETTINGS.displayOrder, 'standard');

  return ordered.map((player) => {
    const booksNeededCalc = calculatePlayerBooks(player.gear);
    const matsNeededCalc = calculatePlayerMaterials(player.gear, player.tomeWeapon);
    const pageBalance = pageBalanceByPlayer.get(player.id);
    const materialBalance = materialBalanceByPlayer.get(player.id);

    const booksBalance = zeroBooks();
    const booksNeeded = zeroBooks();
    BOOK_KEYS.forEach((key) => {
      const { balance, needed } = BOOK_FIELD_MAP[key];
      booksBalance[key] = pageBalance ? (pageBalance[balance] as number) : 0;
      booksNeeded[key] = booksNeededCalc[needed];
    });

    const matsReceived = zeroMaterials();
    const matsNeeded = zeroMaterials();
    MATERIAL_KEYS.forEach((key) => {
      matsReceived[key] = materialBalance ? materialBalance[key] : 0;
      matsNeeded[key] = matsNeededCalc[key];
    });

    return {
      player,
      gearPercent: calculatePlayerCompletion(player.gear, player.job),
      booksBalance,
      booksNeeded,
      matsReceived,
      matsNeeded,
    };
  });
}

/** Keep only rows whose player has a 'main' registration on this static. */
export function filterMainsOnly(
  rows: TeamSummaryRow[],
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): TeamSummaryRow[] {
  return rows.filter((row) => playerHasMainRole(row.player.id, registrationsByPlayer));
}

/** Aggregate a row set into the summary card's totals (all zeros on empty input). */
export function teamSummaryTotals(rows: TeamSummaryRow[]): TeamSummaryTotals {
  const booksBalance = zeroBooks();
  const booksNeeded = zeroBooks();
  const matsReceived = zeroMaterials();
  const matsNeeded = zeroMaterials();
  let gearPercentSum = 0;

  rows.forEach((row) => {
    gearPercentSum += row.gearPercent;
    BOOK_KEYS.forEach((key) => {
      booksBalance[key] += row.booksBalance[key];
      booksNeeded[key] += row.booksNeeded[key];
    });
    MATERIAL_KEYS.forEach((key) => {
      matsReceived[key] += row.matsReceived[key];
      matsNeeded[key] += row.matsNeeded[key];
    });
  });

  const sumValues = (record: Record<string, number>): number =>
    Object.values(record).reduce((sum, value) => sum + value, 0);

  return {
    playerCount: rows.length,
    gearPercent: rows.length > 0 ? Math.round(gearPercentSum / rows.length) : 0,
    booksBalance,
    booksNeeded,
    matsReceived,
    matsNeeded,
    booksHave: sumValues(booksBalance),
    booksNeed: sumValues(booksNeeded),
    matsHave: sumValues(matsReceived),
    matsNeed: sumValues(matsNeeded),
  };
}

/**
 * Label each player by its primary registration's role, when that role is
 * one of main/alt/substitute. Players with no registrations, or whose
 * primary registration's role is something else, get no key.
 */
export function roleLabelsByPlayer(
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): Record<string, SummaryRoleLabel> {
  const labels: Record<string, SummaryRoleLabel> = {};
  for (const [playerId, registrations] of Object.entries(registrationsByPlayer)) {
    if (!registrations?.length) continue;
    const role = getPrimaryRegistration(registrations)?.roleInStatic;
    if (role === 'main' || role === 'alt' || role === 'substitute') {
      labels[playerId] = role;
    }
  }
  return labels;
}
