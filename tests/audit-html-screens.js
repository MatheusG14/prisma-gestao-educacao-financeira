const fs = require('fs');
const path = require('path');
const htmlDir = path.resolve(__dirname, '..');

const files = [
  'telas/dashboard.html',
  'telas/centro-financeiro.html',
  'telas/educacao-financeira.html',
  'telas/receitas.html',
  'telas/despesas.html',
  'telas/contas.html',
  'telas/cartoes.html',
  'telas/investimentos.html',
  'telas/metas.html',
  'telas/carteira-ativos.html',
  'telas/prisma-ai.html',
  'telas/relatorios.html',
  'telas/perfil.html',
  'telas/configuracoes.html',
  'telas/admin.html',
  'telas/components/navbar.html',
  'telas/components/sidebar.html',
  'telas/components/form-modals.html',
  'telas/components/auth-modals.html'
];

console.log('--- AUDITORIA DE TELAS E COMPONENTES HTML ---');

files.forEach(f => {
  const p = path.join(htmlDir, f);
  if (!fs.existsSync(p)) return console.log('Missing:', f);
  const content = fs.readFileSync(p, 'utf8');
  
  const iconRegex = /data-lucide=["']([^"']+)["']/g;
  const icons = [];
  let m;
  while ((m = iconRegex.exec(content)) !== null) {
    icons.push(m[1]);
  }
  
  const invalidIcons = icons.filter(name => !/^[a-z0-9-]+$/.test(name));
  
  console.log(f.padEnd(35), '| Ícones total:', String(icons.length).padEnd(4), invalidIcons.length ? '⚠️ Ícones inválidos: ' + invalidIcons.join(', ') : '✓ Todos válidos');
});

