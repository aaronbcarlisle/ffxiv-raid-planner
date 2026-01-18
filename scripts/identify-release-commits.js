#!/usr/bin/env node
/**
 * Identify Release Commits Helper
 *
 * Lists commits between version tags to help populate the `commits` field
 * in releaseNotes.ts for releases that are missing commit information.
 *
 * Usage:
 *   node scripts/identify-release-commits.js --version 1.0.11
 *   node scripts/identify-release-commits.js --all
 *   node scripts/identify-release-commits.js --version 1.0.11 --json
 *
 * Options:
 *   --version <ver>  Show commits for a specific version
 *   --all            Show commits for all versions
 *   --json           Output in JSON format for programmatic use
 *   --limit <n>      Limit commits per version (default: 20)
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RELEASE_NOTES_PATH = join(__dirname, '../frontend/src/data/releaseNotes.ts');
const GITHUB_REPO = 'aaronbcarlisle/ffxiv-raid-planner-dev';

// Conventional commit type mapping for suggested categorization
const COMMIT_TYPE_CATEGORIES = {
  feat: 'feature',
  feature: 'feature',
  fix: 'fix',
  bugfix: 'fix',
  improvement: 'improvement',
  improve: 'improvement',
  perf: 'improvement',
  refactor: 'improvement',
  style: 'improvement',
  docs: 'improvement',
  test: 'improvement',
  chore: 'improvement',
  build: 'improvement',
  ci: 'improvement',
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    all: false,
    json: false,
    limit: 20,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' && args[i + 1]) {
      options.version = args[++i];
    } else if (arg.startsWith('--version=')) {
      options.version = arg.split('=')[1];
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

/**
 * Get all git tags sorted by version
 */
