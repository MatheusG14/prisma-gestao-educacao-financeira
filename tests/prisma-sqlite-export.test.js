'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { after, before, test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-sqlite-export-'));
const databasePath = path.join(temporaryDirectory, 'source.sqlite');
const backupPath = path.join(temporaryDirectory, 'backup.json');
const exporterPath = path.resolve(__dirname, '..', 'scripts', 'export-sqlite-user.js');

function createDatabase() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, password_hash TEXT);
    CREATE TABLE user_states (user_id TEXT, state_json TEXT);
  `);
  database.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(
    'uid-1',
    'Usuário Teste',
    'teste@example.com',
    'sensitive-password-hash'
  );
  database.prepare('INSERT INTO user_states VALUES (?, ?)').run(
    'uid-1',
    JSON.stringify({ receitas: [{ id: 'receita-1', valor: 125.5 }] })
  );
  return database;
}

function runExporter(outputPath = backupPath) {
  return spawnSync(process.execPath, [exporterPath, 'teste@example.com', outputPath], {
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: 'utf8'
  });
}

after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

before(() => {
  createDatabase().close();
});

test('exports only the selected financial state without modifying SQLite or including credentials', () => {
  const originalDatabase = fs.readFileSync(databasePath);

  const result = runExporter();
  assert.equal(result.status, 0, result.stderr);

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.format, 'prisma-gef-sqlite-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.user.email, 'teste@example.com');
  assert.deepEqual(backup.state.receitas, [{ id: 'receita-1', valor: 125.5 }]);
  assert.equal(JSON.stringify(backup).includes('sensitive-password-hash'), false);
  assert.deepEqual(fs.readFileSync(databasePath), originalDatabase);
});

test('does not overwrite an existing backup file', () => {
  const result = runExporter();

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST/);
});
