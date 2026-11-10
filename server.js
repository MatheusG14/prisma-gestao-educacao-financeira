'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 3000);
let PORT = DEFAULT_PORT;
const SESSION_TTL = 1000 * 60 * 60 * 24 * Number(process.env.SESSION_TTL_DAYS || 30);
const MAX_BODY = 2 * 1024 * 1024;

// Caminho do banco de dados SQLite real e persistente
const DB_PATH = process.env.DATABASE_PATH || path.resolve(ROOT, 'prisma.sqlite');
const db = new DatabaseSync(DB_PATH);

// Inicializa schema do SQLite com integridade e índices
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    auth_method TEXT DEFAULT 'password',
    status TEXT DEFAULT 'active',
    role TEXT DEFAULT 'USER',
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS user_states (
    user_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT,
    related_data_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);

  CREATE TABLE IF NOT EXISTS pdf_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    pdf_name TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_pdf_history_user ON pdf_history(user_id);

  CREATE TABLE IF NOT EXISTS lgpd_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    essential_accepted INTEGER NOT NULL DEFAULT 1,
    communications_consent INTEGER NOT NULL DEFAULT 0,
    analytics_consent INTEGER NOT NULL DEFAULT 0,
    open_finance_consent INTEGER NOT NULL DEFAULT 0,
    choices_json TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user ON lgpd_consents(user_id);
`);

// Prepared Statements para alta performance e segurança total contra SQL injection
const stmtGetUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtGetUserByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
const stmtInsertUser = db.prepare(`
  INSERT INTO users (id, name, email, password_hash, phone, avatar_url, auth_method, status, role, last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtUpdateUser = db.prepare(`
  UPDATE users SET name = ?, phone = ?, avatar_url = ?, auth_method = ?, status = ?, role = ?, last_login_at = ?, password_hash = ?, updated_at = ?
  WHERE id = ?
`);
const stmtDeleteUser = db.prepare('DELETE FROM users WHERE id = ?');
const stmtGetAllUsers = db.prepare('SELECT * FROM users ORDER BY created_at DESC');

const stmtGetSession = db.prepare('SELECT * FROM sessions WHERE token = ?');
const stmtInsertSession = db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at, last_seen_at) VALUES (?, ?, ?, ?)');
const stmtUpdateSessionLastSeen = db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?');
const stmtDeleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
const stmtDeleteUserSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
const stmtCleanExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

const stmtGetUserState = db.prepare('SELECT state_json FROM user_states WHERE user_id = ?');
const stmtUpsertUserState = db.prepare(`
  INSERT INTO user_states (user_id, state_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
`);
const stmtDeleteUserState = db.prepare('DELETE FROM user_states WHERE user_id = ?');

