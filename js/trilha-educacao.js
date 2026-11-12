/**
 * trilha-educacao.js
 * Lógica completa da Trilha de Educação Financeira (12 módulos).
 * – Renderiza os cards a partir de TRILHA_MODULOS (educacao-financeira-data.js)
 * – Filtro por nível (Todos / Iniciante / Intermediário / Avançado)
 * – Progresso persistido no localStorage com fallback silencioso
 * – Modal de leitura com iframe + fallback para nova aba
 * – Botão "Baixar PDF" com atributo download
 * – Atalho "Aplicar agora no Prisma" no rodapé do modal
 * – Aviso fixo: "Conteúdo educacional. Não constitui recomendação de investimento."
 */
'use strict';

(function () {
  const localStorage = window.PrismaStorage || window.localStorage;
  /* ── Constantes ───────────────────────────────────────────────── */
  const LS_KEY = 'prisma_trilha_progresso_v1';
  function getProgressStorageKey() {
    const profileId = localStorage.getItem('prisma_current_profile_id');
    return profileId ? `${LS_KEY}_${profileId}` : LS_KEY;
  }
  const TOTAL = 12;
  const NIVEL_LABELS = {
    iniciante: 'Iniciante',
    intermediario: 'Intermediário',
    avancado: 'Avançado'
  };
  const NIVEL_EMOJI = {
    iniciante: '🟢',
    intermediario: '🟡',
    avancado: '🔴'
  };

  /* ── Utilitários de localStorage (com fallback) ───────────────── */
  function lsGet() {
    try {
      const raw = localStorage.getItem(getProgressStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (_) { return {}; }
  }

  function lsSet(data) {
    try { localStorage.setItem(getProgressStorageKey(), JSON.stringify(data)); } catch (error) {
      console.error('Não foi possível salvar o progresso da trilha:', error);
    }
  }

  function isConcluido(id) { return !!lsGet()[id]; }

  function toggleConcluido(id) {
    const data = lsGet();
    if (data[id]) { delete data[id]; } else { data[id] = true; }
    lsSet(data);
  }

  /* ── Referências ao DOM ───────────────────────────────────────── */
  function $ (sel, root) { return (root || document).querySelector(sel); }

  /* ── Estado ───────────────────────────────────────────────────── */
  let filtroAtivo = 'todos';

  /* ── Progresso ────────────────────────────────────────────────── */
  function calcProgresso() {
    const data = lsGet();
    const concluidos = (window.TRILHA_MODULOS || []).filter(m => data[m.id]).length;
    return { concluidos, total: TOTAL, pct: Math.round((concluidos / TOTAL) * 100) };
  }

  function renderizarProgresso() {
    const { concluidos, total, pct } = calcProgresso();

    // Barra geral
    const bar   = document.getElementById('trilhaProgressBar');
    const text  = document.getElementById('trilhaProgressText');
    if (bar)  bar.style.width  = pct + '%';
    if (text) text.textContent = concluidos + ' de ' + total + ' módulos concluídos (' + pct + '%)';

    // Progresso por nível
    ['iniciante', 'intermediario', 'avancado'].forEach(nivel => {
      const modulos = (window.TRILHA_MODULOS || []).filter(m => m.nivel === nivel);
      const concl   = modulos.filter(m => lsGet()[m.id]).length;
      const total   = modulos.length;
      const pctN    = total ? Math.round((concl / total) * 100) : 0;

      const barN  = document.getElementById('trilhaBar_' + nivel);
      const textN = document.getElementById('trilhaTxt_' + nivel);
      if (barN)  barN.style.width  = pctN + '%';
      if (textN) textN.textContent = concl + '/' + total;
    });
  }

  /* ── Renderizar Cards ─────────────────────────────────────────── */
  function renderizarCards() {
    const container = document.getElementById('trilhaCards');
    if (!container || !window.TRILHA_MODULOS) return;

    const modulos = filtroAtivo === 'todos'
      ? window.TRILHA_MODULOS
      : window.TRILHA_MODULOS.filter(m => m.nivel === filtroAtivo);

    if (!modulos.length) {
      container.innerHTML = '<p class="trilha-empty">Nenhum módulo encontrado para este filtro.</p>';
      return;
    }

    container.innerHTML = modulos.map(m => {
      const concluido = isConcluido(m.id);
      const labelNivel = NIVEL_LABELS[m.nivel] || m.nivel;
      const emojiNivel = NIVEL_EMOJI[m.nivel] || '';
      return `
        <div class="trilha-card${concluido ? ' trilha-card--done' : ''}"
             id="trilha-card-${m.id}"
             data-id="${m.id}"
             style="--card-accent:${m.cor}">
          <div class="trilha-card__num" style="color:${m.cor}">${String(m.numero).padStart(2, '0')}</div>
          <div class="trilha-card__body">
            <div class="trilha-card__badges">
              <span class="trilha-badge trilha-badge--nivel">${emojiNivel} ${labelNivel}</span>
              ${concluido ? '<span class="trilha-badge trilha-badge--done">✓ Concluído</span>' : ''}
            </div>
            <h4 class="trilha-card__titulo">${m.titulo}</h4>
            <p class="trilha-card__sub">${m.subtitulo}</p>
          </div>
          <div class="trilha-card__actions">
            <button type="button" class="btn primary btn-sm trilha-btn-ler"
                    data-id="${m.id}" aria-label="Ler ${m.titulo}">
              <i data-lucide="book-open"></i> Ler
            </button>
            <a href="${m.arquivo}" download="${m.arquivo.split('/').pop()}"
               class="btn secondary btn-sm"
               aria-label="Baixar PDF de ${m.titulo}">
              <i data-lucide="download"></i> Baixar PDF
            </a>
            <button type="button"
                    class="btn btn-sm trilha-btn-progresso ${concluido ? 'trilha-btn-progresso--done' : 'secondary'}"
                    data-id="${m.id}"
                    aria-label="${concluido ? 'Desmarcar conclusão de ' : 'Marcar como concluído: '}${m.titulo}"
                    aria-pressed="${concluido}">
              ${concluido ? '✓ Concluído' : 'Marcar como concluído'}
            </button>
          </div>
        </div>`;
    }).join('');

    // Atualizar ícones Lucide
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  }

  /* ── Modal de Leitura ─────────────────────────────────────────── */
  function buildModal() {
    if (document.getElementById('trilhaPdfModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'trilhaPdfModal';
    overlay.className = 'trilha-pdf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'trilhaPdfTitle');
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="trilha-pdf-container" role="document">
        <div class="trilha-pdf-header">
          <div class="trilha-pdf-header-info">
            <span id="trilhaPdfBadge" class="trilha-badge trilha-badge--nivel"></span>
            <h3 id="trilhaPdfTitle" class="trilha-pdf-title"></h3>
          </div>
          <div class="trilha-pdf-header-actions">
            <a id="trilhaPdfNewTab" class="btn secondary btn-sm" target="_blank" rel="noopener" aria-label="Abrir PDF em nova aba">
              <i data-lucide="external-link"></i> Nova aba
            </a>
            <a id="trilhaPdfDownload" class="btn secondary btn-sm" download>
              <i data-lucide="download"></i> Baixar PDF
            </a>
            <button type="button" id="trilhaPdfClose" class="modal-close" aria-label="Fechar leitor de PDF">
              <i data-lucide="x"></i>
            </button>
          </div>
        </div>

        <div class="trilha-pdf-viewer">
          <iframe id="trilhaPdfFrame"
                  title="Leitor de PDF"
                  aria-label="Visualizador do material em PDF"
                  class="trilha-pdf-iframe">
          </iframe>
          <div id="trilhaPdfFallback" class="trilha-pdf-fallback" hidden>
            <i data-lucide="file-text"></i>
            <p>Seu navegador não conseguiu exibir o PDF diretamente.</p>
            <a id="trilhaPdfFallbackLink" class="btn primary" target="_blank" rel="noopener">
              <i data-lucide="external-link"></i> Abrir em nova aba
            </a>
          </div>
        </div>

        <div class="trilha-pdf-footer">
          <div id="trilhaPdfAplicar" class="trilha-pdf-aplicar">
            <span class="trilha-pdf-aplicar-label"><i data-lucide="arrow-right-circle"></i> Aplicar agora no Prisma:</span>
            <div id="trilhaPdfAplicarLinks" class="trilha-pdf-aplicar-links"></div>
          </div>
          <div class="trilha-pdf-disclaimer">
            ⚠ Conteúdo educacional. Não constitui recomendação de investimento.
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Fechar com botão
    overlay.querySelector('#trilhaPdfClose').addEventListener('click', fecharModal);

    // Fechar clicando fora (no backdrop)
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharModal(); });

    // Fallback: detectar erro de carga do iframe
    const frame = overlay.querySelector('#trilhaPdfFrame');
    frame.addEventListener('error', () => mostrarFallback(frame.src));

    // Fechar com ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') fecharModal();
    });

    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  }

  function mostrarFallback(src) {
    const frame = document.getElementById('trilhaPdfFrame');
    const fallback = document.getElementById('trilhaPdfFallback');
    const link = document.getElementById('trilhaPdfFallbackLink');
    if (frame)    frame.hidden = true;
    if (fallback) fallback.hidden = false;
    if (link)     link.href = src;
  }

  function abrirModal(modId) {
    const mod = (window.TRILHA_MODULOS || []).find(m => m.id === modId);
    if (!mod) return;

    buildModal();

    const overlay  = document.getElementById('trilhaPdfModal');
    const title    = document.getElementById('trilhaPdfTitle');
    const badge    = document.getElementById('trilhaPdfBadge');
    const frame    = document.getElementById('trilhaPdfFrame');
    const fallback = document.getElementById('trilhaPdfFallback');
    const fallbackLink = document.getElementById('trilhaPdfFallbackLink');
    const newTab = document.getElementById('trilhaPdfNewTab');
    const download = document.getElementById('trilhaPdfDownload');
    const aplicarLinks = document.getElementById('trilhaPdfAplicarLinks');

    // Resetar estado
    if (frame) { frame.hidden = false; frame.src = ''; }
    if (fallback) fallback.hidden = true;

    // Preencher informações
    if (title)  title.textContent = mod.titulo;
    if (badge) {
      badge.textContent = NIVEL_EMOJI[mod.nivel] + ' ' + (NIVEL_LABELS[mod.nivel] || mod.nivel);
      badge.style.borderColor = mod.cor;
    }
    if (download) {
      download.href = mod.arquivo;
      download.setAttribute('download', mod.arquivo.split('/').pop());
    }
    if (newTab) newTab.href = mod.arquivo;
    if (fallbackLink) fallbackLink.href = mod.arquivo;

    // Links "Aplicar no Prisma"
    if (aplicarLinks) {
      aplicarLinks.innerHTML = (mod.aplicarLinks || []).map(l => `
        <button type="button" class="trilha-aplicar-btn"
                data-section="${l.section}"
                onclick="if(window.navigateToSection){window.navigateToSection('${l.section}');document.getElementById('trilhaPdfModal').setAttribute('aria-hidden','true');document.getElementById('trilhaPdfModal').style.display='none';document.body.style.overflow='';}">
          <i data-lucide="external-link"></i> ${l.label}
        </button>`).join('');
    }

    // Carregar PDF no iframe (leve delay para evitar double-render)
    setTimeout(() => {
      if (frame) frame.src = mod.arquivo;
    }, 100);

    // Exibir modal
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Foco no botão fechar para acessibilidade
    const closeBtn = document.getElementById('trilhaPdfClose');
    if (closeBtn) closeBtn.focus();

    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  }

  function fecharModal() {
    const overlay = document.getElementById('trilhaPdfModal');
    if (!overlay) return;
    const frame = document.getElementById('trilhaPdfFrame');
    if (frame) frame.src = '';  // liberar memória
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Gerenciamento de Abas do Modal ───────────────────────────── */
  function setupModalTabs() {
    const tabTrilha = document.getElementById('tabTrilhaOficial');
    const tabAulas = document.getElementById('tabAulasInterativas');
    const containerTrilha = document.getElementById('trilhaEduContainer');
    const wrapAulas = document.getElementById('trilhaAulasWrap');

    if (tabTrilha && tabAulas && containerTrilha && wrapAulas) {
      if (tabTrilha.dataset.tabBound) return;
      tabTrilha.dataset.tabBound = 'true';

      tabTrilha.addEventListener('click', () => {
        tabTrilha.classList.add('active');
        tabTrilha.setAttribute('aria-selected', 'true');
        tabAulas.classList.remove('active');
        tabAulas.setAttribute('aria-selected', 'false');
        containerTrilha.style.display = 'block';
        wrapAulas.style.display = 'none';
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
      });

      tabAulas.addEventListener('click', () => {
        tabAulas.classList.add('active');
        tabAulas.setAttribute('aria-selected', 'true');
        tabTrilha.classList.remove('active');
        tabTrilha.setAttribute('aria-selected', 'false');
        containerTrilha.style.display = 'none';
        wrapAulas.style.display = 'block';
        if (typeof window.renderEducation === 'function') {
          window.renderEducation();
        }
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
      });
    }
  }

  /* ── Montar Seção da Trilha ───────────────────────────────────── */
  function montarSecaoTrilha() {
    setupModalTabs();
    const container = document.getElementById('trilhaEduContainer');
    if (!container) return;

    container.innerHTML = `
      <!-- Cabeçalho -->
      <div class="trilha-header" style="margin-bottom: 1rem;">
        <div class="trilha-header-text">
          <span class="education-mini-label">TRILHA OFICIAL · 12 MÓDULOS</span>
          <h3 class="trilha-titulo">12 Guias Oficiais em PDF</h3>
          <p class="trilha-sub">Do orçamento básico à independência financeira — estude no seu ritmo com material oficial em PDF.</p>
        </div>
        <div class="trilha-progress-wrap">
          <div class="trilha-progress-header">
            <span>Seu progresso geral</span>
            <strong id="trilhaProgressText">0 de 12 módulos concluídos (0%)</strong>
          </div>
          <div class="trilha-progress-track" role="progressbar" aria-label="Progresso geral da trilha" aria-valuemin="0" aria-valuemax="100">
            <div id="trilhaProgressBar" class="trilha-progress-fill"></div>
          </div>
          <div class="trilha-level-progress">
            ${['iniciante','intermediario','avancado'].map(n => {
              const totalN = (window.TRILHA_MODULOS || []).filter(m => m.nivel === n).length;
              return `
              <div class="trilha-level-prog-item">
                <span>${NIVEL_EMOJI[n]} ${NIVEL_LABELS[n]}</span>
                <div class="trilha-progress-track trilha-progress-track--sm">
                  <div id="trilhaBar_${n}" class="trilha-progress-fill"></div>
                </div>
                <span id="trilhaTxt_${n}" class="trilha-level-prog-count">0/${totalN}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Filtros por nível -->
      <div class="trilha-filtros" role="group" aria-label="Filtrar módulos por nível">
        <button type="button" class="filter-chip active" data-trilha-nivel="todos">Todos</button>
        <button type="button" class="filter-chip" data-trilha-nivel="iniciante">🟢 Iniciante</button>
        <button type="button" class="filter-chip" data-trilha-nivel="intermediario">🟡 Intermediário</button>
        <button type="button" class="filter-chip" data-trilha-nivel="avancado">🔴 Avançado</button>
      </div>

      <!-- Grid de cards -->
      <div id="trilhaCards" class="trilha-cards-grid"></div>

      <!-- Aviso obrigatório fixo no rodapé da seção -->
      <div class="trilha-aviso-rodape" role="note" aria-label="Aviso legal">
        ⚠ Conteúdo educacional. Não constitui recomendação de investimento.
      </div>`;

    // Eventos de filtro
    container.querySelectorAll('[data-trilha-nivel]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-trilha-nivel]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtroAtivo = btn.dataset.trilhaNivel;
        renderizarCards();
        renderizarProgresso();
      });
    });

    // Delegação de evento para cards
    container.addEventListener('click', e => {
      const btnLer = e.target.closest('.trilha-btn-ler');
      const btnProg = e.target.closest('.trilha-btn-progresso');

      if (btnLer) {
        abrirModal(btnLer.dataset.id);
      }

      if (btnProg) {
        const id = btnProg.dataset.id;
        toggleConcluido(id);
        renderizarCards();
        renderizarProgresso();
      }
    });

    renderizarCards();
    renderizarProgresso();
  }

  /* ── Inicialização ────────────────────────────────────────────── */
  function init() {
    if (!window.TRILHA_MODULOS) {
      console.warn('[TrilhaEdu] educacao-financeira-data.js não carregado ainda. Aguardando...');
      setTimeout(init, 300);
      return;
    }
    setupModalTabs();
    montarSecaoTrilha();

    // Quando o modal Acessar Trilhas for aberto, atualizar visualização
    const btnTrilhas = document.getElementById('btnOpenTrilhas');
    if (btnTrilhas && !btnTrilhas.dataset.trilhaInitBound) {
      btnTrilhas.dataset.trilhaInitBound = 'true';
      btnTrilhas.addEventListener('click', () => {
        setTimeout(() => {
          setupModalTabs();
          montarSecaoTrilha();
          renderizarProgresso();
          if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        }, 50);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Reexecutar quando a seção de Educação for ativada via navegação
  const _origNavigate = window.navigateToSection;
  if (typeof _origNavigate === 'function') {
    window.navigateToSection = function (screenId, options) {
      const result = _origNavigate.call(this, screenId, options);
      if (screenId === 'educacao-financeira') {
        setTimeout(() => {
          montarSecaoTrilha();
          renderizarProgresso();
        }, 50);
      }
      return result;
    };
  }

  // Expor funções úteis para uso externo
  window.TrilhaEdu = { abrirModal, fecharModal, renderizarCards, renderizarProgresso };
})();
