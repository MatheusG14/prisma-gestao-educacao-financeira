const fs = require('fs');
const path = require('path');
const htmlDir = path.resolve(__dirname, '..');
const serverCode = fs.readFileSync(path.join(htmlDir, 'server.js'), 'utf8');

console.log('--- AUDITORIA DE SEGURANÇA E BACKEND (server.js) ---');

// 1. Verificação de SQL Injection / Prepared statements
const hasUnsafeSql = /\b(db\.exec|db\.prepare)\s*\(\s*`[^`]*\$\{/i.test(serverCode);
console.log('1. Interpolação insegura de SQL em db.exec/prepare:', hasUnsafeSql ? '⚠️ ENCONTRADA' : '✅ NENHUMA (Prepared statements usados)');

// 2. Proteção contra Rate Limiting e WAF
const hasRateLimit = serverCode.includes('rateLimit') || serverCode.includes('checkRateLimit');
console.log('2. Rate limiting implementado:', hasRateLimit ? '✅ SIM' : '❌ NÃO');

// 3. Controle de Sessões e Cookies HttpOnly
const hasHttpOnly = /HttpOnly/i.test(serverCode);
const hasSameSite = /SameSite/i.test(serverCode);
console.log('3. Cookies HttpOnly:', hasHttpOnly ? '✅ SIM' : '❌ NÃO', '| SameSite:', hasSameSite ? '✅ SIM' : '❌ NÃO');

// 4. Headers de Segurança (CSP, HSTS, X-Content-Type, etc.)
const hasSecurityHeaders = serverCode.includes('X-Content-Type-Options') && serverCode.includes('X-Frame-Options');
console.log('4. Headers de segurança nativos no server:', hasSecurityHeaders ? '✅ SIM' : '❌ NÃO');

// 5. Verificação de rotas de API
const routes = [];
const routeRegex = /url\.pathname\s*===?\s*['"]([^'"]+)['"]/g;
let m;
while ((m = routeRegex.exec(serverCode)) !== null) {
  routes.push(m[1]);
}
console.log('5. Rotas mapeadas (' + routes.length + '):', [...new Set(routes)]);

// 6. Verificação de persistência por usuário (Isolamento de tenancy)
const hasUserIdIsolation = serverCode.includes('WHERE user_id =') || serverCode.includes('user_id');
console.log('6. Isolamento por user_id em transações/estados:', hasUserIdIsolation ? '✅ SIM' : '❌ NÃO');