const stmtGetResetToken = db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?');
const stmtInsertResetToken = db.prepare('INSERT OR REPLACE INTO reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
const stmtDeleteResetToken = db.prepare('DELETE FROM reset_tokens WHERE token_hash = ?');

const stmtInsertInsight = db.prepare(`
  INSERT INTO insights (id, user_id, type, title, description, severity, related_data_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetInsights = db.prepare('SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 100');

const stmtInsertPdfHistory = db.prepare(`
  INSERT INTO pdf_history (id, user_id, content_id, recipient_email, pdf_name, status, provider_message_id, error_message, sent_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetPdfHistory = db.prepare('SELECT * FROM pdf_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');

const stmtGetLatestLgpdConsent = db.prepare('SELECT * FROM lgpd_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
const stmtInsertLgpdConsent = db.prepare(`
  INSERT INTO lgpd_consents (id, user_id, policy_version, terms_version, essential_accepted, communications_consent, analytics_consent, open_finance_consent, choices_json, ip_address, user_agent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetLgpdHistory = db.prepare('SELECT * FROM lgpd_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');

const CURRENT_LGPD_POLICY_VERSION = 'v1.0-2026.11';
const CURRENT_TERMS_VERSION = 'v1.0-2026.11';

function userHasValidLgpdConsent(userId) {
  if (!userId) return false;
  const row = stmtGetLatestLgpdConsent.get(userId);
  return !!(row && row.policy_version === CURRENT_LGPD_POLICY_VERSION && row.essential_accepted === 1);
}

function sanitizeLgpdConsent(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    policyVersion: row.policy_version,
    termsVersion: row.terms_version,
    essentialAccepted: Boolean(row.essential_accepted),
    communicationsConsent: Boolean(row.communications_consent),
    analyticsConsent: Boolean(row.analytics_consent),
    openFinanceConsent: Boolean(row.open_finance_consent),
    choices: parseJson(row.choices_json, {}),
    ipAddress: row.ip_address || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Mapeamento de entidade de banco de dados
function rowToUser(row){
  if(!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    phone: row.phone || null,
    avatarUrl: row.avatar_url || null,
    authMethod: row.auth_method || 'password',
    status: row.status || 'active',
    role: row.role || 'USER',
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function dbGetUserById(id){ return rowToUser(stmtGetUserById.get(id)); }
function dbGetUserByEmail(email){ return rowToUser(stmtGetUserByEmail.get(String(email||'').trim().toLowerCase())); }
function dbCreateUser(u){
  stmtInsertUser.run(u.id, u.name, u.email, u.password_hash, u.phone||null, u.avatarUrl||null, u.authMethod||'password', u.status||'active', u.role||'USER', u.lastLoginAt||null, u.createdAt, u.updatedAt);
  return u;
}
function dbUpdateUser(u){
  stmtUpdateUser.run(u.name, u.phone||null, u.avatarUrl||null, u.authMethod||'password', u.status||'active', u.role||'USER', u.lastLoginAt||null, u.password_hash, u.updatedAt, u.id);
  return u;
}
function dbDeleteUser(id){
  stmtDeleteUser.run(id);
  stmtDeleteUserState.run(id);
  stmtDeleteUserSessions.run(id);
}
function dbGetAllUsers(){
  return stmtGetAllUsers.all().map(rowToUser);
}

// Mapas efêmeros para rate-limiting em memória
const loginAttempts = new Map();
const apiRateBuckets = new Map();

/** —— WAF / hardening fintech (origin) —— */
const WAF = {
  MAX_PATH: 2048,
  API_RATE_WINDOW_MS: 60 * 1000,
  API_RATE_MAX: Number(process.env.WAF_API_RATE_MAX || 120),
  AUTH_RATE_MAX: Number(process.env.WAF_AUTH_RATE_MAX || 20),
  BLOCKED_UA: [/sqlmap/i, /nikto/i, /nessus/i, /masscan/i, /dirbuster/i, /acunetix/i],
  BLOCKED_PATH: [
    /^\/\.env/i, /^\/\.git/i, /^\/wp-admin/i, /^\/wp-login/i, /^\/phpmyadmin/i,
    /^\/admin\.php/i, /^\/xmlrpc\.php/i, /\.\.\//, /%2e%2e/i,
    /<script/i, /javascript:/i, /\/etc\/passwd/i,
    /^\/server\.js$/i, /^\/package\.json$/i, /^\/package-lock\.json$/i,
    /^\/waf-rules\.json$/i, /^\/cdn-edge\.json$/i, /^\/\.npmrc/i, /^\/prisma\.sqlite/i
  ],
  CRS_PATTERNS: [
    /(?:<script|javascript:|onerror\s*=|onload\s*=)/i,
    /(?:\$\{|\{\{)/,
    /(?:;\s*(?:cat|wget|curl|bash|cmd)\b)/i,
    /(?:\/etc\/passwd|\/proc\/self)/i
  ]
};

function clientIp(req){
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const real = String(req.headers['x-real-ip'] || '').trim();
  return xf || real || req.socket?.remoteAddress || 'unknown';
}

function applySecurityHeaders(res){
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    "connect-src 'self'",
    "worker-src 'self' blob:"
  ].join('; '));
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Prisma-WAF', '1');
}

function checkApiRate(req, pathname){
  const ip = clientIp(req);
  const isAuth = pathname.startsWith('/api/auth');
  const max = isAuth ? WAF.AUTH_RATE_MAX : WAF.API_RATE_MAX;
  const key = (isAuth ? 'auth:' : 'api:') + ip;
  const nowMs = Date.now();
  let arr = (apiRateBuckets.get(key) || []).filter(t => nowMs - t < WAF.API_RATE_WINDOW_MS);
  if (arr.length >= max) {
    apiRateBuckets.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((WAF.API_RATE_WINDOW_MS - (nowMs - arr[0])) / 1000) };
  }
  arr.push(nowMs);
  apiRateBuckets.set(key, arr);
  return { ok: true };
}

function wafInspect(req){
  const url = String(req.url || '');
  const pathOnly = url.split('?')[0];
  if (pathOnly.length > WAF.MAX_PATH) {
    return { block: true, code: 414, reason: 'URI muito longa' };
  }
  let decoded = pathOnly;
  try { decoded = decodeURIComponent(pathOnly); } catch (_) {}
  if (decoded.includes('\0') || decoded.includes('..')) {
    return { block: true, code: 400, reason: 'Requisição inválida' };
  }
  for (const re of WAF.BLOCKED_PATH) {
    if (re.test(pathOnly) || re.test(decoded) || re.test(url)) {
      return { block: true, code: 403, reason: 'Bloqueado pela política de segurança' };
    }
  }
  const ua = String(req.headers['user-agent'] || '');
  if (ua && ua.length >= 3) {
    for (const re of WAF.BLOCKED_UA) {
      if (re.test(ua)) return { block: true, code: 403, reason: 'Cliente não permitido' };
    }
  }
  const m = String(req.method || 'GET').toUpperCase();
  if (['TRACE', 'TRACK', 'CONNECT'].includes(m)) {
    return { block: true, code: 405, reason: 'Método não permitido' };
  }
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const hay = pathOnly + ' ' + decoded + ' ' + q;
  for (const re of (WAF.CRS_PATTERNS || [])) {
    if (re.test(hay)) {
      return { block: true, code: 403, reason: 'Bloqueado por política OWASP CRS' };
    }
  }
  return { block: false };
}

function wafInspectBody(obj, pathname) {
  if (!obj || typeof obj !== 'object') return { block: false };
  const samples = [];
  const auth = typeof pathname === 'string' && pathname.startsWith('/api/auth');
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string' && v.length < (auth ? 2000 : 500)) samples.push(v);
  }
  const hay = samples.join('\n');
  for (const re of (WAF.CRS_PATTERNS || [])) {
    if (re.test(hay)) return { block: true, code: 403, reason: 'Bloqueado por política OWASP CRS (payload)' };
  }
  return { block: false };
}

function now(){ return new Date().toISOString(); }
function uid(p = ''){ return p + crypto.randomUUID(); }
function safeJson(v, f = {}){ try { return JSON.stringify(v ?? f); } catch { return JSON.stringify(f); } }
function parseJson(v, f){ try { return JSON.parse(v); } catch { return f; } }

// Criptografia de senhas: salt seguro de 16 bytes + derivação scrypt de 64 bytes
function hashPassword(p){
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(p, salt, 64).toString('hex')}`;
}
function verifyPassword(p, s){
  try {
    const [scheme, salt, expected] = String(s || '').split(':');
    if (scheme !== 'scrypt' || !salt || !expected) return false;
    const a = crypto.scryptSync(p, salt, 64);
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function cookies(h = ''){
  return Object.fromEntries(
    h.split(';')
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => {
        const i = x.indexOf('=');
        return [i < 0 ? x : decodeURIComponent(x.slice(0, i)), i < 0 ? '' : decodeURIComponent(x.slice(i + 1))];
      })
  );
}

function publicUser(u){
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    avatarUrl: u.avatarUrl || null,
    authMethod: u.authMethod || 'password',
    status: u.status,
    role: u.role || 'USER',
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}

function negotiateEncoding(req){
  const ae = String(req && req.headers && req.headers['accept-encoding'] || '').toLowerCase();
  if (ae.includes('br')) return 'br';
  if (ae.includes('gzip')) return 'gzip';
  return null;
}

function compressBuffer(buf, encoding, mode = 'api'){
  if (!buf || !buf.length) return { body: buf, encoding: null };
  const isStatic = mode === 'static';
  if (encoding === 'br') {
    let q = 3;
    if (isStatic) q = buf.length > 100 * 1024 ? 6 : 5;
    return {
      body: zlib.brotliCompressSync(buf, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: q,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
        }
      }),
      encoding: 'br'
    };
  }
  if (encoding === 'gzip') {
    const level = isStatic ? 7 : 4;
    return { body: zlib.gzipSync(buf, { level }), encoding: 'gzip' };
  }
  return { body: buf, encoding: null };
}

function send(res, status, data, extra = {}, req){
  const json = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    ...extra
  };
  const encoding = negotiateEncoding(req || res.__req);
  if (encoding && json.length >= 256) {
    try {
      const packed = compressBuffer(Buffer.from(json, 'utf8'), encoding);
      if (packed.encoding && packed.body.length < json.length) {
        headers['Content-Encoding'] = packed.encoding;
        headers['Vary'] = 'Accept-Encoding';
        headers['Content-Length'] = packed.body.length;
        res.writeHead(status, headers);
        return res.end(packed.body);
      }
    } catch (_) {}
  }
  headers['Content-Length'] = Buffer.byteLength(json);
  res.writeHead(status, headers);
  res.end(json);
}

function err(res, status, msg){ send(res, status, { ok: false, error: msg }); }

async function body(req){
  let n = 0, a = [];
  for await (const c of req) {
    n += c.length;
    if (n > MAX_BODY) throw Error('Payload muito grande.');
    a.push(c);
  }
  const s = Buffer.concat(a).toString();
  return s ? JSON.parse(s) : {};
}

async function bodyWaf(req, pathname){
  const data = await body(req);
  const w = wafInspectBody(data, pathname || '');
  if (w.block) {
    const e = new Error(w.reason || 'Bloqueado');
    e.statusCode = w.code || 403;
    e.waf = true;
    throw e;
  }
  return data;
}

function sameOrigin(req){
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

function session(user, res){
  const token = crypto.randomBytes(32).toString('base64url');
  const stamp = now();
  const exp = Date.now() + SESSION_TTL;
  stmtInsertSession.run(token, user.id, exp, stamp);
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `prisma_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${SESSION_TTL / 1000}`);
}

function clearSession(res){
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `prisma_session=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`);
}

function auth(req){
  const token = cookies(req.headers.cookie || '').prisma_session;
  if (!token) return null;
  const s = stmtGetSession.get(token);
  if (!s || s.expires_at <= Date.now()) {
    if (s) stmtDeleteSession.run(token);
    return null;
  }
  const u = dbGetUserById(s.user_id);
  if (!u || u.status !== 'active') {
    stmtDeleteSession.run(token);
    return null;
  }
  stmtUpdateSessionLastSeen.run(now(), token);
  return u;
}

function audit(user, entityType, entityId, action, before = null, after = null){
  console.log('[AUDIT]', JSON.stringify({
    id: uid('audit_'),
    userId: user?.id || null,
    entityType,
    entityId,
    action,
    before,
    after,
    createdAt: now()
  }));
}

function normalizeHealthScore(value){
  if (!value || typeof value !== 'object') return null;
  const score = Number(value.score);
  if (!Number.isFinite(score)) return null;
  const numberOrZero = val => { const n = Number(val); return Number.isFinite(n) ? n : 0; };
  const periods = ['7d', '30d', '3m', '6m', '1y', 'all'];
  return {
    score: Math.max(5, Math.min(100, Math.round(score))),
    taxaPoupanca: numberOrZero(value.taxaPoupanca),
    percentualEssencial: numberOrZero(value.percentualEssencial),
    economiaPotencialTotal: numberOrZero(value.economiaPotencialTotal),
    period: periods.includes(value.period) ? value.period : '30d'
  };
}

function defaultState(){
  return {
    receitas: [],
    despesas: [],
    contas: [],
    cartoes: [],
    investimentos: [],
    goals: [],
    categories: [],
    summary: { saldoAtual: 0, salarioMensal: 0 },
    monthlyFlow: { inc: Array(12).fill(0), exp: Array(12).fill(0) },
    education: { completed: [], points: 0, challengeDone: false },
    notifications: [],
    prismaAi: {
      analysis: null,
      recommendations: [],
      savingsPlan: [],
      healthScore: null,
      history: []
    }
  };
}

function normalizeState(s, baseState = null){
  const d = baseState || defaultState();
  const x = s && typeof s === 'object' ? s : {};
  const baseAi = d.prismaAi || defaultState().prismaAi;
  const ai = x.prismaAi && typeof x.prismaAi === 'object' ? x.prismaAi : null;
  return {
    receitas: Array.isArray(x.receitas) ? x.receitas : (baseState ? baseState.receitas : []),
    despesas: Array.isArray(x.despesas) ? x.despesas : (baseState ? baseState.despesas : []),
    contas: Array.isArray(x.contas) ? x.contas : (baseState ? baseState.contas : []),
    cartoes: Array.isArray(x.cartoes) ? x.cartoes : (baseState ? baseState.cartoes : []),
    investimentos: Array.isArray(x.investimentos) ? x.investimentos : (baseState ? baseState.investimentos : []),
    goals: Array.isArray(x.goals) ? x.goals : (baseState ? baseState.goals : []),
    categories: Array.isArray(x.categories) ? x.categories : (baseState ? baseState.categories : []),
    summary: x.summary && typeof x.summary === 'object' ? x.summary : d.summary,
    monthlyFlow: x.monthlyFlow && typeof x.monthlyFlow === 'object' ? x.monthlyFlow : d.monthlyFlow,
    education: x.education && typeof x.education === 'object' ? x.education : d.education,
    notifications: Array.isArray(x.notifications) ? x.notifications.slice(0, 100) : (baseState ? baseState.notifications : []),
    prismaAi: ai ? {
      analysis: ai.analysis !== undefined ? ai.analysis : baseAi.analysis,
      recommendations: Array.isArray(ai.recommendations) ? ai.recommendations : baseAi.recommendations,
      savingsPlan: Array.isArray(ai.savingsPlan) ? ai.savingsPlan : baseAi.savingsPlan,
      healthScore: ai.healthScore !== undefined ? normalizeHealthScore(ai.healthScore) : baseAi.healthScore,
      history: Array.isArray(ai.history) ? ai.history : baseAi.history
    } : baseAi
  };
}

function readState(userId){
  const row = stmtGetUserState.get(userId);
  if (!row || !row.state_json) return defaultState();
  return parseJson(row.state_json, defaultState());
}

function syncState(userId, s){
  const current = readState(userId);
  const normalized = normalizeState(s, current);
  stmtUpsertUserState.run(userId, safeJson(normalized), now());
  return normalized;
}

function validateRegistration(b){
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (name.length < 2) return Error('Nome inválido (mínimo de 2 caracteres).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Error('E-mail inválido.');
  if (password.length < 8) return Error('A senha deve ter pelo menos 8 caracteres.');
  return { name, email, password };
}

function loginLimiterKey(req, email){
  return String(req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '') + '|' + String(email || '').toLowerCase();
}

function allowLoginAttempt(req, email){
  const key = loginLimiterKey(req, email);
  const n = Date.now();
  const arr = (loginAttempts.get(key) || []).filter(t => n - t < 15 * 60 * 1000);
  if (arr.length >= 10) {
    loginAttempts.set(key, arr);
    return false;
  }
  arr.push(n);
  loginAttempts.set(key, arr);
  return true;
}

function clearLoginAttempts(req, email){
  loginAttempts.delete(loginLimiterKey(req, email));
}

function hashToken(raw){
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex');
}

function requireAdmin(user, res){
  if (!user) return err(res, 401, 'Autenticação necessária.');
  if (user.role !== 'ADMIN') return err(res, 403, 'Acesso administrativo negado.');
  return true;
}

function bootstrapAdmin(){
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (email && password) {
    const existing = dbGetUserByEmail(email);
    if (!existing) {
      const t = now();
      const u = {
        id: uid('user_'),
        name: process.env.ADMIN_NAME || 'Administrador',
        email,
        password_hash: hashPassword(password),
        phone: null,
        avatarUrl: null,
        authMethod: 'password',
        status: 'active',
        role: 'ADMIN',
        lastLoginAt: null,
        createdAt: t,
        updatedAt: t
      };
      dbCreateUser(u);
      syncState(u.id, defaultState());
      console.log(`[BOOTSTRAP] Administrador inicial persistido no SQLite: ${email}`);
    } else if (existing.role !== 'ADMIN') {
      existing.role = 'ADMIN';
      existing.updatedAt = now();
      dbUpdateUser(existing);
      console.log(`[BOOTSTRAP] Usuário promovido a Administrador no SQLite: ${email}`);
    }
  } else {
    console.log('[BOOTSTRAP] Banco SQLite pronto. Usuários cadastrados persistem em prisma.sqlite.');
  }
}
bootstrapAdmin();

const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
const EMAIL_FROM = String(process.env.EMAIL_FROM || '').trim();
const EMAIL_FROM_NAME = String(process.env.EMAIL_FROM_NAME || 'Prisma').trim() || 'Prisma';
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASSWORD = String(process.env.SMTP_PASSWORD || '');
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true' || SMTP_PORT === 465;
const SMTP_TIMEOUT = Number(process.env.SMTP_TIMEOUT_MS || 15000);
const PDF_MAX_BYTES = Number(process.env.PDF_MAX_BYTES || 10 * 1024 * 1024);
const PDF_ROOT = path.resolve(ROOT, 'conteudos', 'educacao-financeira');
const PDF_SEND_PER_MINUTE = Number(process.env.PDF_SEND_PER_MINUTE || 3);
const PDF_SEND_PER_DAY = Number(process.env.PDF_SEND_PER_DAY || 20);

function emailConfigured(){
  return EMAIL_PROVIDER === 'smtp' && !!(EMAIL_FROM && SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD);
}

function encodeHeaderUtf8(s){
  return `=?UTF-8?B?${Buffer.from(String(s), 'utf8').toString('base64')}?=`;
}

function safePdfPath(relative){
  const raw = String(relative || '');
  if (!raw || raw.includes('\0') || raw.includes('..') || raw.startsWith('/') || raw.includes('\\')) return null;
  const full = path.resolve(ROOT, raw);
  if (!full.startsWith(PDF_ROOT + path.sep) || !full.toLowerCase().endsWith('.pdf')) return null;
  return full;
}

function validatePdfFile(filePath){
  if (!filePath || !fs.existsSync(filePath)) throw Error('PDF não encontrado.');
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size <= 0 || st.size > PDF_MAX_BYTES) throw Error('PDF inválido.');
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(5);
  fs.readSync(fd, head, 0, 5, 0);
  fs.closeSync(fd);
  if (head.toString() !== '%PDF-') throw Error('Arquivo PDF inválido.');
  return st.size;
}

function smtpRead(socket, expected){
  return new Promise((resolve, reject) => {
    let buf = '', timer;
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onErr);
      socket.off('close', onClose);
    };
    const done = (fn, v) => { cleanup(); fn(v); };
    const onErr = e => done(reject, e);
    const onClose = () => done(reject, new Error('Conexão SMTP encerrada.'));
    const onData = chunk => {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      const last = lines.filter(Boolean).pop() || '';
      if (!last) return;
      const code = Number(last.slice(0, 3));
      if (expected && !expected.includes(code)) return done(reject, new Error(`SMTP ${code}: ${last.slice(4)}`));
      if (/^[0-9]{3} /.test(last)) done(resolve, lines.filter(Boolean).join('\n'));
    };
    socket.on('data', onData);
    socket.on('error', onErr);
    socket.on('close', onClose);
    timer = setTimeout(() => done(reject, new Error('Tempo limite do servidor de e-mail.')), SMTP_TIMEOUT);
  });
}

