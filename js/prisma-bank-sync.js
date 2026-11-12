/**
 * Prisma Open Finance — camada Sandbox
 * =====================================
 * NÃO acessa bancos reais nem APIs externas.
 * Dados 100% simulados e DETERMINÍSTICOS (sem drift aleatório).
 *
 * Arquitetura:
 *   OpenFinanceProvider (interface)
 *     └── MockOpenFinanceProvider (implementação atual)
 *
 * Troca futura por RealOpenFinanceProvider (Pluggy/Belvo/backend)
 * sem alterar Dashboard, Centro Financeiro, relatórios ou AI.
 *
 * Fluxo:
 *   listInstitutions → authorizeConsent → connect
 *   → discover accounts → import transactions
 *   → sync (idempotente) → disconnect / revokeConsent
 *
 * Idempotência:
 *   - account.externalId = mock:{userId}:{institutionId}:{tipo}
 *   - tx.externalId      = mock:tx:{accountExternalId}:{day}:{sample}:{i}
 *   - sync reenvia o mesmo extrato; o app só insere o que ainda não existe
 */
(function (global) {
  'use strict';
  const localStorage = global.PrismaStorage || global.localStorage;

  const PROVIDER_ID = 'mock';
  const MODE = 'sandbox';
  const API_VERSION = 'open-finance-sandbox-2';

  const MOCK_INSTITUTIONS = [
    { id: 'nubank', name: 'Nubank', compe: '260', color: '#820AD1', types: ['Corrente', 'Poupança'] },
    { id: 'itau', name: 'Itaú Unibanco', compe: '341', color: '#EC7000', types: ['Corrente', 'Poupança'] },
    { id: 'bb', name: 'Banco do Brasil', compe: '001', color: '#FCD800', types: ['Corrente', 'Poupança'] },
    { id: 'bradesco', name: 'Bradesco', compe: '237', color: '#CC092F', types: ['Corrente'] },
    { id: 'santander', name: 'Santander', compe: '033', color: '#EC0000', types: ['Corrente'] },
    { id: 'inter', name: 'Banco Inter', compe: '077', color: '#FF7A00', types: ['Corrente'] },
    { id: 'c6', name: 'C6 Bank', compe: '336', color: '#1A1A1A', types: ['Corrente'] },
    { id: 'caixa', name: 'Caixa Econômica', compe: '104', color: '#005CA9', types: ['Corrente', 'Poupança'] },
    { id: 'btg', name: 'BTG Pactual', compe: '208', color: '#001E62', types: ['Corrente'] },
    { id: 'xp', name: 'XP Investimentos', compe: '102', color: '#000000', types: ['Investimento'] }
  ];

  const INCOME_SAMPLES = [
    { desc: 'Salário / Proventos', cat: 'Salário', min: 2500, max: 12000 },
    { desc: 'PIX recebido', cat: 'Transferências', min: 50, max: 1500 },
    { desc: 'Rendimento conta', cat: 'Rendimentos', min: 5, max: 80 },
    { desc: 'Reembolso', cat: 'Outros', min: 20, max: 400 }
  ];
  const EXPENSE_SAMPLES = [
    { desc: 'Supermercado', cat: 'Alimentação', min: 40, max: 350 },
    { desc: 'Farmácia', cat: 'Saúde', min: 25, max: 180 },
    { desc: 'Uber / Transporte', cat: 'Transporte', min: 12, max: 90 },
    { desc: 'Streaming', cat: 'Lazer', min: 20, max: 60 },
    { desc: 'Conta de luz', cat: 'Moradia', min: 80, max: 280 },
    { desc: 'Padaria', cat: 'Alimentação', min: 8, max: 45 },
    { desc: 'PIX enviado', cat: 'Transferências', min: 30, max: 500 },
    { desc: 'Restaurante', cat: 'Alimentação', min: 35, max: 160 }
  ];

  /* ---------- util determinístico ---------- */
  function hashStr(s) {
    let h = 0;
    const str = String(s || 'x');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function mockBalance(seed) {
    const h = hashStr(seed);
    return Math.round(((h % 85000) + 1200 + (h % 100) / 100) * 100) / 100;
  }

  function mockAccountNumber(seed) {
    return String(1000 + (hashStr(seed) % 9000));
  }

  function randBetween(min, max, seed) {
    const h = hashStr(String(seed) + String(min) + String(max));
    const t = (h % 10000) / 10000;
    return Math.round((min + t * (max - min)) * 100) / 100;
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function resolveUserScope(userId) {
    if (userId) return String(userId);
    try {
      if (typeof global.currentProfileId !== 'undefined' && global.currentProfileId) {
        return String(global.currentProfileId);
      }
    } catch (_) {}
    try {
      const id = localStorage.getItem('prisma_current_profile_id');
      if (id) return String(id);
    } catch (_) {}
    return 'anon';
  }

  function stableAccountExternalId(userId, institutionId, tipo) {
    const scope = resolveUserScope(userId);
    const t = String(tipo || 'Corrente').toLowerCase().replace(/\s+/g, '-');
    return 'mock:acc:' + scope + ':' + institutionId + ':' + t;
  }

  function stableConnectionId(userId, institutionId) {
    const scope = resolveUserScope(userId);
    return 'mock:conn:' + scope + ':' + institutionId;
  }

  function stableTxExternalId(accountExternalId, i, sampleDesc, dayOffset) {
    return 'mock:tx:' + accountExternalId + ':' + i + ':' + hashStr(sampleDesc + '|' + dayOffset).toString(16);
  }

  /**
   * Extrato mock DETERMINÍSTICO — mesmos IDs em toda sincronização.
   * Nunca usa Date.now()/Math.random() nos IDs.
   */
  function generateMockTransactions(account, days) {
    const daysN = days || 30;
    const list = [];
    const seedBase = account.externalId || account.nome || 'acc';
    const count = 8 + (hashStr(seedBase) % 10);

    for (let i = 0; i < count; i++) {
      const dayOffset = hashStr(seedBase + i) % daysN;
      const isIncome = (hashStr(seedBase + 't' + i) % 5) === 0;
      const sample = isIncome
        ? INCOME_SAMPLES[hashStr(seedBase + 'i' + i) % INCOME_SAMPLES.length]
        : EXPENSE_SAMPLES[hashStr(seedBase + 'e' + i) % EXPENSE_SAMPLES.length];
      const amount = randBetween(sample.min, sample.max, seedBase + '|' + i);
      const externalTxId = stableTxExternalId(seedBase, i, sample.desc, dayOffset);

      list.push({
        externalId: externalTxId,
        accountExternalId: account.externalId,
        connectionId: account.connectionId,
        institutionId: account.institutionId,
        type: isIncome ? 'income' : 'expense',
        descricao: sample.desc + ' (OF sandbox)',
        categoria: sample.cat,
        valor: amount,
        data: daysAgoISO(dayOffset),
        conta: account.nome || account.banco || 'Open Finance',
        status: 'pago',
        source: 'openfinance',
        provider: PROVIDER_ID,
        mode: MODE
      });
    }
    return list;
  }

  /* ---------- Provider interface (contrato estável) ---------- */
  /**
   * @typedef {Object} OpenFinanceProvider
   * @property {string} id
   * @property {string} mode  'sandbox' | 'live'
   * @property {Function} listInstitutions
   * @property {Function} connect
   * @property {Function} syncAccount
   * @property {Function} disconnect
   */

  const MockOpenFinanceProvider = {
    id: PROVIDER_ID,
    mode: MODE,
    apiVersion: API_VERSION,

    listInstitutions() {
      return MOCK_INSTITUTIONS.slice();
    },

    getInstitution(id) {
      return MOCK_INSTITUTIONS.find((i) => i.id === id) || null;
    },

    /**
     * Conecta instituição no sandbox.
     * Contas e connectionId são estáveis por (userId, institutionId).
     * @param {string} institutionId
     * @param {{ userId?: string }} [opts]
     */
    async connect(institutionId, opts) {
      await delay(320 + (hashStr(institutionId) % 180));
      const inst = this.getInstitution(institutionId);
      if (!inst) {
        const err = new Error('Instituição inexistente no sandbox');
        err.code = '404';
        throw err;
      }
      const userId = resolveUserScope(opts && opts.userId);
      const connectionId = stableConnectionId(userId, institutionId);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

      const accounts = (inst.types || ['Corrente']).map((tipo) => {
        const externalId = stableAccountExternalId(userId, institutionId, tipo);
        return {
          externalId,
          connectionId,
          provider: PROVIDER_ID,
          mode: MODE,
          source: 'openfinance',
          institutionId: inst.id,
          institutionName: inst.name,
          nome: inst.name + ' · ' + tipo,
          banco: inst.name,
          tipo: tipo === 'Poupança' ? 'savings' : (tipo === 'Investimento' ? 'investment' : 'checking'),
          tipoLabel: tipo,
          numero: mockAccountNumber(externalId),
          saldo: mockBalance(externalId),
          compe: inst.compe,
          color: inst.color,
          syncStatus: 'connected',
          consentStatus: 'ACTIVE',
          consentExpiresAt: expiresAt,
          lastSyncAt: now,
          userId: userId,
          connectedAt: now
        };
      });

      const transactions = [];
      accounts.forEach((acc) => {
        generateMockTransactions(acc, 30).forEach((tx) => transactions.push(tx));
      });

      return {
        connectionId,
        institutionId: inst.id,
        institutionName: inst.name,
        provider: PROVIDER_ID,
        mode: MODE,
        userId,
        connectedAt: now,
        lastSyncAt: now,
        consent: {
          status: 'AUTHORISED',
          lifecycle: 'ACTIVE',
          expiresAt,
          permissions: ['ACCOUNTS_READ', 'ACCOUNTS_TRANSACTIONS_READ', 'ACCOUNTS_BALANCES_READ']
        },
        accounts,
        transactions
      };
    },

    /**
     * Sincronização idempotente.
     * - Não altera saldo artificialmente
     * - Reenvia o mesmo conjunto determinístico de transações
     * - Caller decide o que inserir (merge por externalId)
     */
    async syncAccount(account) {
      await delay(200 + (hashStr((account && account.externalId) || 'x') % 150));
      if (!account) {
        const err = new Error('Conta inválida');
        err.code = '422';
        throw err;
      }
      const status = String(account.syncStatus || '').toLowerCase();
      const consent = String(account.consentStatus || 'ACTIVE').toUpperCase();
      if (status === 'disconnected' || status === 'revoked' || consent === 'REVOKED') {
        const err = new Error('Conta desconectada ou consentimento revogado. Reconecte a instituição.');
        err.code = '403';
        throw err;
      }
      if (account.consentExpiresAt) {
        const exp = new Date(account.consentExpiresAt).getTime();
        if (Number.isFinite(exp) && exp < Date.now()) {
          const err = new Error('Consentimento expirado. Autorize novamente a instituição.');
          err.code = '401';
          throw err;
        }
      }

      // Saldo estável (mesmo seed) — sem drift aleatório
      const saldo = mockBalance(account.externalId);
      const now = new Date().toISOString();
      const updated = {
        ...account,
        saldo,
        lastSyncAt: now,
        syncStatus: 'connected',
        consentStatus: 'ACTIVE',
        provider: PROVIDER_ID,
        mode: MODE,
        source: 'openfinance'
      };

      // Mesmo extrato determinístico — merge no app evita duplicação
      const transactions = generateMockTransactions(updated, 30);
      return {
        account: updated,
        transactions,
        meta: {
          provider: PROVIDER_ID,
          mode: MODE,
          deterministic: true,
          message: 'Sincronizado (sandbox). Transações com IDs estáveis.'
        }
      };
    },

    async syncAll(accounts) {
      const results = { accounts: [], transactions: [], errors: [] };
      for (const acc of accounts || []) {
        if (!this.isConnected(acc)) continue;
        try {
          const r = await this.syncAccount(acc);
          results.accounts.push(r.account);
          (r.transactions || []).forEach((tx) => results.transactions.push(tx));
        } catch (err) {
          results.errors.push({
            externalId: acc && acc.externalId,
            code: err.code || '500',
            message: err.message || String(err)
          });
        }
      }
      return results;
    },

    async disconnect(account) {
      await delay(120);
      return {
        ...account,
        syncStatus: 'disconnected',
        consentStatus: 'REVOKED',
        source: account.source || 'openfinance',
        provider: PROVIDER_ID,
        mode: MODE,
        lastSyncAt: new Date().toISOString(),
        disconnectedAt: new Date().toISOString()
      };
    },

    isConnected(account) {
      if (!account || account.source !== 'openfinance') return false;
      if (account.syncStatus !== 'connected') return false;
      if (String(account.consentStatus || 'ACTIVE').toUpperCase() === 'REVOKED') return false;
      return true;
    },

    /**
     * Verifica se já existe conta OF da mesma instituição para o usuário.
     */
    findExistingConnection(contasList, institutionId, userId) {
      const scope = resolveUserScope(userId);
      const connId = stableConnectionId(scope, institutionId);
      const list = Array.isArray(contasList) ? contasList : [];
      const matches = list.filter((c) => {
        if (!c || c.source !== 'openfinance') return false;
        if (c.institutionId === institutionId && (c.userId === scope || !c.userId)) return true;
        if (c.connectionId === connId) return true;
        return false;
      });
      return matches.length ? { connectionId: connId, accounts: matches } : null;
    },

    toPrismaLancamento(tx) {
      const base = {
        descricao: tx.descricao,
        categoria: tx.categoria,
        valor: tx.valor,
        data: tx.data,
        conta: tx.conta,
        status: tx.status || 'pago',
        source: 'openfinance',
        externalId: tx.externalId,
        accountExternalId: tx.accountExternalId,
        provider: tx.provider || PROVIDER_ID,
        connectionId: tx.connectionId,
        mode: MODE
      };
      if (tx.type === 'income') {
        return { kind: 'receita', item: base };
      }
      if (tx.type === 'transfer') {
        // Transferência interna: não vira receita+despesa
        return { kind: 'transfer', item: base };
      }
      return {
        kind: 'despesa',
        item: {
          ...base,
          prioridade: 'media',
          formaPagamento: 'pix',
          tipoPagamento: 'avista',
          parcelas: 1
        }
      };
    }
  };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Serviço público = provider mock (interface OpenFinanceProvider)
  const BankSyncService = MockOpenFinanceProvider;

  global.PrismaBankSync = {
    institutions: MOCK_INSTITUTIONS,
    service: BankSyncService,
    provider: MockOpenFinanceProvider,
    MockOpenFinanceProvider,
    mode: MODE,
    version: '2.0.0-sandbox'
  };
})(typeof window !== 'undefined' ? window : globalThis);
