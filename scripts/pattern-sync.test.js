/**
 * Pattern Sync Tests
 *
 * Validates that gear source patterns are synchronized between frontend and backend.
 * This prevents drift that could cause silent misclassification bugs.
 *
 * CI will fail if patterns diverge, catching issues before they reach production.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract patterns from frontend TypeScript file
function extractFrontendPatterns() {
  const frontendPath = resolve(__dirname, '../frontend/src/utils/bisSourceDetection.ts');
  const content = readFileSync(frontendPath, 'utf-8');

  // Extract CRAFTED_PATTERNS array
  const craftedMatch = content.match(/const CRAFTED_PATTERNS\s*=\s*\[([\s\S]*?)\];/);
  const craftedPatterns = craftedMatch
    ? craftedMatch[1]
        .split('\n')
        .map((line) => {
          const match = line.match(/'([^']+)'/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean)
    : [];

  // Extract TOME_PATTERNS array
  const tomeMatch = content.match(/const TOME_PATTERNS\s*=\s*\[([\s\S]*?)\];/);
  const tomePatterns = tomeMatch
    ? tomeMatch[1]
        .split('\n')
        .map((line) => {
          const match = line.match(/'([^']+)'/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean)
    : [];

  return { craftedPatterns, tomePatterns };
}

// Extract patterns from backend Python file
function extractBackendPatterns() {
  const backendPath = resolve(__dirname, '../backend/app/routers/bis.py');
  const content = readFileSync(backendPath, 'utf-8');

  // Extract crafted_patterns list
  const craftedMatch = content.match(/crafted_patterns\s*=\s*\[([\s\S]*?)\]/);
  const craftedPatterns = craftedMatch
    ? craftedMatch[1]
        .split('\n')
        .map((line) => {
          const match = line.match(/"([^"]+)"/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean)
    : [];

  // Extract tome_patterns list
  const tomeMatch = content.match(/tome_patterns\s*=\s*\[([\s\S]*?)\]/);
  const tomePatterns = tomeMatch
    ? tomeMatch[1]
        .split('\n')
        .map((line) => {
          const match = line.match(/"([^"]+)"/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean)
    : [];

  return { craftedPatterns, tomePatterns };
}

describe('pattern-sync', () => {
  const frontend = extractFrontendPatterns();
  const backend = extractBackendPatterns();

  describe('crafted patterns', () => {
    it('frontend has crafted patterns defined', () => {
      expect(frontend.craftedPatterns.length).toBeGreaterThan(0);
    });

    it('backend has crafted patterns defined', () => {
      expect(backend.craftedPatterns.length).toBeGreaterThan(0);
    });

    it('frontend and backend crafted patterns match', () => {
      const frontendSet = new Set(frontend.craftedPatterns);
      const backendSet = new Set(backend.craftedPatterns);

      const missingInBackend = frontend.craftedPatterns.filter((p) => !backendSet.has(p));
      const missingInFrontend = backend.craftedPatterns.filter((p) => !frontendSet.has(p));

      if (missingInBackend.length > 0) {
        console.error('Crafted patterns in frontend but not backend:', missingInBackend);
      }
      if (missingInFrontend.length > 0) {
        console.error('Crafted patterns in backend but not frontend:', missingInFrontend);
      }

      expect(missingInBackend).toEqual([]);
      expect(missingInFrontend).toEqual([]);
    });
  });

  describe('tome patterns', () => {
    it('frontend has tome patterns defined', () => {
      expect(frontend.tomePatterns.length).toBeGreaterThan(0);
    });

    it('backend has tome patterns defined', () => {
      expect(backend.tomePatterns.length).toBeGreaterThan(0);
    });

    it('frontend and backend tome patterns match', () => {
      const frontendSet = new Set(frontend.tomePatterns);
      const backendSet = new Set(backend.tomePatterns);

      const missingInBackend = frontend.tomePatterns.filter((p) => !backendSet.has(p));
      const missingInFrontend = backend.tomePatterns.filter((p) => !frontendSet.has(p));

      if (missingInBackend.length > 0) {
        console.error('Tome patterns in frontend but not backend:', missingInBackend);
      }
      if (missingInFrontend.length > 0) {
        console.error('Tome patterns in backend but not frontend:', missingInFrontend);
      }

      expect(missingInBackend).toEqual([]);
      expect(missingInFrontend).toEqual([]);
    });
  });

  describe('sync documentation', () => {
    it('frontend has sync comment', () => {
      const frontendPath = resolve(__dirname, '../frontend/src/utils/bisSourceDetection.ts');
      const content = readFileSync(frontendPath, 'utf-8');
      expect(content).toContain('Keep in sync with');
    });

    it('backend has sync comment', () => {
      const backendPath = resolve(__dirname, '../backend/app/routers/bis.py');
      const content = readFileSync(backendPath, 'utf-8');
      expect(content).toContain('Keep in sync with');
    });
  });
});
