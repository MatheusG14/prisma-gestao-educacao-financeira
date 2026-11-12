'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PRISMA_BUILD_DIR || path.join(root, 'dist'));
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'prisma-gef.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'prisma-gef',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'prisma-gef.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};
const missing = ['apiKey', 'messagingSenderId', 'appId'].filter((key) => !firebaseConfig[key]);

if (missing.length) {
  throw new Error(`Build do Prisma interrompido. Configure as variáveis Firebase: ${missing.join(', ')}.`);
}

fs.mkdirSync(output, { recursive: true });
for (const entry of ['index.html', 'assets', 'css', 'js', 'telas', 'conteudos']) {
  const source = path.join(root, entry);
  const destination = path.join(output, entry);
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true });
  }
}

const configPath = path.join(output, 'js', 'firebase-config.js');
fs.writeFileSync(
  configPath,
  `window.PRISMA_FIREBASE_CONFIG = Object.freeze(${JSON.stringify(firebaseConfig)});\n`,
  { encoding: 'utf8', mode: 0o644 }
);

console.log(`Build estático do Prisma criado em ${output}.`);
