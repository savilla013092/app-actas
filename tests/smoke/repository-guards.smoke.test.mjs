import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(cwd, relativePath), 'utf8');
}

test('smoke repo: api seed queda bloqueada en produccion y exige secreto fuera de produccion', () => {
  const routeSource = read('src/app/api/seed/route.ts');
  assert.match(routeSource, /process\.env\.NODE_ENV\s*===\s*'production'/);
  assert.match(routeSource, /x-seed-secret/);
  assert.match(routeSource, /SEED_DEMO_SECRET/);
});

test('smoke repo: no quedan alert\/confirm ni asignacion de rol por email en cliente', () => {
  const clientSources = [
    read('src/hooks/useAuth.ts'),
    read('src/components/forms/LoginForm.tsx'),
    read('src/app/express-loans/page.tsx'),
  ].join('\n');

  assert.doesNotMatch(clientSources, /alert\(/);
  assert.doesNotMatch(clientSources, /confirm\(/);
  assert.doesNotMatch(clientSources, /includes\('admin'\)|includes\("admin"\)|includes\('logistica'\)|includes\("logistica"\)/);
});

test('smoke repo: las reglas sensibles ya no permiten escrituras cliente directas', () => {
  const firestoreRules = read('firestore.rules');
  assert.match(firestoreRules, /match \/usuarios\/\{userId\}[\s\S]*allow create, update, delete: if false;/);
  assert.match(firestoreRules, /match \/revisiones\/\{revisionId\}[\s\S]*allow create, update, delete: if false;/);
  assert.match(firestoreRules, /match \/express_loans\/\{loanId\}[\s\S]*allow create, update, delete: if false;/);
});
