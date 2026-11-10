const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Import server app if possible, or start server on a dedicated test port
let server;
let baseUrl = '';

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      path: url.pathname + url.search
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body = data;
        try {
          body = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (typeof options.body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(options.body));
      } else {
        req.write(options.body);
      }
    }
    req.end();
  });
}

test.before(async () => {
  // Start server on an ephemeral port
  process.env.PORT = '3009';
  process.env.SESSION_SECRET = 'test_secret_key_1234567890_prisma_secure';
  // Require server
  const serverModule = require('../server.js');
  // Wait slightly for server to listen on 3009
  await new Promise(r => setTimeout(r, 600));
  baseUrl = 'http://localhost:3009';
});

test.after(async () => {
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

test('1. Database Tables and Constraints exist in SQLite', () => {
  const dbPath = path.resolve(__dirname, '../prisma.sqlite');
  assert.equal(fs.existsSync(dbPath), true, 'prisma.sqlite database must exist');
  
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  assert.ok(tables.includes('users'), 'Table users exists');
  assert.ok(tables.includes('sessions'), 'Table sessions exists');
  assert.ok(tables.includes('user_states'), 'Table user_states exists');
  assert.ok(tables.includes('reset_tokens'), 'Table reset_tokens exists');
  
  const pragmaWal = db.prepare("PRAGMA journal_mode").get();
  assert.equal(pragmaWal.journal_mode.toLowerCase(), 'wal', 'WAL journal mode enabled');
});

test('2. Registration Flow: validation, conflict rejection and success', async () => {
  const testEmail = `test_${Date.now()}@prismatest.com`;
  
  // A. Missing or short fields
  const resBad = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'A', email: 'invalid-email', password: '123' }
  });
  assert.equal(resBad.status, 400, 'Rejects invalid registration data with 400');

  // B. Valid registration
  const resOk = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Investidor Teste', email: testEmail, password: 'SenhaForte123!' }
  });
  assert.equal(resOk.status, 201, 'Creates account with 201');
  assert.equal(resOk.body.user.email, testEmail);
  assert.ok(resOk.headers['set-cookie'], 'Returns session cookie on registration');

  // C. Conflict on duplicate email
  const resConflict = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Investidor Duplicado', email: testEmail, password: 'OutraSenha123!' }
  });
  assert.equal(resConflict.status, 409, 'Returns 409 Conflict for existing email');
});

test('3. Login Flow: invalid credentials, valid login, session verification and cookies', async () => {
  const email = `login_${Date.now()}@prismatest.com`;
  const password = 'MinhaSenhaSegura2026!';
  
  // Register first
  await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Login User', email, password }
  });

  // A. Invalid Password
  const resInvalid = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'SenhaErrada123!' }
  });
  assert.equal(resInvalid.status, 401, 'Returns 401 Unauthorized for wrong password');

  // B. Valid Login
  const resLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  assert.equal(resLogin.status, 200, 'Login succeeds with 200');
  assert.equal(resLogin.body.user.email, email);

  const cookies = resLogin.headers['set-cookie'];
  assert.ok(cookies, 'Cookie header present');
  const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
  assert.ok(cookieStr.includes('prisma_session'), 'prisma_session cookie returned');
  assert.ok(cookieStr.toLowerCase().includes('httponly'), 'Cookie is HttpOnly');

  // C. Verify /api/auth/me with session cookie
  const resMe = await request('/api/auth/me', {
    headers: { 'Cookie': cookieStr }
  });
  assert.equal(resMe.status, 200);
  assert.equal(resMe.body.authenticated, true);
  assert.equal(resMe.body.user.email, email);
});

test('4. State Persistence: PUT and GET user_state in SQLite', async () => {
  const email = `state_${Date.now()}@prismatest.com`;
  const password = 'StatePassword123!';
  
  const resReg = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'State User', email, password }
  });
  const cookie = resReg.headers['set-cookie'][0].split(';')[0];

  // Save financial investments and AI state
  const testState = {
    receitas: [{ id: 'r1', descricao: 'Salário Tech', valor: 12000, data: '2026-11-01' }],
    despesas: [{ id: 'd1', descricao: 'Aluguel', valor: 3000, data: '2026-11-05' }],
    investimentos: [
      { id: 'inv1', nome: 'Tesouro Selic 2029', tipo: 'tesouro-direto', instituicao: 'Tesouro Nacional', valorAplicado: 10000, valorAtual: 10850, rentabilidade: 8.5 },
      { id: 'inv2', nome: 'ITUB4', tipo: 'acoes', ticker: 'ITUB4', instituicao: 'Itaú Corretora', valorAplicado: 5000, valorAtual: 5600, rentabilidade: 12.0 }
    ],
    goals: [{ id: 'g1', name: 'Reserva de Emergência', target: 36000, current: 18000 }],
    summary: { saldoAtual: 9000, salarioMensal: 12000 }
  };

  const resPut = await request('/api/state', {
    method: 'PUT',
    headers: { 'Cookie': cookie },
    body: testState
  });
  assert.equal(resPut.status, 200, 'State saved successfully');

  const resGet = await request('/api/state', {
    headers: { 'Cookie': cookie }
  });
  assert.equal(resGet.status, 200);
  assert.equal(resGet.body.investimentos.length, 2);
  assert.equal(resGet.body.investimentos[0].nome, 'Tesouro Selic 2029');
  assert.equal(resGet.body.investimentos[1].ticker, 'ITUB4');
  assert.equal(resGet.body.goals.length, 1);
});

