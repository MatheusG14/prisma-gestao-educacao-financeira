const fs = require('fs');
const path = require('path');
const htmlDir = path.resolve(__dirname, '..');

const cssDir = path.join(htmlDir, 'css');
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));

console.log('--- AUDITORIA DE FOLHAS DE ESTILO CSS ---');

cssFiles.forEach(f => {
  const p = path.join(cssDir, f);
  const content = fs.readFileSync(p, 'utf8');
  
  // Balanceamento de chaves
  const openCount = (content.match(/\{/g) || []).length;
  const closeCount = (content.match(/\}/g) || []).length;
  const isBalanced = openCount === closeCount;
  
  // Verificação de @media queries
  const mediaCount = (content.match(/@media[^{]+\{/g) || []).length;
  
  // Suporte a prefers-reduced-motion
  const hasReducedMotion = content.includes('prefers-reduced-motion');
  
  console.log(f.padEnd(30), '| Linhas:', String(content.split('\n').length).padEnd(5), '| Chaves:', String(openCount + '/' + closeCount).padEnd(10), isBalanced ? '✓ Balanceado' : '❌ DESBALANCEADO', '| Medias:', String(mediaCount).padEnd(3), '| Reduced motion:', hasReducedMotion ? '✓' : '—');
});

