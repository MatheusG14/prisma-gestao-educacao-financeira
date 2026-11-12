'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const email = String(process.argv[2] || '').trim().toLowerCase();
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : '';
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma.sqlite'));

if (!/^\S+@\S+\.\S+$/.test(email) || !outputPath) {
  console.error('Uso: node scripts/export-sqlite-user.js <email> <arquivo-backup.json>');
  process.exitCode = 1;
} else if (outputPath === databasePath) {
  console.error('O destino do backup não pode ser o próprio banco de dados.');
  process.exitCode = 1;
} else {
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const matches = database.prepare(`
      SELECT id, name, email
      FROM users
      WHERE lower(email) = ?
      LIMIT 2
    `).all(email);
    if (matches.length !== 1) {
      throw new Error(matches.length ? 'Mais de uma conta corresponde ao e-mail.' : 'Nenhuma conta foi encontrada para esse e-mail.');
    }

    const rows = database.prepare('SELECT state_json FROM user_states WHERE user_id = ?').all(matches[0].id);
    if (rows.length !== 1) throw new Error('A conta não possui um estado financeiro para exportar.');

    const state = JSON.parse(rows[0].state_json);
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('O estado financeiro armazenado não é um objeto JSON válido.');
    }

    const backup = {
      format: 'prisma-gef-sqlite-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      user: {
        name: matches[0].name,
        email: matches[0].email
      },
      state
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`Backup exportado para ${outputPath}. Guarde o arquivo em local seguro; ele contém dados financeiros pessoais.`);
  } catch (error) {
    console.error(`Não foi possível exportar o backup: ${error.message}`);
    process.exitCode = 1;
  } finally {
    database?.close();
  }
}
