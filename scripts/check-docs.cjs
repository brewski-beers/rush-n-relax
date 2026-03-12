#!/usr/bin/env node
// check-docs.cjs — CI lint guard for stale documentation references.
// Exits non-zero if any known stale patterns are found.
// Run via: npm run check-docs  (also runs as part of npm run lint)
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let failed = false;

function check(pattern, glob, description, exception) {
  try {
    // ripgrep: -l = files with matches, -r = recursive, --glob = file pattern
    const cmd = `grep -rl "${pattern}" ${glob.map(g => `"${path.join(ROOT, g)}"`).join(' ')} 2>/dev/null || true`;
    const result = execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (result) {
      const files = result.split('\n').filter(Boolean);
      // Apply exception filter
      const violations = exception
        ? files.filter(f => !exception.test(f))
        : files;
      if (violations.length > 0) {
        console.error(`\n❌ Stale pattern found: "${pattern}"`);
        console.error(`   Reason: ${description}`);
        violations.forEach(f => console.error(`   → ${path.relative(ROOT, f)}`));
        failed = true;
      }
    }
  } catch {
    // grep exits 1 when no matches — that's fine
  }
}

console.log('Running doc consistency checks...');

// Stale Firestore path — tenants/rnr/ was removed; all collections are now root-level
check(
  'tenants/rnr/',
  ['docs/**/*.md', 'src/**/*.ts', 'src/**/*.tsx'],
  'Old tenant-scoped Firestore path — use root collections (locations/, products/, etc.)'
);

// Removed type field
check(
  'shippableCategories',
  ['src/types/**/*.ts', 'src/lib/**/*.ts'],
  'Removed type field — shippableCategories was deleted from the Product schema'
);

// Removed type field
check(
  'promoId:',
  ['src/types/**/*.ts'],
  'Removed type field — promoId was removed from the Promo schema'
);

// Stale hosting references in docs (allow in migration history section)
check(
  'Firebase App Hosting',
  ['docs/**/*.md'],
  'Replaced by Vercel — update hosting references in docs',
  /migration/i  // exception: files with "migration" in path are allowed
);

check(
  'apphosting\\.yaml',
  ['docs/**/*.md'],
  'apphosting.yaml was deleted — update docs references',
  /migration/i
);

if (failed) {
  console.error('\n💥 check-docs failed. Run /doc-writer to fix stale references.\n');
  process.exit(1);
} else {
  console.log('✅ All doc consistency checks passed.\n');
}
