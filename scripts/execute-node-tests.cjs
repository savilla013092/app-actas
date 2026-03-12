#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const suite = process.argv[2] ?? 'all';
const suiteTargets = {
  rules: ['tests/rules'],
  smoke: ['tests/smoke'],
  all: ['tests/rules', 'tests/smoke'],
};

const targets = suiteTargets[suite];
if (!targets) {
  console.error(`Suite no soportada: ${suite}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...targets],
  {
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
