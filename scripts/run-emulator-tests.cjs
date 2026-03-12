#!/usr/bin/env node
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const suite = process.argv[2] ?? 'all';
const scriptCommand = `node scripts/execute-node-tests.cjs ${suite}`;
const configHome = join(process.cwd(), '.firebase-config');
mkdirSync(configHome, { recursive: true });

const env = {
  ...process.env,
  XDG_CONFIG_HOME: configHome,
};

const javaCheck = spawnSync('java', ['-version'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
  env,
});

if ((javaCheck.status ?? 1) !== 0) {
  console.error('Java no esta disponible en PATH. Instala Java 11+ para ejecutar las pruebas con emuladores de Firebase.');
  process.exit(1);
}

let result;

if (process.platform === 'win32') {
  const fullCommand = `firebase.cmd emulators:exec --only firestore,storage --project demo-app-actas "${scriptCommand}"`;
  result = spawnSync('cmd.exe', ['/d', '/s', '/c', fullCommand], { stdio: 'inherit', env });
} else {
  result = spawnSync(
    'firebase',
    ['emulators:exec', '--only', 'firestore,storage', '--project', 'demo-app-actas', scriptCommand],
    { stdio: 'inherit', env }
  );
}

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