function getGitTags() {
  try {
    const output = execSync('git tag -l "v*" --sort=-v:refname', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get commits between two tags (or from tag to HEAD if no second tag)
 */
function getCommitsBetween(fromTag, toTag, limit) {
  const range = toTag ? `${fromTag}..${toTag}` : `${fromTag}..HEAD`;
  try {
    const format = '%H|%h|%s|%ad';
    const output = execSync(
      `git log ${range} --pretty=format:"${format}" --date=short -n ${limit}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [fullHash, shortHash, subject, date] = line.split('|');
      return { fullHash, shortHash, subject, date };
    });
  } catch {
    return [];
  }
}

/**
 * Parse conventional commit type from subject
 */
function parseCommitType(subject) {
  const match = subject.match(/^(\w+)(?:\([^)]*\))?:/);
  if (match) {
    const type = match[1].toLowerCase();
    return {
      type,
      category: COMMIT_TYPE_CATEGORIES[type] || 'improvement',
    };
  }
  return { type: null, category: 'improvement' };
}

/**
 * Get releases from releaseNotes.ts
 */
function getReleases() {
  try {
    const content = readFileSync(RELEASE_NOTES_PATH, 'utf-8');

    // Extract version and date from each release
    const releases = [];
    const releasePattern = /\{\s*version:\s*['"]([^'"]+)['"],\s*date:\s*['"]([^'"]+)['"]/g;

    let match;
    while ((match = releasePattern.exec(content)) !== null) {
      releases.push({
        version: match[1],
        date: match[2],
      });
    }

    return releases;
  } catch {
    return [];
  }
}

/**
 * Find tag for a version
 */
function findTagForVersion(version, tags) {
  // Try common tag formats
  const candidates = [`v${version}`, version];
  for (const candidate of candidates) {
    if (tags.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Get commits for a specific version
 */
function getVersionCommits(version, tags, releases, limit) {
  const currentTag = findTagForVersion(version, tags);
  const currentReleaseIndex = releases.findIndex(r => r.version === version);

  // Find the previous version's tag
  let previousTag = null;
  if (currentReleaseIndex >= 0 && currentReleaseIndex < releases.length - 1) {
    const previousVersion = releases[currentReleaseIndex + 1].version;
    previousTag = findTagForVersion(previousVersion, tags);
  }

  // If we have a current tag, get commits from previous tag to current tag
  // If no current tag, get commits from previous tag to HEAD (for unreleased)
  if (currentTag && previousTag) {
    return getCommitsBetween(previousTag, currentTag, limit);
  } else if (previousTag) {
    return getCommitsBetween(previousTag, null, limit);
  } else if (currentTag) {
    // First release - get all commits up to this tag
    try {
      const format = '%H|%h|%s|%ad';
      const output = execSync(
        `git log ${currentTag} --pretty=format:"${format}" --date=short -n ${limit}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();

      if (!output) return [];

      return output.split('\n').map(line => {
        const [fullHash, shortHash, subject, date] = line.split('|');
        return { fullHash, shortHash, subject, date };
      });
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Format commits for display
 */
function formatCommitsDisplay(version, date, commits) {
  const lines = [];
  lines.push('');
  lines.push(`v${version} (${date})`);
  lines.push('═'.repeat(55));
  lines.push('');

  if (commits.length === 0) {
    lines.push('  No commits found (tag may not exist)');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('Commits:');
  lines.push('');

  // Group commits by type
  const byType = {
    feat: [],
    fix: [],
    other: [],
  };

  for (const commit of commits) {
    const { type } = parseCommitType(commit.subject);
    if (type === 'feat' || type === 'feature') {
      byType.feat.push(commit);
    } else if (type === 'fix' || type === 'bugfix') {
      byType.fix.push(commit);
    } else {
      byType.other.push(commit);
    }
  }

  for (const commit of commits) {
    lines.push(`  ${commit.shortHash}  ${commit.subject}`);
  }

  lines.push('');
  lines.push('─'.repeat(55));
  lines.push('Suggested mapping (by conventional commit type):');
  lines.push('  feat/feature → feature items');
  lines.push('  fix/bugfix   → fix items');
  lines.push('  others       → improvement items');
  lines.push('');
  lines.push('Summary:');
  lines.push(`  Features: ${byType.feat.length}`);
  lines.push(`  Fixes:    ${byType.fix.length}`);
  lines.push(`  Other:    ${byType.other.length}`);
  lines.push('');
  lines.push('═'.repeat(55));

  return lines.join('\n');
}

/**
 * Format commits as JSON
 */
function formatCommitsJson(version, date, commits) {
  return {
    version,
    date,
    commits: commits.map(c => ({
      hash: c.shortHash,
      fullHash: c.fullHash,
      message: c.subject,
      date: c.date,
      ...parseCommitType(c.subject),
    })),
  };
}

/**
 * Main function
 */
function main() {
  const options = parseArgs();

  if (!options.version && !options.all) {
    console.log('Usage:');
    console.log('  node scripts/identify-release-commits.js --version 1.0.11');
    console.log('  node scripts/identify-release-commits.js --all');
    console.log('  node scripts/identify-release-commits.js --version 1.0.11 --json');
    console.log('');
    console.log('Options:');
    console.log('  --version <ver>  Show commits for a specific version');
    console.log('  --all            Show commits for all versions');
    console.log('  --json           Output in JSON format');
    console.log('  --limit <n>      Limit commits per version (default: 20)');
    process.exit(1);
  }

  const tags = getGitTags();
  const releases = getReleases();

  if (releases.length === 0) {
    console.error('Could not parse releases from releaseNotes.ts');
    process.exit(1);
  }

  if (options.version) {
    // Single version
    const release = releases.find(r => r.version === options.version);
    if (!release) {
      console.error(`Version ${options.version} not found in releaseNotes.ts`);
      console.error('Available versions:', releases.map(r => r.version).join(', '));
      process.exit(1);
    }

    const commits = getVersionCommits(release.version, tags, releases, options.limit);

    if (options.json) {
      console.log(JSON.stringify(formatCommitsJson(release.version, release.date, commits), null, 2));
    } else {
      console.log(formatCommitsDisplay(release.version, release.date, commits));
    }
  } else if (options.all) {
    // All versions
    const results = [];

    for (const release of releases) {
      const commits = getVersionCommits(release.version, tags, releases, options.limit);

      if (options.json) {
        results.push(formatCommitsJson(release.version, release.date, commits));
      } else {
        console.log(formatCommitsDisplay(release.version, release.date, commits));
      }
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
  }
}

main();
