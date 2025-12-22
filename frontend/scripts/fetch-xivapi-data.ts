/**
 * Fetches game data from XIVAPI and saves it as bundled JSON.
 * Run with: npx tsx scripts/fetch-xivapi-data.ts
 *
 * This should be run:
 * - When a new expansion adds jobs
 * - Periodically to update item data
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const XIVAPI_V1_BASE = 'https://xivapi.com';
const XIVAPI_V2_BASE = 'https://v2.xivapi.com/api';

interface XIVAPIv1Job {
  ID: number;
  Abbreviation: string;
  Name: string;
  Role: number;
  Icon: string;
  IsLimitedJob: number;
}

interface Job {
  id: number;
  abbreviation: string;
  name: string;
  role: 'tank' | 'healer' | 'melee' | 'ranged' | 'caster' | 'crafter' | 'gatherer';
  icon: string;
  isCombat: boolean;
  isLimited: boolean;
}

// XIVAPI Role mapping:
// 0 = Non-combat (crafters/gatherers)
// 1 = Tank
// 2 = Melee DPS
// 3 = Ranged DPS (both physical and magical)
// 4 = Healer

// Physical ranged jobs - need manual distinction since XIVAPI groups them with casters
const PHYSICAL_RANGED_JOBS = ['BRD', 'MCH', 'DNC'];

function mapRole(apiRole: number, abbreviation: string): Job['role'] {
  switch (apiRole) {
    case 0:
      // Distinguish crafters from gatherers
      if (['MIN', 'BTN', 'FSH'].includes(abbreviation)) {
        return 'gatherer';
      }
      return 'crafter';
    case 1:
      return 'tank';
    case 2:
      return 'melee';
    case 3:
      // Distinguish physical ranged from casters
      if (PHYSICAL_RANGED_JOBS.includes(abbreviation)) {
        return 'ranged';
      }
      return 'caster';
    case 4:
      return 'healer';
    default:
      return 'crafter';
  }
}

async function fetchJobs(): Promise<Job[]> {
  console.log('Fetching jobs from XIVAPI v1 (includes icons)...');

  // Use v1 API to get icons
  const response = await fetch(
    `${XIVAPI_V1_BASE}/ClassJob?columns=ID,Abbreviation,Name,Role,Icon,IsLimitedJob`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results: XIVAPIv1Job[] = data.Results;

  const jobs: Job[] = results
    .filter((job) => job.Abbreviation) // Filter out empty entries
    .map((job) => ({
      id: job.ID,
      abbreviation: job.Abbreviation,
      name: job.Name,
      role: mapRole(job.Role, job.Abbreviation),
      icon: job.Icon, // e.g., "/cj/1/paladin.png"
      isCombat: job.Role > 0,
      isLimited: job.IsLimitedJob === 1,
    }));

  console.log(`Fetched ${jobs.length} jobs with icons`);
  return jobs;
}

async function main() {
  const outputDir = join(import.meta.dirname, '..', 'src', 'gamedata');

  try {
    // Fetch and save jobs
    const jobs = await fetchJobs();
    const jobsPath = join(outputDir, 'jobs.json');
    writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
    console.log(`Saved jobs to ${jobsPath}`);

    // Generate TypeScript types from the data
    const combatJobs = jobs.filter((j) => j.isCombat && !j.isLimited);
    const jobAbbreviations = combatJobs.map((j) => `'${j.abbreviation}'`).join(' | ');

    console.log('\n--- Combat Job Types (for reference) ---');
    console.log(`type Job = ${jobAbbreviations};`);

    // Print summary
    console.log('\n--- Summary ---');
    console.log(`Tanks: ${jobs.filter((j) => j.role === 'tank').map((j) => j.abbreviation).join(', ')}`);
    console.log(`Healers: ${jobs.filter((j) => j.role === 'healer').map((j) => j.abbreviation).join(', ')}`);
    console.log(`Melee: ${jobs.filter((j) => j.role === 'melee').map((j) => j.abbreviation).join(', ')}`);
    console.log(`Ranged: ${jobs.filter((j) => j.role === 'ranged').map((j) => j.abbreviation).join(', ')}`);
    console.log(`Caster: ${jobs.filter((j) => j.role === 'caster').map((j) => j.abbreviation).join(', ')}`);

    // Show sample icon URLs
    console.log('\n--- Sample Icon URLs ---');
    const sampleJobs = jobs.filter((j) => j.isCombat && !j.isLimited).slice(0, 3);
    sampleJobs.forEach((j) => {
      console.log(`${j.abbreviation}: https://xivapi.com${j.icon}`);
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
}

main();
