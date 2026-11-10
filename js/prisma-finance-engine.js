/**
 * PrismaFinance — motor financeiro puro (testável em Node e no browser).
 * Fonte de regras compartilhadas com o Dashboard / Centro Financeiro.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrismaFinance = factory();
    // Backup: garante que os métodos de AI sejam acessíveis mesmo se
    // outro script sobrescrever window.PrismaFinance com um objeto parcial.
    root._PrismaFinanceEngine = root.PrismaFinance;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function money(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v == null || v === '') return 0;
    if (typeof globalThis !== 'undefined') {
      if (typeof globalThis.parseMoneyInput === 'function') {
        const n = globalThis.parseMoneyInput(v);
        if (Number.isFinite(n)) return n;
      }
      if (typeof globalThis.PrismaParseMoney === 'function') {
        const n = globalThis.PrismaParseMoney(v);
        if (Number.isFinite(n)) return n;
      }
    }
    // pt-BR: 1.234,56 → 1234.56 | en: 1234.56
    let s = String(v).replace(/[R$\s]/g, '').trim();
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') >= 0) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function isInactiveInvestment(inv) {
    const status = String(inv && inv.status || 'ativo').trim().toLowerCase();
    return ['resgatado', 'encerrado', 'inativo'].includes(status);
  }

  const PrismaFinance = {
    money,

    safeDiv(a, b) {
      const n = Number(a);
      const d = Number(b);
      if (!d || !isFinite(d) || !isFinite(n)) return 0;
      return n / d;
    },

    pct(part, whole) {
      return this.safeDiv(part, whole) * 100;
    },

    safePercent(part, whole) {
      const p = Number(part) || 0;
      const w = Number(whole) || 0;
      if (!Number.isFinite(p) || !Number.isFinite(w) || w === 0) return 0;
      return (p / w) * 100;
    },

    savingsRate(income, expense) {
      if (!income || income <= 0) return null;
      return ((income - expense) / income) * 100;
    },

    projectCompound(present, monthly, months, annualRate) {
      const r = (Number(annualRate) || 0) / 100 / 12;
      let bal = Number(present) || 0;
      const m = Math.max(0, parseInt(months, 10) || 0);
      const add = Number(monthly) || 0;
      for (let i = 0; i < m; i++) bal = bal * (1 + r) + add;
      return bal;
    },

    getInvestTotals(list) {
      let aplicado = 0;
      let atual = 0;
      (list || []).forEach((inv) => {
        if (!inv || isInactiveInvestment(inv)) return;
        let a = money(
          inv.valorAplicado != null
            ? inv.valorAplicado
            : inv.valorInvestido != null
              ? inv.valorInvestido
              : inv.valor
        );
        let cur;
        if (inv.valorAtual != null) cur = money(inv.valorAtual);
        else if (inv.valorTotal != null) cur = money(inv.valorTotal);
        else cur = a + money(inv.lucro);
        aplicado += a;
        atual += cur;
      });
      return {
        aplicado,
        atual,
        lucro: atual - aplicado,
        rent: aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0
      };
    },

    getAccountsTotal(contasList) {
      return (contasList || []).reduce((s, c) => s + money(c && c.saldo), 0);
    },

    getCardsDebt(cartoesList) {
      return (cartoesList || []).reduce((s, c) => {
        if (!c) return s;
        const used =
          c.usado != null ? c.usado : c.fatura != null ? c.fatura : c.saldo != null ? c.saldo : 0;
        return s + money(used);
      }, 0);
    },

    getCardsUtilization(cartoesList) {
      let limit = 0;
      let used = 0;
      (cartoesList || []).forEach((c) => {
        if (!c) return;
        limit += money(c.limite);
        used += money(c.usado != null ? c.usado : c.fatura != null ? c.fatura : 0);
      });
      return { limit, used, pct: limit > 0 ? (used / limit) * 100 : null };
    },

    getGoalsProgress(goalsList) {
      let target = 0;
      let current = 0;
      let n = 0;
      (goalsList || []).forEach((g) => {
        if (!g) return;
        const t = money(g.target != null ? g.target : g.valorAlvo != null ? g.valorAlvo : g.meta);
        const c = money(g.current != null ? g.current : g.atual != null ? g.atual : g.valorAtual);
        if (t <= 0 && c <= 0) return;
        target += t;
        current += c;
        n += 1;
      });
      return {
        n,
        target,
        current,
        pct: target > 0 ? (current / target) * 100 : null
      };
    },

    computeScore(ctx) {
      ctx = ctx || {};
      let score = 50;
      const sr = ctx.savingsRate;
      if (sr == null) {
        /* sem base de receita */
      } else if (sr >= 30) score += 20;
      else if (sr >= 20) score += 15;
      else if (sr >= 10) score += 10;
      else if (sr >= 0) score += 5;
      else score -= 15;

      const cu = ctx.cardUtilPct;
      if (cu == null) {
        /* sem cartão */
      } else if (cu >= 90) score -= 15;
      else if (cu >= 70) score -= 8;
      else if (cu < 30) score += 5;

      if (ctx.investAtual > 0) score += 10;
      if (ctx.investClasses >= 3) score += 8;
      else if (ctx.investClasses >= 2) score += 4;

      if (ctx.goalsPct >= 80) score += 10;
      else if (ctx.goalsPct >= 40) score += 6;
      else if (ctx.goalsPct > 0) score += 4;

      if (ctx.eduPoints >= 120) score += 8;
      else if (ctx.eduPoints >= 50) score += 4;

      if (ctx.netWorth > 0) score += 5;
      if (ctx.cashFlow < 0) score -= 10;

      return Math.max(0, Math.min(100, Math.round(score)));
    },

    scoreBand(score) {
      if (score <= 20) return { label: 'Crítico', color: '#EF4444', cls: 'crit' };
      if (score <= 40) return { label: 'Atenção', color: '#F97316', cls: 'crit' };
      if (score <= 60) return { label: 'Regular', color: '#F2A900', cls: 'warn' };
      if (score <= 80) return { label: 'Bom', color: '#22C55E', cls: 'ok' };
      return { label: 'Excelente', color: '#22C55E', cls: 'ok' };
    },

    /** Consolidação de ativos por ticker|nome+tipo (mesma regra da carteira) */
    consolidateInvestments(list) {
      const map = new Map();
      (list || []).forEach((inv, index) => {
        if (!inv || isInactiveInvestment(inv)) return;
        const ticker = String(inv.ticker || inv.simbolo || '')
          .trim()
          .toUpperCase();
        const nome = String(inv.nome || '')
          .trim()
          .toLowerCase();
        const tipo = String(inv.tipo || 'outros').toLowerCase();
        const key = ticker ? tipo + '|' + ticker : tipo + '|' + nome;
        const aplicado = money(
          inv.valorAplicado != null
            ? inv.valorAplicado
            : inv.valorInvestido != null
              ? inv.valorInvestido
              : inv.valor
        );
        let atual;
        if (inv.valorAtual != null) atual = money(inv.valorAtual);
        else if (inv.valorTotal != null) atual = money(inv.valorTotal);
        else atual = aplicado + money(inv.lucro);
        const qtd = Number(inv.quantidade);
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            key,
            nome: inv.nome,
            ticker: inv.ticker || inv.simbolo || null,
            tipo: inv.tipo,
            valorAplicado: aplicado,
            valorAtual: atual,
            quantidade: Number.isFinite(qtd) ? qtd : null,
            aportes: 1,
            indices: [index]
          });
          return;
        }
        existing.valorAplicado += aplicado;
        existing.valorAtual += atual;
        if (Number.isFinite(qtd)) {
          existing.quantidade = (Number(existing.quantidade) || 0) + qtd;
        }
        existing.aportes += 1;
        existing.indices.push(index);
      });
      return Array.from(map.values()).map((row) => {
        const lucro = row.valorAtual - row.valorAplicado;
        const rent = row.valorAplicado > 0 ? (lucro / row.valorAplicado) * 100 : 0;
        const precoMedio =
          row.quantidade && row.quantidade > 0 ? row.valorAplicado / row.quantidade : null;
        return { ...row, lucro, rent, precoMedio };
      });
    },

    groupInvestmentsByCategory(list) {
      const categories = [
        { key: 'renda-fixa', label: 'Renda Fixa', icon: 'landmark', types: ['renda-fixa', 'tesouro', 'cdb', 'lci-lca', 'lc', 'lci', 'lca', 'debenture', 'cri', 'cra'] },
        { key: 'acoes', label: 'Renda Variável', icon: 'trending-up', types: ['acoes', 'fiis', 'etfs', 'acao', 'fii', 'etf', 'bdr'] },
        { key: 'criptomoedas', label: 'Criptomoedas', icon: 'bitcoin', types: ['criptomoedas', 'cripto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol'] },
        { key: 'fundos', label: 'Fundos', icon: 'pie-chart', types: ['fundos', 'multimercado', 'fundos-imobiliarios', 'cambial', 'fundo'] },
        { key: 'outros', label: 'Outros', icon: 'layers', types: ['outros', 'previdencia', 'previdência', 'commodities', 'ouro'] }
      ];

      const normalized = (list || []).map((inv) => {
        if (!inv || isInactiveInvestment(inv)) return null;
        const tipo = String(inv.tipo || '').toLowerCase();
        const tokens = tipo.split(/[-_\s/]+/);
        const match = categories.find((cat) => cat.types.some((t) => tipo === t || tokens.includes(t) || (t.length >= 4 && tipo.includes(t))));
        const key = match ? match.key : 'outros';
        const value = Number(inv.valorAtual != null ? inv.valorAtual : (inv.valorTotal != null ? inv.valorTotal : (inv.valorAplicado != null ? inv.valorAplicado : (inv.valorInvestido != null ? inv.valorInvestido : inv.valor)))) || 0;
        const aplicado = Number(inv.valorAplicado != null ? inv.valorAplicado : (inv.valorInvestido != null ? inv.valorInvestido : inv.valor)) || 0;
        return { ...inv, key, total: value, valorAtual: value, valorAplicado: aplicado };
      }).filter(Boolean);

      const result = categories.map((cat) => {
        const items = normalized.filter((inv) => inv.key === cat.key);
        const total = items.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
        const totalAplicado = items.reduce((sum, inv) => sum + Number(inv.valorAplicado || 0), 0);
        const totalLucro = total - totalAplicado;
        const rent = totalAplicado > 0 ? (totalLucro / totalAplicado) * 100 : 0;

        // Agrupamento por sub-classes (ex.: Tesouro Direto, CDB, Ações, FIIs)
        const subMap = new Map();
        items.forEach((item) => {
          const subKey = String(item.tipo || 'outros').toLowerCase();
          if (!subMap.has(subKey)) {
            subMap.set(subKey, { tipo: subKey, items: [], total: 0, totalAplicado: 0 });
          }
          const entry = subMap.get(subKey);
          entry.items.push(item);
          entry.total += item.total;
          entry.totalAplicado += item.valorAplicado;
        });

        const classes = Array.from(subMap.values()).map((c) => ({
          tipo: c.tipo,
          items: c.items,
          total: c.total,
          totalAplicado: c.totalAplicado,
          lucro: c.total - c.totalAplicado,
          rent: c.totalAplicado > 0 ? ((c.total - c.totalAplicado) / c.totalAplicado) * 100 : 0
        }));

        return {
          key: cat.key,
          label: cat.label,
          icon: cat.icon,
          items,
          classes,
          total,
          totalAplicado,
          totalLucro,
          rent,
          percent: 0
        };
      }).filter((entry) => entry.items.length > 0);

      const totalPortfolio = result.reduce((sum, item) => sum + item.total, 0);
      result.forEach((entry) => {
        entry.percent = totalPortfolio > 0 ? this.safePercent(entry.total, totalPortfolio) : 0;
      });

      return result;
    },

    safeVariation(current, previous) {
      const curr = Number(current) || 0;
      const prev = Number(previous) || 0;
      if (prev === 0 && curr === 0) {
        return { pct: 0, text: '0%', label: 'Sem alteração', isNew: false, direction: 'flat' };
      }
      if (prev === 0) {
        return { pct: null, text: 'Novo', label: 'Novo', isNew: true, direction: 'up' };
      }
      const pct = ((curr - prev) / Math.abs(prev)) * 100;
      if (Math.abs(pct) < 0.05) {
        return { pct: 0, text: '0%', label: 'Estável', isNew: false, direction: 'flat' };
      }
      return {
        pct,
        text: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%',
        label: pct > 0 ? 'Alta' : 'Queda',
        isNew: false,
        direction: pct > 0 ? 'up' : 'down'
      };
    },

    transferAccounts(contas, { origem, destino, valor, data, descricao }) {
      const v = Math.abs(Number(valor) || 0);
      if (!(v > 0)) throw new Error('Informe um valor de transferência maior que zero.');
      if (!origem || !destino || origem === destino) throw new Error('Selecione contas de origem e destino diferentes.');
      const list = Array.isArray(contas) ? [...contas] : [];
      const idxOrigem = list.findIndex(c => c && (c.nome === origem || c.banco === origem));
      const idxDestino = list.findIndex(c => c && (c.nome === destino || c.banco === destino));
      if (idxOrigem < 0) throw new Error(`Conta de origem "${origem}" não encontrada.`);
      if (idxDestino < 0) throw new Error(`Conta de destino "${destino}" não encontrada.`);

      const contaOrigem = { ...list[idxOrigem] };
      const contaDestino = { ...list[idxDestino] };

      contaOrigem.saldo = (Number(contaOrigem.saldo) || 0) - v;
      contaDestino.saldo = (Number(contaDestino.saldo) || 0) + v;

      list[idxOrigem] = contaOrigem;
      list[idxDestino] = contaDestino;

      const transferLog = {
        id: 'transf_' + Date.now(),
        tipo: 'transferencia',
        origem,
        destino,
        valor: v,
        data: data || new Date().toISOString().split('T')[0],
        descricao: descricao || `Transferência de ${origem} para ${destino}`
      };

      return { contas: list, log: transferLog };
    },

    /**
     * PL simplificado (mesma regra conceitual do buildFinanceContext):
     * liquid = contas > 0 ? contas : max(0, cashFlow)
     * assets = liquid + investAtual
     * liabilities = cardDebt
     * netWorth = assets - liabilities
     */
    computeNetWorth({ receitas, despesas, contas, cartoes, investimentos }) {
      const inc = (receitas || []).reduce((s, x) => s + money(x && x.valor), 0);
      const exp = (despesas || []).reduce((s, x) => s + money(x && x.valor), 0);
      const cashFlow = inc - exp;
      const contasTotal = this.getAccountsTotal(contas);
      const inv = this.getInvestTotals(investimentos);
      const cardDebt = this.getCardsDebt(cartoes);
      const liquid = contasTotal > 0 ? contasTotal : Math.max(0, cashFlow);
      const assets = liquid + inv.atual;
      const liabilities = cardDebt;
      return {
        inc,
        exp,
        cashFlow,
        contasTotal,
        inv,
        cardDebt,
        liquid,
        assets,
        liabilities,
        netWorth: assets - liabilities,
        savingsRate: this.savingsRate(inc, exp)
      };
    },

    /**
     * Parsing seguro de datas (ISO, pt-BR DD/MM/AAAA, timestamp).
     */
    parseDateSafe(d) {
      if (!d) return null;
      if (d instanceof Date && !isNaN(d.getTime())) return d;
      const str = String(d).trim();
      if (!str) return null;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        const parts = str.split(/[\/\s]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const dt = new Date(year, month, day, 12, 0, 0);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const dt = new Date(str.includes('T') ? str : str + 'T12:00:00');
      return isNaN(dt.getTime()) ? null : dt;
    },

    /**
     * Filtra transações por período (7d, 30d, 3m, 6m, 1y, all).
     * Retorna também o conjunto de transações do período equivalente anterior para comparações de tendência.
     */
    filterTransactionsByPeriod(list, period = '30d', referenceDate = null) {
      const items = Array.isArray(list) ? list : [];
      if (!items.length) {
        return {
          current: [],
          previous: [],
          range: { period, start: null, end: null, prevStart: null, prevEnd: null }
        };
      }

      // Encontrar data de referência mais recente se não informada
      let refDt = referenceDate ? this.parseDateSafe(referenceDate) : null;
      if (!refDt) {
        let maxTime = 0;
        items.forEach(it => {
          const dt = this.parseDateSafe(it && (it.data || it.createdAt || it.date));
          if (dt && dt.getTime() > maxTime) maxTime = dt.getTime();
        });
        refDt = maxTime > 0 ? new Date(maxTime) : new Date();
      }

      if (period === 'all') {
        return {
          current: [...items],
          previous: [],
          range: { period: 'all', start: null, end: refDt, prevStart: null, prevEnd: null }
        };
      }

      let durationMs = 30 * 86400000;
      if (period === '7d') durationMs = 7 * 86400000;
      else if (period === '30d') durationMs = 30 * 86400000;
      else if (period === '3m') durationMs = 90 * 86400000;
      else if (period === '6m') durationMs = 180 * 86400000;
      else if (period === '1y') durationMs = 365 * 86400000;

      const currentEnd = refDt.getTime();
      const currentStart = currentEnd - durationMs;
      const prevEnd = currentStart;
      const prevStart = prevEnd - durationMs;

      const current = [];
      const previous = [];

      items.forEach(it => {
        if (!it) return;
        const dt = this.parseDateSafe(it.data || it.createdAt || it.date);
        if (!dt) {
          // Se não houver data válida e for período de 30d/all, inclui por segurança
          if (period === 'all' || period === '30d') current.push(it);
          return;
        }
        const time = dt.getTime();
        if (time >= currentStart && time <= currentEnd) {
          current.push(it);
        } else if (time >= prevStart && time < prevEnd) {
          previous.push(it);
        }
      });

      return {
        current,
        previous,
        range: {
          period,
          start: new Date(currentStart),
          end: new Date(currentEnd),
          prevStart: new Date(prevStart),
          prevEnd: new Date(prevEnd)
        }
      };
    },

    /**
     * Classifica uma despesa entre Essencial e Não Essencial (discricionária),
     * com base na categoria e no nível de prioridade.
     */
    classifyExpense(expense) {
      if (!expense) return { isEssential: false, categoryType: 'discricionario' };
      const cat = String(expense.categoria || '').trim().toLowerCase();
      const desc = String(expense.descricao || '').trim().toLowerCase();
      const prio = String(expense.prioridade || 'media').trim().toLowerCase();

      // Categorias essenciais inequívocas
      const essentialKeywords = [
        'moradia', 'aluguel', 'condomínio', 'condominio', 'luz', 'energia', 'água', 'agua',
        'gás', 'gas', 'internet', 'saúde', 'saude', 'farmácia', 'farmacia', 'médico', 'medico',
        'hospital', 'plano de saúde', 'educação', 'educacao', 'escola', 'faculdade',
        'supermercado', 'mercado', 'alimentação básica', 'feira'
      ];

      // Categorias discricionárias
      const discretionaryKeywords = [
        'lazer', 'restaurante', 'restaurantes', 'delivery', 'ifood', 'ubereats', 'bar', 'bares',
        'balada', 'viagem', 'viagens', 'compras', 'shopping', 'vestuário', 'vestuario',
        'eletrônicos', 'eletronicos', 'assinaturas', 'streaming', 'jogos', 'games',
        'hobbies', 'presentes', 'beleza', 'estética', 'estetica', 'cinema'
      ];

      const isEssentialCat = essentialKeywords.some(k => cat.includes(k) || desc.includes(k));
      const isDiscretionaryCat = discretionaryKeywords.some(k => cat.includes(k) || desc.includes(k));

      if (isEssentialCat) {
        return { isEssential: true, categoryType: 'essencial' };
      }
      if (isDiscretionaryCat) {
        // Mesmo com prioridade alta, restaurante/streaming/lazer é conceitualmente discricionário
        return { isEssential: false, categoryType: 'discricionario' };
      }

      // Desempate por prioridade
      if (prio === 'urgente' || prio === 'alta') {
        return { isEssential: true, categoryType: 'essencial' };
      }
      return { isEssential: false, categoryType: 'discricionario' };
    },

    /**
     * Identifica serviços recorrentes e assinaturas nos dados.
     */
    detectRecurringAndSubscriptions(expenses) {
      const items = Array.isArray(expenses) ? expenses : [];
      const subscriptionKeywords = [
        'netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo', 'max', 'youtube', 'apple',
        'icloud', 'deezer', 'globoplay', 'smart fit', 'academia', 'game pass', 'xbox',
        'playstation', 'chatgpt', 'openai', 'crunchyroll', 'paramount', 'star+', 'telecine'
      ];

      const map = new Map();
      items.forEach(exp => {
        if (!exp) return;
        const desc = String(exp.descricao || '').trim().toLowerCase();
        const cat = String(exp.categoria || '').trim().toLowerCase();
        const isRec = Boolean(exp.recorrente);
        const val = money(exp.valor);
        if (val <= 0) return;

        const isKnownSub = subscriptionKeywords.some(k => desc.includes(k) || cat.includes(k));
        const isMarkedRec = isRec || cat.includes('assinatura') || desc.includes('assinatura') || desc.includes('mensalidade');

        if (isKnownSub || isMarkedRec) {
          const key = desc || cat || 'Assinatura';
          if (!map.has(key)) {
            map.set(key, {
              nome: exp.descricao || exp.categoria || 'Assinatura',
              categoria: exp.categoria || 'Assinaturas',
              total: 0,
              count: 0,
              valorMedio: 0,
              transacoes: []
            });
          }
          const entry = map.get(key);
          entry.total += val;
          entry.count += 1;
          entry.valorMedio = entry.total / entry.count;
          entry.transacoes.push(exp);
        }
      });

      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },

    /**
     * Detecta gastos atípicos (anomalias estatísticas) e possíveis duplicidades.
     */
    detectAtypicalAndDuplicates(expenses) {
      const items = Array.isArray(expenses) ? expenses : [];
      const atipicos = [];
      const duplicados = [];

      // 1. Detecção de duplicados: mesmo valor e descrição semelhante num intervalo <= 3 dias
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          if (!a || !b) continue;
          const valA = money(a.valor);
          const valB = money(b.valor);
          if (Math.abs(valA - valB) < 0.01 && valA > 0) {
            const descA = String(a.descricao || '').trim().toLowerCase();
            const descB = String(b.descricao || '').trim().toLowerCase();
            if (descA && descA === descB) {
              const dtA = this.parseDateSafe(a.data);
              const dtB = this.parseDateSafe(b.data);
              if (dtA && dtB) {
                const diffDays = Math.abs(dtA.getTime() - dtB.getTime()) / 86400000;
                if (diffDays <= 3) {
                  duplicados.push({
                    descricao: a.descricao,
                    valor: valA,
                    categoria: a.categoria || 'Geral',
                    dataA: a.data,
                    dataB: b.data,
                    diasIntervalo: Math.round(diffDays)
                  });
                }
              }
            }
          }
        }
      }

      // 2. Detecção de atípicos por categoria (valor > 2.5x a média da categoria)
      const catMap = new Map();
      items.forEach(exp => {
        if (!exp) return;
        const cat = exp.categoria || 'Outros';
        const v = money(exp.valor);
        if (v <= 0) return;
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat).push({ exp, val: v });
      });

      catMap.forEach((entry, cat) => {
        if (entry.length >= 3) {
          const sum = entry.reduce((acc, x) => acc + x.val, 0);
          const avg = sum / entry.length;
          entry.forEach(({ exp, val }) => {
            if (val > avg * 2.5 && val >= 60) {
              atipicos.push({
                id: exp.id || 'atyp_' + Date.now(),
                descricao: exp.descricao || cat,
                categoria: cat,
                valor: val,
                data: exp.data,
                mediaCategoria: avg,
                multiplo: (val / avg).toFixed(1)
              });
            }
          });
        }
      });

      return { atipicos, duplicados };
    },

    /**
     * Análise financeira abrangente baseada nos dados reais disponíveis.
     */
    analyzeFinances({ receitas = [], despesas = [], goals = [], period = '30d', referenceDate = null, budgets = {} } = {}) {
      // Filtrar por período atual e período equivalente anterior
      const recFiltered = this.filterTransactionsByPeriod(receitas, period, referenceDate);
      const despFiltered = this.filterTransactionsByPeriod(despesas, period, referenceDate);

      const currentRec = recFiltered.current;
      const currentDesp = despFiltered.current;
      const prevDesp = despFiltered.previous;

      const totalRec = currentRec.reduce((s, r) => s + money(r && r.valor), 0);
      const totalDesp = currentDesp.reduce((s, d) => s + money(d && d.valor), 0);
      const prevTotalDesp = prevDesp.reduce((s, d) => s + money(d && d.valor), 0);
      const saldo = totalRec - totalDesp;
      const taxaPoupanca = totalRec > 0 ? (saldo / totalRec) * 100 : 0;

      // Agrupamento de despesas por categoria
      const catMap = new Map();
      let essentialTotal = 0;
      let discretionaryTotal = 0;

      currentDesp.forEach(d => {
        if (!d) return;
        const cat = d.categoria || 'Outros';
        const val = money(d.valor);
        if (val <= 0) return;

        const classification = this.classifyExpense(d);
        if (classification.isEssential) essentialTotal += val;
        else discretionaryTotal += val;

        if (!catMap.has(cat)) {
          catMap.set(cat, {
            categoria: cat,
            total: 0,
            count: 0,
            isEssential: classification.isEssential,
            transacoes: []
          });
        }
        const c = catMap.get(cat);
        c.total += val;
        c.count += 1;
        c.transacoes.push(d);
      });

      // Mapear gastos anteriores por categoria para calcular tendências
      const prevCatMap = new Map();
      prevDesp.forEach(d => {
        if (!d) return;
        const cat = d.categoria || 'Outros';
        const val = money(d.valor);
        prevCatMap.set(cat, (prevCatMap.get(cat) || 0) + val);
      });

      const gastosPorCategoria = Array.from(catMap.values()).map(c => {
        const pct = totalDesp > 0 ? (c.total / totalDesp) * 100 : 0;
        const prevVal = prevCatMap.get(c.categoria) || 0;
        const variation = this.safeVariation(c.total, prevVal);
        return {
          categoria: c.categoria,
          total: c.total,
          percentual: pct,
          count: c.count,
          mediaPorItem: c.count > 0 ? c.total / c.count : 0,
          isEssential: c.isEssential,
          prevTotal: prevVal,
          variacao: variation
        };
      }).sort((a, b) => b.total - a.total);

      // Categorias com aumento expressivo de gastos (> 10% e aumento > R$ 50)
      const categoriasEmAlta = gastosPorCategoria.filter(c => {
        return c.variacao && c.variacao.pct > 10 && (c.total - c.prevTotal) >= 50;
      });

      // Detecção de assinaturas e despesas recorrentes
      const recorrentes = this.detectRecurringAndSubscriptions(currentDesp);
      const totalRecorrentes = recorrentes.reduce((acc, r) => acc + r.total, 0);

      // Detecção de atípicos e duplicados
      const anomalidades = this.detectAtypicalAndDuplicates(currentDesp);

      // Capacidade de poupança/economia recomendada
      // Regra conservadora: até 50% do saldo positivo + até 15% de gastos discricionários
      const capacidadeEconomia = Math.max(0, (saldo > 0 ? saldo * 0.4 : 0) + (discretionaryTotal * 0.15));

      return {
        periodo: recFiltered.range,
        receitasTotal: totalRec,
        despesasTotal: totalDesp,
        despesasAnteriorTotal: prevTotalDesp,
        variacaoDespesasGeral: this.safeVariation(totalDesp, prevTotalDesp),
        saldo,
        taxaPoupanca,
        gastosPorCategoria,
        gastosEssenciaisTotal: essentialTotal,
        gastosNaoEssenciaisTotal: discretionaryTotal,
        percentualEssencial: totalDesp > 0 ? (essentialTotal / totalDesp) * 100 : 0,
        percentualNaoEssencial: totalDesp > 0 ? (discretionaryTotal / totalDesp) * 100 : 0,
        recorrentes,
        totalRecorrentes,
        atipicos: anomalidades.atipicos,
        duplicados: anomalidades.duplicados,
        categoriasEmAlta,
        capacidadeEconomia,
        transacoesReceitas: currentRec,
        transacoesDespesas: currentDesp,
        temDadosSuficientes: totalRec > 0 || totalDesp > 0
      };
    },

    /**
     * Gera recomendações financeiras personalizadas fundamentadas estritamente nos dados reais.
     * Não corta gastos essenciais indiscriminadamente.
     */
    generateRecommendations(analysis, existingPlan = []) {
      if (!analysis || !analysis.temDadosSuficientes) {
        return [];
      }

      const recs = [];
      const planCategorySet = new Set((existingPlan || []).map(p => p && p.categoria));

      // A. ALIMENTAÇÃO FORA / DELIVERY
      const foodOutCat = analysis.gastosPorCategoria.find(c => {
        const cat = c.categoria.toLowerCase();
        return (cat.includes('restaurante') || cat.includes('delivery') || cat.includes('ifood') || cat.includes('lanchonete'))
          && !c.isEssential;
      });

      if (foodOutCat && foodOutCat.total >= 100) {
        const pct = foodOutCat.percentual;
        if (pct >= 10 || foodOutCat.total >= 250) {
          const economia = Math.round(foodOutCat.total * 0.15);
          if (economia >= 20) {
            recs.push({
              id: 'rec_food_delivery',
              titulo: 'Otimizar gastos com alimentação fora e delivery',
              categoria: foodOutCat.categoria,
              problema: `Gastos com ${foodOutCat.categoria} representam ${pct.toFixed(1)}% do total de despesas.`,
              evidencia: `Foram identificadas ${foodOutCat.count} despesas nesta categoria, somando ${this.formatBRL(foodOutCat.total)} no período.`,
              valorGasto: foodOutCat.total,
              economiaPotencial: economia,
              percentualReducao: 15,
              acaoRecomendada: 'Substituir refeições pedidas por preparações caseiras 1 a 2 vezes por semana.',
              metaMensalSugerida: Math.max(0, foodOutCat.total - economia),
              prazoMeses: 1,
              prioridade: pct > 20 ? 'alta' : 'media',
              confianca: 'alta',
              tipo: 'discricionario'
            });
          }
        }
      }

      // B. REVISÃO DE ASSINATURAS E STREAMINGS
      if (analysis.recorrentes && analysis.recorrentes.length >= 2 && analysis.totalRecorrentes >= 80) {
        const economia = Math.round(analysis.totalRecorrentes * 0.25);
        const nomes = analysis.recorrentes.slice(0, 4).map(r => r.nome).join(', ');
        recs.push({
          id: 'rec_subscriptions',
          titulo: 'Revisar assinaturas e serviços recorrentes',
          categoria: 'Assinaturas',
          problema: `Você possui ${analysis.recorrentes.length} assinaturas recorrentes ativas totalizando ${this.formatBRL(analysis.totalRecorrentes)} no período.`,
          evidencia: `Serviços detectados: ${nomes}.`,
          valorGasto: analysis.totalRecorrentes,
          economiaPotencial: economia,
          percentualReducao: 25,
          acaoRecomendada: 'Auditar assinaturas pouco utilizadas e considerar cancelar ou alternar entre serviços mensais.',
          metaMensalSugerida: Math.max(0, analysis.totalRecorrentes - economia),
          prazoMeses: 1,
          prioridade: analysis.totalRecorrentes > 200 ? 'alta' : 'media',
          confianca: 'alta',
          tipo: 'assinatura'
        });
      }

      // C. CATEGORIAS COM AUMENTO EXPRESSIVO DE GASTOS
      (analysis.categoriasEmAlta || []).forEach(cat => {
        if (cat.isEssential) return; // Preserva essenciais de cortes automáticos
        if (recs.some(r => r.categoria === cat.categoria)) return;

        const dif = cat.total - cat.prevTotal;
        const economia = Math.round(dif * 0.4);
        if (economia >= 30) {
          recs.push({
            id: `rec_increase_${cat.categoria.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            titulo: `Frear aumento de gastos em ${cat.categoria}`,
            categoria: cat.categoria,
            problema: `Gastos em ${cat.categoria} subiram ${cat.variacao.text} em relação ao período anterior (+${this.formatBRL(dif)}).`,
            evidencia: `Total atual de ${this.formatBRL(cat.total)} contra ${this.formatBRL(cat.prevTotal)} no período comparado.`,
            valorGasto: cat.total,
            economiaPotencial: economia,
            percentualReducao: Math.min(30, Math.round((economia / cat.total) * 100)),
            acaoRecomendada: `Estabelecer teto de gastos para ${cat.categoria} próximo ao valor do período anterior.`,
            metaMensalSugerida: Math.max(0, cat.total - economia),
            prazoMeses: 2,
            prioridade: dif > 150 ? 'alta' : 'media',
            confianca: 'alta',
            tipo: 'aumento_custo'
          });
        }
      });

      // D. COMPRAS NÃO ESSENCIAIS / LAZER ELEVADO
      const lazerCat = analysis.gastosPorCategoria.find(c => {
        const cat = c.categoria.toLowerCase();
        return (cat.includes('lazer') || cat.includes('compras') || cat.includes('vestuário') || cat.includes('eletrônicos'))
          && !c.isEssential;
      });

      if (lazerCat && lazerCat.percentual >= 15 && lazerCat.total >= 150) {
        if (!recs.some(r => r.categoria === lazerCat.categoria)) {
          const economia = Math.round(lazerCat.total * 0.15);
          recs.push({
            id: 'rec_discretionary_lazer',
            titulo: `Adequar despesas de ${lazerCat.categoria}`,
            categoria: lazerCat.categoria,
            problema: `${lazerCat.categoria} representa ${lazerCat.percentual.toFixed(1)}% do orçamento no período.`,
            evidencia: `Total de ${this.formatBRL(lazerCat.total)} distribuído em ${lazerCat.count} lançamentos.`,
            valorGasto: lazerCat.total,
            economiaPotencial: economia,
            percentualReducao: 15,
            acaoRecomendada: 'Definir uma cota semanal fixa para compras discricionárias e lazer.',
            metaMensalSugerida: Math.max(0, lazerCat.total - economia),
            prazoMeses: 1,
            prioridade: lazerCat.percentual > 25 ? 'alta' : 'media',
            confianca: 'alta',
            tipo: 'discricionario'
          });
        }
      }

      // E. RESERVA FINANCEIRA / META DE POUPANÇA (quando há saldo ou capacidade)
      if (analysis.taxaPoupanca < 20 && analysis.receitasTotal > 0) {
        const taxaAtual = analysis.taxaPoupanca;
        const metaEconomia = analysis.saldo > 0
          ? Math.min(analysis.receitasTotal * 0.1, analysis.saldo * 0.5)
          : Math.min(analysis.receitasTotal * 0.05, analysis.gastosNaoEssenciaisTotal * 0.15);

        if (metaEconomia >= 30) {
          recs.push({
            id: 'rec_savings_reserve',
            titulo: taxaAtual <= 0 ? 'Criar margem inicial de segurança financeira' : 'Ampliar reserva de emergência mensal',
            categoria: 'Poupança / Reserva',
            problema: taxaAtual <= 0
              ? 'Despesas estão no limite ou superando receitas, impedindo formação de reserva.'
              : `Taxa de poupança atual é de ${taxaAtual.toFixed(1)}% (abaixo do patamar ideal de 20%).`,
            evidencia: `Receita do período de ${this.formatBRL(analysis.receitasTotal)} com saldo de ${this.formatBRL(analysis.saldo)}.`,
            valorGasto: analysis.saldo < 0 ? Math.abs(analysis.saldo) : 0,
            economiaPotencial: Math.round(metaEconomia),
            percentualReducao: analysis.despesasTotal > 0 ? Math.round((metaEconomia / analysis.despesasTotal) * 100) : 5,
            acaoRecomendada: 'Separar o valor de aporte logo no início do mês via transferência automática para reserva segura.',
            metaMensalSugerida: Math.round(metaEconomia),
            prazoMeses: 3,
            prioridade: taxaAtual <= 0 ? 'alta' : 'media',
            confianca: 'alta',
            tipo: 'poupanca'
          });
        }
      }

      // F. COBRANÇAS DUPLICADAS / GASTOS ATÍPICOS (se detectados)
      if (analysis.duplicados && analysis.duplicados.length > 0) {
        const dup = analysis.duplicados[0];
        recs.push({
          id: 'rec_duplicate_charge',
          titulo: 'Verificar possível lançamento em duplicidade',
          categoria: dup.categoria,
          problema: `Foram detectados lançamentos idênticos de ${this.formatBRL(dup.valor)} ("${dup.descricao}") com intervalo de ${dup.diasIntervalo} dia(s).`,
          evidencia: `Lançamentos em ${dup.dataA} e ${dup.dataB}.`,
          valorGasto: dup.valor * 2,
          economiaPotencial: dup.valor,
          percentualReducao: 50,
          acaoRecomendada: 'Confirmar no extrato bancário se a cobrança foi duplicada acidentalmente e solicitar estorno se aplicável.',
          metaMensalSugerida: dup.valor,
          prazoMeses: 1,
          prioridade: 'alta',
          confianca: 'media',
          tipo: 'atipico'
        });
      }

      // Aplicar status dos planos já salvos
      return recs.map(rec => {
        const inPlan = planCategorySet.has(rec.categoria);
        return {
          ...rec,
          status: inPlan ? 'aceita' : 'pendente'
        };
      });
    },

    /**
     * Calcula a economia potencial consolidada, descontando sobreposições entre recomendações,
     * e diferencia formalmente a Economia Estimada da Economia Efetivamente Realizada.
     */
    calculateConsolidatedSavings(recommendations = [], savingsPlan = [], currentExpenses = [], previousExpenses = []) {
      const recs = Array.isArray(recommendations) ? recommendations : [];
      const plan = Array.isArray(savingsPlan) ? savingsPlan : [];

      // 1. Eliminação de sobreposição para Economia Potencial Total
      // Não contabiliza duas reduções que disputem a mesma base na mesma categoria
      const catCapMap = new Map();
      let economiaPotencialTotal = 0;

      recs.forEach(r => {
        const cat = r.categoria || 'Geral';
        const pot = money(r.economiaPotencial);
        if (pot <= 0) return;

        const currentCatPot = catCapMap.get(cat) || 0;
        // Se a recomendação for da mesma categoria, absorve apenas a maior economia
        if (pot > currentCatPot) {
          economiaPotencialTotal += (pot - currentCatPot);
          catCapMap.set(cat, pot);
        }
      });

      // 2. Economia Estimada: soma das reduções das metas que o usuário ACEITOU / ADOTOU no plano
      const planCatMap = new Map();
      let economiaEstimada = 0;

      plan.forEach(item => {
        if (!item || item.status === 'recusada') return;
        const cat = item.categoria || 'Geral';
        const est = money(item.economiaPotencial != null ? item.economiaPotencial : item.metaMensal);
        if (est <= 0) return;

        const currentEst = planCatMap.get(cat) || 0;
        if (est > currentEst) {
          economiaEstimada += (est - currentEst);
          planCatMap.set(cat, est);
        }
      });

      // 3. Economia Efetivamente Realizada
      // Regra documentada: Compara o gasto da categoria após a adesão da meta contra o gasto basal anterior.
      // Se não houver dados comprovados posteriores, sinaliza "pendente_confirmacao".
      let economiaRealizadaComprovada = 0;
      let temMetasPendentes = false;
      const detalheMetas = [];

      plan.forEach(meta => {
        if (!meta || meta.status === 'recusada') return;
        const cat = meta.categoria;
        const est = money(meta.economiaPotencial != null ? meta.economiaPotencial : meta.metaMensal);
        const baseline = money(meta.valorGastoAnterior != null ? meta.valorGastoAnterior : meta.valorGasto);

        // Se houver registro de gasto posterior no mesmo período
        if (baseline > 0 && currentExpenses.length > 0) {
          const gastoAtualCat = currentExpenses
            .filter(e => e && e.categoria === cat)
            .reduce((s, e) => s + money(e.valor), 0);

          if (gastoAtualCat < baseline) {
            const reducao = baseline - gastoAtualCat;
            economiaRealizadaComprovada += reducao;
            detalheMetas.push({
              id: meta.id,
              categoria: cat,
              economiaEstimada: est,
              economiaRealizada: reducao,
              statusConfirmacao: 'comprovada',
              progressoPct: Math.min(100, Math.round((reducao / est) * 100))
            });
          } else {
            temMetasPendentes = true;
            detalheMetas.push({
              id: meta.id,
              categoria: cat,
              economiaEstimada: est,
              economiaRealizada: 0,
              statusConfirmacao: 'sem_reducao_observada',
              progressoPct: 0
            });
          }
        } else {
          temMetasPendentes = true;
          detalheMetas.push({
            id: meta.id,
            categoria: cat,
            economiaEstimada: est,
            economiaRealizada: 0,
            statusConfirmacao: 'pendente_confirmacao',
            progressoPct: 0
          });
        }
      });

      return {
        economiaPotencialTotal,
        economiaEstimada,
        economiaRealizada: economiaRealizadaComprovada,
        temMetasPendentes,
        detalheMetas,
        planoAtivoCount: plan.filter(p => p && p.status !== 'recusada').length
      };
    },

    /**
     * Formata moeda em Real Brasileiro (BRL)
     */
    formatBRL(value) {
      const n = Number(value) || 0;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    }
  };

  return PrismaFinance;
});
