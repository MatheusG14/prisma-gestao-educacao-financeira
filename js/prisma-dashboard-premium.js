/**
 * Prisma Dashboard Premium — Enhancement Script v2.0
 * Ativa o Score Ring visual, aplica classes semânticas nos cards KPI
 * e gerencia os filtros rápidos e interações da Central de Monitoramento Radical.
 * 100% não-destrutivo: nunca modifica dados, fórmulas ou regras de negócio existentes.
 */
(function () {
  'use strict';

  /* ======================================================
     1. SCORE RING — ativa o indicador circular no card Score
     ====================================================== */

  const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * 22; // r=22 → ~138.23px

  function activateScoreRing() {
    const ringWrap = document.getElementById('dashScoreRingWrap');
    const scoreEl  = document.getElementById('dashScoreValue');
    const arcEl    = document.getElementById('dashScoreArc');

    if (!ringWrap || !scoreEl || !arcEl) return;

    const rawText = scoreEl.textContent.trim();
    const score   = parseInt(rawText, 10);

    // Sem score válido: mantém o ring oculto
    if (isNaN(score) || rawText === '—' || rawText === '') return;

    // Mostra o ring
    ringWrap.style.display = 'flex';

    // Calcula dasharray para a porcentagem
    const pct  = Math.max(0, Math.min(100, score)) / 100;
    const dash = pct * SCORE_RING_CIRCUMFERENCE;
    const gap  = SCORE_RING_CIRCUMFERENCE - dash;

    // Cor dinâmica por faixa (espelha scoreBand do motor)
    let strokeColor = '#FBBF24'; // padrão amber
    if (score <= 20)       strokeColor = '#EF4444';
    else if (score <= 40)  strokeColor = '#F97316';
    else if (score <= 60)  strokeColor = '#F2A900';
    else if (score <= 80)  strokeColor = '#22C55E';
    else                   strokeColor = '#10B981';

    arcEl.setAttribute('stroke', strokeColor);

    // Anima: inicia em 0 e vai para o valor real
    arcEl.setAttribute('stroke-dasharray', `0 ${SCORE_RING_CIRCUMFERENCE}`);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduced) {
          arcEl.style.transition = 'stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
        }
        arcEl.setAttribute('stroke-dasharray', `${dash} ${gap}`);
      });
    });

    // Oculta o h2 fallback
    const fallbackVal = document.getElementById('dashScoreValueText');
    const fallbackDet = document.getElementById('dashScoreDetailText');
    if (fallbackVal) fallbackVal.style.display = 'none';
    if (fallbackDet) fallbackDet.style.display = 'none';
  }

  /* ======================================================
     2. BADGE SEMÂNTICO — aplica classes badge-up / badge-down
     ====================================================== */

  function syncBadgeClasses() {
    document.querySelectorAll('.stat-badge').forEach(function (badge) {
      if (badge.classList.contains('up')) {
        badge.classList.add('badge-up');
        badge.classList.remove('badge-neutral', 'badge-down');
      } else if (badge.classList.contains('down')) {
        badge.classList.add('badge-down');
        badge.classList.remove('badge-neutral', 'badge-up');
      }
    });
  }

  /* ======================================================
     3. CONTADOR DE ABAS URGENTES
     ====================================================== */

  function syncTabCounters() {
    const alertCounter = document.getElementById('mAlertsTabCounter');
    if (alertCounter) {
      const count = parseInt(alertCounter.textContent, 10) || 0;
      if (count > 0) {
        alertCounter.classList.add('urgent');
      } else {
        alertCounter.classList.remove('urgent');
      }
    }
  }

  /* ======================================================
     4. FILTROS RÁPIDOS DA CENTRAL DE MONITORAMENTO
     (Todos, Não lidos, Críticos)
     ====================================================== */

  let _activeAlertFilter = 'all';

  function applyQuickFilter(filterType) {
    _activeAlertFilter = filterType;
    const items = document.querySelectorAll('#mRevenueAlertsList .monitoring-item');
    items.forEach(function (item) {
      if (filterType === 'all') {
        item.style.display = '';
      } else if (filterType === 'unread') {
        const isRead = item.classList.contains('is-read');
        item.style.display = isRead ? 'none' : '';
      } else if (filterType === 'urgent') {
        const isUrgent = item.classList.contains('priority-critica') || item.classList.contains('priority-alta');
        item.style.display = isUrgent ? '' : 'none';
      }
    });

    // Atualiza botões
    document.querySelectorAll('.quick-filter-chip').forEach(function (chip) {
      const f = chip.getAttribute('data-filter');
      chip.classList.toggle('active', f === filterType);
    });
  }

  function setupQuickFilters() {
    document.querySelectorAll('.quick-filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        const f = chip.getAttribute('data-filter');
        if (f) applyQuickFilter(f);
      });
    });
  }

  /* ======================================================
     5. ENTRADA PROGRESSIVA DOS CARDS KPI (stagger)
     =======================================================*/

  function staggerCards() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(function (card, i) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      setTimeout(function () {
        card.style.opacity = '';
        card.style.transform = '';
      }, 60 + i * 50);
    });
  }

  /* ======================================================
     6. MONITORAMENTO: anima entrada suave dos itens
     ====================================================== */

  function animateMonitoringItems() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = document.querySelectorAll('#mRevenueAlertsList .monitoring-item, #mFinancialInsightsList .monitoring-item');
    items.forEach(function (item, i) {
      item.style.opacity = '0';
      item.style.transform = 'translateX(6px)';
      item.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(function () {
        item.style.opacity = '';
        item.style.transform = '';
      }, 40 + i * 35);
    });
  }

  /* ======================================================
     7. OBSERVER — expansão e mutações do monitoramento
     ====================================================== */

  function setupMonitoringObserver() {
    const content = document.getElementById('dashMonitoringContent');
    if (!content) return;

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          if (content.style.display !== 'none') {
            setTimeout(animateMonitoringItems, 50);
            setTimeout(syncTabCounters, 60);
            if (_activeAlertFilter !== 'all') {
              applyQuickFilter(_activeAlertFilter);
            }
          }
        }
        if (m.type === 'childList') {
          setTimeout(animateMonitoringItems, 30);
          if (_activeAlertFilter !== 'all') {
            applyQuickFilter(_activeAlertFilter);
          }
        }
      });
    });

    observer.observe(content, { attributes: true, childList: false, subtree: false });

    ['mRevenueAlertsList', 'mFinancialInsightsList'].forEach(function (id) {
      const list = document.getElementById(id);
      if (list) {
        observer.observe(list, { childList: true, subtree: false });
      }
    });
  }

  /* ======================================================
     8. INICIALIZAÇÃO — aguarda o script.js terminar
     ====================================================== */

  function runAll() {
    activateScoreRing();
    syncBadgeClasses();
    syncTabCounters();
    setupQuickFilters();
    setupMonitoringObserver();
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 60;

  function pollInit() {
    const scoreEl = document.getElementById('dashScoreValue');
    const hasScore = scoreEl && scoreEl.textContent.trim() !== '' && scoreEl.textContent.trim() !== '—';

    if (hasScore || attempts >= MAX_ATTEMPTS) {
      staggerCards();
      runAll();
      return;
    }

    attempts++;
    setTimeout(pollInit, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(pollInit, 100);
    });
  } else {
    setTimeout(pollInit, 100);
  }

  document.addEventListener('prisma:dashboard:updated', function () {
    setTimeout(runAll, 50);
  });

  document.addEventListener('prisma:section:changed', function (e) {
    if (e && e.detail && e.detail.section === 'dashboard') {
      setTimeout(runAll, 80);
    }
  });

  window.PrismaDashboardPremium = {
    activateScoreRing: activateScoreRing,
    syncBadgeClasses: syncBadgeClasses,
    syncTabCounters: syncTabCounters,
    applyQuickFilter: applyQuickFilter,
    animateMonitoringItems: animateMonitoringItems
  };

})();
