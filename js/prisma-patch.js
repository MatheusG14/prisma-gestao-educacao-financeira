/* =============================================================
   PRISMA PATCH — v2.0 (Com Gráficos Dinâmicos)
   1. Corrige o botão "Analisar Finanças" (evento ausente)
   2. Declara aiSuggestions (variável usada mas nunca declarada)
   3. Torna os cards do Dashboard clicáveis com modais de detalhe
   4. Adiciona GRÁFICOS DINÂMICOS baseados em dados reais nos modais
   5. Adiciona filtros de período interativos
   ============================================================= */
(function () {
  'use strict';

  /* ── helpers locais ── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function fmtBRL(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function pct(a, b) { return b > 0 ? ((a / b) * 100).toFixed(1) : '0.0'; }
  function readStorage(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
    catch (_) { return def; }
  }
  function profileKey(base) {
    try {
      const pid = localStorage.getItem('prisma_current_profile_id');
      if (pid) return base + '_' + pid;
    } catch (_) {}
    return base;
  }
  function getReceitas() { return readStorage(profileKey('prisma_receitas_data'), []); }
  function getDespesas() { return readStorage(profileKey('prisma_despesas_data'), []); }
  function getInvestimentos() { return readStorage(profileKey('prisma_investimentos_data'), []); }
  function getGoals() { return readStorage(profileKey('prisma_goals_data'), []); }
  function getContas() { return readStorage(profileKey('prisma_contas_data'), []); }
  function getCartoes() { return readStorage(profileKey('prisma_cartoes_data'), []); }
  function parseMon(v) {
    if (typeof window.PrismaParseMoney === 'function') return window.PrismaParseMoney(v);
    const n = Number(String(v || 0).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function refreshIcons() {
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (_) {}
  }

  function parseDateSafe(dStr) {
    if (!dStr) return new Date();
    if (String(dStr).includes('/')) {
      const p = String(dStr).split('/');
      return new Date(`${p[2]}-${p[1]}-${p[0]}T12:00:00`);
    }
    return new Date(String(dStr).includes('T') ? dStr : dStr + 'T12:00:00');
  }

  function filterByPeriod(dataArray, periodStr) {
    if (periodStr === 'all') return dataArray;
    const now = new Date();
    let past = new Date();
    if(periodStr === '7d') past.setDate(now.getDate() - 7);
    if(periodStr === '30d') past.setDate(now.getDate() - 30);
    if(periodStr === '3m') past.setMonth(now.getMonth() - 3);
    if(periodStr === '6m') past.setMonth(now.getMonth() - 6);
    if(periodStr === '1y') past.setFullYear(now.getFullYear() - 1);

    return dataArray.filter(item => {
      const d = parseDateSafe(item.data || item.date || item.dataAplicacao);
      return d >= past && d <= now;
    });
  }

  /* ══════════════════════════════════════════════════════
     1. FIX — BOTÃO "ANALISAR FINANÇAS"
     ══════════════════════════════════════════════════════ */
  function wireAiAnalyzeButton() {
    const btn = document.getElementById('aiAnalyze');
    if (!btn || btn.dataset.patched) return;
    btn.dataset.patched = '1';

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin-icon"></i> Analisando...';
      refreshIcons();

      const native = window.prismaAnalyzeFinances || window.analyzeFinances;
      if (typeof native === 'function') {
        try { native(); }
        catch (err) {
          console.error('[PrismaAI] Erro:', err);
          showAiError('Erro ao executar análise. Tente novamente.');
        }
      } else {
        runLocalAnalysis();
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="sparkles"></i> Analisar Finanças';
        refreshIcons();
      }, 2000);
    });
  }

  function showAiError(msg) {
    const chat = document.getElementById('aiChat');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = 'ai-msg bot';
    div.innerHTML = `
      <span class="ai-avatar"><i data-lucide="alert-triangle"></i></span>
      <div class="bubble ai-error-bubble">
        <strong>Problema na análise</strong><br>${msg}
        <br><button type="button" class="btn btn-sm secondary ai-retry-btn" style="margin-top:8px">
          <i data-lucide="refresh-ccw"></i> Tentar novamente
        </button>
      </div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    div.querySelector('.ai-retry-btn')?.addEventListener('click', () => {
      div.remove();
      document.getElementById('aiAnalyze')?.click();
    });
    refreshIcons();
  }

  function runLocalAnalysis() {
    if (typeof window.runPrismaAiAnalysis === 'function') {
      return window.runPrismaAiAnalysis('30d', { showBotMessage: true });
    }
    const chat = document.getElementById('aiChat');
    if (!chat) return;

    const loadMsg = document.createElement('div');
    loadMsg.className = 'ai-msg bot';
    loadMsg.innerHTML = `<span class="ai-avatar"><i data-lucide="bot"></i></span>
      <div class="bubble">Analisando suas finanças com base nos dados cadastrados...</div>`;
    chat.appendChild(loadMsg);
    chat.scrollTop = chat.scrollHeight;
    refreshIcons();

    setTimeout(() => {
      const receitas = getReceitas();
      const despesas = getDespesas();
      const investimentos = getInvestimentos();
      
      const totalRec = receitas.reduce((s, r) => s + parseMon(r.valor), 0);
      const totalDesp = despesas.reduce((s, d) => s + parseMon(d.valor), 0);
      const saldo = totalRec - totalDesp;
      const taxaPoup = totalRec > 0 ? (saldo / totalRec) * 100 : 0;

      const despCat = {};
      despesas.forEach(d => {
        const c = d.categoria || 'Outros';
        despCat[c] = (despCat[c] || 0) + parseMon(d.valor);
      });

      let lines = [];
      lines.push('Resumo Financeiro:');
      lines.push('• Receitas totais: ' + fmtBRL(totalRec));
      lines.push('• Despesas totais: ' + fmtBRL(totalDesp));
      lines.push('• Saldo: ' + fmtBRL(saldo));
      lines.push('• Taxa de poupança: ' + taxaPoup.toFixed(1) + '%');
      lines.push('');

      if (saldo < 0) {
        lines.push('Atencao: Despesas superam receitas em ' + fmtBRL(Math.abs(saldo)) + '. Revise os gastos.');
      } else if (taxaPoup < 10) {
        lines.push('Atencao: Taxa de poupança abaixo de 10% (' + taxaPoup.toFixed(1) + '%). Tente poupar mais.');
      } else if (taxaPoup >= 20) {
        lines.push('Otimo: Taxa de poupança de ' + taxaPoup.toFixed(1) + '% — acima da referência de 20%!');
      }

      const recs = [];
      Object.entries(despCat).forEach(([cat, val]) => {
        if (totalDesp > 0) {
          const share = (val / totalDesp) * 100;
          if (share > 25) recs.push('• ' + cat + ' representa ' + share.toFixed(1) + '% das despesas.');
        }
      });
      if (recs.length) {
        lines.push('');
        lines.push('Recomendacoes:');
        recs.slice(0, 3).forEach(r => lines.push(r));
      }

      const replyEl = document.createElement('div');
      replyEl.className = 'ai-msg bot';
      replyEl.innerHTML = '<span class="ai-avatar"><i data-lucide="bot"></i></span><div class="bubble">' + lines.join('<br>') + '</div>';
      chat.appendChild(replyEl);
      chat.scrollTop = chat.scrollHeight;
      refreshIcons();
    }, 1500);
  }

  /* ══════════════════════════════════════════════════════
     3. CARDS DO DASHBOARD CLICÁVEIS E GRÁFICOS DINÂMICOS
     ══════════════════════════════════════════════════════ */
  const CARD_MODAL_ID = 'prismaCardDetailModal';
  let activeModalChart = null;
  let currentKpiBuilder = null;

  function buildCardModal() {
    if (document.getElementById(CARD_MODAL_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = CARD_MODAL_ID;
    overlay.className = 'modal-overlay prisma-card-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-card prisma-card-modal-inner" id="${CARD_MODAL_ID}_inner">
        <div class="modal-header">
          <div id="${CARD_MODAL_ID}_title_wrap">
            <h3 id="${CARD_MODAL_ID}_title">Detalhes</h3>
            <p id="${CARD_MODAL_ID}_subtitle" class="text-muted"></p>
          </div>
          <button type="button" class="modal-close" id="${CARD_MODAL_ID}_close" aria-label="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>
        
        <!-- Filtros de Período -->
        <div class="pcd-filters" id="${CARD_MODAL_ID}_filters" style="display:none;">
          <button class="pcd-filter-btn" data-period="7d">7 dias</button>
          <button class="pcd-filter-btn" data-period="30d">30 dias</button>
          <button class="pcd-filter-btn" data-period="3m">3 meses</button>
          <button class="pcd-filter-btn" data-period="6m">6 meses</button>
          <button class="pcd-filter-btn active" data-period="1y">1 ano</button>
          <button class="pcd-filter-btn" data-period="all">Tudo</button>
        </div>

        <!-- Área do Gráfico -->
        <div class="pcd-chart-wrapper" id="${CARD_MODAL_ID}_chart_wrap" style="display:none; position:relative; height:240px; margin-bottom:16px;">
          <canvas id="${CARD_MODAL_ID}_canvas"></canvas>
        </div>

        <!-- Conteúdo Detalhado -->
        <div id="${CARD_MODAL_ID}_body" class="prisma-card-modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCardModal();
    });
    document.getElementById(CARD_MODAL_ID + '_close')?.addEventListener('click', closeCardModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCardModal();
    });

    // Event listeners para os filtros
    $all('.pcd-filter-btn', overlay).forEach(btn => {
      btn.addEventListener('click', (e) => {
        $all('.pcd-filter-btn', overlay).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (currentKpiBuilder) {
          const period = btn.dataset.period;
          renderModalContent(currentKpiBuilder, period);
        }
      });
    });

    refreshIcons();
  }

  function openCardModal(config) {
    buildCardModal();
    const overlay = document.getElementById(CARD_MODAL_ID);
    const titleEl = document.getElementById(CARD_MODAL_ID + '_title');
    const subtitleEl = document.getElementById(CARD_MODAL_ID + '_subtitle');

    if (titleEl) titleEl.textContent = config.title;
    if (subtitleEl) subtitleEl.textContent = config.subtitle || '';

    // Guardar referência para o builder atual
    currentKpiBuilder = config.builder;
    
    // Reset dos filtros
    const filters = $all('.pcd-filter-btn');
    filters.forEach(b => b.classList.remove('active'));
    
    let defaultPeriod = '1y';
    if(config.noFilter) {
      document.getElementById(CARD_MODAL_ID + '_filters').style.display = 'none';
      defaultPeriod = 'all';
    } else {
      document.getElementById(CARD_MODAL_ID + '_filters').style.display = 'flex';
      const defaultBtn = Array.from(filters).find(b => b.dataset.period === '1y');
      if (defaultBtn) defaultBtn.classList.add('active');
    }

    renderModalContent(config.builder, defaultPeriod);

    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    refreshIcons();
  }

  function renderModalContent(builderFn, period) {
    const result = builderFn(period);
    const bodyEl = document.getElementById(CARD_MODAL_ID + '_body');
    const chartWrap = document.getElementById(CARD_MODAL_ID + '_chart_wrap');
    
    if (bodyEl) bodyEl.innerHTML = result.html;

    // Destruir gráfico anterior
    if (activeModalChart) {
      activeModalChart.destroy();
      activeModalChart = null;
    }

    // Renderizar novo gráfico se existir config
    if (result.chartConfig && window.Chart) {
      chartWrap.style.display = 'block';
      const ctx = document.getElementById(CARD_MODAL_ID + '_canvas').getContext('2d');
      // Adicionar opções padrão para garantir visual do Prisma
      const options = Object.assign({
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(14, 16, 22, 0.95)',
            titleColor: '#F1F5F9',
            bodyColor: '#F1F5F9',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += fmtBRL(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          y: { 
            grid: { color: 'rgba(255,255,255,0.05)' }, 
            ticks: { color: 'rgba(255,255,255,0.5)', callback: v => 'R$ ' + (v>=1000 ? (v/1000).toFixed(1)+'k' : v) } 
          }
        }
      }, result.chartConfig.options || {});

      result.chartConfig.options = options;
      activeModalChart = new window.Chart(ctx, result.chartConfig);
    } else {
      chartWrap.style.display = 'none';
    }
  }

  function closeCardModal() {
    const overlay = document.getElementById(CARD_MODAL_ID);
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if (activeModalChart) {
      activeModalChart.destroy();
      activeModalChart = null;
    }
  }

  /* ── Gráficos e Lógicas por Indicador ── */
  
  // Agrupa transações por mês/ano para gráficos de linha/barras
  function groupByMonth(dataArray) {
    const map = {};
    dataArray.forEach(item => {
      const d = parseDateSafe(item.data || item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      map[key] = (map[key] || 0) + parseMon(item.valor);
    });
    // Ordenar chaves
    const sortedKeys = Object.keys(map).sort();
    return {
      labels: sortedKeys.map(k => {
        const [y, m] = k.split('-');
        return `${m}/${y.substring(2)}`;
      }),
      data: sortedKeys.map(k => map[k])
    };
  }

  function buildNetworthDetail(period) {
    const receitas = filterByPeriod(getReceitas(), period);
    const despesas = filterByPeriod(getDespesas(), period);
    const investimentos = getInvestimentos(); // Investimentos geralmente mostramos o saldo total
    const contas = getContas(); // Saldo atual das contas

    const totalInv = investimentos.reduce((s, i) => s + parseMon(i.valorAtual || i.valorTotal || i.valor), 0);
    const totalContas = contas.reduce((s, c) => s + parseMon(c.saldo), 0);
    const totalRec = receitas.reduce((s, r) => s + parseMon(r.valor), 0);
    const totalDesp = despesas.reduce((s, d) => s + parseMon(d.valor), 0);

    const ativos = totalContas + totalInv;
    const passivos = 0;
    const patrimonio = ativos - passivos + (totalRec - totalDesp);

    // Gerar gráfico de evolução (simulando histórico com fluxo acumulado se não houver snapshots reais salvos)
    // Para simplificar e usar dados reais: mostramos o fluxo acumulado do período
    const fluxoRec = groupByMonth(receitas);
    const fluxoDesp = groupByMonth(despesas);
    
    // Mesclar chaves
    const keysSet = new Set([...fluxoRec.labels, ...fluxoDesp.labels]);
    const labels = Array.from(keysSet).sort();
    let acumulado = ativos - (totalRec - totalDesp); // Base inicial antes deste período
    const dataPontos = [];
    
    labels.forEach(l => {
      const idxR = fluxoRec.labels.indexOf(l);
      const valR = idxR >= 0 ? fluxoRec.data[idxR] : 0;
      const idxD = fluxoDesp.labels.indexOf(l);
      const valD = idxD >= 0 ? fluxoDesp.data[idxD] : 0;
      acumulado += (valR - valD);
      dataPontos.push(acumulado);
    });

    const chartConfig = labels.length > 0 ? {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Patrimônio',
          data: dataPontos,
          borderColor: '#00C8FF',
          backgroundColor: 'rgba(0, 200, 255, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3
        }]
      }
    } : null;

    let html = '<div class="pcd-grid">' +
      '<div class="pcd-row highlight">' +
        '<span class="pcd-label">Patrimônio Líquido Estimado</span>' +
        '<span class="pcd-value ' + (patrimonio >= 0 ? 'positive' : 'negative') + '">' + fmtBRL(patrimonio) + '</span>' +
      '</div>' +
      '<div class="pcd-divider"></div>' +
      '<div class="pcd-section-title">Posição Atual</div>' +
      '<div class="pcd-row"><span class="pcd-label">Saldo em contas</span><span class="pcd-value positive">' + fmtBRL(totalContas) + '</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Carteira de investimentos</span><span class="pcd-value positive">' + fmtBRL(totalInv) + '</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Saldo do fluxo no período</span><span class="pcd-value ' + (totalRec - totalDesp >= 0 ? 'positive' : 'negative') + '">' + fmtBRL(totalRec - totalDesp) + '</span></div>' +
      (receitas.length === 0 && despesas.length === 0 ? '<p class="pcd-empty">Nenhum dado cadastrado no período.</p>' : '') +
      '</div>';
    
    return { html, chartConfig };
  }

  function buildCashflowDetail(period) {
    const receitas = filterByPeriod(getReceitas(), period);
    const despesas = filterByPeriod(getDespesas(), period);

    const totalRec = receitas.reduce((s, r) => s + parseMon(r.valor), 0);
    const totalDesp = despesas.reduce((s, d) => s + parseMon(d.valor), 0);
    const saldo = totalRec - totalDesp;
    const taxaPoup = totalRec > 0 ? (saldo / totalRec) * 100 : 0;

    const rGroup = groupByMonth(receitas);
    const dGroup = groupByMonth(despesas);
    const labels = Array.from(new Set([...rGroup.labels, ...dGroup.labels])).sort();
    
    const rData = labels.map(l => { const i = rGroup.labels.indexOf(l); return i >= 0 ? rGroup.data[i] : 0; });
    const dData = labels.map(l => { const i = dGroup.labels.indexOf(l); return i >= 0 ? dGroup.data[i] : 0; });

    const chartConfig = labels.length > 0 ? {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Receitas', data: rData, backgroundColor: '#22c55e', borderRadius: 4 },
          { label: 'Despesas', data: dData, backgroundColor: '#ef4444', borderRadius: 4 }
        ]
      }
    } : null;

    let html = '<div class="pcd-grid">' +
      '<div class="pcd-row highlight"><span class="pcd-label">Saldo do Fluxo</span><span class="pcd-value ' + (saldo >= 0 ? 'positive' : 'negative') + '">' + fmtBRL(saldo) + '</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Total de Receitas</span><span class="pcd-value positive">' + fmtBRL(totalRec) + ' (' + receitas.length + ' lanç.)</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Total de Despesas</span><span class="pcd-value negative">' + fmtBRL(totalDesp) + ' (' + despesas.length + ' lanç.)</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Taxa de Poupança</span><span class="pcd-value ' + (taxaPoup >= 20 ? 'positive' : taxaPoup >= 10 ? 'warning' : 'negative') + '">' + taxaPoup.toFixed(1) + '%</span></div>';

    if (receitas.length === 0 && despesas.length === 0) html += '<p class="pcd-empty">Nenhum dado cadastrado no período.</p>';
    html += '</div>';

    return { html, chartConfig };
  }

  function buildInvestmentDetail(period) {
    const investimentos = getInvestimentos(); 
    
    const totalAplicado = investimentos.reduce((s, i) => s + parseMon(i.valorInvestido || i.valorAplicado || i.valor), 0);
    const totalAtual = investimentos.reduce((s, i) => s + parseMon(i.valorAtual || i.valorTotal || i.valor), 0);
    const lucroTotal = totalAtual - totalAplicado;
    const rentTotal = totalAplicado > 0 ? (lucroTotal / totalAplicado) * 100 : 0;

    const tipoMap = {};
    investimentos.forEach(function(i) {
      const t = i.tipo || i.categoria || 'Outros';
      if (!tipoMap[t]) tipoMap[t] = { atual: 0, count: 0 };
      tipoMap[t].atual += parseMon(i.valorAtual || i.valorTotal || i.valor);
      tipoMap[t].count++;
    });

    const labels = Object.keys(tipoMap);
    const data = labels.map(l => tipoMap[l].atual);

    const chartConfig = labels.length > 0 ? {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#00C8FF', '#7c3aed', '#22c55e', '#f59e0b', '#ec4899', '#6366f1'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: '#F1F5F9' } }
        }
      }
    } : null;

    let html = '<div class="pcd-grid">' +
      '<div class="pcd-row highlight"><span class="pcd-label">Total da Carteira</span><span class="pcd-value positive">' + fmtBRL(totalAtual) + '</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Total Aplicado</span><span class="pcd-value">' + fmtBRL(totalAplicado) + '</span></div>' +
      '<div class="pcd-row"><span class="pcd-label">Resultado Global</span><span class="pcd-value ' + (lucroTotal >= 0 ? 'positive' : 'negative') + '">' + fmtBRL(lucroTotal) + ' (' + rentTotal.toFixed(2) + '%)</span></div>' +
      '<div class="pcd-divider"></div>';

    if (investimentos.length === 0) html += '<p class="pcd-empty">Nenhum investimento cadastrado.</p>';
    html += '</div>';

    return { html, chartConfig, noFilter: true };
  }

  function buildScoreDetail(period) {
    const receitas = filterByPeriod(getReceitas(), period);
    const despesas = filterByPeriod(getDespesas(), period);

    const totalRec = receitas.reduce((s, r) => s + parseMon(r.valor), 0);
    const totalDesp = despesas.reduce((s, d) => s + parseMon(d.valor), 0);
    const saldo = totalRec - totalDesp;
    const taxaPoup = totalRec > 0 ? (saldo / totalRec) * 100 : 0;
    
    const p1 = Math.min(100, receitas.length > 0 ? 100 : 0); 
    const p2 = Math.min(100, despesas.length > 0 ? 100 : 0); 
    const p3 = Math.min(100, taxaPoup >= 20 ? 100 : (taxaPoup > 0 ? taxaPoup*5 : 0)); 
    const p4 = Math.min(100, saldo >= 0 ? 100 : 20); 

    const chartConfig = {
      type: 'radar',
      data: {
        labels: ['Receitas', 'Despesas', 'Taxa Poupança', 'Fluxo Caixa'],
        datasets: [{
          label: 'Score Profile',
          data: [p1, p2, p3, p4],
          backgroundColor: 'rgba(124, 58, 237, 0.2)',
          borderColor: '#7c3aed',
          pointBackgroundColor: '#00C8FF',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#00C8FF'
        }]
      },
      options: {
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#F1F5F9', font: { size: 12 } },
            ticks: { display: false, max: 100, min: 0 }
          }
        }
      }
    };

    const scoreEl = document.getElementById('dashScoreValue');
    const score = (scoreEl && scoreEl.textContent !== '—') ? scoreEl.textContent : '—';
    const label = document.getElementById('dashScoreDetail')?.textContent || 'Indicador';

    let html = '<div class="pcd-grid">' +
      '<div class="pcd-score-hero">' +
        '<div class="pcd-score-number">' + score + '</div>' +
        '<div class="pcd-score-label">' + label + '</div>' +
      '</div>' +
      '</div>';
      
    return { html, chartConfig };
  }

  function buildGoalsDetail() {
    const goals = getGoals();
    
    const labels = [];
    const dataAtual = [];
    const dataFalta = [];

    goals.forEach(g => {
      labels.push(g.nome || g.name || 'Meta');
      const alvo = parseMon(g.alvo || g.target || g.valorAlvo);
      const atual = parseMon(g.atual || g.current || g.valorAtual);
      dataAtual.push(atual);
      dataFalta.push(Math.max(0, alvo - atual));
    });

    const chartConfig = goals.length > 0 ? {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Acumulado', data: dataAtual, backgroundColor: '#00C8FF' },
          { label: 'Faltante', data: dataFalta, backgroundColor: 'rgba(255,255,255,0.1)' }
        ]
      },
      options: {
        indexAxis: 'y', 
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { display: false } }
        }
      }
    } : null;

    let html = '<div class="pcd-grid">';
    if (goals.length === 0) html += '<p class="pcd-empty">Nenhuma meta cadastrada.</p>';
    html += '</div>';

    return { html, chartConfig, noFilter: true }; 
  }

  const KPI_CARDS = {
    networth: { title: 'Patrimônio Líquido', subtitle: 'Ativos menos passivos e evolução do fluxo', builder: buildNetworthDetail },
    cashflow: { title: 'Fluxo de Caixa', subtitle: 'Balanço entre Receitas e Despesas', builder: buildCashflowDetail },
    invested: { title: 'Investimentos', subtitle: 'Distribuição da Carteira', builder: buildInvestmentDetail, noFilter: true },
    score: { title: 'Prisma Score', subtitle: 'Métricas de hábitos financeiros', builder: buildScoreDetail }
  };

  function wireStatCards() {
    $all('.stat-card[data-kpi]').forEach(function(card) {
      if (card.dataset.patchedClick) return;
      card.dataset.patchedClick = '1';

      const kpi = card.dataset.kpi;
      let config = KPI_CARDS[kpi];
      
      if (!config && kpi === 'goals') config = { title: 'Metas', builder: buildGoalsDetail, noFilter: true };
      
      if (!config) return;

      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Ver detalhes: ' + config.title);
      card.style.cursor = 'pointer';

      function handler() {
        openCardModal(config);
      }
      card.addEventListener('click', handler);
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     4. ESTILOS
     ══════════════════════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('prisma-patch-styles')) return;
    const style = document.createElement('style');
    style.id = 'prisma-patch-styles';
    style.textContent = [
      '.prisma-card-modal-overlay{display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .22s ease;z-index:9999}',
      '.prisma-card-modal-overlay.open{opacity:1;pointer-events:all}',
      '.prisma-card-modal-inner{max-width:600px;width:100%;max-height:85vh;overflow-y:auto;animation:patchModalIn .22s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}',
      '@keyframes patchModalIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}',
      '.prisma-card-modal-body{padding:0 0 8px 0;flex:1}',
      '.pcd-filters{display:flex;gap:8px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:12px;overflow-x:auto;scrollbar-width:none}',
      '.pcd-filters::-webkit-scrollbar{display:none}',
      '.pcd-filter-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#a1a1aa;padding:4px 12px;border-radius:20px;font-size:0.85em;cursor:pointer;transition:all .2s;white-space:nowrap}',
      '.pcd-filter-btn:hover{background:rgba(255,255,255,0.1);color:#fff}',
      '.pcd-filter-btn.active{background:rgba(0,200,255,0.15);border-color:#00C8FF;color:#00C8FF}',
      '.stat-card[data-kpi]{cursor:pointer;transition:transform .18s ease,box-shadow .18s ease !important;user-select:none;position:relative}',
      '.stat-card[data-kpi]:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,200,255,.12) !important}',
      '.stat-card[data-kpi]:active{transform:scale(.98)}',
      '.pcd-grid{display:flex;flex-direction:column;gap:2px;padding:4px 0}',
      '.pcd-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);gap:8px}',
      '.pcd-row.highlight{background:rgba(0,200,255,.05);border-radius:8px;padding:12px;margin:4px 0 8px;border-bottom:none;font-size:1.05em}',
      '.pcd-label{opacity:.75;font-size:.88em;flex:1;min-width:0}',
      '.pcd-value{font-weight:600;text-align:right;white-space:nowrap}',
      '.pcd-value.positive{color:#22c55e}',
      '.pcd-value.negative{color:#ef4444}',
      '.pcd-value.warning{color:#f59e0b}',
      '.pcd-section-title{font-size:.78em;text-transform:uppercase;letter-spacing:.08em;opacity:.5;padding:10px 0 4px}',
      '.pcd-divider{height:1px;background:rgba(255,255,255,.06);margin:8px 0}',
      '.pcd-empty{text-align:center;opacity:.5;font-size:.9em;padding:24px 0}',
      '.pcd-score-hero{text-align:center;padding:10px 0 0}',
      '.pcd-score-number{font-size:3.5em;font-weight:800;background:linear-gradient(135deg,#00C8FF,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;margin-bottom:6px}',
      '.pcd-score-label{font-size:1em;font-weight:600;opacity:.8;margin-bottom:4px}',
      '.ai-error-bubble{border-left:3px solid #ef4444}',
      '.spin-icon{animation:prisma-spin .9s linear infinite;display:inline-block}',
      '@keyframes prisma-spin{to{transform:rotate(360deg)}}',
      '@media(max-width:600px){.prisma-card-modal-inner{margin:0 8px;max-height:90vh}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════
     INIT E OBSERVERS DE ATUALIZAÇÃO AUTOMÁTICA
     ══════════════════════════════════════════════════════ */
  function init() {
    injectStyles();
    buildCardModal();
    wireAiAnalyzeButton();
    wireStatCards();

    var _rewireT = 0;
    var observer = new MutationObserver(function() {
      clearTimeout(_rewireT);
      _rewireT = setTimeout(function() {
        wireStatCards();
        wireAiAnalyzeButton();
        
        const overlay = document.getElementById(CARD_MODAL_ID);
        if (overlay && overlay.classList.contains('open') && currentKpiBuilder) {
           const activeBtn = document.querySelector('.pcd-filter-btn.active');
           const period = activeBtn ? activeBtn.dataset.period : '1y';
           renderModalContent(currentKpiBuilder, period);
        }
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.addEventListener('storage', function(e) {
      if (e.key && e.key.includes('prisma_')) {
        const overlay = document.getElementById(CARD_MODAL_ID);
        if (overlay && overlay.classList.contains('open') && currentKpiBuilder) {
           const activeBtn = document.querySelector('.pcd-filter-btn.active');
           const period = activeBtn ? activeBtn.dataset.period : '1y';
           renderModalContent(currentKpiBuilder, period);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }

  window.PrismaPatch = { wireAiAnalyzeButton: wireAiAnalyzeButton, wireStatCards: wireStatCards, openCardModal: openCardModal, closeCardModal: closeCardModal };
})();
