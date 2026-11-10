const fs = require('fs');
const path = require('path');
const htmlDir = path.resolve(__dirname, '..');

const indexHtml = fs.readFileSync(path.join(htmlDir, 'index.html'), 'utf8');

console.log('--- AUDITORIA DE IDS E CONTRATOS DOM ---');

// Coletar todos os IDs de index.html
const idRegex = /id=["']([^"']+)["']/g;
const ids = new Map();
let m;
while ((m = idRegex.exec(indexHtml)) !== null) {
  const id = m[1];
  ids.set(id, (ids.get(id) || 0) + 1);
}

// Verificar duplicatas
const duplicates = [];
for (const [id, count] of ids.entries()) {
  if (count > 1) {
    duplicates.push({ id, count });
  }
}

console.log('Total de IDs únicos:', ids.size);
console.log('IDs duplicados em index.html:', duplicates.length ? duplicates : '✅ NENHUM');

// Verificar se botões de navegação encontram seus targets
const navTargetRegex = /data-section=["']([^"']+)["']/g;
const navTargets = new Set();
while ((m = navTargetRegex.exec(indexHtml)) !== null) {
  navTargets.add(m[1]);
}

const missingSections = [];
for (const target of navTargets) {
  // Procura por section com esse ID
  if (!ids.has(target)) {
    missingSections.push(target);
  }
}
console.log('Destinos data-section verificados (' + navTargets.size + '):', [...navTargets]);
console.log('Seções inexistentes para links data-section:', missingSections.length ? missingSections : '✅ NENHUMA (Todas as seções existem)');

