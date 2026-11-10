/* ============================================================
   PRISMA ENHANCEMENTS
   Alertas · Orçamento · Conciliação · Insights · Filtros · Export
   ============================================================ */
(function () {
  'use strict';

  const BUDGET_KEY = 'prisma_category_budgets_v1';
  const ALERTS_META_KEY = 'prisma_alerts_meta_v1';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function formatBRL(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseMoney(v) {
    if (typeof window.PrismaParseMoney === 'function') return window.PrismaParseMoney(v);
    if (typeof window.parseMoneyInput === 'function') return window.parseMoneyInput(v);
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === '') return 0;
    let s = String(v).trim().replace(/R\$|US\$|€|£/gi, '').replace(/\s/g, '');
    const neg = /^-/.test(s);
    s = s.replace(/[^0-9.,]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma !== -1) {
      s = s.replace(',', '.');
    } else if (lastDot !== -1) {
      const parts = s.split('.');
      if (parts.length === 2 && parts[1].length === 3 && parts[0] !== '' && parts[0] !== '0') {
        s = parts[0] + parts[1];
      } else if (parts.length > 2) {
        s = parts.join('');
      }
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return neg ? -Math.abs(n) : n;
  }

  function storageKey(base) {
    try {
      const pid = localStorage.getItem('prisma_current_profile_id');
      if (pid) return base + '_' + pid;
    } catch (_) {}
    return base;
  }

  function readList(globalName, baseKey) {
    try {
      const g = window[globalName];
      if (Array.isArray(g)) return g;
    } catch (_) {}
    try {
      // Prefer profile-scoped key; fall back to base key
      const scoped = localStorage.getItem(storageKey(baseKey));
      if (scoped != null) return JSON.parse(scoped || '[]');
      return JSON.parse(localStorage.getItem(baseKey) || '[]');
    } catch (_) { return []; }
  }

  function getReceitas() {
    return readList('receitas', 'prisma_receitas_data');
  }

  function getDespesas() {
    return readList('despesas', 'prisma_despesas_data');
  }

  function getCartoes() {
    return readList('cartoes', 'prisma_cartoes_data');
  }

  function getGoals() {
    return readList('goals', 'prisma_goals_data');
  }

  function getSaldo() {
    try {
      if (typeof saldoAtual !== 'undefined') return Number(saldoAtual) || 0;
    } catch (_) {}
    const r = getReceitas().reduce((s, x) => s + parseMoney(x.valor), 0);
    const d = getDespesas().reduce((s, x) => s + parseMoney(x.valor), 0);
    return r - d;
  }

  /** Parse datas em formatos BR e ISO → Date local (sem timezone shift) */
  function parseBRDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return Number.isNaN(dateStr.getTime()) ? null : dateStr;
    const s = String(dateStr).trim();

    // DD/MM/YYYY ou DD-MM-YYYY
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM-DD (ISO date only)
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // Fallback
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function monthKey(dateStr) {
    const d = parseBRDate(dateStr);
    if (!d) {
      const m = String(dateStr || '').match(/(\d{4})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}` : '';
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function currentMonthKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }

  function previousMonthKey() {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return startOfDay(d);
  }

  function loadBudgets() {
    try {
      return JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}');
    } catch (_) { return {}; }
  }

  function saveBudgets(data) {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(data));
  }

  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[Prisma]', msg);
  }

  function iconForType(type) {
    const map = {
      success: 'check-circle',
      danger: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info',
      pdf: 'file-text',
      export: 'download',
      email: 'mail',
      backup: 'database',
      finance: 'wallet'
    };
    return map[type] || 'bell';
  }

  function notify(title, message, type) {
    const now = Date.now();
    if (window.__prismaNotifDedupe && window.__prismaNotifDedupe.title === title && now - window.__prismaNotifDedupe.at < 2500) {
      return;
    }
    window.__prismaNotifDedupe = { title, at: now };

    const payload = {
      id: 'enh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: title || 'Notificação',
      message: message || '',
      type: type || 'info',
      icon: iconForType(type),
      read: false,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    if (window.PrismaNotifications && typeof window.PrismaNotifications.add === 'function') {
      window.PrismaNotifications.add(payload);
    } else {
      try {
        const raw = localStorage.getItem('prisma_notifications_v2');
        const state = raw ? JSON.parse(raw) : { notifications: [] };
        state.notifications = [payload, ...(Array.isArray(state.notifications) ? state.notifications : [])].slice(0, 50);
        localStorage.setItem('prisma_notifications_v2', JSON.stringify(state));
      } catch (_) {}
    }
    try {
      if (window.PrismaNotifications && window.PrismaNotifications.refresh) {
        window.PrismaNotifications.refresh();
      }
    } catch (_) {}
  }

  /** Mapeia toasts de ações importantes → notificação persistente no sino */
  function maybePersistFromToast(message) {
    const msg = String(message || '').trim();
    if (!msg) return;

    const rules = [
      { re: /PDF gerado com sucesso/i, title: 'PDF gerado', type: 'pdf' },
      { re: /Não foi possível gerar o PDF/i, title: 'Falha ao gerar PDF', type: 'danger' },
      { re: /Erro ao gerar PDF/i, title: 'Falha ao gerar PDF', type: 'danger' },
      { re: /Erro ao carregar bibliotecas de PDF/i, title: 'PDF indisponível', type: 'danger' },
      { re: /CSV exportado com sucesso/i, title: 'CSV exportado', type: 'export' },
      { re: /Não foi possível exportar CSV/i, title: 'Falha na exportação CSV', type: 'danger' },
      { re: /Não foi possível exportar Excel/i, title: 'Falha na exportação Excel', type: 'danger' },
      { re: /Backup JSON baixado/i, title: 'Backup gerado', type: 'backup' },
      { re: /CSV completo exportado/i, title: 'Transações exportadas', type: 'export' },
      { re: /Relatório gerado e e-mail preparado/i, title: 'Relatório por e-mail', type: 'email' },
      { re: /Não foi possível enviar o PDF por e-mail/i, title: 'Falha no envio por e-mail', type: 'danger' },
      { re: /Não foi possível preparar o relatório por e-mail/i, title: 'Falha no e-mail', type: 'danger' },
      { re: /Não foi possível identificar o e-mail/i, title: 'E-mail da conta ausente', type: 'warning' },
      { re: /Plano 50-30-20 aplicado/i, title: 'Orçamento atualizado', type: 'success' },
      { re: /Limite de .+ salvo/i, title: 'Limite de orçamento', type: 'success' },
      { re: /Status da fatura atualizado/i, title: 'Conciliação atualizada', type: 'success' },
      { re: /Receita adicionada com sucesso/i, title: 'Receita registrada', type: 'success' },
      { re: /Receita atualizada com sucesso/i, title: 'Receita atualizada', type: 'success' },
      { re: /Despesa adicionada com sucesso/i, title: 'Despesa registrada', type: 'success' },
      { re: /Despesa atualizada com sucesso/i, title: 'Despesa atualizada', type: 'success' },
      { re: /Conta atualizada com sucesso|Conta adicionada com sucesso/i, title: 'Conta bancária', type: 'success' },
      { re: /Cartão (adicionado|atualizado) com sucesso/i, title: 'Cartão', type: 'success' },
      { re: /Meta (adicionada|atualizada)/i, title: 'Meta financeira', type: 'success' },
      { re: /Perfil (criado|atualizado|excluído) com sucesso/i, title: 'Perfil', type: 'info' },
      { re: /Bem-vindo/i, title: 'Sessão iniciada', type: 'info' },
      { re: /Senha redefinida com sucesso/i, title: 'Senha atualizada', type: 'success' },
      { re: /dados locais foram sincronizados/i, title: 'Sincronização', type: 'success' },
      { re: /Todos os dados foram limpos/i, title: 'Dados limpos', type: 'warning' },
      { re: /recomendação\(ões\) aplicada/i, title: 'Recomendações aplicadas', type: 'success' },
      { re: /Análise reiniciada/i, title: 'Análise da IA', type: 'info' }
    ];

    for (const rule of rules) {
      if (rule.re.test(msg)) {
        // evita duplicar a mesma mensagem em < 2s
        const key = rule.title + '|' + msg;
        const now = Date.now();
        if (window.__prismaNotifDedupe && window.__prismaNotifDedupe.key === key && now - window.__prismaNotifDedupe.at < 2000) {
          return;
        }
        window.__prismaNotifDedupe = { key, at: now };
        notify(rule.title, msg.replace(/[\u2713\u{1F389}\u26A0\uFE0F]/gu, '').trim(), rule.type);
        return;
      }
    }
  }

  function installPersistentToastBridge() {
    // Intercepta showToast global (definido dentro do DOMContentLoaded do script principal)
    const tryPatch = () => {
      // procura showToast no escopo acessível via toasts DOM + monkeypatch de chamadas futuras
      // Estratégia: observar mudanças no #toast e também patchar window se exposto
      if (window.__prismaToastBridge) return true;

      const toastEl = document.getElementById('toast');
      if (!toastEl) return false;

      // MutationObserver no texto do toast
      const obs = new MutationObserver(() => {
        if (!toastEl.classList.contains('show')) return;
        const text = (toastEl.textContent || '').trim();
        if (text) maybePersistFromToast(text);
      });
      obs.observe(toastEl, { characterData: true, childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

      // Patch de event listeners dos botões de export (reforço)
      document.querySelectorAll('.btn.export').forEach((btn) => {
        if (btn.dataset.persistHook) return;
        btn.dataset.persistHook = '1';
        btn.addEventListener('click', () => {
          // a notificação real vem do toast de sucesso/erro; aqui só marca intenção
          if (btn.classList.contains('pdf')) {
            // feedback imediato opcional não necessário
          }
        });
      });

      window.__prismaToastBridge = true;
      return true;
    };

    if (!tryPatch()) {
      const id = setInterval(() => {
        if (tryPatch()) clearInterval(id);
      }, 300);
      setTimeout(() => clearInterval(id), 15000);
    }
  }

  function notifyAction(title, message, type) {
    notify(title, message, type);
    toast(message);
  }

  /* ========== 1. ALERTAS INTELIGENTES ========== */
  function runSmartAlerts() {
    const meta = JSON.parse(localStorage.getItem(ALERTS_META_KEY) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (meta.lastRun === today) return;
    meta.lastRun = today;

    const despesas = getDespesas();
    const cartoes = getCartoes();
    const goals = getGoals();
    const saldo = getSaldo();
    const cm = currentMonthKey();
    const pm = previousMonthKey();

    // Saldo baixo
    if (saldo < 0) {
      notify('Saldo negativo', `Seu saldo atual está em ${formatBRL(saldo)}. Revise despesas e receitas.`, 'danger');
    } else if (saldo > 0 && saldo < 200) {
      notify('Saldo baixo', `Saldo atual de apenas ${formatBRL(saldo)}. Considere reforçar a reserva.`, 'warning');
    }

    // Fatura / vencimento de cartão (usa campo diaVencimento se existir)
    cartoes.forEach((c) => {
      const dia = Number(c.diaVencimento || c.vencimento || 0);
      if (!dia) return;
      const now = new Date();
      const daysLeft = dia - now.getDate();
      if (daysLeft >= 0 && daysLeft <= 5) {
        notify(
          'Fatura próxima',
          `Cartão ${c.banco || c.titular || 'crédito'} vence em ${daysLeft === 0 ? 'hoje' : daysLeft + ' dia(s)'}.`,
          'warning'
        );
      }
    });

    // Metas em atraso (ano alvo já passou e progresso < 100%)
    const year = new Date().getFullYear();
    goals.forEach((g) => {
      const alvo = parseMoney(g.alvo || g.target || g.valorAlvo);
      const atual = parseMoney(g.atual || g.current || g.valorAtual);
      const ano = Number(g.ano || g.year || g.anoConclusao);
      if (alvo > 0 && atual < alvo && ano && ano < year) {
        notify('Meta em atraso', `A meta "${g.nome || g.name || 'Sem nome'}" passou do ano ${ano} e ainda não foi concluída.`, 'warning');
      }
    });

    // Gastos acima da média (mês atual vs anterior por categoria)
    const sumByCat = (list, key) => {
      const map = {};
      list.filter((d) => monthKey(d.data) === key).forEach((d) => {
        const cat = (d.categoria || 'Outros').trim();
        map[cat] = (map[cat] || 0) + parseMoney(d.valor);
      });
      return map;
    };
    const cur = sumByCat(despesas, cm);
    const prev = sumByCat(despesas, pm);
    Object.keys(cur).forEach((cat) => {
      const a = cur[cat];
      const b = prev[cat] || 0;
      if (b > 0 && a > b * 1.25 && a - b > 50) {
        const pct = Math.round(((a - b) / b) * 100);
        notify(
          'Gasto acima da média',
          `${cat}: ${formatBRL(a)} este mês (+${pct}% vs mês anterior).`,
          'info'
        );
      }
    });

    // Orçamento estourado
    const budgets = loadBudgets();
    Object.keys(budgets).forEach((cat) => {
      const limit = parseMoney(budgets[cat]);
      if (limit <= 0) return;
      const spent = cur[cat] || 0;
      if (spent >= limit) {
        notify('Orçamento estourado', `${cat}: ${formatBRL(spent)} de ${formatBRL(limit)} (${Math.round((spent / limit) * 100)}%).`, 'danger');
      } else if (spent >= limit * 0.85) {
        notify('Orçamento quase no limite', `${cat}: ${formatBRL(spent)} de ${formatBRL(limit)} (${Math.round((spent / limit) * 100)}%).`, 'warning');
      }
    });

    localStorage.setItem(ALERTS_META_KEY, JSON.stringify(meta));
    if (window.PrismaNotifications && window.PrismaNotifications.refresh) {
      window.PrismaNotifications.refresh();
    }
  }

  /* ========== 2. ORÇAMENTO POR CATEGORIA ========== */
  function categorySpendCurrentMonth() {
    const cm = currentMonthKey();
    const map = {};
    getDespesas().forEach((d) => {
      if (monthKey(d.data) !== cm) return;
      const cat = (d.categoria || 'Outros').trim() || 'Outros';
      map[cat] = (map[cat] || 0) + parseMoney(d.valor);
    });
    return map;
  }

  function allCategories() {
    const set = new Set();
    getDespesas().forEach((d) => set.add((d.categoria || 'Outros').trim() || 'Outros'));
    Object.keys(loadBudgets()).forEach((c) => set.add(c));
    ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Assinaturas', 'Outros'].forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function renderBudgetSection() {
    const root = $('#budgetEnvelopeRoot');
    if (!root) return;
    const budgets = loadBudgets();
    const spent = categorySpendCurrentMonth();
    const cats = allCategories();

    root.innerHTML = `
      <div class="budget-toolbar">
        <div>
          <h3>Orçamento por categoria</h3>
          <p>Defina limites mensais (método envelope) e acompanhe o uso.</p>
        </div>
        <div class="budget-toolbar-actions">
          <button type="button" class="btn secondary" id="budgetApplyPlanBtn"><i data-lucide="sparkles"></i> Aplicar plano 50-30-20</button>
          <button type="button" class="btn secondary" id="budgetAddCatBtn"><i data-lucide="plus"></i> Definir limite</button>
        </div>
      </div>
      <div class="budget-grid" id="budgetGrid"></div>
      <div class="budget-form-card" id="budgetFormCard" hidden>
        <div class="modal-grid">
          <div class="form-field">
            <label for="budgetCatSelect">Categoria</label>
            <select id="budgetCatSelect">${cats.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
          </div>
          <div class="form-field">
            <label for="budgetLimitInput">Limite mensal (R$)</label>
            <input type="text" id="budgetLimitInput" inputmode="decimal" placeholder="0,00" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="budgetCancelBtn">Cancelar</button>
          <button type="button" class="btn primary" id="budgetSaveBtn">Salvar limite</button>
        </div>
      </div>
    `;

    const grid = $('#budgetGrid', root);
    const defined = Object.keys(budgets).filter((c) => parseMoney(budgets[c]) > 0);
    if (!defined.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="pie-chart"></i></div><h4>Nenhum limite definido</h4><p>Clique em "Definir limite" para criar envelopes de orçamento.</p></div>`;
    } else {
      grid.innerHTML = defined.map((cat) => {
        const limit = parseMoney(budgets[cat]);
        const use = spent[cat] || 0;
        const pct = Math.min(100, Math.round((use / limit) * 100));
        const over = use > limit;
        const barClass = over ? 'over' : pct >= 85 ? 'warn' : 'ok';
        return `
          <div class="budget-card card">
            <div class="budget-card-head">
              <strong>${cat}</strong>
              <button type="button" class="btn ghost budget-remove" data-cat="${cat}" aria-label="Remover limite">×</button>
            </div>
            <div class="budget-amounts">${formatBRL(use)} <span>/ ${formatBRL(limit)}</span></div>
            <div class="budget-bar"><div class="budget-fill ${barClass}" style="width:${pct}%"></div></div>
            <div class="budget-meta">${pct}% usado${over ? ' · estourado' : ''}</div>
          </div>`;
      }).join('');
    }

    const formCard = $('#budgetFormCard', root);
    $('#budgetApplyPlanBtn', root)?.addEventListener('click', () => {
      const existing = Object.keys(loadBudgets()).filter((c) => parseMoney(loadBudgets()[c]) > 0);
      if (existing.length) {
        const ok = confirm('Isso substitui os limites atuais pelo plano 50-30-20. Continuar?\n\n(Os valores são calculados a partir da sua renda do mês.)');
        if (!ok) return;
      }
      applyMonthlyPlanToEnvelopes({ navigate: false });
    });
    $('#budgetAddCatBtn', root)?.addEventListener('click', () => { formCard.hidden = false; });
    $('#budgetCancelBtn', root)?.addEventListener('click', () => { formCard.hidden = true; });
    $('#budgetSaveBtn', root)?.addEventListener('click', () => {
      const cat = $('#budgetCatSelect', root)?.value;
      const limit = parseMoney($('#budgetLimitInput', root)?.value);
      if (!cat || limit <= 0) { toast('Informe categoria e limite válidos.'); return; }
      const b = loadBudgets();
      b[cat] = limit;
      saveBudgets(b);
      toast(`Limite de ${cat} salvo.`);
      renderBudgetSection();
      refreshIcons();
    });
    $all('.budget-remove', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const b = loadBudgets();
        delete b[btn.dataset.cat];
        saveBudgets(b);
        renderBudgetSection();
        refreshIcons();
      });
    });
    refreshIcons();
  }

  /* ========== 3. CONCILIAÇÃO DE CARTÃO ========== */
  function enhanceDespesaModal() {
    const form = $('#despesaForm');
    if (!form || form.dataset.conciliationReady) return;
    form.dataset.conciliationReady = '1';

    const wrap = document.createElement('div');
    wrap.className = 'modal-grid conciliation-fields';
    wrap.innerHTML = `
      <div class="form-field">
        <label for="despesaCartao">Cartão (opcional)</label>
        <select id="despesaCartao"><option value="">Nenhum</option></select>
      </div>
      <div class="form-field">
        <label for="despesaFaturaStatus">Status da fatura</label>
        <select id="despesaFaturaStatus">
          <option value="nao_aplicavel">Não se aplica</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
      </div>`;
    form.insertBefore(wrap, form.querySelector('.modal-actions') || form.lastElementChild);

    function fillCards() {
      const sel = $('#despesaCartao');
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">Nenhum</option>' + getCartoes().map((c, i) => {
        const label = `${c.banco || 'Cartão'} •••• ${c.numero || i}`;
        return `<option value="${i}">${label}</option>`;
      }).join('');
      sel.value = current;
    }
    fillCards();
    document.addEventListener('click', (e) => {
      if (e.target.closest('#addDespesaBtn') || e.target.closest('[data-action="edit-despesa"]')) {
        setTimeout(fillCards, 50);
      }
    });
  }

  function renderCardReconciliation() {
    const root = $('#cardReconciliationRoot');
    if (!root) return;
    const despesas = getDespesas();
    const cartoes = getCartoes();
    const linked = despesas.filter((d) => d.cartaoId !== undefined && d.cartaoId !== '' && d.cartaoId !== null);

    root.innerHTML = `
      <div class="budget-toolbar">
        <div>
          <h3>Conciliação de cartão</h3>
          <p>Despesas ligadas a faturas e status pago/pendente.</p>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table" id="conciliationTable">
          <thead><tr><th>Descrição</th><th>Cartão</th><th>Valor</th><th>Data</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>`;

    const tbody = root.querySelector('tbody');
    if (!linked.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Nenhuma despesa vinculada a cartão. Ao lançar uma despesa, escolha o cartão e o status da fatura.</td></tr>`;
      return;
    }

    linked.forEach((d, idx) => {
      const globalIdx = despesas.indexOf(d);
      const card = cartoes[Number(d.cartaoId)] || {};
      const status = d.faturaStatus || 'pendente';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.descricao || '—'}</td>
        <td>${card.banco || 'Cartão'} •••• ${card.numero || '—'}</td>
        <td>${formatBRL(d.valor)}</td>
        <td>${d.data || '—'}</td>
        <td><span class="status-pill ${status}">${status === 'pago' ? 'Pago' : status === 'pendente' ? 'Pendente' : 'N/A'}</span></td>
        <td>
          <button type="button" class="btn secondary toggle-fatura" data-index="${globalIdx}" style="min-height:32px;padding:0 10px;font-size:12px">
            ${status === 'pago' ? 'Marcar pendente' : 'Marcar pago'}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.toggle-fatura').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        const list = getDespesas();
        if (!list[i]) return;
        list[i].faturaStatus = list[i].faturaStatus === 'pago' ? 'pendente' : 'pago';
        try {
          if (typeof despesas !== 'undefined') {
            despesas[i].faturaStatus = list[i].faturaStatus;
            if (typeof saveData === 'function') saveData();
            else localStorage.setItem('prisma_despesas_data', JSON.stringify(despesas));
          } else {
            localStorage.setItem('prisma_despesas_data', JSON.stringify(list));
          }
        } catch (_) {
          localStorage.setItem('prisma_despesas_data', JSON.stringify(list));
        }
        toast('Status da fatura atualizado.');
        renderCardReconciliation();
      });
    });
  }

  // Patch despesa submit to capture cartao fields
  function patchDespesaSave() {
    const form = $('#despesaForm');
    if (!form || form.dataset.patchSave) return;
    form.dataset.patchSave = '1';
    form.addEventListener('submit', () => {
      setTimeout(() => {
        try {
          if (typeof despesas === 'undefined' || !despesas.length) return;
          const last = despesas[despesas.length - 1];
          const cartao = $('#despesaCartao')?.value;
          const status = $('#despesaFaturaStatus')?.value;
          if (cartao !== '' && cartao !== undefined) last.cartaoId = cartao;
          if (status) last.faturaStatus = status;
          if (typeof saveData === 'function') saveData();
          renderCardReconciliation();
        } catch (_) {}
      }, 100);
    });
  }

  /* ========== 4–6. INSIGHTS, PLANO MENSAL, CHIPS IA ========== */
  function buildInsights() {
    const despesas = getDespesas();
    const receitas = getReceitas();
    const cm = currentMonthKey();
    const pm = previousMonthKey();
    const insights = [];

    const sum = (list, key) => list.filter((x) => monthKey(x.data) === key).reduce((s, x) => s + parseMoney(x.valor), 0);
    const expCur = sum(despesas, cm);
    const expPrev = sum(despesas, pm);
    const incCur = sum(receitas, cm);

    if (expPrev > 0 && expCur > expPrev) {
      const pct = Math.round(((expCur - expPrev) / expPrev) * 100);
      insights.push({
        title: 'Gastos em alta',
        text: `Você gastou ${formatBRL(expCur)} este mês, ${pct}% a mais que no mês anterior (${formatBRL(expPrev)}).`,
        action: 'Revise categorias de lazer e assinaturas.'
      });
    } else if (expPrev > 0 && expCur < expPrev) {
      const pct = Math.round(((expPrev - expCur) / expPrev) * 100);
      insights.push({
        title: 'Economia no mês',
        text: `Gastos ${pct}% menores que o mês anterior. Ótimo progresso!`,
        action: 'Direcione a diferença para uma meta ou reserva.'
      });
    }

    // Top category spike
    const byCat = {};
    despesas.filter((d) => monthKey(d.data) === cm).forEach((d) => {
      const c = d.categoria || 'Outros';
      byCat[c] = (byCat[c] || 0) + parseMoney(d.valor);
    });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      insights.push({
        title: `Maior gasto: ${top[0]}`,
        text: `${top[0]} concentra ${formatBRL(top[1])} este mês.`,
        action: expCur > 0 ? `Isso representa ${Math.round((top[1] / expCur) * 100)}% das despesas do mês.` : ''
      });
    }

    if (incCur > 0) {
      const rate = Math.round(((incCur - expCur) / incCur) * 100);
      insights.push({
        title: 'Taxa de poupança',
        text: `Você está guardando cerca de ${rate}% da renda deste mês.`,
        action: rate < 10 ? 'Tente chegar perto de 20% com cortes graduais.' : 'Excelente ritmo de poupança.'
      });
    }

    const goals = getGoals();
    goals.forEach((g) => {
      const alvo = parseMoney(g.alvo || g.target || g.valorAlvo);
      const atual = parseMoney(g.atual || g.current || g.valorAtual);
      if (alvo > 0) {
        const pct = Math.round((atual / alvo) * 100);
        insights.push({
          title: `Meta: ${g.nome || g.name || 'Objetivo'}`,
          text: `${pct}% concluída (${formatBRL(atual)} de ${formatBRL(alvo)}).`,
          action: pct < 50 ? 'Aumente o aporte mensal para acelerar.' : 'Continue consistente.'
        });
      }
    });

    if (!insights.length) {
      insights.push({
        title: 'Sem dados suficientes',
        text: 'Adicione receitas e despesas para gerar insights personalizados.',
        action: 'Comece pelo Dashboard ou pela seção Receitas.'
      });
    }
    return insights;
  }

  function renderInsightsPanel() {
    const root = $('#aiInsightsRoot');
    if (!root) return;
    const insights = buildInsights();
    root.innerHTML = insights.map((i) => `
      <div class="insight-card">
        <strong>${i.title}</strong>
        <p>${i.text}</p>
        ${i.action ? `<span class="insight-action">${i.action}</span>` : ''}
      </div>`).join('');
  }

  function computeMonthlyPlan() {
    const receitas = getReceitas();
    const despesas = getDespesas();
    const cm = currentMonthKey();
    let income = receitas.filter((r) => monthKey(r.data) === cm).reduce((s, r) => s + parseMoney(r.valor), 0);
    if (income <= 0 && receitas.length) {
      const months = Math.max(1, new Set(receitas.map((r) => monthKey(r.data)).filter(Boolean)).size);
      income = receitas.reduce((s, r) => s + parseMoney(r.valor), 0) / months;
    }
    // fallback: salário salvo no resumo
    if (income <= 0) {
      try {
        if (typeof salarioMensal !== 'undefined' && Number(salarioMensal) > 0) income = Number(salarioMensal);
      } catch (_) {}
    }

    const needs = income * 0.5;
    const wants = income * 0.3;
    const save = income * 0.2;

    const byCat = {};
    despesas.filter((d) => monthKey(d.data) === cm).forEach((d) => {
      const c = (d.categoria || 'Outros').trim() || 'Outros';
      byCat[c] = (byCat[c] || 0) + parseMoney(d.valor);
    });

    // Limites sugeridos (sobre a renda)
    const envelopes = {
      'Moradia': Math.round(income * 0.30 * 100) / 100,
      'Alimentação': Math.round(income * 0.15 * 100) / 100,
      'Transporte': Math.round(income * 0.10 * 100) / 100,
      'Saúde': Math.round(income * 0.05 * 100) / 100,
      'Educação': Math.round(income * 0.05 * 100) / 100,
      'Lazer': Math.round(income * 0.10 * 100) / 100,
      'Assinaturas': Math.round(income * 0.05 * 100) / 100,
      'Outros': Math.round(income * 0.05 * 100) / 100,
      'Poupança/Metas': Math.round(save * 100) / 100
    };

    return { income, needs, wants, save, byCat, envelopes };
  }

  function generateMonthlyPlan() {
    const plan = computeMonthlyPlan();
    if (plan.income <= 0) {
      return 'Não encontrei renda suficiente para montar o plano.\nCadastre receitas do mês (ou informe o salário em Meus Dados) e tente de novo.';
    }
    const lines = [
      `📋 Plano mensal sugerido (regra 50-30-20)`,
      `Renda de referência: ${formatBRL(plan.income)}`,
      `• Necessidades (50%): ${formatBRL(plan.needs)}`,
      `• Desejos (30%): ${formatBRL(plan.wants)}`,
      `• Poupança/Metas (20%): ${formatBRL(plan.save)}`,
      '',
      'Limites por categoria (envelopes):'
    ];
    Object.entries(plan.envelopes).forEach(([c, limit]) => {
      if (c === 'Poupança/Metas') {
        lines.push(`• ${c}: ${formatBRL(limit)}`);
      } else {
        lines.push(`• ${c}: até ${formatBRL(limit)} (hoje: ${formatBRL(plan.byCat[c] || 0)})`);
      }
    });
    lines.push('', '✅ Use "Aplicar plano 50-30-20" em Despesas → Orçamento para gravar esses limites automaticamente.');
    return lines.join('\n');
  }

  function applyMonthlyPlanToEnvelopes(opts) {
    const plan = computeMonthlyPlan();
    if (plan.income <= 0) {
      toast('Cadastre receitas (ou salário) antes de aplicar o plano.');
      return false;
    }
    const merge = !!(opts && opts.merge);
    const next = merge ? { ...loadBudgets() } : {};
    Object.entries(plan.envelopes).forEach(([cat, limit]) => {
      if (limit > 0) next[cat] = limit;
    });
    saveBudgets(next);
    toast('Plano 50-30-20 aplicado nos envelopes de orçamento.');
    notify(
      'Orçamento atualizado',
      `Limites 50-30-20 gravados com base na renda de ${formatBRL(plan.income)}.`,
      'info'
    );
    renderBudgetSection();
    renderInsightsPanel();
    refreshIcons();
    // navega para despesas para o usuário ver
    const nav = document.querySelector('.nav-item[data-section="despesas"]');
    if (nav && opts && opts.navigate !== false) {
      setTimeout(() => nav.click(), 250);
    }
    return true;
  }

  function setupAIChips() {
    const chat = $('#aiChat');
    const input = $('#aiInput');
    const send = $('#aiSend');
    if (!chat || chat.dataset.chipsReady) return;
    chat.dataset.chipsReady = '1';

    const bar = document.createElement('div');
    bar.className = 'ai-chips';
    bar.innerHTML = `
      <button type="button" class="ai-chip" data-q="Onde posso cortar gastos?">Onde posso cortar gastos?</button>
      <button type="button" class="ai-chip" data-q="Estou no caminho da minha meta?">Estou no caminho da minha meta?</button>
      <button type="button" class="ai-chip" data-q="Resumo do mês">Resumo do mês</button>
      <button type="button" class="ai-chip" data-q="Gerar plano mensal">Gerar plano mensal</button>
      <button type="button" class="ai-chip" data-q="Aplicar plano nos envelopes">Aplicar plano nos envelopes</button>
    `;
    const inputWrap = chat.parentElement?.querySelector('.ai-input');
    if (inputWrap) inputWrap.parentElement.insertBefore(bar, inputWrap);
    else chat.after(bar);

    function botReply(text) {
      const msg = document.createElement('div');
      msg.className = 'ai-msg bot';
      const avatar = document.createElement('span');
      avatar.className = 'ai-avatar';
      avatar.innerHTML = '<i data-lucide="bot"></i>';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      msg.append(avatar, bubble);
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
      refreshIcons();
    }

    function answer(q) {
      const user = document.createElement('div');
      user.className = 'ai-msg user';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = q;
      user.appendChild(bubble);
      chat.appendChild(user);

      const insights = buildInsights();
      let reply = '';
      if (/cortar|economizar|gastos/i.test(q)) {
        reply = insights.filter((i) => /gasto|maior|alta/i.test(i.title)).map((i) => `• ${i.title}: ${i.text} ${i.action || ''}`).join('\n')
          || 'Ainda não há padrões claros. Cadastre mais despesas por categoria para eu indicar cortes.';
      } else if (/meta/i.test(q)) {
        reply = insights.filter((i) => /meta/i.test(i.title)).map((i) => `• ${i.text} ${i.action || ''}`).join('\n')
          || 'Você ainda não tem metas cadastradas. Crie uma em Metas para eu acompanhar o progresso.';
      } else if (/resumo/i.test(q)) {
        reply = insights.map((i) => `• ${i.title}: ${i.text}`).join('\n');
      } else if (/aplicar plano|aplicar.*50|aplicar.*envelope/i.test(q)) {
        const ok = applyMonthlyPlanToEnvelopes({ navigate: true });
        reply = ok
          ? 'Pronto! Apliquei o plano 50-30-20 nos envelopes de orçamento. Você já pode ver os limites em Despesas → Orçamento.'
          : 'Não consegui aplicar o plano. Cadastre receitas do mês e tente novamente.';
      } else if (/plano/i.test(q)) {
        reply = generateMonthlyPlan() + '\n\nDica: diga "Aplicar plano nos envelopes" ou use o botão em Despesas → Orçamento.';
      } else {
        reply = insights.slice(0, 3).map((i) => `• ${i.title}: ${i.text}`).join('\n');
      }
      setTimeout(() => botReply(reply), 350);
    }

    bar.querySelectorAll('.ai-chip').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.q));
    });

    // Also enhance free-text for known intents
    function handleFreeTextInput() {
      const q = (input?.value || '').trim();
      if (!q) return;
      input.value = '';
      answer(q);
    }
    
    send?.addEventListener('click', handleFreeTextInput);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleFreeTextInput();
    });

    // Plan button
    const planBtn = document.createElement('button');
    planBtn.className = 'btn secondary ai-plan-btn';
    planBtn.innerHTML = '<i data-lucide="clipboard-list"></i> Gerar plano mensal';
    planBtn.addEventListener('click', () => answer('Gerar plano mensal'));
    const analyze = $('#aiAnalyze');
    if (analyze) analyze.parentElement.insertBefore(planBtn, analyze.nextSibling);
    refreshIcons();
  }

  /* ========== 7. DASHBOARD EMPTY STATE ========== */
  function shouldShowDashboardEmpty() {
    const receitas = getReceitas();
    const despesas = getDespesas();
    const metas = getGoals();
    return Array.isArray(receitas) && receitas.length === 0
      && Array.isArray(despesas) && despesas.length === 0
      && Array.isArray(metas) && metas.length === 0;
  }

  function updateDashboardEmpty() {
    const section = $('#dashboard');
    if (!section) return;
    let empty = $('#dashboardEmptyState', section);

    if (!shouldShowDashboardEmpty()) {
      empty?.remove();
      return;
    }

    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'dashboardEmptyState';
      empty.className = 'dashboard-empty card';
      empty.setAttribute('role', 'status');
      empty.innerHTML = `
        <div class="empty-icon"><i data-lucide="layout-dashboard"></i></div>
        <h3>Comece sua jornada financeira</h3>
        <p>O dashboard ganha vida quando você adiciona os primeiros lançamentos.</p>
        <div class="empty-actions">
          <button type="button" class="btn primary" data-action="add-receita"><i data-lucide="plus"></i> Adicionar primeira receita</button>
          <button type="button" class="btn secondary" data-action="add-despesa"><i data-lucide="plus"></i> Registrar despesa</button>
          <button type="button" class="btn secondary" data-action="add-meta"><i data-lucide="target"></i> Criar meta</button>
        </div>`;
      const dashboardGrid = section.querySelector('.dash-grid-layout');
      if (dashboardGrid) dashboardGrid.before(empty);
      else section.prepend(empty);

      empty.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          // Preferir abrir o modal existente; fallback: navegar para a seção
          const map = {
            'add-receita': { btnId: 'addReceitaBtn', section: 'receitas' },
            'add-despesa': { btnId: 'addDespesaBtn', section: 'despesas' },
            'add-meta': { btnId: 'addMetaBtn', section: 'metas' }
          };
          const cfg = map[action];
          if (!cfg) return;
          const trigger = document.getElementById(cfg.btnId);
          if (trigger) {
            trigger.click();
            return;
          }
          const nav = document.querySelector(`.nav-item[data-section="${cfg.section}"]`);
          if (nav) nav.click();
        });
      });
      refreshIcons();
    }
  }

  /* ========== 8. FILTROS E BUSCA ========== */
  function installFilters(sectionId, tbodyId, type) {
    const section = document.getElementById(sectionId);
    const tbody = document.getElementById(tbodyId);
    if (!section || !tbody || section.dataset.filtersReady) return;
    section.dataset.filtersReady = '1';

    const bar = document.createElement('div');
    bar.className = 'list-filters';
    bar.innerHTML = `
      <input type="search" class="filter-search" placeholder="Buscar descrição, valor..." aria-label="Buscar" />
      <select class="filter-period" aria-label="Período">
        <option value="all">Todo período</option>
        <option value="month">Mês atual</option>
        <option value="prev">Mês anterior</option>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="year">Ano atual</option>
        <option value="custom">Intervalo personalizado</option>
      </select>
      <input type="date" class="filter-from" hidden aria-label="Data inicial" />
      <input type="date" class="filter-to" hidden aria-label="Data final" />
      <select class="filter-category" aria-label="Categoria"><option value="all">Todas categorias</option></select>
      <button type="button" class="btn secondary filter-clear">Limpar</button>
      <span class="filter-count" aria-live="polite"></span>
    `;
    const card = section.querySelector('.table-card .card-head') || section.querySelector('.section-heading');
    if (card) card.after(bar);

    const periodSel = bar.querySelector('.filter-period');
    const fromInput = bar.querySelector('.filter-from');
    const toInput = bar.querySelector('.filter-to');
    const countEl = bar.querySelector('.filter-count');

    function refreshCategoryOptions() {
      const sel = bar.querySelector('.filter-category');
      const data = type === 'receita' ? getReceitas() : getDespesas();
      const cats = [...new Set(data.map((x) => (x.categoria || x.origem || 'Outros').trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const cur = sel.value;
      sel.innerHTML = '<option value="all">Todas categorias</option>' + cats.map((c) => `<option value="${c}">${c}</option>`).join('');
      if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
      else sel.value = 'all';
    }

    function rowDate(tr) {
      const tds = tr.querySelectorAll('td');
      // colunas típicas: cat/origem, desc, conta, valor, data, status, ações
      const candidates = [tds[4], tds[3], tds[5], tds[2]];
      for (const td of candidates) {
        if (!td) continue;
        const txt = (td.textContent || '').trim();
        const d = parseBRDate(txt);
        if (d) return d;
      }
      // fallback: qualquer célula com cara de data
      for (const td of tds) {
        const txt = (td.textContent || '').trim();
        if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(txt)) {
          const d = parseBRDate(txt);
          if (d) return d;
        }
      }
      return null;
    }

    function rowCategory(tr) {
      const tds = tr.querySelectorAll('td');
      return (tds[0]?.textContent || '').trim();
    }

    function inPeriod(d, period) {
      if (!d || period === 'all') return true;
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cm = currentMonthKey();
      const pm = previousMonthKey();
      const today = startOfDay(new Date());

      if (period === 'month') return mk === cm;
      if (period === 'prev') return mk === pm;
      if (period === 'year') return d.getFullYear() === today.getFullYear();
      if (period === '7') return d >= daysAgo(7);
      if (period === '30') return d >= daysAgo(30);
      if (period === '90') return d >= daysAgo(90);
      if (period === 'custom') {
        const from = fromInput.value ? parseBRDate(fromInput.value) : null;
        const to = toInput.value ? parseBRDate(toInput.value) : null;
        if (from && d < startOfDay(from)) return false;
        if (to) {
          const end = startOfDay(to);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
        return true;
      }
      return true;
    }

    function apply() {
      const q = (bar.querySelector('.filter-search').value || '').toLowerCase().trim();
      const period = periodSel.value;
      const cat = bar.querySelector('.filter-category').value;
      let visible = 0;
      let total = 0;

      $all('tr', tbody).forEach((tr) => {
        total += 1;
        const text = tr.textContent.toLowerCase();
        const d = rowDate(tr);
        const catText = rowCategory(tr);
        let ok = true;
        if (q && !text.includes(q)) ok = false;
        if (cat !== 'all' && catText !== cat) ok = false;
        if (!inPeriod(d, period)) ok = false;
        // se filtro de período ativo e linha sem data parseável, esconde
        if (period !== 'all' && !d) ok = false;
        tr.style.display = ok ? '' : 'none';
        if (ok) visible += 1;
      });

      if (countEl) {
        countEl.textContent = total ? `${visible} de ${total}` : '';
      }
    }

    periodSel.addEventListener('change', () => {
      const custom = periodSel.value === 'custom';
      fromInput.hidden = !custom;
      toInput.hidden = !custom;
      apply();
    });
    fromInput.addEventListener('change', apply);
    toInput.addEventListener('change', apply);
    bar.querySelector('.filter-search').addEventListener('input', apply);
    bar.querySelector('.filter-category').addEventListener('change', apply);
    bar.querySelector('.filter-clear').addEventListener('click', () => {
      bar.querySelector('.filter-search').value = '';
      periodSel.value = 'all';
      bar.querySelector('.filter-category').value = 'all';
      fromInput.value = '';
      toInput.value = '';
      fromInput.hidden = true;
      toInput.hidden = true;
      apply();
    });

    const obs = new MutationObserver(() => { refreshCategoryOptions(); apply(); });
    obs.observe(tbody, { childList: true });
    refreshCategoryOptions();
    apply();
  }

  /* ========== 9. EXPORTAÇÃO COMPLETA ========== */
  function exportFullBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      receitas: getReceitas(),
      despesas: getDespesas(),
      cartoes: getCartoes(),
      goals: getGoals(),
      budgets: loadBudgets(),
      saldo: getSaldo()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prisma-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notifyAction('Backup gerado', 'Backup completo (JSON) baixado com sucesso.', 'backup');
  }

  function exportTransactionsCSV() {
    const rows = [['Tipo', 'Categoria', 'Descrição', 'Valor', 'Data', 'Conta', 'Cartão', 'Status Fatura']];
    getReceitas().forEach((r) => {
      rows.push(['Receita', r.categoria || r.origem || '', r.descricao || '', parseMoney(r.valor), r.data || '', r.conta || '', '', '']);
    });
    getDespesas().forEach((d) => {
      const card = getCartoes()[Number(d.cartaoId)] || {};
      rows.push(['Despesa', d.categoria || '', d.descricao || '', parseMoney(d.valor), d.data || '', d.conta || '', card.banco || '', d.faturaStatus || '']);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prisma-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notifyAction('Transações exportadas', 'CSV completo de receitas e despesas baixado.', 'export');
  }

  function enhanceReports() {
    const actions = document.querySelector('.report-actions');
    if (!actions || actions.dataset.enhanced) return;
    actions.dataset.enhanced = '1';
    const backupBtn = document.createElement('button');
    backupBtn.className = 'btn export backup';
    backupBtn.innerHTML = '<i data-lucide="database"></i> Backup completo (JSON)';
    backupBtn.addEventListener('click', exportFullBackup);
    actions.appendChild(backupBtn);

    // Improve existing CSV buttons
    actions.querySelectorAll('.btn.export.csv, .btn.export.excel').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        // After default, also offer richer export
        setTimeout(exportTransactionsCSV, 300);
      }, { once: false });
    });
    refreshIcons();
  }

  function refreshIcons() {
    try {
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    } catch (_) {}
  }

  /* ========== INIT ========== */
  function injectHTML() {
    // Budget + conciliation under despesas section area - add dedicated blocks in dashboard content end
    const despesasSection = $('#despesas');
    if (despesasSection && !$('#budgetEnvelopeRoot')) {
      const budget = document.createElement('div');
      budget.className = 'card budget-section fade-in';
      budget.id = 'budgetEnvelopeRoot';
      budget.style.marginTop = '16px';
      despesasSection.appendChild(budget);

      const conc = document.createElement('div');
      conc.className = 'card conciliation-section fade-in';
      conc.id = 'cardReconciliationRoot';
      conc.style.marginTop = '16px';
      despesasSection.appendChild(conc);
    }

    const aiSection = $('#prisma-ai .ai-hero') || $('#prisma-ai');
    if (aiSection && !$('#aiInsightsRoot')) {
      const panel = document.createElement('div');
      panel.className = 'ai-insights-panel';
      panel.innerHTML = `<h4>Insights com base nos seus dados</h4><div id="aiInsightsRoot" class="insights-grid"></div>`;
      const suggestions = $('#aiSuggestions');
      if (suggestions) suggestions.before(panel);
      else aiSection.appendChild(panel);
    }
  }

  function init() {
    injectHTML();
    enhanceDespesaModal();
    patchDespesaSave();
    renderBudgetSection();
    renderCardReconciliation();
    renderInsightsPanel();
    setupAIChips();
    updateDashboardEmpty();
    installFilters('receitas', 'receitasBody', 'receita');
    installFilters('despesas', 'despesasBody', 'despesa');
    const dashTable = $('#transactionsBody');
    if (dashTable) installFilters('dashboard', 'transactionsBody', 'despesa');
    enhanceReports();
    installPersistentToastBridge();
    setTimeout(runSmartAlerts, 1200);
    // Garante API global de notificação persistente
    window.PrismaNotify = notify;
    window.PrismaNotifyAction = notifyAction;

    // Refresh on section navigation
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
      item.addEventListener('click', () => {
        setTimeout(() => {
          updateDashboardEmpty();
          renderBudgetSection();
          renderCardReconciliation();
          renderInsightsPanel();
          refreshIcons();
        }, 200);
      });
    });

    // Periodic empty-state check after saves
    setInterval(updateDashboardEmpty, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }

  window.PrismaEnhancements = {
    runSmartAlerts,
    renderBudgetSection,
    renderInsightsPanel,
    generateMonthlyPlan,
    computeMonthlyPlan,
    applyMonthlyPlanToEnvelopes,
    exportFullBackup,
    exportTransactionsCSV,
    notify,
    notifyAction,
    updateDashboardEmpty
  };
})();