test('5. Critical Bug Fix: Logout Revocation & Unauthenticated Access Block', async () => {
  const email = `logout_${Date.now()}@prismatest.com`;
  const password = 'LogoutPassword123!';
  
  const resReg = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Logout User', email, password }
  });
  const cookie = resReg.headers['set-cookie'][0].split(';')[0];

  // Verify session works before logout
  const resBefore = await request('/api/auth/me', { headers: { 'Cookie': cookie } });
  assert.equal(resBefore.body.authenticated, true);

  // Perform logout
  const resLogout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'Cookie': cookie },
    body: {}
  });
  assert.equal(resLogout.status, 200, 'Logout succeeds with 200');

  // Verify cookie clear header
  const logoutCookies = resLogout.headers['set-cookie'];
  assert.ok(logoutCookies, 'Set-Cookie present on logout');
  const logoutCookieStr = Array.isArray(logoutCookies) ? logoutCookies.join('; ') : logoutCookies;
  assert.ok(logoutCookieStr.includes('Max-Age=0') || logoutCookieStr.includes('Expires='), 'Cookie expired on logout');

  // Verify revoked session can no longer access /api/auth/me or private state
  const resAfterMe = await request('/api/auth/me', { headers: { 'Cookie': cookie } });
  assert.equal(resAfterMe.body.authenticated, false, 'Revoked session is unauthenticated in /api/auth/me');

  const resAfterState = await request('/api/state', { headers: { 'Cookie': cookie } });
  assert.equal(resAfterState.status, 401, 'Protected /api/state returns 401 for revoked session');
});

test('6. HTML & UI Architecture Validation (5 Levels Carteira & 5 Areas Prisma AI)', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

  // App is hidden by default to prevent private content flash
  assert.ok(indexHtml.includes('id="mainApp" style="display: none;"') || indexHtml.includes('class="app" id="mainApp" style="display: none;"'), 'App container hidden by default');

  // Feedback banners exist in forms
  assert.ok(indexHtml.includes('id="loginFeedback"'), 'loginFeedback exists in login form');
  assert.ok(indexHtml.includes('id="regFeedback"'), 'regFeedback exists in registration form');

  // Carteira de Ativos: 5 levels
  assert.ok(indexHtml.includes('carteira-summary-card') || indexHtml.includes('id="investimentosPortfolioCard"'), 'Level 1: Executive summary container');
  assert.ok(indexHtml.includes('id="portfolioTotalInvestido"'), 'Level 1: Total investido KPI');
  assert.ok(indexHtml.includes('id="portfolioTotalProjetado"'), 'Level 1: Total projetado / valor atual KPI');
  assert.ok(indexHtml.includes('id="portfolioTotalLucro"'), 'Level 1: Resultado financeiro lucro/prejuízo');
  assert.ok(indexHtml.includes('id="portfolioRentabilidade"'), 'Level 1: Rentabilidade acumulada %');
  assert.ok(indexHtml.includes('id="portfolioChart"'), 'Level 2: Distribution donut chart canvas');
  assert.ok(indexHtml.includes('id="portfolioLegend"'), 'Level 2: Distribution legend');
  assert.ok(indexHtml.includes('id="carteiraToolbar"'), 'Level 4: Toolbar with filters');
  assert.ok(indexHtml.includes('id="carteiraFilters"'), 'Level 4: Category filter pills');
  assert.ok(indexHtml.includes('id="carteiraSearch"') || indexHtml.includes('id="carteiraSearchInput"'), 'Level 4: Search input');
  assert.ok(indexHtml.includes('id="carteiraSort"') || indexHtml.includes('id="carteiraSortSelect"'), 'Level 4: Sort select');
  assert.ok(indexHtml.includes('id="investimentosBody"'), 'Level 3: Asset list container');
  assert.ok(indexHtml.includes('id="investimentoDetalheModal"'), 'Level 3: Detail modal on demand');

  // Prisma AI: 5 areas
  assert.ok(indexHtml.includes('id="aiToggleCockpitBtn"'), 'Area A: Cockpit metrics drawer toggle');
  assert.ok(indexHtml.includes('id="aiPdfBtn"') || indexHtml.includes('id="aiExportPdfBtn"'), 'Area A: Export PDF button');
  assert.ok(indexHtml.includes('id="aiResetBtn"') || indexHtml.includes('id="aiResetChatBtn"'), 'Area A: Reset chat button');
  assert.ok(indexHtml.includes('data-ai-action="gastos"'), 'Area C: Smart action Analisar gastos');
  assert.ok(indexHtml.includes('data-ai-action="economizar"'), 'Area C: Smart action Como economizar');
  assert.ok(indexHtml.includes('data-ai-action="investimentos"'), 'Area C: Smart action Avaliar investimentos');
  assert.ok(indexHtml.includes('data-ai-action="planejar"'), 'Area C: Smart action Planejar finanças');
  assert.ok(indexHtml.includes('data-ai-action="relatorio"'), 'Area C: Smart action Gerar relatório');
  assert.ok(indexHtml.includes('id="aiChat"'), 'Area D: Central chat messages container');
  assert.ok(indexHtml.includes('id="aiTypingIndicator"'), 'Area D: Typing indicator');
  assert.ok(indexHtml.includes('id="aiInput"'), 'Area D: Message input');
  assert.ok(indexHtml.includes('id="aiSend"'), 'Area D: Send button');
  assert.ok(indexHtml.includes('id="aiCockpitDrawer"'), 'Area E: Expandable metrics & charts drawer');
});