async function smtpCommand(socket, command, expected){
  socket.write(command + '\r\n');
  return smtpRead(socket, expected);
}

async function sendSmtpEmail({ to, subject, text, html, filename, attachment }){
  if (!emailConfigured()) throw Error('Serviço de e-mail não configurado.');
  let socket = SMTP_SECURE ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST }) : net.connect({ host: SMTP_HOST, port: SMTP_PORT });
  socket.setTimeout(SMTP_TIMEOUT, () => socket.destroy(new Error('Tempo limite do servidor de e-mail.')));
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('secureConnect', resolve); socket.once('error', reject); });
  await smtpRead(socket, [220]);
  const hostname = SMTP_HOST || 'prisma.local';
  let ehlo = await smtpCommand(socket, `EHLO ${hostname}`, [250]);
  if (!SMTP_SECURE && /STARTTLS/i.test(ehlo)) {
    await smtpCommand(socket, 'STARTTLS', [220]);
    socket = tls.connect({ socket, host: SMTP_HOST, servername: SMTP_HOST });
    await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
    ehlo = await smtpCommand(socket, `EHLO ${hostname}`, [250]);
  }
  if (/AUTH/i.test(ehlo)) {
    if (/PLAIN/i.test(ehlo)) {
      const token = Buffer.from(`\0${SMTP_USER}\0${SMTP_PASSWORD}`, 'utf8').toString('base64');
      await smtpCommand(socket, `AUTH PLAIN ${token}`, [235]);
    } else if (/LOGIN/i.test(ehlo)) {
      await smtpCommand(socket, 'AUTH LOGIN', [334]);
      await smtpCommand(socket, Buffer.from(SMTP_USER).toString('base64'), [334]);
      await smtpCommand(socket, Buffer.from(SMTP_PASSWORD).toString('base64'), [235]);
    } else {
      throw Error('Servidor SMTP sem método de autenticação compatível.');
    }
  } else {
    throw Error('Servidor SMTP sem autenticação disponível.');
  }
  await smtpCommand(socket, `MAIL FROM:<${EMAIL_FROM}>`, [250]);
  await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
  await smtpCommand(socket, 'DATA', [354]);
  const boundary = `----=_Prisma_${crypto.randomUUID().replace(/-/g, '')}`;
  const messageId = `<${crypto.randomUUID()}@${EMAIL_FROM.split('@')[1] || 'prisma.local'}>`;
  const b64 = attachment ? (Buffer.from(attachment).toString('base64').match(/.{1,76}/g) || []).join('\r\n') : '';
  const parts = [
    `From: ${encodeHeaderUtf8(EMAIL_FROM_NAME)} <${EMAIL_FROM}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeaderUtf8(subject)}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    attachment ? `Content-Type: multipart/mixed; boundary="${boundary}"` : `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html
  ];
  if (attachment) {
    parts.push(
      '',
      `--${boundary}`,
      'Content-Type: application/pdf',
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${String(filename || 'material.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      '',
      b64
    );
  }
  parts.push('', `--${boundary}--`, '');
  socket.write(parts.join('\r\n').replace(/^\./gm, '..') + '\r\n.\r\n');
  await smtpRead(socket, [250]);
  await smtpCommand(socket, 'QUIT', [221]);
  socket.end();
  return messageId;
}

async function sendPasswordResetEmail({ user, link }){
  return sendSmtpEmail({
    to: user.email,
    subject: 'Redefinição de senha — Prisma',
    text: `Olá, ${user.name}!\n\nAcesse o link para redefinir sua senha:\n${link}\n\nO link é válido por 30 minutos.`,
    html: `<p>Olá, ${user.name}!</p><p>Acesse o link para redefinir sua senha:</p><p><a href="${link}">${link}</a></p><p>O link é válido por 30 minutos.</p>`
  });
}

async function sendEducationPdfEmail({ user, content }){
  const filePath = safePdfPath(content.pdfPath);
  validatePdfFile(filePath);
  const attachment = fs.readFileSync(filePath);
  return sendSmtpEmail({
    to: user.email,
    subject: `${content.title} — Prisma`,
    text: `Olá, ${user.name}!\n\nSegue o material "${content.title}" em PDF.`,
    html: `<p>Olá, ${user.name}!</p><p>Segue o material <strong>${content.title}</strong> em PDF.</p>`,
    filename: path.basename(filePath),
    attachment
  });
}

function educationContents(){
  const files = fs.existsSync(PDF_ROOT) ? fs.readdirSync(PDF_ROOT).filter(f => f.toLowerCase().endsWith('.pdf')).sort() : [];
  return files.map((file, i) => ({
    id: `education_${i + 1}`,
    title: file.replace(/\.pdf$/i, '').replace(/^\d+[-_]/, '').replace(/[-_]/g, ' '),
    description: 'Material de educação financeira do Prisma.',
    level: 'iniciante',
    durationMinutes: 15,
    category: 'Educação Financeira',
    hasPdf: true,
    pdfPath: path.posix.join('conteudos/educacao-financeira', file)
  }));
}

function staticFile(req, res, p){
  const target = path.resolve(ROOT, '.' + decodeURIComponent(p === '/' ? '/index.html' : p));
  if (!target.startsWith(ROOT + path.sep)) return err(res, 403, 'Acesso negado.');
  const base = path.basename(target).toLowerCase();
  if (['server.js', 'package.json', 'package-lock.json', 'waf-rules.json', 'cdn-edge.json', '.env', '.git', 'prisma.sqlite', 'prisma.sqlite-wal', 'prisma.sqlite-shm'].includes(base)) {
    return err(res, 403, 'Acesso negado.');
  }
  fs.stat(target, (e, st) => {
    if (e || !st.isFile()) return err(res, 404, 'Arquivo não encontrado.');
    const ext = path.extname(target).toLowerCase();
    const ct = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.pdf': 'application/pdf'
    }[ext] || 'application/octet-stream';

    const isImmutableAsset = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'].includes(ext);
    const isVersioned = String(req.url || '').includes('?v=') || String(req.url || '').includes('&v=');
    let cacheMode;
    if (isImmutableAsset) {
      cacheMode = isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, stale-while-revalidate=86400';
    } else if (ext === '.pdf') {
      cacheMode = 'public, max-age=86400, stale-while-revalidate=3600';
    } else if (ext === '.html') {
      cacheMode = 'no-cache';
    } else if (ext === '.css' || ext === '.js') {
      cacheMode = isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300, must-revalidate';
    } else {
      cacheMode = 'public, max-age=3600';
    }

    const compressible = ['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.map'].includes(ext);
    const encoding = compressible && st.size >= 512 ? negotiateEncoding(req) : null;
    const etagBase = st.size.toString(16) + '-' + Number(st.mtimeMs).toString(16);
    const etag = 'W/"' + etagBase + (encoding ? '-' + encoding : '') + '"';

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': cacheMode, 'Vary': 'Accept-Encoding' });
      return res.end();
    }

    let cdnCache;
    if (isImmutableAsset) {
      cdnCache = isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=2592000';
    } else if (ext === '.pdf') {
      cdnCache = 'public, max-age=604800';
    } else if (ext === '.html') {
      cdnCache = 'max-age=60, stale-while-revalidate=30';
    } else if (ext === '.css' || ext === '.js') {
      cdnCache = isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';
    } else {
      cdnCache = 'public, max-age=3600';
    }

    const headers = {
      'Content-Type': ct,
      'Cache-Control': cacheMode,
      'CDN-Cache-Control': cdnCache,
      'Cloudflare-CDN-Cache-Control': cdnCache,
      'ETag': etag,
      'Last-Modified': st.mtime.toUTCString(),
      'Vary': 'Accept-Encoding'
    };

    if (!encoding) {
      headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      return fs.createReadStream(target).pipe(res);
    }

    headers['Content-Encoding'] = encoding;
    res.writeHead(200, headers);
    const raw = fs.createReadStream(target);
    const brQ = st.size > 100 * 1024 ? 6 : 5;
    const transform = encoding === 'br'
      ? zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: brQ,
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
          }
        })
      : zlib.createGzip({ level: 7 });

    raw.on('error', () => { try { res.destroy(); } catch (_) {} });
    transform.on('error', () => { try { res.destroy(); } catch (_) {} });
    raw.pipe(transform).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    res.__req = req;
    applySecurityHeaders(res);
    const waf = wafInspect(req);
    if (waf.block) {
      res.setHeader('X-Prisma-WAF-Action', 'block');
      return err(res, waf.code || 403, waf.reason || 'Bloqueado');
    }

    const origin = String(req.headers.origin || '');
    const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if (!sameOrigin(req) && !isLocalOrigin) return err(res, 403, 'Origem não permitida.');
    if (origin && isLocalOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return send(res, 204, {});

    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = u.pathname;
    const m = req.method;

    if (p.startsWith('/api/')) {
      const rl = checkApiRate(req, p);
      if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter || 60));
        res.setHeader('X-Prisma-WAF-Action', 'rate-limit');
        return err(res, 429, 'Muitas requisições. Tente novamente em instantes.');
      }
    }

    // Limpeza de sessões expiradas periodicamente no SQLite
    stmtCleanExpiredSessions.run(Date.now());

    // 1. Health check com status de persistência em SQLite
    if (p === '/api/health' && m === 'GET') {
      return send(res, 200, {
        ok: true,
        database: 'sqlite',
        storage: 'persistent',
        databasePath: DB_PATH,
        emailConfigured: emailConfigured(),
        message: 'Servidor Prisma em execução com persistência real em banco de dados SQLite.'
      });
    }

    // 2. Auth me
    if (p === '/api/auth/me' && m === 'GET') {
      const u1 = auth(req);
      return send(res, 200, {
        authenticated: !!u1,
        user: u1 ? publicUser(u1) : null,
        requiresLgpd: u1 ? !userHasValidLgpdConsent(u1.id) : false,
        currentPolicyVersion: CURRENT_LGPD_POLICY_VERSION
      });
    }

    // 3. Auth Register (Criação real no banco de dados SQLite com scrypt)
    if (p === '/api/auth/register' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const v = validateRegistration(b);
      if (v instanceof Error) return err(res, 400, v.message);

      const existingUser = dbGetUserByEmail(v.email);
      if (existingUser) return err(res, 409, 'Este e-mail já está cadastrado.');

      const t = now();
      const idu = uid('user_');
      const u1 = {
        id: idu,
        name: v.name,
        email: v.email,
        password_hash: hashPassword(v.password),
        phone: null,
        avatarUrl: null,
        authMethod: 'password',
        status: 'active',
        role: 'USER',
        lastLoginAt: t,
        createdAt: t,
        updatedAt: t
      };

      dbCreateUser(u1);
      const initialState = syncState(idu, defaultState());
      session(u1, res);
      audit(u1, 'auth', u1.id, 'register');

      return send(res, 201, {
        ok: true,
        user: publicUser(u1),
        state: initialState,
        requiresLgpd: true,
        currentPolicyVersion: CURRENT_LGPD_POLICY_VERSION
      });
    }

    // 4. Auth Login (Validação contra banco SQLite com verificação scrypt)
    if (p === '/api/auth/login' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');

      if (!allowLoginAttempt(req, email)) {
        return err(res, 429, 'Muitas tentativas de login. Tente novamente mais tarde.');
      }

      const u1 = dbGetUserByEmail(email);
      if (!u1 || u1.status !== 'active' || !verifyPassword(password, u1.password_hash)) {
        return err(res, 401, 'E-mail ou senha inválidos.');
      }

      clearLoginAttempts(req, email);
      stmtDeleteUserSessions.run(u1.id);

      u1.lastLoginAt = now();
      u1.updatedAt = now();
      dbUpdateUser(u1);

      session(u1, res);
      audit(u1, 'auth', u1.id, 'login');

      return send(res, 200, {
        ok: true,
        user: publicUser(u1),
        state: readState(u1.id),
        requiresLgpd: !userHasValidLgpdConsent(u1.id),
        currentPolicyVersion: CURRENT_LGPD_POLICY_VERSION
      });
    }

    // 5. Auth Logout
    if (p === '/api/auth/logout' && m === 'POST') {
      const u = auth(req);
      if (u) {
        stmtDeleteUserSessions.run(u.id);
        audit(u, 'auth', u.id, 'logout');
      }
      const t = cookies(req.headers.cookie || '').prisma_session;
      if (t) stmtDeleteSession.run(t);
      clearSession(res);
      return send(res, 200, { ok: true, message: 'Sessão encerrada com sucesso.' });
    }

    // 6. Forgot Password
    if (p === '/api/auth/forgot-password' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return send(res, 200, { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
      }
      const user = dbGetUserByEmail(email);
      if (user && emailConfigured()) {
        const raw = crypto.randomBytes(32).toString('base64url');
        stmtInsertResetToken.run(hashToken(raw), user.id, Date.now() + 30 * 60 * 1000, now());
        const base = String(process.env.APP_BASE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost'}`).replace(/\/$/, '');
        try {
          await sendPasswordResetEmail({ user, link: `${base}/?reset_token=${encodeURIComponent(raw)}` });
        } catch (e) {
          console.error('[PASSWORD_RESET]', e.message);
        }
      } else if (user) {
        return send(res, 200, { ok: true, message: 'Serviço de e-mail não configurado. Contate o suporte para redefinir sua senha.' });
      }
      return send(res, 200, { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
    }

    // 7. Reset Password
    if (p === '/api/auth/reset-password' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const token = String(b.token || '');
      const password = String(b.password || '');
      if (token.length < 20 || password.length < 8) return err(res, 400, 'Dados inválidos.');

      const tokenHash = hashToken(token);
      const row = stmtGetResetToken.get(tokenHash);
      if (!row || row.expires_at <= Date.now()) return err(res, 400, 'Token inválido ou expirado.');

      const user = dbGetUserById(row.user_id);
      if (!user || user.status !== 'active') return err(res, 400, 'Token inválido ou expirado.');

      user.password_hash = hashPassword(password);
      user.updatedAt = now();
      dbUpdateUser(user);

      stmtDeleteResetToken.run(tokenHash);
      stmtDeleteUserSessions.run(user.id);

      return send(res, 200, { ok: true });
    }

    // Proteção de rotas privadas
    const u1 = auth(req);
    if (!u1 && p.startsWith('/api/')) return err(res, 401, 'Autenticação necessária.');

    // 8. LGPD — Consultar consentimento atual
    if (p === '/api/lgpd/consent' && m === 'GET') {
      const row = stmtGetLatestLgpdConsent.get(u1.id);
      const consent = sanitizeLgpdConsent(row);
      return send(res, 200, {
        ok: true,
        hasConsent: userHasValidLgpdConsent(u1.id),
        currentPolicyVersion: CURRENT_LGPD_POLICY_VERSION,
        consent
      });
    }

    // 8b. LGPD — Registrar consentimento
    if (p === '/api/lgpd/consent' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const essential = b.essentialAccepted !== false; // essencial sempre true (base legal: contrato)
      const communications = Boolean(b.communicationsConsent);
      const analytics = Boolean(b.analyticsConsent);
      const openFinance = Boolean(b.openFinanceConsent);
      const choices = {
        essential: { accepted: essential, label: 'Operação essencial do sistema', basis: 'Execução de contrato (Art. 7º, V, LGPD)' },
        communications: { accepted: communications, label: 'Alertas e comunicações financeiras', basis: 'Consentimento (Art. 7º, I, LGPD)' },
        analytics: { accepted: analytics, label: 'Análise preditiva e personalização Prisma AI', basis: 'Consentimento (Art. 7º, I, LGPD)' },
        openFinance: { accepted: openFinance, label: 'Sandbox Open Finance', basis: 'Consentimento (Art. 7º, I, LGPD)' }
      };
      const ip = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '') || null;
      const ua = String(req.headers['user-agent'] || '').slice(0, 500) || null;
      const t = now();
      const consentId = uid('lgpd_');
      stmtInsertLgpdConsent.run(
        consentId, u1.id,
        CURRENT_LGPD_POLICY_VERSION, CURRENT_TERMS_VERSION,
        essential ? 1 : 0, communications ? 1 : 0, analytics ? 1 : 0, openFinance ? 1 : 0,
        safeJson(choices, {}), ip, ua, t, t
      );
      audit(u1, 'lgpd', consentId, 'consent_recorded', null, choices);
      return send(res, 200, {
        ok: true,
        consent: sanitizeLgpdConsent(stmtGetLatestLgpdConsent.get(u1.id))
      });
    }

    // 8c. LGPD — Histórico de consentimentos
    if (p === '/api/lgpd/history' && m === 'GET') {
      const rows = stmtGetLgpdHistory.all(u1.id);
      return send(res, 200, {
        ok: true,
        history: rows.map(sanitizeLgpdConsent)
      });
    }

    // 9. Estado financeiro
    if (p === '/api/state' && m === 'GET') {
      return send(res, 200, { ok: true, user: publicUser(u1), ...readState(u1.id) });
    }
    if (p === '/api/state' && m === 'PUT') {
      const incoming = await bodyWaf(req, p);
      const updated = syncState(u1.id, incoming);
      return send(res, 200, { ok: true, user: publicUser(u1), ...updated });
    }

    // 9. Prisma AI
    if (p === '/api/prisma-ai/state' && m === 'GET') {
      return send(res, 200, { ok: true, prismaAi: readState(u1.id).prismaAi });
    }
    if (p === '/api/prisma-ai/plan' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const s = readState(u1.id);
      s.prismaAi = s.prismaAi || { analysis: null, recommendations: [], savingsPlan: [], history: [] };
      s.prismaAi.savingsPlan = Array.isArray(b.savingsPlan) ? b.savingsPlan : s.prismaAi.savingsPlan;
      if (Array.isArray(b.history)) s.prismaAi.history = b.history;
      syncState(u1.id, s);
      return send(res, 200, { ok: true, savingsPlan: s.prismaAi.savingsPlan });
    }
    if (p === '/api/prisma-ai/analysis' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const s = readState(u1.id);
      s.prismaAi = s.prismaAi || { analysis: null, recommendations: [], savingsPlan: [], history: [] };
      s.prismaAi.analysis = b.analysis || null;
      if (Array.isArray(b.recommendations)) s.prismaAi.recommendations = b.recommendations;
      if (b.healthScore !== undefined) s.prismaAi.healthScore = normalizeHealthScore(b.healthScore);
      syncState(u1.id, s);
      return send(res, 200, { ok: true });
    }

    // 10. Perfil do usuário logado
    if (p === '/api/me' && m === 'PUT') {
      const b = await bodyWaf(req, p);
      const name = String(b.name || u1.name).trim();
      if (name.length < 2) return err(res, 400, 'Nome inválido.');
      u1.name = name;
      u1.phone = b.phone ?? u1.phone;
      u1.avatarUrl = b.avatarUrl ?? u1.avatarUrl;
      u1.updatedAt = now();
      dbUpdateUser(u1);
      return send(res, 200, { ok: true, user: publicUser(u1) });
    }

    // 11. Exclusão de conta
    if (p === '/api/account' && m === 'DELETE') {
      dbDeleteUser(u1.id);
      clearSession(res);
      return send(res, 200, { ok: true });
    }

    // 12. Notificações
    if (p === '/api/notifications/read-all' && m === 'POST') {
      const s = readState(u1.id);
      s.notifications = (s.notifications || []).map(n => ({ ...n, read: true }));
      syncState(u1.id, s);
      return send(res, 200, { ok: true });
    }

    // 13. Insights
    if (p === '/api/insights' && m === 'GET') {
      const rows = stmtGetInsights.all(u1.id);
      const list = rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        title: r.title,
        description: r.description,
        severity: r.severity,
        relatedData: parseJson(r.related_data_json, {}),
        createdAt: r.created_at
      }));
      return send(res, 200, { ok: true, insights: list });
    }
    if (p === '/api/insights' && m === 'POST') {
      const b = await bodyWaf(req, p);
      const item = {
        id: uid('insight_'),
        userId: u1.id,
        type: b.type || 'contextual',
        title: b.title || 'Insight',
        description: b.description || '',
        severity: b.severity || 'info',
        relatedData: b.relatedData || {},
        createdAt: now()
      };
      stmtInsertInsight.run(
        item.id,
        item.userId,
        item.type,
        item.title,
        item.description,
        item.severity,
        safeJson(item.relatedData),
        item.createdAt
      );
      return send(res, 201, { ok: true, id: item.id });
    }

    // 14. Educação Financeira
    if (p === '/api/education/contents' && m === 'GET') {
      return send(res, 200, { ok: true, contents: educationContents().map(({ pdfPath, ...c }) => c) });
    }
    if (p === '/api/education/pdf/send-email' && m === 'POST') {
      if (!emailConfigured()) {
        return err(res, 503, 'Serviço de e-mail não configurado. Configure EMAIL_PROVIDER e SMTP no ambiente para enviar PDFs por e-mail.');
      }
      const b = await bodyWaf(req, p);
      const reqId = String(b.contentId || '').trim().toLowerCase();
      const cleanReq = reqId.replace(/[^a-z0-9]/g, '');
      const content = educationContents().find(x => {
        const cleanId = x.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanPdf = x.pdfPath.toLowerCase().replace(/[^a-z0-9]/g, '');
        return x.id.toLowerCase() === reqId || (cleanReq && (cleanId === cleanReq || cleanPdf.includes(cleanReq)));
      });
      if (!content) return err(res, 404, 'Material em PDF não encontrado.');

      const historyRows = stmtGetPdfHistory.all(u1.id);
      const minute = Date.now() - 60000;
      const day = Date.now() - 86400000;
      if (historyRows.filter(x => new Date(x.created_at).getTime() >= minute).length >= PDF_SEND_PER_MINUTE) {
        return err(res, 429, 'Limite de envios atingido. Tente novamente em instantes.');
      }
      if (historyRows.filter(x => new Date(x.created_at).getTime() >= day).length >= PDF_SEND_PER_DAY) {
        return err(res, 429, 'Limite diário de envios atingido.');
      }

      let filePath;
      try {
        filePath = safePdfPath(content.pdfPath);
        validatePdfFile(filePath);
      } catch (e) {
        return err(res, 422, 'O material em PDF não está disponível no momento.');
      }

      const item = {
        id: uid('pdfsend_'),
        user_id: u1.id,
        content_id: content.id,
        recipient_email: u1.email,
        pdf_name: path.basename(filePath),
        status: 'sending',
        provider_message_id: null,
        error_message: null,
        sent_at: null,
        created_at: now()
      };

      try {
        item.provider_message_id = await sendEducationPdfEmail({ user: u1, content });
        item.status = 'sent';
        item.sent_at = now();
        stmtInsertPdfHistory.run(
          item.id, item.user_id, item.content_id, item.recipient_email,
          item.pdf_name, item.status, item.provider_message_id, null, item.sent_at, item.created_at
        );
        return send(res, 200, { ok: true, status: 'sent', recipient: u1.email, contentId: content.id, sendId: item.id });
      } catch (e) {
        item.status = 'failed';
        item.error_message = String(e.message || e);
        stmtInsertPdfHistory.run(
          item.id, item.user_id, item.content_id, item.recipient_email,
          item.pdf_name, item.status, null, item.error_message, null, item.created_at
        );
        return err(res, 502, 'Não foi possível enviar o PDF.');
      }
    }
    if (p === '/api/education/pdf/history' && m === 'GET') {
      const rows = stmtGetPdfHistory.all(u1.id);
      return send(res, 200, { ok: true, history: rows });
    }

    // 15. Admin
    if (p.startsWith('/api/admin/')) {
      if (requireAdmin(u1, res) !== true) return;
      if (p === '/api/admin/users' && m === 'GET') {
        const list = dbGetAllUsers();
        return send(res, 200, {
          ok: true,
          users: list.map(x => ({
            id: x.id,
            name: x.name,
            email: x.email,
            role: x.role,
            status: x.status,
            created_at: x.createdAt,
            last_login_at: x.lastLoginAt
          }))
        });
      }
      if (p === '/api/admin/admins' && m === 'POST') {
        const b = await bodyWaf(req, p);
        const email = String(b.email || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) return err(res, 400, 'E-mail inválido.');
        const target = dbGetUserByEmail(email);
        if (!target) return err(res, 404, 'Usuário não encontrado. Cadastre o usuário primeiro e tente novamente.');
        if (target.status !== 'active') return err(res, 400, 'O usuário precisa estar ativo.');
        if (target.role === 'ADMIN') return err(res, 409, 'Este usuário já é administrador.');
        target.role = 'ADMIN';
        target.updatedAt = now();
        dbUpdateUser(target);
        audit(u1, 'user', target.id, 'role_changed', { role: 'USER' }, { role: 'ADMIN' });
        return send(res, 200, { ok: true, user: publicUser(target) });
      }
      if (/^\/api\/admin\/users\/[^/]+\/role$/.test(p) && m === 'PUT') {
        const id = p.split('/')[4];
        const b = await bodyWaf(req, p);
        const role = String(b.role || '').toUpperCase();
        if (!['USER', 'ADMIN'].includes(role)) return err(res, 400, 'Role inválida.');
        const target = dbGetUserById(id);
        if (!target) return err(res, 404, 'Usuário não encontrado.');
        if (target.id === u1.id && role !== 'ADMIN') return err(res, 400, 'Não é permitido remover a própria administração.');
        target.role = role;
        target.updatedAt = now();
        dbUpdateUser(target);
        audit(u1, 'user', id, 'role_changed', null, { role });
        return send(res, 200, { ok: true, user: publicUser(target) });
      }
      if (/^\/api\/admin\/users\/[^/]+\/status$/.test(p) && m === 'PUT') {
        const id = p.split('/')[4];
        const b = await bodyWaf(req, p);
        const status = String(b.status || '').toLowerCase();
        if (!['active', 'blocked'].includes(status)) return err(res, 400, 'Status inválido.');
        const target = dbGetUserById(id);
        if (!target) return err(res, 404, 'Usuário não encontrado.');
        if (target.id === u1.id && status !== 'active') return err(res, 400, 'Não é permitido suspender a própria conta.');
        target.status = status;
        target.updatedAt = now();
        dbUpdateUser(target);
        if (status !== 'active') stmtDeleteUserSessions.run(id);
        return send(res, 200, { ok: true, user: publicUser(target) });
      }
    }

    // Arquivos estáticos
    staticFile(req, res, p);
  } catch (e) {
    if (e && e.waf) return err(res, e.statusCode || 403, e.message || 'Bloqueado');
    console.error(e);
    err(res, 500, e.message || 'Erro interno do servidor.');
  }
});

function startServer(port, attempts = 0){
  const MAX_PORT_TRIES = 10;
  const onError = (e) => {
    server.off('error', onError);
    if (e.code === 'EADDRINUSE' && attempts < MAX_PORT_TRIES) {
      const next = port + 1;
      console.warn(`Porta ${port} já está em uso. Tentando ${next}...`);
      startServer(next, attempts + 1);
      return;
    }
    console.error(`Não foi possível iniciar o backend na porta ${port}.`);
    if (e.code === 'EADDRINUSE') {
      console.error('Todas as portas de fallback estão ocupadas. Feche outro processo Node/Prisma ou defina PORT no ambiente.');
    } else {
      console.error(e);
    }
    process.exitCode = 1;
  };
  server.once('error', onError);
  server.listen(port, () => {
    PORT = port;
    console.log(`Prisma server running on http://localhost:${PORT} — Autenticação Segura com persistência SQLite (${DB_PATH})`);
  });
}

startServer(PORT);
