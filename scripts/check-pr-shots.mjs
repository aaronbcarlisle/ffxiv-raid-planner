#!/usr/bin/env node
/**
 * Screenshot size budget for `docs/redesign/pr-shots/`.
 *
 * Why this exists: PR screenshots are embedded at `width="900"`, but they were
 * being committed straight from the capture tool at 1680px. That is ~3.5x the
 * pixels that ever render, and git keeps every blob forever — by the time this
 * was noticed, `docs/redesign/pr-shots/` was 52.8 MB across 179 files, roughly
 * half the repository's history.
 *
 * The old convention ("shots are netted out before merge") was meant to prevent
 * that, but three of four slices shipped without doing it. A rule that is
 * skipped 75% of the time is not a rule, so the convention is retired: shots now
 * STAY in the repo as durable evidence for merged PR bodies, and this check
 * keeps them cheap instead. At 900px WebP the same 160 shots have a median size
 * of 14.7 KB and a worst case of 50.8 KB, so the 120 KB budget below is a ~2.4x
 * margin over the worst real shot while still rejecting every full-size PNG.
 *
 * Only files ADDED or MODIFIED by the current PR are checked. The 169 oversized
 * files already in history are deliberately grandfathered: deleting them would
 * reclaim nothing (their blobs are permanent) and a 169-entry allowlist would be
 * worse than the problem.
 *
 * Usage:
 *   node scripts/check-pr-shots.mjs <file>...   # check the given paths
 *   node scripts/check-pr-shots.mjs             # check every shot on disk
 *
 * To fix a violation: `python scripts/shrink-pr-shots.py <file>...`
 */
import { statSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, posix } from 'node:path';

/** 120 KB. See the header for how this number was chosen. */
export const MAX_BYTES = 120 * 1024;
export const SHOTS_DIR = 'docs/redesign/pr-shots';
export const EXCEPTIONS_FILE = `${SHOTS_DIR}/.size-exceptions`;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;

/** True for image paths under the pr-shots directory, on either path separator. */
export function isShot(path) {
  const normalized = String(path).replace(/\\/g, '/');
  return normalized.startsWith(`${SHOTS_DIR}/`) && IMAGE_EXT.test(normalized);
}

/**
 * Parse the escape-hatch file: one filename per line, `#` comments and blanks
 * ignored. Entries are bare filenames, not paths, so a shot keeps its exemption
 * regardless of how the path was spelled on the command line.
 */
export function parseExceptions(text) {
  return new Set(
    String(text)
      .split('\n')
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((line) => basename(line)),
  );
}

/**
 * Pure core: given `{ path, bytes }` entries, return the offenders, largest
 * first. Split out from the filesystem so it can be tested without fixtures.
 */
export function findOversized(entries, { maxBytes = MAX_BYTES, exceptions = new Set() } = {}) {
  return entries
    .filter((entry) => !exceptions.has(basename(entry.path)))
    .filter((entry) => entry.bytes > maxBytes)
    .sort((a, b) => b.bytes - a.bytes);
}

export function formatReport(offenders, maxBytes = MAX_BYTES) {
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  const lines = [
    `✗ ${offenders.length} screenshot${offenders.length === 1 ? '' : 's'} over the ${kb(maxBytes)} budget:`,
    '',
    ...offenders.map((o) => `    ${kb(o.bytes).padStart(7)}  ${o.path}`),
    '',
    'PR screenshots render at width="900" — a full-size capture stores several',
    'times the pixels that are ever displayed, and git keeps the blob forever.',
    '',
    'Fix:  python scripts/shrink-pr-shots.py ' + offenders.map((o) => o.path).join(' '),
    '',
    `If a shot genuinely needs the detail, add its filename to ${EXCEPTIONS_FILE}`,
    'with a comment saying why.',
  ];
  return lines.join('\n');
}

function listAllShots() {
  if (!existsSync(SHOTS_DIR)) return [];
  return readdirSync(SHOTS_DIR)
    .map((name) => posix.join(SHOTS_DIR, name))
    .filter(isShot);
}

function main(argv) {
  const candidates = argv.length > 0 ? argv.filter(isShot) : listAllShots();

  // Deleted/renamed-away paths can appear in a PR file list; they are not a
  // budget problem, so skip anything not on disk.
  const entries = candidates
    .filter((path) => existsSync(path))
    .map((path) => ({ path: path.replace(/\\/g, '/'), bytes: statSync(path).size }));

  if (entries.length === 0) {
    console.log('✓ Screenshot budget: no pr-shots added or modified.');
    return 0;
  }

  const exceptions = existsSync(EXCEPTIONS_FILE)
    ? parseExceptions(readFileSync(EXCEPTIONS_FILE, 'utf8'))
    : new Set();

  const offenders = findOversized(entries, { exceptions });
  if (offenders.length === 0) {
    console.log(`✓ Screenshot budget: ${entries.length} file(s) checked, all within ${MAX_BYTES / 1024} KB.`);
    return 0;
  }

  console.error(formatReport(offenders));
  return 1;
}

// Only run as a CLI, so the test file can import the pure helpers.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-pr-shots.mjs')) {
  process.exit(main(process.argv.slice(2)));
}
