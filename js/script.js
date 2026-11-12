// ============================================
// PRISMA - Gestão Financeira Inteligente
// ============================================

let saldoAtual = 0;
let profiles = [];
let currentProfileId = null;
let currentProfile = null;
window.__currentAiHealthScore = null;

// ==================== GLOBAL CHART VARIABLES ====================
let incomeData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let expenseData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let categories = [];
let months = [];
let cashflowChart = null;
let pieChart = null;
let incomePieChart = null;
let incomeCategories = [];
let reportChart = null;
let portfolioChart = null;
let cfFlowChartInstance = null;
let cfDistributionChartInstance = null;
let cfDistributionType = 'despesa';
let chartsInitialized = false;
let monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getInitialStorageProfiles() {
  try {
    return JSON.parse(localStorage.getItem(BASE_STORAGE_KEYS?.profiles || 'prisma_profiles_data') || '[]');
  } catch (_error) {
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const localStorage = window.PrismaStorage || window.localStorage;
  // Trava o scroll do documento enquanto qualquer overlay/modal estiver aberto.
  // MutationObserver cobre também modais legados abertos via style.display direto.
  const modalScrollOverlaySelector = '.modal-overlay, .login-overlay, .registration-overlay, .welcome-overlay, .lgpd-modal-overlay, .education-lesson-modal';
  let modalScrollSnapshot = null;
  let modalScrollSyncQueued = false;

  function hasVisibleModalOverlay() {
    return Array.from(document.querySelectorAll(modalScrollOverlaySelector)).some((overlay) => {
      if (overlay.classList.contains('prisma-card-modal-overlay')) return overlay.classList.contains('open');
      if (overlay.hidden || overlay.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(overlay);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function isMobileSidebarOpen() {
    return window.innerWidth < 1024 && document.getElementById('sidebar')?.classList.contains('open');
  }

  function hasPageScrollOverlay() {
    return hasVisibleModalOverlay() || isMobileSidebarOpen();
  }

  function syncModalScrollLock() {
    const body = document.body;
    const root = document.documentElement;
    if (!body || !root) return;

    if (hasPageScrollOverlay() && !modalScrollSnapshot) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const keepSidebarScrollable = isMobileSidebarOpen() && !hasVisibleModalOverlay();
      modalScrollSnapshot = {
        scrollY,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyOverflow: body.style.overflow,
        rootOverflow: root.style.overflow,
        scrollContainers: Array.from(document.querySelectorAll(keepSidebarScrollable ? '.content' : '.content, .sidebar-nav')).map((element) => ({
          element,
          scrollTop: element.scrollTop,
          overflowY: element.style.overflowY,
          overscrollBehaviorY: element.style.overscrollBehaviorY
        }))
      };
      body.classList.add('prisma-scroll-locked');
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      modalScrollSnapshot.scrollContainers.forEach(({ element }) => {
        element.style.overflowY = 'hidden';
        element.style.overscrollBehaviorY = 'none';
      });
      return;
    }

    if (!hasPageScrollOverlay() && modalScrollSnapshot) {
      const snapshot = modalScrollSnapshot;
      modalScrollSnapshot = null;
      body.classList.remove('prisma-scroll-locked');
      body.style.position = snapshot.bodyPosition;
      body.style.top = snapshot.bodyTop;
      body.style.left = snapshot.bodyLeft;
      body.style.right = snapshot.bodyRight;
      body.style.width = snapshot.bodyWidth;
      body.style.overflow = snapshot.bodyOverflow;
      root.style.overflow = snapshot.rootOverflow;
      snapshot.scrollContainers.forEach(({ element, scrollTop, overflowY, overscrollBehaviorY }) => {
        if (!element.isConnected) return;
        element.style.overflowY = overflowY;
        element.style.overscrollBehaviorY = overscrollBehaviorY;
        element.scrollTop = scrollTop;
      });
      window.scrollTo(0, snapshot.scrollY);
    }
  }

  function queueModalScrollSync() {
    if (modalScrollSyncQueued) return;
    modalScrollSyncQueued = true;
    requestAnimationFrame(() => {
      modalScrollSyncQueued = false;
      syncModalScrollLock();
    });
  }

  const modalScrollObserver = new MutationObserver(queueModalScrollSync);
  modalScrollObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
  });
  window.addEventListener('resize', queueModalScrollSync);
  syncModalScrollLock();

  // Inicializar ícones Lucide
  // Lucide: evita createIcons() em toda a árvore a cada render
  let _iconRaf = 0;
  let _iconLast = 0;
  function refreshIcons(force) {
    if (!window.lucide || typeof lucide.createIcons !== 'function') return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!force && now - _iconLast < 80) {
      if (!_iconRaf) {
        _iconRaf = requestAnimationFrame(() => {
          _iconRaf = 0;
          _iconLast = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          try { lucide.createIcons(); } catch (_) {}
        });
      }
      return;
    }
    _iconLast = now;
    try { lucide.createIcons(); } catch (_) {}
  }
  // Primeira passada após scripts — adiada ao próximo frame (não bloqueia parse)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => refreshIcons(true));
  } else {
    refreshIcons(true);
  }

  // Medição de boot (somente se prisma_perf=1 no localStorage ou ?perf=1)
  (function prismaPerfBoot() {
    try {
      const enabled = localStorage.getItem('prisma_perf') === '1' || /[?&]perf=1/.test(location.search);
      if (!enabled || !performance || !performance.mark) return;
      performance.mark('prisma-script-start');
      window.addEventListener('load', () => {
        performance.mark('prisma-window-load');
        try {
          performance.measure('prisma-boot', 'prisma-script-start', 'prisma-window-load');
          const m = performance.getEntriesByName('prisma-boot')[0];
          if (m) console.info('[PrismaPerf] script→load:', Math.round(m.duration) + 'ms');
        } catch (_) {}
      }, { once: true });
    } catch (_) {}
  })();


  function setupPasswordToggleButtons() {
    document.querySelectorAll('.password-toggle-btn').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';

      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-target');
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;

        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
        button.innerHTML = isHidden
          ? '<i data-lucide="eye-off"></i>'
          : '<i data-lucide="eye"></i>';
        refreshIcons();
      });
    });
  }

  // Toast System
  function showToast(message, action) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toast._timeout);
    toast.innerHTML = '';
    toast.classList.toggle('with-action', !!action);

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    if (action && action.label && typeof action.onClick === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        toast.classList.remove('show');
        action.onClick();
      });
      toast.appendChild(btn);
    }

    toast.classList.add('show');
    toast._timeout = setTimeout(() => toast.classList.remove('show'), action ? 5000 : 2800);
    try {
      window.dispatchEvent(new CustomEvent('prisma:toast', { detail: { message: String(message || '') } }));
    } catch (_) {}
    try {
      if (typeof window.PrismaMaybePersistToast === 'function') window.PrismaMaybePersistToast(message);
    } catch (_) {}
  }
  window.showToast = showToast;

  // AI Bot Message System
  const aiChat = document.getElementById('aiChat');
  
  function addBotMessage(message) {
    if (!aiChat) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg bot';
    msgDiv.innerHTML = `
      <span class="ai-avatar"><i data-lucide="bot"></i></span>
      <div class="bubble">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    `;
    
    aiChat.appendChild(msgDiv);
    aiChat.scrollTop = aiChat.scrollHeight;
    refreshIcons();
  }

  // Leitura robusta de valores monetários (pt-BR + ponto decimal).
  // Aceita: 1234 | 1.234 | 1234,56 | 1.234,56 | 1234.56 | 10.5 | 0.99 | -1.234,56
  function parseMoneyInput(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (raw === null || raw === undefined) return 0;
    let s = String(raw).trim();
    if (!s) return 0;

    s = s.replace(/R\$|US\$|€|£|¥/gi, '').replace(/\s/g, '');

    const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
    s = s.replace(/[()]/g, '').replace(/[^0-9.,]/g, '');
    if (!s) return 0;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const hasComma = lastComma !== -1;
    const hasDot = lastDot !== -1;

    if (hasComma && hasDot) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = s.split(',');
      if (parts.length > 2) {
        const dec = parts.pop();
        s = parts.join('') + '.' + dec;
      } else {
        s = s.replace(',', '.');
      }
    } else if (hasDot) {
      const parts = s.split('.');
      if (parts.length > 2) {
        const dec = parts[parts.length - 1];
        if (dec.length <= 2) {
          s = parts.slice(0, -1).join('') + '.' + dec;
        } else {
          s = parts.join('');
        }
      } else {
        const intPart = parts[0];
        const frac = parts[1] || '';
        if (frac.length === 0) {
          s = intPart;
        } else if (frac.length === 3 && intPart !== '' && intPart !== '0') {
          // 1.234 → milhar (pt-BR). 0.123 permanece decimal.
          s = intPart + frac;
        } else {
          // 10.5 | 10.50 | 0.99 | 1234.56 → decimal com ponto
          s = intPart + '.' + frac;
        }
      }
    }

    const value = Number(s);
    if (!Number.isFinite(value)) return 0;
    return negative ? -Math.abs(value) : value;
  }
  window.parseMoneyInput = parseMoneyInput;
  window.PrismaParseMoney = parseMoneyInput;


  function normalizeMoneyField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      const value = parseMoneyInput(el.value);
      if (el.value.trim() !== '') el.value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }

  // Format Currency
  ['receitaValor','despesaValor','contaSaldo','investValor','investLucro','metaAtual','metaAlvo','profileSaldo','profileSalario'].forEach(normalizeMoneyField);

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Função para obter detalhes expandidos das recomendações
  function obterDetalhesExpandidosRecomendacao(recomendacao) {
    const detalhes = {
      contexto: '',
      estrategias: [],
      prazo: ''
    };

    switch (recomendacao.categoria) {
      case 'Lazer':
        detalhes.contexto = 'Gastos de entretenimento e atividades recreativas';
        detalhes.estrategias = [
          'Buscar atividades gratuitas como parques, museus e eventos culturais',
          'Assinar serviços de streaming em grupo com família/amigos',
          'Planejar atividades ao ar livre em vez de opções pagas',
          'Utilizar aplicativos de descontos para cinema e restaurantes'
        ];
        detalhes.prazo = 'Implementação imediata - revisão mensal';
        break;

      case 'Transporte':
        detalhes.contexto = 'Deslocamentos diários e custos de mobilidade';
        detalhes.estrategias = [
          'Avaliar transporte público para rotinas fixas',
          'Considerar carona solidária com colegas de trabalho',
          'Utilizar bicicleta para deslocamentos curtos',
          'Planejar rotas otimizadas para reduzir quilometragem'
        ];
        detalhes.prazo = 'Implementação gradual - revisão semanal';
        break;

      case 'Alimentação':
        detalhes.contexto = 'Gastos com alimentação fora de casa e compras de supermercado';
        detalhes.estrategias = [
          'Preparar refeições em casa e levar marmitas',
          'Fazer lista de compras e evitar compras por impulso',
          'Aproveitar promoções e comprar produtos da época',
          'Comparar preços entre diferentes estabelecimentos'
        ];
        detalhes.prazo = 'Implementação imediata - revisão semanal';
        break;

      case 'Saúde':
        detalhes.contexto = 'Gastos com medicamentos, planos de saúde e consultas';
        detalhes.estrategias = [
          'Utilizar medicamentos genéricos quando possível',
          'Aproveitar consultas gratuitas no SUS',
          'Manter plano preventivo para evitar gastos maiores',
          'Comparar preços de medicamentos em diferentes farmácias'
        ];
        detalhes.prazo = 'Implementação imediata - revisão mensal';
        break;

      case 'Educação':
        detalhes.contexto = 'Investimentos em cursos, livros e desenvolvimento profissional';
        detalhes.estrategias = [
          'Buscar cursos gratuitos online e bibliotecas públicas',
          'Aproveitar plataformas de aprendizado gratuito',
          'Compartilhar materiais de estudo com colegas',
          'Investir em cursos que tenham retorno financeiro claro'
        ];
        detalhes.prazo = 'Planejamento trimestral - revisão mensal';
        break;

      default:
        detalhes.contexto = 'Categoria genérica de gastos';
        detalhes.estrategias = [
          'Analisar despesas detalhadamente',
          'Buscar alternativas mais econômicas',
          'Estabelecer limites mensais',
          'Monitorar gastos regularmente'
        ];
        detalhes.prazo = 'Implementação imediata - revisão mensal';
    }

    return detalhes;
  }

  // ==================== LOCAL STORAGE KEYS ====================
  const BASE_STORAGE_KEYS = {
    receitas: 'prisma_receitas_data',
    despesas: 'prisma_despesas_data',
    contas: 'prisma_contas_data',
    cartoes: 'prisma_cartoes_data',
    investimentos: 'prisma_investimentos_data',
    goals: 'prisma_goals_data',
    summary: 'prisma_summary_data',
    monthlyFlow: 'prisma_monthly_flow_data',
    categories: 'prisma_categories_data',
    profile: 'prisma_profile_data',
    profiles: 'prisma_profiles_data',
    currentProfileId: 'prisma_current_profile_id',
    lgpdAccepted: 'prisma_lgpd_accepted',
    lgpdDontShow: 'prisma_lgpd_dont_show',
    userRegistered: 'prisma_user_registered',
    userData: 'prisma_user_data',
  };

  // Função para gerar chaves específicas do perfil
  function getProfileStorageKeys(profileId) {
    if (!profileId) return BASE_STORAGE_KEYS;
    
    return {
      receitas: `prisma_receitas_data_${profileId}`,
      despesas: `prisma_despesas_data_${profileId}`,
      contas: `prisma_contas_data_${profileId}`,
      cartoes: `prisma_cartoes_data_${profileId}`,
      investimentos: `prisma_investimentos_data_${profileId}`,
      goals: `prisma_goals_data_${profileId}`,
      summary: `prisma_summary_data_${profileId}`,
      monthlyFlow: `prisma_monthly_flow_data_${profileId}`,
      categories: `prisma_categories_data_${profileId}`,
      // Chaves globais (não específicas do perfil)
      profile: BASE_STORAGE_KEYS.profile,
      profiles: BASE_STORAGE_KEYS.profiles,
      currentProfileId: BASE_STORAGE_KEYS.currentProfileId,
      lgpdAccepted: BASE_STORAGE_KEYS.lgpdAccepted,
      lgpdDontShow: BASE_STORAGE_KEYS.lgpdDontShow,
      userRegistered: BASE_STORAGE_KEYS.userRegistered,
      userData: BASE_STORAGE_KEYS.userData,
    };
  }

  function getAiHealthScoreStorageKey(profileId = currentProfileId) {
    return `prisma_ai_health_score_${profileId || 'default'}`;
  }

  function getScopedStorageKey(key, profileId = currentProfileId) {
    return profileId ? `${key}_${profileId}` : key;
  }

  // Chaves de storage atuais (baseadas no perfil atual)
  let STORAGE_KEYS = { ...BASE_STORAGE_KEYS };

  profiles = getJSONFromStorage(BASE_STORAGE_KEYS.profiles, []);
  currentProfileId = getFromStorage(BASE_STORAGE_KEYS.currentProfileId) || null;

  // Funções simples de localStorage
  function getFromStorage(key) {
    return localStorage.getItem(key);
  }
  
  function setToStorage(key, value) {
    localStorage.setItem(key, value);
  }
  
  function removeFromStorage(key) {
    localStorage.removeItem(key);
  }

  // Funções simples para JSON
  function getJSONFromStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      console.error(`Erro ao ler JSON do localStorage (${key}):`, e);
      return defaultValue;
    }
  }

  function setJSONToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar JSON no localStorage (${key}):`, e);
      return false;
    }
  }

  // ==================== WELCOME SCREEN ====================
  const welcomeScreen = document.getElementById('welcomeScreen');
  const welcomeStartBtn = document.getElementById('welcomeStartBtn');
  const WELCOME_SEEN_STORAGE_KEY = 'prisma_welcome_seen_v1';

  function hasSeenWelcomeScreen() {
    try {
      return localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function showWelcomeScreen(userName = null) {
    try {
      if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
        
        // Personalizar mensagem se o nome do usuário for fornecido
        if (userName) {
          const welcomeTitle = welcomeScreen.querySelector('.welcome-title');
          const welcomeSubtitle = welcomeScreen.querySelector('.welcome-subtitle');
          
          if (welcomeTitle) {
            welcomeTitle.innerHTML = `
              <span class="welcome-gradient">Bem-vindo ao</span>
              <span class="welcome-brand">Prisma</span>
            `;
          }
          
          if (welcomeSubtitle) {
            welcomeSubtitle.textContent = `Olá, ${userName}! Sua gestão financeira inteligente começa aqui`;
          }
        }
        
        refreshIcons();
      }
    } catch (error) {
      console.error('Erro ao mostrar tela de boas-vindas:', error);
    }
  }

  // ==================== AUTH FEEDBACK & SESSION HELPERS ====================
  function showAuthFeedback(containerId, message, type = 'error') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.className = 'auth-feedback-banner ' + type;
    el.textContent = message;
    el.style.display = 'block';
  }

  function hideAuthFeedback(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.className = 'auth-feedback-banner';
    el.textContent = '';
    el.style.display = 'none';
  }

  function authErrorMessage(error) {
    const messages = {
      'auth/email-already-in-use': 'Este e-mail já possui uma conta Firebase. Faça login para continuar.',
      'auth/invalid-email': 'Informe um endereço de e-mail válido.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/user-disabled': 'Esta conta foi desativada. Entre em contato com o suporte.',
      'auth/weak-password': 'A senha deve ter pelo menos 8 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente novamente.',
      'auth/network-request-failed': 'Não foi possível conectar ao Firebase. Verifique sua conexão.',
      'auth/operation-not-allowed': 'O login por e-mail e senha ainda não está habilitado no Firebase Console.',
      'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
      'auth/invalid-action-code': 'O link de redefinição é inválido ou expirou.',
      'auth/expired-action-code': 'O link de redefinição expirou. Solicite outro.',
      PRISMA_DATA_CONFLICT: 'Os dados foram alterados em outro dispositivo. Recarregue antes de continuar.'
    };
    return messages[error?.code] || error?.message || 'Não foi possível concluir a operação no Firebase.';
  }

  function cleanLocalUserData() {
    isAuthenticated = false;
    currentLocalUser = null;
    serverAuthenticated = false;
    firebaseAuthenticated = false;
    firebaseRevision = null;
    if (firebaseUnsubscribe) {
      firebaseUnsubscribe();
      firebaseUnsubscribe = null;
    }
    currentServerUser = null;
    currentProfileId = null;
    currentProfile = null;
    profiles = [];
    STORAGE_KEYS = { ...BASE_STORAGE_KEYS };

    receitas = [];
    despesas = [];
    contas = [];
    cartoes = [];
    investimentos = [];
    goals = [];
    categories = [];
    incomeData = Array(12).fill(0);
    expenseData = Array(12).fill(0);
    saldoAtual = 0;
    salarioMensal = 0;
    receitasMes = 0;
    despesasMes = 0;
    economiaMes = 0;
    window.__currentAiAnalysis = null;
    window.__currentAiRecommendations = [];
    window.__currentAiHealthScore = null;

    try {
      clearLocalAuthSession();
    } catch (error) {
      console.error('Não foi possível limpar os dados temporários da sessão local:', error);
    }

    if (typeof updateRoleUI === 'function') updateRoleUI(null);
    const profileDropdown = document.getElementById('profileDropdown');
    if (window.PrismaNavbar) window.PrismaNavbar.closeAll();
    else if (profileDropdown) {
      profileDropdown.classList.remove('show');
      profileDropdown.setAttribute('aria-hidden', 'true');
    }
  }

  function handleSessionExpired() {
    if (!serverAuthenticated) return;
    serverAuthenticated = false;
    currentServerUser = null;
    cleanLocalUserData();
    const app = document.getElementById('mainApp') || document.querySelector('.app');
    if (app) app.style.display = 'none';
    hideWelcomeScreen();
    showLoginModal();
    showToast('Sua sessão expirou. Faça login novamente para continuar.', 'warning');
  }

  function hideWelcomeScreen() {
    try {
      if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
      }
      localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, '1');
      if (isAuthenticated) {
        const app = document.getElementById('mainApp') || document.querySelector('.app');
        if (app) {
          app.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Erro ao esconder tela de boas-vindas:', error);
    }
  }

  function startApp() {
    try {
      hideWelcomeScreen();
      if (isAuthenticated) {
        const app = document.getElementById('mainApp') || document.querySelector('.app');
        if (app) {
          app.style.display = 'block';
        }
        
        // Carregar dados do perfil atual se existir
        if (currentProfileId) {
          loadProfileData(currentProfileId);
          try {
            if (!currentProfile && typeof getProfileById === 'function') {
              currentProfile = getProfileById(currentProfileId);
            }
          } catch (_) {}
        }
        if (typeof syncAuthenticatedUserUI === 'function') syncAuthenticatedUserUI();
        else setTimeout(() => { if (typeof syncAuthenticatedUserUI === 'function') syncAuthenticatedUserUI(); }, 0);
        
        showToast('Bem-vindo ao Prisma.');
      } else {
        const app = document.getElementById('mainApp') || document.querySelector('.app');
        if (app) app.style.display = 'none';
        showLoginModal();
      }
    } catch (error) {
      console.error('Erro ao iniciar aplicação:', error);
      if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
      }
      if (!isAuthenticated) {
        showLoginModal();
      }
    }
  }

  function startLocalAppAtDashboard() {
    startApp();
    if (isAuthenticated && typeof window.navigateToSection === 'function') {
      window.navigateToSection('dashboard');
    }
  }

  // ==================== LOGIN MODAL ====================
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const switchToRegister = document.getElementById('switchToRegister');
  let firebaseClientPromise = null;

  function getFirebaseClient() {
    if (window.PrismaFirebase) return Promise.resolve(window.PrismaFirebase);
    if (!firebaseClientPromise) {
      firebaseClientPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('prisma-firebase-ready', onReady);
          reject(new Error('Não foi possível carregar o módulo do Firebase. Verifique sua conexão e tente novamente.'));
        }, 12000);
        function onReady() {
          clearTimeout(timeout);
          if (window.PrismaFirebase) resolve(window.PrismaFirebase);
          else reject(new Error('O módulo do Firebase foi carregado sem inicializar.'));
        }
        window.addEventListener('prisma-firebase-ready', onReady, { once: true });
      });
    }
    return firebaseClientPromise;
  }

  function showLoginModal() {
    try {
      if (loginModal) {
        hideRegistrationModal();
        hideAuthFeedback('loginFeedback');
        loginModal.style.display = 'flex';
        loginModal.classList.add('show');
        
        const existingProfilesSection = document.getElementById('existingProfilesSection');
        const existingProfilesList = document.getElementById('existingProfilesList');
        if (existingProfilesSection) existingProfilesSection.style.display = 'none';
        if (existingProfilesList) {
          existingProfilesList.style.display = 'none';
          existingProfilesList.innerHTML = '';
        }
        if (existingProfilesSection) existingProfilesSection.style.display = 'none';
        if (existingProfilesList) existingProfilesList.innerHTML = '';
        
        refreshIcons();
        setupPasswordToggleButtons();
        requestAnimationFrame(() => {
          const firstInput = loginModal.querySelector('input:not([type="hidden"])');
          if (firstInput && document.activeElement !== firstInput) {
            firstInput.focus();
          }
        });
      }
    } catch (error) {
      console.error('Erro ao mostrar modal de login:', error);
    }
  }

  function hideLoginModal() {
    if (loginModal) {
      loginModal.style.display = 'none';
      loginModal.classList.remove('show');
    }
  }

  if (welcomeStartBtn) {
    welcomeStartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideWelcomeScreen();
      showRegistrationModal();
    });
  }

  // "Entrar" link in welcome top bar
  const welcomeLoginLink = document.getElementById('welcomeLoginLink');
  if (welcomeLoginLink) {
    welcomeLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      hideWelcomeScreen();
      showLoginModal();
    });
  }

  // "Já tem uma conta? Entrar" link in welcome actions area
  const welcomeLoginLink2 = document.getElementById('welcomeLoginLink2');
  if (welcomeLoginLink2) {
    welcomeLoginLink2.addEventListener('click', (e) => {
      e.preventDefault();
      hideWelcomeScreen();
      showLoginModal();
    });
  }

  // ==================== LGPD SCREEN ====================
  let _lgpdUser = null;

  function showLgpdScreen(user) {
    try {
      _lgpdUser = user || null;
      const lgpdScreen = document.getElementById('lgpdScreen');
      if (lgpdScreen) {
        lgpdScreen.style.display = 'flex';
        refreshIcons();
      }
    } catch (error) {
      console.error('Erro ao exibir tela LGPD:', error);
      startApp();
    }
  }

  function hideLgpdScreen() {
    const lgpdScreen = document.getElementById('lgpdScreen');
    if (lgpdScreen) {
      lgpdScreen.style.display = 'none';
    }
  }

  // Confirm LGPD consent button
  const btnConfirmLgpd = document.getElementById('btnConfirmLgpd');
  if (btnConfirmLgpd) {
    btnConfirmLgpd.addEventListener('click', async () => {
      const communications = document.getElementById('lgpdCommunications')?.checked ?? true;
      const analytics = document.getElementById('lgpdAnalytics')?.checked ?? true;
      const openFinance = document.getElementById('lgpdOpenFinance')?.checked ?? false;

      btnConfirmLgpd.disabled = true;
      const origText = btnConfirmLgpd.innerHTML;
      btnConfirmLgpd.innerHTML = '<i data-lucide="loader-circle"></i> Registrando...';
      refreshIcons();

      try {
        if (firebaseAuthenticated && currentLocalUser) {
          const consent = {
            essentialAccepted: true,
            communicationsConsent: communications,
            analyticsConsent: analytics,
            openFinanceConsent: openFinance,
            updatedAt: new Date().toISOString()
          };
          const firebase = await getFirebaseClient();
          await firebase.saveConsent(currentLocalUser.id, consent);
          firebaseConsent = consent;
        } else if (currentLocalUser) {
          saveLocalConsent(currentLocalUser.id, {
            communicationsConsent: communications,
            analyticsConsent: analytics,
            openFinanceConsent: openFinance
          });
        } else if (serverAuthenticated) {
          await apiFetch('/api/lgpd/consent', {
            method: 'POST',
            body: JSON.stringify({
              essentialAccepted: true,
              communicationsConsent: communications,
              analyticsConsent: analytics,
              openFinanceConsent: openFinance
            })
          });
        }
        hideLgpdScreen();
        if (currentLocalUser) startLocalAppAtDashboard();
        else startApp();
        showToast('Preferências de privacidade registradas com sucesso.');
      } catch (error) {
        console.error('Erro ao registrar consentimento LGPD:', error);
        showToast('Não foi possível salvar as preferências. Tente novamente.');
      } finally {
        btnConfirmLgpd.disabled = false;
        btnConfirmLgpd.innerHTML = origText;
        refreshIcons();
      }
    });
  }

  // Privacy Policy modal
  const lgpdViewPrivacyPolicy = document.getElementById('lgpdViewPrivacyPolicy');
  const privacyPolicyModal = document.getElementById('privacyPolicyModal');
  const closePrivacyPolicy = document.getElementById('closePrivacyPolicy');

  if (lgpdViewPrivacyPolicy && privacyPolicyModal) {
    lgpdViewPrivacyPolicy.addEventListener('click', (e) => {
      e.preventDefault();
      privacyPolicyModal.style.display = 'flex';
      refreshIcons();
    });
  }

  if (closePrivacyPolicy && privacyPolicyModal) {
    closePrivacyPolicy.addEventListener('click', () => {
      privacyPolicyModal.style.display = 'none';
    });
    privacyPolicyModal.addEventListener('click', (e) => {
      if (e.target === privacyPolicyModal) privacyPolicyModal.style.display = 'none';
    });
  }

  // ==================== REGISTRATION MODAL ====================
  const registrationModal = document.getElementById('registrationModal');
  const registrationForm = document.getElementById('registrationForm');
  const existingProfilesSection = document.getElementById('existingProfilesSection');
  const showExistingProfilesBtn = document.getElementById('showExistingProfilesBtn');
  const existingProfilesList = document.getElementById('existingProfilesList');

  // Enter: submeter login/cadastro ou iniciar app na tela de boas-vindas
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const target = e.target;

    if (loginModal?.style.display === 'flex' && loginForm?.contains(target)) {
      if (target.matches('input, select, textarea')) {
        e.preventDefault();
        if (loginForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))) {
          loginForm.submit();
        }
      }
      return;
    }

    if (registrationModal?.style.display === 'flex' && registrationForm?.contains(target)) {
      if (target.matches('input, select, textarea')) {
        e.preventDefault();
        if (registrationForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))) {
          registrationForm.submit();
        }
      }
      return;
    }

    if (welcomeScreen?.style.display === 'flex') {
      e.preventDefault();
      startApp();
    }
  });

  // Controles opcionais da tela de resumo/configurações (podem não existir em todas as views)
  const saveDataBtn = document.getElementById('saveDataBtn');
  const inputSaldo = document.getElementById('inputSaldo');
  const inputSalario = document.getElementById('inputSalario');
  const inputReceitas = document.getElementById('inputReceitas');
  const inputDespesas = document.getElementById('inputDespesas');
  const inputEconomia = document.getElementById('inputEconomia');

  // Verificar e carregar perfis existentes ao inicializar
  function checkExistingProfiles() {
    const existingProfiles = getJSONFromStorage(BASE_STORAGE_KEYS.profiles, []);

    return existingProfiles;
  }

  function showRegistrationModal() {
    try {
      hideLoginModal();
      hideAuthFeedback('regFeedback');
      // Mostrar modal de cadastro
      if (registrationModal) {
        registrationModal.style.display = 'flex';
        registrationModal.classList.add('show');
      }
      
      const titleElement = document.getElementById('registrationTitle');
      const subtitleElement = document.getElementById('registrationSubtitle');
      if (titleElement) titleElement.textContent = 'Crie sua conta';
      if (subtitleElement) subtitleElement.textContent = 'Comece sua jornada financeira inteligente';
      if (existingProfilesSection) existingProfilesSection.style.display = 'none';
      if (existingProfilesList) existingProfilesList.innerHTML = '';
      
      if (typeof refreshIcons === 'function') {
        refreshIcons();
      }
      setupPasswordToggleButtons();
      requestAnimationFrame(() => {
        const firstInput = registrationModal.querySelector('input:not([type="hidden"])');
        if (firstInput && document.activeElement !== firstInput) {
          firstInput.focus();
        }
      });
    } catch (error) {
      console.error('Erro ao mostrar modal de cadastro:', error);
      // Tentar mostrar modal mesmo com erro
      try {
        if (registrationModal) {
          registrationModal.style.display = 'flex';
          registrationModal.classList.add('show');
        }
      } catch (e) {
        console.error('Erro crítico ao mostrar modal:', e);
      }
    }
  }

  function hideRegistrationModal() {
    if (registrationModal) {
      registrationModal.style.display = 'none';
      registrationModal.classList.remove('show');
    }
    
    // Resetar lista de perfis existentes
    if (existingProfilesList) {
      existingProfilesList.style.display = 'none';
      existingProfilesList.innerHTML = '';
    }
  }
  
  // Renderizar perfis existentes no modal de cadastro
  function renderExistingProfiles(profiles) {
    if (!existingProfilesList) return;
    
    existingProfilesList.innerHTML = '';
    
    profiles.forEach(profile => {
      const profileItem = document.createElement('button');
      profileItem.type = 'button';
      profileItem.className = 'existing-profile-item';
      profileItem.innerHTML = '<span class="existing-profile-avatar"><i data-lucide="user"></i></span><span class="existing-profile-info"><span class="existing-profile-name"></span><span class="existing-profile-email"></span></span><span class="existing-profile-arrow"><i data-lucide="chevron-right"></i></span>';
      profileItem.querySelector('.existing-profile-name').textContent = profile.name;
      profileItem.querySelector('.existing-profile-email').textContent = profile.email;
      profileItem.addEventListener('click', () => {
        showLoginPasswordPrompt(profile);
      });
      
      existingProfilesList.appendChild(profileItem);
    });
    
    refreshIcons();
  }
  
  // Mostrar prompt para senha do perfil existente
  function showLoginPasswordPrompt(profile) {
    // Redirecionar para o modal de login com o email preenchido
    hideRegistrationModal();
    showLoginModal();
    
    // Preencher o campo de email
    const loginEmailInput = document.getElementById('loginEmail');
    if (loginEmailInput) {
      loginEmailInput.value = profile.email;
    }
    
    // Focar no campo de senha
    const loginPasswordInput = document.getElementById('loginPassword');
    if (loginPasswordInput) {
      loginPasswordInput.focus();
    }
  }
  
  // Fazer login em perfil existente
  function loginToProfile(profile) {
    hideRegistrationModal(); showLoginModal();
    const email=document.getElementById('loginEmail'); if(email) email.value=profile.email||'';
    document.getElementById('loginPassword')?.focus();
  }

  // Atualizar lista de perfis existentes após criar novo perfil
  function updateExistingProfilesList() {
    if (existingProfilesSection) existingProfilesSection.style.display = 'none';
  }

  // Event listener for registration form
  if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;

      // Validation
      if (!name || !email || !password || !confirmPassword) {
        showToast('Por favor, preencha todos os campos.');
        return;
      }

      if (password !== confirmPassword) {
        showToast('As senhas não coincidem.');
        document.getElementById('regPassword').style.borderColor = '#ef4444';
        document.getElementById('regConfirmPassword').style.borderColor = '#ef4444';
        return;
      }

      if (password.length < 8) {
        showToast('A senha deve ter pelo menos 8 caracteres.');
        document.getElementById('regPassword').style.borderColor = '#ef4444';
        return;
      }
      
      // Proteção contra duplo clique
      const submitBtn = registrationForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Cadastrando...';
        refreshIcons();
        try {
          await handleRegistrationProcess(name, email, password);
        } finally {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          submitBtn.innerHTML = originalHTML;
          refreshIcons();
        }
      } else {
        await handleRegistrationProcess(name, email, password);
      }
    });
  }
  
  // Clear error borders when user starts typing
  const regNameInput = document.getElementById('regName');
  const regEmailInput = document.getElementById('regEmail');
  const regPasswordInput = document.getElementById('regPassword');
  const regConfirmPasswordInput = document.getElementById('regConfirmPassword');
  
  if (regNameInput) {
    regNameInput.addEventListener('input', () => {
      regNameInput.style.borderColor = '';
    });
  }
  
  if (regEmailInput) {
    regEmailInput.addEventListener('input', () => {
      regEmailInput.style.borderColor = '';
    });
  }
  
  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', () => {
      regPasswordInput.style.borderColor = '';
    });
  }
  
  if (regConfirmPasswordInput) {
    regConfirmPasswordInput.addEventListener('input', () => {
      regConfirmPasswordInput.style.borderColor = '';
    });
  }
  
  // Firebase Auth owns credentials; the browser never stores passwords or password hashes.
  async function handleRegistrationProcess(name, email, password) {
    hideAuthFeedback('regFeedback');
    
    // Validação client-side refinada
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (cleanName.length < 2) {
      showAuthFeedback('regFeedback', 'Por favor, informe seu nome completo.', 'error');
      const nameInput = document.getElementById('regName');
      if (nameInput) { nameInput.style.borderColor = '#ef4444'; nameInput.focus(); }
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showAuthFeedback('regFeedback', 'Por favor, insira um endereço de e-mail válido.', 'error');
      const emailInput = document.getElementById('regEmail');
      if (emailInput) { emailInput.style.borderColor = '#ef4444'; emailInput.focus(); }
      return;
    }
    
    if (!password || password.length < 8) {
      showAuthFeedback('regFeedback', 'A senha deve conter no mínimo 8 caracteres.', 'error');
      const passInput = document.getElementById('regPassword');
      if (passInput) { passInput.style.borderColor = '#ef4444'; passInput.focus(); }
      return;
    }

    try {
      showAuthFeedback('regFeedback', 'Criando sua conta segura no Firebase...', 'info');
      const firebase = await getFirebaseClient();
      await firebase.ready;
      await firebase.register(cleanEmail, password, cleanName);
      hideRegistrationModal();
      showToast(`Conta criada com sucesso, ${cleanName}.`);
    } catch (error) {
      console.error('Erro no cadastro Firebase:', error);
      showAuthFeedback('regFeedback', authErrorMessage(error), 'error');
    }
  }
  
  // Event listener para botão de mostrar perfis existentes
  if (showExistingProfilesBtn) {
    showExistingProfilesBtn.addEventListener('click', () => {
      if (existingProfilesList) {
        const isHidden = existingProfilesList.style.display === 'none';
        existingProfilesList.style.display = isHidden ? 'block' : 'none';
        
        // Atualizar texto do botão
        if (showExistingProfilesBtn) {
          if (isHidden) {
            showExistingProfilesBtn.innerHTML = '<i data-lucide="chevron-up"></i> Ocultar perfis';
          } else {
            showExistingProfilesBtn.innerHTML = '<i data-lucide="log-in"></i> Fazer login como';
          }
          refreshIcons();
          setupPasswordToggleButtons();
        }
      }
    });
  }

  // Event listener para alternar para cadastro
  if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      hideLoginModal();
      showRegistrationModal();
    });
  }

  const resetPasswordModal=document.getElementById('resetPasswordModal');
  const forgotPasswordBtn=document.getElementById('forgotPasswordBtn');
  const forgotPasswordForm=document.getElementById('forgotPasswordForm');
  const resetPasswordForm=document.getElementById('resetPasswordForm');
  const backToLoginFromReset=document.getElementById('backToLoginFromReset');
  function openResetRequest(){if(resetPasswordModal){resetPasswordModal.style.display='flex';resetPasswordModal.classList.add('show');}hideLoginModal();}
  function closeReset(){if(resetPasswordModal){resetPasswordModal.style.display='none';resetPasswordModal.classList.remove('show');}}
  if(forgotPasswordBtn)forgotPasswordBtn.addEventListener('click',openResetRequest);
  if(backToLoginFromReset)backToLoginFromReset.addEventListener('click',e=>{e.preventDefault();closeReset();showLoginModal();});
  if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail')?.value.trim().toLowerCase() || '';
    const feedback = document.getElementById('forgotFeedback');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAuthFeedback('forgotFeedback', 'Informe um endereço de e-mail válido.', 'error');
      return;
    }
    try {
      const firebase = await getFirebaseClient();
      await firebase.resetPassword(email);
      showAuthFeedback('forgotFeedback', 'Se houver uma conta para este e-mail, o Firebase enviará as instruções de recuperação.', 'success');
    } catch (error) {
      console.error('Erro ao solicitar redefinição de senha:', error);
      showAuthFeedback('forgotFeedback', authErrorMessage(error), 'error');
    }
  });
  if (resetPasswordForm) resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = new URLSearchParams(location.search);
    const actionCode = query.get('oobCode');
    const password = document.getElementById('resetPassword')?.value || '';
    const confirmation = document.getElementById('resetPasswordConfirm')?.value || '';
    if (!actionCode) {
      showAuthFeedback('resetFeedback', 'O link de redefinição não contém um código Firebase válido.', 'error');
      return;
    }
    if (password.length < 8) {
      showAuthFeedback('resetFeedback', 'A senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    if (password !== confirmation) {
      showAuthFeedback('resetFeedback', 'As senhas não coincidem.', 'error');
      return;
    }
    try {
      const firebase = await getFirebaseClient();
      await firebase.applyPasswordReset(actionCode, password);
      history.replaceState(null, '', location.pathname);
      closeReset();
      showLoginModal();
      showAuthFeedback('loginFeedback', 'Senha redefinida. Entre com sua nova senha.', 'success');
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      showAuthFeedback('resetFeedback', authErrorMessage(error), 'error');
    }
  });
  const resetToken = new URLSearchParams(location.search).get('reset_token');
  if (resetToken && resetPasswordModal) {
    document.getElementById('resetSubtitle').textContent = 'Este link pertence ao sistema anterior. Solicite uma nova redefinição pelo Firebase.';
    resetPasswordForm.style.display = 'none';
    forgotPasswordForm.style.display = 'block';
    resetPasswordModal.style.display = 'flex';
  const firebaseActionCode = new URLSearchParams(location.search).get('oobCode');
  if (firebaseActionCode && resetPasswordModal) {
    document.getElementById('resetSubtitle').textContent = 'Defina uma nova senha para sua conta Firebase.';
    forgotPasswordForm.style.display = 'none';
    resetPasswordForm.style.display = 'block';
    resetPasswordModal.style.display = 'flex';
    resetPasswordModal.classList.add('show');
  }
    resetPasswordModal.classList.add('show');
  }

  // Event listener para formulário de login
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      // Validation
      if (!email || !password) {
        showToast('Por favor, preencha todos os campos.');
        return;
      }

      handleLoginProcess(email, password);
    });
  }

  // Sign in through Firebase Authentication; legacy browser accounts are only consulted for data migration.
  async function handleLoginProcess(email, password) {
    hideAuthFeedback('loginFeedback');
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (!cleanEmail || !password) {
      showAuthFeedback('loginFeedback', 'Por favor, informe seu e-mail e senha.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showAuthFeedback('loginFeedback', 'Informe um endereço de e-mail válido.', 'error');
      document.getElementById('loginEmail')?.focus();
      return;
    }
    
    const submit = document.querySelector('#loginForm button[type=submit]');
    if (submit) {
      submit.disabled = true;
      submit.classList.add('is-loading');
      submit.querySelector('i')?.setAttribute('data-lucide', 'loader-circle');
      refreshIcons();
    }
    try {
      showAuthFeedback('loginFeedback', 'Verificando sua conta no Firebase...', 'info');
      const firebase = await getFirebaseClient();
      await firebase.login(cleanEmail, password);
      hideLoginModal();
    } catch (error) {
      console.error('Erro no login Firebase:', error);
      showAuthFeedback('loginFeedback', authErrorMessage(error), 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.classList.remove('is-loading');
        submit.querySelector('i')?.setAttribute('data-lucide', 'log-in');
        refreshIcons();
      }
    }
  }

  // Clear error borders when user starts typing in login form
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  
  if (loginEmailInput) {
    loginEmailInput.addEventListener('input', () => {
      loginEmailInput.style.borderColor = '';
    });
  }
  
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('input', () => {
      loginPasswordInput.style.borderColor = '';
    });
  }

  // Event listener para link de login no footer do modal de cadastro
  const switchToLogin = document.getElementById('switchToLogin');
  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      hideRegistrationModal();
      showLoginModal();
    });
  }

  // ==================== SIDEBAR & NAVIGATION ====================
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mobileMenu = document.getElementById('mobileMenu');

  function updateMobileMenuIcon() {
    if (!mobileMenu || !sidebar) return;
    const isOpen = (window.innerWidth >= 1024)
      ? sidebar.classList.contains('collapsed')
      : (sidebar.classList.contains('open') || sidebar.classList.contains('active'));

    const icon = mobileMenu.querySelector('i') || mobileMenu.querySelector('svg');
    if (icon) {
      icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
    }
    mobileMenu.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileMenu.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    mobileMenu.classList.toggle('active', isOpen);

    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }
  window.updateMobileMenuIcon = updateMobileMenuIcon;

  if (mobileMenu && sidebar) {
    mobileMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth >= 1024) {
        // Desktop: recolher / expandir sidebar
        sidebar.classList.toggle('collapsed');
      } else {
        if (window.PrismaNavbar) {
          window.PrismaNavbar.toggle('mobileMenu');
        } else {
          const isOpen = sidebar.classList.toggle('open');
          sidebar.classList.toggle('active', isOpen);
          if (sidebarOverlay) {
            sidebarOverlay.classList.toggle('active', isOpen);
            sidebarOverlay.style.display = isOpen ? 'block' : 'none';
          }
        }
      }
      updateMobileMenuIcon();
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      if (window.PrismaNavbar) {
        window.PrismaNavbar.close('mobileMenu');
        return;
      }
      if (sidebar) {
        sidebar.classList.remove('open', 'active');
      }
      sidebarOverlay.style.display = 'none';
      updateMobileMenuIcon();
    });
  }

  // ==================== NAVEGAÇÃO GLOBAL DE SEÇÕES (SEM CONFLITOS INLINE) ====================
  const SECTION_HASH_PREFIX = '#/tela/';
  const sectionHashFor = (screenId) => `${SECTION_HASH_PREFIX}${encodeURIComponent(screenId)}`;

  window.navigateToSection = function(screenId, options = {}) {
    if (window.PrismaNavbar) window.PrismaNavbar.closeAll();
    if (!isAuthenticated) {
      const app = document.getElementById('mainApp') || document.querySelector('.app');
      if (app) app.style.display = 'none';
      showLoginModal();
      return;
    }
    if (!screenId) return;
    if (screenId === 'perfil') screenId = 'dados';

    const targetSection = document.getElementById(screenId);
    if (!targetSection) {
      console.warn('Seção não encontrada no DOM:', screenId);
      return;
    }

    // 1. Limpa classe active e limpa estilo inline display de todas as seções
    document.querySelectorAll('.section').forEach((s) => {
      s.classList.remove('active');
      s.style.display = ''; // Limpa sobreposição inline!
    });

    // 2. Ativa a seção selecionada
    targetSection.classList.add('active');
    targetSection.style.display = ''; // Limpa sobreposição inline!

    // Tratamento especial admin
    if (screenId === 'admin') {
      const isUserAdmin = typeof currentUser !== 'undefined' && currentUser?.role === 'ADMIN';
      if (!isUserAdmin) {
        targetSection.classList.remove('active');
        targetSection.style.display = 'none';
        if (typeof showToast === 'function') showToast('Acesso restrito ao administrador', 'warning');
        return;
      }
    }

    const sectionHash = sectionHashFor(screenId);
    if (options.updateHistory !== false && window.location.hash !== sectionHash) {
      window.history.pushState({ section: screenId }, '', sectionHash);
    }

    // 3. Atualiza os links de navegação
    document.querySelectorAll('.nav-item, [data-section]').forEach((nav) => {
      const sectionAttr = nav.getAttribute('data-section');
      if (sectionAttr) {
        const isNavActive = sectionAttr === screenId || (screenId === 'carteira-ativos' && sectionAttr === 'investimentos');
        if (nav.classList.contains('nav-item')) {
          nav.classList.toggle('active', isNavActive);
        }
      }
    });

    // 4. Rola para o topo suavemente
    window.scrollTo({ top: 0, behavior: 'auto' });

    // 5. Fecha menu mobile se aberto
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open', 'active');
    if (sidebarOverlay) {
      sidebarOverlay.classList.remove('active');
      sidebarOverlay.style.display = 'none';
    }
    if (typeof window.updateMobileMenuIcon === 'function') {
      window.updateMobileMenuIcon();
    }

    // 6. Atualiza ícones Lucide
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }

    // 7. Sincroniza visualizações e dados específicos por tela
    try {
      if (screenId === 'centro-financeiro' || screenId === 'dashboard' || screenId === 'relatorios') {
        if (typeof updateCentroFinanceiro === 'function') updateCentroFinanceiro();
        if (typeof updateDashboardCards === 'function') updateDashboardCards();
      }
      if (screenId === 'centro-financeiro' && typeof runCentroSimulacao === 'function') {
        setTimeout(() => { try { runCentroSimulacao(); } catch (_) {} }, 0);
      }
      if (screenId === 'investimentos' || screenId === 'carteira-ativos') {
        if (typeof renderInvestimentos === 'function') renderInvestimentos();
        if (typeof switchPrismaInvestTab === 'function') switchPrismaInvestTab('posicoes');
      }
      if (screenId === 'dados') {
        if (typeof renderProfiles === 'function') renderProfiles();
      }
      if (screenId === 'educacao-financeira') {
        if (typeof renderEducation === 'function') renderEducation();
      }
      if (screenId === 'receitas' && typeof renderReceitas === 'function') renderReceitas();
      if (screenId === 'despesas' && typeof renderDespesas === 'function') renderDespesas();
      if (screenId === 'contas' && typeof renderContas === 'function') renderContas();
      if (screenId === 'cartoes' && typeof renderCartoes === 'function') renderCartoes();
      if (screenId === 'metas' && typeof renderGoals === 'function') renderGoals();
      if (screenId === 'configuracoes') {
        setTimeout(() => { try { loadLgpdSettings(); } catch(_) {} }, 0);
      }
      if (screenId === 'prisma-ai' && typeof runPrismaAiAnalysis === 'function') {
        if (!window.__currentAiAnalysis) {
          runPrismaAiAnalysis(typeof aiActivePeriod !== 'undefined' ? aiActivePeriod : '30d', { showBotMessage: false });
        }
      }
    } catch (syncErr) {
      console.warn('Sync na navegação:', syncErr);
    }
  };

  function restoreSectionFromLocation() {
    const hash = window.location.hash;
    const encodedScreenId = hash.startsWith(SECTION_HASH_PREFIX)
      ? hash.slice(SECTION_HASH_PREFIX.length)
      : hash.slice(1);
    if (!encodedScreenId) return false;

    let screenId;
    try {
      screenId = decodeURIComponent(encodedScreenId);
    } catch (error) {
      console.warn('Identificador de tela inválido na URL:', error);
      return false;
    }
    const section = screenId && document.getElementById(screenId);
    if (!section?.classList.contains('section')) return false;
    if (screenId === 'admin' && !(typeof currentUser !== 'undefined' && currentUser?.role === 'ADMIN')) {
      return false;
    }
    if (hash !== sectionHashFor(screenId)) {
      window.history.replaceState({ section: screenId }, '', sectionHashFor(screenId));
    }
    window.navigateToSection(screenId, { updateHistory: false });
    return true;
  }

  window.addEventListener('popstate', () => {
    if (!isAuthenticated) {
      const app = document.getElementById('mainApp') || document.querySelector('.app');
      if (app) app.style.display = 'none';
      window.history.replaceState({ screen: 'login' }, '', window.location.pathname + window.location.search);
      showLoginModal();
      return;
    }
    if (!restoreSectionFromLocation()) {
      window.history.replaceState({ section: 'dashboard' }, '', sectionHashFor('dashboard'));
      window.navigateToSection('dashboard', { updateHistory: false });
    }
  });

  const logoHomeLink = document.getElementById('logoHomeLink');
  if (logoHomeLink) {
    logoHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.PrismaNotifications && typeof window.PrismaNotifications.close === 'function') {
        window.PrismaNotifications.close();
      }

      window.navigateToSection('dashboard');
    });
  }

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;
      if (target) {
        window.navigateToSection(target);
      }
    });
  });

  // ==================== INITIAL DATA & DATA MANAGEMENT ====================

  // Variáveis globais de dados
  let receitas = [];
  let despesas = [];
  let contas = [];
  let cartoes = [];
  let investimentos = [];
  let goals = [];

  // Dados de séries e resumo (incomeData, expenseData, categories now defined globally above)
  let summaryData = {
    saldoAtual: 0.00,
    salarioMensal: 0,
  };
  let salarioMensal = 0;
  let receitasMes = 0;
  let despesasMes = 0;
  let economiaMes = 0;

  function limparDadosIniciais() {
    receitas = getJSONFromStorage(STORAGE_KEYS.receitas, []);
    despesas = getJSONFromStorage(STORAGE_KEYS.despesas, []);
    contas = getJSONFromStorage(STORAGE_KEYS.contas, []);
    cartoes = getJSONFromStorage(STORAGE_KEYS.cartoes, []);
    investimentos = getJSONFromStorage(STORAGE_KEYS.investimentos, []);
    goals = getJSONFromStorage(STORAGE_KEYS.goals, []);
    
    // Carregar dados adicionais específicos do perfil
    incomeData = getJSONFromStorage(STORAGE_KEYS.monthlyFlow, { inc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], exp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }).inc;
    expenseData = getJSONFromStorage(STORAGE_KEYS.monthlyFlow, { inc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], exp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }).exp;
    categories = getJSONFromStorage(STORAGE_KEYS.categories, []);
    summaryData = getJSONFromStorage(STORAGE_KEYS.summary, {
      saldoAtual: 0.00,
      salarioMensal: 0,
    });
    saldoAtual = summaryData.saldoAtual;
    salarioMensal = summaryData.salarioMensal;
  }

  // Executar limpeza inicial
  limparDadosIniciais();
  
  // Função para carregar dados do perfil atual
  function loadProfileData(profileId) {
    // Atualizar chaves de storage para o perfil específico
    STORAGE_KEYS = getProfileStorageKeys(profileId);
    currentProfileId = profileId || currentProfileId;

    // Manter referência do usuário autenticado
    try {
      const list = Array.isArray(profiles) ? profiles : getJSONFromStorage(BASE_STORAGE_KEYS.profiles, []);
      const found = list.find((p) => String(p.id) === String(profileId));
      if (found) {
        currentProfile = found;
        if (typeof persistAuthenticatedUser === 'function') persistAuthenticatedUser(found);
      }
    } catch (_) {}
    
    // Recarregar dados com as novas chaves
    limparDadosIniciais();
    window.__currentAiHealthScore = getJSONFromStorage(getAiHealthScoreStorageKey(profileId), null);
    renderSavedFinancialHealthScore(window.__currentAiHealthScore);
    
    // Atualizar interface com os dados do perfil
    recalculateAll();
    if (typeof syncAuthenticatedUserUI === 'function') syncAuthenticatedUserUI();
  }

  // Função para salvar dados do perfil atual antes de alternar
  function saveCurrentProfileData() {
    rebuildCashflowFromTransactions();
    const records = [
      [STORAGE_KEYS.receitas, receitas],
      [STORAGE_KEYS.despesas, despesas],
      [STORAGE_KEYS.contas, contas],
      [STORAGE_KEYS.cartoes, cartoes],
      [STORAGE_KEYS.investimentos, investimentos],
      [STORAGE_KEYS.goals, goals],
      [STORAGE_KEYS.summary, { saldoAtual, salarioMensal }],
      [STORAGE_KEYS.monthlyFlow, { inc: incomeData, exp: expenseData }],
      [STORAGE_KEYS.categories, categories]
    ];
    let saved = true;
    records.forEach(([key, data]) => {
      if (!setJSONToStorage(key, data)) saved = false;
    });
    if (saved) scheduleServerSync();
    return saved;
  }

  // Função para determinar prioridade baseada na categoria
  function determinarPrioridadePorCategoria(categoria) {
    const categoriaLower = categoria.toLowerCase();
    
    // Prioridade máxima (urgente)
    if (categoriaLower.includes('moradia') || categoriaLower.includes('alimentação') || 
        categoriaLower.includes('alimentacao') || categoriaLower.includes('saúde') || 
        categoriaLower.includes('saude') || categoriaLower.includes('remédio') ||
        categoriaLower.includes('remedio')) {
      return 'urgente';
    }
    
    // Prioridade alta
    if (categoriaLower.includes('educação') || categoriaLower.includes('educacao') ||
        categoriaLower.includes('transporte') || categoriaLower.includes('combustível') ||
        categoriaLower.includes('combustivel') || categoriaLower.includes('escola')) {
      return 'alta';
    }
    
    // Prioridade média
    if (categoriaLower.includes('conta') || categoriaLower.includes('telefone') ||
        categoriaLower.includes('internet') || categoriaLower.includes('energia') ||
        categoriaLower.includes('água') || categoriaLower.includes('agua') ||
        categoriaLower.includes('telecomunicação') || categoriaLower.includes('telecomunicacao')) {
      return 'media';
    }
    
    // Prioridade baixa (padrão)
    return 'baixa';
  }

  function loadInitial(key, fallback) {
    return getJSONFromStorage(key, fallback);
  }

  function saveDataStorage(key, data) {
    setJSONToStorage(key, data);
    scheduleServerSync();
  }


  // ==================== REAL DATABASE / API PERSISTENCE ====================
  const LOCAL_AUTH_DB_NAME = 'prisma-local-auth';
  const LOCAL_AUTH_USERS_STORE = 'users';
  const LOCAL_AUTH_SESSION_KEY = 'prisma_local_session_v1';
  let localAuthDatabasePromise = null;
  let isAuthenticated = false;
  let firebaseAuthenticated = false;
  let firebaseRevision = null;
  let firebaseUnsubscribe = null;
  let firebaseAuthUnsubscribe = null;
  let firebaseActivationPromise = null;
  let firebaseConsent = null;
  let firebaseApplyingState = false;
  let currentLocalUser = null;
  let serverAuthenticated = false;
  let currentServerUser = null;
  let serverSyncTimer = null;
  let serverSyncInFlight = false;
  let serverSyncPending = false;

  function openLegacyAuthDatabase() {
    if (!window.indexedDB) throw new Error('O armazenamento IndexedDB legado não está disponível para migração.');
    if (localAuthDatabasePromise) return localAuthDatabasePromise;

    localAuthDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(LOCAL_AUTH_DB_NAME);
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(new Error('Não há uma base de contas locais existente para migrar.'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Não foi possível ler a base de contas locais legada.'));
      request.onblocked = () => reject(new Error('Feche outras abas do Prisma para ler a base local legada.'));
    }).catch((error) => {
      localAuthDatabasePromise = null;
      throw error;
    });

    return localAuthDatabasePromise;
  }

  async function readLegacyAuthStore(operation) {
    const database = await openLegacyAuthDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(LOCAL_AUTH_USERS_STORE, 'readonly');
      let result;
      let request;
      try {
        request = operation(transaction.objectStore(LOCAL_AUTH_USERS_STORE));
      } catch (error) {
        reject(error);
        return;
      }
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error('Falha ao ler a conta local legada.'));
      transaction.onerror = () => reject(transaction.error || new Error('Falha ao ler a conta local legada.'));
      transaction.onabort = () => reject(transaction.error || new Error('A leitura da conta local legada foi cancelada.'));
      transaction.oncomplete = () => resolve(result);
    });
  }

  function normalizeAuthEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  async function getLocalUserByEmail(email) {
    return readLegacyAuthStore((users) => users.index('email').get(normalizeAuthEmail(email)));
  }

  function clearLocalAuthSession() {
    try {
      localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      window.sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      localStorage.removeItem(BASE_STORAGE_KEYS.currentProfileId);
      localStorage.removeItem('prisma_current_user');
    } catch (error) {
      console.warn('Não foi possível limpar os metadados locais legados:', error);
    }
  }

  function saveLocalConsent(userId, preferences) {
    const consent = {
      ...preferences,
      essentialAccepted: true,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`prisma_lgpd_consent_${userId}`, JSON.stringify(consent));
    return consent;
  }

  function readLocalConsent(userId = currentLocalUser?.id) {
    if (!userId) return null;
    try {
      return JSON.parse(localStorage.getItem(`prisma_lgpd_consent_${userId}`) || 'null');
    } catch (error) {
      console.error('Não foi possível ler as preferências locais de privacidade:', error);
      return null;
    }
  }

  function getApiBaseUrl(){
    const configured=String(window.PRISMA_API_URL||'').trim().replace(/\/$/,'');
    if(configured) return configured;
    if(location.protocol!=='file:' && (location.hostname==='localhost' || location.hostname==='127.0.0.1')) return '';
    try { const saved=String(localStorage.getItem('prisma_api_base')||'').trim().replace(/\/$/,''); if(saved) return saved; } catch(_) {}
    if(location.protocol==='file:') return 'http://localhost:3000';
    return '';
  }
  function rememberApiBase(base){
    try { localStorage.setItem('prisma_api_base',base||''); } catch(_) {}
  }
  async function discoverApiBase(){
    const configured=String(window.PRISMA_API_URL||'').trim().replace(/\/$/,'');
    if(configured) return configured;
    const candidates = location.protocol === 'file:'
      ? Array.from({length:11}, (_, index) => `http://localhost:${3000 + index}`)
      : [''];
    for(const base of candidates){
      try{
        const r=await fetch(`${base}/api/health`,{cache:'no-store'});
        if(r.ok){ rememberApiBase(base); return base; }
      }catch(_){}
    }
    throw new Error('Backend Prisma não encontrado. Execute "npm start" e tente novamente.');
  }
  async function apiFetch(url, options = {}) {
    let base=getApiBaseUrl();
    let target=`${base}${url}`;
    let response;
    try {
      response=await fetch(target,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    } catch(networkError) {
      try {
        base=await discoverApiBase(); target=`${base}${url}`;
        response=await fetch(target,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
      } catch(retryError) {
        const e=new Error('Não foi possível conectar ao servidor Prisma. Execute "npm start" e tente novamente.');
        e.code='NETWORK_ERROR'; e.cause=retryError; throw e;
      }
    }
    let payload={}; try { payload=await response.json(); } catch(_) {}
    if(!response.ok){
      if (response.status === 401 && !url.startsWith('/api/auth/')) {
        handleSessionExpired();
      }
      const e=new Error(payload.error||'Erro HTTP ' + response.status);
      e.status=response.status;
      throw e;
    }
    return payload;
  }
  function collectServerState(){
    let notifications=[]; try { const r=localStorage.getItem('prisma_notifications_v2'); notifications=r?((JSON.parse(r).notifications)||[]):[]; } catch(_) {}
    let education={completed:[],points:0,challengeDone:false}; try { education=JSON.parse(localStorage.getItem(getEducationStorageKey())||'{}'); } catch(_) {}
    education.progress = getJSONFromStorage(getScopedStorageKey('prisma_trilha_progresso_v1'), {});
    let prismaAiPlan=[]; try { prismaAiPlan=JSON.parse(localStorage.getItem(getScopedStorageKey('prisma_ai_savings_plan'))||'[]'); } catch(_) {}
    let healthScore=null; try { healthScore=JSON.parse(localStorage.getItem(getAiHealthScoreStorageKey())||'null'); } catch(_) {}
    const settings = {
      categoryBudgets: getJSONFromStorage(getScopedStorageKey('prisma_category_budgets_v1'), {}),
      alertsMeta: getJSONFromStorage(getScopedStorageKey('prisma_alerts_meta_v1'), {}),
      transfers: getJSONFromStorage(getScopedStorageKey('prisma_transferencias'), [])
    };
    const profile = currentProfile ? {
      id: currentProfile.id,
      name: currentProfile.name || '',
      email: currentProfile.email || '',
      type: currentProfile.type || 'fisica',
      doc: currentProfile.doc || '',
      saldo: Number(currentProfile.saldo) || 0,
      salario: Number(currentProfile.salario) || 0,
      despesas: Number(currentProfile.despesas) || 0,
      createdAt: currentProfile.createdAt || null
    } : {};
    return {
      profile,
      receitas:Array.isArray(receitas)?receitas:[],
      despesas:Array.isArray(despesas)?despesas:[],
      contas:Array.isArray(contas)?contas:[],
      cartoes:Array.isArray(cartoes)?cartoes:[],
      investimentos:Array.isArray(investimentos)?investimentos:[],
      goals:Array.isArray(goals)?goals:[],
      categories:Array.isArray(categories)?categories:[],
      summary:summaryData||{saldoAtual:saldoAtual||0,salarioMensal:salarioMensal||0},
      monthlyFlow:{inc:incomeData||Array(12).fill(0),exp:expenseData||Array(12).fill(0)},
      education:{completed:education.completed||[],points:education.points||0,challengeDone:!!education.challengeDone,progress:education.progress||{}},
      settings,
      notifications,
      prismaAi:{analysis:window.__currentAiAnalysis||null,recommendations:window.__currentAiRecommendations||[],savingsPlan:prismaAiPlan,healthScore,history:[]}
    };
  }
  function hasFinancialData(state){return ['receitas','despesas','contas','cartoes','investimentos','goals'].some(k=>Array.isArray(state?.[k])&&state[k].length>0)}
  function profileFromServerUser(user){return {id:user.id,name:user.name,email:user.email,type:'fisica',doc:'',saldo:0,salario:0,despesas:0,createdAt:user.createdAt}}
  function updateRoleUI(user){
    currentServerUser=user||null;
    const adminNav=document.getElementById('adminNavItem');
    if(adminNav) adminNav.style.display=user?.role==='ADMIN'?'flex':'none';
    const adminSection=document.getElementById('admin');
    if(user?.role!=='ADMIN' && adminSection){adminSection.classList.remove('active');adminSection.style.display='none';}
    if(user?.role==='ADMIN' && adminSection){adminSection.style.display='';}
  }
  async function loadAdminUsers(){
    if(currentServerUser?.role!=='ADMIN') return;
    const tbody=document.querySelector('#adminUsersTable tbody'); if(!tbody)return;
    try{const data=await apiFetch('/api/admin/users');tbody.innerHTML='';data.users.forEach(u=>{const tr=document.createElement('tr');const role=u.role==='ADMIN'?'ADMIN':'USER';const status=u.status==='active'?'ATIVO':'SUSPENSO';tr.innerHTML=`<td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><strong>${role}</strong></td><td>${status}</td><td>${u.last_login_at?new Date(u.last_login_at).toLocaleString('pt-BR'):'Nunca'}</td><td><button class="admin-action" data-action="role" data-id="${u.id}" data-role="${role==='ADMIN'?'USER':'ADMIN'}">${role==='ADMIN'?'Tornar USER':'Tornar ADMIN'}</button><button class="admin-action" data-action="status" data-id="${u.id}" data-status="${status==='ATIVO'?'blocked':'active'}">${status==='ATIVO'?'Suspender':'Reativar'}</button></td>`;tbody.appendChild(tr)});}catch(e){showToast(e.status===403?'Acesso administrativo negado.':'Não foi possível carregar os usuários.')}
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  document.addEventListener('click',async(e)=>{const b=e.target.closest('.admin-action');if(!b)return;if(b.dataset.action==='role'){if(!confirm(`Alterar a permissão deste usuário para ${b.dataset.role}?`))return;try{await apiFetch(`/api/admin/users/${encodeURIComponent(b.dataset.id)}/role`,{method:'PUT',body:JSON.stringify({role:b.dataset.role})});showToast('Permissão atualizada.');loadAdminUsers()}catch(err){showToast(err.message||'Não foi possível alterar a permissão.')}}else{if(!confirm(b.dataset.status==='blocked'?'Suspender este usuário?':'Reativar este usuário?'))return;try{await apiFetch(`/api/admin/users/${encodeURIComponent(b.dataset.id)}/status`,{method:'PUT',body:JSON.stringify({status:b.dataset.status})});showToast('Status atualizado.');loadAdminUsers()}catch(err){showToast(err.message||'Não foi possível alterar o status.')}}});
  const adminNavItem=document.getElementById('adminNavItem'); if(adminNavItem)adminNavItem.addEventListener('click',()=>setTimeout(loadAdminUsers,50));
  const addAdminBtn=document.getElementById('addAdminBtn');
  if(addAdminBtn) addAdminBtn.addEventListener('click',async()=>{
    if(currentServerUser?.role!=='ADMIN') return;
    const email=window.prompt('Digite o e-mail de um usuário existente que deverá se tornar administrador:');
    if(email===null)return;
    const normalized=email.trim().toLowerCase();
    if(!normalized)return showToast('Informe um e-mail.');
    if(!confirm(`Tornar ${normalized} administrador?\n\nO usuário passará a ter acesso às funções administrativas do Prisma.`))return;
    addAdminBtn.disabled=true;
    try{await apiFetch('/api/admin/admins',{method:'POST',body:JSON.stringify({email:normalized})});showToast('Administrador adicionado com sucesso.');await loadAdminUsers();}
    catch(err){showToast(err.message||'Não foi possível adicionar o administrador.');}
    finally{addAdminBtn.disabled=false;}
  });

  function applyServerState(state,user){
    firebaseApplyingState=true;
    try {
      isAuthenticated=true;
      firebaseAuthenticated=true;
      serverAuthenticated=false;
      currentLocalUser=user;
      hideWelcomeScreen();
      updateRoleUI(user);
      if(user&&typeof persistAuthenticatedUser==='function')persistAuthenticatedUser(user);
      const profile={...profileFromServerUser(user), ...(state.profile && typeof state.profile === 'object' ? state.profile : {})};
      profile.id=user.id; profile.email=user.email; profile.name=user.name || profile.name;
      profiles=[profile]; currentProfileId=user.id; currentProfile=profile;
      setToStorage(BASE_STORAGE_KEYS.currentProfileId,user.id);
      STORAGE_KEYS=getProfileStorageKeys(user.id);
      const put=(k,v)=>setJSONToStorage(k,v);
      put(STORAGE_KEYS.receitas,state.receitas||[]);
      put(STORAGE_KEYS.despesas,state.despesas||[]);
      put(STORAGE_KEYS.contas,state.contas||[]);
      put(STORAGE_KEYS.cartoes,state.cartoes||[]);
      put(STORAGE_KEYS.investimentos,state.investimentos||[]);
      put(STORAGE_KEYS.goals,state.goals||[]);
      put(STORAGE_KEYS.categories,state.categories||[]);
      put(STORAGE_KEYS.summary,state.summary||{saldoAtual:0,salarioMensal:0});
      put(STORAGE_KEYS.monthlyFlow,state.monthlyFlow||{inc:Array(12).fill(0),exp:Array(12).fill(0)});
      put(getEducationStorageKey(),state.education||{completed:[],points:0,challengeDone:false});
      put(getScopedStorageKey('prisma_trilha_progresso_v1'),state.education?.progress||{});
      put(getScopedStorageKey('prisma_category_budgets_v1'),state.settings?.categoryBudgets||{});
      put(getScopedStorageKey('prisma_alerts_meta_v1'),state.settings?.alertsMeta||{});
      put(getScopedStorageKey('prisma_transferencias'),state.settings?.transfers||[]);
      try{localStorage.setItem('prisma_notifications_v2',JSON.stringify({notifications:state.notifications||[]}))}catch(_){}
      window.__currentAiAnalysis=state.prismaAi?.analysis||null;
      window.__currentAiRecommendations=Array.isArray(state.prismaAi?.recommendations)?state.prismaAi.recommendations:[];
      window.__currentAiHealthScore=state.prismaAi?.healthScore||getJSONFromStorage(getAiHealthScoreStorageKey(),null);
      if(window.__currentAiHealthScore){setJSONToStorage(getAiHealthScoreStorageKey(),window.__currentAiHealthScore);}
      renderSavedFinancialHealthScore(window.__currentAiHealthScore);
      if(state.prismaAi&&state.prismaAi.savingsPlan) {
        put(getScopedStorageKey('prisma_ai_savings_plan'),state.prismaAi.savingsPlan);
      }
      loadProfileData(user.id);
      profiles=[profile]; currentProfileId=user.id; currentProfile=profile; renderProfiles(); renderCurrentProfile();
      if(typeof syncAuthenticatedUserUI==='function')syncAuthenticatedUserUI();
    } finally {
      firebaseApplyingState=false;
    }
  }
  function defaultFirebaseState() {
    return {
      profile: {}, receitas: [], despesas: [], contas: [], cartoes: [], investimentos: [],
      goals: [], categories: [], summary: { saldoAtual: 0, salarioMensal: 0 },
      monthlyFlow: { inc: Array(12).fill(0), exp: Array(12).fill(0) },
      education: { completed: [], points: 0, challengeDone: false, progress: {} },
      settings: { categoryBudgets: {}, alertsMeta: {}, transfers: [] },
      notifications: [],
      prismaAi: { analysis: null, recommendations: [], savingsPlan: [], healthScore: null, history: [] }
    };
  }

  function normalizeFirebaseState(state) {
    const defaults = defaultFirebaseState();
    if (!state || typeof state !== 'object' || Array.isArray(state)) return defaults;
    return {
      ...defaults,
      ...state,
      profile: state.profile && typeof state.profile === 'object' && !Array.isArray(state.profile) ? state.profile : defaults.profile,
      receitas: Array.isArray(state.receitas) ? state.receitas : defaults.receitas,
      despesas: Array.isArray(state.despesas) ? state.despesas : defaults.despesas,
      contas: Array.isArray(state.contas) ? state.contas : defaults.contas,
      cartoes: Array.isArray(state.cartoes) ? state.cartoes : defaults.cartoes,
      investimentos: Array.isArray(state.investimentos) ? state.investimentos : defaults.investimentos,
      goals: Array.isArray(state.goals) ? state.goals : defaults.goals,
      categories: Array.isArray(state.categories) ? state.categories : defaults.categories,
      notifications: Array.isArray(state.notifications) ? state.notifications : defaults.notifications,
      settings: state.settings && typeof state.settings === 'object' && !Array.isArray(state.settings) ? state.settings : defaults.settings,
      summary: state.summary && typeof state.summary === 'object' ? state.summary : defaults.summary,
      monthlyFlow: state.monthlyFlow && typeof state.monthlyFlow === 'object' ? state.monthlyFlow : defaults.monthlyFlow,
      education: state.education && typeof state.education === 'object' ? state.education : defaults.education,
      prismaAi: state.prismaAi && typeof state.prismaAi === 'object' ? state.prismaAi : defaults.prismaAi
    };
  }

  async function activateFirebaseSession(firebaseUser, firebase) {
    if (firebaseAuthenticated && currentLocalUser?.id === firebaseUser.uid) return;
    if (firebaseActivationPromise) return firebaseActivationPromise;

    firebaseActivationPromise = (async () => {
      const email = String(firebaseUser.email || '').trim().toLowerCase();
      const localProfiles = getJSONFromStorage(BASE_STORAGE_KEYS.profiles, []);
      let legacyProfile = Array.isArray(localProfiles)
        ? localProfiles.find((profile) => normalizeAuthEmail(profile.email) === email)
        : null;
      let legacyUser = null;
      if (!legacyProfile) {
        try {
          legacyUser = await getLocalUserByEmail(email);
          if (legacyUser?.profileId) {
            legacyProfile = { id: legacyUser.profileId, email: legacyUser.email, name: legacyUser.name };
          }
        } catch (error) {
          console.warn('O armazenamento local legado não está disponível para migração:', error);
        }
      }

      const account = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email,
        name: firebaseUser.displayName || legacyProfile?.name || email,
        photoURL: firebaseUser.photoURL || null,
        createdAt: firebaseUser.metadata?.creationTime || new Date().toISOString()
      };
      const remote = await firebase.loadUserData(firebaseUser.uid);
      let state;

      if (remote.state) {
        state = normalizeFirebaseState(remote.state);
      } else {
        state = defaultFirebaseState();
        if (legacyProfile?.id) {
          const shouldMigrate = window.confirm(
            `Encontramos dados locais associados a ${email}. Deseja copiá-los para esta conta Firebase? Os dados locais originais serão preservados.`
          );
          if (shouldMigrate) {
            loadProfileData(legacyProfile.id);
            state = collectServerState();
          }
        }
      }

      firebaseConsent = remote.consent || null;
      applyServerState(state, account);
      if (!remote.profile) await firebase.saveProfile(firebaseUser, { created: true });
      if (!remote.state) {
        firebaseRevision = await firebase.saveState(firebaseUser.uid, state, remote.revision);
      } else {
        firebaseRevision = remote.revision;
      }

      if (firebaseUnsubscribe) firebaseUnsubscribe();
      firebaseUnsubscribe = firebase.watchState(firebaseUser.uid, (incomingState, revision) => {
        if (!incomingState || !revision || revision === firebaseRevision) return;
        if (serverSyncPending || serverSyncInFlight) {
          showToast('Há alterações locais e remotas ao mesmo tempo. Recarregue a página para resolver o conflito sem sobrescrever dados.', 'warning');
          return;
        }
        firebaseRevision = revision;
        applyServerState(normalizeFirebaseState(incomingState), account);
      }, (error) => {
        console.error('Falha ao acompanhar a sincronização Firestore:', error);
        showToast('A sincronização em tempo real foi interrompida. Verifique a conexão.');
      });

      hideLoginModal();
      hideRegistrationModal();
      const appElement = document.getElementById('mainApp') || document.querySelector('.app');
      if (appElement) appElement.style.display = 'block';
      hideWelcomeScreen();
      if (!firebaseConsent) showLgpdScreen(account);
      else if (!restoreSectionFromLocation()) window.navigateToSection?.('dashboard', { updateHistory: false });

      if ((await firebase.getPersistenceMode()) === 'session') {
        showToast('O navegador bloqueou a sessão persistente. Sua conta ficará conectada somente nesta sessão.', 'warning');
      }
      serverSyncPending = false;
      showToast(`Bem-vindo ao Prisma, ${account.name}.`);
    })();

    try {
      await firebaseActivationPromise;
    } finally {
      firebaseActivationPromise = null;
    }
  }

  async function syncServerStateNow() {
    if (!firebaseAuthenticated || !currentProfileId) return false;
    if (serverSyncInFlight) {
      serverSyncPending = true;
      return false;
    }
    serverSyncInFlight = true;
    serverSyncPending = false;
    try {
      const firebase = await getFirebaseClient();
      firebaseRevision = await firebase.saveState(currentLocalUser.id, collectServerState(), firebaseRevision);
      return true;
    } catch (error) {
      console.error('Falha ao sincronizar o estado do Prisma com Firestore:', error);
      if (typeof showToast === 'function') showToast(authErrorMessage(error), 'warning');
      return false;
    } finally {
      serverSyncInFlight = false;
      if (serverSyncPending) scheduleServerSync();
    }
  }

  function scheduleServerSync() {
    if (!firebaseAuthenticated) return;
    serverSyncPending = true;
    clearTimeout(serverSyncTimer);
    serverSyncTimer = setTimeout(() => { void syncServerStateNow(); }, 700);
  }

  const firebaseSyncedStorageKeys = [
    'prisma_profile_data', 'prisma_receitas_data', 'prisma_despesas_data',
    'prisma_contas_data', 'prisma_cartoes_data', 'prisma_investimentos_data',
    'prisma_goals_data', 'prisma_summary_data', 'prisma_monthly_flow_data',
    'prisma_categories_data', 'prisma_education_data', 'prisma_trilha_progresso_v1',
    'prisma_category_budgets_v1', 'prisma_alerts_meta_v1', 'prisma_transferencias',
    'prisma_ai_savings_plan', 'prisma_ai_health_score', 'prisma_notifications_v2',
    'prisma_recomendacoes_aplicadas'
  ];
  window.addEventListener('prisma-storage-changed', (event) => {
    const key = event.detail?.key;
    if (!firebaseAuthenticated || firebaseApplyingState || typeof key !== 'string') return;
    if (firebaseSyncedStorageKeys.some((baseKey) => key === baseKey || key.startsWith(`${baseKey}_`))) {
      scheduleServerSync();
    }
  });
  window.PrismaScheduleServerSync = scheduleServerSync;

  // Limpar localStorage completamente para permitir que o usuário insira seus próprios dados
  function limparTodosDados() {
    // Limpar dados do perfil atual
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Limpar dados globais
    localStorage.removeItem(getScopedStorageKey('prisma_recomendacoes_aplicadas'));
    
    // Recarregar dados vazios
    receitas = [];
    despesas = [];
    contas = [];
    cartoes = [];
    investimentos = [];
    goals = [];
    incomeData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expenseData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    categories = [];
    saldoAtual = 0;
    salarioMensal = 0;
    receitasMes = 0;
    despesasMes = 0;
    economiaMes = 0;
    
    // Atualizar interface
    scheduleServerSync();
    recalculateAll();
    showToast('Todos os dados foram limpos com sucesso.');
  }

  // Adicionar event listener para o botão de limpar dados
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
        limparTodosDados();
      }
    });
  }

  // ==================== LGPD SETTINGS CARD ====================
  async function loadLgpdSettings() {
    try {
      const data = firebaseAuthenticated
        ? { hasConsent: Boolean(firebaseConsent), consent: firebaseConsent }
        : currentLocalUser
        ? (() => {
            const consent = readLocalConsent(currentLocalUser.id);
            return { hasConsent: Boolean(consent), consent };
          })()
        : await apiFetch('/api/lgpd/consent');
      const lgpdStatusBadge = document.getElementById('lgpdStatusBadge');
      const lgpdComm = document.getElementById('lgpdSettingsCommunications');
      const lgpdAnal = document.getElementById('lgpdSettingsAnalytics');
      const lgpdOF = document.getElementById('lgpdSettingsOpenFinance');

      if (lgpdStatusBadge) {
        if (data.hasConsent) {
          lgpdStatusBadge.textContent = 'Registrado';
          lgpdStatusBadge.className = 'status success';
        } else {
          lgpdStatusBadge.textContent = 'Pendente';
          lgpdStatusBadge.className = 'status warning';
        }
      }

      if (data.consent) {
        if (lgpdComm) lgpdComm.checked = Boolean(data.consent.communicationsConsent);
        if (lgpdAnal) lgpdAnal.checked = Boolean(data.consent.analyticsConsent);
        if (lgpdOF) lgpdOF.checked = Boolean(data.consent.openFinanceConsent);
      }
    } catch (error) {
      console.error('Não foi possível carregar as preferências de privacidade:', error);
      showToast('Não foi possível carregar as preferências de privacidade.');
    }
  }

  // Auto-load when navigating to configurações (hooked into navigateToSection above)

  const lgpdSaveSettingsBtn = document.getElementById('lgpdSaveSettingsBtn');
  if (lgpdSaveSettingsBtn) {
    lgpdSaveSettingsBtn.addEventListener('click', async () => {
      const communications = document.getElementById('lgpdSettingsCommunications')?.checked ?? true;
      const analytics = document.getElementById('lgpdSettingsAnalytics')?.checked ?? true;
      const openFinance = document.getElementById('lgpdSettingsOpenFinance')?.checked ?? false;

      lgpdSaveSettingsBtn.disabled = true;
      try {
        const preferences = {
          communicationsConsent: communications,
          analyticsConsent: analytics,
          openFinanceConsent: openFinance
        };
        if (firebaseAuthenticated && currentLocalUser) {
          const consent = {
            essentialAccepted: true,
            ...preferences,
            updatedAt: new Date().toISOString()
          };
          const firebase = await getFirebaseClient();
          await firebase.saveConsent(currentLocalUser.id, consent);
          firebaseConsent = consent;
        } else if (currentLocalUser) {
          saveLocalConsent(currentLocalUser.id, preferences);
        } else {
          await apiFetch('/api/lgpd/consent', {
            method: 'POST',
            body: JSON.stringify({ essentialAccepted: true, ...preferences })
          });
        }
        showToast('Preferências de privacidade atualizadas.');
        await loadLgpdSettings();
      } catch (error) {
        showToast('Não foi possível atualizar as preferências. Tente novamente.');
      } finally {
        lgpdSaveSettingsBtn.disabled = false;
      }
    });
  }

  const lgpdViewHistoryBtn = document.getElementById('lgpdViewHistoryBtn');
  if (lgpdViewHistoryBtn) {
    lgpdViewHistoryBtn.addEventListener('click', async () => {
      try {
        const data = firebaseAuthenticated
          ? { history: firebaseConsent ? [firebaseConsent] : [] }
          : currentLocalUser
          ? { history: readLocalConsent(currentLocalUser.id) ? [readLocalConsent(currentLocalUser.id)] : [] }
          : await apiFetch('/api/lgpd/history');
        if (!data.history || data.history.length === 0) {
          showToast('Nenhum histórico de consentimento encontrado.');
          return;
        }
        const lines = data.history.map(h => {
          const d = new Date(h.createdAt || h.updatedAt).toLocaleString('pt-BR');
          return `${d} — Comunicações: ${h.communicationsConsent ? 'Sim' : 'Não'}, IA: ${h.analyticsConsent ? 'Sim' : 'Não'}, Open Finance: ${h.openFinanceConsent ? 'Sim' : 'Não'}`;
        }).join('\n');
        alert(`Histórico de consentimentos LGPD:\n\n${lines}`);
      } catch (error) {
        showToast('Não foi possível carregar o histórico.');
      }
    });
  }

  function getLast12Months(){
    const now=new Date(); const labels=[]; const keys=[];
    for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); labels.push(monthNames[d.getMonth()]); }
    return {labels,keys};
  }
  function getTransactionMonthKey(value){
    if(!value) return null; const d=new Date(String(value).includes('T')?value:`${value}T00:00:00`); if(Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function rebuildCashflowFromTransactions(){
    const {keys}=getLast12Months(); const inc=Array(12).fill(0), exp=Array(12).fill(0); const index=new Map(keys.map((k,i)=>[k,i]));
    receitas.forEach(r=>{const i=index.get(getTransactionMonthKey(r.data)); if(i!==undefined) inc[i]+=Number(r.valor)||0;});
    despesas.forEach(d=>{const i=index.get(getTransactionMonthKey(d.data)); if(i!==undefined) exp[i]+=Number(d.valor)||0;});
    const hasTransactions=receitas.some(r=>getTransactionMonthKey(r.data)) || despesas.some(d=>getTransactionMonthKey(d.data));
    if(hasTransactions){ incomeData=inc; expenseData=exp; saveDataStorage(STORAGE_KEYS.monthlyFlow,{inc,exp}); }
    return {inc:incomeData,exp:expenseData,hasTransactions};
  }
  months = getLast12Months().labels;  // Update global months variable

  // Inicializar renderização ao carregar
  setTimeout(() => {
    try {
      if (typeof renderReceitas === 'function') renderReceitas();
      if (typeof renderDespesas === 'function') renderDespesas();
      if (typeof renderContas === 'function') renderContas();
      if (typeof renderCartoes === 'function') renderCartoes();
      if (typeof renderInvestimentos === 'function') renderInvestimentos();
      if (typeof renderGoals === 'function') renderGoals();
      if (typeof renderDashboardTransactions === 'function') renderDashboardTransactions();
      if (typeof updateDashboardCards === 'function') updateDashboardCards();
    } catch (error) {
      console.error('Erro ao inicializar renderização:', error);
    }
  }, 100);

  function fmtMoney(v) {
    const val = Number(v) || 0;
    return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDateBR(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return dateValue || '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // ==================== RENDERING FUNCTIONS ====================

  // Render Receitas
  const receitasBody = document.getElementById('receitasBody');

  function renderEmptyRow(colspan, message, icon) {
    return `<tr class="empty-row"><td colspan="${colspan}"><div class="section-empty"><i data-lucide="${icon || 'inbox'}"></i><p>${message}</p></div></td></tr>`;
  }
  function renderEmptyCards(container, message, icon) {
    if (!container) return;
    container.innerHTML = `<div class="section-empty cards-empty"><i data-lucide="${icon || 'inbox'}"></i><p>${message}</p></div>`;
  }

  function renderReceitas() {
    if (!receitasBody) return;
    receitasBody.innerHTML = '';
    if (!receitas.length) {
      receitasBody.innerHTML = renderEmptyRow(7, 'Nenhuma receita cadastrada. Clique em "Nova Receita" para começar.', 'trending-up');
      refreshIcons();
      return;
    }
    receitas.forEach((receita, index) => {
      const tr = document.createElement('tr');
      const statusLabel = receita.status === 'paid' ? 'Recebido' : 'Pendente';
      tr.innerHTML = `
        <td><span class="cat-badge investment">${escapeHtml(receita.origem || '')}</span></td>
        <td>${escapeHtml(receita.descricao || '')}</td>
        <td>${escapeHtml(receita.conta || '')}</td>
        <td class="positive">+ ${fmtMoney(receita.valor)}</td>
        <td>${fmtDateBR(receita.data)}</td>
        <td><span class="status ${escapeHtml(receita.status || '')}">${statusLabel}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn edit" data-action="edit-receita" data-index="${index}" title="Editar receita"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="delete-receita" data-index="${index}" title="Excluir receita"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      receitasBody.appendChild(tr);
    });
    refreshIcons();
  }

  // Render Despesas
  const despesasBody = document.getElementById('despesasBody');
  function renderDespesas() {
    if (!despesasBody) return;
    despesasBody.innerHTML = '';
    if (!despesas.length) {
      despesasBody.innerHTML = renderEmptyRow(7, 'Nenhuma despesa cadastrada. Clique em "Nova Despesa" para começar.', 'trending-down');
      refreshIcons();
      return;
    }
    despesas.forEach((despesa, index) => {
      const tr = document.createElement('tr');
      const statusLabel = despesa.status === 'paid' ? 'Pago' : 'Pendente';
      
      // Define a cor e ícone baseado na prioridade
      const prioridadeConfig = {
        'baixa': { class: 'prioridade-baixa', label: 'Baixa', icon: 'arrow-down' },
        'media': { class: 'prioridade-media', label: 'Média', icon: 'minus' },
        'alta': { class: 'prioridade-alta', label: 'Alta', icon: 'arrow-up' },
        'urgente': { class: 'prioridade-urgente', label: 'Urgente', icon: 'alert-triangle' }
      };
      const prioridade = prioridadeConfig[despesa.prioridade] || prioridadeConfig['media'];
      
      tr.innerHTML = `
        <td><span class="cat-badge food">${escapeHtml(despesa.categoria || '')}</span></td>
        <td>${escapeHtml(despesa.descricao || '')}</td>
        <td>${escapeHtml(despesa.conta || '')}</td>
        <td class="negative">- ${fmtMoney(despesa.valor)}</td>
        <td>${fmtDateBR(despesa.data)}</td>
        <td><span class="status ${despesa.status}">${statusLabel}</span></td>
        <td>
          <div class="table-actions">
            <span class="prioridade-badge ${prioridade.class}"><i data-lucide="${prioridade.icon}"></i> ${prioridade.label}</span>
            <button class="table-action-btn edit" data-action="edit-despesa" data-index="${index}" title="Editar despesa"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="delete-despesa" data-index="${index}" title="Excluir despesa"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      despesasBody.appendChild(tr);
    });
    refreshIcons();
  }

  // Render Contas
  const contasGrid = document.getElementById('contasGrid');
  function renderContas() {
    if (!contasGrid) return;
    contasGrid.innerHTML = '';
    updateBankSyncStatusBar();
    if (!contas.length) {
      renderEmptyCards(contasGrid, 'Nenhuma conta bancária. Use "Nova Conta" ou "Conectar banco" (sandbox).', 'landmark');
      refreshIcons();
      return;
    }
    contas.forEach((conta, index) => {
      const card = document.createElement('div');
      const connected = conta.source === 'openfinance' && conta.syncStatus === 'connected';
      card.className = 'card account-card fade-in' + (connected ? ' account-connected' : '');
      const badge = connected
        ? `<span class="of-badge" title="Open Finance — Sandbox (dados simulados)">OF · Sandbox</span>`
        : '';
      const syncLine = connected
        ? `<p class="account-sync text-muted">Sync: ${escapeHtml((conta.lastSyncAt || '').slice(0, 16).replace('T', ' ') || '—')}</p>`
        : '';
      const syncBtn = connected
        ? `<button class="table-action-btn" data-action="sync-conta" data-index="${index}" title="Sincronizar (mock)"><i data-lucide="refresh-cw"></i></button>
           <button class="table-action-btn" data-action="disconnect-conta" data-index="${index}" title="Desconectar"><i data-lucide="unlink"></i></button>`
        : '';
      card.innerHTML = `
        <div class="account-top">
          <span class="bank-badge ${conta.tipo || 'default'}">${(conta.nome || 'C').charAt(0).toUpperCase()}</span>
          ${badge}
          <div class="card-actions">
            ${syncBtn}
            <button class="table-action-btn edit" data-action="edit-conta" data-index="${index}" title="Editar conta"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="delete-conta" data-index="${index}" title="Excluir conta"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <p class="account-name">${escapeHtml(conta.nome || '')}</p>
        <h3>${fmtMoney(conta.saldo)}</h3>
        <p class="account-num">•••• ${escapeHtml(String(conta.numero || ''))}${conta.banco ? ' · ' + escapeHtml(conta.banco) : ''}</p>
        ${syncLine}
      `;
      contasGrid.appendChild(card);
    });
    refreshIcons();
  }

  function updateBankSyncStatusBar() {
    const countEl = document.getElementById('bankConnectedCount');
    const lastEl = document.getElementById('bankLastSync');
    const isConn = (c) => {
      try {
        if (typeof PrismaBankSync !== 'undefined' && PrismaBankSync.service && PrismaBankSync.service.isConnected) {
          return PrismaBankSync.service.isConnected(c);
        }
      } catch (_) {}
      return !!(c && c.source === 'openfinance' && c.syncStatus === 'connected');
    };
    const connected = (contas || []).filter(isConn);
    if (countEl) countEl.textContent = String(connected.length);
    if (lastEl) {
      let latest = null;
      connected.forEach((c) => {
        if (c.lastSyncAt && (!latest || c.lastSyncAt > latest)) latest = c.lastSyncAt;
      });
      lastEl.textContent = latest ? latest.slice(0, 16).replace('T', ' ') : '—';
    }
  }

  // Render Cartões
  const cartoesGrid = document.getElementById('cartoesGrid');
  function renderCartoes() {
    if (!cartoesGrid) return;
    cartoesGrid.innerHTML = '';
    if (!cartoes.length) {
      renderEmptyCards(cartoesGrid, 'Nenhum cartão cadastrado. Clique em "Novo Cartão" para adicionar.', 'credit-card');
      refreshIcons();
      return;
    }
    cartoes.forEach((cartao, index) => {
      const card = document.createElement('div');
      const estilo = cartao.estilo || 'default';
      const estiloClass = estilo !== 'default' ? estilo : '';
      const banco = cartao.banco || 'nubank';
      card.className = `card credit-card ${estiloClass}`;
      card.setAttribute('data-banco', banco);
      
      // Define o nome do plano baseado no estilo
      const planos = {
        'default': 'Standard',
        'alt': 'Blue',
        'black': 'Black',
        'platinum': 'Platinum',
        'rose': 'Rose',
        'titanium': 'Titanium'
      };
      const planoNome = planos[estilo] || 'Standard';
      
      // Define o nome do banco
      const bancos = {
        'nubank': 'Nubank',
        'itau': 'Itaú',
        'bradesco': 'Bradesco',
        'santander': 'Santander',
        'bb': 'Banco do Brasil',
        'caixa': 'Caixa',
        'inter': 'Inter',
        'pagbank': 'PagBank',
        'pan': 'Banco Pan',
        'c6': 'C6 Bank',
        'original': 'Banco Original',
        'sicoob': 'Sicoob',
        'sicredi': 'Sicredi',
        'american_express': 'American Express',
        'visa': 'Visa',
        'mastercard': 'Mastercard',
        'discover': 'Discover',
        'hsbc': 'HSBC',
        'citibank': 'Citibank'
      };
      const bancoNome = bancos[banco] || 'Banco';

      // FIX P1.5: Calculate credit card invoice and available limit
      const limiteTotal = parseFloat(cartao.limiteTotal) || 0;
      const nomeCartao = String(cartao.numero || '');
      const faturaAtual = (despesas || []).reduce((sum, d) => {
        // Match expenses linked to this card by numero or by conta field containing the card number
        const contaStr = String(d.conta || '').toLowerCase();
        const numStr = nomeCartao.toLowerCase();
        const isCartaoDesp = d.formaPagamento === 'cartao' ||
          (numStr && (contaStr.includes(numStr) || contaStr.includes('cartão') || contaStr.includes('cartao')));
        return sum + (isCartaoDesp ? (parseFloat(d.valor) || 0) : 0);
      }, 0);
      const limiteDisponivel = limiteTotal > 0 ? Math.max(0, limiteTotal - faturaAtual) : null;
      const utilizacaoPct = limiteTotal > 0 ? Math.min(100, Math.round((faturaAtual / limiteTotal) * 100)) : null;
      const utilizacaoClass = utilizacaoPct !== null ? (utilizacaoPct > 80 ? 'danger' : utilizacaoPct > 50 ? 'warning' : 'safe') : '';

      const limiteHtml = limiteTotal > 0 ? `
        <div class="cc-limit-info">
          <div class="cc-limit-row">
            <span class="cc-limit-label">Fatura atual</span>
            <span class="cc-limit-value negative">${fmtMoney(faturaAtual)}</span>
          </div>
          <div class="cc-limit-row">
            <span class="cc-limit-label">Limite disponível</span>
            <span class="cc-limit-value positive">${fmtMoney(limiteDisponivel)}</span>
          </div>
          <div class="cc-usage-bar">
            <div class="cc-usage-fill ${utilizacaoClass}" style="width:${utilizacaoPct}%"></div>
          </div>
          <div class="cc-usage-label">${utilizacaoPct}% utilizado de ${fmtMoney(limiteTotal)}</div>
        </div>` : '';
      
      card.innerHTML = `
        <div class="cc-top">
          <span class="cc-chip"></span>
          <span class="cc-brand">${bancoNome} ${planoNome}</span>
          <div class="card-actions">
            <button class="table-action-btn edit" data-action="edit-cartao" data-index="${index}" title="Editar cartão"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="delete-cartao" data-index="${index}" title="Excluir cartão"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="cc-number">•••• •••• •••• ${escapeHtml(String(cartao.numero || ''))}</div>
        <div class="cc-bottom"><span>${escapeHtml(cartao.titular || '')}</span><span>${escapeHtml(cartao.validade || '')}</span></div>
        ${cartao.diaVencimento ? `<div class="cc-due">Fatura vence dia ${escapeHtml(String(cartao.diaVencimento))}</div>` : ''}
        ${limiteHtml}
      `;
      cartoesGrid.appendChild(card);
    });
    refreshIcons();
  }

  // Render Investimentos — Carteira de Investimentos completa
  const investimentosBody = document.getElementById('investimentosBody');
  let portfolioEvolutionChart = null;
  let portfolioLucroChart = null;
  let carteiraFilter = 'todos';
  let carteiraSort = 'valor-desc';
  let carteiraSearchQuery = '';

  const TIPO_LABELS = {
    'renda-fixa': 'Renda fixa', tesouro: 'Tesouro Direto', cdb: 'CDB', 'lci-lca': 'LCI/LCA',
    acoes: 'Ações', fiis: 'FIIs', etfs: 'ETFs', fundos: 'Fundos',
    criptomoedas: 'Criptomoedas', previdencia: 'Previdência', outros: 'Outros'
  };
  const TIPO_FILTER_MAP = {
    'renda-fixa': ['renda-fixa', 'tesouro', 'cdb', 'lci-lca'],
    acoes: ['acoes'], fiis: ['fiis', 'fii'], etfs: ['etfs'],
    fundos: ['fundos'], criptomoedas: ['criptomoedas', 'cripto'],
    outros: ['outros', 'previdencia']
  };
  const PORTFOLIO_FALLBACK_COLORS = ['#0066FF', '#22C55E', '#F2A900', '#FF5470', '#A78BFA', '#00C8FF', '#64748B', '#EC4899'];

  function normalizeInvestimento(inv) {
    if (!inv || typeof inv !== 'object') return inv;
    const valorAplicado = Number(inv.valorInvestido != null ? inv.valorInvestido : (inv.valor != null ? inv.valor : 0)) || 0;
    let valorAtual = inv.valorAtual != null ? Number(inv.valorAtual) : (inv.valorTotal != null ? Number(inv.valorTotal) : null);
    let lucro = inv.lucro != null ? Number(inv.lucro) : null;
    if (valorAtual == null && lucro != null) valorAtual = valorAplicado + lucro;
    if (valorAtual == null) valorAtual = valorAplicado;
    if (lucro == null) lucro = valorAtual - valorAplicado;
    const rent = valorAplicado > 0 ? ((valorAtual - valorAplicado) / valorAplicado) * 100 : 0;
    let tipo = inv.tipo || 'outros';
    if (typeof tipo === 'string') {
      const t = tipo.toLowerCase().trim();
      if (t.includes('tesouro')) tipo = 'tesouro';
      else if (t.includes('cdb')) tipo = 'cdb';
      else if (t.includes('lci') || t.includes('lca')) tipo = 'lci-lca';
      else if (t.includes('aç') || t.includes('acoes') || t === 'acao') tipo = 'acoes';
      else if (t.includes('fii')) tipo = 'fiis';
      else if (t.includes('etf')) tipo = 'etfs';
      else if (t.includes('fundo')) tipo = 'fundos';
      else if (t.includes('cripto') || t.includes('bitcoin') || t.includes('btc')) tipo = 'criptomoedas';
      else if (t.includes('previd')) tipo = 'previdencia';
      else if (t.includes('renda fixa') || t.includes('renda-fixa')) tipo = 'renda-fixa';
      else if (!TIPO_LABELS[tipo]) tipo = 'outros';
    }
    return {
      ...inv,
      nome: inv.nome || inv.tipo || 'Investimento',
      tipo,
      instituicao: inv.instituicao || inv.corretora || '',
      valorAplicado,
      valorInvestido: valorAplicado,
      valor: valorAplicado,
      valorAtual,
      valorTotal: valorAtual,
      quantidade: inv.quantidade != null ? Number(inv.quantidade) : null,
      precoMedio: inv.precoMedio != null ? Number(inv.precoMedio) : (inv.quantidade > 0 ? valorAplicado / inv.quantidade : null),
      lucro,
      rentabilidade: rent,
      rent: rent,
      dataAplicacao: inv.dataAplicacao || inv.data || '',
      dataVencimento: inv.dataVencimento || inv.vencimento || '',
      status: inv.status || 'ativo',
      historico: Array.isArray(inv.historico) ? inv.historico : [],
      observacoes: inv.observacoes || '',
      icon: inv.icon || 'trending-up'
    };
  }

  function getInvestValorAplicado(inv) {
    return Number(inv.valorAplicado != null ? inv.valorAplicado : (inv.valorInvestido != null ? inv.valorInvestido : inv.valor)) || 0;
  }
  function getInvestValorAtual(inv) {
    if (inv.valorAtual != null) return Number(inv.valorAtual) || 0;
    if (inv.valorTotal != null) return Number(inv.valorTotal) || 0;
    return getInvestValorAplicado(inv) + (Number(inv.lucro) || 0);
  }
  function getInvestLucro(inv) {
    return getInvestValorAtual(inv) - getInvestValorAplicado(inv);
  }
  function getInvestRent(inv) {
    const aplicado = getInvestValorAplicado(inv);
    if (aplicado <= 0) return 0;
    return ((getInvestValorAtual(inv) - aplicado) / aplicado) * 100;
  }

  /** Chave de consolidação: mesmo ticker/nome+tipo = mesmo ativo */
  function getAssetConsolidateKey(inv) {
    const ticker = String(inv.ticker || inv.simbolo || '').trim().toUpperCase();
    const nome = String(inv.nome || '').trim().toLowerCase();
    const tipo = String(inv.tipo || 'outros').toLowerCase();
    if (ticker) return tipo + '|' + ticker;
    return tipo + '|' + nome;
  }

  /**
   * Consolida múltiplos aportes do mesmo ativo em uma linha de carteira.
   * Preserva _indices originais para abrir detalhe do primeiro registro.
   */
  function consolidateInvestimentosForDisplay(rawList) {
    const map = new Map();
    (rawList || []).forEach((inv) => {
      if (!inv || inv.status === 'resgatado') return;
      const key = getAssetConsolidateKey(inv);
      const aplicado = getInvestValorAplicado(inv);
      const atual = getInvestValorAtual(inv);
      const qtd = Number(inv.quantidade);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...inv,
          valorAplicado: aplicado,
          valorAtual: atual,
          valorInvestido: aplicado,
          valorTotal: atual,
          quantidade: Number.isFinite(qtd) ? qtd : null,
          _indices: [inv._index],
          _aporteCount: 1
        });
        return;
      }
      existing.valorAplicado += aplicado;
      existing.valorAtual += atual;
      existing.valorInvestido = existing.valorAplicado;
      existing.valorTotal = existing.valorAtual;
      if (Number.isFinite(qtd)) {
        existing.quantidade = (Number(existing.quantidade) || 0) + qtd;
      }
      if (existing.quantidade && existing.quantidade > 0 && existing.valorAplicado > 0) {
        existing.precoMedio = existing.valorAplicado / existing.quantidade;
      }
      existing.lucro = existing.valorAtual - existing.valorAplicado;
      existing._indices.push(inv._index);
      existing._aporteCount += 1;
      // data: mantém a mais antiga
      if (inv.dataAplicacao && (!existing.dataAplicacao || inv.dataAplicacao < existing.dataAplicacao)) {
        existing.dataAplicacao = inv.dataAplicacao;
      }
    });
    return Array.from(map.values()).map((row) => {
      row.lucro = (Number(row.valorAtual) || 0) - (Number(row.valorAplicado) || 0);
      const ap = Number(row.valorAplicado) || 0;
      row.rentabilidade = ap > 0 ? (row.lucro / ap) * 100 : 0;
      row.rent = row.rentabilidade;
      return row;
    });
  }

  function getFilteredSortedInvestimentos() {
    let list = (Array.isArray(investimentos) ? investimentos : []).map((inv, index) => ({ ...normalizeInvestimento(inv), _index: index }));
    if (carteiraFilter && carteiraFilter !== 'todos') {
      const allowed = TIPO_FILTER_MAP[carteiraFilter] || [carteiraFilter];
      list = list.filter((inv) => {
        const t = String(inv.tipo || '').toLowerCase();
        return allowed.some((a) => t === a || t.includes(a));
      });
    }
    if (carteiraSearchQuery) {
      const q = carteiraSearchQuery.toLowerCase();
      list = list.filter((inv) =>
        String(inv.nome || '').toLowerCase().includes(q) ||
        String(inv.instituicao || '').toLowerCase().includes(q) ||
        String(TIPO_LABELS[inv.tipo] || inv.tipo || '').toLowerCase().includes(q)
      );
    }
    // Consolida aportes do mesmo ativo (ticker/nome+tipo) antes de ordenar
    list = consolidateInvestimentosForDisplay(list);
    list.sort((a, b) => {
      switch (carteiraSort) {
        case 'valor-desc': return getInvestValorAtual(b) - getInvestValorAtual(a);
        case 'rent-desc': return getInvestRent(b) - getInvestRent(a);
        case 'lucro-desc': return getInvestLucro(b) - getInvestLucro(a);
        case 'data-desc': return String(b.dataAplicacao || '').localeCompare(String(a.dataAplicacao || ''));
        case 'data-asc': return String(a.dataAplicacao || '').localeCompare(String(b.dataAplicacao || ''));
        case 'nome-asc': return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        default: return 0;
      }
    });
    return list;
  }

  function formatDateBR(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR');
    } catch (_) { return iso; }
  }


  let portfolioProjecaoChart = null;
  let carteiraDivMode = 'tipo';
  let carteiraEvolPeriod = '90d';
  let carteiraHistFilter = 'todos';

  function getCarteiraTotals() {
    const list = (Array.isArray(investimentos) ? investimentos : []).map(normalizeInvestimento);
    let totalInvestido = 0, totalAtual = 0, totalLucro = 0, qtd = 0;
    list.forEach((inv) => {
      if (inv.status === 'resgatado') return;
      totalInvestido += getInvestValorAplicado(inv);
      totalAtual += getInvestValorAtual(inv);
      totalLucro += getInvestLucro(inv);
      qtd++;
    });
    const rent = totalInvestido > 0 ? ((totalAtual - totalInvestido) / totalInvestido) * 100 : 0;
    return { list, totalInvestido, totalAtual, totalLucro, rent, qtd };
  }

  function analyzeCarteiraRisk(list) {
    const active = list.filter((i) => i.status !== 'resgatado');
    if (!active.length) {
      return { score: 0, nivel: 'Sem dados', color: '#64748B', factors: [{ title: 'Carteira vazia', desc: 'Cadastre investimentos para avaliar o risco da composição.', pct: 0, color: '#64748B' }] };
    }
    const total = active.reduce((s, i) => s + getInvestValorAtual(i), 0) || 1;
    const byTipo = {};
    const byInst = {};
    active.forEach((i) => {
      byTipo[i.tipo] = (byTipo[i.tipo] || 0) + getInvestValorAtual(i);
      const inst = i.instituicao || 'Não informada';
      byInst[inst] = (byInst[inst] || 0) + getInvestValorAtual(i);
    });
    const tipoShares = Object.values(byTipo).map((v) => v / total);
    const maxTipo = Math.max(...tipoShares, 0);
    const maxInst = Math.max(...Object.values(byInst).map((v) => v / total), 0);
    const maxAtivo = Math.max(...active.map((i) => getInvestValorAtual(i) / total), 0);
    const nClasses = Object.keys(byTipo).length;
    const highVolTypes = ['acoes', 'criptomoedas', 'etfs'];
    const volExposure = active.filter((i) => highVolTypes.includes(i.tipo)).reduce((s, i) => s + getInvestValorAtual(i), 0) / total;

    // Score 0-100 (higher = more risk) — informativo
    let score = 0;
    score += maxTipo * 35;
    score += maxInst * 20;
    score += maxAtivo * 20;
    score += volExposure * 25;
    if (nClasses <= 1) score += 15;
    else if (nClasses === 2) score += 8;
    score = Math.min(100, Math.round(score));

    let nivel, color;
    if (score < 25) { nivel = '🟢 Baixo'; color = '#22C55E'; }
    else if (score < 45) { nivel = '🟡 Moderado'; color = '#F2A900'; }
    else if (score < 70) { nivel = '🟠 Alto'; color = '#F97316'; }
    else { nivel = '🔴 Muito alto'; color = '#EF4444'; }

    const factors = [
      { title: 'Concentração por classe', desc: `Maior classe representa ${(maxTipo * 100).toFixed(0)}% do patrimônio.`, pct: Math.round(maxTipo * 100), color: maxTipo > 0.6 ? '#EF4444' : maxTipo > 0.4 ? '#F2A900' : '#22C55E' },
      { title: 'Concentração por instituição', desc: `Maior instituição concentra ${(maxInst * 100).toFixed(0)}%.`, pct: Math.round(maxInst * 100), color: maxInst > 0.7 ? '#EF4444' : maxInst > 0.45 ? '#F2A900' : '#22C55E' },
      { title: 'Concentração por ativo', desc: `Maior posição individual: ${(maxAtivo * 100).toFixed(0)}%.`, pct: Math.round(maxAtivo * 100), color: maxAtivo > 0.5 ? '#EF4444' : maxAtivo > 0.3 ? '#F2A900' : '#22C55E' },
      { title: 'Exposição a classes voláteis', desc: `Ações, ETFs e cripto: ${(volExposure * 100).toFixed(0)}% da carteira.`, pct: Math.round(volExposure * 100), color: volExposure > 0.5 ? '#EF4444' : volExposure > 0.25 ? '#F2A900' : '#22C55E' },
      { title: 'Diversificação', desc: `${nClasses} classe(s) de ativos na carteira.`, pct: Math.min(100, nClasses * 20), color: nClasses >= 4 ? '#22C55E' : nClasses >= 2 ? '#F2A900' : '#EF4444' }
    ];
    return { score, nivel, color, factors, maxTipo, maxInst, maxAtivo, nClasses, volExposure };
  }

  function renderRiscoPanel() {
    const { list } = getCarteiraTotals();
    const risk = analyzeCarteiraRisk(list);
    const nivelEl = document.getElementById('riscoNivel');
    const subEl = document.getElementById('riscoSub');
    const arc = document.getElementById('riscoArc');
    const factorsEl = document.getElementById('piRiscoFactors');
    if (nivelEl) {
      nivelEl.textContent = risk.nivel;
      nivelEl.style.color = risk.color;
    }
    if (subEl) subEl.textContent = list.filter((i) => i.status !== 'resgatado').length ? `Score informativo: ${risk.score}/100` : 'Sem posições ativas';
    if (arc) {
      // arc length ~ 157 for semicircle
      const len = 157;
      const filled = (risk.score / 100) * len;
      arc.setAttribute('stroke', risk.color);
      arc.setAttribute('stroke-dasharray', `${filled} ${len}`);
    }
    if (factorsEl) {
      factorsEl.innerHTML = risk.factors.map((f) => `
        <div class="risco-factor">
          <div class="rf-title">${escapeHtml(f.title)}</div>
          <div class="rf-desc">${escapeHtml(f.desc)}</div>
          <div class="rf-bar"><span style="width:${f.pct}%;background:${f.color}"></span></div>
        </div>
      `).join('');
    }
  }

  function renderMetasPanel() {
    const grid = document.getElementById('piMetasGrid');
    if (!grid) return;
    const goalsList = Array.isArray(goals) ? goals : [];
    const { totalAtual } = getCarteiraTotals();
    if (!goalsList.length) {
      grid.innerHTML = '<div class="portfolio-empty">Nenhuma meta cadastrada. Crie metas na seção Metas do Prisma.</div>';
      return;
    }
    grid.innerHTML = goalsList.map((g) => {
      const current = Number(g.current) || 0;
      const target = Number(g.target) || 1;
      const pct = Math.min(100, Math.round((current / target) * 100));
      const remaining = Math.max(0, target - current);
      const year = g.year || new Date().getFullYear();
      const monthsLeft = Math.max(1, (year - new Date().getFullYear()) * 12);
      const aporteSugerido = remaining / monthsLeft;
      const cobertura = target > 0 ? Math.min(100, Math.round((totalAtual / target) * 100)) : 0;
      return `
        <div class="pi-meta-card">
          <div class="pm-name"><i data-lucide="${escapeHtml(g.icon || 'target')}"></i> ${escapeHtml(g.name || 'Meta')}</div>
          <div class="pm-values"><span>${fmtMoney(current)}</span><span>${fmtMoney(target)}</span></div>
          <div class="pi-meta-progress"><span style="width:${pct}%"></span></div>
          <div class="pm-footer">
            <span>${pct}% concluído · prazo ${year}</span>
            <span>Aporte sug. ${fmtMoney(aporteSugerido)}/mês</span>
          </div>
          <div class="pm-footer" style="margin-top:0.25rem;">
            <span>Patrimônio cobre ~${cobertura}% desta meta</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function projectPatrimony(present, monthly, months, annualRate) {
    const r = (annualRate / 100) / 12;
    const points = [];
    let bal = present;
    for (let m = 0; m <= months; m++) {
      points.push(bal);
      if (m < months) {
        bal = bal * (1 + r) + monthly;
      }
    }
    return points;
  }

  function renderProjecao(force) {
    const { totalAtual } = getCarteiraTotals();
    const aporteEl = document.getElementById('projAporteMensal');
    const prazoEl = document.getElementById('projPrazo');
    const taxaEl = document.getElementById('projTaxa');
    const monthly = aporteEl ? (parseMoneyInput(aporteEl.value) || 0) : 0;
    const months = prazoEl ? Math.max(1, parseInt(prazoEl.value, 10) || 60) : 60;
    const taxa = taxaEl ? (parseFloat(taxaEl.value) || 10) : 10;

    const cons = projectPatrimony(totalAtual, monthly, months, Math.max(0, taxa - 3));
    const base = projectPatrimony(totalAtual, monthly, months, taxa);
    const otim = projectPatrimony(totalAtual, monthly, months, taxa + 3);

    const scEl = document.getElementById('piProjScenarios');
    if (scEl) {
      scEl.innerHTML = `
        <div class="pi-proj-sc conservador"><div class="ps-label">Conservador (${(taxa - 3).toFixed(1)}% a.a.)</div><div class="ps-value">${fmtMoney(cons[cons.length - 1])}</div></div>
        <div class="pi-proj-sc base"><div class="ps-label">Base (${taxa.toFixed(1)}% a.a.)</div><div class="ps-value">${fmtMoney(base[base.length - 1])}</div></div>
        <div class="pi-proj-sc otimista"><div class="ps-label">Otimista (${(taxa + 3).toFixed(1)}% a.a.)</div><div class="ps-value">${fmtMoney(otim[otim.length - 1])}</div></div>
      `;
    }

    const canvas = document.getElementById('portfolioProjecaoChart');
    if (!canvas || typeof window.Chart === 'undefined') return;
    const labels = base.map((_, i) => i === 0 ? 'Hoje' : (i % 12 === 0 ? `${i / 12}a` : ''));
    if (portfolioProjecaoChart) portfolioProjecaoChart.destroy();
    portfolioProjecaoChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Conservador', data: cons, borderColor: '#22C55E', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Base', data: base, borderColor: '#0066FF', backgroundColor: 'rgba(0,102,255,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Otimista', data: otim, borderColor: '#A78BFA', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmtMoney(c.parsed.y) } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { notation: 'compact' }) }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  }

  function gerarInsightsCarteira() {
    const { list, totalInvestido, totalAtual, totalLucro, rent, qtd } = getCarteiraTotals();
    const risk = analyzeCarteiraRisk(list);
    const insights = [];
    const recs = [];
    const active = list.filter((i) => i.status !== 'resgatado');

    if (!active.length) {
      insights.push({ tipo: 'warn', title: 'Carteira sem posições ativas', body: 'Não há investimentos ativos cadastrados. Ao aplicar o primeiro ativo, indicadores, diversificação e risco passam a ser calculados com dados reais.' });
      recs.push({ title: 'Comece com um objetivo claro', body: 'Defina uma meta na seção Metas e use a carteira para acompanhar o progresso com aportes periódicos.', action: 'Criar meta ou aplicar investimento' });
      return { insights, recs };
    }

    insights.push({
      tipo: totalLucro >= 0 ? 'ok' : 'warn',
      title: 'Resultado da carteira',
      body: `Patrimônio atual ${fmtMoney(totalAtual)} sobre ${fmtMoney(totalInvestido)} aplicado. Resultado: ${totalLucro >= 0 ? '+' : ''}${fmtMoney(totalLucro)} (${rent >= 0 ? '+' : ''}${rent.toFixed(2)}%).`
    });

    if (risk.maxTipo > 0.55) {
      insights.push({ tipo: 'warn', title: 'Concentração elevada em uma classe', body: `Uma única classe concentra ${(risk.maxTipo * 100).toFixed(0)}% do patrimônio. Isso aumenta a sensibilidade da carteira a movimentos dessa classe.` });
      recs.push({ title: 'Revisar diversificação por classe', body: 'Avalie se a concentração está alinhada ao seu horizonte e tolerância a oscilações. Diversificar não elimina risco, mas pode reduzir dependência de um único fator.', action: 'Ver aba Diversificação / Risco' });
    }

    if (risk.nClasses <= 1) {
      insights.push({ tipo: 'danger', title: 'Baixa diversificação', body: 'A carteira está concentrada em uma única classe de ativos.' });
    } else if (risk.nClasses >= 4) {
      insights.push({ tipo: 'ok', title: 'Diversificação por classes', body: `Há ${risk.nClasses} classes diferentes na carteira, o que favorece distribuição de riscos entre segmentos.` });
    }

    const sorted = active.slice().sort((a, b) => getInvestLucro(b) - getInvestLucro(a));
    if (sorted.length) {
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      insights.push({
        tipo: 'ok',
        title: 'Melhor desempenho (resultado absoluto)',
        body: `${best.nome}: ${getInvestLucro(best) >= 0 ? '+' : ''}${fmtMoney(getInvestLucro(best))} (${getInvestRent(best).toFixed(2)}%).`
      });
      if (sorted.length > 1 && getInvestLucro(worst) < 0) {
        insights.push({
          tipo: 'warn',
          title: 'Pior desempenho (resultado absoluto)',
          body: `${worst.nome}: ${fmtMoney(getInvestLucro(worst))} (${getInvestRent(worst).toFixed(2)}%).`
        });
      }
    }

    const goalsList = Array.isArray(goals) ? goals : [];
    goalsList.forEach((g) => {
      const target = Number(g.target) || 0;
      if (target <= 0) return;
      const pct = Math.min(100, Math.round((totalAtual / target) * 100));
      insights.push({
        tipo: pct >= 100 ? 'ok' : 'warn',
        title: `Meta: ${g.name || 'Objetivo'}`,
        body: pct >= 100
          ? `O patrimônio investido (${fmtMoney(totalAtual)}) já cobre o valor-alvo de ${fmtMoney(target)}.`
          : `Patrimônio cobre cerca de ${pct}% de ${fmtMoney(target)}. Faltam ${fmtMoney(Math.max(0, target - totalAtual))}.`
      });
    });

    if (risk.volExposure > 0.4) {
      recs.push({
        title: 'Exposição relevante a classes mais voláteis',
        body: 'Ações, ETFs e criptomoedas somam parcela significativa. Isso pode amplificar oscilações de curto prazo. Avalie se o horizonte de investimento comporta essa volatilidade.',
        action: 'Revisar posições na aba Posições'
      });
    }

    if (qtd === 1) {
      recs.push({
        title: 'Única posição na carteira',
        body: 'Com apenas um ativo, o resultado depende integralmente desse investimento. Considerar gradualmente outras classes é uma reflexão educacional comum em educação financeira.',
        action: 'Explorar opções na grade de investimentos'
      });
    }

    if (!recs.length) {
      recs.push({
        title: 'Acompanhamento contínuo',
        body: 'Mantenha aportes e revisões periódicas alinhados às suas metas. Os indicadores desta carteira refletem apenas os dados que você cadastrou no Prisma.',
        action: 'Atualizar valores atuais dos ativos quando necessário'
      });
    }

    return { insights, recs };
  }

  function renderIaPanel() {
    const { insights, recs } = gerarInsightsCarteira();
    const insEl = document.getElementById('piAiInsights');
    const recEl = document.getElementById('piAiRecs');
    if (insEl) {
      insEl.innerHTML = insights.map((i) => `
        <div class="pi-ai-card ${escapeHtml(i.tipo)}">
          <div class="aic-title">${escapeHtml(i.title)}</div>
          <div class="aic-body">${escapeHtml(i.body)}</div>
        </div>
      `).join('') || '<p class="text-muted">Sem insights no momento.</p>';
    }
    if (recEl) {
      recEl.innerHTML = recs.map((r) => `
        <div class="pi-ai-card">
          <div class="aic-title">${escapeHtml(r.title)}</div>
          <div class="aic-body">${escapeHtml(r.body)}</div>
          ${r.action ? `<div class="aic-action">${escapeHtml(r.action)}</div>` : ''}
        </div>
      `).join('');
    }
  }

  function collectHistoricoGlobal() {
    const items = [];
    (Array.isArray(investimentos) ? investimentos : []).forEach((raw, idx) => {
      const inv = normalizeInvestimento(raw);
      const nome = inv.nome || 'Investimento';
      if (inv.dataAplicacao) {
        items.push({ tipo: 'aplicacao', data: inv.dataAplicacao, valor: getInvestValorAplicado(inv), nome, obs: 'Aplicação / posição', index: idx });
      }
      (inv.historico || []).forEach((h) => {
        items.push({
          tipo: h.tipo || 'aporte',
          data: h.data || '',
          valor: Number(h.valor) || 0,
          nome,
          obs: h.obs || '',
          index: idx
        });
      });
    });
    items.sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return items;
  }

  function renderHistoricoPanel() {
    const el = document.getElementById('piHistoricoGlobal');
    if (!el) return;
    let items = collectHistoricoGlobal();
    if (carteiraHistFilter && carteiraHistFilter !== 'todos') {
      items = items.filter((i) => i.tipo === carteiraHistFilter);
    }
    if (!items.length) {
      el.innerHTML = '<li class="text-muted" style="padding:0.75rem 0;">Nenhuma movimentação registrada.</li>';
      return;
    }
    el.innerHTML = items.map((h) => `
      <li>
        <span>
          <span class="hist-tipo ${escapeHtml(h.tipo)}">${escapeHtml((h.tipo || '').toUpperCase())}</span>
          ${escapeHtml(h.nome)} · ${formatDateBR(h.data)}
          ${h.obs ? ' · ' + escapeHtml(h.obs) : ''}
        </span>
        <strong>${h.tipo === 'resgate' ? '-' : '+'}${fmtMoney(h.valor)}</strong>
      </li>
    `).join('');
  }

  function renderInsightCards() {
    const el = document.getElementById('piInsightCards');
    if (!el) return;
    const { totalLucro, rent, qtd } = getCarteiraTotals();
    const risk = analyzeCarteiraRisk((Array.isArray(investimentos) ? investimentos : []).map(normalizeInvestimento));
    const goalsList = Array.isArray(goals) ? goals : [];
    el.innerHTML = `
      <div class="pi-insight-card" data-goto="visao"><div class="ic-icon">📈</div><div class="ic-title">Crescimento</div><div class="ic-desc">${rent >= 0 ? '+' : ''}${rent.toFixed(2)}% · ${totalLucro >= 0 ? '+' : ''}${fmtMoney(totalLucro)}</div></div>
      <div class="pi-insight-card" data-goto="risco"><div class="ic-icon">⚠️</div><div class="ic-title">Risco</div><div class="ic-desc">${escapeHtml(risk.nivel)}</div></div>
      <div class="pi-insight-card" data-goto="metas"><div class="ic-icon">🎯</div><div class="ic-title">Metas</div><div class="ic-desc">${goalsList.length} meta(s) vinculadas</div></div>
      <div class="pi-insight-card" data-goto="visao"><div class="ic-icon">💰</div><div class="ic-title">Rentabilidade</div><div class="ic-desc">${rent >= 0 ? '+' : ''}${rent.toFixed(2)}% acumulada</div></div>
      <div class="pi-insight-card" data-goto="visao"><div class="ic-icon">📊</div><div class="ic-title">Diversificação</div><div class="ic-desc">${risk.nClasses || 0} classe(s) · ${qtd} ativo(s)</div></div>
      <div class="pi-insight-card" data-goto="ia"><div class="ic-icon">🤖</div><div class="ic-title">Prisma AI</div><div class="ic-desc">Insights da carteira</div></div>
    `;
    el.querySelectorAll('[data-goto]').forEach((card) => {
      card.addEventListener('click', () => switchPrismaInvestTab(card.dataset.goto));
    });
  }

  function switchPrismaInvestTab(tab) {
    document.querySelectorAll('#prismaInvestTabs .pi-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.piTab === tab);
    });
    document.querySelectorAll('.pi-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.piPanel === tab);
    });
    if (tab === 'risco') renderRiscoPanel();
    if (tab === 'metas') { renderMetasPanel(); refreshIcons(); }
    if (tab === 'projecao') renderProjecao();
    if (tab === 'ia') renderIaPanel();
    if (tab === 'historico') renderHistoricoPanel();
    if (tab === 'posicoes') { renderCarteiraList(); refreshIcons(); }
  }

  function exportCarteiraCSV() {
    const list = (Array.isArray(investimentos) ? investimentos : []).map(normalizeInvestimento);
    const headers = ['Nome', 'Tipo', 'Instituição', 'Valor Aplicado', 'Valor Atual', 'Lucro', 'Rentabilidade %', 'Quantidade', 'Preço Médio', 'Data Aplicação', 'Vencimento', 'Status'];
    const rows = list.map((inv) => [
      inv.nome, TIPO_LABELS[inv.tipo] || inv.tipo, inv.instituicao || '',
      getInvestValorAplicado(inv).toFixed(2), getInvestValorAtual(inv).toFixed(2),
      getInvestLucro(inv).toFixed(2), getInvestRent(inv).toFixed(2),
      inv.quantidade != null ? inv.quantidade : '', inv.precoMedio != null ? inv.precoMedio.toFixed(4) : '',
      inv.dataAplicacao || '', inv.dataVencimento || '', inv.status || ''
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prisma-invest-carteira-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV da carteira gerado!');
  }

  async function exportCarteiraPDF() {
    try {
      showToast('Carregando biblioteca PDF…');
      const JsPDF = await ensurePdfLibrary();
      showToast('Preparando relatório da carteira...');
      const totals = getCarteiraTotals();
    const rawActive = totals.list
      .map((inv, index) => ({ ...normalizeInvestimento(inv), _index: index }))
      .filter((i) => i.status !== 'resgatado');
    const list = consolidateInvestimentosForDisplay(rawActive);
    const totalInvestido = totals.totalInvestido;
    const totalAtual = totals.totalAtual;
    const totalLucro = totals.totalLucro;
    const rent = totals.rent;
    const qtd = list.length;
    const logoData = await loadPrismaLogoForPDF();
    try {
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = drawPrismaHeader(pdf, {
      margin,
      logoData,
      title: 'Prisma Invest',
      subtitle: 'Relatório da Carteira de Investimentos'
    });
    y += 8;
    y = pdfDrawKpiRow(pdf, [
      { label: 'Patrimônio atual', value: fmtMoney(totalAtual), color: [37, 99, 235] },
      { label: 'Total investido', value: fmtMoney(totalInvestido), color: [13, 148, 136] },
      { label: 'Resultado', value: fmtMoney(totalLucro), color: totalLucro >= 0 ? [22, 163, 74] : [220, 38, 38] },
      { label: 'Rentabilidade', value: totalInvestido > 0 ? (rent.toFixed(2) + '%') : 'N/A', color: [124, 58, 237] }
    ], margin, y, contentWidth);
    y = pdfSectionTitle(pdf, `Posições (${qtd})`, margin, y);
    y += 6;
    if (!list.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Não existem posições suficientes para listar neste relatório.', margin, y);
      y += 20;
    } else {
      // table header
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(margin, y - 4, contentWidth, 18, 3, 3, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Ativo', margin + 6, y + 8);
      pdf.text('Tipo', margin + 160, y + 8);
      pdf.text('Aplicado', margin + 250, y + 8);
      pdf.text('Atual', margin + 340, y + 8);
      pdf.text('Rent.%', margin + 430, y + 8);
      y += 22;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      list.forEach((inv, idx) => {
        if (y > 720) {
          pdf.addPage();
          y = drawPrismaHeader(pdf, {
            margin, logoData,
            title: 'Prisma Invest',
            subtitle: 'Relatório da Carteira de Investimentos',
            showProfile: false
          }) + 12;
        }
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 8, contentWidth, 16, 'F');
        }
        pdf.setTextColor(15, 23, 42);
        pdf.text(pdfTruncate(pdf, String(inv.nome || '—'), 140), margin + 6, y);
        pdf.setTextColor(100, 116, 139);
        pdf.text(pdfTruncate(pdf, String(TIPO_LABELS[inv.tipo] || inv.tipo || '—'), 80), margin + 160, y);
        pdf.text(fmtMoney(getInvestValorAplicado(inv)), margin + 250, y);
        pdf.text(fmtMoney(getInvestValorAtual(inv)), margin + 340, y);
        const r = getInvestRent(inv);
        pdf.setTextColor(r >= 0 ? 22 : 220, r >= 0 ? 163 : 38, r >= 0 ? 74 : 38);
        pdf.text(`${r.toFixed(2)}%`, margin + 430, y);
        y += 16;
      });
    }
    drawPrismaFooterAllPages(pdf, {
      margin,
      disclaimer: 'Este documento possui caráter informativo e não constitui recomendação de investimento.'
    });
    pdf.save(`prisma-invest-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF da carteira pronto!');
    } catch (err) {
      console.error('PDF carteira:', err);
      showToast('Não foi possível gerar o PDF da carteira. Tente novamente.');
    }
    } catch (err) {
      console.error('Preparação do PDF carteira:', err);
      showToast('Não foi possível preparar o PDF da carteira. Tente novamente.');
    }
  }

  function updateInvestmentOverview() {
    const active = (Array.isArray(investimentos) ? investimentos : [])
      .map(normalizeInvestimento)
      .filter((inv) => inv && !['resgatado', 'encerrado', 'inativo'].includes(String(inv.status || '').toLowerCase()));
    const applied = active.reduce((sum, inv) => sum + getInvestValorAplicado(inv), 0);
    const current = active.reduce((sum, inv) => sum + getInvestValorAtual(inv), 0);
    const classes = new Set(active.map((inv) => String(inv.tipo || 'outros').toLowerCase()));
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('investOverviewCount', String(active.length));
    setText('investOverviewApplied', fmtMoney(applied));
    setText('investOverviewCurrent', fmtMoney(current));
    setText('investOverviewClasses', String(classes.size));
  }

  function renderInvestimentos() {
    if (!investimentosBody) return;
    if (Array.isArray(investimentos)) {
      investimentos = investimentos.map(normalizeInvestimento);
    }
    updateInvestmentOverview();
    renderPortfolioChart();
    renderCarteiraList();
    renderInsightCards();
    // Atualiza painéis se estiverem ativos
    const activePanel = document.querySelector('.pi-panel.active');
    if (activePanel) {
      const tab = activePanel.dataset.piPanel;
      if (tab === 'risco') renderRiscoPanel();
      if (tab === 'metas') renderMetasPanel();
      if (tab === 'projecao') renderProjecao();
      if (tab === 'ia') renderIaPanel();
      if (tab === 'historico') renderHistoricoPanel();
    }
    refreshIcons();
  }

  function renderCarteiraList() {
    const list = getFilteredSortedInvestimentos();
    if (!investimentosBody) return;
    investimentosBody.innerHTML = '';

    if (!list.length) {
      const isFiltered = (Array.isArray(investimentos) && investimentos.length > 0);
      const emptyIcon = isFiltered ? 'filter-x' : 'wallet';
      const emptyTitle = isFiltered ? 'Nenhum ativo encontrado' : 'Nenhum investimento cadastrado';
      const emptyMsg = isFiltered
        ? 'Não há ativos correspondentes aos filtros selecionados. Altere a busca ou redefina os filtros.'
        : 'Sua carteira de investimentos está vazia. Comece adicionando seus ativos para acompanhar seu patrimônio e rentabilidade.';
      const emptyAction = isFiltered
        ? '<button type="button" class="btn btn-outline btn-sm" id="carteiraResetFilterBtn"><i data-lucide="rotate-ccw"></i> Limpar filtros</button>'
        : '<button type="button" class="btn btn-primary btn-sm" id="carteiraAddEmptyBtn"><i data-lucide="plus"></i> Cadastrar primeiro ativo</button>';

      investimentosBody.innerHTML = `
        <div class="portfolio-empty-state">
          <div class="portfolio-empty-icon"><i data-lucide="${emptyIcon}"></i></div>
          <h3>${emptyTitle}</h3>
          <p>${emptyMsg}</p>
          <div class="portfolio-empty-actions">${emptyAction}</div>
        </div>
      `;

      const resetBtn = document.getElementById('carteiraResetFilterBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          carteiraFilter = 'todos';
          carteiraSearchQuery = '';
          const searchInput = document.getElementById('carteiraSearchInput') || document.getElementById('carteiraSearch');
          if (searchInput) searchInput.value = '';
          const pills = document.querySelectorAll('#carteiraFilters .carteira-pill, #carteiraFilters .filter-chip');
          pills.forEach(p => p.classList.toggle('active', (p.dataset.carteiraFilter === 'all' || p.dataset.filter === 'todos')));
          renderCarteiraList();
        });
      }
      const addEmptyBtn = document.getElementById('carteiraAddEmptyBtn');
      if (addEmptyBtn) {
        addEmptyBtn.addEventListener('click', () => {
          const addBtn = document.getElementById('openAddInvestimentoModal') || document.getElementById('addInvestimentoBtn');
          if (addBtn) addBtn.click();
        });
      }
      refreshIcons();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'portfolio-clean-list';

    list.forEach((inv) => {
      const index = inv._index;
      const valorAplicado = getInvestValorAplicado(inv);
      const valorAtual = getInvestValorAtual(inv);
      const lucro = getInvestLucro(inv);
      const rent = getInvestRent(inv);
      const isPos = lucro >= 0;
      const tipoLabel = TIPO_LABELS[inv.tipo] || inv.tipo || 'Outros';
      const tipoClass = String(inv.tipo || 'outros').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const safeName = escapeHtml(String(inv.nome || 'Investimento'));
      const safeInst = escapeHtml(inv.instituicao || '');
      const ticker = inv.ticker ? escapeHtml(String(inv.ticker).toUpperCase()) : '';
      const qtdStr = (inv.quantidade != null && !isNaN(inv.quantidade) && Number(inv.quantidade) > 0)
        ? `${Number(inv.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} cotas`
        : '';
      const icon = escapeHtml(inv.icon || 'trending-up');

      const card = document.createElement('article');
      card.className = 'ativo-card-clean';
      card.dataset.index = String(index);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Abrir detalhes de ${String(inv.nome || 'investimento')}`);

      card.innerHTML = `
        <div class="acc-main-row">
          <div class="acc-identity">
            <div class="acc-icon"><i data-lucide="${icon}"></i></div>
            <div class="acc-name-wrap">
              <div class="acc-name-line">
                <span class="acc-name">${safeName}</span>
                ${ticker ? `<span class="acc-ticker">${ticker}</span>` : ''}
                <span class="acc-badge ${tipoClass}">${escapeHtml(tipoLabel)}</span>
              </div>
              <div class="acc-subline">
                ${safeInst ? `<span>${safeInst}</span>` : ''}
                ${qtdStr ? `<span>${qtdStr}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="acc-values">
            <div class="acc-val-current">
              <span class="acc-label">Valor atual</span>
              <strong class="acc-amount">${fmtMoney(valorAtual)}</strong>
            </div>
            <div class="acc-val-perf">
              <span class="acc-rent-pill ${rent >= 0 ? 'pos' : 'neg'}">
                <i data-lucide="${rent >= 0 ? 'trending-up' : 'trending-down'}"></i>
                ${rent >= 0 ? '+' : ''}${rent.toFixed(2)}%
              </span>
              <span class="acc-result ${isPos ? 'pos' : 'neg'}">
                ${isPos ? '+' : ''}${fmtMoney(lucro)}
              </span>
            </div>
            <div class="acc-actions" onclick="event.stopPropagation()">
              <button class="table-action-btn" data-action="aporte-investimento" data-index="${index}" title="Novo aporte" aria-label="Aporte"><i data-lucide="plus-circle"></i></button>
              <button class="table-action-btn" data-action="resgatar-investimento" data-index="${index}" title="Resgatar" aria-label="Resgatar"><i data-lucide="arrow-up-right"></i></button>
              <button class="table-action-btn edit" data-action="edit-investimento" data-index="${index}" title="Editar" aria-label="Editar"><i data-lucide="edit"></i></button>
              <button class="table-action-btn delete" data-action="delete-investimento" data-index="${index}" title="Excluir" aria-label="Excluir"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        openInvestimentoDetalhe(index);
      });
      card.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-action]')) {
          e.preventDefault();
          openInvestimentoDetalhe(index);
        }
      });

      grid.appendChild(card);
    });

    investimentosBody.appendChild(grid);
    refreshIcons();
  }

  function renderPortfolioChart() {
    const list = (Array.isArray(investimentos) ? investimentos : []).map(normalizeInvestimento);
    let totalInvestido = 0, totalAtual = 0, totalLucro = 0;
    const groupsByTipo = new Map();

    list.forEach((inv) => {
      if (inv.status === 'resgatado') return;
      const valor = getInvestValorAplicado(inv);
      const atual = getInvestValorAtual(inv);
      const lucro = getInvestLucro(inv);
      totalInvestido += valor;
      totalAtual += atual;
      totalLucro += lucro;
      let gKey, gLabel;
      if (carteiraDivMode === 'instituicao') {
        gKey = inv.instituicao || 'Não informada';
        gLabel = gKey;
      } else if (carteiraDivMode === 'ativo') {
        gKey = inv.nome || 'Ativo';
        gLabel = gKey;
      } else {
        gKey = inv.tipo || 'outros';
        gLabel = TIPO_LABELS[gKey] || gKey;
      }
      const prev = groupsByTipo.get(gKey) || { nome: gLabel, valor: 0, tipo: inv.tipo || 'outros' };
      prev.valor += atual;
      groupsByTipo.set(gKey, prev);
    });

    const rentabilidade = totalInvestido > 0 ? ((totalAtual - totalInvestido) / totalInvestido) * 100 : 0;

    const elTotalInvestido = document.getElementById('portfolioTotalInvestido');
    const elTotalProjetado = document.getElementById('portfolioTotalProjetado');
    const elTotalLucro = document.getElementById('portfolioTotalLucro');
    const elRent = document.getElementById('portfolioRentabilidade');
    const elRentMes = document.getElementById('portfolioRentMes');
    const elRentAno = document.getElementById('portfolioRentAno');
    const elQtd = document.getElementById('portfolioQtdInvestimentos');

    if (elTotalInvestido) elTotalInvestido.textContent = fmtMoney(totalInvestido);
    if (elTotalProjetado) elTotalProjetado.textContent = fmtMoney(totalAtual);
    if (elTotalLucro) {
      elTotalLucro.textContent = (totalLucro >= 0 ? '+ ' : '- ') + fmtMoney(Math.abs(totalLucro));
      elTotalLucro.classList.toggle('positive', totalLucro >= 0);
      elTotalLucro.classList.toggle('negative', totalLucro < 0);
    }
    if (elRent) {
      elRent.textContent = (rentabilidade >= 0 ? '+' : '') + rentabilidade.toFixed(2) + '%';
      elRent.classList.toggle('positive', rentabilidade >= 0);
      elRent.classList.toggle('negative', rentabilidade < 0);
    }
    if (elRentMes) {
      const mes = rentabilidade / 12;
      elRentMes.textContent = (mes >= 0 ? '+' : '') + mes.toFixed(2) + '%';
      elRentMes.classList.toggle('positive', mes >= 0);
      elRentMes.classList.toggle('negative', mes < 0);
    }
    if (elRentAno) {
      elRentAno.textContent = (rentabilidade >= 0 ? '+' : '') + rentabilidade.toFixed(2) + '%';
      elRentAno.classList.toggle('positive', rentabilidade >= 0);
      elRentAno.classList.toggle('negative', rentabilidade < 0);
    }
    if (elQtd) elQtd.textContent = String(list.filter((i) => i.status !== 'resgatado').length);

    const canvas = document.getElementById('portfolioChart');
    const legendEl = document.getElementById('portfolioLegend');
    const entries = Array.from(groupsByTipo.values()).filter((g) => g.valor > 0);

    if (canvas) {
      if (!entries.length) {
        if (portfolioChart) { portfolioChart.destroy(); portfolioChart = null; }
        canvas.style.display = 'none';
        if (legendEl) legendEl.innerHTML = '<div class="portfolio-empty">Aplique um investimento para ver a distribuição da sua carteira aqui.</div>';
      } else {
        canvas.style.display = '';
        const labels = entries.map((e) => e.nome);
        const data = entries.map((e) => e.valor);
        const colors = entries.map((e, i) => (e.tipo && typeof investmentData !== 'undefined' && investmentData[e.tipo]?.iconColor) || PORTFOLIO_FALLBACK_COLORS[i % PORTFOLIO_FALLBACK_COLORS.length]);
        if (portfolioChart) portfolioChart.destroy();
        const ctx = canvas.getContext('2d');
        portfolioChart = new window.Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => c.label + ': ' + fmtMoney(c.parsed) } }
            }
          }
        });
        if (legendEl) {
          const sum = data.reduce((a, b) => a + b, 0) || 1;
          legendEl.innerHTML = entries.map((e, i) => {
            const pct = Math.round((e.valor / sum) * 100);
            return '<div class="portfolio-legend-item"><span class="portfolio-legend-dot" style="background:' + colors[i] + '"></span><span class="portfolio-legend-name">' + escapeHtml(e.nome) + '</span><span class="portfolio-legend-value">' + pct + '%</span></div>';
          }).join('');
        }
      }
    }

    renderEvolutionChart(list, totalAtual);
    renderLucroChart(list);
  }

  function renderEvolutionChart(list, totalAtual) {
    const canvas = document.getElementById('portfolioEvolutionChart');
    if (!canvas || typeof window.Chart === 'undefined') return;
    const points = [];
    let sorted = list.filter((i) => i.dataAplicacao).slice().sort((a, b) => String(a.dataAplicacao).localeCompare(String(b.dataAplicacao)));
    const periodMap = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
    if (carteiraEvolPeriod !== 'all' && periodMap[carteiraEvolPeriod]) {
      const cutoff = Date.now() - periodMap[carteiraEvolPeriod] * 86400000;
      const filtered = sorted.filter((i) => {
        try { return new Date(i.dataAplicacao).getTime() >= cutoff; } catch (_) { return true; }
      });
      if (filtered.length) sorted = filtered;
    }
    let acc = 0;
    // baseline: investido antes do período
    if (carteiraEvolPeriod !== 'all' && periodMap[carteiraEvolPeriod]) {
      const cutoff = Date.now() - periodMap[carteiraEvolPeriod] * 86400000;
      list.forEach((inv) => {
        if (!inv.dataAplicacao) return;
        try {
          if (new Date(inv.dataAplicacao).getTime() < cutoff && inv.status !== 'resgatado') {
            acc += getInvestValorAplicado(inv);
          }
        } catch (_) {}
      });
      if (acc > 0) points.push({ label: 'Início período', value: acc });
    }
    sorted.forEach((inv) => {
      acc += getInvestValorAplicado(inv);
      points.push({ label: formatDateBR(inv.dataAplicacao), value: acc });
    });
    if (points.length && totalAtual !== points[points.length - 1].value) {
      points.push({ label: 'Hoje', value: totalAtual });
    }
    if (!points.length) {
      points.push({ label: 'Início', value: 0 }, { label: 'Hoje', value: totalAtual || 0 });
    }
    if (portfolioEvolutionChart) portfolioEvolutionChart.destroy();
    portfolioEvolutionChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          label: 'Patrimônio',
          data: points.map((p) => p.value),
          borderColor: '#0066FF',
          backgroundColor: 'rgba(0,102,255,0.12)',
          fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtMoney(c.parsed.y) } } },
        scales: {
          x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { notation: 'compact' }) }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  }

  function renderLucroChart(list) {
    const canvas = document.getElementById('portfolioLucroChart');
    if (!canvas || typeof window.Chart === 'undefined') return;
    const active = list.filter((i) => i.status !== 'resgatado').slice(0, 10);
    const labels = active.map((i) => String(i.nome || '').slice(0, 18));
    const data = active.map((i) => getInvestLucro(i));
    const colors = data.map((v) => v >= 0 ? '#22C55E' : '#EF4444');
    if (portfolioLucroChart) portfolioLucroChart.destroy();
    if (!active.length) {
      portfolioLucroChart = new window.Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: ['—'], datasets: [{ data: [0], backgroundColor: ['#64748B'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      return;
    }
    portfolioLucroChart = new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtMoney(c.parsed.x) } } },
        scales: {
          x: { ticks: { color: '#94a3b8', callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { notation: 'compact' }) }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  let investimentoDetalheTab = 'visao';

  function getInvestimentoRiskInfo(inv) {
    const type = String(inv.tipo || 'outros').toLowerCase();
    const data = (typeof investmentData !== 'undefined' && investmentData[type]) ? investmentData[type] : null;
    if (data) return { nivel: data.risk || 'Moderado', liquidez: data.liquidity || 'Variável', garantia: data.guarantee || 'Sem garantia', taxa: data.rate || null };
    if (type === 'criptomoedas' || type === 'cripto') return { nivel: 'Muito alto', liquidez: 'Imediata', garantia: 'Sem garantia', taxa: 25 };
    if (type === 'acoes') return { nivel: 'Alto', liquidez: 'D+0', garantia: 'Sem garantia', taxa: 18 };
    if (type === 'fiis' || type === 'etfs' || type === 'fundos') return { nivel: 'Médio', liquidez: 'Variável', garantia: 'Sem garantia', taxa: 10 };
    return { nivel: 'Baixo a moderado', liquidez: 'Variável', garantia: 'Conforme produto', taxa: 10 };
  }

  function getInvestimentoProjection(inv) {
    const current = getInvestValorAtual(inv);
    const info = getInvestimentoRiskInfo(inv);
    const annual = Math.max(0, Number(inv.rentabilidade) || Number(info.taxa) || 10);
    const calc = (months) => current * Math.pow(1 + annual / 100 / 12, months);
    return { annual, v12: calc(12), v36: calc(36), v60: calc(60) };
  }

  function renderInvestimentoDetalhe(index, tab = investimentoDetalheTab) {
    const inv = normalizeInvestimento(investimentos[index]);
    const body = document.getElementById('investimentoDetalheBody');
    if (!inv || !body) return;
    investimentoDetalheTab = tab;
    const lucro = getInvestLucro(inv);
    const rent = getInvestRent(inv);
    const risk = getInvestimentoRiskInfo(inv);
    const proj = getInvestimentoProjection(inv);
    const hist = Array.isArray(inv.historico) ? inv.historico.slice().reverse() : [];
    const goalsList = Array.isArray(goals) ? goals : [];
    const valorAtual = getInvestValorAtual(inv);
    const aplicado = getInvestValorAplicado(inv);
    const portfolioTotal = getCarteiraTotals().totalAtual || 1;
    const exposure = Math.max(0, Math.min(100, (valorAtual / portfolioTotal) * 100));

    const tabButtons = ['visao','posicoes','risco','metas','projecao','ia','historico'].map((t) => {
      const labels = { visao:'Visão geral', posicoes:'Posições', risco:'Risco', metas:'Metas', projecao:'Projeção', ia:'Prisma AI', historico:'Histórico' };
      return `<button type="button" class="invest-detail-tab ${tab === t ? 'active' : ''}" data-invest-detail-tab="${t}" role="tab" aria-selected="${tab === t}">${labels[t]}</button>`;
    }).join('');

    let content = '';
    if (tab === 'visao') {
      content = `
        <div class="invest-detail-hero">
          <div class="detail-hero-icon"><i data-lucide="${escapeHtml(inv.icon || 'trending-up')}"></i></div>
          <div><span class="detail-kicker">${escapeHtml(TIPO_LABELS[inv.tipo] || inv.tipo || 'Investimento')}</span><h4>${escapeHtml(inv.nome || 'Investimento')}</h4><p>${escapeHtml(inv.instituicao || 'Instituição não informada')} · aplicado em ${formatDateBR(inv.dataAplicacao)}</p></div>
          <span class="invest-status ${escapeHtml(inv.status || 'ativo')}">${escapeHtml(inv.status || 'ativo')}</span>
        </div>
        <div class="detalhe-grid detail-kpi-grid">
          <div class="detalhe-item"><div class="di-label">Valor atual</div><div class="di-value">${fmtMoney(valorAtual)}</div></div>
          <div class="detalhe-item"><div class="di-label">Valor aplicado</div><div class="di-value">${fmtMoney(aplicado)}</div></div>
          <div class="detalhe-item"><div class="di-label">Resultado</div><div class="di-value ${lucro >= 0 ? 'positive' : 'negative'}">${lucro >= 0 ? '+' : ''}${fmtMoney(lucro)}</div></div>
          <div class="detalhe-item"><div class="di-label">Rentabilidade</div><div class="di-value ${rent >= 0 ? 'positive' : 'negative'}">${rent >= 0 ? '+' : ''}${rent.toFixed(2)}%</div></div>
        </div>
        <div class="detail-info-grid">
          <div><span>Classe</span><strong>${escapeHtml(TIPO_LABELS[inv.tipo] || inv.tipo || 'Outros')}</strong></div>
          <div><span>Instituição</span><strong>${escapeHtml(inv.instituicao || '—')}</strong></div>
          <div><span>Data da aplicação</span><strong>${formatDateBR(inv.dataAplicacao)}</strong></div>
          <div><span>Vencimento</span><strong>${formatDateBR(inv.dataVencimento)}</strong></div>
        </div>
        ${inv.observacoes ? `<div class="detail-note"><strong>Observações</strong><p>${escapeHtml(inv.observacoes)}</p></div>` : ''}
      `;
    } else if (tab === 'posicoes') {
      content = `
        <div class="detail-section-heading"><h4>Posição consolidada</h4><p>Composição e preço de entrada deste ativo na carteira.</p></div>
        <div class="detalhe-grid detail-kpi-grid">
          <div class="detalhe-item"><div class="di-label">Quantidade</div><div class="di-value">${inv.quantidade != null ? Number(inv.quantidade).toLocaleString('pt-BR', {maximumFractionDigits:6}) : '—'}</div></div>
          <div class="detalhe-item"><div class="di-label">Preço médio</div><div class="di-value">${inv.precoMedio != null ? fmtMoney(inv.precoMedio) : '—'}</div></div>
          <div class="detalhe-item"><div class="di-label">Valor aplicado</div><div class="di-value">${fmtMoney(aplicado)}</div></div>
          <div class="detalhe-item"><div class="di-label">Valor atual</div><div class="di-value">${fmtMoney(valorAtual)}</div></div>
        </div>
        <div class="detail-exposure"><div class="detail-exposure-head"><span>Participação na carteira</span><strong>${exposure.toFixed(1)}%</strong></div><div class="detail-progress"><span style="width:${exposure}%"></span></div></div>
      `;
    } else if (tab === 'risco') {
      const riskClass = String(risk.nivel).toLowerCase().replace(/\s+/g,'-');
      content = `
        <div class="detail-risk-hero"><div class="detail-risk-badge ${riskClass}"><i data-lucide="shield-alert"></i><strong>${escapeHtml(risk.nivel)}</strong></div><div><h4>Risco do ativo</h4><p>Classificação informativa baseada no tipo de investimento. Não constitui recomendação.</p></div></div>
        <div class="detail-info-grid"><div><span>Liquidez</span><strong>${escapeHtml(risk.liquidez)}</strong></div><div><span>Garantia</span><strong>${escapeHtml(risk.garantia)}</strong></div><div><span>Exposição na carteira</span><strong>${exposure.toFixed(1)}%</strong></div><div><span>Volatilidade esperada</span><strong>${['ações','fiis','etfs','criptomoedas'].includes(inv.tipo) ? 'Média/alta' : 'Baixa/moderada'}</strong></div></div>
      `;
    } else if (tab === 'metas') {
      content = `<div class="detail-section-heading"><h4>Metas relacionadas ao patrimônio</h4><p>Acompanhe como este ativo pode contribuir para seus objetivos financeiros.</p></div>`;
      content += goalsList.length ? `<div class="detail-goals-grid">${goalsList.map(g => { const current=Number(g.current)||0,target=Number(g.target)||1,pct=Math.min(100,Math.round(current/target*100)); return `<div class="pi-meta-card"><div class="pm-name">${escapeHtml(g.name||'Meta')}</div><div class="pm-values"><span>${fmtMoney(current)}</span><span>${fmtMoney(target)}</span></div><div class="pi-meta-progress"><span style="width:${pct}%"></span></div><div class="pm-footer"><span>${pct}% concluído</span><span>${g.year||'—'}</span></div></div>`; }).join('')}</div>` : '<div class="portfolio-empty">Nenhuma meta cadastrada. Crie uma meta para acompanhar a conexão com seus investimentos.</div>';
    } else if (tab === 'projecao') {
      content = `
        <div class="detail-section-heading"><h4>Projeção indicativa</h4><p>Simulação sem novos aportes, usando uma taxa anual de ${proj.annual.toFixed(2)}% como referência.</p></div>
        <div class="detail-projection-grid"><div><span>Hoje</span><strong>${fmtMoney(valorAtual)}</strong></div><div><span>12 meses</span><strong>${fmtMoney(proj.v12)}</strong></div><div><span>3 anos</span><strong>${fmtMoney(proj.v36)}</strong></div><div><span>5 anos</span><strong>${fmtMoney(proj.v60)}</strong></div></div>
        <div class="detail-note"><strong>Atenção</strong><p>Projeções são cenários matemáticos, não garantias de rentabilidade futura. Para renda variável, o resultado real pode variar significativamente.</p></div>
      `;
    } else if (tab === 'ia') {
      const tone = rent >= 0 ? 'positive' : 'negative';
      const concentration = exposure > 35 ? 'A posição representa uma parcela relevante da carteira. Avalie a concentração em conjunto com seu perfil e suas metas.' : 'A participação deste ativo está relativamente distribuída dentro da carteira.';
      content = `
        <div class="detail-ai-header"><div class="detail-ai-icon"><i data-lucide="sparkles"></i></div><div><h4>Prisma AI</h4><p>Leitura automática baseada somente nos dados cadastrados.</p></div></div>
        <div class="pi-ai-card ok"><div class="aic-title">Resultado atual</div><div class="aic-body ${tone}">${lucro >= 0 ? 'O ativo apresenta resultado positivo' : 'O ativo apresenta resultado negativo'} de ${fmtMoney(Math.abs(lucro))}, com rentabilidade de ${rent.toFixed(2)}%.</div></div>
        <div class="pi-ai-card"><div class="aic-title">Concentração</div><div class="aic-body">${concentration}</div></div>
        <div class="pi-ai-card warn"><div class="aic-title">Próxima revisão</div><div class="aic-body">Atualize o valor atual do ativo periodicamente para manter os indicadores, projeções e análises da carteira coerentes.</div></div>
      `;
    } else if (tab === 'historico') {
      content = `<div class="detail-section-heading"><h4>Histórico de movimentações</h4><p>Registro de aportes, resgates e rendimentos deste ativo.</p></div>`;
      content += hist.length ? `<ul class="historico-list detail-historico-list">${hist.map(h => `<li><span><span class="hist-tipo ${escapeHtml(h.tipo||'')}">${escapeHtml((h.tipo||'').toUpperCase())}</span> ${formatDateBR(h.data)}${h.obs ? ' · '+escapeHtml(h.obs) : ''}</span><strong class="${h.tipo==='resgate'?'negative':'positive'}">${h.tipo==='resgate'?'-':'+'}${fmtMoney(Number(h.valor)||0)}</strong></li>`).join('')}</ul>` : '<div class="portfolio-empty">Nenhuma movimentação registrada para este ativo.</div>';
    }

    body.innerHTML = `<div class="invest-detail-tabs" role="tablist">${tabButtons}</div><div class="invest-detail-content">${content}</div>`;
    body.querySelectorAll('[data-invest-detail-tab]').forEach(btn => btn.addEventListener('click', () => renderInvestimentoDetalhe(index, btn.dataset.investDetailTab)));
    refreshIcons();
  }

  function openInvestimentoDetalhe(index) {
    const inv = normalizeInvestimento(investimentos[index]);
    const modal = document.getElementById('investimentoDetalheModal');
    const title = document.getElementById('investimentoDetalheTitle');
    const subtitle = document.getElementById('investimentoDetalheSubtitle');
    if (!inv || !modal) return;
    if (title) title.textContent = inv.nome || 'Investimento';
    if (subtitle) subtitle.textContent = (TIPO_LABELS[inv.tipo] || inv.tipo || 'Investimento') + (inv.instituicao ? ' · ' + inv.instituicao : '');
    modal.dataset.index = String(index);
    investimentoDetalheTab = 'visao';
    renderInvestimentoDetalhe(index, 'visao');
    openModal(modal);
  }

  // Render Dashboard Transactions
  const tbody = document.getElementById('transactionsBody');
  function renderDashboardTransactions() {
    if (!tbody) return;
    tbody.innerHTML = '';
    const allTrans = [];
    receitas.forEach((r, index) => {
      allTrans.push({
        index, action: 'edit-receita', deleteAction: 'delete-receita', kind: 'receita', rawDate: r.data, cat: 'investment',
        catName: r.origem,
        desc: r.descricao,
        account: r.conta,
        value: `+${fmtMoney(r.valor)}`,
        type: 'pos',
        date: fmtDateBR(r.data),
        status: r.status,
        statusText: r.status === 'paid' ? 'Recebido' : 'Pendente',
      });
    });
    despesas.forEach((d, index) => {
      allTrans.push({
        index, action: 'edit-despesa', deleteAction: 'delete-despesa', kind: 'despesa', rawDate: d.data, cat: 'food',
        catName: d.categoria,
        desc: d.descricao,
        account: d.conta,
        value: `-${fmtMoney(d.valor)}`,
        type: 'neg',
        date: fmtDateBR(d.data),
        status: d.status,
        statusText: d.status === 'paid' ? 'Pago' : 'Pendente',
      });
    });

    allTrans.sort((a,b) => {
      const da=new Date(String(a.rawDate || '').includes('T') ? a.rawDate : `${a.rawDate || ''}T00:00:00`);
      const db=new Date(String(b.rawDate || '').includes('T') ? b.rawDate : `${b.rawDate || ''}T00:00:00`);
      return (Number.isNaN(db.getTime()) ? 0 : db.getTime()) - (Number.isNaN(da.getTime()) ? 0 : da.getTime());
    });
    allTrans.slice(0, 10).forEach((t) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="cat-badge ${t.type === 'pos' ? 'investment' : 'food'}">${escapeHtml(t.catName || '')}</span></td>
        <td>${escapeHtml(t.desc || '')}</td>
        <td>${escapeHtml(t.account || '')}</td>
        <td class="${t.type === 'pos' ? 'positive' : 'negative'}">${t.value}</td>
        <td>${t.date}</td>
        <td><span class="status ${escapeHtml(t.status || '')}">${t.statusText}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn edit" data-action="${t.action}" data-index="${t.index}" title="Editar ${t.kind === 'receita' ? 'receita' : 'despesa'}" aria-label="Editar ${t.kind === 'receita' ? 'receita' : 'despesa'}"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="${t.deleteAction}" data-index="${t.index}" title="Excluir ${t.kind === 'receita' ? 'receita' : 'despesa'}" aria-label="Excluir ${t.kind === 'receita' ? 'receita' : 'despesa'}"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    refreshIcons();
  }

  // Render Goals
  function renderGoals() {
    const goalsGrid = document.getElementById('metasGrid');
    if (!goalsGrid) return;
    goalsGrid.innerHTML = '';
    if (!goals.length) {
      renderEmptyCards(goalsGrid, 'Nenhuma meta cadastrada. Clique em "Nova Meta" para definir um objetivo.', 'target');
      refreshIcons();
      return;
    }
    goals.forEach((g, index) => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
      const card = document.createElement('div');
      card.className = 'card goal-card fade-in';
      card.setAttribute('data-index', index);
      card.innerHTML = `
        <div class="goal-head">
          <span class="goal-icon ${g.color || 'default'}"><i data-lucide="${g.icon || 'target'}"></i></span>
          <h3>${escapeHtml(g.name || '')}</h3>
          <div class="card-actions">
            <button class="table-action-btn edit" data-action="edit-meta" data-index="${index}" title="Editar meta"><i data-lucide="edit"></i></button>
            <button class="table-action-btn delete" data-action="delete-meta" data-index="${index}" title="Excluir meta"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <p class="goal-amount">${fmtMoney(g.current)} <span>/ ${fmtMoney(g.target)}</span></p>
        <div class="progress-bar"><div class="progress-fill ${g.color || 'default'}" style="width:${pct}%"></div></div>
        <div class="goal-meta"><span>${pct}%</span><span>Concluirá em ${g.year}</span></div>
        <div class="goal-quick-actions">
          <button class="btn-quick-action aporte" data-action="aporte-meta" data-index="${index}" title="Registrar aporte"><i data-lucide="plus-circle"></i> Aporte</button>
          <button class="btn-quick-action retirada" data-action="retirada-meta" data-index="${index}" title="Registrar retirada"><i data-lucide="minus-circle"></i> Retirada</button>
        </div>
      `;
      goalsGrid.appendChild(card);
    });
    refreshIcons();
  }

  // Dashboard Totals & Economia Card
  // Calcula a variação percentual entre o valor atual e o do mês anterior.
  // invert=true trata "aumento" como algo negativo (ex.: despesas subindo é ruim).
  function calcIndiceVariacao(atual, anterior, invert) {
    const curr = Number(atual) || 0;
    const prev = Number(anterior) || 0;

    if (curr === 0 && prev === 0) {
      return { icon: 'minus', cls: '', text: '0%' };
    }

    // FIX P1.3: When previous period is zero, return a "Novo" label instead of artificial +/-100%
    if (prev === 0) {
      const icon = (invert ? curr < 0 : curr > 0) ? 'trending-up' : 'trending-down';
      const cls = (invert ? curr < 0 : curr > 0) ? 'positive' : 'negative';
      return { icon, cls, text: 'Novo' };
    }
    let pct;
    pct = ((curr - prev) / Math.abs(prev)) * 100;

    if (Math.abs(pct) < 0.5) {
      return { icon: 'minus', cls: '', text: '0%' };
    }

    const subiu = pct > 0;
    const icon = subiu ? 'arrow-up-right' : 'arrow-down-right';
    const cls = invert ? (subiu ? 'down' : 'up') : (subiu ? 'up' : 'down');
    const rounded = Math.round(Math.abs(pct));
    const sign = subiu ? '+' : '-';
    return { icon, cls, text: `${sign}${rounded}%` };
  }

  function aplicarIndiceBadge(badge, info) {
    if (!badge || !info) return;
    badge.classList.remove('up', 'down');
    if (info.cls) badge.classList.add(info.cls);
    badge.innerHTML = '';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', info.icon);
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(' ' + info.text));
  }

  function updateDashboardCards() {
    receitasMes = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    despesasMes = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);

    const inc = Array.isArray(incomeData) ? incomeData : [];
    const exp = Array.isArray(expenseData) ? expenseData : [];
    const incAtual = inc[inc.length - 1] || 0;
    const incAnterior = inc[inc.length - 2] || 0;
    const expAtual = exp[exp.length - 1] || 0;
    const expAnterior = exp[exp.length - 2] || 0;
    const saldoAtualCalc = incAtual - expAtual;
    const saldoAnteriorCalc = incAnterior - expAnterior;

    // Fonte única: motor financeiro
    let ctx = null;
    try { ctx = typeof buildFinanceContext === 'function' ? buildFinanceContext() : null; } catch (_) { ctx = null; }

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    if (ctx) {
      setTxt('dashNetWorth', fmtMoney(ctx.netWorth));
      setTxt('dashNetWorthDetail', 'Ativos ' + fmtMoney(ctx.assets) + ' · Passivos ' + fmtMoney(ctx.liabilities));
      setTxt('dashInvested', fmtMoney(ctx.inv.atual));
      const rentTxt = ctx.inv.aplicado > 0
        ? ((ctx.inv.rent >= 0 ? '+' : '') + ctx.inv.rent.toFixed(1) + '% s/ aplicado')
        : 'Sem posições na carteira';
      setTxt('dashInvestedDetail', rentTxt);
      const band = PrismaFinance.scoreBand(ctx.score);
      setTxt('dashScoreValue', String(ctx.score));
      setTxt('dashScoreDetail', band.label + ' · indicativo educacional');
      const badgeScore = document.getElementById('dashBadgeScore');
      if (badgeScore) badgeScore.textContent = band.label;
      const invBadge = document.getElementById('dashBadgeInvest');
      if (invBadge) {
        if (ctx.inv.aplicado > 0) {
          const pos = ctx.inv.rent >= 0;
          aplicarIndiceBadge(invBadge, {
            icon: pos ? 'arrow-up-right' : 'arrow-down-right',
            cls: pos ? 'up' : 'down',
            text: (pos ? '+' : '') + ctx.inv.rent.toFixed(1) + '%'
          });
        } else {
          invBadge.innerHTML = '<i data-lucide="minus"></i> —';
        }
      }
      const nwBadge = document.getElementById('dashBadgeNetWorth');
      if (nwBadge) {
        const ok = ctx.netWorth >= 0;
        aplicarIndiceBadge(nwBadge, {
          icon: ok ? 'arrow-up-right' : 'arrow-down-right',
          cls: ok ? 'up' : 'down',
          text: ok ? 'OK' : 'Atenção'
        });
      }
      setTxt('dashIncomeMini', fmtMoney(ctx.inc));
      setTxt('dashExpenseMini', fmtMoney(ctx.exp));
      setTxt('dashSavingsMini', ctx.sr == null ? '—' : ((ctx.sr >= 0 ? '' : '') + ctx.sr.toFixed(1) + '%'));
      updateDashInsightAndAlerts(ctx);
    } else {
      // Fallback legado se motor indisponível
      const legacyValues = document.querySelectorAll('.stat-value');
      if (legacyValues.length >= 3) {
        /* noop – IDs específicos acima */
      }
      setTxt('dashIncomeMini', fmtMoney(receitasMes));
      setTxt('dashExpenseMini', fmtMoney(despesasMes));
    }

    updateEconomiaCard(saldoAtualCalc, saldoAnteriorCalc);
    try { if (typeof updateIncomeExpenseCard === 'function') updateIncomeExpenseCard(ctx); } catch (_) {}
    try { if (typeof updateMonitoringCenter === 'function') updateMonitoringCenter(ctx); } catch (_) {}
    
    // Atualiza resumos do Grand Card Visão Financeira
    const elGrandKpiCashflow = document.getElementById('grandKpiCashflow');
    const elGrandModuleCashflowVal = document.getElementById('grandModuleCashflowVal');
    if (elGrandKpiCashflow) elGrandKpiCashflow.textContent = fmtMoney(saldoAtualCalc);
    if (elGrandModuleCashflowVal) {
      elGrandModuleCashflowVal.textContent = (saldoAtualCalc >= 0 ? '+ ' : '') + fmtMoney(saldoAtualCalc);
      elGrandModuleCashflowVal.className = 'preview-val ' + (saldoAtualCalc >= 0 ? 'positive' : 'negative');
    }

    const elGrandModuleDistVal = document.getElementById('grandModuleDistVal');
    if (elGrandModuleDistVal) {
      const catCount = Array.isArray(categories) && categories.length ? categories.length : (receitas.length + despesas.length ? 'Ativas' : '0 cadastradas');
      elGrandModuleDistVal.textContent = typeof catCount === 'number' ? (catCount + ' categorias') : String(catCount);
    }

    const elGrandModuleIncomeExpenseVal = document.getElementById('grandModuleIncomeExpenseVal');
    if (elGrandModuleIncomeExpenseVal) {
      elGrandModuleIncomeExpenseVal.textContent = fmtMoney(saldoAtualCalc);
      elGrandModuleIncomeExpenseVal.className = 'preview-val ' + (saldoAtualCalc >= 0 ? 'positive' : 'negative');
    }

    updateWalletColor();
    if (typeof refreshIcons === 'function') try { refreshIcons(); } catch (_) {}
  }

  function updateDashInsightAndAlerts(ctx) {
    if (!ctx) return;
    const insightBox = document.getElementById('dashInsight');
    const insightText = document.getElementById('dashInsightText');
    const alertsBox = document.getElementById('dashAlerts');
    const alertsList = document.getElementById('dashAlertsList');

    // 1 insight principal
    let insight = '';
    if (ctx.sr != null && ctx.sr >= 20) insight = 'Sua taxa de poupança está em ' + ctx.sr.toFixed(1) + '% neste período — acima da referência educacional de 20%.';
    else if (ctx.cashFlow < 0 && ctx.inc > 0) insight = 'Despesas superam receitas no consolidado atual. Vale revisar categorias no fluxo de caixa.';
    else if (ctx.cardUtil.pct != null && ctx.cardUtil.pct >= 80) insight = 'Utilização de cartão em ' + ctx.cardUtil.pct.toFixed(0) + '% do limite — próximo do teto cadastrado.';
    else if (ctx.inv.atual > 0 && ctx.investClasses <= 1) insight = 'Carteira concentrada em poucas classes. Diversificação pode reduzir risco (visão educacional).';
    else if (ctx.goalsP.n && ctx.goalsP.pct < 30) insight = 'Metas no início do progresso (' + ctx.goalsP.pct.toFixed(0) + '%). Revise aportes mensais se necessário.';
    else if (ctx.sr != null && ctx.sr < 10 && ctx.inc > 0) insight = 'Taxa de poupança abaixo de 10%. Pequenos ajustes de gasto podem melhorar o score.';
    else if (ctx.inc || ctx.exp || ctx.inv.atual) insight = 'Dados atualizados. Abra o Centro Financeiro para saúde, patrimônio e projeções detalhadas.';
    else insight = 'Cadastre receitas, despesas ou investimentos para liberar insights personalizados.';

    if (insightText) insightText.textContent = insight;
    if (insightBox) insightBox.hidden = false;
    if (insightBox && insightText) {
      let insightToggle = document.getElementById('dashInsightToggle');
      if (!insightToggle) {
        insightToggle = document.createElement('button');
        insightToggle.type = 'button';
        insightToggle.id = 'dashInsightToggle';
        insightToggle.className = 'dash-insight-toggle';
        insightToggle.setAttribute('aria-controls', 'dashInsightText');
        insightBox.after(insightToggle);
        insightToggle.addEventListener('click', () => {
          const expanded = insightText.classList.toggle('is-expanded');
          insightToggle.setAttribute('aria-expanded', String(expanded));
          insightToggle.textContent = expanded ? 'Recolher' : 'Expandir';
        });
      }
      const needsExpansion = insight.length > 60;
      insightToggle.hidden = !needsExpansion;
      if (!needsExpansion) {
        insightText.classList.remove('is-expanded');
      }
      const expanded = insightText.classList.contains('is-expanded');
      insightToggle.textContent = expanded ? 'Recolher' : 'Expandir';
      insightToggle.setAttribute('aria-expanded', String(expanded));
    }

    // Alertas só quando relevantes
    const alerts = [];
    if (ctx.cashFlow < 0 && (ctx.inc > 0 || ctx.exp > 0)) alerts.push('Saldo do fluxo negativo no período consolidado.');
    if (ctx.cardUtil.pct != null && ctx.cardUtil.pct >= 80) alerts.push('Cartão com utilização ≥ 80% do limite.');
    if (ctx.sr != null && ctx.sr < 0) alerts.push('Taxa de poupança negativa (gastos acima das receitas).');
    if (ctx.exp > 0 && ctx.contasTotal < ctx.exp * 1) alerts.push('Reserva aproximada abaixo de 1 mês de despesas.');
    if (ctx.goalsP.n && ctx.goalsP.pct < 15 && ctx.goalsP.target > 0) alerts.push('Meta prioritária com pouco progresso acumulado.');
    if (ctx.inv.atual > 0 && ctx.investClasses === 1) alerts.push('Investimentos concentrados em uma única classe.');

    const priorityForAlert = (message) => /saldo do fluxo negativo|taxa de poupança negativa/i.test(message)
      ? 'critical'
      : /cartão com utilização/i.test(message)
        ? 'warning'
        : 'info';
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => priorityOrder[priorityForAlert(a)] - priorityOrder[priorityForAlert(b)]);

    const dismissedAlertsKey = `prisma_dashboard_dismissed_alerts_${currentProfileId || 'guest'}`;
    let dismissedAlerts = [];
    try {
      const savedDismissals = JSON.parse(localStorage.getItem(dismissedAlertsKey) || '[]');
      if (Array.isArray(savedDismissals)) dismissedAlerts = savedDismissals.filter((message) => typeof message === 'string');
    } catch (error) {
      console.error('Falha ao carregar os alertas dispensados:', error);
      if (typeof window.showToast === 'function') window.showToast('Não foi possível carregar as preferências de alertas.');
    }

    const currentAlerts = new Set(alerts);
    const retainedDismissals = dismissedAlerts.filter((message) => currentAlerts.has(message));
    if (retainedDismissals.length !== dismissedAlerts.length) {
      try {
        localStorage.setItem(dismissedAlertsKey, JSON.stringify(retainedDismissals));
      } catch (error) {
        console.error('Falha ao atualizar as preferências de alertas:', error);
        if (typeof window.showToast === 'function') window.showToast('Não foi possível atualizar as preferências de alertas.');
      }
    }
    const visibleAlerts = alerts.filter((message) => !retainedDismissals.includes(message));

    if (alertsList) {
      if (alertsList.dataset.dismissBound !== '1') {
        alertsList.dataset.dismissBound = '1';
        alertsList.addEventListener('click', (event) => {
          const dismissButton = event.target.closest('[data-alert-dismiss]');
          if (!dismissButton) return;
          const message = dismissButton.dataset.alertDismiss;
          const storageKey = `prisma_dashboard_dismissed_alerts_${currentProfileId || 'guest'}`;
          try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const dismissals = Array.isArray(saved) ? saved : [];
            if (!dismissals.includes(message)) dismissals.push(message);
            localStorage.setItem(storageKey, JSON.stringify(dismissals));
          } catch (error) {
            console.error('Falha ao dispensar o alerta:', error);
            if (typeof window.showToast === 'function') window.showToast('Não foi possível dispensar este alerta.');
            return;
          }

          dismissButton.closest('li')?.remove();
          const remaining = Array.from(alertsList.children);
          const toggle = alertsBox?.querySelector('#dashAlertsToggle');
          const hiddenCount = remaining.filter((item, index) => index >= 2 && !item.classList.contains('priority-critical')).length;
          if (toggle) {
            toggle.dataset.hiddenCount = String(hiddenCount);
            toggle.hidden = hiddenCount === 0;
            toggle.textContent = alertsBox.classList.contains('expanded') ? 'Mostrar menos' : `Ver ${hiddenCount} alerta${hiddenCount === 1 ? '' : 's'} a mais`;
          }
          if (alertsBox) {
            alertsBox.hidden = remaining.length === 0;
            if (remaining.length === 0) alertsBox.classList.remove('expanded');
          }
          if (typeof window.showToast === 'function') window.showToast('Alerta dispensado. O monitoramento continua ativo.');
        });
      }
      alertsList.replaceChildren(...visibleAlerts.map((message) => {
        const item = document.createElement('li');
        item.className = `priority-${priorityForAlert(message)}`;
        item.dataset.priority = priorityForAlert(message);
        const icon = document.createElement('i');
        icon.dataset.lucide = item.dataset.priority === 'critical' ? 'alert-triangle' : item.dataset.priority === 'warning' ? 'alert-circle' : 'info';
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = message;
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'dash-alert-dismiss';
        dismiss.dataset.alertDismiss = message;
        dismiss.setAttribute('aria-label', `Dispensar alerta: ${message}`);
        dismiss.textContent = 'Dispensar';
        item.append(icon, text, dismiss);
        return item;
      }));
    }
    if (alertsBox) {
      let toggle = alertsBox.querySelector('#dashAlertsToggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.id = 'dashAlertsToggle';
        toggle.className = 'dash-alerts-toggle';
        toggle.setAttribute('aria-controls', 'dashAlertsList');
        alertsBox.querySelector('.dash-alerts-title')?.after(toggle);
        toggle.addEventListener('click', () => {
          const expanded = alertsBox.classList.toggle('expanded');
          toggle.setAttribute('aria-expanded', String(expanded));
          const hiddenCount = Number(toggle.dataset.hiddenCount) || 0;
          toggle.textContent = expanded ? 'Mostrar menos' : `Ver ${hiddenCount} alerta${hiddenCount === 1 ? '' : 's'} a mais`;
        });
      }
      const visibleCount = Math.min(visibleAlerts.length, Math.max(2, visibleAlerts.filter((message) => priorityForAlert(message) === 'critical').length));
      const hiddenCount = Math.max(0, visibleAlerts.length - visibleCount);
      const expanded = alertsBox.classList.contains('expanded');
      toggle.dataset.hiddenCount = String(hiddenCount);
      toggle.hidden = hiddenCount === 0;
      toggle.textContent = expanded ? 'Mostrar menos' : `Ver ${hiddenCount} alerta${hiddenCount === 1 ? '' : 's'} a mais`;
      toggle.setAttribute('aria-expanded', String(expanded));
      alertsBox.hidden = visibleAlerts.length === 0;
    }
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  // ==================== CENTRAL DE MONITORAMENTO FINANCEIRO & GASTOS E RECEITAS ====================
  let _monitoringExpanded = false;
  let _monitoringActiveTab = 'alerts';

  function getMonitoringDismissedKey() {
    return `prisma_monitoring_dismissed_${currentProfileId || 'guest'}`;
  }

  function getMonitoringDismissedIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(getMonitoringDismissedKey()) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (_) {
      return [];
    }
  }

  function saveMonitoringDismissedIds(ids) {
    try {
      localStorage.setItem(getMonitoringDismissedKey(), JSON.stringify(ids));
    } catch (e) {
      console.warn('Erro ao salvar alertas dispensados:', e);
    }
  }

  function updateIncomeExpenseCard(ctx) {
    const incTotal = (ctx && ctx.inc != null) ? ctx.inc : (typeof receitasMes === 'number' ? receitasMes : 0);
    const expTotal = (ctx && ctx.exp != null) ? ctx.exp : (typeof despesasMes === 'number' ? despesasMes : 0);
    const saldo = incTotal - expTotal;
    const incCount = Array.isArray(receitas) ? receitas.length : 0;
    const expCount = Array.isArray(despesas) ? despesas.length : 0;

    const elInc = document.getElementById('dashIncomeTotal');
    const elExp = document.getElementById('dashExpenseTotal');
    const elIncCount = document.getElementById('dashIncomeCount');
    const elExpCount = document.getElementById('dashExpenseCount');
    const elNetBalance = document.getElementById('flowNetBalance');
    const elBarIncome = document.getElementById('flowBarIncome');
    const elBarExpense = document.getElementById('flowBarExpense');
    const elFlowIncPct = document.getElementById('flowIncomePercent');
    const elFlowExpPct = document.getElementById('flowExpensePercent');
    const elRatioBadge = document.getElementById('dashFlowRatioBadge');

    if (elInc) elInc.textContent = fmtMoney(incTotal);
    if (elExp) elExp.textContent = fmtMoney(expTotal);
    if (elIncCount) elIncCount.textContent = `${incCount} entrada${incCount === 1 ? '' : 's'}`;
    if (elExpCount) elExpCount.textContent = `${expCount} saída${expCount === 1 ? '' : 's'}`;

    if (elNetBalance) {
      elNetBalance.textContent = `Saldo: ${fmtMoney(saldo)}`;
      elNetBalance.classList.remove('positive', 'negative');
      elNetBalance.classList.add(saldo >= 0 ? 'positive' : 'negative');
    }

    const totalVolume = incTotal + expTotal;
    let incPct = 50;
    let expPct = 50;
    if (totalVolume > 0) {
      incPct = Math.min(95, Math.max(5, Math.round((incTotal / totalVolume) * 100)));
      expPct = 100 - incPct;
    }
    if (elFlowIncPct) elFlowIncPct.textContent = `${incPct}%`;
    if (elFlowExpPct) elFlowExpPct.textContent = `${expPct}%`;
    if (elBarIncome) elBarIncome.style.width = `${incPct}%`;
    if (elBarExpense) elBarExpense.style.width = `${expPct}%`;

    if (elRatioBadge) {
      if (incTotal > 0) {
        const compromisso = Math.round((expTotal / incTotal) * 100);
        elRatioBadge.textContent = `${compromisso}% comprometido`;
        elRatioBadge.classList.remove('up', 'down', 'badge-warn');
        if (compromisso <= 70) {
          elRatioBadge.classList.add('up');
        } else if (compromisso <= 95) {
          elRatioBadge.classList.add('badge-warn');
        } else {
          elRatioBadge.classList.add('down');
        }
        const elGrandFlowBadge = document.getElementById('grandModuleFlowRatioBadge');
        if (elGrandFlowBadge) elGrandFlowBadge.textContent = `${compromisso}% comprometido`;
      } else {
        elRatioBadge.textContent = expTotal > 0 ? '100% despesas' : '0% comprometido';
        elRatioBadge.classList.remove('up', 'down', 'badge-warn');
        const elGrandFlowBadge = document.getElementById('grandModuleFlowRatioBadge');
        if (elGrandFlowBadge) elGrandFlowBadge.textContent = '0% comprometido';
      }
    }
  }

  function updateMonitoringCenter(ctx) {
    if (!window.PrismaMonitoringCenter) return;
    const pmc = window.PrismaMonitoringCenter;

    const dismissedIds = getMonitoringDismissedIds();
    const revenueResult = pmc.generateRevenueAlerts({
      receitas: Array.isArray(receitas) ? receitas : [],
      referenceDate: new Date(),
      dismissedAlertIds: dismissedIds
    });

    const insightsResult = pmc.generateFinancialInsights({
      receitas: Array.isArray(receitas) ? receitas : [],
      despesas: Array.isArray(despesas) ? despesas : [],
      contas: Array.isArray(contas) ? contas : [],
      cartoes: Array.isArray(cartoes) ? cartoes : [],
      investimentos: Array.isArray(investimentos) ? investimentos : [],
      goals: Array.isArray(goals) ? goals : [],
      period: '30d'
    });

    const healthStatus = pmc.computeGeneralHealthStatus({
      revenueAlertsResult: revenueResult,
      insightsResult,
      cashFlow: ctx ? ctx.cashFlow : (receitasMes - despesasMes),
      savingsRate: ctx ? ctx.sr : null
    });

    // 1. Cabeçalho Compacto (Estado Inicial)
    const pendingBadge = document.getElementById('monitoringPendingBadge');
    if (pendingBadge) {
      pendingBadge.textContent = `${revenueResult.pendentesNaoLidos} pendente${revenueResult.pendentesNaoLidos === 1 ? '' : 's'}`;
      pendingBadge.classList.toggle('has-alerts', revenueResult.pendentesNaoLidos > 0);
      pendingBadge.classList.toggle('is-critical', revenueResult.criticosCount > 0);
    }

    const pulseDot = document.getElementById('monitoringPulseDot');
    if (pulseDot) {
      pulseDot.className = 'status-pulse-dot ' + healthStatus.dotClass;
    }

    const briefSummary = document.getElementById('monitoringBriefSummary');
    if (briefSummary) {
      if (revenueResult.criticosCount > 0) {
        briefSummary.textContent = `Atenção: ${revenueResult.atrasadasCount} receita${revenueResult.atrasadasCount === 1 ? '' : 's'} atrasada${revenueResult.atrasadasCount === 1 ? '' : 's'}`;
      } else if (revenueResult.pendentesNaoLidos > 0) {
        briefSummary.textContent = `${revenueResult.pendentesNaoLidos} aviso${revenueResult.pendentesNaoLidos === 1 ? '' : 's'} de receitas para acompanhar`;
      } else if (ctx && ctx.cashFlow < 0) {
        briefSummary.textContent = 'Alerta: despesas acima das receitas no período';
      } else {
        briefSummary.textContent = 'Receitas em dia · Monitoramento estável';
      }
    }

    // Grand Card Visão Financeira sync
    const elGrandMonitoringStatus = document.getElementById('grandMonitoringStatus');
    const elGrandMonitoringDot = document.getElementById('grandMonitoringDot');
    const elGrandModuleAlertsBadge = document.getElementById('grandModuleAlertsBadge');
    const elGrandModuleMonitoringVal = document.getElementById('grandModuleMonitoringVal');

    if (elGrandMonitoringStatus) elGrandMonitoringStatus.textContent = healthStatus.label || 'Ativo';
    if (elGrandMonitoringDot) elGrandMonitoringDot.className = 'status-indicator-dot ' + (healthStatus.dotClass || '');
    if (elGrandModuleAlertsBadge) {
      elGrandModuleAlertsBadge.textContent = `${revenueResult.pendentesNaoLidos || 0} pendente${(revenueResult.pendentesNaoLidos === 1) ? '' : 's'}`;
      elGrandModuleAlertsBadge.classList.toggle('has-alerts', (revenueResult.pendentesNaoLidos || 0) > 0);
    }
    if (elGrandModuleMonitoringVal) elGrandModuleMonitoringVal.textContent = healthStatus.label || 'Operação normal';

    // 2. Resumo Expandido (Métricas e Status)
    const elHealth = document.getElementById('mHealthStatus');
    if (elHealth) {
      elHealth.textContent = healthStatus.label;
      elHealth.className = 'm-pill-val ' + healthStatus.statusClass;
    }
    const elActiveAlerts = document.getElementById('mActiveAlertsCount');
    if (elActiveAlerts) elActiveAlerts.textContent = String(revenueResult.pendentesNaoLidos);

    const elInsightsCount = document.getElementById('mInsightsCount');
    if (elInsightsCount) elInsightsCount.textContent = String(insightsResult.total);

    const elLastUpdated = document.getElementById('mLastUpdated');
    if (elLastUpdated) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      elLastUpdated.textContent = `Hoje às ${hh}:${mm}`;
    }

    const priorityBanner = document.getElementById('mPriorityBanner');
    const priorityBannerText = document.getElementById('mPriorityBannerText');
    if (priorityBanner) {
      if (revenueResult.criticosCount > 0) {
        priorityBanner.style.display = 'flex';
        if (priorityBannerText) {
          priorityBannerText.textContent = `${revenueResult.criticosCount} receita${revenueResult.criticosCount === 1 ? '' : 's'} em atraso necessita${revenueResult.criticosCount === 1 ? '' : 'm'} de atenção`;
        }
      } else {
        priorityBanner.style.display = 'none';
      }
    }

    const alertsTabCounter = document.getElementById('mAlertsTabCounter');
    if (alertsTabCounter) alertsTabCounter.textContent = String(revenueResult.pendentesNaoLidos);

    const insightsTabCounter = document.getElementById('mInsightsTabCounter');
    if (insightsTabCounter) insightsTabCounter.textContent = String(insightsResult.total);

    // 3. Renderizar Alertas de Receitas
    const alertsListEl = document.getElementById('mRevenueAlertsList');
    if (alertsListEl) {
      alertsListEl.innerHTML = '';
      if (revenueResult.alerts.length === 0) {
        alertsListEl.innerHTML = `
          <div class="m-empty-state">
            <i data-lucide="check-circle-2"></i>
            <p>Nenhum alerta pendente. Todas as receitas previstas estão em dia!</p>
          </div>`;
      } else {
        const priorityOrder = { critica: 0, alta: 1, media: 2, info: 3 };
        [...revenueResult.alerts]
          .sort((a, b) => (priorityOrder[a.prioridade] ?? 4) - (priorityOrder[b.prioridade] ?? 4))
          .forEach((alert) => {
          const item = document.createElement('div');
          item.className = `monitoring-item priority-${alert.prioridade} ${alert.lido ? 'is-read' : 'is-unread'}`;
          item.setAttribute('data-alert-id', alert.id);

          const prioIcon = alert.prioridade === 'critica' ? 'alert-triangle' : alert.prioridade === 'alta' ? 'alert-circle' : 'info';
          const alertDate = alert.dataReferencia ? fmtDateBR(String(alert.dataReferencia)) : '';
          item.innerHTML = `
            <div class="m-item-top">
              <span class="m-item-badge ${alert.prioridade}">
                <i data-lucide="${prioIcon}"></i> ${escapeHtml(alert.prioridadeLabel)}
              </span>
              <span class="m-item-val">${fmtMoney(alert.valor)}</span>
            </div>
            <h4 class="m-item-title">${escapeHtml(alert.titulo)}</h4>
            <p class="m-item-desc">${escapeHtml(alert.problema)}</p>
            ${alertDate ? `<time class="m-item-date" datetime="${escapeHtml(String(alert.dataReferencia))}"><i data-lucide="calendar-days"></i> Previsão: ${escapeHtml(alertDate)}</time>` : ''}
            ${alert.acaoRecomendada ? `
              <details class="m-item-details">
                <summary><i data-lucide="compass"></i> Orientação</summary>
                <p>${escapeHtml(alert.acaoRecomendada)}</p>
              </details>
            ` : ''}
            <div class="m-item-actions">
              <button type="button" class="btn btn-xs btn-outline" data-nav-dest="${alert.destinoTela || 'receitas'}">
                <i data-lucide="external-link"></i> Ver em Receitas
              </button>
              ${!alert.lido ? `
                <button type="button" class="btn btn-xs btn-ghost btn-dismiss-alert" data-dismiss-id="${alert.id}" title="Marcar como lido">
                  <i data-lucide="check"></i> Lido
                </button>
              ` : `
                <span class="m-item-read-tag"><i data-lucide="check-check"></i> Lido</span>
              `}
            </div>
          `;
          alertsListEl.appendChild(item);
          });
      }
    }

    // 4. Renderizar Insights Financeiros
    const insightsListEl = document.getElementById('mFinancialInsightsList');
    if (insightsListEl) {
      insightsListEl.innerHTML = '';
      insightsResult.insights.forEach((insight) => {
        const item = document.createElement('div');
        item.className = `monitoring-item insight-item level-${insight.nivel}`;
        item.innerHTML = `
          <div class="m-item-top">
            <span class="m-item-badge insight-badge ${escapeHtml(insight.nivel)}">
              <i data-lucide="${insight.icone || 'sparkles'}"></i> ${escapeHtml(insight.categoria)}
            </span>
          </div>
          <h4 class="m-item-title">${escapeHtml(insight.titulo)}</h4>
          <p class="m-item-desc">${escapeHtml(insight.descricao)}</p>
          ${insight.impacto || insight.recomendacao ? `
            <details class="m-item-details">
              <summary><i data-lucide="lightbulb"></i> Impacto e recomendação</summary>
              ${insight.impacto ? `<p><strong>Impacto:</strong> ${escapeHtml(insight.impacto)}</p>` : ''}
              ${insight.recomendacao ? `<p><strong>Próxima ação:</strong> ${escapeHtml(insight.recomendacao)}</p>` : ''}
            </details>
          ` : ''}
          <div class="m-item-actions">
            <button type="button" class="btn btn-xs btn-outline" data-nav-dest="${insight.destinoTela || 'centro-financeiro'}">
              <i data-lucide="arrow-right"></i> Ver no Centro Financeiro
            </button>
          </div>
        `;
        insightsListEl.appendChild(item);
      });
    }

    setupMonitoringInteractions();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  let _monitoringInteractionsBound = false;
  function setupMonitoringInteractions() {
    if (_monitoringInteractionsBound) return;
    _monitoringInteractionsBound = true;

    const card = document.getElementById('dashMonitoringCard');
    const headerToggle = document.getElementById('dashMonitoringToggle');
    const content = document.getElementById('dashMonitoringContent');
    const toggleText = document.getElementById('monitoringToggleText');
    const chevron = document.getElementById('monitoringChevron');

    function toggleExpansion() {
      _monitoringExpanded = !_monitoringExpanded;
      if (card) card.classList.toggle('is-expanded', _monitoringExpanded);
      if (content) content.style.display = _monitoringExpanded ? 'block' : 'none';
      if (headerToggle) headerToggle.setAttribute('aria-expanded', String(_monitoringExpanded));
      if (toggleText) toggleText.textContent = _monitoringExpanded ? 'Recolher' : 'Expandir';
      if (chevron) {
        chevron.style.transform = _monitoringExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      }
      if (typeof refreshIcons === 'function') refreshIcons();
    }

    if (headerToggle) {
      headerToggle.addEventListener('click', (e) => {
        if (e.target.closest('button') && !e.target.closest('#btnToggleMonitoring')) return;
        toggleExpansion();
      });
      headerToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleExpansion();
        }
      });
    }

    const btnToggle = document.getElementById('btnToggleMonitoring');
    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpansion();
      });
    }

    const tabBtnAlerts = document.getElementById('mTabBtnAlerts');
    const tabBtnInsights = document.getElementById('mTabBtnInsights');
    const tabPaneAlerts = document.getElementById('mTabAlerts');
    const tabPaneInsights = document.getElementById('mTabInsights');

    function switchMonitoringTab(tab) {
      _monitoringActiveTab = tab;
      if (tabBtnAlerts) {
        tabBtnAlerts.classList.toggle('active', tab === 'alerts');
        tabBtnAlerts.setAttribute('aria-selected', String(tab === 'alerts'));
      }
      if (tabBtnInsights) {
        tabBtnInsights.classList.toggle('active', tab === 'insights');
        tabBtnInsights.setAttribute('aria-selected', String(tab === 'insights'));
      }
      if (tabPaneAlerts) tabPaneAlerts.style.display = tab === 'alerts' ? 'block' : 'none';
      if (tabPaneInsights) tabPaneInsights.style.display = tab === 'insights' ? 'block' : 'none';
      if (typeof refreshIcons === 'function') refreshIcons();
    }

    if (tabBtnAlerts) tabBtnAlerts.addEventListener('click', () => switchMonitoringTab('alerts'));
    if (tabBtnInsights) tabBtnInsights.addEventListener('click', () => switchMonitoringTab('insights'));

    document.addEventListener('click', (e) => {
      const dismissBtn = e.target.closest('.btn-dismiss-alert');
      if (dismissBtn) {
        e.preventDefault();
        e.stopPropagation();
        const alertId = dismissBtn.getAttribute('data-dismiss-id');
        if (alertId) {
          const current = getMonitoringDismissedIds();
          if (!current.includes(alertId)) {
            current.push(alertId);
            saveMonitoringDismissedIds(current);
          }
          if (typeof updateDashboardCards === 'function') updateDashboardCards();
          if (typeof showToast === 'function') showToast('Alerta marcado como lido.');
        }
        return;
      }

      const dismissAllBtn = e.target.closest('#mDismissAllAlerts');
      if (dismissAllBtn) {
        e.preventDefault();
        const alertsEl = document.querySelectorAll('#mRevenueAlertsList [data-alert-id]');
        const current = getMonitoringDismissedIds();
        alertsEl.forEach((el) => {
          const id = el.getAttribute('data-alert-id');
          if (id && !current.includes(id)) current.push(id);
        });
        saveMonitoringDismissedIds(current);
        if (typeof updateDashboardCards === 'function') updateDashboardCards();
        if (typeof showToast === 'function') showToast('Todos os alertas foram marcados como lidos.');
        return;
      }

      const navBtn = e.target.closest('[data-nav-dest]');
      if (navBtn) {
        e.preventDefault();
        const dest = navBtn.getAttribute('data-nav-dest');
        if (dest && typeof window.ScreenNavigator === 'object' && typeof window.ScreenNavigator.loadScreen === 'function') {
          window.ScreenNavigator.loadScreen(dest);
        } else if (dest && typeof window.navigateToSection === 'function') {
          window.navigateToSection(dest);
        } else {
          const navItem = document.querySelector(`.nav-item[data-section="${dest}"]`);
          if (navItem) navItem.click();
        }
      }
    });
  }

  function updateEconomiaCard(saldoAtualCalc, saldoAnteriorCalc) {
    const hasData = receitas.length > 0 || despesas.length > 0;
    const diff = receitasMes - despesasMes;
    const isDebt = diff < 0;
    const valor = Math.abs(diff);

    const label = document.getElementById('economiaLabel');
    const value = document.getElementById('economiaValue');
    const detail = document.getElementById('economiaDetail');
    const icon = document.getElementById('economiaIcon');
    const badge = document.getElementById('economiaBadge');

    // Índice de variação do resultado (economia/dívida) em relação ao mês anterior
    const indice = calcIndiceVariacao(
      saldoAtualCalc != null ? saldoAtualCalc : diff,
      saldoAnteriorCalc != null ? saldoAnteriorCalc : 0,
      false
    );

    if (!hasData) {
      economiaMes = 0;
      if (label) label.textContent = 'Economia';
      if (value) value.textContent = fmtMoney(0);
      if (detail) detail.textContent = 'Comece adicionando suas finanças';
      if (icon) {
        icon.classList.remove('red');
        icon.classList.add('purple');
        const i = icon.querySelector('i');
        if (i) i.setAttribute('data-lucide', 'piggy-bank');
      }
      aplicarIndiceBadge(badge, { icon: 'minus', cls: '', text: '0%' });
    } else if (isDebt) {
      economiaMes = -valor;
      if (label) label.textContent = 'Dívida';
      if (value) value.textContent = fmtMoney(valor);
      if (detail) detail.textContent = 'Despesas maiores que as receitas';
      if (icon) {
        icon.classList.remove('purple');
        icon.classList.add('red');
        const i = icon.querySelector('i');
        if (i) i.setAttribute('data-lucide', 'alert-triangle');
      }
      aplicarIndiceBadge(badge, indice);
    } else {
      economiaMes = valor;
      if (label) label.textContent = 'Economia';
      if (value) value.textContent = fmtMoney(valor);
      if (detail) detail.textContent = 'Superávit entre receitas e despesas';
      if (icon) {
        icon.classList.remove('red');
        icon.classList.add('purple');
        const i = icon.querySelector('i');
        if (i) i.setAttribute('data-lucide', 'piggy-bank');
      }
      aplicarIndiceBadge(badge, indice);
    }
    refreshIcons();
  }

  // Recalculate and update state

  // ========== MOTOR CENTRAL DE CÁLCULOS + CENTRO FINANCEIRO ==========
  const PrismaFinance = {
    safeDiv(a, b) {
      const n = Number(a), d = Number(b);
      if (!d || !isFinite(d) || !isFinite(n)) return 0;
      return n / d;
    },
    pct(part, whole) {
      return this.safeDiv(part, whole) * 100;
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
      let aplicado = 0, atual = 0;
      (list || []).forEach((inv) => {
        if (!inv) return;
        const st = String(inv.status || 'ativo').toLowerCase();
        if (st === 'resgatado' || st === 'encerrado' || st === 'inativo') return;
        let a = 0, cur = null;
        try {
          if (typeof getInvestValorAplicado === 'function') a = Number(getInvestValorAplicado(inv)) || 0;
          if (typeof getInvestValorAtual === 'function') cur = Number(getInvestValorAtual(inv));
        } catch (_) {}
        if (!a) {
          a = this.money(inv.valorAplicado != null ? inv.valorAplicado : (inv.valorInvestido != null ? inv.valorInvestido : inv.valor));
        }
        if (cur == null || !Number.isFinite(cur)) {
          if (inv.valorAtual != null) cur = this.money(inv.valorAtual);
          else if (inv.valorTotal != null) cur = this.money(inv.valorTotal);
          else cur = a + this.money(inv.lucro);
        }
        aplicado += a;
        atual += cur;
      });
      return { aplicado, atual, lucro: atual - aplicado, rent: aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0 };
    },
    getAccountsTotal(contasList) {
      return (contasList || []).reduce((s, c) => s + this.money(c && c.saldo), 0);
    },
    getCardsDebt(cartoesList) {
      return (cartoesList || []).reduce((s, c) => {
        if (!c) return s;
        const used = c.usado != null ? c.usado : (c.fatura != null ? c.fatura : (c.saldo != null ? c.saldo : 0));
        return s + this.money(used);
      }, 0);
    },
    getCardsUtilization(cartoesList) {
      let limit = 0, used = 0;
      (cartoesList || []).forEach((c) => {
        if (!c) return;
        limit += this.money(c.limite);
        used += this.money(c.usado != null ? c.usado : (c.fatura != null ? c.fatura : 0));
      });
      return { limit, used, pct: limit > 0 ? (used / limit) * 100 : null };
    },
    money(v) {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (v == null || v === '') return 0;
      if (typeof window.parseMoneyInput === 'function') {
        const n = window.parseMoneyInput(v);
        return Number.isFinite(n) ? n : 0;
      }
      if (typeof window.PrismaParseMoney === 'function') {
        const n = window.PrismaParseMoney(v);
        return Number.isFinite(n) ? n : 0;
      }
      const n = parseFloat(String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    },
    getGoalsProgress(goalsList) {
      let target = 0, current = 0, n = 0;
      (goalsList || []).forEach((g) => {
        if (!g) return;
        const t = this.money(g.target != null ? g.target : (g.alvo != null ? g.alvo : g.metaAlvo));
        const c = this.money(g.current != null ? g.current : (g.atual != null ? g.atual : g.metaAtual));
        target += t;
        current += c;
        n++;
      });
      return { n, target, current, pct: target > 0 ? Math.min(100, (current / target) * 100) : 0, remaining: Math.max(0, target - current) };
    },
    computeScore(ctx) {
      // Indicador educacional 0-100 — não é diagnóstico profissional
      let score = 40; // base neutra
      const sr = ctx.savingsRate;
      if (sr != null) {
        if (sr >= 20) score += 18;
        else if (sr >= 10) score += 12;
        else if (sr >= 0) score += 5;
        else score -= 15;
      }
      const util = ctx.cardUtilPct;
      if (util != null) {
        if (util < 30) score += 12;
        else if (util < 50) score += 6;
        else if (util < 80) score -= 5;
        else score -= 15;
      }
      if (ctx.investAtual > 0) {
        score += 8;
        if (ctx.investClasses >= 3) score += 6;
        else if (ctx.investClasses >= 2) score += 3;
      }
      if (ctx.goalsPct >= 50) score += 8;
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
    }
  };

  // —— Cache do motor financeiro ——
  let __financeCtxCache = null;
  let __financeCtxVersion = 0;
  let __financeDataVersion = 0;
  const __sectionDirty = Object.create(null);
  ['receitas','despesas','contas','cartoes','investimentos','metas','dashboard','centro-financeiro','carteira-ativos'].forEach((k) => { __sectionDirty[k] = true; });
  let __persistTimer = null;

  function bumpFinanceDataVersion() {
    __financeDataVersion++;
    __financeCtxCache = null;
    Object.keys(__sectionDirty).forEach((k) => { __sectionDirty[k] = true; });
  }

  function getActiveSectionId() {
    const el = document.querySelector('.content .section.active, main .section.active, .section.active');
    return el && el.id ? el.id : null;
  }

  function schedulePersistFinance() {
    clearTimeout(__persistTimer);
    __persistTimer = setTimeout(() => {
      try {
        saveDataStorage(STORAGE_KEYS.receitas, receitas);
        saveDataStorage(STORAGE_KEYS.despesas, despesas);
        saveDataStorage(STORAGE_KEYS.contas, contas);
        saveDataStorage(STORAGE_KEYS.cartoes, cartoes);
        saveDataStorage(STORAGE_KEYS.investimentos, investimentos);
        saveDataStorage(STORAGE_KEYS.goals, goals);
        saveDataStorage(STORAGE_KEYS.monthlyFlow, { inc: incomeData, exp: expenseData });
        if (typeof categories !== 'undefined') saveDataStorage(STORAGE_KEYS.categories, categories);
        if (typeof summaryData !== 'undefined') setJSONToStorage(STORAGE_KEYS.summary, summaryData);
      } catch (e) { console.warn('Persistência financeira:', e); }
    }, 40);
  }

  function readLiveFinanceLists() {
    const fromMem = (arr) => (Array.isArray(arr) ? arr : null);
    let r = fromMem(typeof receitas !== 'undefined' ? receitas : null);
    let d = fromMem(typeof despesas !== 'undefined' ? despesas : null);
    let c = fromMem(typeof contas !== 'undefined' ? contas : null);
    let k = fromMem(typeof cartoes !== 'undefined' ? cartoes : null);
    let i = fromMem(typeof investimentos !== 'undefined' ? investimentos : null);
    let g = fromMem(typeof goals !== 'undefined' ? goals : null);

    // Fallback: recarregar do storage do perfil atual se arrays estiverem vazios
    // (ex.: navegação antes do loadProfileData concluir)
    const needFallback = (!r || !r.length) || (!d || !d.length) || (!i || !i.length) || (!c || !c.length) || (!k || !k.length) || (!g || !g.length);
    if (needFallback && typeof getJSONFromStorage === 'function' && typeof STORAGE_KEYS !== 'undefined') {
      try {
        if (!r || !r.length) r = getJSONFromStorage(STORAGE_KEYS.receitas, r || []);
        if (!d || !d.length) d = getJSONFromStorage(STORAGE_KEYS.despesas, d || []);
        if (!c || !c.length) c = getJSONFromStorage(STORAGE_KEYS.contas, c || []);
        if (!k || !k.length) k = getJSONFromStorage(STORAGE_KEYS.cartoes, k || []);
        if (!i || !i.length) i = getJSONFromStorage(STORAGE_KEYS.investimentos, i || []);
        if (!g || !g.length) g = getJSONFromStorage(STORAGE_KEYS.goals, g || []);
      } catch (_) {}
    }
    return {
      receitas: Array.isArray(r) ? r : [],
      despesas: Array.isArray(d) ? d : [],
      contas: Array.isArray(c) ? c : [],
      cartoes: Array.isArray(k) ? k : [],
      investimentos: Array.isArray(i) ? i : [],
      goals: Array.isArray(g) ? g : []
    };
  }

  function buildFinanceContext() {
    if (__financeCtxCache && __financeCtxVersion === __financeDataVersion) {
      return __financeCtxCache;
    }
    const lists = readLiveFinanceLists();
    // Manter variáveis globais sincronizadas quando o fallback preencheu dados
    try {
      if (Array.isArray(lists.receitas) && lists.receitas.length && (!receitas || !receitas.length)) receitas = lists.receitas;
      if (Array.isArray(lists.despesas) && lists.despesas.length && (!despesas || !despesas.length)) despesas = lists.despesas;
      if (Array.isArray(lists.contas) && lists.contas.length && (!contas || !contas.length)) contas = lists.contas;
      if (Array.isArray(lists.cartoes) && lists.cartoes.length && (!cartoes || !cartoes.length)) cartoes = lists.cartoes;
      if (Array.isArray(lists.investimentos) && lists.investimentos.length && (!investimentos || !investimentos.length)) investimentos = lists.investimentos;
      if (Array.isArray(lists.goals) && lists.goals.length && (!goals || !goals.length)) goals = lists.goals;
    } catch (_) {}

    const inv = PrismaFinance.getInvestTotals(lists.investimentos);
    const contasTotal = PrismaFinance.getAccountsTotal(lists.contas);
    const cardDebt = PrismaFinance.getCardsDebt(lists.cartoes);
    const cardUtil = PrismaFinance.getCardsUtilization(lists.cartoes);
    const goalsP = PrismaFinance.getGoalsProgress(lists.goals);

    // Sempre recalcular fluxo a partir dos lançamentos reais (mesma regra do Dashboard)
    const inc = lists.receitas.reduce((s, x) => s + PrismaFinance.money(x && x.valor), 0);
    const exp = lists.despesas.reduce((s, x) => s + PrismaFinance.money(x && x.valor), 0);
    try {
      receitasMes = inc;
      despesasMes = exp;
      economiaMes = inc - exp;
    } catch (_) {}

    const cashFlow = inc - exp;
    const sr = PrismaFinance.savingsRate(inc, exp);

    // Ativos = saldos em contas + valor atual de investimentos
    // Se não há contas cadastradas, usa saldo de fluxo positivo como liquidez estimada (sem inventar dados)
    const liquid = contasTotal > 0 ? contasTotal : Math.max(0, cashFlow);
    const assets = liquid + inv.atual;
    const liabilities = cardDebt;
    const netWorth = assets - liabilities;
    let investClasses = 0;
    try {
      const set = new Set();
      (investimentos || []).forEach((i) => {
        if (i && i.status !== 'resgatado') set.add(String(i.tipo || 'outros'));
      });
      investClasses = set.size;
    } catch (_) {}
    let eduPoints = 0, eduCompleted = 0, eduQuizzes = 0;
    try {
      if (typeof getEducationData === 'function') {
        const ed = getEducationData();
        eduPoints = ed.points || 0;
        eduCompleted = (ed.completed || []).length;
        eduQuizzes = (ed.quizzesCompleted || []).length;
      }
    } catch (_) {}
    const score = PrismaFinance.computeScore({
      savingsRate: sr,
      cardUtilPct: cardUtil.pct,
      investAtual: inv.atual,
      investClasses,
      goalsPct: goalsP.pct,
      eduPoints,
      netWorth,
      cashFlow
    });
    const __ctxResult = {
      inv, contasTotal, cardDebt, cardUtil, goalsP, inc, exp, cashFlow, sr,
      assets, liabilities, netWorth, investClasses, eduPoints, eduCompleted, eduQuizzes, score
    };
    __financeCtxCache = __ctxResult;
    __financeCtxVersion = __financeDataVersion;
    return __ctxResult;
  }

  // Unifica com motor testável se o script prisma-finance-engine.js carregou antes
  if (typeof window.PrismaFinance === 'object' && window.PrismaFinance && typeof window.PrismaFinance.computeScore === 'function') {
    // Engine global já é a fonte; expõe também métodos usados no app
    const eng = window.PrismaFinance;
    // Preserva todos os métodos do engine (incluindo os do módulo Prisma AI)
    const engineMethods = {};
    [
      'money', 'safeDiv', 'pct', 'savingsRate', 'projectCompound',
      'getInvestTotals', 'getAccountsTotal', 'getCardsDebt',
      'getCardsUtilization', 'getGoalsProgress', 'computeScore', 'scoreBand',
      // Métodos do motor de análise financeira / Prisma AI
      'analyzeFinances', 'generateRecommendations', 'calculateConsolidatedSavings',
      'filterTransactionsByPeriod', 'classifyExpense',
      'detectRecurringAndSubscriptions', 'detectAtypicalAndDuplicates',
      'computeNetWorth', 'transferAccounts', 'groupInvestmentsByCategory'
    ].forEach(m => {
      if (typeof eng[m] === 'function') {
        engineMethods[m] = eng[m].bind(eng);
      }
    });
    Object.assign(PrismaFinance, engineMethods);
  }
  window.PrismaFinance = PrismaFinance;
  window.buildFinanceContext = buildFinanceContext;

  function getCentroFilterBounds(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    if (period === 'today') {
      return { start: today, end: endOfDay(today), label: 'Hoje' };
    }
    if (period === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end: endOfDay(end), label: 'Esta semana' };
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: 'Este mês' };
    }
    if (period === '3months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start, end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: 'Últimos três meses' };
    }
    if (period === 'year') {
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(new Date(now.getFullYear(), 11, 31)), label: 'Este ano' };
    }
    if (period === 'custom') {
      const from = document.getElementById('cfDateFrom')?.value;
      const to = document.getElementById('cfDateTo')?.value;
      if (!from || !to) return { invalid: true, label: 'Selecione as datas inicial e final.' };
      const start = new Date(`${from}T00:00:00`);
      const end = endOfDay(new Date(`${to}T00:00:00`));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return { invalid: true, label: 'O intervalo informado é inválido.' };
      }
      return { start, end, label: `De ${fmtDateBR(from)} até ${fmtDateBR(to)}` };
    }
    return { start: null, end: null, label: 'Todo o período' };
  }

  function buildCentroTransactions() {
    const list = [];
    (receitas || []).forEach((item, index) => list.push({
      kind: 'receita',
      index,
      record: item,
      category: String(item.origem || 'Sem categoria'),
      date: item.data || '',
      status: item.status === 'paid' ? 'paid' : 'pending',
      amount: PrismaFinance.money(item.valor)
    }));
    (despesas || []).forEach((item, index) => list.push({
      kind: 'despesa',
      index,
      record: item,
      category: String(item.categoria || 'Sem categoria'),
      date: item.data || '',
      status: item.status === 'paid' ? 'paid' : 'pending',
      amount: PrismaFinance.money(item.valor)
    }));
    return list;
  }

  function getCentroDate(value) {
    if (!value) return null;
    const raw = String(value);
    const date = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getCentroFilteredTransactions() {
    const period = document.getElementById('cfPeriodFilter')?.value || 'month';
    const bounds = getCentroFilterBounds(period);
    const category = document.getElementById('cfCategoryFilter')?.value || '';
    const type = document.getElementById('cfTypeFilter')?.value || 'all';
    const status = document.getElementById('cfStatusFilter')?.value || 'all';
    const transactions = buildCentroTransactions();
    if (bounds.invalid) return { transactions: [], allTransactions: transactions, bounds, period };

    return {
      allTransactions: transactions,
      bounds,
      period,
      transactions: transactions.filter((item) => {
        const date = getCentroDate(item.date);
        const categoryKey = `${item.kind}:${item.category}`;
        return (!bounds.start || (date && date >= bounds.start && date <= bounds.end)) &&
          (!category || categoryKey === category) &&
          (type === 'all' || item.kind === type) &&
          (status === 'all' || item.status === status);
      })
    };
  }

  function setCentroText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateCentroCategoryOptions(transactions) {
    const select = document.getElementById('cfCategoryFilter');
    if (!select) return;
    const selected = select.value;
    const options = new Map();
    transactions.forEach((item) => {
      const key = `${item.kind}:${item.category}`;
      options.set(key, `${item.kind === 'receita' ? 'Receita' : 'Despesa'} · ${item.category}`);
    });
    select.replaceChildren(new Option('Todas', ''));
    [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).forEach(([value, label]) => {
      select.add(new Option(label, value));
    });
    if (options.has(selected)) select.value = selected;
  }

  function getCentroChartPeriods(period, bounds, transactions) {
    const now = new Date();
    let start = bounds.start;
    let end = bounds.end;
    let monthly = period === '3months' || period === 'year';
    if (period === 'all') {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      monthly = true;
    } else if (period === 'custom' && start && end) {
      monthly = (end - start) > 90 * 24 * 60 * 60 * 1000;
    }
    if (!start || !end) {
      const dates = transactions.map((item) => getCentroDate(item.date)).filter(Boolean);
      if (!dates.length) return [];
      start = new Date(Math.min(...dates.map((date) => date.getTime())));
      end = new Date(Math.max(...dates.map((date) => date.getTime())));
      monthly = (end - start) > 90 * 24 * 60 * 60 * 1000;
    }

    const periods = [];
    if (monthly) {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= last && periods.length < 120) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        periods.push({ key, label: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), income: 0, expense: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor <= last && periods.length < 400) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        periods.push({ key, label: cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), income: 0, expense: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    const periodIndex = new Map(periods.map((item, index) => [item.key, index]));
    transactions.forEach((item) => {
      const date = getCentroDate(item.date);
      if (!date) return;
      const key = monthly
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const index = periodIndex.get(key);
      if (index === undefined) return;
      periods[index][item.kind === 'receita' ? 'income' : 'expense'] += item.amount;
    });
    return periods;
  }

  function renderCentroFlowChart(filter) {
    const canvas = document.getElementById('cfFlowChart');
    if (!canvas || !window.Chart) return;
    const periods = getCentroChartPeriods(filter.period, filter.bounds, filter.transactions);
    const context = canvas.getContext('2d');
    const cumulative = [];
    let balance = 0;
    periods.forEach((item) => {
      balance += item.income - item.expense;
      cumulative.push(balance);
    });
    if (cfFlowChartInstance) cfFlowChartInstance.destroy();
    cfFlowChartInstance = new window.Chart(context, {
      type: 'bar',
      data: {
        labels: periods.map((item) => item.label),
        datasets: [
          { type: 'bar', label: 'Receitas', data: periods.map((item) => item.income), backgroundColor: 'rgba(34, 197, 94, 0.72)', borderRadius: 5, maxBarThickness: 26 },
          { type: 'bar', label: 'Despesas', data: periods.map((item) => item.expense), backgroundColor: 'rgba(248, 113, 113, 0.72)', borderRadius: 5, maxBarThickness: 26 },
          { type: 'line', label: 'Fluxo acumulado', data: cumulative, borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.12)', fill: false, tension: 0.25, pointRadius: 2, pointHoverRadius: 5, yAxisID: 'y' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#cbd5e1', usePointStyle: true, boxWidth: 8 } },
          tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${fmtMoney(item.raw)}` } }
        },
        scales: {
          x: { stacked: false, grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12, maxRotation: 0 } },
          y: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8', callback: (value) => fmtMoney(value) } }
        }
      }
    });
  }

  function renderCentroDistribution(filter) {
    const canvas = document.getElementById('cfDistributionChart');
    const list = document.getElementById('cfDistributionList');
    if (!canvas || !list) return;
    const type = cfDistributionType;
    const totals = new Map();
    filter.transactions.filter((item) => item.kind === type).forEach((item) => {
      totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
    });
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    list.replaceChildren();
    if (cfDistributionChartInstance) {
      cfDistributionChartInstance.destroy();
      cfDistributionChartInstance = null;
    }
    if (!window.Chart) {
      list.textContent = 'O gráfico não está disponível neste momento.';
      return;
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'cf-empty';
      empty.textContent = type === 'despesa' ? 'Sem despesas neste recorte.' : 'Sem receitas neste recorte.';
      list.appendChild(empty);
      cfDistributionChartInstance = new window.Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
      return;
    }

    const colors = ['#22c55e', '#38bdf8', '#a78bfa', '#f59e0b', '#f87171', '#2dd4bf', '#818cf8', '#fb7185'];
    const categorySelect = document.getElementById('cfCategoryFilter');
    cfDistributionChartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: entries.map(([name]) => name),
        datasets: [{ data: entries.map(([, value]) => value), backgroundColor: entries.map((_, index) => colors[index % colors.length]), borderColor: '#111827', borderWidth: 2, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => {
            const total = entries.reduce((sum, entry) => sum + entry[1], 0);
            return `${item.label}: ${fmtMoney(item.raw)} (${total ? (item.raw / total * 100).toFixed(1) : 0}%)`;
          } } }
        },
        onClick: (_event, elements) => {
          const index = elements[0]?.index;
          if (index === undefined || !categorySelect) return;
          categorySelect.value = `${type}:${entries[index][0]}`;
          const typeSelect = document.getElementById('cfTypeFilter');
          if (typeSelect) typeSelect.value = type;
          renderCentroOverview();
        }
      }
    });
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    entries.forEach(([name, value], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cf-category-item';
      button.setAttribute('aria-label', `Filtrar ${name}: ${fmtMoney(value)}`);
      button.innerHTML = `<span class="cf-category-dot" style="--cf-category-color:${colors[index % colors.length]}"></span><span class="cf-category-name"></span><strong></strong><small></small>`;
      button.querySelector('.cf-category-name').textContent = name;
      button.querySelector('strong').textContent = fmtMoney(value);
      button.querySelector('small').textContent = `${total ? (value / total * 100).toFixed(1) : '0.0'}%`;
      button.addEventListener('click', () => {
        if (categorySelect) categorySelect.value = `${type}:${name}`;
        const typeSelect = document.getElementById('cfTypeFilter');
        if (typeSelect) typeSelect.value = type;
        renderCentroOverview();
      });
      list.appendChild(button);
    });
  }

  function renderCentroOverview() {
    const root = document.getElementById('centroFinanceiro');
    if (!root) return;
    const filter = getCentroFilteredTransactions();
    updateCentroCategoryOptions(filter.allTransactions);
    const transactions = filter.transactions;
    const income = transactions.filter((item) => item.kind === 'receita');
    const expense = transactions.filter((item) => item.kind === 'despesa');
    const sum = (items) => items.reduce((total, item) => total + item.amount, 0);
    const statusItems = (items, status) => items.filter((item) => item.status === status);
    const recurring = expense.filter((item) => Boolean(item.record.recorrente));
    const countLabel = (items) => `${items.length} ${items.length === 1 ? 'lançamento' : 'lançamentos'}`;
    const incomeTotal = sum(income);
    const expenseTotal = sum(expense);

    setCentroText('cfOverviewBalance', fmtMoney(PrismaFinance.getAccountsTotal(contas || [])));
    setCentroText('cfOverviewIncome', fmtMoney(incomeTotal));
    setCentroText('cfOverviewExpense', fmtMoney(expenseTotal));
    setCentroText('cfOverviewResult', fmtMoney(incomeTotal - expenseTotal));
    setCentroText('cfOverviewIncomeCount', countLabel(income));
    setCentroText('cfOverviewExpenseCount', countLabel(expense));
    setCentroText('cfReceivedTotal', fmtMoney(sum(statusItems(income, 'paid'))));
    setCentroText('cfReceivedCount', countLabel(statusItems(income, 'paid')));
    setCentroText('cfPendingIncomeTotal', fmtMoney(sum(statusItems(income, 'pending'))));
    setCentroText('cfPendingIncomeCount', countLabel(statusItems(income, 'pending')));
    setCentroText('cfPaidExpenseTotal', fmtMoney(sum(statusItems(expense, 'paid'))));
    setCentroText('cfPaidExpenseCount', countLabel(statusItems(expense, 'paid')));
    setCentroText('cfPendingExpenseTotal', fmtMoney(sum(statusItems(expense, 'pending'))));
    setCentroText('cfPendingExpenseCount', countLabel(statusItems(expense, 'pending')));
    setCentroText('cfRecurringTotal', fmtMoney(sum(recurring)));
    setCentroText('cfRecurringCount', countLabel(recurring));
    setCentroText('cfPeriodNote', filter.bounds.label + (filter.bounds.invalid ? '' : ` · ${countLabel(transactions)}`));
    setCentroText('cfFlowChartCaption', filter.period === 'all'
      ? 'Fluxo acumulado dos últimos 12 meses; os totais acima consideram todo o histórico.'
      : 'Fluxo acumulado dos lançamentos datados no período selecionado; não representa saldo histórico de conta.');
    const customDates = document.getElementById('cfCustomDates');
    if (customDates) customDates.hidden = filter.period !== 'custom';

    const body = document.getElementById('cfMovementsBody');
    if (body) {
      body.replaceChildren();
      const sorted = [...transactions].sort((a, b) => {
        const dateA = getCentroDate(a.date)?.getTime() || 0;
        const dateB = getCentroDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      });
      sorted.slice(0, 12).forEach((item) => {
        const row = document.createElement('tr');
        const record = item.record || {};
        const action = item.kind === 'receita' ? 'edit-receita' : 'edit-despesa';
        const description = String(record.descricao || 'Sem descrição');
        row.innerHTML = `<td><span class="cf-kind-badge ${item.kind}">${item.kind === 'receita' ? 'Receita' : 'Despesa'}</span></td><td><button type="button" class="cf-row-action" data-action="${action}" data-index="${item.index}"></button></td><td class="cf-row-category"></td><td class="cf-row-date"></td><td><span class="cf-status-badge ${item.status}">${item.status === 'paid' ? (item.kind === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}</span></td><td class="numeric ${item.kind === 'receita' ? 'positive' : 'negative'}"></td>`;
        row.querySelector('.cf-row-action').textContent = description;
        row.querySelector('.cf-row-category').textContent = item.category;
        row.querySelector('.cf-row-date').textContent = fmtDateBR(item.date) || '—';
        row.querySelector('.numeric').textContent = `${item.kind === 'receita' ? '+' : '−'} ${fmtMoney(item.amount)}`;
        body.appendChild(row);
      });
      if (!sorted.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td class="cf-empty-row" colspan="6"></td>';
        row.querySelector('.cf-empty-row').textContent = filter.bounds.invalid
          ? 'Revise o período personalizado para consultar os lançamentos.'
          : 'Nenhuma movimentação encontrada para os filtros selecionados.';
        body.appendChild(row);
      }
      setCentroText('cfMovementCount', `${countLabel(sorted)} · exibindo ${Math.min(sorted.length, 12)} mais recentes`);
    }

    renderCentroFlowChart(filter);
    renderCentroDistribution(filter);
  }

  window.updateCentroFinanceiro = updateCentroFinanceiro;

  // Fallback: se prisma-finance-engine.js carregar depois deste script (race defer),
  // mescla os métodos de IA no window.PrismaFinance ao inicializar o DOM.
  function _mergePrismaEngineIfNeeded() {
    const AI_METHODS = [
      'analyzeFinances', 'generateRecommendations', 'calculateConsolidatedSavings',
      'filterTransactionsByPeriod', 'classifyExpense',
      'detectRecurringAndSubscriptions', 'detectAtypicalAndDuplicates',
      'computeNetWorth', 'transferAccounts', 'groupInvestmentsByCategory'
    ];
    if (typeof window.PrismaFinance === 'object' && window.PrismaFinance &&
        typeof window.PrismaFinance.analyzeFinances !== 'function') {
      // Tenta encontrar o engine pelo objeto global direto
      const eng = window.PrismaFinance;
      AI_METHODS.forEach(m => {
        if (typeof eng[m] === 'function' && typeof PrismaFinance[m] !== 'function') {
          PrismaFinance[m] = eng[m].bind(eng);
        }
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _mergePrismaEngineIfNeeded);
  } else {
    _mergePrismaEngineIfNeeded();
  }

  function updateCentroFinanceiro() {
    const el = document.getElementById('centroFinanceiro');
    if (!el) return;
    const ctx = buildFinanceContext();
    const band = PrismaFinance.scoreBand(ctx.score);
    const setTxt = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };

    setTxt('cfScoreValue', String(ctx.score));
    setTxt('cfScoreLabel', band.label);
    setTxt('cfScoreCaption', 'Prisma Financial Score · ' + band.label);
    const arc = document.getElementById('cfScoreArc');
    if (arc) {
      const circ = 2 * Math.PI * 42;
      const filled = (ctx.score / 100) * circ;
      arc.setAttribute('stroke', band.color);
      arc.setAttribute('stroke-dasharray', filled.toFixed(1) + ' ' + circ.toFixed(1));
    }
    const scoreInner = document.querySelector('.cf-score-inner strong');
    if (scoreInner) scoreInner.style.color = band.color;

    setTxt('cfNetWorth', fmtMoney(ctx.netWorth));
    setTxt('cfAssets', fmtMoney(ctx.assets));
    setTxt('cfLiabilities', fmtMoney(ctx.liabilities));
    setTxt('cfInvested', fmtMoney(ctx.inv.atual) + (ctx.inv.aplicado > 0 ? ' (' + (ctx.inv.rent >= 0 ? '+' : '') + ctx.inv.rent.toFixed(1) + '%)' : ''));
    setTxt('cfSavingsRate', ctx.sr == null ? '—' : (ctx.sr >= 0 ? '+' : '') + ctx.sr.toFixed(1) + '%');
    setTxt('cfCashFlow', fmtMoney(ctx.cashFlow));

    // Health items (sempre a partir do mesmo ctx)
    const health = [];
    // Reserva: liquidez (contas ou fluxo) / despesa
    const reserveBase = (ctx.contasTotal > 0 ? ctx.contasTotal : Math.max(0, ctx.cashFlow));
    const monthsReserve = ctx.exp > 0 ? reserveBase / ctx.exp : null;
    if (monthsReserve == null || !(ctx.exp > 0)) health.push({ label: 'Reserva (aprox.)', value: 'Sem dados', status: '—', cls: 'warn' });
    else if (monthsReserve >= 6) health.push({ label: 'Reserva (aprox.)', value: monthsReserve.toFixed(1) + ' meses', status: '🟢 Saudável', cls: 'ok' });
    else if (monthsReserve >= 3) health.push({ label: 'Reserva (aprox.)', value: monthsReserve.toFixed(1) + ' meses', status: '🟡 Atenção', cls: 'warn' });
    else health.push({ label: 'Reserva (aprox.)', value: monthsReserve.toFixed(1) + ' meses', status: '🔴 Crítico', cls: 'crit' });

    if (ctx.sr == null) health.push({ label: 'Poupança', value: '—', status: 'Sem receitas', cls: 'warn' });
    else if (ctx.sr >= 20) health.push({ label: 'Poupança', value: ctx.sr.toFixed(1) + '%', status: '🟢 Saudável', cls: 'ok' });
    else if (ctx.sr >= 10) health.push({ label: 'Poupança', value: ctx.sr.toFixed(1) + '%', status: '🟡 Atenção', cls: 'warn' });
    else health.push({ label: 'Poupança', value: ctx.sr.toFixed(1) + '%', status: '🔴 Crítico', cls: 'crit' });

    const nCards = (ctx.cardUtil && ctx.cardUtil.limit > 0) || (ctx.liabilities > 0) || (Array.isArray(cartoes) && cartoes.length > 0);
    if (ctx.cardUtil.pct == null && !nCards) health.push({ label: 'Cartão', value: '—', status: 'Sem cartões', cls: 'warn' });
    else if (ctx.cardUtil.pct == null && nCards) health.push({ label: 'Cartão', value: fmtMoney(ctx.liabilities), status: 'Fatura / utilizado', cls: 'warn' });
    else if (ctx.cardUtil.pct < 30) health.push({ label: 'Utilização cartão', value: ctx.cardUtil.pct.toFixed(0) + '%', status: '🟢 Saudável', cls: 'ok' });
    else if (ctx.cardUtil.pct < 70) health.push({ label: 'Utilização cartão', value: ctx.cardUtil.pct.toFixed(0) + '%', status: '🟡 Atenção', cls: 'warn' });
    else health.push({ label: 'Utilização cartão', value: ctx.cardUtil.pct.toFixed(0) + '%', status: '🔴 Crítico', cls: 'crit' });

    if (ctx.inv.atual <= 0) health.push({ label: 'Investimentos', value: 'Sem posições', status: '🟡 Atenção', cls: 'warn' });
    else if (ctx.investClasses >= 3) health.push({ label: 'Diversificação', value: ctx.investClasses + ' classes', status: '🟢 Saudável', cls: 'ok' });
    else if (ctx.investClasses >= 2) health.push({ label: 'Diversificação', value: ctx.investClasses + ' classes', status: '🟡 Atenção', cls: 'warn' });
    else health.push({ label: 'Diversificação', value: '1 classe', status: '🔴 Concentrado', cls: 'crit' });

    if (ctx.goalsP.n === 0) health.push({ label: 'Metas', value: 'Nenhuma', status: '—', cls: 'warn' });
    else health.push({ label: 'Metas', value: ctx.goalsP.pct.toFixed(0) + '%', status: ctx.goalsP.pct >= 50 ? '🟢 No caminho' : '🟡 Em andamento', cls: ctx.goalsP.pct >= 50 ? 'ok' : 'warn' });

    const hg = document.getElementById('cfHealthGrid');
    if (hg) {
      hg.innerHTML = health.map((h) => `
        <div class="cf-health-item ${h.cls}">
          <div class="ch-label">${h.label}</div>
          <div class="ch-value">${h.value}</div>
          <div class="ch-status">${h.status}</div>
        </div>
      `).join('');
    }

    const gs = document.getElementById('cfGoalsSummary');
    if (gs) {
      gs.innerHTML = ctx.goalsP.n
        ? `<strong>${ctx.goalsP.n}</strong> meta(s) · ${fmtMoney(ctx.goalsP.current)} de ${fmtMoney(ctx.goalsP.target)} (${ctx.goalsP.pct.toFixed(0)}%)<br>Falta ${fmtMoney(ctx.goalsP.remaining)}`
        : 'Cadastre metas na seção Metas para acompanhar o progresso aqui.';
    }
    const es = document.getElementById('cfEduSummary');
    if (es) {
      es.innerHTML = `<strong>${ctx.eduPoints} XP</strong> · ${ctx.eduCompleted} trilha(s) · ${ctx.eduQuizzes} quiz(zes)<br>Continue em Educação Financeira.`;
    }

    // AI insights from real data only
    const insights = [];
    if (ctx.sr != null && ctx.sr < 10 && ctx.inc > 0) insights.push('Taxa de poupança abaixo de 10% neste período com base nas receitas e despesas cadastradas.');
    if (ctx.cardUtil.pct != null && ctx.cardUtil.pct >= 80) insights.push('Utilização de cartão ≥ 80% do limite cadastrado — monitore a fatura.');
    if (ctx.cashFlow < 0) insights.push('Despesas superam receitas no consolidado atual. Priorize o equilíbrio do orçamento.');
    if (ctx.inv.atual > 0 && ctx.investClasses <= 1) insights.push('Carteira concentrada em poucas classes de ativos (dados da sua carteira).');
    if (ctx.goalsP.n && ctx.goalsP.pct < 30) insights.push('Metas ainda no início do progresso — considere revisar aportes mensais.');
    if (!insights.length) insights.push(ctx.inc || ctx.exp || ctx.inv.atual
      ? 'Dados carregados. Continue registrando movimentos para insights mais precisos.'
      : 'Cadastre receitas, despesas ou investimentos para gerar insights personalizados.');
    const ai = document.getElementById('cfAiInsights');
    if (ai) ai.innerHTML = insights.map((i) => `<div class="cf-insight-line">${i}</div>`).join('');
    renderCentroOverview();
  }

  function runCentroSimulacao() {
    const ctx = buildFinanceContext();
    const aporte = typeof parseMoneyInput === 'function'
      ? (parseMoneyInput(document.getElementById('cfSimAporte')?.value) || 0)
      : parseFloat(String(document.getElementById('cfSimAporte')?.value || '0').replace(',', '.')) || 0;
    const prazo = parseInt(document.getElementById('cfSimPrazo')?.value, 10) || 60;
    const taxa = parseFloat(document.getElementById('cfSimTaxa')?.value) || 8;
    const base = ctx.netWorth > 0 ? ctx.netWorth : ctx.inv.atual;
    const cons = PrismaFinance.projectCompound(base, aporte, prazo, Math.max(0, taxa - 3));
    const mid = PrismaFinance.projectCompound(base, aporte, prazo, taxa);
    const otim = PrismaFinance.projectCompound(base, aporte, prazo, taxa + 3);
    const el = document.getElementById('cfSimResults');
    if (el) {
      el.innerHTML = `
        <div>Conservador: <strong>${fmtMoney(cons)}</strong></div>
        <div>Base: <strong>${fmtMoney(mid)}</strong></div>
        <div>Otimista: <strong>${fmtMoney(otim)}</strong></div>
      `;
    }
  }

  // Init Centro Financeiro como seção independente
  let cfModalOpener = null;
  function closeCentroModal(modal, restoreFocus = true) {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (restoreFocus && cfModalOpener && document.contains(cfModalOpener)) cfModalOpener.focus();
    cfModalOpener = null;
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const opener = target.closest('[data-cf-open]');
    if (opener) {
      const modal = document.getElementById(opener.getAttribute('data-cf-open'));
      if (!modal || !modal.classList.contains('cf-modal-overlay')) return;
      event.preventDefault();
      document.querySelectorAll('.cf-modal-overlay.show').forEach((openModal) => closeCentroModal(openModal, false));
      cfModalOpener = opener;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      renderCentroOverview();
      if (typeof refreshIcons === 'function') refreshIcons();
      modal.querySelector('[data-cf-close]')?.focus();
      return;
    }

    const closeButton = target.closest('[data-cf-close]');
    if (closeButton) {
      closeCentroModal(closeButton.closest('.cf-modal-overlay'));
      return;
    }

    const backdrop = target.closest('.cf-modal-overlay');
    if (backdrop && target === backdrop) closeCentroModal(backdrop);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openModal = document.querySelector('.cf-modal-overlay.show');
    if (openModal) closeCentroModal(openModal);
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const sectionLink = target?.closest('.cf-modal-overlay [data-section]');
    if (sectionLink) closeCentroModal(sectionLink.closest('.cf-modal-overlay'), false);
  }, true);

  ['cfPeriodFilter', 'cfCategoryFilter', 'cfTypeFilter', 'cfStatusFilter', 'cfDateFrom', 'cfDateTo'].forEach((id) => {
    const filter = document.getElementById(id);
    if (filter) filter.addEventListener('change', renderCentroOverview);
  });
  const cfClearFilters = document.getElementById('cfClearFilters');
  if (cfClearFilters) cfClearFilters.addEventListener('click', () => {
    const defaults = { cfPeriodFilter: 'month', cfCategoryFilter: '', cfTypeFilter: 'all', cfStatusFilter: '' };
    Object.entries(defaults).forEach(([id, value]) => {
      const filter = document.getElementById(id);
      if (filter) filter.value = value;
    });
    const statusFilter = document.getElementById('cfStatusFilter');
    if (statusFilter) statusFilter.value = 'all';
    const from = document.getElementById('cfDateFrom');
    const to = document.getElementById('cfDateTo');
    if (from) from.value = '';
    if (to) to.value = '';
    renderCentroOverview();
  });
  const cfShowExpenses = document.getElementById('cfShowExpenses');
  const cfShowIncome = document.getElementById('cfShowIncome');
  if (cfShowExpenses) cfShowExpenses.addEventListener('click', () => {
    cfDistributionType = 'despesa';
    cfShowExpenses.classList.add('active');
    cfShowExpenses.setAttribute('aria-pressed', 'true');
    cfShowIncome?.classList.remove('active');
    cfShowIncome?.setAttribute('aria-pressed', 'false');
    renderCentroOverview();
  });
  if (cfShowIncome) cfShowIncome.addEventListener('click', () => {
    cfDistributionType = 'receita';
    cfShowIncome.classList.add('active');
    cfShowIncome.setAttribute('aria-pressed', 'true');
    cfShowExpenses?.classList.remove('active');
    cfShowExpenses?.setAttribute('aria-pressed', 'false');
    renderCentroOverview();
  });
  const cfSimBtnEl = document.getElementById('cfSimBtn');
  if (cfSimBtnEl) cfSimBtnEl.addEventListener('click', runCentroSimulacao);
  ['cfSimAporte', 'cfSimPrazo', 'cfSimTaxa'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', runCentroSimulacao);
  });

  // O Centro Financeiro agora é uma aba própria; não ocupa mais o Dashboard.
  const navCF = document.getElementById('navCentroFinanceiro');
  if (navCF) navCF.addEventListener('click', () => {
    setTimeout(() => {
      try { updateCentroFinanceiro(); } catch (err) { console.warn('Centro financeiro:', err); }
      try { runCentroSimulacao(); } catch (_) {}
      if (typeof refreshIcons === 'function') refreshIcons();
    }, 0);
  });

  // Atalho do insight do Dashboard: navega para a aba dedicada.
  const insightBtn = document.getElementById('dashInsightOpenCf');
  if (insightBtn) insightBtn.addEventListener('click', () => {
    const n = document.getElementById('navCentroFinanceiro');
    if (n) n.click();
  });

  // Dashboard quick actions + greeting
  const AUTH_USER_KEY = 'prisma_current_user';

  function persistAuthenticatedUser(userLike) {
    if (!userLike) return;
    const name = String(userLike.name || userLike.nome || userLike.fullName || '').trim();
    const email = String(userLike.email || '').trim();
    const id = userLike.id || userLike.userId || null;
    if (!name && !email) return;
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
        id,
        name: name || null,
        email: email || null,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  /** Fonte única: currentProfile → sessão salva → lista de perfis → userData legado */
  function resolveAuthenticatedUser() {
    let name = '';
    let email = '';
    let id = null;

    try {
      if (typeof currentProfile !== 'undefined' && currentProfile) {
        name = String(currentProfile.name || '').trim();
        email = String(currentProfile.email || '').trim();
        id = currentProfile.id || null;
      }
    } catch (_) {}

    if (!name || !email) {
      try {
        const u = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
        if (u) {
          if (!name) name = String(u.name || '').trim();
          if (!email) email = String(u.email || '').trim();
          if (!id) id = u.id || null;
        }
      } catch (_) {}
    }

    if (!name || !email) {
      try {
        const pid = (typeof currentProfileId !== 'undefined' && currentProfileId)
          ? currentProfileId
          : (localStorage.getItem('prisma_current_profile_id') || null);
        const list = (typeof profiles !== 'undefined' && Array.isArray(profiles))
          ? profiles
          : JSON.parse(localStorage.getItem('prisma_profiles_data') || '[]');
        const p = Array.isArray(list) ? list.find((x) => String(x.id) === String(pid)) : null;
        if (p) {
          if (!name) name = String(p.name || '').trim();
          if (!email) email = String(p.email || '').trim();
          if (!id) id = p.id || null;
        }
      } catch (_) {}
    }

    if (!name || !email) {
      try {
        const ud = JSON.parse(localStorage.getItem('prisma_user_data') || 'null');
        if (ud) {
          if (!name) name = String(ud.name || ud.nome || '').trim();
          if (!email) email = String(ud.email || '').trim();
        }
      } catch (_) {}
    }

    // Ignore placeholder/demo labels
    const invalid = /^(usu[aá]rio(\s+teste)?|user(\s+test)?|admin|teste|undefined|null|-)$/i;
    if (name && invalid.test(name)) name = '';
    if (email && /^(teste@example\.com|test@test\.com|user@example\.com)$/i.test(email)) {
      // only clear if we have no better source already tried — still allow if it's the real account
      /* keep email if stored intentionally */
    }

    return {
      id,
      name: name || '',
      email: email || '',
      displayName: name || 'Usuário'
    };
  }

  function syncAuthenticatedUserUI() {
    const user = resolveAuthenticatedUser();
    const realName = (user.name || '').trim();
    const firstName = realName ? realName.split(/\s+/)[0] : '';
    // Navbar: prefer real name; avoid generic "Usuário" when possible
    const navLabel = firstName || realName || user.displayName || 'Conta';

    const navName = document.getElementById('navbarUserName');
    if (navName) {
      navName.textContent = navLabel;
      navName.title = realName || user.email || navLabel;
    }
    const ddName = document.getElementById('dropdownProfileName');
    if (ddName) ddName.textContent = realName || navLabel;
    const ddEmail = document.getElementById('dropdownProfileEmail');
    if (ddEmail) ddEmail.textContent = user.email || '—';

    // Dashboard: "Bem-vindo, [Nome]"
    const welcome = document.getElementById('dashWelcomeTitle');
    if (welcome) {
      welcome.textContent = firstName
        ? ('Bem-vindo, ' + firstName)
        : (realName ? ('Bem-vindo, ' + realName) : 'Bem-vindo');
    }

    if (user.name || user.email) {
      persistAuthenticatedUser(user);
    }
  }

  // Re-sync after profile/session may load asynchronously
  setTimeout(syncAuthenticatedUserUI, 300);
  setTimeout(syncAuthenticatedUserUI, 1200);

  /* ========== BUSCA GLOBAL ========== */
  (function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const box = document.getElementById('globalSearchBox');
    const resultsEl = document.getElementById('globalSearchResults');
    const clearBtn = document.getElementById('globalSearchClear');
    if (!input || !resultsEl) return;

    let debounceTimer = null;
    const MAX_PER_GROUP = 5;

    function money(v) {
      try {
        if (typeof fmtMoney === 'function') return fmtMoney(v);
        if (typeof formatCurrency === 'function') return formatCurrency(v);
      } catch (_) {}
      return String(v ?? '');
    }

    function norm(s) {
      return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function match(q, ...fields) {
      if (!q) return false;
      return fields.some((f) => norm(f).includes(q));
    }

    function goSection(sectionId) {
      const nav = document.querySelector('[data-section="' + sectionId + '"]');
      if (nav) nav.click();
      else {
        document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
        const sec = document.getElementById(sectionId);
        if (sec) sec.classList.add('active');
      }
    }

    function collectResults(query) {
      const q = norm(query.trim());
      if (q.length < 2) return [];
      const groups = [];

      // Receitas
      const receitasHits = [];
      (Array.isArray(receitas) ? receitas : []).forEach((r, i) => {
        if (match(q, r.descricao, r.origem, r.categoria, r.conta, r.valor)) {
          receitasHits.push({
            group: 'Receitas',
            icon: 'trending-up',
            title: r.descricao || r.origem || 'Receita',
            meta: (r.origem || r.categoria || '') + (r.data ? ' · ' + r.data : ''),
            value: money(r.valor),
            section: 'receitas',
            index: i
          });
        }
      });
      if (receitasHits.length) groups.push({ title: 'Receitas', items: receitasHits.slice(0, MAX_PER_GROUP) });

      // Despesas
      const despHits = [];
      (Array.isArray(despesas) ? despesas : []).forEach((d, i) => {
        if (match(q, d.descricao, d.categoria, d.conta, d.formaPagamento, d.valor)) {
          despHits.push({
            group: 'Despesas',
            icon: 'trending-down',
            title: d.descricao || d.categoria || 'Despesa',
            meta: (d.categoria || '') + (d.data ? ' · ' + d.data : ''),
            value: money(d.valor),
            section: 'despesas',
            index: i
          });
        }
      });
      if (despHits.length) groups.push({ title: 'Despesas', items: despHits.slice(0, MAX_PER_GROUP) });

      // Contas
      const contaHits = [];
      (Array.isArray(contas) ? contas : []).forEach((c, i) => {
        if (match(q, c.nome, c.banco, c.institutionName, c.numero, c.institutionId, c.tipoLabel, c.tipo)) {
          contaHits.push({
            group: 'Contas',
            icon: 'landmark',
            title: c.nome || c.banco || 'Conta',
            meta: (c.banco || c.institutionName || '') + (c.source === 'openfinance' ? ' · Open Finance' : ''),
            value: money(c.saldo),
            section: 'contas',
            index: i
          });
        }
      });
      if (contaHits.length) groups.push({ title: 'Contas', items: contaHits.slice(0, MAX_PER_GROUP) });

      // Cartões
      const cardHits = [];
      (Array.isArray(cartoes) ? cartoes : []).forEach((c, i) => {
        if (match(q, c.titular, c.banco, c.numero, c.estilo)) {
          cardHits.push({
            group: 'Cartões',
            icon: 'credit-card',
            title: (c.banco || 'Cartão') + (c.numero ? ' •••• ' + String(c.numero).slice(-4) : ''),
            meta: c.titular || '',
            value: c.limite != null ? ('Limite ' + money(c.limite)) : '',
            section: 'cartoes',
            index: i
          });
        }
      });
      if (cardHits.length) groups.push({ title: 'Cartões', items: cardHits.slice(0, MAX_PER_GROUP) });

      // Metas
      const metaHits = [];
      (Array.isArray(goals) ? goals : []).forEach((g, i) => {
        if (match(q, g.name, g.nome, g.target, g.current)) {
          metaHits.push({
            group: 'Metas',
            icon: 'target',
            title: g.name || g.nome || 'Meta',
            meta: 'Objetivo ' + money(g.target != null ? g.target : g.alvo),
            value: money(g.current != null ? g.current : g.atual),
            section: 'metas',
            index: i
          });
        }
      });
      if (metaHits.length) groups.push({ title: 'Metas', items: metaHits.slice(0, MAX_PER_GROUP) });

      // Investimentos
      const invHits = [];
      (Array.isArray(investimentos) ? investimentos : []).forEach((inv, i) => {
        if (match(q, inv.nome, inv.ticker, inv.tipo, inv.instituicao, inv.categoria)) {
          const val = (typeof getInvestValorAtual === 'function')
            ? getInvestValorAtual(inv)
            : (inv.valorAtual || inv.valorAplicado || inv.valor || 0);
          invHits.push({
            group: 'Investimentos',
            icon: 'line-chart',
            title: inv.nome || inv.ticker || 'Investimento',
            meta: (inv.ticker ? inv.ticker + ' · ' : '') + (inv.tipo || inv.instituicao || ''),
            value: money(val),
            section: 'investimentos',
            index: i
          });
        }
      });
      if (invHits.length) groups.push({ title: 'Investimentos', items: invHits.slice(0, MAX_PER_GROUP) });

      // Categorias (despesas agregadas)
      try {
        if (Array.isArray(categories) && categories.length) {
          const catHits = [];
          categories.forEach((cat) => {
            if (match(q, cat.name, cat.nome)) {
              catHits.push({
                group: 'Categorias',
                icon: 'tags',
                title: cat.name || cat.nome,
                meta: 'Categoria de despesas',
                value: money(cat.value || cat.total || 0),
                section: 'despesas',
                index: -1
              });
            }
          });
          if (catHits.length) groups.push({ title: 'Categorias', items: catHits.slice(0, MAX_PER_GROUP) });
        }
      } catch (_) {}

      return groups;
    }

    function renderResults(groups, query) {
      if (!query.trim()) {
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
        return;
      }
      if (!groups.length) {
        const emptyMsg = 'Nenhum resultado encontrado.';
        resultsEl.innerHTML = '<div class="gsr-empty">' + emptyMsg + '</div>';
        resultsEl.hidden = false;
        return;
      }
      let html = '';
      groups.forEach((g) => {
        html += '<div class="gsr-group"><div class="gsr-group-title">' + escapeHtml(g.title) + '</div>';
        g.items.forEach((item, idx) => {
          html += '<button type="button" class="gsr-item" data-section="' + escapeHtml(item.section) + '" data-g="' + escapeHtml(g.title) + '" data-i="' + idx + '">' +
            '<span class="gsr-item-icon"><i data-lucide="' + item.icon + '"></i></span>' +
            '<span class="gsr-item-body"><span class="gsr-item-title">' + escapeHtml(item.title) + '</span>' +
            '<span class="gsr-item-meta">' + escapeHtml(item.meta || '') + '</span></span>' +
            (item.value ? '<span class="gsr-item-value">' + escapeHtml(item.value) + '</span>' : '') +
            '</button>';
        });
        html += '</div>';
      });
      const footer = 'Busca nos seus dados';
      html += '<div class="gsr-footer">' + footer + '</div>';
      resultsEl.innerHTML = html;
      resultsEl.hidden = false;
      // store for click handlers
      resultsEl._groups = groups;
      if (typeof refreshIcons === 'function') refreshIcons();
    }

    function runSearch() {
      const q = input.value || '';
      if (clearBtn) clearBtn.hidden = !q.trim();
      const groups = collectResults(q);
      renderResults(groups, q);
    }

    function clearSearch() {
      input.value = '';
      if (clearBtn) clearBtn.hidden = true;
      resultsEl.hidden = true;
      resultsEl.innerHTML = '';
      resultsEl._groups = null;
      input.focus();
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 120);
    });
    input.addEventListener('focus', () => {
      if ((input.value || '').trim()) runSearch();
    });
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSearch();
    });

    resultsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.gsr-item');
      if (!btn) return;
      const section = btn.dataset.section;
      clearSearch();
      if (section) goSection(section);
    });

    document.addEventListener('click', (e) => {
      if (!box) return;
      if (!box.contains(e.target)) {
        resultsEl.hidden = true;
      }
    });

    // Atalho ⌘K / Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === 'Escape' && document.activeElement === input) {
        clearSearch();
        input.blur();
      }
    });
  })();



  function recalculateAll() {
    receitas = Array.isArray(receitas) ? receitas : [];
    despesas = Array.isArray(despesas) ? despesas : [];
    contas = Array.isArray(contas) ? contas : [];
    cartoes = Array.isArray(cartoes) ? cartoes : [];
    investimentos = Array.isArray(investimentos) ? investimentos : [];
    goals = Array.isArray(goals) ? goals : [];

    bumpFinanceDataVersion();

    // Persistência em lote (localStorage) — não bloqueia a UI
    schedulePersistFinance();

    if (typeof rebuildCashflowFromTransactions === 'function') rebuildCashflowFromTransactions();

    // Totais rápidos em memória (UI imediata); detalhe fino vem do buildFinanceContext
    receitasMes = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    despesasMes = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
    economiaMes = receitasMes - despesasMes;
    summaryData = { saldoAtual: economiaMes, salarioMensal: salarioMensal || 0 };
    saldoAtual = summaryData.saldoAtual;

    // Um único contexto para Dashboard + Centro Financeiro (cache)
    let ctx = null;
    try { ctx = buildFinanceContext(); } catch (_) { ctx = null; }

    const active = getActiveSectionId();
    const need = (id) => !active || active === id || active === 'dashboard' || __sectionDirty[id];

    // KPI dashboard: barato e sempre atualizado (números no header do app)
    try { updateDashboardCards(); } catch (_) {}
    if (active === 'centro-financeiro' || __sectionDirty['centro-financeiro']) {
      try { updateCentroFinanceiro(); } catch (err) { console.warn('Centro financeiro:', err); }
      __sectionDirty['centro-financeiro'] = false;
    }

    // Listas: só re-render da seção ativa (ou se ainda dirty e usuário navegar depois)
    if (need('receitas')) { try { renderReceitas(); } catch (_) {} __sectionDirty.receitas = false; }
    if (need('despesas')) { try { renderDespesas(); } catch (_) {} __sectionDirty.despesas = false; }
    if (need('contas')) { try { renderContas(); } catch (_) {} __sectionDirty.contas = false; }
    if (need('cartoes')) { try { renderCartoes(); } catch (_) {} __sectionDirty.cartoes = false; }
    if (need('investimentos') || need('carteira-ativos')) {
      try { renderInvestimentos(); } catch (_) {}
      __sectionDirty.investimentos = false;
      __sectionDirty['carteira-ativos'] = false;
    }
    if (need('metas')) { try { renderGoals(); } catch (_) {} __sectionDirty.metas = false; }

    if (active === 'dashboard' || !active) {
      try { renderDashboardTransactions(); } catch (_) {}
      __sectionDirty.dashboard = false;
    }

    if (window.PrismaEnhancements && typeof window.PrismaEnhancements.updateDashboardEmpty === 'function') {
      try { window.PrismaEnhancements.updateDashboardEmpty(); } catch (_) {}
    }
    if (typeof updateCurrentProfileUI === 'function') {
      try { updateCurrentProfileUI(); } catch (_) {}
    }
    // Perfis: só se a seção de dados estiver ativa (evita reflow pesado a cada lançamento)
    if (active === 'dados' && typeof renderProfiles === 'function') {
      try { renderProfiles(); } catch (_) {}
    }

    if (typeof refreshIcons === 'function') refreshIcons();

    try { rebuildExpenseCategoriesFromData(); } catch (_) {}
    try { rebuildIncomeCategoriesFromData(); } catch (_) {}
    try { if (typeof updatePieChart === 'function') updatePieChart(); } catch (_) {}
    try { if (typeof updateIncomePieChart === 'function') updateIncomePieChart(); } catch (_) {}
  }

  // Ao trocar de seção, materializa renders adiados (dirty)
  document.querySelectorAll('.nav-item[data-section]').forEach((nav) => {
    if (nav.dataset.financeDirtyBound === '1') return;
    nav.dataset.financeDirtyBound = '1';
    nav.addEventListener('click', () => {
      const id = nav.getAttribute('data-section');
      setTimeout(() => {
        try {
          if (id === 'receitas' && __sectionDirty.receitas && typeof renderReceitas === 'function') { renderReceitas(); __sectionDirty.receitas = false; }
          if (id === 'despesas' && __sectionDirty.despesas && typeof renderDespesas === 'function') { renderDespesas(); __sectionDirty.despesas = false; }
          if (id === 'contas' && __sectionDirty.contas && typeof renderContas === 'function') { renderContas(); __sectionDirty.contas = false; }
          if (id === 'cartoes' && __sectionDirty.cartoes && typeof renderCartoes === 'function') { renderCartoes(); __sectionDirty.cartoes = false; }
          if ((id === 'investimentos' || id === 'carteira-ativos') && (__sectionDirty.investimentos || __sectionDirty['carteira-ativos']) && typeof renderInvestimentos === 'function') {
            renderInvestimentos();
            __sectionDirty.investimentos = false;
            __sectionDirty['carteira-ativos'] = false;
          }
          if (id === 'metas' && __sectionDirty.metas && typeof renderGoals === 'function') { renderGoals(); __sectionDirty.metas = false; }
          if (id === 'dashboard' && __sectionDirty.dashboard) {
            if (typeof renderDashboardTransactions === 'function') renderDashboardTransactions();
            if (typeof updateDashboardCards === 'function') updateDashboardCards();
            __sectionDirty.dashboard = false;
          }
          if (id === 'centro-financeiro' && __sectionDirty['centro-financeiro'] && typeof updateCentroFinanceiro === 'function') {
            updateCentroFinanceiro();
            __sectionDirty['centro-financeiro'] = false;
          }
          if (typeof refreshIcons === 'function') refreshIcons();
        } catch (e) { console.warn('Lazy section render:', e); }
      }, 0);
    });
  });



  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function formatPercent(value, digits = 0) {
    if (!Number.isFinite(value)) return '0%';
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  }

  function getMonthlyTransactionsForDate(dateValue) {
    const date = dateValue ? new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T00:00:00`) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const isSameMonth = (value) => {
      const d = new Date(String(value || '').includes('T') ? value : `${value || ''}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    };
    return {
      receitas: receitas.filter(r => isSameMonth(r.data)),
      despesas: despesas.filter(d => isSameMonth(d.data)),
    };
  }

  function addMonthsToDate(dateValue, months) {
    const d = new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T00:00:00`);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function formatMonthYear(date) {
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  }

  function getEducationTopicForExpense(expense, metrics) {
    const category = String(expense.categoria || '').toLowerCase();
    if (expense.parcelado || expense.tipoPagamento === 'parcelado') return {
      title: 'Crédito e parcelamento',
      moduleId: 'cartao-credito',
      why: 'Uma parcela parece pequena quando vista isoladamente, mas cada parcela ocupa parte da sua renda futura. Acompanhar o total comprometido ajuda a preservar margem para imprevistos e objetivos.',
      next: 'Aprenda a diferenciar o valor da parcela do compromisso total e observe como ele se acumula com outras compras.'
    };
    if (metrics.deficitAfter) return {
      title: 'Orçamento e déficit',
      moduleId: 'orcamento-inteligente',
      why: 'Quando as despesas superam as receitas, a diferença precisa vir de alguma fonte de recurso. Entender isso cedo ajuda a evitar que o déficit se transforme em dívida.',
      next: 'Compare suas despesas recorrentes com a renda e procure entender quais categorias mais pressionam seu orçamento.'
    };
    if (category.includes('reserva') || category.includes('emergência') || category.includes('emergencia')) return {
      title: 'Reserva de emergência',
      moduleId: 'reserva-emergencia',
      why: 'Uma reserva cria uma margem para lidar com imprevistos sem depender imediatamente de crédito ou empréstimos.',
      next: 'Observe quanto consegue separar mensalmente e transforme esse valor em uma meta possível.'
    };
    return {
      title: 'Orçamento inteligente',
      moduleId: 'orcamento-inteligente',
      why: 'Conhecer quanto cada decisão consome da sua renda torna o orçamento mais concreto e ajuda a equilibrar necessidades, desejos e objetivos.',
      next: 'Use esta informação para acompanhar as categorias que mais consomem sua renda e identificar oportunidades de ajuste sem culpa.'
    };
  }

  function getContextualExpenseAnalysis(expense) {
    const date = expense.data || new Date().toISOString().slice(0, 10);
    const monthly = getMonthlyTransactionsForDate(date);
    const monthlyIncome = monthly.receitas.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    const monthlyExpenses = monthly.despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
    const expenseValue = Number(expense.valor) || 0;
    const beforeExpenses = Math.max(0, monthlyExpenses - expenseValue);
    const afterIncomeMargin = monthlyIncome - monthlyExpenses;
    const expenseShare = monthlyIncome > 0 ? (expenseValue / monthlyIncome) * 100 : null;
    const commitmentAfter = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : null;
    const savingsBefore = monthlyIncome - beforeExpenses;
    const savingsAfter = afterIncomeMargin;
    const deficitAfter = monthlyIncome > 0 && afterIncomeMargin < 0;
    const noIncome = monthlyIncome <= 0;

    let level = 'info';
    if (noIncome) {
      level = monthly.despesas.length >= 2 ? 'alert' : 'attention';
    } else if (deficitAfter || commitmentAfter >= 100) {
      level = 'alert';
    } else if (commitmentAfter >= 70) {
      level = 'attention';
    }

    const totalValue = Number(expense.valorTotal) > 0 ? Number(expense.valorTotal) : expenseValue;
    const installments = Number(expense.parcelas) > 1 ? Number(expense.parcelas) : 1;
    const parcelValue = Number(expense.valorParcela) > 0 ? Number(expense.valorParcela) : expenseValue;
    const isParcelled = expense.parcelado === true || expense.tipoPagamento === 'parcelado' || installments > 1;

    return {
      date, monthlyIncome, monthlyExpenses, expenseValue, beforeExpenses,
      expenseShare, commitmentAfter, savingsBefore, savingsAfter, deficitAfter,
      noIncome, level, totalValue, installments, parcelValue, isParcelled,
      topic: null,
    };
  }

  function openContextualEducation(expense) {
    const modal = document.getElementById('contextualEducationModal');
    if (!modal || !expense) return;

    const metrics = getContextualExpenseAnalysis(expense);
    metrics.topic = getEducationTopicForExpense(expense, metrics);
    const levelMap = {
      info: { label: 'NÍVEL 1 · INFORMATIVO', title: 'Entenda o impacto dessa despesa', icon: 'lightbulb' },
      attention: { label: 'NÍVEL 2 · ATENÇÃO', title: 'Atenção ao seu orçamento', icon: 'alert-circle' },
      alert: { label: 'NÍVEL 3 · ALERTA', title: 'Sua situação precisa de atenção', icon: 'triangle-alert' }
    };
    const cfg = levelMap[metrics.level];

    const levelEl = document.getElementById('contextualEducationLevel');
    const titleEl = document.getElementById('contextualEducationTitle');
    const subtitleEl = document.getElementById('contextualEducationSubtitle');
    const iconEl = document.getElementById('contextualEducationIcon');
    const accentEl = document.getElementById('contextualEducationAccent');
    const messageEl = document.getElementById('contextualEducationMessage');
    const impactEl = document.getElementById('contextualImpactGrid');
    const futureEl = document.getElementById('contextualFutureImpact');
    const whyEl = document.getElementById('contextualWhy');
    const nextEl = document.getElementById('contextualNextStep');
    const learnBtn = document.getElementById('contextualLearnBtn');
    const analyzeBtn = document.getElementById('contextualAnalyzeBtn');

    [modal, levelEl, titleEl, subtitleEl, iconEl, accentEl, messageEl, impactEl, futureEl, whyEl, nextEl, learnBtn, analyzeBtn]
      .filter(Boolean).forEach(el => el.classList.remove('level-info', 'level-attention', 'level-alert'));
    [modal, levelEl, titleEl, subtitleEl, iconEl, accentEl, messageEl, impactEl, futureEl, whyEl, nextEl, learnBtn, analyzeBtn]
      .filter(Boolean).forEach(el => el.classList.add(`level-${metrics.level}`));

    if (levelEl) levelEl.textContent = cfg.label;
    if (titleEl) titleEl.textContent = cfg.title;
    if (subtitleEl) subtitleEl.textContent = `Categoria: ${expense.categoria || 'Não informada'} · ${formatCurrency(metrics.expenseValue)}`;
    if (iconEl) iconEl.innerHTML = `<i data-lucide="${cfg.icon}"></i>`;
    if (accentEl) accentEl.className = `contextual-education-accent level-${metrics.level}`;

    let message = '';
    if (metrics.noIncome) {
      const totalExpenses = metrics.monthlyExpenses;
      if (metrics.level === 'alert') {
        message = `<strong>Você já registrou ${formatCurrency(totalExpenses)} em despesas, mas ainda não possui receitas cadastradas.</strong><br>Isso pode significar uso de dinheiro acumulado, crédito, empréstimos ou outra fonte de recursos. Cadastrar suas receitas ajudará o Prisma a interpretar melhor sua situação.`;
      } else {
        message = `<strong>Você ainda não possui nenhuma receita cadastrada.</strong><br>Sem essa informação, o Prisma não consegue calcular quanto esta despesa representa da sua renda. Você pode registrar a despesa normalmente e cadastrar sua principal fonte de renda depois.`;
      }
    } else if (metrics.deficitAfter) {
      message = `<strong>Suas despesas ultrapassaram sua renda neste período.</strong><br>Depois deste lançamento, existe um déficit de <strong>${formatCurrency(Math.abs(metrics.savingsAfter))}</strong>. Se essa diferença for financiada por crédito ou empréstimos, novos custos podem surgir.`;
    } else if (metrics.commitmentAfter >= 70) {
      message = `<strong>Suas despesas já comprometem ${formatPercent(metrics.commitmentAfter)} da sua renda mensal.</strong><br>Isso reduz sua margem para imprevistos e novos objetivos financeiros. A decisão continua sendo sua; o Prisma está mostrando a consequência para que você possa decidir com mais clareza.`;
    } else {
      message = `<strong>Essa despesa representa ${formatPercent(metrics.expenseShare || 0)} da sua renda mensal.</strong><br>Depois deste lançamento, sua margem disponível fica em <strong>${formatCurrency(Math.max(0, metrics.savingsAfter))}</strong>. Quanto maior o percentual da renda comprometido, menor a margem para imprevistos e objetivos.`;
    }
    if (messageEl) messageEl.innerHTML = message;

    const impactCards = [
      { label: 'Impacto desta despesa', value: formatCurrency(metrics.expenseValue), tone: 'neutral' },
      { label: 'Renda mensal', value: metrics.noIncome ? 'Não cadastrada' : formatCurrency(metrics.monthlyIncome), tone: 'neutral' },
      { label: 'Comprometimento após lançamento', value: metrics.noIncome ? 'Indisponível' : formatPercent(metrics.commitmentAfter), tone: metrics.commitmentAfter >= 70 ? 'attention' : 'positive' },
      { label: 'Margem após lançamento', value: metrics.noIncome ? 'Indisponível' : formatCurrency(metrics.savingsAfter), tone: metrics.savingsAfter < 0 ? 'negative' : 'positive' },
    ];
    if (impactEl) impactEl.innerHTML = impactCards.map(card => `<div class="contextual-impact-card ${card.tone}"><span>${card.label}</span><strong>${card.value}</strong></div>`).join('');

    if (metrics.isParcelled && metrics.installments > 1) {
      const months = Math.min(metrics.installments, 8);
      const rows = [];
      for (let i = 1; i <= months; i++) {
        const month = addMonthsToDate(new Date(metrics.date), i - 1);
        rows.push(`<div class="contextual-future-row"><span>${formatMonthYear(month)}</span><strong>${formatCurrency(metrics.parcelValue)}</strong><small>compromisso ${i}/${metrics.installments}</small></div>`);
      }
      futureEl.hidden = false;
      futureEl.innerHTML = `<div class="contextual-future-head"><div><strong>Impacto nos próximos meses</strong><span>Renda comprometida por ${metrics.installments} meses</span></div><strong>${formatCurrency(metrics.totalValue)} no total</strong></div><div class="contextual-future-list">${rows.join('')}</div>${metrics.installments > months ? `<small class="contextual-future-more">+ ${metrics.installments - months} mês(es) além da visualização acima.</small>` : ''}`;
    } else {
      futureEl.hidden = true;
      futureEl.innerHTML = '';
    }

    if (whyEl) whyEl.innerHTML = `<strong>Por que isso importa?</strong><p>${metrics.topic.why}</p>`;
    if (nextEl) nextEl.innerHTML = `<span><i data-lucide="graduation-cap"></i><strong>Próximo passo</strong></span><p>${metrics.topic.next}</p>`;

    if (learnBtn) {
      learnBtn.hidden = false;
      learnBtn.dataset.moduleId = metrics.topic.moduleId;
      learnBtn.innerHTML = `<i data-lucide="book-open"></i> Aprender sobre ${metrics.topic.title}`;
    }
    if (analyzeBtn) {
      analyzeBtn.hidden = metrics.level === 'info';
    }

    const whyToggle = document.getElementById('contextualWhyToggle');
    const why = document.getElementById('contextualWhy');
    if (why) why.hidden = true;
    if (whyToggle) whyToggle.setAttribute('aria-expanded', 'false');

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    refreshIcons();
  }

  function closeContextualEducation() {
    const modal = document.getElementById('contextualEducationModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  const contextualContinueBtn = document.getElementById('contextualContinueBtn');
  const closeContextualEducationBtn = document.getElementById('closeContextualEducation');
  const contextualWhyToggle = document.getElementById('contextualWhyToggle');
  const contextualLearnBtn = document.getElementById('contextualLearnBtn');
  const contextualAnalyzeBtn = document.getElementById('contextualAnalyzeBtn');

  if (contextualContinueBtn) contextualContinueBtn.addEventListener('click', closeContextualEducation);
  if (closeContextualEducationBtn) closeContextualEducationBtn.addEventListener('click', closeContextualEducation);
  if (contextualWhyToggle) contextualWhyToggle.addEventListener('click', () => {
    const why = document.getElementById('contextualWhy');
    if (!why) return;
    why.hidden = !why.hidden;
    contextualWhyToggle.setAttribute('aria-expanded', String(!why.hidden));
  });
  if (contextualLearnBtn) contextualLearnBtn.addEventListener('click', () => {
    const moduleId = contextualLearnBtn.dataset.moduleId;
    closeContextualEducation();
    const nav = document.querySelector('[data-section="educacao-financeira"]');
    if (nav) nav.click();
    setTimeout(() => {
      if (typeof openEducationLesson === 'function' && moduleId) openEducationLesson(moduleId);
    }, 250);
  });
  if (contextualAnalyzeBtn) contextualAnalyzeBtn.addEventListener('click', () => {
    closeContextualEducation();
    const nav = document.querySelector('[data-section="dashboard"]');
    if (nav) nav.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeContextualEducation();
  });
  const contextualEducationModal = document.getElementById('contextualEducationModal');
  if (contextualEducationModal) contextualEducationModal.addEventListener('click', (event) => {
    if (event.target === contextualEducationModal) closeContextualEducation();
  });

  // ==================== MODAL CONTROLLERS ====================

  // ==================== BANK BALANCE HELPERS ====================
  /**
   * FIX P1.6: Auto-adjust the balance of a bank account when a transaction is
   * created, updated, or deleted.
   *
   * @param {string} contaNome - The 'conta' field value from the transaction
   * @param {number} delta     - Positive = credit, Negative = debit
   */
  function adjustContaSaldo(contaNome, delta) {
    if (!contaNome || !delta || !isFinite(delta)) return;
    const name = String(contaNome).trim().toLowerCase();
    if (!name) return;
    // Find the best-matching account
    const conta = (contas || []).find(c =>
      String(c.nome || '').trim().toLowerCase() === name ||
      String(c.banco || '').trim().toLowerCase() === name ||
      String(c.numero || '').trim().toLowerCase() === name
    );
    if (!conta) return; // no matching account — silently skip
    conta.saldo = (parseFloat(conta.saldo) || 0) + delta;
    saveDataStorage(STORAGE_KEYS.contas, contas);
  }


  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('show');
    modalEl.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modalEl, formEl) {
    if (!modalEl) return;
    modalEl.classList.remove('show');
    modalEl.setAttribute('aria-hidden', 'true');
    if (formEl) formEl.reset();
  }

  // Receita Modal
  const receitaModal = document.getElementById('receitaModal');
  const receitaForm = document.getElementById('receitaForm');
  const addReceitaBtn = document.getElementById('addReceitaBtn');
  const closeReceitaModal = document.getElementById('closeReceitaModal');
  const cancelReceitaBtn = document.getElementById('cancelReceitaBtn');

  if (addReceitaBtn) {
    addReceitaBtn.addEventListener('click', () => {
      document.getElementById('receitaModalTitle').textContent = 'Nova Receita';
      document.getElementById('submitReceitaBtn').textContent = 'Adicionar Receita';
      document.getElementById('receitaEditIndex').value = '';
      if (receitaForm) receitaForm.reset();
      openModal(receitaModal);
    });
  }

  if (closeReceitaModal) closeReceitaModal.addEventListener('click', () => closeModal(receitaModal, receitaForm));
  if (cancelReceitaBtn) cancelReceitaBtn.addEventListener('click', () => closeModal(receitaModal, receitaForm));

  if (receitaForm) {
    receitaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('receitaEditIndex').value;
      const item = {
        origem: (document.getElementById('receitaOrigem').value || '').trim(),
        descricao: (document.getElementById('receitaDescricao').value || '').trim(),
        conta: (document.getElementById('receitaConta').value || '').trim(),
        valor: parseMoneyInput(document.getElementById('receitaValor').value) || 0,
        data: document.getElementById('receitaData').value,
        status: document.getElementById('receitaStatus').value,
      };
      if (!item.origem || !item.descricao || !item.conta || !item.data) {
        showToast('Preencha todos os campos obrigatórios.');
        return;
      }
      if (!(item.valor > 0)) {
        showToast('Informe um valor válido maior que zero.');
        return;
      }

      if (idxStr !== '') {
        // EDIT: revert old impact, apply new one
        const old = receitas[parseInt(idxStr, 10)];
        if (old && old.conta) adjustContaSaldo(old.conta, -(parseFloat(old.valor) || 0));
        receitas[parseInt(idxStr, 10)] = item;
        if (item.conta && item.valor > 0) adjustContaSaldo(item.conta, item.valor);
        showToast('Receita atualizada com sucesso! ✓');
      } else {
        receitas.unshift(item);
        // NEW: credit the linked account
        if (item.conta && item.valor > 0) adjustContaSaldo(item.conta, item.valor);
        showToast('Receita adicionada com sucesso! ✓');
      }

      closeModal(receitaModal, receitaForm);
      requestAnimationFrame(() => {
        recalculateAll();
      });
    });
  }

  // Despesa Modal
  const despesaModal = document.getElementById('despesaModal');
  const despesaForm = document.getElementById('despesaForm');
  const addDespesaBtn = document.getElementById('addDespesaBtn');
  const closeDespesaModal = document.getElementById('closeDespesaModal');
  const cancelDespesaBtn = document.getElementById('cancelDespesaBtn');
  const despesaPrioridade = document.getElementById('despesaPrioridade');
  const despesaFormaPagamento = document.getElementById('despesaFormaPagamento');
  const despesaTipoPagamento = document.getElementById('despesaTipoPagamento');
  const despesaParcelas = document.getElementById('despesaParcelas');
  const despesaValorParcelaPreview = document.getElementById('despesaValorParcelaPreview');
  const parcelamentoFields = document.getElementById('parcelamentoFields');

  function updateParcelamentoFields() {
    const isParcelado = despesaTipoPagamento?.value === 'parcelado';
    if (parcelamentoFields) parcelamentoFields.hidden = !isParcelado;
    if (despesaParcelas) despesaParcelas.required = isParcelado;
    if (despesaValorParcelaPreview) {
      const total = parseMoneyInput(document.getElementById('despesaValor')?.value || '') || 0;
      const count = Number(despesaParcelas?.value || 0);
      despesaValorParcelaPreview.value = isParcelado && count > 1 ? formatCurrency(total / count) : '';
    }
  }

  if (despesaTipoPagamento) despesaTipoPagamento.addEventListener('change', updateParcelamentoFields);
  if (despesaParcelas) despesaParcelas.addEventListener('input', updateParcelamentoFields);
  const despesaValorInput = document.getElementById('despesaValor');
  if (despesaValorInput) despesaValorInput.addEventListener('input', updateParcelamentoFields);

  if (addDespesaBtn) {
    addDespesaBtn.addEventListener('click', () => {
      document.getElementById('despesaModalTitle').textContent = 'Nova Despesa';
      document.getElementById('submitDespesaBtn').textContent = 'Adicionar Despesa';
      document.getElementById('despesaEditIndex').value = '';
      if (despesaForm) despesaForm.reset();
      
      // Definir prioridade padrão como "media"
      if (despesaPrioridade) despesaPrioridade.value = 'media';
      if (despesaFormaPagamento) despesaFormaPagamento.value = 'pix';
      if (despesaTipoPagamento) despesaTipoPagamento.value = 'avista';
      if (despesaParcelas) despesaParcelas.value = '';
      if (despesaValorParcelaPreview) despesaValorParcelaPreview.value = '';
      updateParcelamentoFields();
      openModal(despesaModal);
    });
  }

  if (closeDespesaModal) closeDespesaModal.addEventListener('click', () => closeModal(despesaModal, despesaForm));
  if (cancelDespesaBtn) cancelDespesaBtn.addEventListener('click', () => closeModal(despesaModal, despesaForm));

  if (despesaForm) {
    despesaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('despesaEditIndex').value;
      const isNewExpense = idxStr === '';
      const categoria = (document.getElementById('despesaCategoria').value || '').trim();
      const totalInformado = parseMoneyInput(document.getElementById('despesaValor').value) || 0;
      const tipoPagamento = despesaTipoPagamento?.value || 'avista';
      const parcelas = tipoPagamento === 'parcelado' ? Math.max(2, Number(despesaParcelas?.value || 0)) : 1;

      if (tipoPagamento === 'parcelado' && (!Number.isFinite(parcelas) || parcelas < 2)) {
        showToast('Informe uma quantidade válida de parcelas.');
        despesaParcelas?.focus();
        return;
      }

      const valorParcela = tipoPagamento === 'parcelado' ? totalInformado / parcelas : totalInformado;
      const item = {
        categoria: categoria,
        descricao: (document.getElementById('despesaDescricao').value || '').trim(),
        conta: (document.getElementById('despesaConta').value || '').trim(),
        valor: valorParcela,
        valorTotal: totalInformado,
        valorParcela: valorParcela,
        parcelado: tipoPagamento === 'parcelado',
        tipoPagamento,
        parcelas,
        parcelaAtual: tipoPagamento === 'parcelado' ? 1 : 1,
        formaPagamento: despesaFormaPagamento?.value || 'outro',
        data: document.getElementById('despesaData').value,
        status: document.getElementById('despesaStatus').value,
        prioridade: despesaPrioridade ? despesaPrioridade.value : 'media',
      };

      if (idxStr !== '') {
        const previous = despesas[parseInt(idxStr, 10)] || {};
        // EDIT: revert old impact
        if (previous.conta && previous.formaPagamento !== 'cartao') {
          adjustContaSaldo(previous.conta, (parseFloat(previous.valor) || 0)); // add back
        }
        despesas[parseInt(idxStr, 10)] = { ...previous, ...item };
        // Apply new impact
        if (item.conta && item.formaPagamento !== 'cartao') {
          adjustContaSaldo(item.conta, -(item.valor));
        }
        showToast('Despesa atualizada com sucesso! ✓');
      } else {
        despesas.unshift(item);
        // NEW: debit linked account (only for non-credit-card payments)
        if (item.conta && item.formaPagamento !== 'cartao') {
          adjustContaSaldo(item.conta, -(item.valor));
        }
        showToast('Despesa adicionada com sucesso! ✓');
      }

      saveDataStorage(STORAGE_KEYS.despesas, despesas);
      closeModal(despesaModal, despesaForm);
      recalculateAll();

      // Educação contextual: somente após um novo lançamento, sem bloquear o usuário.
      if (isNewExpense) {
        requestAnimationFrame(() => openContextualEducation(item));
      }
    });
  }

  // Conta Modal
  const contaModal = document.getElementById('contaModal');
  const contaForm = document.getElementById('contaForm');
  const addContaBtn = document.getElementById('addContaBtn');
  const closeContaModal = document.getElementById('closeContaModal');
  const cancelContaBtn = document.getElementById('cancelContaBtn');

  if (addContaBtn) {
    addContaBtn.addEventListener('click', () => {
      document.getElementById('contaModalTitle').textContent = 'Nova Conta';
      document.getElementById('submitContaBtn').textContent = 'Adicionar Conta';
      document.getElementById('contaEditIndex').value = '';
      if (contaForm) contaForm.reset();
      openModal(contaModal);
    });
  }

  if (closeContaModal) closeContaModal.addEventListener('click', () => closeModal(contaModal, contaForm));
  if (cancelContaBtn) cancelContaBtn.addEventListener('click', () => closeModal(contaModal, contaForm));



  function ofTxKey(item) {
    if (!item) return '';
    const provider = item.provider || 'mock';
    const conn = item.connectionId || '';
    const ext = item.externalId || '';
    return provider + '|' + conn + '|' + ext;
  }

  function mergeOpenFinanceTransactions(txList) {
    if (!Array.isArray(txList) || !txList.length) return { added: 0, skipped: 0, updated: 0 };
    if (!Array.isArray(receitas)) receitas = [];
    if (!Array.isArray(despesas)) despesas = [];
    let added = 0, skipped = 0, updated = 0;

    const indexByKey = (list) => {
      const map = new Map();
      list.forEach((item, idx) => {
        if (item && item.externalId) map.set(ofTxKey(item), idx);
      });
      return map;
    };
    const mapR = indexByKey(receitas);
    const mapD = indexByKey(despesas);

    txList.forEach((tx) => {
      if (!tx || !tx.externalId) return;
      if (typeof PrismaBankSync === 'undefined' || !PrismaBankSync.service) return;
      const mapped = PrismaBankSync.service.toPrismaLancamento(tx);
      if (!mapped || mapped.kind === 'transfer') {
        // Transferências internas não viram receita/despesa
        skipped++;
        return;
      }
      const key = ofTxKey(mapped.item);
      if (mapped.kind === 'receita') {
        if (mapR.has(key)) {
          const idx = mapR.get(key);
          const prev = receitas[idx] || {};
          // Atualiza campos mutáveis sem duplicar
          receitas[idx] = { ...prev, ...mapped.item, externalId: prev.externalId || mapped.item.externalId };
          updated++;
          return;
        }
        receitas.unshift(mapped.item);
        mapR.set(key, 0);
        // Reindex after unshift is expensive; rebuild on next call is fine
        added++;
      } else {
        if (mapD.has(key)) {
          const idx = mapD.get(key);
          const prev = despesas[idx] || {};
          despesas[idx] = { ...prev, ...mapped.item, externalId: prev.externalId || mapped.item.externalId };
          updated++;
          return;
        }
        despesas.unshift(mapped.item);
        mapD.set(key, 0);
        added++;
      }
    });
    return { added, skipped, updated };
  }

  let _ofSyncBusy = false;
  async function syncAllOpenFinanceAccounts() {
    if (typeof PrismaBankSync === 'undefined') {
      showToast('Módulo Open Finance não carregado');
      return;
    }
    if (_ofSyncBusy) {
      showToast('Sincronização já em andamento…');
      return;
    }
    const connected = (contas || []).filter((c) => PrismaBankSync.service.isConnected(c));
    if (!connected.length) {
      showToast('Nenhuma conta Open Finance conectada');
      return;
    }
    _ofSyncBusy = true;
    const syncBtn = document.getElementById('btnSyncAllBanks');
    if (syncBtn) syncBtn.disabled = true;
    showToast('Sincronizando ' + connected.length + ' conta(s)…');
    try {
      const result = await PrismaBankSync.service.syncAll(connected);
      // atualiza saldos
      (result.accounts || []).forEach((upd) => {
        const idx = contas.findIndex((c) => c.externalId && c.externalId === upd.externalId);
        if (idx >= 0) contas[idx] = { ...contas[idx], ...upd };
      });
      const merge = mergeOpenFinanceTransactions(result.transactions || []);
      if (typeof recalculateAll === 'function') recalculateAll();
      else {
        saveDataStorage(STORAGE_KEYS.contas, contas);
        saveDataStorage(STORAGE_KEYS.receitas, receitas);
        saveDataStorage(STORAGE_KEYS.despesas, despesas);
        renderContas();
      }
      const nNew = merge.added || 0;
      const msg = nNew > 0
        ? ('Sync OK: ' + (result.accounts || []).length + ' conta(s), +' + nNew + ' lançamento(s)')
        : ('Sincronizado. Nenhuma nova transação (' + (result.accounts || []).length + ' conta(s)).');
      showToast(msg);
      if (result.errors && result.errors.length) {
        showToast('Algumas contas falharam: ' + result.errors[0].message);
      }
    } catch (err) {
      showToast('Falha no sync: ' + (err.message || err));
    } finally {
      _ofSyncBusy = false;
      const syncBtn = document.getElementById('btnSyncAllBanks');
      if (syncBtn) syncBtn.disabled = false;
    }
  }

  // ========== CONECTAR BANCO (sandbox Open Finance) ==========
  (function initBankConnectUI() {
    const modal = document.getElementById('bankConnectModal');
    const body = document.getElementById('bankConnectBody');
    const nextBtn = document.getElementById('bankConnectNextBtn');
    const cancelBtn = document.getElementById('cancelBankConnectBtn');
    const closeBtn = document.getElementById('closeBankConnectModal');
    const openBtn = document.getElementById('btnConnectBank');
    if (!modal || !body) return;

    let step = 1;
    let selectedInstId = null;
    let consentOk = false;
    let pendingResult = null;

    function setStep(n) {
      step = n;
      document.querySelectorAll('#bankConnectSteps .bcs-step').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.step) <= n);
      });
    }

    function renderStep1() {
      setStep(1);
      pendingResult = null;
      consentOk = false;
      const list = (typeof PrismaBankSync !== 'undefined' && PrismaBankSync.service)
        ? PrismaBankSync.service.listInstitutions()
        : [];
      body.innerHTML = `
        <p class="text-muted" style="margin-bottom:0.75rem;">Escolha a instituição (dados 100% simulados — sandbox).</p>
        <div class="bank-inst-grid" id="bankInstGrid">
          ${list.map((inst) => `
            <button type="button" class="bank-inst-card ${selectedInstId === inst.id ? 'selected' : ''}" data-inst="${inst.id}">
              <span class="bank-inst-dot" style="background:${inst.color}"></span>
              <span class="bank-inst-name">${escapeHtml(inst.name)}</span>
              <span class="bank-inst-compe">COMPE ${escapeHtml(inst.compe)}</span>
            </button>
          `).join('') || '<p>Módulo PrismaBankSync não carregado.</p>'}
        </div>
      `;
      body.querySelectorAll('[data-inst]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedInstId = btn.dataset.inst;
          renderStep1();
          nextBtn.disabled = !selectedInstId;
          nextBtn.textContent = 'Continuar';
        });
      });
      nextBtn.disabled = !selectedInstId;
      nextBtn.textContent = 'Continuar';
    }

    function renderStep2() {
      setStep(2);
      const inst = PrismaBankSync.service.getInstitution(selectedInstId);
      body.innerHTML = `
        <div class="bank-consent-box">
          <p><strong>${escapeHtml(inst ? inst.name : '')}</strong></p>
          <p class="text-muted">Em produção, você seria redirecionado ao app do banco para autorizar o compartilhamento (Open Finance / LGPD).</p>
          <ul class="bank-consent-list">
            <li>Saldo e tipo de conta</li>
            <li>Extrato (futuro)</li>
            <li>Consentimento revogável</li>
          </ul>
          <label class="bank-consent-check">
            <input type="checkbox" id="bankConsentCheck" />
            <span>Simulo o consentimento e autorizo o sandbox a criar contas mock desta instituição.</span>
          </label>
          <p class="cf-disclaimer">Nenhuma credencial bancária real é solicitada ou armazenada.</p>
        </div>
      `;
      const chk = document.getElementById('bankConsentCheck');
      if (chk) chk.addEventListener('change', () => {
        consentOk = !!chk.checked;
        nextBtn.disabled = !consentOk;
      });
      nextBtn.disabled = true;
      nextBtn.textContent = 'Autorizar e conectar';
    }

    async function renderStep3() {
      setStep(3);
      nextBtn.disabled = true;
      nextBtn.textContent = 'Conectando…';
      body.innerHTML = `<p class="text-muted">Estabelecendo conexão sandbox com a instituição…</p>`;
      try {
        // Evita segunda conexão da mesma instituição para o usuário atual
        const userScope = (typeof currentProfileId !== 'undefined' && currentProfileId) ? currentProfileId : null;
        const existing = PrismaBankSync.service.findExistingConnection
          ? PrismaBankSync.service.findExistingConnection(contas, selectedInstId, userScope)
          : null;
        const alreadyActive = existing && (existing.accounts || []).some((c) => PrismaBankSync.service.isConnected(c));
        if (alreadyActive) {
          body.innerHTML = `
            <div class="bank-consent-box">
              <p><strong>Esta instituição já está conectada</strong> (Open Finance — Sandbox).</p>
              <p class="text-muted">Não criamos uma segunda conexão. Você pode sincronizar as contas existentes.</p>
              <ul class="bank-discovered-list">
                ${(existing.accounts || []).map((a) => `<li><strong>${escapeHtml(a.nome || a.banco || '')}</strong> — ${fmtMoney(a.saldo)} · ${a.syncStatus || ''}</li>`).join('')}
              </ul>
            </div>`;
          nextBtn.disabled = false;
          nextBtn.textContent = 'Sincronizar agora';
          pendingResult = { alreadyConnected: true, accounts: existing.accounts, transactions: [] };
          // next click on step 3 will just sync
          return;
        }
        pendingResult = await PrismaBankSync.service.connect(selectedInstId, { userId: userScope });
        const accs = pendingResult.accounts || [];
        const txCount = (pendingResult.transactions || []).length;
        body.innerHTML = `
          <p><strong>Conexão Open Finance (sandbox) autorizada</strong></p>
          <p class="text-muted">Connection: <code>${escapeHtml(pendingResult.connectionId)}</code>
          · Consentimento: ${escapeHtml((pendingResult.consent && pendingResult.consent.status) || 'AUTHORISED')}</p>
          <ul class="bank-discovered-list">
            ${accs.map((a) => `<li><strong>${escapeHtml(a.nome)}</strong> — ${fmtMoney(a.saldo)} · final ${escapeHtml(a.numero)}</li>`).join('')}
          </ul>
          <p class="text-muted">${txCount} lançamento(s) de extrato mock prontos para importar (receitas/despesas).</p>
          <p class="text-muted">Ao confirmar: contas + extrato entram no Prisma e o motor financeiro recalcula score, patrimônio e dashboard.</p>
        `;
        nextBtn.disabled = false;
        nextBtn.textContent = 'Adicionar ao Prisma';
      } catch (err) {
        body.innerHTML = `<p class="text-muted">Falha no sandbox: ${escapeHtml(err.message || String(err))}</p>`;
        nextBtn.disabled = false;
        nextBtn.textContent = 'Tentar de novo';
        step = 1;
      }
    }

    function openBankModal() {
      selectedInstId = null;
      consentOk = false;
      pendingResult = null;
      renderStep1();
      openModal(modal);
      if (typeof refreshIcons === 'function') refreshIcons();
    }

    function closeBankModal() {
      closeModal(modal);
    }

    if (openBtn) openBtn.addEventListener('click', openBankModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeBankModal);
    if (closeBtn) closeBtn.addEventListener('click', closeBankModal);
    const syncAllBtn = document.getElementById('btnSyncAllBanks');
    if (syncAllBtn) syncAllBtn.addEventListener('click', () => syncAllOpenFinanceAccounts());

    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (step === 1 && selectedInstId) {
          renderStep2();
        } else if (step === 2 && consentOk) {
          await renderStep3();
        } else if (step === 3 && pendingResult) {
          if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Importando…'; }
          try {
            if (pendingResult.alreadyConnected) {
              closeBankModal();
              await syncAllOpenFinanceAccounts();
              return;
            }
            const accs = pendingResult.accounts || [];
            let created = 0, refreshed = 0;
            accs.forEach((a) => {
              const idx = (contas || []).findIndex((c) =>
                (c.externalId && a.externalId && c.externalId === a.externalId) ||
                (c.connectionId && a.connectionId && c.connectionId === a.connectionId && c.tipo === a.tipo)
              );
              if (idx >= 0) {
                contas[idx] = { ...contas[idx], ...a, syncStatus: 'connected', consentStatus: 'ACTIVE' };
                refreshed++;
              } else {
                contas.unshift(a);
                created++;
              }
            });
            const merge = mergeOpenFinanceTransactions(pendingResult.transactions || []);
            closeBankModal();
            if (typeof recalculateAll === 'function') recalculateAll();
            else {
              if (typeof saveDataStorage === 'function') {
                saveDataStorage(STORAGE_KEYS.contas, contas);
                saveDataStorage(STORAGE_KEYS.receitas, receitas);
                saveDataStorage(STORAGE_KEYS.despesas, despesas);
              }
              renderContas();
            }
            const parts = [];
            if (created) parts.push(created + ' conta(s) nova(s)');
            if (refreshed) parts.push(refreshed + ' atualizada(s)');
            if (merge.added) parts.push('+' + merge.added + ' lançamento(s)');
            else parts.push('sem lançamentos duplicados');
            showToast('Open Finance (sandbox): ' + parts.join(', ') + ' ✓');
          } finally {
            if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Adicionar ao Prisma'; }
          }
        } else if (step === 3) {
          renderStep1();
        }
      });
    }

    // ações sync / disconnect nos cards
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="sync-conta"], [data-action="disconnect-conta"]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      if (!contas[idx]) return;
      if (typeof PrismaBankSync === 'undefined') return;
      try {
        if (btn.dataset.action === 'sync-conta') {
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            if (!PrismaBankSync.service.isConnected(contas[idx])) {
              showToast('Conta desconectada. Reconecte a instituição para sincronizar.');
              return;
            }
            const res = await PrismaBankSync.service.syncAccount(contas[idx]);
            contas[idx] = res.account || res;
            const merge = mergeOpenFinanceTransactions(res.transactions || []);
            if (merge.added > 0) {
              showToast('Sincronizado: +' + merge.added + ' lançamento(s) novo(s)');
            } else {
              showToast('Sincronizado. Nenhuma nova transação.');
            }
          } finally {
            btn.disabled = false;
          }
        } else {
          btn.disabled = true;
          try {
            contas[idx] = await PrismaBankSync.service.disconnect(contas[idx]);
            showToast('Consentimento revogado (sandbox) — conta desconectada');
          } finally {
            btn.disabled = false;
          }
        }
        if (typeof recalculateAll === 'function') recalculateAll();
        else {
          saveDataStorage(STORAGE_KEYS.contas, contas);
          saveDataStorage(STORAGE_KEYS.receitas, receitas);
          saveDataStorage(STORAGE_KEYS.despesas, despesas);
          renderContas();
        }
      } catch (err) {
        showToast('Erro no sandbox: ' + (err.message || err));
      }
    });
  })();

  if (contaForm) {
    contaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('contaEditIndex').value;
      const item = {
        nome: (document.getElementById('contaNome').value || '').trim(),
        banco: (document.getElementById('contaBanco').value || '').trim(),
        saldo: parseMoneyInput(document.getElementById('contaSaldo').value) || 0,
        numero: (document.getElementById('contaNumero').value || '').trim(),
        tipo: document.getElementById('contaTipo').value || 'default',
        source: 'manual',
        syncStatus: 'local'
      };

      if (idxStr !== '') {
        const prev = contas[parseInt(idxStr, 10)] || {};
        // preserva metadados Open Finance se já existirem
        contas[parseInt(idxStr, 10)] = {
          ...prev,
          ...item,
          source: prev.source || item.source,
          syncStatus: prev.syncStatus || item.syncStatus,
          externalId: prev.externalId,
          connectionId: prev.connectionId,
          provider: prev.provider,
          lastSyncAt: prev.lastSyncAt,
          institutionId: prev.institutionId,
          accountType: prev.accountType,
          consentExpiresAt: prev.consentExpiresAt
        };
        showToast('Conta atualizada com sucesso! ✓');
      } else {
        contas.unshift(item);
        showToast('Conta adicionada com sucesso! ✓');
      }

      closeModal(contaModal, contaForm);
      recalculateAll();
    });
  }

  // Cartão Modal
  const cartaoModal = document.getElementById('cartaoModal');
  const cartaoForm = document.getElementById('cartaoForm');
  const addCartaoBtn = document.getElementById('addCartaoBtn');
  const closeCartaoModal = document.getElementById('closeCartaoModal');
  const cancelCartaoBtn = document.getElementById('cancelCartaoBtn');

  if (addCartaoBtn) {
    addCartaoBtn.addEventListener('click', () => {
      document.getElementById('cartaoModalTitle').textContent = 'Novo Cartão';
      document.getElementById('submitCartaoBtn').textContent = 'Adicionar Cartão';
      document.getElementById('cartaoEditIndex').value = '';
      if (cartaoForm) cartaoForm.reset();
      openModal(cartaoModal);
    });
  }

  if (closeCartaoModal) closeCartaoModal.addEventListener('click', () => closeModal(cartaoModal, cartaoForm));
  if (cancelCartaoBtn) cancelCartaoBtn.addEventListener('click', () => closeModal(cartaoModal, cartaoForm));

  if (cartaoForm) {
    cartaoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('cartaoEditIndex').value;
      const item = {
        titular: (document.getElementById('cartaoTitular').value || '').trim().toUpperCase(),
        numero: (document.getElementById('cartaoFinal').value || '').trim(),
        validade: (document.getElementById('cartaoValidade').value || '').trim(),
        estilo: document.getElementById('cartaoEstilo').value,
        banco: document.getElementById('cartaoBanco').value,
        diaVencimento: parseInt(document.getElementById('cartaoDiaVencimento')?.value || '0', 10) || null,
        // FIX P2.1: Read credit limit field from modal
        limiteTotal: parseMoneyInput(document.getElementById('cartaoLimite')?.value || '') || 0,
      };

      if (idxStr !== '') {
        cartoes[parseInt(idxStr, 10)] = item;
        showToast('Cartão atualizado com sucesso! ✓');
      } else {
        cartoes.push(item);
        showToast('Cartão adicionado com sucesso! ✓');
      }

      closeModal(cartaoModal, cartaoForm);
      recalculateAll();
    });
  }

  // Investimento Modal + Carteira handlers
  const investimentoModal = document.getElementById('investimentoModal');
  const investimentoForm = document.getElementById('investimentoForm');
  const addInvestimentoBtn = document.getElementById('addInvestimentoBtn');
  const addInvestimentoBtnCarteira = document.getElementById('addInvestimentoBtnCarteira');
  const closeInvestimentoModal = document.getElementById('closeInvestimentoModal');
  const cancelInvestimentoBtn = document.getElementById('cancelInvestimentoBtn');
  const btnCarteiraInvestimentos = document.getElementById('btnCarteiraInvestimentos');

  function openNovoInvestimentoModal(editIndex) {
    document.getElementById('investimentoModalTitle').textContent = editIndex != null ? 'Editar Investimento' : 'Novo Investimento';
    document.getElementById('submitInvestimentoBtn').textContent = editIndex != null ? 'Salvar Alterações' : 'Adicionar Investimento';
    document.getElementById('investimentoEditIndex').value = editIndex != null ? String(editIndex) : '';
    if (investimentoForm) investimentoForm.reset();
    if (editIndex != null && investimentos[editIndex]) {
      const inv = normalizeInvestimento(investimentos[editIndex]);
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
      set('investNome', inv.nome);
      set('investTipo', inv.tipo);
      set('investInstituicao', inv.instituicao);
      set('investStatus', inv.status || 'ativo');
      set('investValor', inv.valorAplicado != null ? String(inv.valorAplicado).replace('.', ',') : '');
      set('investValorAtual', inv.valorAtual != null ? String(inv.valorAtual).replace('.', ',') : '');
      set('investQuantidade', inv.quantidade != null ? String(inv.quantidade) : '');
      set('investPrecoMedio', inv.precoMedio != null ? String(inv.precoMedio).replace('.', ',') : '');
      set('investDataAplicacao', inv.dataAplicacao || '');
      set('investVencimento', inv.dataVencimento || '');
      set('investRent', inv.rent != null ? inv.rent : '');
      set('investLucro', inv.lucro != null ? String(inv.lucro).replace('.', ',') : '');
      set('investObservacoes', inv.observacoes || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      const da = document.getElementById('investDataAplicacao');
      if (da) da.value = today;
    }
    openModal(investimentoModal);
  }

  if (addInvestimentoBtn) addInvestimentoBtn.addEventListener('click', () => openNovoInvestimentoModal(null));
  if (addInvestimentoBtnCarteira) addInvestimentoBtnCarteira.addEventListener('click', () => openNovoInvestimentoModal(null));
  function openCarteiraAtivosSection() {
    const target = document.getElementById('carteira-ativos');
    const investmentsSection = document.getElementById('investimentos');
    if (!target) return;
    document.querySelectorAll('.section').forEach((section) => section.classList.remove('active'));
    target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    const nav = document.querySelector('[data-section="investimentos"]');
    if (nav) nav.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderInvestimentos();
    switchPrismaInvestTab('posicoes');
    refreshIcons();
  }

  if (btnCarteiraInvestimentos) btnCarteiraInvestimentos.addEventListener('click', openCarteiraAtivosSection);
  const btnVoltarInvestimentos = document.getElementById('btnVoltarInvestimentos');
  if (btnVoltarInvestimentos) {
    btnVoltarInvestimentos.addEventListener('click', () => {
      const nav = document.querySelector('[data-section="investimentos"]');
      if (nav) nav.click();
    });
  }

  if (closeInvestimentoModal) closeInvestimentoModal.addEventListener('click', () => closeModal(investimentoModal, investimentoForm));
  if (cancelInvestimentoBtn) cancelInvestimentoBtn.addEventListener('click', () => closeModal(investimentoModal, investimentoForm));

  if (investimentoForm) {
    investimentoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('investimentoEditIndex').value;
      const valorAplicado = parseMoneyInput(document.getElementById('investValor').value) || 0;
      let valorAtualRaw = document.getElementById('investValorAtual').value;
      let valorAtual = valorAtualRaw ? (parseMoneyInput(valorAtualRaw) || valorAplicado) : valorAplicado;
      let lucroRaw = document.getElementById('investLucro').value;
      let lucro = lucroRaw !== '' && lucroRaw != null ? parseMoneyInput(lucroRaw) : (valorAtual - valorAplicado);
      if (!valorAtualRaw && lucroRaw !== '' && lucroRaw != null) valorAtual = valorAplicado + lucro;
      const qtd = parseFloat(String(document.getElementById('investQuantidade').value || '').replace(',', '.'));
      const pmRaw = document.getElementById('investPrecoMedio').value;
      let precoMedio = pmRaw ? parseMoneyInput(pmRaw) : null;
      if (precoMedio == null && qtd > 0) precoMedio = valorAplicado / qtd;
      const rentInput = parseFloat(document.getElementById('investRent').value);
      const rentCalc = valorAplicado > 0 ? ((valorAtual - valorAplicado) / valorAplicado) * 100 : 0;

      const item = normalizeInvestimento({
        nome: (document.getElementById('investNome').value || '').trim() || 'Investimento',
        tipo: (document.getElementById('investTipo').value || 'outros').trim(),
        instituicao: (document.getElementById('investInstituicao').value || '').trim(),
        status: document.getElementById('investStatus').value || 'ativo',
        valor: valorAplicado,
        valorInvestido: valorAplicado,
        valorAplicado,
        valorAtual,
        valorTotal: valorAtual,
        quantidade: isNaN(qtd) ? null : qtd,
        precoMedio,
        lucro,
        rent: !isNaN(rentInput) ? rentInput : rentCalc,
        rentabilidade: rentCalc,
        dataAplicacao: document.getElementById('investDataAplicacao').value || new Date().toISOString().split('T')[0],
        dataVencimento: document.getElementById('investVencimento').value || '',
        observacoes: (document.getElementById('investObservacoes').value || '').trim(),
        icon: 'trending-up',
        historico: (idxStr !== '' && investimentos[parseInt(idxStr, 10)] && Array.isArray(investimentos[parseInt(idxStr, 10)].historico))
          ? investimentos[parseInt(idxStr, 10)].historico
          : [{ tipo: 'aporte', valor: valorAplicado, data: document.getElementById('investDataAplicacao').value || new Date().toISOString().split('T')[0], obs: 'Aplicação inicial' }]
      });

      const isEditing = idxStr !== '';
      if (isEditing) {
        investimentos[parseInt(idxStr, 10)] = item;
      } else {
        investimentos.push(item);
      }

      closeModal(investimentoModal, investimentoForm);
      recalculateAll();

      showToast(
        isEditing ? 'Investimento atualizado com sucesso! ✓' : 'Investimento adicionado com sucesso! ✓',
        {
          label: 'Ver Carteira',
          onClick: () => {
            const card = document.getElementById('investimentosPortfolioCard');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      );
    });
  }

  // Detalhe / Aporte / Resgate modals
  const detalheModal = document.getElementById('investimentoDetalheModal');
  const closeDetalhe = document.getElementById('closeInvestimentoDetalheModal');
  const closeDetalheBtn = document.getElementById('closeInvestimentoDetalheBtn');
  if (closeDetalhe) closeDetalhe.addEventListener('click', () => closeModal(detalheModal));
  if (closeDetalheBtn) closeDetalheBtn.addEventListener('click', () => closeModal(detalheModal));

  const btnEditarDetalhe = document.getElementById('btnEditarDetalhe');
  if (btnEditarDetalhe) {
    btnEditarDetalhe.addEventListener('click', () => {
      const idx = parseInt(detalheModal.dataset.index, 10);
      closeModal(detalheModal);
      if (!isNaN(idx)) openNovoInvestimentoModal(idx);
    });
  }
  const btnAporteDetalhe = document.getElementById('btnAporteDetalhe');
  if (btnAporteDetalhe) {
    btnAporteDetalhe.addEventListener('click', () => {
      const idx = parseInt(detalheModal.dataset.index, 10);
      closeModal(detalheModal);
      if (!isNaN(idx)) openAporteModal(idx);
    });
  }
  const btnResgatarDetalhe = document.getElementById('btnResgatarDetalhe');
  if (btnResgatarDetalhe) {
    btnResgatarDetalhe.addEventListener('click', () => {
      const idx = parseInt(detalheModal.dataset.index, 10);
      closeModal(detalheModal);
      if (!isNaN(idx)) openResgateModal(idx);
    });
  }

  function openAporteModal(index) {
    const modal = document.getElementById('aporteModal');
    const form = document.getElementById('aporteForm');
    document.getElementById('aporteInvestIndex').value = String(index);
    if (form) form.reset();
    document.getElementById('aporteData').value = new Date().toISOString().split('T')[0];
    openModal(modal);
  }
  function openResgateModal(index) {
    const modal = document.getElementById('resgateModal');
    const form = document.getElementById('resgateForm');
    document.getElementById('resgateInvestIndex').value = String(index);
    if (form) form.reset();
    document.getElementById('resgateData').value = new Date().toISOString().split('T')[0];
    openModal(modal);
  }

  const aporteModal = document.getElementById('aporteModal');
  const aporteForm = document.getElementById('aporteForm');
  const closeAporteModal = document.getElementById('closeAporteModal');
  const cancelAporteBtn = document.getElementById('cancelAporteBtn');
  if (closeAporteModal) closeAporteModal.addEventListener('click', () => closeModal(aporteModal, aporteForm));
  if (cancelAporteBtn) cancelAporteBtn.addEventListener('click', () => closeModal(aporteModal, aporteForm));
  if (aporteForm) {
    aporteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idx = parseInt(document.getElementById('aporteInvestIndex').value, 10);
      if (isNaN(idx) || !investimentos[idx]) return;
      const valor = parseMoneyInput(document.getElementById('aporteValor').value) || 0;
      if (valor <= 0) { showToast('Informe um valor válido'); return; }
      const qtd = parseFloat(String(document.getElementById('aporteQuantidade').value || '').replace(',', '.'));
      const data = document.getElementById('aporteData').value || new Date().toISOString().split('T')[0];
      const obs = (document.getElementById('aporteObs').value || '').trim();
      const inv = normalizeInvestimento(investimentos[idx]);
      inv.valorAplicado = getInvestValorAplicado(inv) + valor;
      inv.valorInvestido = inv.valorAplicado;
      inv.valor = inv.valorAplicado;
      inv.valorAtual = getInvestValorAtual(inv) + valor;
      inv.valorTotal = inv.valorAtual;
      if (!isNaN(qtd) && qtd > 0) {
        inv.quantidade = (Number(inv.quantidade) || 0) + qtd;
        inv.precoMedio = inv.quantidade > 0 ? inv.valorAplicado / inv.quantidade : inv.precoMedio;
      }
      inv.lucro = inv.valorAtual - inv.valorAplicado;
      inv.rentabilidade = inv.valorAplicado > 0 ? (inv.lucro / inv.valorAplicado) * 100 : 0;
      inv.rent = inv.rentabilidade;
      if (!Array.isArray(inv.historico)) inv.historico = [];
      inv.historico.push({ tipo: 'aporte', valor, quantidade: isNaN(qtd) ? null : qtd, data, obs });
      investimentos[idx] = inv;
      closeModal(aporteModal, aporteForm);
      recalculateAll();
      showToast('Aporte registrado com sucesso! ✓');
    });
  }

  const resgateModal = document.getElementById('resgateModal');
  const resgateForm = document.getElementById('resgateForm');
  const closeResgateModal = document.getElementById('closeResgateModal');
  const cancelResgateBtn = document.getElementById('cancelResgateBtn');
  if (closeResgateModal) closeResgateModal.addEventListener('click', () => closeModal(resgateModal, resgateForm));
  if (cancelResgateBtn) cancelResgateBtn.addEventListener('click', () => closeModal(resgateModal, resgateForm));
  if (resgateForm) {
    resgateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idx = parseInt(document.getElementById('resgateInvestIndex').value, 10);
      if (isNaN(idx) || !investimentos[idx]) return;
      const valor = parseMoneyInput(document.getElementById('resgateValor').value) || 0;
      if (valor <= 0) { showToast('Informe um valor válido'); return; }
      const qtd = parseFloat(String(document.getElementById('resgateQuantidade').value || '').replace(',', '.'));
      const data = document.getElementById('resgateData').value || new Date().toISOString().split('T')[0];
      const obs = (document.getElementById('resgateObs').value || '').trim();
      const total = document.getElementById('resgateTotal').checked;
      const inv = normalizeInvestimento(investimentos[idx]);
      const aplicado = getInvestValorAplicado(inv);
      const atual = getInvestValorAtual(inv);
      // Proporcional: reduz aplicado e atual
      const ratio = atual > 0 ? Math.min(1, valor / atual) : 1;
      inv.valorAplicado = Math.max(0, aplicado * (1 - ratio));
      inv.valorInvestido = inv.valorAplicado;
      inv.valor = inv.valorAplicado;
      inv.valorAtual = Math.max(0, atual - valor);
      inv.valorTotal = inv.valorAtual;
      if (!isNaN(qtd) && qtd > 0 && inv.quantidade) {
        inv.quantidade = Math.max(0, Number(inv.quantidade) - qtd);
      }
      inv.lucro = inv.valorAtual - inv.valorAplicado;
      inv.rentabilidade = inv.valorAplicado > 0 ? (inv.lucro / inv.valorAplicado) * 100 : 0;
      inv.rent = inv.rentabilidade;
      if (total || inv.valorAtual <= 0.01) {
        inv.status = 'resgatado';
        inv.valorAtual = 0;
        inv.valorTotal = 0;
        inv.valorAplicado = 0;
        inv.valorInvestido = 0;
        inv.valor = 0;
        inv.lucro = 0;
      }
      if (!Array.isArray(inv.historico)) inv.historico = [];
      inv.historico.push({ tipo: 'resgate', valor, quantidade: isNaN(qtd) ? null : qtd, data, obs });
      investimentos[idx] = inv;
      closeModal(resgateModal, resgateForm);
      recalculateAll();
      showToast('Resgate registrado com sucesso! ✓');
    });
  }

  // Prisma Invest — abas e controles
  const piTabs = document.getElementById('prismaInvestTabs');
  if (piTabs) {
    piTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.pi-tab');
      if (!tab) return;
      switchPrismaInvestTab(tab.dataset.piTab);
    });
  }
  const divModeToggle = document.getElementById('divModeToggle');
  if (divModeToggle) {
    divModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-div-mode]');
      if (!btn) return;
      divModeToggle.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      carteiraDivMode = btn.dataset.divMode || 'tipo';
      renderPortfolioChart();
    });
  }
  const evolPeriodFilters = document.getElementById('evolPeriodFilters');
  if (evolPeriodFilters) {
    evolPeriodFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-period]');
      if (!btn) return;
      evolPeriodFilters.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      carteiraEvolPeriod = btn.dataset.period || '90d';
      const totals = getCarteiraTotals();
      renderEvolutionChart(totals.list, totals.totalAtual);
    });
  }
  const histFilters = document.getElementById('histFilters');
  if (histFilters) {
    histFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hist]');
      if (!btn) return;
      histFilters.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      carteiraHistFilter = btn.dataset.hist || 'todos';
      renderHistoricoPanel();
    });
  }
  const btnSimularProjecao = document.getElementById('btnSimularProjecao');
  if (btnSimularProjecao) btnSimularProjecao.addEventListener('click', () => renderProjecao(true));
  const btnGerarInsightsIA = document.getElementById('btnGerarInsightsIA');
  if (btnGerarInsightsIA) btnGerarInsightsIA.addEventListener('click', () => { renderIaPanel(); showToast('Insights atualizados com dados da carteira'); });
  const btnPdf = document.getElementById('btnCarteiraRelatorioPdf');
  if (btnPdf) btnPdf.addEventListener('click', () => exportCarteiraPDF());
  const btnCsv = document.getElementById('btnCarteiraRelatorioCsv');
  if (btnCsv) btnCsv.addEventListener('click', () => exportCarteiraCSV());

  // Filtros, busca e ordenação da carteira (suporta tanto novos pills quanto legacy)
  const filtersEl = document.getElementById('carteiraFilters');
  if (filtersEl) {
    filtersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.carteira-pill, .filter-chip');
      if (!btn) return;
      filtersEl.querySelectorAll('.carteira-pill, .filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.carteiraFilter || btn.dataset.filter || 'all';
      carteiraFilter = (val === 'all' || val === 'todos') ? 'todos' : val;
      renderCarteiraList();
      refreshIcons();
    });
  }
  const searchEl = document.getElementById('carteiraSearchInput') || document.getElementById('carteiraSearch');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      carteiraSearchQuery = (searchEl.value || '').trim();
      renderCarteiraList();
      refreshIcons();
    });
  }
  const sortEl = document.getElementById('carteiraSortSelect') || document.getElementById('carteiraSort');
  if (sortEl) {
    sortEl.addEventListener('change', () => {
      carteiraSort = sortEl.value || 'valor-desc';
      renderCarteiraList();
      refreshIcons();
    });
  }

  // Meta Modal
  const metaModal = document.getElementById('metaModal');
  const metaForm = document.getElementById('metaForm');
  const addMetaBtn = document.getElementById('addMetaBtn');
  const closeMetaModal = document.getElementById('closeMetaModal');
  const cancelMetaBtn = document.getElementById('cancelMetaBtn');

  if (addMetaBtn) {
    addMetaBtn.addEventListener('click', () => {
      document.getElementById('metaModalTitle').textContent = 'Nova Meta';
      document.getElementById('submitMetaBtn').textContent = 'Adicionar Meta';
      document.getElementById('metaEditIndex').value = '';
      if (metaForm) metaForm.reset();
      openModal(metaModal);
    });
  }

  if (closeMetaModal) closeMetaModal.addEventListener('click', () => closeModal(metaModal, metaForm));
  if (cancelMetaBtn) cancelMetaBtn.addEventListener('click', () => closeModal(metaModal, metaForm));

  if (metaForm) {
    metaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idxStr = document.getElementById('metaEditIndex').value;
      const iconTheme = (document.getElementById('metaIcon').value || 'target|default').split('|');
      const item = {
        name: (document.getElementById('metaNome').value || '').trim(),
        current: parseMoneyInput(document.getElementById('metaAtual').value) || 0,
        target: parseMoneyInput(document.getElementById('metaAlvo').value) || 0,
        year: parseInt(document.getElementById('metaAno').value, 10) || new Date().getFullYear(),
        icon: iconTheme[0],
        color: iconTheme[1],
      };

      if (idxStr !== '') {
        goals[parseInt(idxStr, 10)] = item;
        showToast('Meta atualizada com sucesso! ✓');
      } else {
        goals.push(item);
        showToast('Meta adicionada com sucesso! ✓');
      }

      closeModal(metaModal, metaForm);
      buildGoalsGrid();
      recalculateAll();
    });
  }

  // ==================== META QUICK ACTIONS (FIX P2.3: Aporte/Retirada rápidos) ====================
  document.addEventListener('click', (e) => {
    const aporteBtn = e.target.closest('[data-action="aporte-meta"]');
    const retiradaBtn = e.target.closest('[data-action="retirada-meta"]');
    if (!aporteBtn && !retiradaBtn) return;
    const btn = aporteBtn || retiradaBtn;
    const idx = parseInt(btn.dataset.index, 10);
    if (!goals[idx]) return;
    const tipo = aporteBtn ? 'Aporte' : 'Retirada';
    const valorStr = prompt(`${tipo} na meta "${goals[idx].name}"\nValor atual: ${fmtMoney(goals[idx].current)} / ${fmtMoney(goals[idx].target)}\n\nInforme o valor (R$):`);
    if (valorStr === null) return; // cancelled
    const valor = parseFloat(String(valorStr).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
    if (!(valor > 0)) { showToast('Valor inválido.'); return; }
    if (aporteBtn) {
      goals[idx].current = Math.round(((goals[idx].current || 0) + valor) * 100) / 100;
      showToast(`Aporte de ${fmtMoney(valor)} registrado! ✓`);
    } else {
      const novoValor = Math.max(0, (goals[idx].current || 0) - valor);
      goals[idx].current = Math.round(novoValor * 100) / 100;
      showToast(`Retirada de ${fmtMoney(valor)} registrada! ✓`);
    }
    saveDataStorage(STORAGE_KEYS.goals, goals);
    buildGoalsGrid();
    recalculateAll();
  });

  // ==================== TRANSFERÊNCIA ENTRE CONTAS (FIX P1.7) ====================
  const transferenciaModal = document.getElementById('transferenciaModal');
  const transferenciaForm = document.getElementById('transferenciaForm');
  const addTransferenciaBtn = document.getElementById('btnTransferirContas');
  const closeTransferenciaModal = document.getElementById('closeTransferenciaModal');
  const cancelTransferenciaBtn = document.getElementById('cancelTransferenciaBtn');

  function fillTransferenciaSelects() {
    const origemSel = document.getElementById('transfOrigem');
    const destinoSel = document.getElementById('transfDestino');
    if (!origemSel || !destinoSel) return;
    const opts = (contas || []).map((c, i) => `<option value="${i}">${escapeHtml(c.nome || c.banco || 'Conta ' + (i + 1))} (${fmtMoney(c.saldo || 0)})</option>`).join('');
    origemSel.innerHTML = '<option value="">Selecione a conta de origem</option>' + opts;
    destinoSel.innerHTML = '<option value="">Selecione a conta de destino</option>' + opts;
  }

  if (addTransferenciaBtn) {
    addTransferenciaBtn.addEventListener('click', () => {
      fillTransferenciaSelects();
      if (transferenciaForm) transferenciaForm.reset();
      const dataEl = document.getElementById('transfData');
      if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
      openModal(transferenciaModal);
    });
  }

  if (closeTransferenciaModal) closeTransferenciaModal.addEventListener('click', () => closeModal(transferenciaModal, transferenciaForm));
  if (cancelTransferenciaBtn) cancelTransferenciaBtn.addEventListener('click', () => closeModal(transferenciaModal, transferenciaForm));

  if (transferenciaForm) {
    transferenciaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const origemIdx = parseInt(document.getElementById('transfOrigem').value, 10);
      const destinoIdx = parseInt(document.getElementById('transfDestino').value, 10);
      const valor = parseMoneyInput(document.getElementById('transfValor').value) || 0;
      const data = document.getElementById('transfData').value;
      const obs = (document.getElementById('transfDescricao')?.value || '').trim();

      if (isNaN(origemIdx) || isNaN(destinoIdx)) { showToast('Selecione as contas de origem e destino.'); return; }
      if (origemIdx === destinoIdx) { showToast('As contas de origem e destino devem ser diferentes.'); return; }
      if (!(valor > 0)) { showToast('Informe um valor válido.'); return; }
      if (!contas[origemIdx] || !contas[destinoIdx]) { showToast('Conta não encontrada.'); return; }

      const saldoOrigem = parseFloat(contas[origemIdx].saldo) || 0;
      if (saldoOrigem < valor) {
        if (!confirm(`Saldo insuficiente na conta de origem (${fmtMoney(saldoOrigem)}). Deseja prosseguir assim mesmo?`)) return;
      }

      // Execute transfer
      contas[origemIdx].saldo = Math.round(((parseFloat(contas[origemIdx].saldo) || 0) - valor) * 100) / 100;
      contas[destinoIdx].saldo = Math.round(((parseFloat(contas[destinoIdx].saldo) || 0) + valor) * 100) / 100;

      // Record in transfer history (separate from receitas/despesas)
      if (!Array.isArray(window._prismaTransferencias)) window._prismaTransferencias = [];
      try { window._prismaTransferencias = JSON.parse(localStorage.getItem('prisma_transferencias') || '[]'); } catch (_) {}
      window._prismaTransferencias.unshift({
        id: Date.now(),
        origemNome: contas[origemIdx].nome || contas[origemIdx].banco,
        destinoNome: contas[destinoIdx].nome || contas[destinoIdx].banco,
        valor,
        data,
        obs,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('prisma_transferencias', JSON.stringify(window._prismaTransferencias.slice(0, 500)));

      saveDataStorage(STORAGE_KEYS.contas, contas);
      closeModal(transferenciaModal, transferenciaForm);
      recalculateAll();
      showToast(`Transferência de ${fmtMoney(valor)} realizada! ✓`);
    });
  }


  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const form = modal.querySelector('form');
        closeModal(modal, form);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.show').forEach((modal) => {
        const form = modal.querySelector('form');
        closeModal(modal, form);
      });
    }
  });

  // ==================== EDIT / DELETE ACTION DELEGATOR ====================
  document.addEventListener('click', (e) => {
    const extraBtn = e.target.closest('[data-action="aporte-investimento"], [data-action="resgatar-investimento"], [data-action="view-investimento"]');
    if (extraBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = extraBtn.dataset.action;
      const index = parseInt(extraBtn.dataset.index, 10);
      if (isNaN(index) || !investimentos[index]) return;
      if (action === 'aporte-investimento') openAporteModal(index);
      else if (action === 'resgatar-investimento') openResgateModal(index);
      else if (action === 'view-investimento') openInvestimentoDetalhe(index);
      return;
    }
    const editBtn = e.target.closest('.table-action-btn.edit, [data-action^="edit-"]');
    const deleteBtn = e.target.closest('.table-action-btn.delete, [data-action^="delete-"]');

    if (editBtn) {
      e.preventDefault();
      const action = editBtn.dataset.action;
      const index = parseInt(editBtn.dataset.index, 10);

      if (action === 'edit-receita' && receitas[index]) {
        const r = receitas[index];
        document.getElementById('receitaModalTitle').textContent = 'Editar Receita';
        document.getElementById('submitReceitaBtn').textContent = 'Salvar Alterações';
        document.getElementById('receitaEditIndex').value = index;
        document.getElementById('receitaOrigem').value = r.origem;
        document.getElementById('receitaDescricao').value = r.descricao;
        document.getElementById('receitaConta').value = r.conta;
        document.getElementById('receitaValor').value = parseFloat(r.valor) || 0;
        document.getElementById('receitaData').value = r.data;
        document.getElementById('receitaStatus').value = r.status;
        openModal(receitaModal);
      } else if (action === 'edit-despesa' && despesas[index]) {
        const d = despesas[index];
        document.getElementById('despesaModalTitle').textContent = 'Editar Despesa';
        document.getElementById('submitDespesaBtn').textContent = 'Salvar Alterações';
        document.getElementById('despesaEditIndex').value = index;
        document.getElementById('despesaCategoria').value = d.categoria;
        document.getElementById('despesaDescricao').value = d.descricao;
        document.getElementById('despesaConta').value = d.conta;
        document.getElementById('despesaValor').value = parseFloat(d.valor) || 0;
        document.getElementById('despesaData').value = d.data;
        document.getElementById('despesaStatus').value = d.status;
        if (despesaPrioridade) despesaPrioridade.value = d.prioridade || 'media';
        if (despesaFormaPagamento) despesaFormaPagamento.value = d.formaPagamento || 'pix';
        if (despesaTipoPagamento) despesaTipoPagamento.value = d.tipoPagamento || (d.parcelado ? 'parcelado' : 'avista');
        if (despesaParcelas) despesaParcelas.value = d.parcelas > 1 ? d.parcelas : '';
        updateParcelamentoFields();
        openModal(despesaModal);
      } else if (action === 'edit-conta' && contas[index]) {
        const c = contas[index];
        document.getElementById('contaModalTitle').textContent = 'Editar Conta';
        document.getElementById('submitContaBtn').textContent = 'Salvar Alterações';
        document.getElementById('contaEditIndex').value = index;
        document.getElementById('contaNome').value = c.nome;
        document.getElementById('contaBanco').value = c.banco;
        document.getElementById('contaSaldo').value = c.saldo;
        document.getElementById('contaNumero').value = c.numero;
        document.getElementById('contaTipo').value = c.tipo || 'default';
        openModal(contaModal);
      } else if (action === 'edit-cartao' && cartoes[index]) {
        const cr = cartoes[index];
        document.getElementById('cartaoModalTitle').textContent = 'Editar Cartão';
        document.getElementById('submitCartaoBtn').textContent = 'Salvar Alterações';
        document.getElementById('cartaoEditIndex').value = index;
        document.getElementById('cartaoTitular').value = cr.titular;
        document.getElementById('cartaoFinal').value = cr.numero;
        document.getElementById('cartaoValidade').value = cr.validade;
        document.getElementById('cartaoEstilo').value = cr.estilo || 'default';
        document.getElementById('cartaoBanco').value = cr.banco || 'nubank';
        const diaEl = document.getElementById('cartaoDiaVencimento');
        if (diaEl) diaEl.value = cr.diaVencimento || '';
        openModal(cartaoModal);
      } else if (action === 'edit-investimento' && investimentos[index]) {
        openNovoInvestimentoModal(index);
      } else if (action === 'edit-meta' && goals[index]) {
        const g = goals[index];
        document.getElementById('metaModalTitle').textContent = 'Editar Meta';
        document.getElementById('submitMetaBtn').textContent = 'Salvar Alterações';
        document.getElementById('metaEditIndex').value = index;
        document.getElementById('metaNome').value = g.name;
        document.getElementById('metaAtual').value = g.current;
        document.getElementById('metaAlvo').value = g.target;
        document.getElementById('metaAno').value = g.year;
        document.getElementById('metaIcon').value = `${g.icon || 'target'}|${g.color || 'default'}`;
        openModal(metaModal);
      }
    }

    if (deleteBtn) {
      e.preventDefault();
      const action = deleteBtn.dataset.action;
      const index = parseInt(deleteBtn.dataset.index, 10);

      if (action === 'delete-receita' && receitas[index]) {
        if (!confirm(`Excluir a receita "${receitas[index].descricao || receitas[index].origem || 'selecionada'}"? Esta ação não pode ser desfeita.`)) return;
        // Revert balance before removing
        const r = receitas[index];
        if (r.conta && r.valor > 0) adjustContaSaldo(r.conta, -(parseFloat(r.valor) || 0));
        receitas.splice(index, 1);
        recalculateAll();
        showToast('Receita removida com sucesso! 🗑️');
      } else if (action === 'delete-despesa' && despesas[index]) {
        if (!confirm(`Excluir a despesa "${despesas[index].descricao || despesas[index].categoria || 'selecionada'}"? Esta ação não pode ser desfeita.`)) return;
        // Revert balance before removing
        const d = despesas[index];
        if (d.conta && d.formaPagamento !== 'cartao') adjustContaSaldo(d.conta, (parseFloat(d.valor) || 0));
        despesas.splice(index, 1);
        recalculateAll();
        showToast('Despesa removida com sucesso! 🗑️');
      } else if (action === 'delete-conta' && contas[index]) {
        if (!confirm(`Excluir a conta "${contas[index].nome || 'selecionada'}"? Esta ação não pode ser desfeita.`)) return;
        e.stopPropagation();
        contas.splice(index, 1);
        saveDataStorage(STORAGE_KEYS.contas, contas);
        renderContas();
        recalculateAll();
        showToast('Conta removida com sucesso! 🗑️');
      } else if (action === 'delete-cartao' && cartoes[index]) {
        if (!confirm(`Excluir o cartão final ${cartoes[index].numero || 'selecionado'}? Esta ação não pode ser desfeita.`)) return;
        cartoes.splice(index, 1);
        recalculateAll();
        showToast('Cartão removido com sucesso! 🗑️');
      } else if (action === 'delete-investimento' && investimentos[index]) {
        if (!confirm(`Excluir o investimento "${investimentos[index].nome || investimentos[index].tipo || 'selecionado'}"? Esta ação não pode ser desfeita.`)) return;
        investimentos.splice(index, 1);
        recalculateAll();
        showToast('Investimento removido com sucesso! 🗑️');
      } else if (action === 'delete-meta' && goals[index]) {
        if (!confirm(`Excluir a meta "${goals[index].name || 'selecionada'}"? Esta ação não pode ser desfeita.`)) return;
        goals.splice(index, 1);
        buildGoalsGrid();
        recalculateAll();
        showToast('Meta removida com sucesso! 🗑️');
      }
    }
  });

  // ==================== NAVBAR SEARCH ====================
  // FIX P1.4: Removed legacy search listener that incorrectly hid table rows across all sections
  // The modern global search with dropdown+debounce in prisma-enhancements.js handles this correctly

  // ==================== CHARTS ====================
  function createSparkline(el, points, color) {
    if (!el) return;
    el.innerHTML = '';
    const width = 100;
    const height = 40;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const step = width / (points.length - 1);

    const coords = points.map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return [x, y];
    });

    let path = `M ${coords[0][0]},${coords[0][1]}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const mx = (prev[0] + cur[0]) / 2;
      path += ` C ${mx},${prev[1]} ${mx},${cur[1]} ${cur[0]},${cur[1]}`;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '40');
    svg.style.overflow = 'visible';

    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = 'sparkGrad' + Math.random().toString(36).substr(2);
    gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0'); gradient.setAttribute('y2', '1');
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', color); stop1.setAttribute('stop-opacity', '0.25');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', color); stop2.setAttribute('stop-opacity', '0');
    gradient.appendChild(stop1); gradient.appendChild(stop2);
    svg.appendChild(gradient);

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', `${path} L ${coords[coords.length-1][0]},${height} L ${coords[0][0]},${height} Z`);
    area.setAttribute('fill', `url(#${gradient.id})`);
    svg.appendChild(area);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const last = coords[coords.length - 1];
    dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
    dot.setAttribute('r', '3'); dot.setAttribute('fill', color);
    svg.appendChild(dot);

    el.appendChild(svg);
  }

  createSparkline(document.querySelector('.mini-spark[data-type="balance"]'), [10, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22], '#00FF88');
  createSparkline(document.querySelector('.mini-spark[data-type="expense"]'), [8, 9, 8, 7, 8, 9, 8, 7, 6, 7, 6, 5], '#FF5470');
  createSparkline(document.querySelector('.mini-spark[data-type="savings"]'), [4, 5, 6, 5, 7, 8, 7, 9, 10, 9, 11, 12], '#A78BFA');

  const barContainer = document.querySelector('.mini-chart-bar');
  if (barContainer) {
    barContainer.innerHTML = '';
    const barHeights = [35, 50, 42, 65, 55, 75, 60, 85, 70, 90, 80, 100];
    barHeights.forEach((h) => {
      const span = document.createElement('span');
      span.style.height = h + '%';
      span.style.animationDelay = Math.random() * 0.3 + 's';
      barContainer.appendChild(span);
    });
  }

  // cashflowChart, pieChart, reportChart now defined globally above

  function createGradient(ctx, area, color1, color2) {
    const gradient = ctx.createLinearGradient(0, area, 0, 0);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }

  function initCashflowChart() {
    const oldCanvas = document.getElementById('cashflowChart');
    if (!oldCanvas) return;
    
    // Carregar Chart.js sob demanda
    if (!window.Chart) {
      console.warn('Chart.js não está disponível. O gráfico de fluxo será exibido quando a biblioteca estiver carregada.');
      return;
    }
    
    let canvas = oldCanvas;
    
    // Se houver instância anterior, tentar destruir
    if (cashflowChart) {
      if (typeof cashflowChart.destroy === 'function') {
        try {
          cashflowChart.destroy();
        } catch (e) {
          // Se falhar, recriar o canvas inteiro
          console.warn('Canvas reuse issue detected. Recreating canvas element...');
          const container = oldCanvas.parentElement;
          const newCanvas = document.createElement('canvas');
          newCanvas.id = 'cashflowChart';
          newCanvas.width = 860;
          newCanvas.height = 350;
          container.innerHTML = '';
          container.appendChild(newCanvas);
          canvas = newCanvas;
        }
      }
    }
    
    const ctx = canvas.getContext('2d');
    cashflowChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Receitas',
            data: incomeData,
            borderColor: '#22c55e',
            backgroundColor: createGradient(ctx, 280, 'rgba(0,255,136,0)', 'rgba(0,255,136,0.15)'),
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00FF88',
            pointBorderColor: '#0F172A',
            pointBorderWidth: 2,
          },
          {
            label: 'Despesas',
            data: expenseData,
            borderColor: '#FF5470',
            backgroundColor: createGradient(ctx, 280, 'rgba(255,84,112,0)', 'rgba(255,84,112,0.12)'),
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#FF5470',
            pointBorderColor: '#0F172A',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.95)',
            borderColor: 'rgba(0,255,136,0.3)',
            borderWidth: 1,
            titleColor: '#E6EDF7',
            bodyColor: '#94A3B8',
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B', maxRotation: 0 }, border: { display: false } },
          y: {
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { color: '#64748B', callback: (v) => 'R$' + (v / 1000).toFixed(1) + 'k' },
            border: { display: false },
          },
        },
      },
    });
  }

  function initPieChart() {
    const oldCanvas = document.getElementById('pieChart');
    if (!oldCanvas) return;
    if (!window.Chart) {
      console.warn('Chart.js não está disponível. O gráfico de categorias será exibido quando a biblioteca estiver carregada.');
      return;
    }

    rebuildExpenseCategoriesFromData();
    let canvas = oldCanvas;

    // Se houver instância anterior, tentar destruir
    if (pieChart) {
      if (typeof pieChart.destroy === 'function') {
        try {
          pieChart.destroy();
        } catch (e) {
          console.warn('Canvas reuse issue detected. Recreating canvas element...');
          const container = oldCanvas.parentElement;
          const newCanvas = document.createElement('canvas');
          newCanvas.id = 'pieChart';
          container.innerHTML = '';
          container.appendChild(newCanvas);
          canvas = newCanvas;
        }
      }
    }

    const ctx = canvas.getContext('2d');
    const total = categories.reduce((s, c) => s + c.value, 0);
    const hasData = categories.length > 0 && total > 0;

    pieChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? categories.map((c) => c.name) : ['Sem despesas'],
        datasets: [{
          data: hasData ? categories.map((c) => c.value) : [1],
          backgroundColor: hasData
            ? categories.map((c) => c.color)
            : ['rgba(255, 255, 255, 0.08)'],
          borderColor: hasData ? '#0F172A' : 'rgba(255, 255, 255, 0.05)',
          borderWidth: hasData ? 3 : 1,
          hoverOffset: hasData ? 6 : 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { animateRotate: true, duration: 1000 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: 'rgba(15,23,42,0.95)',
            borderColor: 'rgba(0,200,255,0.3)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                if (!hasData) return ' Sem despesas cadastradas';
                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ` ${ctx.label}: R$${Number(ctx.raw).toLocaleString('pt-BR')} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    const list = document.getElementById('categoryList');
    if (list) {
      list.innerHTML = '';
      if (!hasData) {
        list.innerHTML = '<div class="pie-empty">Cadastre despesas para ver a distribuição</div>';
      } else {
        categories.forEach((c) => {
          const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
          const item = document.createElement('div');
          item.className = 'category-item';
          item.innerHTML = `
            <span class="cat-dot" style="background:${c.color}"></span>
            <span class="cat-name">${escapeHtml(c.name)}</span>
            <span class="cat-val">${fmtMoney(c.value)}</span>
            <span class="cat-pct">${pct}%</span>
          `;
          list.appendChild(item);
        });
      }
    }
  }

  function updatePieChart() {
    rebuildExpenseCategoriesFromData();
    if (!pieChart) {
      try { initPieChart(); } catch (_) {}
      return;
    }
    const total = categories.reduce((s, c) => s + c.value, 0);
    const hasData = categories.length > 0 && total > 0;

    pieChart.data.labels = hasData ? categories.map((c) => c.name) : ['Sem despesas'];
    pieChart.data.datasets[0].data = hasData ? categories.map((c) => c.value) : [1];
    pieChart.data.datasets[0].backgroundColor = hasData
      ? categories.map((c) => c.color)
      : ['rgba(255, 255, 255, 0.08)'];
    pieChart.data.datasets[0].borderColor = hasData ? '#0F172A' : 'rgba(255, 255, 255, 0.05)';
    pieChart.data.datasets[0].borderWidth = hasData ? 3 : 1;
    pieChart.data.datasets[0].hoverOffset = hasData ? 6 : 0;
    pieChart.options.plugins.tooltip.enabled = hasData;
    pieChart.update();
    pieChart.resize();

    const list = document.getElementById('categoryList');
    if (list) {
      list.innerHTML = '';
      if (!hasData) {
        list.innerHTML = '<div class="pie-empty">Cadastre despesas para ver a distribuição</div>';
      } else {
        categories.forEach((c) => {
          const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
          const item = document.createElement('div');
          item.className = 'category-item';
          item.innerHTML = `
            <span class="cat-dot" style="background:${c.color}"></span>
            <span class="cat-name">${escapeHtml(c.name)}</span>
            <span class="cat-val">${fmtMoney(c.value)}</span>
            <span class="cat-pct">${pct}%</span>
          `;
          list.appendChild(item);
        });
      }
    }
  }

  const PIE_COLORS = [
    '#00C853', '#00BCD4', '#7C4DFF', '#FF6D00', '#E91E63',
    '#2196F3', '#FFC107', '#8BC34A', '#FF5722', '#9C27B0',
    '#009688', '#3F51B5', '#CDDC39', '#795548', '#607D8B'
  ];

  function aggregateByCategory(items, fieldOptions) {
    const map = {};
    (items || []).forEach((item) => {
      let name = '';
      for (const f of fieldOptions) {
        if (item[f] && String(item[f]).trim()) { name = String(item[f]).trim(); break; }
      }
      if (!name) name = 'Outros';
      const val = parseFloat(item.valor) || 0;
      if (val <= 0) return;
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }

  function rebuildExpenseCategoriesFromData() {
    categories = aggregateByCategory(despesas, ['categoria', 'origem']);
    try { saveDataStorage(STORAGE_KEYS.categories, categories); } catch (_) {}
    return categories;
  }

  function rebuildIncomeCategoriesFromData() {
    incomeCategories = aggregateByCategory(receitas, ['origem', 'categoria']);
    return incomeCategories;
  }

  function initIncomePieChart() {
    const oldCanvas = document.getElementById('incomePieChart');
    if (!oldCanvas) return;
    if (!window.Chart) {
      console.warn('Chart.js não está disponível para o gráfico de receitas.');
      return;
    }

    rebuildIncomeCategoriesFromData();

    let canvas = oldCanvas;
    if (incomePieChart) {
      if (typeof incomePieChart.destroy === 'function') {
        try {
          incomePieChart.destroy();
        } catch (e) {
          const container = oldCanvas.parentElement;
          const newCanvas = document.createElement('canvas');
          newCanvas.id = 'incomePieChart';
          container.innerHTML = '';
          container.appendChild(newCanvas);
          canvas = newCanvas;
        }
      }
    }

    const ctx = canvas.getContext('2d');
    const total = incomeCategories.reduce((s, c) => s + c.value, 0);
    const hasData = incomeCategories.length > 0 && total > 0;

    incomePieChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? incomeCategories.map((c) => c.name) : ['Sem receitas'],
        datasets: [{
          data: hasData ? incomeCategories.map((c) => c.value) : [1],
          backgroundColor: hasData
            ? incomeCategories.map((c) => c.color)
            : ['rgba(255, 255, 255, 0.08)'],
          borderColor: hasData ? '#0F172A' : 'rgba(255, 255, 255, 0.05)',
          borderWidth: hasData ? 3 : 1,
          hoverOffset: hasData ? 6 : 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { animateRotate: true, duration: 1000 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: 'rgba(15,23,42,0.95)',
            borderColor: 'rgba(0,200,255,0.3)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                if (!hasData) return ' Sem receitas cadastradas';
                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ` ${ctx.label}: R$${Number(ctx.raw).toLocaleString('pt-BR')} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    const list = document.getElementById('incomeCategoryList');
    if (list) {
      list.innerHTML = '';
      if (!hasData) {
        list.innerHTML = '<div class="pie-empty">Cadastre receitas para ver a distribuição</div>';
      } else {
        incomeCategories.forEach((c) => {
          const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
          const item = document.createElement('div');
          item.className = 'category-item';
          item.innerHTML = `
            <span class="cat-dot" style="background:${c.color}"></span>
            <span class="cat-name">${escapeHtml(c.name)}</span>
            <span class="cat-val">${fmtMoney(c.value)}</span>
            <span class="cat-pct">${pct}%</span>
          `;
          list.appendChild(item);
        });
      }
    }
  }

  function updateIncomePieChart() {
    rebuildIncomeCategoriesFromData();
    if (!incomePieChart) {
      try { initIncomePieChart(); } catch (_) {}
      return;
    }
    const total = incomeCategories.reduce((s, c) => s + c.value, 0);
    const hasData = incomeCategories.length > 0 && total > 0;

    incomePieChart.data.labels = hasData ? incomeCategories.map((c) => c.name) : ['Sem receitas'];
    incomePieChart.data.datasets[0].data = hasData ? incomeCategories.map((c) => c.value) : [1];
    incomePieChart.data.datasets[0].backgroundColor = hasData
      ? incomeCategories.map((c) => c.color)
      : ['rgba(255, 255, 255, 0.08)'];
    incomePieChart.data.datasets[0].borderColor = hasData ? '#0F172A' : 'rgba(255, 255, 255, 0.05)';
    incomePieChart.data.datasets[0].borderWidth = hasData ? 3 : 1;
    incomePieChart.data.datasets[0].hoverOffset = hasData ? 6 : 0;
    incomePieChart.options.plugins.tooltip.enabled = hasData;
    incomePieChart.update();
    incomePieChart.resize();

    const list = document.getElementById('incomeCategoryList');
    if (list) {
      list.innerHTML = '';
      if (!hasData) {
        list.innerHTML = '<div class="pie-empty">Cadastre receitas para ver a distribuição</div>';
      } else {
        incomeCategories.forEach((c) => {
          const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
          const item = document.createElement('div');
          item.className = 'category-item';
          item.innerHTML = `
            <span class="cat-dot" style="background:${c.color}"></span>
            <span class="cat-name">${escapeHtml(c.name)}</span>
            <span class="cat-val">${fmtMoney(c.value)}</span>
            <span class="cat-pct">${pct}%</span>
          `;
          list.appendChild(item);
        });
      }
    }
  }

  function initReportChart() {
    const oldCanvas = document.getElementById('reportChart');
    if (!oldCanvas) return;
    
    // Carregar Chart.js sob demanda
    if (!window.Chart) {
      console.warn('Chart.js não está disponível. O gráfico de relatório será exibido quando a biblioteca estiver carregada.');
      return;
    }
    
    let canvas = oldCanvas;
    
    // Se houver instância anterior, tentar destruir
    if (reportChart) {
      if (typeof reportChart.destroy === 'function') {
        try {
          reportChart.destroy();
        } catch (e) {
          // Se falhar, recriar o canvas inteiro
          console.warn('Canvas reuse issue detected. Recreating canvas element...');
          const container = oldCanvas.parentElement;
          const newCanvas = document.createElement('canvas');
          newCanvas.id = 'reportChart';
          newCanvas.width = 860;
          newCanvas.height = 350;
          container.innerHTML = '';
          container.appendChild(newCanvas);
          canvas = newCanvas;
        }
      }
    }
    
    const ctx = canvas.getContext('2d');
    reportChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Receitas',
            data: incomeData,
            backgroundColor: createGradient(ctx, 340, 'rgba(0,255,136,0.15)', 'rgba(0,255,136,0.7)'),
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Despesas',
            data: expenseData,
            backgroundColor: createGradient(ctx, 340, 'rgba(255,84,112,0.15)', 'rgba(255,84,112,0.7)'),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B' }, border: { display: false } },
          y: {
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { color: '#64748B', callback: (v) => 'R$' + (v / 1000).toFixed(1) + 'k' },
            border: { display: false },
          },
        },
      },
    });
  }

  const rangeSelect = document.querySelector('.range-select');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      let labels = months;
      let inc = incomeData;
      let exp = expenseData;
      if (val.includes('6 meses')) {
        labels = months.slice(-6);
        inc = incomeData.slice(-6);
        exp = expenseData.slice(-6);
      } else if (val.includes('30 dias')) {
        const now = new Date();
        const bins = Array.from({length:5},(_,i)=>({inc:0,exp:0,label:`${i*6+1}–${Math.min((i+1)*6,30)} dias`}));
        const addToBin=(date,value,key)=>{ if(!date) return; const d=new Date(String(date).includes('T')?date:`${date}T00:00:00`); if(Number.isNaN(d.getTime())) return; const diff=Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000); if(diff<0||diff>=30) return; const idx=Math.min(4,Math.floor(diff/6)); bins[4-idx][key]+=Number(value)||0; };
        receitas.forEach(r=>addToBin(r.data,r.valor,'inc'));
        despesas.forEach(d=>addToBin(d.data,d.valor,'exp'));
        labels=bins.map(b=>b.label); inc=bins.map(b=>b.inc); exp=bins.map(b=>b.exp);
      }
      if (cashflowChart) {
        cashflowChart.data.labels = labels;
        cashflowChart.data.datasets[0].data = inc;
        cashflowChart.data.datasets[1].data = exp;
        cashflowChart.update();
      }
    });
  }

  // ==================== TIPO DE PESSOA & PROFILE ====================
  const personType = document.getElementById('personType');
  const personName = document.getElementById('personName');
  const personDoc = document.getElementById('personDoc');
  const personEmail = document.getElementById('personEmail');
  const docLabel = document.getElementById('docLabel');

  function updatePersonFields() {
    const isJuridica = personType && personType.value === 'juridica';
    if (docLabel) docLabel.textContent = isJuridica ? 'CNPJ' : 'CPF';
    if (personDoc) {
      personDoc.placeholder = isJuridica ? '00.000.000/0000-00' : '000.000.000-00';
      personDoc.maxLength = isJuridica ? 18 : 14;
    }
  }

  if (personType) {
    personType.addEventListener('change', updatePersonFields);
    updatePersonFields();
  }

  // ==================== PROFILE MANAGEMENT ====================
  // `profiles` and `currentProfileId` já foram inicializados acima.
  
  // Configurar chaves de storage baseadas no perfil atual
  if (currentProfileId) {
    STORAGE_KEYS = getProfileStorageKeys(currentProfileId);
  }

  // Elementos do DOM
  const profilesGrid = document.getElementById('profilesGrid');
  const profilesEmptyState = document.getElementById('profilesEmptyState');
  const profileCount = document.getElementById('profileCount');
  const addProfileBtn = document.getElementById('addProfileBtn');
  const profileModal = document.getElementById('profileModal');
  const profileForm = document.getElementById('profileForm');
  const profileModalTitle = document.getElementById('profileModalTitle');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const cancelProfileBtn = document.getElementById('cancelProfileBtn');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const profileType = document.getElementById('profileType');
  const profileDocLabel = document.getElementById('profileDocLabel');
  const profileDoc = document.getElementById('profileDoc');

  // Funções auxiliares para perfis
  function generateProfileId() {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function saveProfiles() {
    setJSONToStorage(STORAGE_KEYS.profiles, profiles);
  }

  function saveCurrentProfileId(id) {
    setToStorage(STORAGE_KEYS.currentProfileId, id);
    currentProfileId = id;
  }

  function getProfileById(id) {
    return profiles.find(p => p.id === id);
  }

  function updateProfileFields() {
    const isJuridica = profileType && profileType.value === 'juridica';
    if (profileDocLabel) profileDocLabel.textContent = isJuridica ? 'CNPJ *' : 'CPF *';
    if (profileDoc) {
      profileDoc.placeholder = isJuridica ? '00.000.000/0000-00' : '000.000.000-00';
      profileDoc.maxLength = isJuridica ? 18 : 14;
    }
  }

  // Renderizar lista de perfis
  function renderProfiles() {
    if (!profilesGrid) return;
    
    profilesGrid.innerHTML = '';
    
    if (profiles.length === 0) {
      profilesGrid.style.display = 'none';
      if (profilesEmptyState) profilesEmptyState.style.display = 'block';
      if (profileCount) profileCount.textContent = '0 perfis';
      return;
    }
    
    profilesGrid.style.display = 'grid';
    if (profilesEmptyState) profilesEmptyState.style.display = 'none';
    if (profileCount) profileCount.textContent = `${profiles.length} perfil${profiles.length !== 1 ? 's' : ''}`;
    
    // Calcular valores dinâmicos para o perfil atual
    const dynamicReceitas = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const dynamicDespesas = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
    const dynamicSaldo = dynamicReceitas - dynamicDespesas;
    
    profiles.forEach(profile => {
      // Se for o perfil atual, usar valores dinâmicos calculados
      let displaySaldo = profile.saldo || 0;
      let displayReceitas = profile.salario || 0;
      let displayDespesas = profile.despesas || 0;
      
      if (profile.id === currentProfileId) {
        displaySaldo = dynamicSaldo;
        displayReceitas = dynamicReceitas;
        displayDespesas = dynamicDespesas;
        
        // Atualizar o perfil com os valores calculados
        profile.saldo = dynamicSaldo;
        profile.salario = dynamicReceitas;
        profile.despesas = dynamicDespesas;
      }
      
      const card = document.createElement('div');
      card.className = `profile-card${profile.id === currentProfileId ? ' active' : ''}`;
      card.innerHTML = `
        <div class="profile-card-header">
          <div class="profile-card-avatar">
            <i data-lucide="user-round"></i>
          </div>
          <div class="profile-card-info">
            <h4>${profile.name}</h4>
            <p>${profile.email}</p>
          </div>
        </div>
        <div class="profile-card-meta">
          <span class="profile-card-badge ${profile.type === 'juridica' ? 'juridica' : ''}">
            ${profile.type === 'juridica' ? 'PJ' : 'PF'}
          </span>
          <span class="profile-card-badge">${profile.doc}</span>
        </div>
        <div class="profile-card-stats">
          <div class="profile-card-stat">
            <div class="profile-card-stat-label">Saldo</div>
            <div class="profile-card-stat-value">${formatCurrency(displaySaldo)}</div>
          </div>
          <div class="profile-card-stat">
            <div class="profile-card-stat-label">Receitas</div>
            <div class="profile-card-stat-value">${formatCurrency(displayReceitas)}</div>
          </div>
          <div class="profile-card-stat">
            <div class="profile-card-stat-label">Despesas</div>
            <div class="profile-card-stat-value">${formatCurrency(displayDespesas)}</div>
          </div>
        </div>
        <div class="profile-card-actions">
          <button class="btn-edit" onclick="switchProfile('${profile.id}')" ${profile.id === currentProfileId ? 'disabled' : ''}>
            <i data-lucide="log-in"></i> Entrar
          </button>
          <button class="btn-edit" onclick="editProfile('${profile.id}')">
            <i data-lucide="edit"></i> Editar
          </button>
          <button class="btn-delete" onclick="deleteProfile('${profile.id}')">
            <i data-lucide="trash-2"></i> Excluir
          </button>
        </div>
      `;
      
      profilesGrid.appendChild(card);
    });
    
    // Salvar perfis atualizados
    saveProfiles();
    refreshIcons();
  }

  // Renderizar perfil atual
  function renderCurrentProfile() {
    if (!currentProfileId) {
      // Se não tem perfil atual, tenta criar um ou mostrar estado vazio
      currentProfile = null;
      updateCurrentProfileUI();
      return;
    }
    
    currentProfile = getProfileById(currentProfileId);
    updateCurrentProfileUI();
  }

  function updateCurrentProfileUI() {
    const currentProfileName = document.getElementById('currentProfileName');
    const currentProfileEmail = document.getElementById('currentProfileEmail');
    const currentProfileType = document.getElementById('currentProfileType');
    const currentProfileDoc = document.getElementById('currentProfileDoc');
    const currentProfileBalance = document.getElementById('currentProfileBalance');
    const currentProfileIncome = document.getElementById('currentProfileIncome');
    const currentProfileExpenses = document.getElementById('currentProfileExpenses');
    
    // Calcular valores dinâmicos baseados nas transações atuais
    const dynamicReceitas = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const dynamicDespesas = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
    const dynamicSaldo = dynamicReceitas - dynamicDespesas;
    
    if (currentProfile) {
      if (currentProfileName) currentProfileName.textContent = currentProfile.name;
      if (currentProfileEmail) currentProfileEmail.textContent = currentProfile.email;
      if (currentProfileType) currentProfileType.textContent = currentProfile.type === 'juridica' ? 'Pessoa Jurídica' : 'Pessoa Física';
      if (currentProfileDoc) currentProfileDoc.textContent = currentProfile.doc;
      // Usar valores dinâmicos calculados das transações
      if (currentProfileBalance) currentProfileBalance.textContent = formatCurrency(dynamicSaldo);
      if (currentProfileIncome) currentProfileIncome.textContent = formatCurrency(dynamicReceitas);
      if (currentProfileExpenses) currentProfileExpenses.textContent = formatCurrency(dynamicDespesas);
      
      // Atualizar o perfil com os valores calculados
      currentProfile.saldo = dynamicSaldo;
      currentProfile.salario = dynamicReceitas;
      currentProfile.despesas = dynamicDespesas;
      saveProfiles();
    } else {
      if (currentProfileName) currentProfileName.textContent = '-';
      if (currentProfileEmail) currentProfileEmail.textContent = '-';
      if (currentProfileType) currentProfileType.textContent = '-';
      if (currentProfileDoc) currentProfileDoc.textContent = '-';
      if (currentProfileBalance) currentProfileBalance.textContent = 'R$ 0,00';
      if (currentProfileIncome) currentProfileIncome.textContent = 'R$ 0,00';
      if (currentProfileExpenses) currentProfileExpenses.textContent = 'R$ 0,00';
    }
    
    // Update dropdown as well
    updateProfileDropdown();
    if (typeof syncAuthenticatedUserUI === 'function') syncAuthenticatedUserUI();
  }

  // Abrir modal para novo perfil
  function openNewProfileModal() {
    if (profileForm) profileForm.reset();
    if (profileModalTitle) profileModalTitle.textContent = 'Novo Perfil';
    if (document.getElementById('profileId')) document.getElementById('profileId').value = '';
    if (profileType) profileType.value = 'fisica';
    updateProfileFields();
    if (document.getElementById('profilePassword')) document.getElementById('profilePassword').required = !firebaseAuthenticated;
    if (document.getElementById('profileConfirmPassword')) document.getElementById('profileConfirmPassword').required = !firebaseAuthenticated;
    if (profileModal) profileModal.classList.add('active');
  }

  // Abrir modal para editar perfil
  function editProfile(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) return;
    
    if (profileModalTitle) profileModalTitle.textContent = 'Editar Perfil';
    if (document.getElementById('profileId')) document.getElementById('profileId').value = profile.id;
    if (document.getElementById('profileName')) document.getElementById('profileName').value = profile.name;
    if (document.getElementById('profileEmail')) document.getElementById('profileEmail').value = profile.email;
    if (profileType) profileType.value = profile.type;
    if (profileDoc) profileDoc.value = profile.doc;
    if (document.getElementById('profileSaldo')) document.getElementById('profileSaldo').value = profile.saldo || 0;
    if (document.getElementById('profileSalario')) document.getElementById('profileSalario').value = profile.salario || 0;
    
    // Não mostrar campos de senha ao editar
    if (document.getElementById('profilePassword')) document.getElementById('profilePassword').value = '';
    if (document.getElementById('profileConfirmPassword')) document.getElementById('profileConfirmPassword').value = '';
    if (document.getElementById('profilePassword')) document.getElementById('profilePassword').required = false;
    if (document.getElementById('profileConfirmPassword')) document.getElementById('profileConfirmPassword').required = false;
    
    updateProfileFields();
    if (profileModal) profileModal.classList.add('active');
  }

  // Fechar modal
  function closeProfileModalHandler() {
    if (profileModal) profileModal.classList.remove('active');
    if (profileForm) profileForm.reset();
    // Restaurar validação de senha
    if (document.getElementById('profilePassword')) document.getElementById('profilePassword').required = !firebaseAuthenticated;
    if (document.getElementById('profileConfirmPassword')) document.getElementById('profileConfirmPassword').required = !firebaseAuthenticated;
  }

  // Salvar perfil
  async function saveProfile() {
    const profileId = document.getElementById('profileId').value;
    const name = document.getElementById('profileName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const type = profileType ? profileType.value : 'fisica';
    const doc = profileDoc ? profileDoc.value.trim() : '';
    const password = document.getElementById('profilePassword').value;
    const confirmPassword = document.getElementById('profileConfirmPassword').value;
    const saldo = parseMoneyInput(document.getElementById('profileSaldo').value) || 0;
    const salario = parseMoneyInput(document.getElementById('profileSalario').value) || 0;
    
    // Validação
    if (!name || !email || !doc) {
      showToast('Preencha todos os campos obrigatórios.');
      return;
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('E-mail inválido.');
      return;
    }
    
    // Se é novo perfil, validar senha
    if (!profileId && !firebaseAuthenticated) {
      if (!password || !confirmPassword) {
        showToast('Preencha os campos de senha.');
        return;
      }
      if (password !== confirmPassword) {
        showToast('As senhas não coincidem.');
        return;
      }
      if (password.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }
    
    // Verificar email duplicado
    const emailExists = profiles.some(p => p.email === email && p.id !== profileId);
    if (emailExists) {
      showToast('Este e-mail já está cadastrado.');
      return;
    }
    
    // Verificar nome duplicado
    const nameExists = profiles.some(p => p.name === name && p.id !== profileId);
    if (nameExists) {
      showToast('Este nome já está cadastrado. Use um nome diferente.');
      return;
    }
    
    // Verificar senha duplicado (apenas para novos perfis)
    if (!profileId && !firebaseAuthenticated && password) {
      const passwordExists = profiles.some(p => p.password === password);
      if (passwordExists) {
        showToast('Esta senha já está em uso. Use uma senha diferente.');
        return;
      }
    }
    
    if (profileId) {
      // Editar perfil existente
      const index = profiles.findIndex(p => p.id === profileId);
      if (index !== -1) {
        profiles[index] = {
          ...profiles[index],
          name,
          email,
          type,
          doc,
          saldo,
          salario,
          despesas: profiles[index].despesas || 0
        };
        if (String(profileId) === String(currentProfileId)) {
          currentProfile = profiles[index];
          if (typeof persistAuthenticatedUser === 'function') persistAuthenticatedUser(currentProfile);
        }
          if (firebaseAuthenticated && String(profileId) === String(currentLocalUser?.id)) {
            if (email.toLowerCase() !== String(currentLocalUser.email || '').toLowerCase()) {
              showToast('O e-mail de autenticação deve ser alterado pelo fluxo de verificação do Firebase.');
              profiles[index].email = currentLocalUser.email;
              currentProfile.email = currentLocalUser.email;
            }
            try {
              const firebase = await getFirebaseClient();
              const updatedUser = await firebase.updateDisplayName(name);
              currentLocalUser = { ...updatedUser, id: updatedUser.uid, name: updatedUser.displayName };
            } catch (error) {
              console.error('Não foi possível atualizar o perfil Firebase:', error);
              showToast(authErrorMessage(error), 'warning');
              return;
            }
          }
        showToast('Perfil atualizado com sucesso!');
      }
    } else {
      // Criar novo perfil
      const newProfile = {
        id: generateProfileId(),
        name,
        email,
        type,
        doc,
        saldo,
        salario,
        despesas: 0,
        createdAt: new Date().toISOString()
      };
      profiles.push(newProfile);
      
      // Se é o primeiro perfil, definir como atual
      if (profiles.length === 1) {
        saveCurrentProfileId(newProfile.id);
        currentProfileId = newProfile.id;
        
        // Configurar chaves de storage para o novo perfil
        STORAGE_KEYS = getProfileStorageKeys(newProfile.id);
        
        // Inicializar dados vazios para o novo perfil
        receitas = [];
        despesas = [];
        contas = [];
        cartoes = [];
        investimentos = [];
        goals = [];
        saldoAtual = 0;
        salarioMensal = 0;
        economiaMes = 0;
        receitasMes = 0;
        despesasMes = 0;
        incomeData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        expenseData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        categories = [];
        
        // Salvar dados iniciais vazios para o novo perfil
        saveCurrentProfileData();
      }
      
      showToast('Perfil criado com sucesso!');
    }
    
    saveProfiles();
    renderProfiles();
    renderCurrentProfile();
    if (firebaseAuthenticated) scheduleServerSync();
    if (typeof syncAuthenticatedUserUI === 'function') syncAuthenticatedUserUI();
    closeProfileModalHandler();
    
    // Atualizar lista de perfis existentes no modal de cadastro
    updateExistingProfilesList();
  }

  // Deletar perfil
  function deleteProfile(profileId) {
    if (profileId === currentProfileId) {
      // Se for o perfil atual, excluir a conta completamente
      if (confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita e todos os seus dados serão permanentemente excluídos.')) {
        // Limpar dados do perfil atual
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Remover o perfil da lista de perfis
        profiles = profiles.filter(p => p.id !== currentProfileId);
        setJSONToStorage(BASE_STORAGE_KEYS.profiles, profiles);
        
        // Limpar ID do perfil atual
        localStorage.removeItem(BASE_STORAGE_KEYS.currentProfileId);
        
        // Limpar dados globais
        localStorage.removeItem(getScopedStorageKey('prisma_recomendacoes_aplicadas', profileId));
            
        // Recarregar a página para voltar à tela de cadastro
        location.reload();
      }
      return;
    }
    
    if (confirm('Tem certeza que deseja excluir este perfil? Esta ação não pode ser desfeita.')) {
      // Remover dados específicos do perfil
      const profileKeys = getProfileStorageKeys(profileId);
      Object.values(profileKeys).forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Remover o perfil da lista
      profiles = profiles.filter(p => p.id !== profileId);
      saveProfiles();
      renderProfiles();
      showToast('Perfil excluído com sucesso.');
      
      // Atualizar lista de perfis existentes no modal de cadastro
      updateExistingProfilesList();
    }
  }

  // Alternar para perfil
  function switchProfile(profileId) {
    if (profileId === currentProfileId) return;
    
    const profile = getProfileById(profileId);
    if (!profile) return;
    
    // Salvar dados do perfil atual antes de alternar
    if (!saveCurrentProfileData()) {
      showToast('Não foi possível salvar os dados locais. A troca de perfil foi cancelada.', 'warning');
      return;
    }
    
    // Atualizar ID do perfil atual
    saveCurrentProfileId(profileId);
    currentProfileId = profileId;
    
    // Carregar dados do novo perfil
    loadProfileData(profileId);
    
    // Atualizar interface
    renderProfiles();
    renderCurrentProfile();
    showToast(`Bem-vindo, ${profile.name}!`);
  }

  // Encerra somente a sessão e preserva cadastro e dados financeiros locais.
  async function logoutProfile() {
    if (!confirm('Deseja realmente encerrar a sessão?')) return;
    try {
      if (currentProfileId && !saveCurrentProfileData()) {
        throw new Error('Uma ou mais informações não puderam ser gravadas no armazenamento local.');
      }
    } catch (error) {
      console.error('Não foi possível salvar os dados antes do logout:', error);
      if (firebaseAuthenticated && !(await syncServerStateNow())) {
        throw new Error('Não foi possível sincronizar os dados com o Firestore. O logout foi cancelado para evitar perda de informações.');
      }
      if (firebaseAuthenticated) {
        const firebase = await getFirebaseClient();
        await firebase.logout();
      }
      showToast(error.message || 'Não foi possível salvar os dados antes do logout.', 'warning');
      return;
    }
    cleanLocalUserData();
    const app = document.getElementById('mainApp') || document.querySelector('.app');
    if (app) app.style.display = 'none';
    hideLgpdScreen();
    hideWelcomeScreen();
    window.history.replaceState({ screen: 'login' }, '', window.location.pathname);
    showLoginModal();
    showToast('Sessão encerrada com sucesso.');
  }

  // Excluir conta completamente
  async function deleteAccount() {
    if (!currentProfileId || !firebaseAuthenticated) return;
    if (!confirm('Tem certeza que deseja excluir sua conta Firebase e os dados salvos na nuvem? Esta ação não pode ser desfeita. As cópias locais deste navegador serão preservadas.')) return;
    const password = window.prompt('Confirme sua senha para excluir a conta:');
    if (password === null) return;
    try {
      if (!(await syncServerStateNow())) {
        throw new Error('Não foi possível sincronizar os dados antes da exclusão da conta.');
      }
      const firebase = await getFirebaseClient();
      await firebase.deleteAccount(password);
      showToast('Conta e dados na nuvem excluídos. As cópias locais foram preservadas.');
    } catch (error) {
      console.error('Não foi possível excluir a conta Firebase:', error);
      showToast(authErrorMessage(error), 'warning');
    }
  }

  // Event listeners
  if (addProfileBtn) {
    addProfileBtn.addEventListener('click', openNewProfileModal);
  }

  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', closeProfileModalHandler);
  }

  if (cancelProfileBtn) {
    cancelProfileBtn.addEventListener('click', closeProfileModalHandler);
  }

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveProfile();
    });
  }

  if (profileType) {
    profileType.addEventListener('change', updateProfileFields);
  }

  const editCurrentProfileBtn = document.getElementById('editCurrentProfileBtn');
  if (editCurrentProfileBtn) {
    editCurrentProfileBtn.addEventListener('click', () => {
      if (currentProfileId) {
        editProfile(currentProfileId);
      }
    });
  }

  const logoutProfileBtn = document.getElementById('logoutProfileBtn');
  if (logoutProfileBtn) {
    logoutProfileBtn.addEventListener('click', logoutProfile);
  }

  const logoutBtnConfig = document.getElementById('logoutBtnConfig');
  if (logoutBtnConfig) {
    logoutBtnConfig.addEventListener('click', (e) => {
      e.preventDefault();
      logoutProfile();
    });
  }

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', deleteAccount);
  }

  const switchAccountBtn = document.getElementById('switchAccountBtn');
  if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', () => {
      // Filtrar perfis diferentes do atual
      const otherProfiles = profiles.filter(p => p.id !== currentProfileId);
      
      if (otherProfiles.length === 0) {
        showToast('Não há outras contas disponíveis para alternar.');
        return;
      }
      
      // Criar um prompt simples para selecionar a conta
      let message = 'Selecione a conta para alternar:\n\n';
      otherProfiles.forEach((profile, index) => {
        message += `${index + 1}. ${profile.name} (${profile.email})\n`;
      });
      message += '\nDigite o número da conta desejada:';
      
      const selection = prompt(message);
      
      if (selection === null) {
        // Usuário cancelou
        return;
      }
      
      const selectedIndex = parseInt(selection) - 1;
      
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= otherProfiles.length) {
        showToast('Seleção inválida. Tente novamente.');
        return;
      }
      
      const selectedProfile = otherProfiles[selectedIndex];
      
      // Usar a função atualizada de switchProfile que já inclui salvamento e carregamento de dados
      switchProfile(selectedProfile.id);
    });
  }

  // ==================== PROFILE DROPDOWN ====================
  const avatarDropdownBtn = document.getElementById('avatarDropdownBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  const dropdownEditProfile = document.getElementById('dropdownEditProfile');
  const dropdownLogout = document.getElementById('dropdownLogout');

  // Update dropdown with current profile data
  function updateProfileDropdown() {
    if (!profileDropdown) return;

    const dropdownProfileName = document.getElementById('dropdownProfileName');
    const dropdownProfileEmail = document.getElementById('dropdownProfileEmail');
    const dropdownProfileBalance = document.getElementById('dropdownProfileBalance');
    const dropdownProfileIncome = document.getElementById('dropdownProfileIncome');
    const dropdownProfileExpenses = document.getElementById('dropdownProfileExpenses');

    // Nome/e-mail sempre da fonte autenticada
    if (typeof syncAuthenticatedUserUI === 'function') {
      syncAuthenticatedUserUI();
    } else {
      const user = (typeof resolveAuthenticatedUser === 'function') ? resolveAuthenticatedUser() : null;
      if (dropdownProfileName) dropdownProfileName.textContent = (user && user.name) || (currentProfile && currentProfile.name) || 'Usuário';
      if (dropdownProfileEmail) dropdownProfileEmail.textContent = (user && user.email) || (currentProfile && currentProfile.email) || '—';
    }

    if (!currentProfile) return;

    // Calcular valores dinâmicos baseados nas transações atuais
    const dynamicReceitas = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const dynamicDespesas = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
    const dynamicSaldo = dynamicReceitas - dynamicDespesas;

    // Usar valores dinâmicos calculados das transações
    if (dropdownProfileBalance) dropdownProfileBalance.textContent = formatCurrency(dynamicSaldo);
    if (dropdownProfileIncome) dropdownProfileIncome.textContent = formatCurrency(dynamicReceitas);
    if (dropdownProfileExpenses) dropdownProfileExpenses.textContent = formatCurrency(dynamicDespesas);
  }

  // Toggle dropdown
  function toggleProfileDropdown() {
    if (profileDropdown && window.PrismaNavbar) {
      window.PrismaNavbar.toggle('profile');
    } else if (profileDropdown) {
      profileDropdown.classList.toggle('show');
      profileDropdown.setAttribute('aria-hidden', profileDropdown.classList.contains('show') ? 'false' : 'true');
      updateProfileDropdown();
    }
  }

  // Event listeners for dropdown
  if (avatarDropdownBtn) {
    avatarDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }

  if (dropdownEditProfile) {
    dropdownEditProfile.addEventListener('click', () => {
      if (currentProfileId) {
        editProfile(currentProfileId);
      }
      if (window.PrismaNavbar) window.PrismaNavbar.close('profile', { restoreFocus: false });
      else if (profileDropdown) profileDropdown.classList.remove('show');
    });
  }

  if (dropdownLogout) {
    dropdownLogout.addEventListener('click', () => {
      logoutProfile();
      if (window.PrismaNavbar) window.PrismaNavbar.close('profile', { restoreFocus: false });
      else if (profileDropdown) profileDropdown.classList.remove('show');
    });
  }

  // Funções globais para chamadas onclick
  window.switchProfile = switchProfile;
  window.editProfile = editProfile;
  window.deleteProfile = deleteProfile;

  // Inicialização
  // Carregar dados do perfil atual se existir
  if (currentProfileId) {
    loadProfileData(currentProfileId);
  }
  
  renderProfiles();
  renderCurrentProfile();

  // ==================== ENVIO DE PDF PELO BACKEND ====================
  const testEmailBtn = document.getElementById('testEmailBtn');
  const emailDeliveryRecipient = document.getElementById('emailDeliveryRecipient');

  async function getAuthenticatedUserForEmail() {
    const user = currentLocalUser || (serverAuthenticated ? currentServerUser : null);
    if (!user?.email) throw new Error('Conta sem e-mail válido.');
    if (emailDeliveryRecipient) emailDeliveryRecipient.textContent = user.email;
    return user;
  }

  getAuthenticatedUserForEmail().catch(() => {
    if (emailDeliveryRecipient) emailDeliveryRecipient.textContent = 'E-mail da conta autenticada';
  });

  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async () => {
      try {
        await getAuthenticatedUserForEmail();
        showToast('O envio de PDFs utiliza o serviço seguro configurado no servidor. Selecione um material na Educação Financeira para testar o envio.');
      } catch (error) {
        showToast('Não foi possível identificar o e-mail da conta.');
      }
    });
  }

  // O destinatário é local; o envio continua usando o serviço backend de e-mail.

  // ==================== GENERATE PDF ====================

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibrary() {
    const hasLibrary = !!(window.jspdf && (window.jspdf.jsPDF || window.jsPDF));
    if (hasLibrary) return (window.jspdf?.jsPDF || window.jsPDF);

    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    } catch (error) {
      console.error('Erro ao carregar jsPDF:', error);
      throw new Error('Não foi possível carregar a biblioteca de PDF.');
    }

    const ctor = window.jspdf?.jsPDF || window.jsPDF;
    if (!ctor) {
      throw new Error('Biblioteca jsPDF não inicializada.');
    }
    return ctor;
  }


  // ==================== PDF SHARED HELPERS ====================
  const PRISMA_PDF_LOGO_B64 = 'data:image/png;base64,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';

  let __prismaLogoCache = null;
  let __prismaLogoMeta = null;
  async function loadPrismaLogoForPDF() {
    if (__prismaLogoCache && __prismaLogoMeta) {
      return __prismaLogoCache;
    }
    // Preferir assets já dimensionados para documento; mark grande só como fallback
    const candidates = [
      'assets/images/logo-pdf.png',
      'assets/images/logo-prisma-pdf.png',
      'assets/images/logo-mark.png',
      'assets/images/logo.png'
    ];

    // Resolução máxima no canvas: suficiente p/ ~48pt @ 3x no PDF, sem base64 gigante
    const PDF_LOGO_MAX_PX = 256;
    const HEADER_BG = '#081C3F';

    /**
     * Compõe a logo sobre o azul do cabeçalho e limita o canvas.
     * - Preserva aspect ratio
     * - Evita processar 835×835 quando o PDF só usa ~40pt
     * - PNG (não JPEG) para bordas nítidas
     * - Fundo opaco = transparência visual estável em leitores PDF
     */
    function composeLogoForPdf(img) {
      try {
        const nw = img.naturalWidth || img.width || 0;
        const nh = img.naturalHeight || img.height || 0;
        if (!nw || !nh) return null;

        const scale = Math.min(1, PDF_LOGO_MAX_PX / Math.max(nw, nh));
        const w = Math.max(1, Math.round(nw * scale));
        const h = Math.max(1, Math.round(nh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return null;

        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = HEADER_BG;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/png');
        // Libera referência o quanto antes (GC)
        canvas.width = 0;
        canvas.height = 0;
        return {
          dataUrl,
          naturalWidth: w,
          naturalHeight: h,
          aspect: w / h
        };
      } catch (_) {
        return null;
      }
    }

    function loadImage(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        try { img.crossOrigin = 'anonymous'; } catch (_) {}
        // Versão estável: permite cache HTTP do browser/CDN (server envia max-age longo em .png)
        const ver = '20260911';
        img.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + ver;
      });
    }

    for (const src of candidates) {
      try {
        const img = await loadImage(src);
        if (!img) continue;
        const composed = composeLogoForPdf(img);
        if (!composed || !composed.dataUrl) continue;
        __prismaLogoCache = composed.dataUrl;
        __prismaLogoMeta = {
          naturalWidth: composed.naturalWidth,
          naturalHeight: composed.naturalHeight,
          aspect: composed.aspect,
          format: 'PNG',
          source: src
        };
        return __prismaLogoCache;
      } catch (_) { /* próximo candidato */ }
    }

    // Fallback embutido (base64)
    if (typeof PRISMA_PDF_LOGO_B64 === 'string' && PRISMA_PDF_LOGO_B64.indexOf('base64,') > 0) {
      const img = await new Promise((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => resolve(null);
        i.src = PRISMA_PDF_LOGO_B64;
      });
      if (img) {
        const composed = composeLogoForPdf(img);
        if (composed && composed.dataUrl) {
          __prismaLogoCache = composed.dataUrl;
          __prismaLogoMeta = {
            naturalWidth: composed.naturalWidth,
            naturalHeight: composed.naturalHeight,
            aspect: composed.aspect,
            format: 'PNG',
            source: 'embedded-composited'
          };
          return __prismaLogoCache;
        }
      }
      __prismaLogoCache = PRISMA_PDF_LOGO_B64;
      __prismaLogoMeta = { naturalWidth: 160, naturalHeight: 160, aspect: 1, format: 'PNG', source: 'embedded' };
      return __prismaLogoCache;
    }
    return null;
  }

  function fitLogoProportionally(meta, maxW, maxH) {
    const aspect = (meta && meta.aspect > 0)
      ? meta.aspect
      : ((meta && meta.naturalWidth && meta.naturalHeight)
        ? (meta.naturalWidth / meta.naturalHeight)
        : 1);
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    // Evita valores inválidos
    if (!Number.isFinite(w) || w <= 0) w = maxW;
    if (!Number.isFinite(h) || h <= 0) h = maxH;
    return { width: w, height: h, aspect };
  }

  function drawPrismaHeader(pdf, opts) {
    opts = opts || {};
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = opts.margin || 40;
    // Title = report name only (never the wordmark "Prisma" as logo text)
    let title = opts.title || 'Relatório Financeiro';
    if (/^prisma$/i.test(String(title).trim())) title = 'Relatório Financeiro';
    const subtitle = opts.subtitle || 'Gestão Financeira Inteligente';
    const logoData = opts.logoData || __prismaLogoCache;

    // Brand header band (template reference: dark navy + logo mark)
    pdf.setFillColor(8, 28, 63);
    pdf.rect(0, 0, pageWidth, 72, 'F');
    // Soft accent gradient bar at bottom of band
    pdf.setFillColor(15, 45, 95);
    pdf.rect(0, 64, pageWidth, 8, 'F');

    // Official Prisma mark — PNG, proporção original, sem distorção
    const headerBandH = 72;
    const maxLogoH = 40;
    const maxLogoW = 48;
    let logoW = 0;
    let logoH = 0;
    if (logoData) {
      try {
        const meta = __prismaLogoMeta || { aspect: 1, format: 'PNG' };
        const fitted = fitLogoProportionally(meta, maxLogoW, maxLogoH);
        logoW = fitted.width;
        logoH = fitted.height;
        const format = (meta.format === 'JPEG' || (typeof logoData === 'string' && logoData.indexOf('image/jpeg') !== -1))
          ? 'JPEG' : 'PNG';
        // Centraliza verticalmente na faixa do cabeçalho
        const logoY = Math.max(12, (headerBandH - 8 - logoH) / 2);
        pdf.addImage(logoData, format, margin, logoY, logoW, logoH);
      } catch (e) {
        console.warn('Logo PDF:', e);
        logoW = 0;
        logoH = 0;
      }
    }

    const textX = margin + (logoW ? logoW + 14 : 0);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, textX, 34);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(186, 210, 240);
    pdf.text(subtitle, textX, 50);

    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    pdf.setFontSize(8);
    pdf.setTextColor(226, 232, 240);
    pdf.text(`Gerado em ${today}`, pageWidth - margin, 32, { align: 'right' });
    pdf.setTextColor(148, 163, 184);
    pdf.text(time, pageWidth - margin, 46, { align: 'right' });

    // Content starts below dark brand header
    let y = 90;
    if (opts.showProfile !== false) {
      const pType = (typeof personType !== 'undefined' && personType && personType.value === 'juridica')
        ? 'Pessoa Jurídica' : 'Pessoa Física';
      const pName = (typeof personName !== 'undefined' && personName) ? (personName.value || '') : '';
      const pDoc = (typeof personDoc !== 'undefined' && personDoc) ? (personDoc.value || '') : '';
      const profileName = (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.name)
        ? currentProfile.name
        : (pName || 'Usuário Prisma');
      const docLabel = pType === 'Pessoa Jurídica' ? 'CNPJ' : 'CPF';

      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(margin, y - 12, pageWidth - margin * 2, 28, 5, 5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(profileName, margin + 10, y + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      const meta = [pType];
      if (pDoc) meta.push(`${docLabel}: ${pDoc}`);
      pdf.text(meta.join('  ·  '), pageWidth - margin - 10, y + 4, { align: 'right' });
      y += 30;
    }
    return y;
  }

  function drawPrismaFooterAllPages(pdf, opts) {
    opts = opts || {};
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = opts.margin || 40;
    const total = pdf.internal.getNumberOfPages();
    const disclaimer = opts.disclaimer || 'Os dados apresentados são baseados nas informações cadastradas pelo usuário.';
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Prisma – Gestão Financeira Inteligente', margin, pageHeight - 22);
      pdf.setTextColor(148, 163, 184);
      pdf.text(disclaimer, margin, pageHeight - 12);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Página ${i} de ${total}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
    }
  }

  function pdfSectionTitle(pdf, text, margin, y) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(text, margin, y);
    const w = pdf.getTextWidth(text);
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(1.4);
    pdf.line(margin, y + 3, margin + Math.min(w, 140), y + 3);
    return y + 16;
  }

  function pdfTruncate(pdf, value, maxWidth) {
    const text = String(value ?? '');
    if (!text || !Number.isFinite(maxWidth) || maxWidth <= 0) return '';
    if (pdf.getTextWidth(text) <= maxWidth) return text;

    let truncated = text;
    while (truncated.length > 1 && pdf.getTextWidth(`${truncated}…`) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  function pdfDrawKpiRow(pdf, items, margin, y, contentWidth) {
    const n = items.length;
    const gap = 8;
    const boxW = (contentWidth - gap * (n - 1)) / n;
    const boxH = 56;
    items.forEach((item, i) => {
      const x = margin + i * (boxW + gap);
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(x, y, boxW, boxH, 5, 5, 'FD');
      const c = item.color || [37, 99, 235];
      pdf.setFillColor(c[0], c[1], c[2]);
      pdf.rect(x, y, 3, boxH, 'F');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(item.label, x + 12, y + 18);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      const val = pdfTruncate(pdf, String(item.value), boxW - 20);
      pdf.text(val, x + 12, y + 38);
    });
    return y + boxH + 16;
  }

  // ==================== END PDF HELPERS ====================


  async function generatePDF() {
    try {
      showToast('Carregando bibliotecas de PDF... Aguarde um momento.');
      const JsPDF = await ensurePdfLibrary();
      const logoData = await loadPrismaLogoForPDF();
      const pdf = new JsPDF('p', 'pt', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    let y = drawPrismaHeader(pdf, {
      margin,
      logoData,
      title: 'Prisma',
      subtitle: 'Relatório Financeiro — Gestão Inteligente',
      showProfile: true
    });
    y += 14;

    // Financial Summary
    y = pdfSectionTitle(pdf, 'Resumo Financeiro', margin, y);

    const isDebtSituation = receitasMes < despesasMes;
    const summary = [
      { label: 'Salário Mensal', value: fmtMoney(salarioMensal), color: [0, 180, 220] },
      { label: 'Saldo Atual', value: fmtMoney(saldoAtual), color: saldoAtual >= 0 ? [0, 200, 120] : [255, 84, 112] },
      { label: 'Receitas do Mês', value: fmtMoney(receitasMes), color: [0, 180, 220] },
      { label: 'Despesas do Mês', value: fmtMoney(despesasMes), color: [255, 84, 112] },
      { label: isDebtSituation ? 'Dívida' : 'Economia', value: fmtMoney(Math.abs(economiaMes)), color: isDebtSituation ? [255, 84, 112] : [124, 77, 255] },
    ];
    y = pdfDrawKpiRow(pdf, summary, margin, y, contentWidth);

    // Report Chart
    if (reportChart && typeof reportChart.toBase64Image === 'function') {
      y = pdfSectionTitle(pdf, 'Resumo por Período', margin, y);
      y += 6;

      try {
        const chartImg = reportChart.toBase64Image('image/png', 1);
        const chartWidth = contentWidth;
        const chartHeight = 160;

        if (chartImg && chartImg.startsWith('data:image/png')) {
          pdf.addImage(chartImg, 'PNG', margin, y, chartWidth, chartHeight);
          y += chartHeight + 35;
        } else {
          throw new Error('Imagem do gráfico indisponível');
        }
      } catch (error) {
        console.error('Erro ao incorporar grafico no PDF:', error);
        pdf.setFillColor(244, 247, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, y, contentWidth, 90, 8, 8, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text('Resumo por período disponível apenas em texto:', margin + 15, y + 24);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        const reportTotalReceitas = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
        const reportTotalDespesas = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
        pdf.text(`Receitas: ${formatCurrency(reportTotalReceitas)}`, margin + 15, y + 46);
        pdf.text(`Despesas: ${formatCurrency(reportTotalDespesas)}`, margin + 15, y + 62);
        y += 120;
      }
    }

    // Economy Recommendations Section
    const economiaData = gerarRecomendacoesEconomia();
    if (economiaData.numeroRecomendacoes > 0) {
      y = pdfSectionTitle(pdf, 'Recomendações de Economia', margin, y);
      y += 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Taxa de poupança atual: ${economiaData.taxaPoupancaAtual}`, margin, y);
      pdf.text(`Economia potencial: ${economiaData.economiaTotal}`, margin + 220, y);
      y += 20;

      economiaData.recomendacoes.forEach((rec, index) => {
        if (y > pdf.internal.pageSize.getHeight() - 200) {
          pdf.addPage();
          y = drawPrismaHeader(pdf, {
            margin, logoData,
            title: 'Prisma',
            subtitle: 'Relatório Financeiro — Gestão Inteligente',
            showProfile: false
          }) + 12;
        }

        // Badge de impacto
        const impactoColors = {
          'Alto': [220, 38, 38],
          'Médio': [245, 158, 11],
          'Baixo': [59, 130, 246]
        };
        const impactoColor = impactoColors[rec.impacto] || [100, 116, 139];

        // Obter detalhes expandidos da recomendação
        const detalhesExpandidos = obterDetalhesExpandidosRecomendacao(rec);

        // Calcular altura necessária baseada no conteúdo
        let alturaEstimada = 90; // Altura base
        if (detalhesExpandidos.contexto) alturaEstimada += 15;
        if (detalhesExpandidos.estrategias && detalhesExpandidos.estrategias.length > 0) {
          alturaEstimada += 15 + (Math.min(detalhesExpandidos.estrategias.length, 3) * 15);
        }
        if (detalhesExpandidos.prazo) alturaEstimada += 15;
        
        // Garantir altura mínima e máxima
        alturaEstimada = Math.max(130, Math.min(alturaEstimada, 180));

        pdf.setFillColor(244, 247, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, y, contentWidth, alturaEstimada, 8, 8, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${index + 1}. ${rec.categoria} (${rec.percentual})`, margin + 15, y + 25);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(59, 130, 246);
        
        // Quebrar linha se a sugestão for muito longa
        const sugestaoTexto = `Sugestao: ${rec.sugestao}`;
        const maxLargura = contentWidth - 30;
        const sugestaoLinhas = pdf.splitTextToSize(sugestaoTexto, maxLargura);
        
        if (Array.isArray(sugestaoLinhas)) {
          pdf.text(sugestaoLinhas, margin + 15, y + 42);
        } else {
          pdf.text(sugestaoTexto, margin + 15, y + 42);
        }

        let posAtual = y + 42 + (Array.isArray(sugestaoLinhas) ? sugestaoLinhas.length * 12 : 12);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(impactoColor[0], impactoColor[1], impactoColor[2]);
        pdf.text(`Economia: ${rec.economia} | Impacto: ${rec.impacto}`, margin + 15, posAtual + 8);

        // Adicionar detalhes expandidos
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        
        let detalheY = posAtual + 20;
        const linhaHeight = 14;
        
        if (detalhesExpandidos.contexto) {
          const contextoTexto = `Contexto: ${detalhesExpandidos.contexto}`;
          const contextoLinhas = pdf.splitTextToSize(contextoTexto, maxLargura);
          if (Array.isArray(contextoLinhas)) {
            pdf.text(contextoLinhas, margin + 15, detalheY);
            detalheY += contextoLinhas.length * 11;
          } else {
            pdf.text(contextoTexto, margin + 15, detalheY);
            detalheY += linhaHeight;
          }
        }
        
        if (detalhesExpandidos.estrategias && detalhesExpandidos.estrategias.length > 0) {
          pdf.text('Estratégias:', margin + 15, detalheY);
          detalheY += linhaHeight;
          detalhesExpandidos.estrategias.forEach((estrategia, i) => {
            if (i < 3) {
              const estrategiaTexto = `  • ${estrategia}`;
              const estrategiaLinhas = pdf.splitTextToSize(estrategiaTexto, maxLargura - 10);
              if (Array.isArray(estrategiaLinhas)) {
                pdf.text(estrategiaLinhas, margin + 15, detalheY);
                detalheY += estrategiaLinhas.length * 11;
              } else {
                pdf.text(estrategiaTexto, margin + 15, detalheY);
                detalheY += linhaHeight;
              }
            }
          });
        }
        
        if (detalhesExpandidos.prazo) {
          const prazoTexto = `Prazo sugerido: ${detalhesExpandidos.prazo}`;
          const prazoLinhas = pdf.splitTextToSize(prazoTexto, maxLargura);
          if (Array.isArray(prazoLinhas)) {
            pdf.text(prazoLinhas, margin + 15, detalheY);
            detalheY += prazoLinhas.length * 11;
          } else {
            pdf.text(prazoTexto, margin + 15, detalheY);
            detalheY += linhaHeight;
          }
        }

        y += alturaEstimada + 10;
      });

      y += 25;
    }

    // Transactions Table
    y = pdfSectionTitle(pdf, 'Últimas Transações', margin, y);
    y += 8;

    const theads = ['Categoria', 'Descrição', 'Conta', 'Valor', 'Data', 'Status'];
    const colWidths = [90, 140, 90, 90, 70, 70];
    const rowHeight = 26;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setFillColor(15, 23, 42);
    pdf.setTextColor(255, 255, 255);
    // FIX P1.1: Draw filled rect FIRST, then draw text on top (previously rect covered text)
    pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    let cx = margin;
    theads.forEach((head, i) => {
      pdf.text(head, cx + 8, y + 18);
      cx += colWidths[i];
    });
    y += rowHeight;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const allTrans = [];
    receitas.forEach((r) => {
      allTrans.push({ catName: r.origem, desc: r.descricao, account: r.conta, value: `+${fmtMoney(parseFloat(r.valor) || 0)}`, type: 'pos', date: fmtDateBR(r.data), statusText: r.status === 'paid' ? 'Recebido' : 'Pendente' });
    });
    despesas.forEach((d) => {
      allTrans.push({ catName: d.categoria, desc: d.descricao, account: d.conta, value: `-${fmtMoney(parseFloat(d.valor) || 0)}`, type: 'neg', date: fmtDateBR(d.data), statusText: d.status === 'paid' ? 'Pago' : 'Pendente' });
    });

    allTrans.forEach((t, index) => {
      if (y > pdf.internal.pageSize.getHeight() - 80) {
        pdf.addPage();
        y = drawPrismaHeader(pdf, {
          margin, logoData,
          title: 'Prisma',
          subtitle: 'Relatório Financeiro — Gestão Inteligente',
          showProfile: false
        }) + 12;
        // redraw table header
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setFillColor(15, 23, 42);
        pdf.setTextColor(255, 255, 255);
        let hx = margin;
        theads.forEach((head, i) => {
          pdf.rect(hx, y, colWidths[i], rowHeight, 'F');
          pdf.text(head, hx + 6, y + 16);
          hx += colWidths[i];
        });
        y += rowHeight;
      }

      if (index % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
      } else {
        pdf.setFillColor(255, 255, 255);
      }
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');

      const isPos = t.type === 'pos';
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      const values = [t.catName, t.desc, t.account, t.value, t.date, t.statusText];
      cx = margin;
      values.forEach((val, i) => {
        const maxW = colWidths[i] - 12;
        const txt = pdfTruncate(pdf, val, maxW);
        if (i === 3) {
          pdf.setTextColor(isPos ? 0 : 220, isPos ? 150 : 60, isPos ? 80 : 80);
          pdf.setFont('helvetica', 'bold');
        } else if (i === 5) {
          pdf.setTextColor(isPos || /pago/i.test(String(val)) ? 0 : 180, isPos || /pago/i.test(String(val)) ? 140 : 100, 60);
          pdf.setFont('helvetica', 'normal');
        } else {
          pdf.setTextColor(30, 41, 59);
          pdf.setFont('helvetica', 'normal');
        }
        pdf.text(txt, cx + 6, y + 16);
        cx += colWidths[i];
      });

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
      y += rowHeight;
    });

    drawPrismaFooterAllPages(pdf, { margin });

    // Salvar PDF automaticamente
    const filename = `relatorio-prisma-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
    
    showToast('PDF gerado com sucesso! ✓');
    try { if (window.PrismaNotify) window.PrismaNotify('PDF gerado', 'Relatório financeiro em PDF baixado com sucesso.', 'pdf'); } catch(_){}
    
    return {
      blob: pdf.output('blob'),
      dataUri: pdf.output('datauristring'),
      filename: filename,
      pdf,
    };
    } catch (error) {
      console.error('Erro ao preparar relatório PDF:', error);
      showToast('Não foi possível gerar o relatório PDF. Tente novamente.');
      return null;
    }
  }

  // ==================== RELATÓRIOS PROFISSIONAIS (CSV / XLSX) ====================
  // Helpers de exportação — UTF-8 com BOM, delimitador ";", escaping seguro

  let _prismaExportBusy = false;

  function prismaCsvEscape(val) {
    const s = val == null ? '' : String(val);
    // Sempre entre aspas para proteger acentos, ; e quebras de linha
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function prismaFormatMoneyBR(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'R$ 0,00';
    return formatCurrency(n);
  }

  function prismaFormatPercentBR(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0,00%';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function prismaFormatDateBR(isoOrDate) {
    if (!isoOrDate) return '';
    try {
      const d = typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(isoOrDate)
        ? new Date(isoOrDate + 'T12:00:00')
        : new Date(isoOrDate);
      if (isNaN(d.getTime())) return String(isoOrDate);
      return d.toLocaleDateString('pt-BR');
    } catch (_) {
      return String(isoOrDate);
    }
  }

  function prismaCollectReportData() {
    // Mesma fonte de verdade do Dashboard / Centro Financeiro
    let lists = null;
    try {
      if (typeof readLiveFinanceLists === 'function') lists = readLiveFinanceLists();
    } catch (_) { lists = null; }

    const money = (v) => {
      try {
        if (window.PrismaFinance && typeof window.PrismaFinance.money === 'function') return window.PrismaFinance.money(v);
      } catch (_) {}
      if (typeof parseMoneyInput === 'function') return parseMoneyInput(v) || 0;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    const listReceitas = (lists ? lists.receitas : (Array.isArray(receitas) ? receitas : [])).slice();
    const listDespesas = (lists ? lists.despesas : (Array.isArray(despesas) ? despesas : [])).slice();
    const listInvest = (lists ? lists.investimentos : (Array.isArray(investimentos) ? investimentos : [])).map((inv) => {
      try { return typeof normalizeInvestimento === 'function' ? normalizeInvestimento(inv) : inv; }
      catch (_) { return inv; }
    });
    const listCartoes = (lists ? lists.cartoes : (Array.isArray(cartoes) ? cartoes : [])).slice();
    const listMetas = (lists ? lists.goals : (Array.isArray(goals) ? goals : [])).slice();
    const listContas = (lists ? lists.contas : (Array.isArray(contas) ? contas : [])).slice();

    const totalReceitas = listReceitas.reduce((s, r) => s + money(r && r.valor), 0);
    const totalDespesas = listDespesas.reduce((s, d) => s + money(d && d.valor), 0);
    const saldo = totalReceitas - totalDespesas;

    let totalInvestido = 0, totalValorAtual = 0, resultadoInvest = 0, rentInvest = 0;
    let patrimonio = saldo, taxaEconomia = totalReceitas > 0 ? (saldo / totalReceitas) * 100 : 0;
    let passivos = 0, ativos = 0;

    try {
      if (typeof buildFinanceContext === 'function') {
        const ctx = buildFinanceContext();
        totalInvestido = ctx.inv.aplicado;
        totalValorAtual = ctx.inv.atual;
        resultadoInvest = ctx.inv.lucro;
        rentInvest = ctx.inv.rent;
        patrimonio = ctx.netWorth;
        passivos = ctx.liabilities;
        ativos = ctx.assets;
        if (ctx.sr != null) taxaEconomia = ctx.sr;
      } else {
        totalInvestido = listInvest.reduce((s, inv) => {
          const v = typeof getInvestValorAplicado === 'function' ? getInvestValorAplicado(inv) : money(inv.valorAplicado || inv.valorInvestido || inv.valor);
          return s + v;
        }, 0);
        totalValorAtual = listInvest.reduce((s, inv) => {
          const v = typeof getInvestValorAtual === 'function' ? getInvestValorAtual(inv) : money(inv.valorAtual || inv.valorTotal);
          return s + v;
        }, 0);
        resultadoInvest = totalValorAtual - totalInvestido;
        rentInvest = totalInvestido > 0 ? (resultadoInvest / totalInvestido) * 100 : 0;
        patrimonio = saldo + totalValorAtual;
      }
    } catch (_) {
      totalInvestido = listInvest.reduce((s, inv) => s + money(inv && (inv.valorAplicado || inv.valor)), 0);
      totalValorAtual = listInvest.reduce((s, inv) => s + money(inv && (inv.valorAtual || inv.valorTotal || inv.valorAplicado)), 0);
      resultadoInvest = totalValorAtual - totalInvestido;
      rentInvest = totalInvestido > 0 ? (resultadoInvest / totalInvestido) * 100 : 0;
      patrimonio = saldo + totalValorAtual;
    }

    // Categorias (despesas)
    const catMap = {};
    listDespesas.forEach((d) => {
      const cat = (d.categoria || 'Outros').trim() || 'Outros';
      if (!catMap[cat]) catMap[cat] = { total: 0, qtd: 0 };
      catMap[cat].total += parseFloat(d.valor) || 0;
      catMap[cat].qtd += 1;
    });
    const categorias = Object.entries(catMap)
      .map(([nome, info]) => ({
        nome,
        total: info.total,
        qtd: info.qtd,
        pct: totalDespesas > 0 ? (info.total / totalDespesas) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    // Datas extremas para período
    const allDates = []
      .concat(listReceitas.map((r) => r.data).filter(Boolean))
      .concat(listDespesas.map((d) => d.data).filter(Boolean))
      .concat(listInvest.map((i) => i.dataAplicacao || i.data).filter(Boolean));
    let periodoLabel = 'Todos os lançamentos';
    if (allDates.length) {
      const sorted = allDates.slice().sort();
      const minD = prismaFormatDateBR(sorted[0]);
      const maxD = prismaFormatDateBR(sorted[sorted.length - 1]);
      periodoLabel = minD === maxD ? minD : (minD + ' até ' + maxD);
    }

    const geradoEm = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    return {
      listReceitas, listDespesas, listInvest, listCartoes, listMetas, listContas,
      totalReceitas, totalDespesas, saldo, totalInvestido, totalValorAtual,
      resultadoInvest, rentInvest, patrimonio, taxaEconomia, categorias,
      ativos, passivos,
      periodoLabel, geradoEm
    };
  }

  function prismaBuildCsvContent(data) {
    const SEP = ';';
    const lines = [];
    const row = (...cols) => lines.push(cols.map(prismaCsvEscape).join(SEP));
    const blank = () => lines.push('');
    const section = (title) => { blank(); row(title); blank(); };

    row('PRISMA — RELATÓRIO FINANCEIRO');
    row('Prisma — Gestão Financeira Inteligente');
    row('Período', data.periodoLabel);
    row('Data de geração', data.geradoEm);
    blank();
    row('========================================');
    section('RESUMO FINANCEIRO');
    row('Indicador', 'Valor');
    row('Receitas', prismaFormatMoneyBR(data.totalReceitas));
    row('Despesas', prismaFormatMoneyBR(data.totalDespesas));
    row('Saldo do fluxo', prismaFormatMoneyBR(data.saldo));
    row('Ativos', prismaFormatMoneyBR(data.ativos || 0));
    row('Passivos (cartões)', prismaFormatMoneyBR(data.passivos || 0));
    row('Investimentos (aplicado)', prismaFormatMoneyBR(data.totalInvestido));
    row('Investimentos (valor atual)', prismaFormatMoneyBR(data.totalValorAtual));
    row('Resultado investimentos', prismaFormatMoneyBR(data.resultadoInvest));
    row('Rentabilidade investimentos', prismaFormatPercentBR(data.rentInvest));
    row('Patrimônio líquido', prismaFormatMoneyBR(data.patrimonio));
    row('Taxa de poupança', prismaFormatPercentBR(data.taxaEconomia));

    section('RECEITAS');
    row('Data', 'Descrição', 'Origem/Categoria', 'Conta', 'Valor', 'Status');
    if (!data.listReceitas.length) {
      row('(sem registros)', '', '', '', '', '');
    } else {
      data.listReceitas.forEach((r) => {
        row(
          prismaFormatDateBR(r.data),
          r.descricao || '',
          r.origem || r.categoria || '',
          r.conta || '',
          prismaFormatMoneyBR(r.valor),
          r.status || ''
        );
      });
      row('TOTAL RECEITAS', '', '', '', prismaFormatMoneyBR(data.totalReceitas), '');
    }

    section('DESPESAS');
    row('Data', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Status', 'Prioridade', 'Forma pagamento');
    if (!data.listDespesas.length) {
      row('(sem registros)', '', '', '', '', '', '', '');
    } else {
      data.listDespesas.forEach((d) => {
        row(
          prismaFormatDateBR(d.data),
          d.descricao || '',
          d.categoria || '',
          d.conta || '',
          prismaFormatMoneyBR(d.valor),
          d.status || '',
          d.prioridade || '',
          d.formaPagamento || ''
        );
      });
      row('TOTAL DESPESAS', '', '', '', prismaFormatMoneyBR(data.totalDespesas), '', '', '');
    }

    section('INVESTIMENTOS');
    row('Data aplicação', 'Ativo', 'Tipo', 'Instituição', 'Valor investido', 'Valor atual', 'Lucro', 'Rentabilidade', 'Status');
    if (!data.listInvest.length) {
      row('(sem registros)', '', '', '', '', '', '', '', '');
    } else {
      data.listInvest.forEach((inv) => {
        const aplicado = typeof getInvestValorAplicado === 'function' ? getInvestValorAplicado(inv) : (parseFloat(inv.valorAplicado || inv.valor) || 0);
        const atual = typeof getInvestValorAtual === 'function' ? getInvestValorAtual(inv) : (parseFloat(inv.valorAtual) || 0);
        const lucro = typeof getInvestLucro === 'function' ? getInvestLucro(inv) : (atual - aplicado);
        const rent = typeof getInvestRent === 'function' ? getInvestRent(inv) : (aplicado > 0 ? (lucro / aplicado) * 100 : 0);
        const tipoLabel = (typeof TIPO_LABELS !== 'undefined' && TIPO_LABELS[inv.tipo]) ? TIPO_LABELS[inv.tipo] : (inv.tipo || '');
        row(
          prismaFormatDateBR(inv.dataAplicacao || inv.data),
          inv.nome || '',
          tipoLabel,
          inv.instituicao || '',
          prismaFormatMoneyBR(aplicado),
          prismaFormatMoneyBR(atual),
          prismaFormatMoneyBR(lucro),
          prismaFormatPercentBR(rent),
          inv.status || ''
        );
      });
      row('TOTAL', '', '', '', prismaFormatMoneyBR(data.totalInvestido), prismaFormatMoneyBR(data.totalValorAtual), prismaFormatMoneyBR(data.resultadoInvest), prismaFormatPercentBR(data.rentInvest), '');
    }

    section('CATEGORIAS (DESPESAS)');
    row('Categoria', 'Total', 'Percentual', 'Quantidade');
    if (!data.categorias.length) {
      row('(sem dados)', '', '', '');
    } else {
      data.categorias.forEach((c) => {
        row(c.nome, prismaFormatMoneyBR(c.total), prismaFormatPercentBR(c.pct), c.qtd);
      });
    }

    section('METAS');
    row('Meta', 'Valor atual', 'Valor objetivo', 'Restante', 'Progresso', 'Ano');
    if (!data.listMetas.length) {
      row('(sem registros)', '', '', '', '', '');
    } else {
      data.listMetas.forEach((g) => {
        const atual = parseFloat(g.current) || 0;
        const alvo = parseFloat(g.target) || 0;
        const restante = Math.max(0, alvo - atual);
        const prog = alvo > 0 ? (atual / alvo) * 100 : 0;
        row(g.name || '', prismaFormatMoneyBR(atual), prismaFormatMoneyBR(alvo), prismaFormatMoneyBR(restante), prismaFormatPercentBR(prog), g.year || '');
      });
    }

    section('CARTÕES');
    row('Titular', 'Final', 'Banco', 'Validade', 'Dia vencimento', 'Estilo');
    if (!data.listCartoes.length) {
      row('(sem registros)', '', '', '', '', '');
    } else {
      data.listCartoes.forEach((c) => {
        row(c.titular || '', c.numero || '', c.banco || '', c.validade || '', c.diaVencimento != null ? c.diaVencimento : '', c.estilo || '');
      });
    }

    section('CONTAS');
    row('Nome', 'Tipo', 'Saldo', 'Instituição');
    if (!data.listContas.length) {
      row('(sem registros)', '', '', '');
    } else {
      data.listContas.forEach((c) => {
        row(c.nome || c.name || '', c.tipo || c.type || '', prismaFormatMoneyBR(c.saldo || c.balance || 0), c.banco || c.instituicao || '');
      });
    }

    blank();
    row('========================================');
    row('Relatório gerado pelo Prisma — Gestão Financeira Inteligente');
    row('Arquivo em UTF-8 (BOM). Abra no Excel ou Google Sheets com delimitador ponto-e-vírgula.');

    return lines.join('\n');
  }

  function prismaDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try { document.body.removeChild(link); } catch (_) {}
      URL.revokeObjectURL(url);
    }, 800);
  }

  async function exportToCSV() {
    if (_prismaExportBusy) {
      showToast('Aguarde: relatório em processamento...');
      return;
    }
    _prismaExportBusy = true;
    try {
      showToast('Preparando relatório...');
      await new Promise((r) => setTimeout(r, 40));
      showToast('Organizando dados...');
      const data = prismaCollectReportData();
      await new Promise((r) => setTimeout(r, 40));
      showToast('Gerando arquivo CSV...');
      const csvBody = prismaBuildCsvContent(data);
      // UTF-8 com BOM — evita mojibake no Excel (Windows/macOS)
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvBody], { type: 'text/csv;charset=utf-8;' });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `Prisma_Relatorio_Financeiro_${dateStamp}.csv`;
      prismaDownloadBlob(blob, filename);
      showToast('✓ Relatório CSV gerado com sucesso');
      try { if (window.PrismaNotify) window.PrismaNotify('CSV exportado', 'Relatório financeiro CSV baixado com sucesso.', 'export'); } catch (_) {}
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      showToast('Não foi possível gerar o relatório. Tente novamente.');
      try { if (window.PrismaNotify) window.PrismaNotify('Falha na exportação', 'Não foi possível exportar CSV.', 'danger'); } catch (_) {}
      throw error;
    } finally {
      _prismaExportBusy = false;
    }
  }

  async function loadSheetJS() {
    if (window.XLSX && window.XLSX.utils) return window.XLSX;
    await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
    if (!window.XLSX) throw new Error('SheetJS não carregou');
    return window.XLSX;
  }

  async function exportToExcel() {
    if (_prismaExportBusy) {
      showToast('Aguarde: relatório em processamento...');
      return;
    }
    _prismaExportBusy = true;
    try {
      showToast('Preparando relatório Excel...');
      await new Promise((r) => setTimeout(r, 40));
      const XLSX = await loadSheetJS();
      showToast('Organizando dados...');
      const data = prismaCollectReportData();
      showToast('Montando planilhas...');

      const wb = XLSX.utils.book_new();

      // --- Aba Resumo ---
      const resumoAoA = [
        ['PRISMA'],
        ['RELATÓRIO FINANCEIRO'],
        ['Prisma — Gestão Financeira Inteligente'],
        [],
        ['Período', data.periodoLabel],
        ['Data de geração', data.geradoEm],
        [],
        ['Indicador', 'Valor'],
        ['Receitas', data.totalReceitas],
        ['Despesas', data.totalDespesas],
        ['Saldo', data.saldo],
        ['Investimentos (aplicado)', data.totalInvestido],
        ['Investimentos (valor atual)', data.totalValorAtual],
        ['Resultado investimentos', data.resultadoInvest],
        ['Rentabilidade investimentos', data.rentInvest / 100],
        ['Patrimônio estimado', data.patrimonio],
        ['Taxa de economia', data.taxaEconomia / 100],
        [],
        ['Principais categorias de despesa'],
        ['Categoria', 'Total', 'Percentual', 'Qtd']
      ];
      data.categorias.slice(0, 8).forEach((c) => {
        resumoAoA.push([c.nome, c.total, c.pct / 100, c.qtd]);
      });
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoA);
      wsResumo['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
      // Formatos numéricos (quando possível)
      const moneyCells = ['B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B16'];
      moneyCells.forEach((addr) => {
        if (wsResumo[addr] && typeof wsResumo[addr].v === 'number') {
          wsResumo[addr].t = 'n';
          wsResumo[addr].z = 'R$ #,##0.00';
        }
      });
      ['B15', 'B17'].forEach((addr) => {
        if (wsResumo[addr] && typeof wsResumo[addr].v === 'number') {
          wsResumo[addr].t = 'n';
          wsResumo[addr].z = '0.00%';
        }
      });
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

      // --- Aba Receitas ---
      const recRows = [['Data', 'Descrição', 'Origem/Categoria', 'Conta', 'Valor', 'Status']];
      data.listReceitas.forEach((r) => {
        recRows.push([
          prismaFormatDateBR(r.data),
          r.descricao || '',
          r.origem || r.categoria || '',
          r.conta || '',
          parseFloat(r.valor) || 0,
          r.status || ''
        ]);
      });
      recRows.push([]);
      recRows.push(['TOTAL', '', '', '', data.totalReceitas, '']);
      const wsRec = XLSX.utils.aoa_to_sheet(recRows);
      wsRec['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsRec, 'Receitas');

      // --- Aba Despesas ---
      const desRows = [['Data', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Status', 'Prioridade', 'Forma pagamento']];
      data.listDespesas.forEach((d) => {
        desRows.push([
          prismaFormatDateBR(d.data),
          d.descricao || '',
          d.categoria || '',
          d.conta || '',
          parseFloat(d.valor) || 0,
          d.status || '',
          d.prioridade || '',
          d.formaPagamento || ''
        ]);
      });
      desRows.push([]);
      desRows.push(['TOTAL', '', '', '', data.totalDespesas, '', '', '']);
      if (data.listDespesas.length) {
        const media = data.totalDespesas / data.listDespesas.length;
        const maior = data.listDespesas.reduce((m, d) => Math.max(m, parseFloat(d.valor) || 0), 0);
        const topCat = data.categorias[0];
        desRows.push([]);
        desRows.push(['Média por lançamento', '', '', '', media, '', '', '']);
        desRows.push(['Maior despesa', '', '', '', maior, '', '', '']);
        if (topCat) desRows.push(['Categoria com maior gasto', topCat.nome, '', '', topCat.total, '', '', '']);
      }
      const wsDes = XLSX.utils.aoa_to_sheet(desRows);
      wsDes['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsDes, 'Despesas');

      // --- Aba Investimentos ---
      const invRows = [['Data aplicação', 'Ativo', 'Tipo', 'Instituição', 'Valor investido', 'Valor atual', 'Lucro', 'Rentabilidade %', 'Status']];
      data.listInvest.forEach((inv) => {
        const aplicado = typeof getInvestValorAplicado === 'function' ? getInvestValorAplicado(inv) : (parseFloat(inv.valorAplicado || inv.valor) || 0);
        const atual = typeof getInvestValorAtual === 'function' ? getInvestValorAtual(inv) : (parseFloat(inv.valorAtual) || 0);
        const lucro = typeof getInvestLucro === 'function' ? getInvestLucro(inv) : (atual - aplicado);
        const rent = typeof getInvestRent === 'function' ? getInvestRent(inv) : (aplicado > 0 ? (lucro / aplicado) * 100 : 0);
        const tipoLabel = (typeof TIPO_LABELS !== 'undefined' && TIPO_LABELS[inv.tipo]) ? TIPO_LABELS[inv.tipo] : (inv.tipo || '');
        invRows.push([
          prismaFormatDateBR(inv.dataAplicacao || inv.data),
          inv.nome || '',
          tipoLabel,
          inv.instituicao || '',
          aplicado,
          atual,
          lucro,
          rent / 100,
          inv.status || ''
        ]);
      });
      invRows.push([]);
      invRows.push(['TOTAL', '', '', '', data.totalInvestido, data.totalValorAtual, data.resultadoInvest, data.rentInvest / 100, '']);
      const wsInv = XLSX.utils.aoa_to_sheet(invRows);
      wsInv['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsInv, 'Investimentos');

      // --- Aba Categorias ---
      const catRows = [['Categoria', 'Total', 'Percentual', 'Quantidade']];
      data.categorias.forEach((c) => {
        catRows.push([c.nome, c.total, c.pct / 100, c.qtd]);
      });
      const wsCat = XLSX.utils.aoa_to_sheet(catRows);
      wsCat['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsCat, 'Categorias');

      // --- Aba Metas ---
      const metaRows = [['Meta', 'Valor atual', 'Valor objetivo', 'Restante', 'Progresso', 'Ano']];
      data.listMetas.forEach((g) => {
        const atual = parseFloat(g.current) || 0;
        const alvo = parseFloat(g.target) || 0;
        const restante = Math.max(0, alvo - atual);
        const prog = alvo > 0 ? atual / alvo : 0;
        metaRows.push([g.name || '', atual, alvo, restante, prog, g.year || '']);
      });
      const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
      wsMeta['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Metas');

      // --- Aba Cartões ---
      const cartRows = [['Titular', 'Final', 'Banco', 'Validade', 'Dia vencimento', 'Estilo']];
      data.listCartoes.forEach((c) => {
        cartRows.push([c.titular || '', c.numero || '', c.banco || '', c.validade || '', c.diaVencimento != null ? c.diaVencimento : '', c.estilo || '']);
      });
      const wsCart = XLSX.utils.aoa_to_sheet(cartRows);
      wsCart['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsCart, 'Cartoes');

      // --- Aba Contas ---
      const contaRows = [['Nome', 'Tipo', 'Saldo', 'Instituição']];
      data.listContas.forEach((c) => {
        contaRows.push([c.nome || c.name || '', c.tipo || c.type || '', parseFloat(c.saldo || c.balance) || 0, c.banco || c.instituicao || '']);
      });
      const wsConta = XLSX.utils.aoa_to_sheet(contaRows);
      wsConta['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsConta, 'Contas');

      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `Prisma_Relatorio_Financeiro_${dateStamp}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast('✓ Relatório Excel gerado com sucesso');
      try { if (window.PrismaNotify) window.PrismaNotify('Excel exportado', 'Relatório financeiro XLSX baixado com sucesso.', 'export'); } catch (_) {}
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      showToast('Não foi possível gerar o relatório. Tente novamente.');
      try { if (window.PrismaNotify) window.PrismaNotify('Falha na exportação', 'Não foi possível exportar Excel.', 'danger'); } catch (_) {}
      throw error;
    } finally {
      _prismaExportBusy = false;
    }
  }
  // ==================== FIM RELATÓRIOS PROFISSIONAIS ====================

  // Função para gerar recomendações de economia
  function gerarRecomendacoesEconomia() {
    const recomendacoes = [];
    
    // Calcular totais por categoria (apenas gastos não prioritários)
    const gastosPorCategoria = {};
    despesas.forEach(d => {
      // Filtrar apenas gastos não prioritários (baixa e média)
      const prioridade = d.prioridade || 'media';
      if (prioridade === 'urgente' || prioridade === 'alta') {
        return; // Pular gastos prioritários
      }
      
      if (!gastosPorCategoria[d.categoria]) {
        gastosPorCategoria[d.categoria] = 0;
      }
      gastosPorCategoria[d.categoria] += parseFloat(d.valor) || 0;
    });
    
    // Total de despesas (apenas não prioritárias)
    const totalDespesas = despesas
      .filter(d => {
        const prioridade = d.prioridade || 'media';
        return prioridade !== 'urgente' && prioridade !== 'alta';
      })
      .reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
    
    // Se não houver despesas não prioritárias, retornar sem recomendações
    if (totalDespesas === 0) {
      return {
        recomendacoes: [],
        economiaTotal: 'R$ 0,00',
        numeroRecomendacoes: 0,
        taxaPoupancaAtual: receitasMes > 0 ? ((economiaMes / receitasMes) * 100).toFixed(1) + '%' : '0%'
      };
    }
    
    // Ordenar categorias por valor (maior gasto primeiro)
    const categoriasOrdenadas = Object.entries(gastosPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5 categorias
    
    // Análise de cada categoria (apenas categorias não prioritárias)
    categoriasOrdenadas.forEach(([categoria, valor]) => {
      // Verificar se a categoria é prioritária
      const despesasCategoria = despesas.filter(d => d.categoria === categoria);
      const categoriaPrioritaria = despesasCategoria.some(d => {
        const prioridade = d.prioridade || 'media';
        return prioridade === 'urgente' || prioridade === 'alta';
      });
      
      // Pular categorias prioritárias
      if (categoriaPrioritaria) {
        return;
      }
      
      const pct = (valor / totalDespesas * 100).toFixed(1);
      
      if (pct > 30) {
        const economiaPotencial = (valor * 0.2).toFixed(0);
        recomendacoes.push({
          categoria,
          valor: fmtMoney(valor),
          percentual: pct + '%',
          sugestao: `Reduza gastos em ${categoria} em 20%`,
          economia: fmtMoney(economiaPotencial),
          impacto: 'Alto'
        });
      } else if (pct > 15) {
        const economiaPotencial = (valor * 0.1).toFixed(0);
        recomendacoes.push({
          categoria,
          valor: fmtMoney(valor),
          percentual: pct + '%',
          sugestao: `Reduza gastos em ${categoria} em 10%`,
          economia: fmtMoney(economiaPotencial),
          impacto: 'Médio'
        });
      }
    });
    
    // Recomendações gerais baseadas na taxa de poupança
    const taxaPoupanca = receitasMes > 0 ? ((economiaMes / receitasMes) * 100).toFixed(1) : 0;
    
    if (taxaPoupanca < 10) {
      recomendacoes.push({
        categoria: 'Geral',
        valor: '-',
        percentual: taxaPoupanca + '%',
        sugestao: 'Aumente poupança para pelo menos 10% das receitas',
        economia: fmtMoney(receitasMes * 0.1),
        impacto: 'Alto'
      });
    } else if (taxaPoupanca < 20) {
      recomendacoes.push({
        categoria: 'Geral',
        valor: '-',
        percentual: taxaPoupanca + '%',
        sugestao: 'Tente aumentar poupança para 20% das receitas',
        economia: fmtMoney(receitasMes * 0.05),
        impacto: 'Médio'
      });
    }
    
    // Recomendações específicas por tipo de gasto (apenas não prioritários)
    // Nota: Não fazemos recomendações específicas para categorias que podem ser prioritárias
    // As recomendações são geradas dinamicamente baseadas nas categorias não prioritárias encontradas
    
    // Calcular economia total potencial
    const economiaTotal = recomendacoes.reduce((acc, r) => {
      const valorNumerico = parseFloat(r.economia.replace('R$', '').replace('.', '').replace(',', '.'));
      return acc + valorNumerico;
    }, 0);
    
    return {
      recomendacoes,
      economiaTotal: fmtMoney(economiaTotal),
      numeroRecomendacoes: recomendacoes.length,
      taxaPoupancaAtual: taxaPoupanca + '%'
    };
  }

  const exportBtns = document.querySelectorAll('.btn.export');
  exportBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('pdf')) {
        generatePDF().catch((error) => {
          console.error('Erro ao gerar PDF:', error);
          showToast('Não foi possível gerar o PDF. Tente novamente.');
          try { if (window.PrismaNotify) window.PrismaNotify('Falha ao gerar PDF', 'Não foi possível gerar o PDF. Tente novamente.', 'danger'); } catch(_){}
        });
      } else if (btn.classList.contains('email')) {
        sendPDFByEmail().catch((error) => {
          console.error('Erro ao enviar PDF por e-mail:', error);
          showToast('Não foi possível enviar o PDF por e-mail.');
          try { if (window.PrismaNotify) window.PrismaNotify('Falha no e-mail', 'Não foi possível enviar o PDF por e-mail.', 'danger'); } catch(_){}
        });
      } else if (btn.classList.contains('excel')) {
        exportToExcel().catch((error) => {
          console.error('Erro ao exportar Excel:', error);
          showToast('Não foi possível exportar Excel. Tente novamente.');
          try { if (window.PrismaNotify) window.PrismaNotify('Falha na exportação', 'Não foi possível exportar Excel.', 'danger'); } catch(_){}
        });
      } else if (btn.classList.contains('csv')) {
        exportToCSV().catch((error) => {
          console.error('Erro ao exportar CSV:', error);
          showToast('Não foi possível exportar CSV. Tente novamente.');
          try { if (window.PrismaNotify) window.PrismaNotify('Falha na exportação', 'Não foi possível exportar CSV.', 'danger'); } catch(_){}
        });
      }
    });
  });

  async function sendPDFByEmail() {
    const recipient = await getAuthenticatedUserForEmail().catch(() => null);
    if (!recipient?.email) {
      showToast('Não foi possível identificar o e-mail da conta.');
      return;
    }
    if (!window.jspdf) {
      showToast('Carregando bibliotecas de PDF... Aguarde um momento.');
      try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
      catch (error) { console.error(error); showToast('Erro ao carregar bibliotecas de PDF. Tente novamente.'); return; }
    }
    try {
      const result = await generatePDF();
      const blob = result?.blob || null;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download=result.filename||'relatorio-prisma.pdf'; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      const subject = 'Relatório financeiro — Prisma';
      const body = 'Seu relatório financeiro foi gerado pelo Prisma. O arquivo foi baixado para que você possa anexá-lo ao seu e-mail.';
      window.open(`mailto:${encodeURIComponent(recipient.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
      showToast('Relatório gerado e e-mail preparado.');
      try { if (window.PrismaNotify) window.PrismaNotify('Relatório por e-mail', 'PDF gerado e cliente de e-mail aberto para envio.', 'email'); } catch(_){}
    } catch (error) {
      console.error('Erro ao gerar relatório para e-mail:', error);
      showToast('Não foi possível preparar o relatório por e-mail.');
      try { if (window.PrismaNotify) window.PrismaNotify('Falha no e-mail', 'Não foi possível preparar o relatório por e-mail.', 'danger'); } catch(_){}
    }
  }

  // ==================== MEUS DADOS (Edição direta) - REMOVIDO ====================

  // ==================== MEUS DADOS (Edição direta) - SEGURANÇA E AUXILIARES ====================

  function getMonthlyGridEl() {
    return document.getElementById('monthlyGrid');
  }

  function getCategoryEditGridEl() {
    return document.getElementById('categoryEditGrid');
  }

  function getGoalsEditGridEl() {
    return document.getElementById('goalsEditGrid');
  }

  function buildMonthlyGrid() {
    const monthlyGrid = getMonthlyGridEl();
    if (!monthlyGrid) return;
    monthlyGrid.innerHTML = '';
    months.forEach((m, i) => {
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = `
        <label>${m}</label>
        <div class="month-inputs">
          <input type="number" class="month-income" data-index="${i}" step="0.01" min="0" placeholder="Rec." value="${incomeData[i] || 0}" />
          <input type="number" class="month-expense" data-index="${i}" step="0.01" min="0" placeholder="Desp." value="${expenseData[i] || 0}" />
        </div>
      `;
      monthlyGrid.appendChild(field);
    });
  }

  function buildCategoryGrid() {
    const categoryEditGrid = getCategoryEditGridEl();
    if (!categoryEditGrid) return;
    categoryEditGrid.innerHTML = '';
    categories.forEach((c) => {
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = `
        <label><span class="cat-dot" style="background:${c.color}"></span> ${c.name}</label>
        <input type="number" class="category-input" data-name="${c.name}" step="0.01" min="0" value="${c.value}" />
      `;
      categoryEditGrid.appendChild(field);
    });
  }

  function buildGoalsGrid() {
    const goalsEditGrid = getGoalsEditGridEl();
    if (!goalsEditGrid) return;
    goalsEditGrid.innerHTML = '';
    goals.forEach((g, i) => {
      const field = document.createElement('div');
      field.className = 'goal-edit-item';
      field.innerHTML = `
        <div class="goal-edit-head">
          <span class="goal-icon ${g.color || 'default'}"><i data-lucide="${g.icon || 'target'}"></i></span>
          <input type="text" class="goal-name" data-index="${i}" value="${g.name}" />
        </div>
        <div class="goal-edit-fields">
          <div class="form-field">
            <label>Valor Atual (R$)</label>
            <input type="number" class="goal-current" data-index="${i}" step="0.01" min="0" value="${g.current}" />
          </div>
          <div class="form-field">
            <label>Valor Alvo (R$)</label>
            <input type="number" class="goal-target" data-index="${i}" step="0.01" min="0" value="${g.target}" />
          </div>
          <div class="form-field">
            <label>Concluir em</label>
            <input type="number" class="goal-year" data-index="${i}" min="2024" max="2100" value="${g.year}" />
          </div>
        </div>
      `;
      goalsEditGrid.appendChild(field);
    });
    refreshIcons();
  }

  function fillSummary() {
    if (inputSaldo) inputSaldo.value = saldoAtual;
    if (inputSalario) inputSalario.value = salarioMensal;
    if (inputReceitas) inputReceitas.value = receitasMes;
    if (inputDespesas) inputDespesas.value = despesasMes;
    if (inputEconomia) inputEconomia.value = economiaMes;
  }

  function saveData() {
    const novoSalario = inputSalario ? (parseFloat(inputSalario.value) || 0) : salarioMensal;
    const novoSaldo = inputSaldo ? (parseFloat(inputSaldo.value) || 0) : saldoAtual;
    const novasReceitasMes = inputReceitas ? (parseFloat(inputReceitas.value) || 0) : receitasMes;
    const novasDespesasMes = inputDespesas ? (parseFloat(inputDespesas.value) || 0) : despesasMes;
    
    // Atualizar summary
    saldoAtual = novoSaldo;
    salarioMensal = novoSalario;
    saveDataStorage(STORAGE_KEYS.summary, { saldoAtual, salarioMensal });

    // Sincronizar salário com receitas
    if (novoSalario > 0) {
      // Verificar se já existe receita de salário
      const salarioReceita = receitas.find(r => 
        r.categoria.toLowerCase().includes('salário') || 
        r.categoria.toLowerCase().includes('salario') ||
        r.categoria.toLowerCase().includes('renda') ||
        r.descricao.toLowerCase().includes('salário') ||
        r.descricao.toLowerCase().includes('salario')
      );
      
      if (salarioReceita) {
        // Atualizar receita existente
        salarioReceita.valor = novoSalario;
        salarioReceita.data = new Date().toISOString().split('T')[0];
      } else {
        // Criar nova receita de salário
        receitas.push({
          id: Date.now(),
          descricao: 'Salário Mensal',
          valor: novoSalario,
          categoria: 'Salário',
          data: new Date().toISOString().split('T')[0],
          recorrente: true
        });
      }
      
      // Salvar receitas atualizadas
      saveDataStorage(STORAGE_KEYS.receitas, receitas);
    }

    // Sincronizar total de receitas do mês se for diferente do salário
    if (novasReceitasMes > 0 && novasReceitasMes !== novoSalario) {
      // Verificar se precisa criar receita adicional
      const totalReceitasAtual = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
      const diferenca = novasReceitasMes - totalReceitasAtual;
      
      if (Math.abs(diferenca) > 0.01) {
        // Criar receita para ajustar o total
        if (diferenca > 0) {
          receitas.push({
            id: Date.now(),
            descricao: 'Outras Receitas',
            valor: diferenca,
            categoria: 'Outros',
            data: new Date().toISOString().split('T')[0],
            recorrente: false
          });
        }
        saveDataStorage(STORAGE_KEYS.receitas, receitas);
      }
    }

    const monthlyGrid = getMonthlyGridEl();
    if (monthlyGrid) {
      const incInputs = monthlyGrid.querySelectorAll('.month-income');
      const expInputs = monthlyGrid.querySelectorAll('.month-expense');
      incInputs.forEach((inp) => { incomeData[parseInt(inp.dataset.index, 10)] = parseFloat(inp.value) || 0; });
      expInputs.forEach((inp) => { expenseData[parseInt(inp.dataset.index, 10)] = parseFloat(inp.value) || 0; });
      saveDataStorage(STORAGE_KEYS.monthlyFlow, { inc: incomeData, exp: expenseData });
    }

    const categoryEditGrid = getCategoryEditGridEl();
    if (categoryEditGrid) {
      categoryEditGrid.querySelectorAll('.category-input').forEach((inp) => {
        const cat = categories.find((c) => c.name === inp.dataset.name);
        if (cat) cat.value = parseFloat(inp.value) || 0;
      });
      saveDataStorage(STORAGE_KEYS.categories, categories);
    }

    const goalsEditGrid = getGoalsEditGridEl();
    if (goalsEditGrid) {
      goalsEditGrid.querySelectorAll('.goal-name').forEach((inp) => {
        if (goals[parseInt(inp.dataset.index, 10)]) goals[parseInt(inp.dataset.index, 10)].name = inp.value;
      });
      goalsEditGrid.querySelectorAll('.goal-current').forEach((inp) => {
        if (goals[parseInt(inp.dataset.index, 10)]) goals[parseInt(inp.dataset.index, 10)].current = parseFloat(inp.value) || 0;
      });
      goalsEditGrid.querySelectorAll('.goal-target').forEach((inp) => {
        if (goals[parseInt(inp.dataset.index, 10)]) goals[parseInt(inp.dataset.index, 10)].target = parseFloat(inp.value) || 0;
      });
      goalsEditGrid.querySelectorAll('.goal-year').forEach((inp) => {
        if (goals[parseInt(inp.dataset.index, 10)]) goals[parseInt(inp.dataset.index, 10)].year = parseInt(inp.value, 10) || new Date().getFullYear();
      });
      saveDataStorage(STORAGE_KEYS.goals, goals);
    }

    // Recalcular totais após sincronização
    receitasMes = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    despesasMes = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
    economiaMes = receitasMes - despesasMes;
    
    // Atualizar inputs após sincronização
    if (inputReceitas) inputReceitas.value = receitasMes;
    if (inputDespesas) inputDespesas.value = despesasMes;
    if (inputEconomia) inputEconomia.value = economiaMes;

    // Atualizar interface
    recalculateAll();
    renderReceitas();
    renderDespesas();
    
    showToast('Dados salvos e sincronizados com receitas/despesas! ✓');
  }

  if (saveDataBtn) saveDataBtn.addEventListener('click', saveData);

  // Auto-sincronização do salário com receitas
  if (inputSalario) {
    inputSalario.addEventListener('change', () => {
      const novoSalario = parseFloat(inputSalario.value) || 0;
      if (novoSalario > 0) {
        // Verificar se já existe receita de salário
        const salarioReceita = receitas.find(r => 
          r.categoria.toLowerCase().includes('salário') || 
          r.categoria.toLowerCase().includes('salario') ||
          r.categoria.toLowerCase().includes('renda') ||
          r.descricao.toLowerCase().includes('salário') ||
          r.descricao.toLowerCase().includes('salario')
        );
        
        if (salarioReceita) {
          // Atualizar receita existente
          salarioReceita.valor = novoSalario;
          salarioReceita.data = new Date().toISOString().split('T')[0];
        } else {
          // Criar nova receita de salário
          receitas.push({
            id: Date.now(),
            descricao: 'Salário Mensal',
            valor: novoSalario,
            categoria: 'Salário',
            data: new Date().toISOString().split('T')[0],
            recorrente: true
          });
        }
        
        // Salvar receitas atualizadas
        saveDataStorage(STORAGE_KEYS.receitas, receitas);
        
        // Atualizar salário mensal
        salarioMensal = novoSalario;
        saveDataStorage(STORAGE_KEYS.summary, { saldoAtual, salarioMensal });
        
        // Atualizar interface
        recalculateAll();
        renderReceitas();
        fillSummary();
        
        showToast('Salário sincronizado com receitas! ✓');
      }
    });
  }

  // Auto-sincronização das despesas
  if (inputDespesas) {
    inputDespesas.addEventListener('change', () => {
      const novasDespesasMes = parseFloat(inputDespesas.value) || 0;
      
      if (novasDespesasMes > 0) {
        const totalDespesasAtual = despesas.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
        const diferenca = novasDespesasMes - totalDespesasAtual;
        
        if (Math.abs(diferenca) > 0.01) {
          if (diferenca > 0) {
            // Criar despesa de ajuste inteligente
            despesas.push({
              id: Date.now(),
              descricao: 'Ajuste de Despesas Mensal',
              valor: diferenca,
              categoria: 'Outros',
              data: new Date().toISOString().split('T')[0],
              recorrente: false
            });
            
            saveDataStorage(STORAGE_KEYS.despesas, despesas);
            
            recalculateAll();
            renderDespesas();
            fillSummary();
            
            showToast(`R$ ${formatCurrency(diferenca)} adicionado às despesas! ✓`);
          } else {
            // Reduzir despesas existentes de forma inteligente
            let valorParaReduzir = Math.abs(diferenca);
            
            // Primeiro, tentar reduzir despesas não essenciais
            const despesasOutros = despesas.filter(d => 
              d.categoria.toLowerCase().includes('outros') ||
              d.categoria.toLowerCase().includes('lazer') ||
              d.descricao.toLowerCase().includes('ajuste')
            ).sort((a, b) => a.valor - b.valor);
            
            for (let despesa of despesasOutros) {
              if (valorParaReduzir <= 0) break;
              
              const despesaIndex = despesas.findIndex(d => d.id === despesa.id);
              if (despesaIndex !== -1) {
                const reducaoPossivel = Math.min(valorParaReduzir, despesa.valor);
                despesa.valor -= reducaoPossivel;
                valorParaReduzir -= reducaoPossivel;
                
                if (despesa.valor <= 0.01) {
                  despesas.splice(despesaIndex, 1);
                }
              }
            }
            
            // Se ainda precisa reduzir, reduzir outras despesas proporcionalmente
            if (valorParaReduzir > 0.01 && despesas.length > 0) {
              const despesasEssenciais = despesas.filter(d => 
                !d.categoria.toLowerCase().includes('outros') &&
                !d.categoria.toLowerCase().includes('lazer') &&
                !d.descricao.toLowerCase().includes('ajuste')
              );
              
              if (despesasEssenciais.length > 0) {
                const reducaoPorDespesa = valorParaReduzir / despesasEssenciais.length;
                despesasEssenciais.forEach(despesa => {
                  const despesaIndex = despesas.findIndex(d => d.id === despesa.id);
                  if (despesaIndex !== -1) {
                    despesa.valor = Math.max(0, despesa.valor - reducaoPorDespesa);
                    if (despesa.valor <= 0.01) {
                      despesas.splice(despesaIndex, 1);
                    }
                  }
                });
              }
            }
            
            saveDataStorage(STORAGE_KEYS.despesas, despesas);
            
            recalculateAll();
            renderDespesas();
            fillSummary();
            
            showToast(`Despesas ajustadas automaticamente! ✓`);
          }
        }
      }
    });
  }

  // Auto-sincronização das receitas (além do salário)
  if (inputReceitas) {
    inputReceitas.addEventListener('change', () => {
      const novasReceitasMes = parseFloat(inputReceitas.value) || 0;
      
      if (novasReceitasMes > 0) {
        const totalReceitasAtual = receitas.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
        const diferenca = novasReceitasMes - totalReceitasAtual;
        
        if (Math.abs(diferenca) > 0.01) {
          if (diferenca > 0) {
            // Criar receita adicional
            receitas.push({
              id: Date.now(),
              descricao: 'Receita Adicional',
              valor: diferenca,
              categoria: 'Outros',
              data: new Date().toISOString().split('T')[0],
              recorrente: false
            });
            
            saveDataStorage(STORAGE_KEYS.receitas, receitas);
            
            recalculateAll();
            renderReceitas();
            fillSummary();
            
            showToast(`R$ ${formatCurrency(diferenca)} adicionado às receitas! ✓`);
          } else {
            // Reduzir receitas existentes
            let valorParaReduzir = Math.abs(diferenca);
            
            // Primeiro, reduzir receitas não essenciais
            const receitasOutros = receitas.filter(r => 
              r.categoria.toLowerCase().includes('outros') ||
              r.descricao.toLowerCase().includes('adicional')
            ).sort((a, b) => a.valor - b.valor);
            
            for (let receita of receitasOutros) {
              if (valorParaReduzir <= 0) break;
              
              const receitaIndex = receitas.findIndex(r => r.id === receita.id);
              if (receitaIndex !== -1) {
                const reducaoPossivel = Math.min(valorParaReduzir, receita.valor);
                receita.valor -= reducaoPossivel;
                valorParaReduzir -= reducaoPossivel;
                
                if (receita.valor <= 0.01) {
                  receitas.splice(receitaIndex, 1);
                }
              }
            }
            
            saveDataStorage(STORAGE_KEYS.receitas, receitas);
            
            recalculateAll();
            renderReceitas();
            fillSummary();
            
            showToast(`Receitas ajustadas automaticamente! ✓`);
          }
        }
      }
    });
  }

  // Auto-sincronização do saldo com contas bancárias
  if (inputSaldo) {
    inputSaldo.addEventListener('change', () => {
      const novoSaldo = parseFloat(inputSaldo.value) || 0;
      
      if (novoSaldo >= 0) {
        const totalContasAtual = contas.reduce((sum, c) => sum + (parseFloat(c.saldo) || 0), 0);
        const diferenca = novoSaldo - totalContasAtual;
        
        if (Math.abs(diferenca) > 0.01) {
          if (diferenca > 0) {
            // Criar conta bancária para ajustar o saldo
            if (contas.length === 0) {
              // Se não tem contas, cria a primeira
              contas.push({
                id: Date.now(),
                banco: 'Conta Principal',
                agencia: '0001',
                conta: '12345-6',
                tipo: 'Corrente',
                saldo: novoSaldo,
                cor: '#00FF88'
              });
            } else {
              // Adiciona saldo à conta principal
              const contaPrincipal = contas[0];
              contaPrincipal.saldo += diferenca;
            }
            
            saveDataStorage(STORAGE_KEYS.contas, contas);
            
            recalculateAll();
            renderContas();
            fillSummary();
            
            showToast(`R$ ${formatCurrency(diferenca)} adicionado às contas! ✓`);
          } else {
            // Reduzir saldo das contas de forma inteligente
            let valorParaReduzir = Math.abs(diferenca);
            
            // Primeiro, reduzir contas com maior saldo
            const contasOrdenadas = [...contas].sort((a, b) => b.saldo - a.saldo);
            
            for (let conta of contasOrdenadas) {
              if (valorParaReduzir <= 0) break;
              
              const contaIndex = contas.findIndex(c => c.id === conta.id);
              if (contaIndex !== -1) {
                const reducaoPossivel = Math.min(valorParaReduzir, conta.saldo);
                contas[contaIndex].saldo -= reducaoPossivel;
                valorParaReduzir -= reducaoPossivel;
                
                if (contas[contaIndex].saldo <= 0.01) {
                  contas.splice(contaIndex, 1);
                }
              }
            }
            
            saveDataStorage(STORAGE_KEYS.contas, contas);
            
            recalculateAll();
            renderContas();
            fillSummary();
            
            showToast(`Saldo das contas ajustado automaticamente! ✓`);
          }
        }
      }
    });
  }

  // Initialize Meus Dados Grids
  buildMonthlyGrid();
  buildCategoryGrid();
  buildGoalsGrid();
  fillSummary();

  // ==================== RIPPLE EFFECT FOR ACTION BUTTONS ====================
  function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple');

    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
      ripple.remove();
    }

    button.appendChild(circle);
  }

  // Add ripple effect to all table action buttons
  document.addEventListener('click', (event) => {
    if (event.target.closest('.table-action-btn')) {
      const button = event.target.closest('.table-action-btn');
      createRipple({ currentTarget: button, clientX: event.clientX, clientY: event.clientY });
    }
  });

  // ==================== CHECK INITIAL STATE & APP BOOT ====================
  function ensureDefaultProfile() {
    // Mantido por compatibilidade interna quando autenticado
    try {
      if (!serverAuthenticated) return;
      const profiles = getJSONFromStorage(BASE_STORAGE_KEYS.profiles, []);
      if (!currentProfileId || !profiles.some(p => p.id === currentProfileId)) {
        if (profiles.length > 0) {
          currentProfileId = profiles[0].id;
        }
      }
    } catch (_) {}
  }

  function checkInitialState() {
    try {
      if (isAuthenticated) {
        const app = document.getElementById('mainApp') || document.querySelector('.app');
        if (app) app.style.display = 'block';
        hideLoginModal();
        hideRegistrationModal();
        if (typeof window.navigateToSection === 'function') {
          window.navigateToSection('dashboard', { updateHistory: false });
        }
      } else {
        const app = document.getElementById('mainApp') || document.querySelector('.app');
        if (app) app.style.display = 'none';
        showLoginModal();
      }
    } catch (error) {
      console.error('Erro no boot da aplicação:', error);
      const app = document.getElementById('mainApp') || document.querySelector('.app');
      if (app) app.style.display = 'none';
      showLoginModal();
    }
  }

  // ==================== INITIALIZE PAGE ====================
  (async function initializePersistence(){
    try {
      const app = document.getElementById('mainApp') || document.querySelector('.app');
      if (app) app.style.display = 'none';

      hideLoginModal();
      hideRegistrationModal();
      const firebase = await getFirebaseClient();
      await firebase.ready;
      firebaseAuthUnsubscribe = firebase.onUserChanged((user, error) => {
        if (error) {
          console.error('Erro ao acompanhar a sessão Firebase:', error);
          cleanLocalUserData();
          if (app) app.style.display = 'none';
          showLoginModal();
          showAuthFeedback('loginFeedback', authErrorMessage(error), 'error');
          return;
        }
        if (!user) {
          if (!firebaseAuthenticated) return;
          cleanLocalUserData();
          if (app) app.style.display = 'none';
          hideLgpdScreen();
          showLoginModal();
          return;
        }
        if (firebaseAuthenticated && currentLocalUser?.id === user.uid) return;
        void activateFirebaseSession(user, firebase).catch(async (error) => {
          console.error('Não foi possível carregar os dados da conta Firebase:', error);
          try {
            await firebase.logout();
          } catch (logoutError) {
            console.error('Não foi possível encerrar a sessão após falha ao carregar os dados:', logoutError);
          }
          cleanLocalUserData();
          if (app) app.style.display = 'none';
          showLoginModal();
          showAuthFeedback('loginFeedback', authErrorMessage(error), 'error');
        });
      });

      const user = await firebase.getCurrentUser();
      if (user) {
        await activateFirebaseSession(user, firebase);
      } else {
        cleanLocalUserData();
        if (app) app.style.display = 'none';
        showLoginModal();
      }

      const actionMode = new URLSearchParams(location.search).get('mode');
      if (actionMode === 'resetPassword' && typeof resetPasswordModal !== 'undefined') {
        resetPasswordModal.style.display = 'flex';
        resetPasswordModal.classList.add('show');
      }
    } catch (error) {
      console.error('Erro ao inicializar autenticação Firebase:', error);
      cleanLocalUserData();
      const app = document.getElementById('mainApp') || document.querySelector('.app');
      if (app) app.style.display = 'none';
      showLoginModal();
    }
  })();
      showAuthFeedback('loginFeedback', authErrorMessage(error), 'error');
  
  // ==================== GRAND CARD & FINANCIAL MODULES MANAGER ====================
  window.PrismaFinancialDashboard = (function() {
    let activeModule = null; // 'cashflow' | 'distribution' | 'monitoring' | 'income-expense'
    let previousActiveElement = null;

    const moduleModals = {
      'cashflow': 'modalModuleCashflow',
      'distribution': 'modalModuleDistribution',
      'monitoring': 'modalModuleMonitoring',
      'income-expense': 'modalModuleIncomeExpense'
    };

    function openModule(moduleId, triggerElement = null) {
      if (!moduleId || !moduleModals[moduleId]) return;
      
      // Se outro modal estiver aberto, fecha com transição suave
      if (activeModule && activeModule !== moduleId) {
        closeModule(false);
      }

      const modalId = moduleModals[moduleId];
      const modalEl = document.getElementById(modalId);
      if (!modalEl) return;

      if (triggerElement) {
        previousActiveElement = triggerElement;
      } else if (document.activeElement) {
        previousActiveElement = document.activeElement;
      }

      activeModule = moduleId;
      modalEl.style.display = 'flex';
      modalEl.classList.add('show', 'active');
      modalEl.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-module-open');

      // Garante redesenho e atualização de gráficos no Chart.js
      if (moduleId === 'cashflow') {
        requestAnimationFrame(() => {
          if (cashflowChart) {
            cashflowChart.resize();
            cashflowChart.update();
          } else if (typeof initCashflowChart === 'function') {
            initCashflowChart();
          }
        });
      } else if (moduleId === 'distribution') {
        requestAnimationFrame(() => {
          if (pieChart) {
            pieChart.resize();
            pieChart.update();
          } else if (typeof initPieChart === 'function') {
            initPieChart();
          }
          if (incomePieChart) {
            incomePieChart.resize();
            incomePieChart.update();
          } else if (typeof initIncomePieChart === 'function') {
            initIncomePieChart();
          }
        });
      } else if (moduleId === 'monitoring') {
        if (typeof updateMonitoringCenter === 'function') {
          try { updateMonitoringCenter(); } catch (_) {}
        }
      } else if (moduleId === 'income-expense') {
        if (typeof updateIncomeExpenseCard === 'function') {
          try { updateIncomeExpenseCard(); } catch (_) {}
        }
      }

      if (typeof refreshIcons === 'function') refreshIcons();

      // Foco acessível no botão de fechar ou primeiro elemento
      requestAnimationFrame(() => {
        const focusTarget = modalEl.querySelector('.financial-modal-close, button, input');
        if (focusTarget) focusTarget.focus();
      });
    }

    function closeModule(restoreFocus = true) {
      if (!activeModule) return;
      const modalId = moduleModals[activeModule];
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
        modalEl.style.display = 'none';
        modalEl.classList.remove('show', 'active');
        modalEl.setAttribute('aria-hidden', 'true');
      }

      activeModule = null;

      // Trava de rolagem só é removida se não houver outros modais abertos
      const anyModalOpen = document.querySelector('.financial-module-modal.show, .modal.show, .modal-overlay.show');
      if (!anyModalOpen) {
        document.body.classList.remove('modal-module-open');
      }

      if (restoreFocus && previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }

    function init() {
      // Cliques nos módulos do Grand Card
      document.querySelectorAll('[data-open-module]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const modId = item.dataset.openModule;
          openModule(modId, item);
        });
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const modId = item.dataset.openModule;
            openModule(modId, item);
          }
        });
      });

      // Botões de fechar modais
      document.querySelectorAll('.financial-modal-close, [data-close-module]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          closeModule(true);
        });
      });

      // Fechamento ao clicar no overlay escuro fora do conteúdo
      document.querySelectorAll('.financial-module-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal || e.target.classList.contains('financial-modal-backdrop')) {
            closeModule(true);
          }
        });
      });

      // Fechamento pela tecla Escape
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeModule) {
          closeModule(true);
        }
      });

      // Tratamento para ações de Adicionar Receita / Despesa dentro do Modal 4
      document.addEventListener('click', (e) => {
        const btnRec = e.target.closest('[data-action="add-receita"]');
        if (btnRec) {
          if (activeModule) closeModule(false);
          const addBtn = document.getElementById('addReceitaBtn');
          if (addBtn) addBtn.click();
          return;
        }
        const btnDesp = e.target.closest('[data-action="add-despesa"]');
        if (btnDesp) {
          if (activeModule) closeModule(false);
          const addBtnD = document.getElementById('addDespesaBtn');
          if (addBtnD) addBtnD.click();
          return;
        }
      });
    }

    return {
      open: openModule,
      openModule,
      close: closeModule,
      closeModule,
      getActive: () => activeModule,
      init
    };
  })();

  // Inicializa o gerenciador do Grand Card
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PrismaFinancialDashboard.init());
  } else {
    window.PrismaFinancialDashboard.init();
  }

  // Initialize charts on first load and when returning to dashboard
  
  function initializeCharts() {
    if (!window.Chart) {
      setTimeout(initializeCharts, 120);
      return;
    }
    if (chartsInitialized) {
      try { updatePieChart(); } catch (_) {}
      try { updateIncomePieChart(); } catch (_) {}
      return;
    }
    chartsInitialized = true;
    
    try {
      initCashflowChart();
    } catch (error) {
      console.error('Erro ao inicializar gráfico de fluxo:', error);
    }
    
    try {
      rebuildExpenseCategoriesFromData();
      initPieChart();
    } catch (error) {
      console.error('Erro ao inicializar gráfico de pizza:', error);
    }

    try {
      initIncomePieChart();
    } catch (error) {
      console.error('Erro ao inicializar gráfico de receitas:', error);
    }
    
    try {
      initReportChart();
    } catch (error) {
      console.error('Erro ao inicializar gráfico de relatório:', error);
    }
  }
  
  // Inicializar o dashboard também na primeira abertura
  setTimeout(initializeCharts, 150);

  // Reforçar inicialização ao acessar o dashboard
  const dashboardNavItem = document.querySelector('[data-section="dashboard"]');
  if (dashboardNavItem) {
    dashboardNavItem.addEventListener('click', () => {
      setTimeout(initializeCharts, 100);
    });
  }

  // Window resize re-trigger
  window.addEventListener('resize', () => {
    if (cashflowChart) cashflowChart.resize();
    if (pieChart) pieChart.resize();
    if (incomePieChart) incomePieChart.resize();
    if (reportChart) reportChart.resize();
  });

  // ==================== INVESTMENT CARDS SYSTEM ====================
  const investmentData = {
    tesouro: {
      title: 'Tesouro Direto',
      subtitle: 'Títulos públicos garantidos pelo governo',
      description: 'Programa do governo brasileiro para compra de títulos públicos por pessoas físicas.',
      risk: 'Baixo', liquidity: 'D+1', tax: 'Regressivo', guarantee: 'Governo Federal',
      rate: 10.5, icon: 'landmark', color: 'rgba(242, 169, 0, 0.15)', iconColor: '#F2A900',
      options: [
        { id: 'selic', name: 'Tesouro Selic', desc: 'Título público pós-fixado', rate: 10.5, rateLabel: 'Conforme Selic', risk: 'Baixo', liquidity: 'D+1' },
        { id: 'prefixado', name: 'Tesouro Prefixado', desc: 'Taxa definida no momento da compra', rate: 11.2, rateLabel: 'Prefixado', risk: 'Baixo', liquidity: 'D+1' },
        { id: 'ipca', name: 'Tesouro IPCA+', desc: 'Proteção contra inflação + juros', rate: 6.5, rateLabel: 'IPCA + juro real', risk: 'Baixo', liquidity: 'D+1' },
        { id: 'ipca-juros', name: 'Tesouro IPCA+ com Juros Semestrais', desc: 'Cupom semestral + correção IPCA', rate: 6.0, rateLabel: 'IPCA + cupom', risk: 'Baixo', liquidity: 'D+1' },
        { id: 'renda-mais', name: 'Tesouro RendA+', desc: 'Renda mensal para aposentadoria', rate: 6.2, rateLabel: 'IPCA + juro', risk: 'Baixo', liquidity: 'D+1' }
      ]
    },
    cdb: {
      title: 'CDB',
      subtitle: 'Certificado de Depósito Bancário',
      description: 'Título emitido por bancos com proteção do FGC até R$ 250 mil.',
      risk: 'Baixo', liquidity: 'Variável', tax: 'Regressivo', guarantee: 'FGC',
      rate: 11.2, icon: 'landmark', color: 'rgba(0, 255, 136, 0.15)', iconColor: '#00FF88',
      options: [
        { id: 'cdb-100', name: 'CDB 100% CDI', desc: 'Rentabilidade atrelada a 100% do CDI', rate: 10.5, rateLabel: '100% CDI', risk: 'Baixo', liquidity: 'D+0 a D+30' },
        { id: 'cdb-110', name: 'CDB 110% CDI', desc: 'Rentabilidade atrelada a 110% do CDI', rate: 11.55, rateLabel: '110% CDI', risk: 'Baixo', liquidity: 'D+0 a D+30' },
        { id: 'cdb-120', name: 'CDB 120% CDI', desc: 'Rentabilidade atrelada a 120% do CDI', rate: 12.6, rateLabel: '120% CDI', risk: 'Baixo', liquidity: 'Carência comum' },
        { id: 'cdb-pre', name: 'CDB Prefixado', desc: 'Taxa fixa definida na aplicação', rate: 11.8, rateLabel: 'Prefixado', risk: 'Baixo', liquidity: 'No vencimento' },
        { id: 'cdb-ipca', name: 'CDB IPCA+', desc: 'Inflação + juro real', rate: 6.8, rateLabel: 'IPCA+', risk: 'Baixo', liquidity: 'No vencimento' }
      ]
    },
    acoes: {
      title: 'Ações',
      subtitle: 'Participação em empresas de capital aberto',
      description: 'Frações do capital de empresas listadas em bolsa.',
      risk: 'Alto', liquidity: 'D+0', tax: '15% sobre ganhos', guarantee: 'Sem garantia',
      rate: 12.0, icon: 'trending-up', color: 'rgba(255, 84, 112, 0.15)', iconColor: '#FF5470',
      catalogCategory: 'acoes-br',
      options: [
        { id: 'petr4', name: 'PETR4', desc: 'Petrobras PN', rate: 12, rateLabel: 'Variável', risk: 'Alto', liquidity: 'D+0', ticker: 'PETR4' },
        { id: 'vale3', name: 'VALE3', desc: 'Vale ON', rate: 11, rateLabel: 'Variável', risk: 'Alto', liquidity: 'D+0', ticker: 'VALE3' },
        { id: 'itub4', name: 'ITUB4', desc: 'Itaú Unibanco PN', rate: 10, rateLabel: 'Variável', risk: 'Alto', liquidity: 'D+0', ticker: 'ITUB4' },
        { id: 'bbas3', name: 'BBAS3', desc: 'Banco do Brasil ON', rate: 10, rateLabel: 'Variável', risk: 'Alto', liquidity: 'D+0', ticker: 'BBAS3' },
        { id: 'abev3', name: 'ABEV3', desc: 'Ambev ON', rate: 9, rateLabel: 'Variável', risk: 'Médio-Alto', liquidity: 'D+0', ticker: 'ABEV3' },
        { id: 'b3sa3', name: 'B3SA3', desc: 'B3 ON', rate: 11, rateLabel: 'Variável', risk: 'Alto', liquidity: 'D+0', ticker: 'B3SA3' }
      ]
    },
    fii: {
      title: 'Fundos Imobiliários',
      subtitle: 'Investimento em imóveis via bolsa',
      description: 'Cotas de fundos com foco em imóveis e rendimentos periódicos.',
      risk: 'Médio', liquidity: 'D+2', tax: 'Isento sobre dividendos', guarantee: 'Sem garantia',
      rate: 10.0, icon: 'building', color: 'rgba(167, 139, 250, 0.15)', iconColor: '#A78BFA',
      catalogCategory: 'fiis',
      options: [
        { id: 'hglg11', name: 'HGLG11', desc: 'CSHG Logística', rate: 9.5, rateLabel: 'Yield + valorização', risk: 'Médio', liquidity: 'D+2', ticker: 'HGLG11' },
        { id: 'mxrf11', name: 'MXRF11', desc: 'Maxi Renda', rate: 11, rateLabel: 'Yield + valorização', risk: 'Médio', liquidity: 'D+2', ticker: 'MXRF11' },
        { id: 'knri11', name: 'KNRI11', desc: 'Kinea Renda Imobiliária', rate: 9, rateLabel: 'Yield + valorização', risk: 'Médio', liquidity: 'D+2', ticker: 'KNRI11' },
        { id: 'xplg11', name: 'XPLG11', desc: 'XP Log', rate: 9.5, rateLabel: 'Yield + valorização', risk: 'Médio', liquidity: 'D+2', ticker: 'XPLG11' },
        { id: 'btlg11', name: 'BTLG11', desc: 'BTG Pactual Logística', rate: 9.2, rateLabel: 'Yield + valorização', risk: 'Médio', liquidity: 'D+2', ticker: 'BTLG11' }
      ]
    },
    cripto: {
      title: 'Criptomoedas',
      subtitle: 'Ativos digitais descentralizados',
      description: 'Ativos digitais com alta volatilidade e liquidez 24/7.',
      risk: 'Muito Alto', liquidity: 'Imediata', tax: '15% sobre ganhos', guarantee: 'Sem garantia',
      rate: 15.0, icon: 'bitcoin', color: 'rgba(242, 169, 0, 0.15)', iconColor: '#F2A900',
      catalogCategory: 'criptomoedas',
      options: [
        { id: 'btc', name: 'Bitcoin (BTC)', desc: 'Principal criptomoeda por capitalização', rate: 15, rateLabel: 'Variável', risk: 'Muito Alto', liquidity: 'Imediata', ticker: 'BTC' },
        { id: 'eth', name: 'Ethereum (ETH)', desc: 'Plataforma de contratos inteligentes', rate: 14, rateLabel: 'Variável', risk: 'Muito Alto', liquidity: 'Imediata', ticker: 'ETH' },
        { id: 'usdt', name: 'Tether (USDT)', desc: 'Stablecoin lastreada em USD', rate: 4, rateLabel: 'Estável', risk: 'Médio', liquidity: 'Imediata', ticker: 'USDT' },
        { id: 'bnb', name: 'BNB', desc: 'Token do ecossistema Binance', rate: 12, rateLabel: 'Variável', risk: 'Muito Alto', liquidity: 'Imediata', ticker: 'BNB' },
        { id: 'sol', name: 'Solana (SOL)', desc: 'Blockchain de alta performance', rate: 16, rateLabel: 'Variável', risk: 'Muito Alto', liquidity: 'Imediata', ticker: 'SOL' },
        { id: 'xrp', name: 'XRP', desc: 'Pagamentos internacionais', rate: 11, rateLabel: 'Variável', risk: 'Muito Alto', liquidity: 'Imediata', ticker: 'XRP' }
      ]
    },
    multimercado: {
      title: 'Fundos Multimercado',
      subtitle: 'Diversificação em classes de ativos',
      description: 'Fundos com gestão ativa em renda fixa, ações, câmbio e derivativos.',
      risk: 'Médio', liquidity: 'D+30 a D+60', tax: 'Regressivo', guarantee: 'Sem garantia',
      rate: 15.0, icon: 'pie-chart', color: 'rgba(0, 200, 255, 0.15)', iconColor: '#00C8FF',
      options: [
        { id: 'mm-conservador', name: 'Multimercado Conservador', desc: 'Baixa volatilidade, foco em RF', rate: 11, rateLabel: 'Estimativa a.a.', risk: 'Baixo-Médio', liquidity: 'D+30' },
        { id: 'mm-moderado', name: 'Multimercado Moderado', desc: 'Equilíbrio entre RF e RV', rate: 14, rateLabel: 'Estimativa a.a.', risk: 'Médio', liquidity: 'D+30' },
        { id: 'mm-arrojado', name: 'Multimercado Arrojado', desc: 'Maior exposição a risco', rate: 18, rateLabel: 'Estimativa a.a.', risk: 'Alto', liquidity: 'D+60' }
      ]
    }
  };

  let investmentChart = null;

  // Investment card click handlers

  // ========== CATÁLOGO DE ATIVOS (PrismaAssets) ==========
  function mapCategoryToTipo(cat) {
    const m = {
      'criptomoedas': 'criptomoedas',
      'acoes-br': 'acoes',
      'acoes-global': 'acoes',
      'fiis': 'fiis',
      'renda-fixa': 'renda-fixa',
      'fundos': 'fundos',
      'etfs': 'etfs'
    };
    return m[cat] || 'outros';
  }

  function renderAssetCatalog() {
    if (typeof PrismaAssets === 'undefined') return;
    const grid = document.getElementById('assetCatalogGrid');
    const countEl = document.getElementById('assetCatalogCount');
    if (!grid) return;
    const q = document.getElementById('assetCatalogSearch')?.value || '';
    const filters = {
      category: document.getElementById('assetCatalogCategory')?.value || 'todas',
      market: document.getElementById('assetCatalogMarket')?.value || 'todos',
      sector: document.getElementById('assetCatalogSector')?.value || 'todos'
    };
    const list = PrismaAssets.search(q, filters);
    if (countEl) countEl.textContent = list.length + ' ativo' + (list.length !== 1 ? 's' : '') + ' encontrados';
    const labels = PrismaAssets.categoryLabels || {};
    grid.innerHTML = list.slice(0, 80).map((a) => {
      let badgeClass = '';
      let badgeText = labels[a.category] || a.category;
      if (a.category === 'criptomoedas') badgeClass = 'cripto';
      else if (a.category === 'fiis') badgeClass = 'fii';
      else if (a.category === 'acoes-br') badgeClass = 'br';
      else if (a.category === 'acoes-global') badgeClass = 'global';
      return `<div class="asset-card" data-asset-id="${a.id}">
        <div class="ac-top">
          <div>
            <div class="ac-ticker">${escapeHtml(a.ticker)}</div>
            <div class="ac-name">${escapeHtml(a.name)}</div>
          </div>
          <span class="ac-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
        </div>
        <div class="ac-meta">
          <span>${escapeHtml(a.market || '')}</span>
          <span>·</span>
          <span>${escapeHtml(a.sector || a.segment || '')}</span>
          <span>·</span>
          <span>${escapeHtml(a.currency || '')}</span>
        </div>
        <button type="button" class="btn primary btn-sm ac-add" data-add-asset="${a.id}"><i data-lucide="plus"></i> Adicionar</button>
      </div>`;
    }).join('') || '<p class="text-muted" style="padding:1rem;">Nenhum ativo encontrado com esses filtros.</p>';
    grid.querySelectorAll('[data-add-asset]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAssetAddModal(btn.dataset.addAsset);
      });
    });
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function openAssetAddModal(assetId) {
    if (typeof PrismaAssets === 'undefined') return;
    const asset = PrismaAssets.getById(assetId);
    if (!asset) return;
    const modal = document.getElementById('assetAddModal');
    const form = document.getElementById('assetAddForm');
    if (!modal) return;
    if (form) form.reset();
    document.getElementById('assetAddId').value = asset.id;
    document.getElementById('assetAddSummary').textContent = `${asset.ticker} · ${asset.name} · ${asset.market} · ${asset.currency}`;
    document.getElementById('assetAddDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('assetAddTotal').textContent = fmtMoney(0);
    openModal(modal);
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function updateAssetAddTotal() {
    const qty = parseFloat(String(document.getElementById('assetAddQty')?.value || '').replace(',', '.')) || 0;
    const price = typeof parseMoneyInput === 'function'
      ? (parseMoneyInput(document.getElementById('assetAddPrice')?.value) || 0)
      : (parseFloat(String(document.getElementById('assetAddPrice')?.value || '').replace(',', '.')) || 0);
    const fees = typeof parseMoneyInput === 'function'
      ? (parseMoneyInput(document.getElementById('assetAddFees')?.value) || 0)
      : 0;
    const total = qty * price + fees;
    const el = document.getElementById('assetAddTotal');
    if (el) el.textContent = fmtMoney(total);
  }

  function initAssetCatalog() {
    if (typeof PrismaAssets === 'undefined') {
      console.warn('PrismaAssets catalog not loaded');
      return;
    }
    const catalogModal = document.getElementById('assetCatalogModal');
    const openCatalogBtn = document.getElementById('btnOpenAssetCatalog');
    const closeCatalogBtn = document.getElementById('closeAssetCatalogModal');
    if (openCatalogBtn) openCatalogBtn.addEventListener('click', () => openModal(catalogModal));
    if (closeCatalogBtn) closeCatalogBtn.addEventListener('click', () => closeModal(catalogModal));
    if (catalogModal) {
      catalogModal.addEventListener('click', (event) => {
        if (event.target === catalogModal) closeModal(catalogModal);
      });
    }
    renderAssetCatalog();
    ['assetCatalogSearch', 'assetCatalogCategory', 'assetCatalogMarket', 'assetCatalogSector'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'assetCatalogSearch' ? 'input' : 'change', renderAssetCatalog);
    });
    const closeBtn = document.getElementById('closeAssetAddModal');
    const cancelBtn = document.getElementById('cancelAssetAddBtn');
    const modal = document.getElementById('assetAddModal');
    const form = document.getElementById('assetAddForm');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal, form));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(modal, form));
    ['assetAddQty', 'assetAddPrice', 'assetAddFees'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateAssetAddTotal);
    });
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const assetId = document.getElementById('assetAddId').value;
        const asset = PrismaAssets.getById(assetId);
        if (!asset) return;
        const qty = parseFloat(String(document.getElementById('assetAddQty').value || '').replace(',', '.'));
        const price = parseMoneyInput(document.getElementById('assetAddPrice').value) || 0;
        let priceNow = document.getElementById('assetAddCurrent').value;
        priceNow = priceNow ? (parseMoneyInput(priceNow) || price) : price;
        const fees = parseMoneyInput(document.getElementById('assetAddFees').value) || 0;
        const date = document.getElementById('assetAddDate').value || new Date().toISOString().split('T')[0];
        const broker = (document.getElementById('assetAddBroker').value || '').trim();
        const obs = (document.getElementById('assetAddObs').value || '').trim();
        if (!qty || qty <= 0 || price < 0) {
          showToast('Informe quantidade e preço válidos');
          return;
        }
        const valorAplicado = qty * price + fees;
        const valorAtual = qty * priceNow;
        const tipo = mapCategoryToTipo(asset.category);
        const item = (typeof normalizeInvestimento === 'function' ? normalizeInvestimento : (x) => x)({
          assetId: asset.id,
          ticker: asset.ticker,
          nome: `${asset.ticker} — ${asset.name}`,
          tipo,
          category: asset.category,
          country: asset.country,
          market: asset.market,
          sector: asset.sector,
          currency: asset.currency,
          instituicao: broker,
          valorAplicado,
          valorInvestido: valorAplicado,
          valor: valorAplicado,
          valorAtual,
          valorTotal: valorAtual,
          quantidade: qty,
          precoMedio: price,
          precoAtual: priceNow,
          lucro: valorAtual - valorAplicado,
          dataAplicacao: date,
          status: 'ativo',
          observacoes: obs || `Ativo do catálogo · ${asset.ticker}`,
          historico: [{ tipo: 'aporte', valor: valorAplicado, quantidade: qty, data: date, obs: 'Compra via catálogo' }],
          priceSource: 'manual',
          icon: asset.category === 'criptomoedas' ? 'bitcoin' : (asset.category === 'fiis' ? 'building' : 'trending-up')
        });
        if (!Array.isArray(investimentos)) investimentos = [];
        // Se já existe mesma ticker+broker, poderia consolidar — por simplicidade, nova posição
        investimentos.push(item);
        closeModal(modal, form);
        if (typeof recalculateAll === 'function') recalculateAll();
        else if (typeof renderInvestimentos === 'function') {
          if (typeof saveDataStorage === 'function' && typeof STORAGE_KEYS !== 'undefined') {
            saveDataStorage(STORAGE_KEYS.investimentos, investimentos);
          }
          renderInvestimentos();
        }
        showToast(`${asset.ticker} adicionado à carteira!`, {
          label: 'Ver carteira',
          onClick: () => {
            const card = document.getElementById('investimentosPortfolioCard');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }
  }

  // Init catalog when DOM ready (also safe if already loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssetCatalog);
  } else {
    setTimeout(initAssetCatalog, 0);
  }

  document.querySelectorAll('.invest-card').forEach(card => {
    card.addEventListener('click', function () {
      const investType = this.getAttribute('data-invest');
      openInvestmentModal(investType);
    });
  });

  let currentInvestOption = null;

  function getCategoryOptions(type) {
    const data = investmentData[type];
    if (!data) return [];
    // Merge catalog assets when available (ações, FIIs, cripto)
    if (data.catalogCategory && typeof PrismaAssets !== 'undefined' && PrismaAssets.search) {
      try {
        const fromCatalog = PrismaAssets.search('', { category: data.catalogCategory }) || [];
        if (fromCatalog.length) {
          return fromCatalog.map((a) => ({
            id: a.id || a.ticker,
            name: a.ticker || a.name,
            desc: a.name || a.description || '',
            rate: data.rate,
            rateLabel: 'Variável',
            risk: data.risk,
            liquidity: data.liquidity,
            ticker: a.ticker,
            assetId: a.id
          }));
        }
      } catch (_) {}
    }
    return Array.isArray(data.options) ? data.options.slice() : [];
  }

  function openInvestmentModal(type) {
    const data = investmentData[type];
    if (!data) return;

    const modal = document.getElementById('investModal');
    if (!modal) return;
    modal.dataset.currentInvest = type;
    currentInvestOption = null;

    document.getElementById('modalInvestTitle').textContent = data.title;
    document.getElementById('modalInvestSubtitle').textContent = data.subtitle;
    const descEl = document.getElementById('modalInvestDescription');
    if (descEl) descEl.textContent = data.description || '';

    const iconElement = document.getElementById('modalInvestIcon');
    if (iconElement) {
      iconElement.style.background = data.color;
      iconElement.style.color = data.iconColor;
      iconElement.innerHTML = `<i data-lucide="${data.icon}"></i>`;
    }

    const bcCat = document.getElementById('bcCategory');
    if (bcCat) {
      bcCat.textContent = data.title;
      bcCat.classList.add('is-active');
    }
    const bcProd = document.getElementById('bcProduct');
    if (bcProd) {
      bcProd.hidden = true;
      bcProd.classList.remove('is-active');
    }
    document.querySelectorAll('.invest-bc-sim-sep').forEach((el) => { el.hidden = true; });

    showInvestStep('options');
    renderInvestOptions(type, '');
    modal.classList.add('show');
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function showInvestStep(step) {
    const opt = document.getElementById('investStepOptions');
    const sim = document.getElementById('investStepSimulate');
    if (opt) opt.hidden = step !== 'options';
    if (sim) sim.hidden = step !== 'simulate';
  }

  function renderInvestOptions(type, query) {
    const grid = document.getElementById('investOptionsGrid');
    const toolbar = document.getElementById('investOptionsToolbar');
    const hint = document.getElementById('investOptionsHint');
    if (!grid) return;
    let options = getCategoryOptions(type);
    const q = (query || '').trim().toLowerCase();
    if (q) {
      options = options.filter((o) =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.desc || '').toLowerCase().includes(q) ||
        (o.ticker || '').toLowerCase().includes(q)
      );
    }
    // Search toolbar for larger lists
    if (toolbar) toolbar.hidden = getCategoryOptions(type).length < 8 && !q;

    if (hint) {
      const data = investmentData[type];
      hint.textContent = options.length
        ? `Selecione uma opção de ${data ? data.title : 'investimento'}`
        : 'Nenhuma opção encontrada';
    }

    grid.innerHTML = options.map((o) => `
      <button type="button" class="invest-option-card" data-option-id="${o.id}">
        <div class="invest-option-main">
          <strong class="invest-option-name">${escapeHtml(o.name)}</strong>
          <span class="invest-option-desc">${escapeHtml(o.desc || '')}</span>
        </div>
        <div class="invest-option-meta">
          <span>${escapeHtml(o.rateLabel || (o.rate != null ? o.rate + '% a.a.' : '—'))}</span>
          <span class="invest-option-cta">Ver opção →</span>
        </div>
      </button>
    `).join('') || '<p class="text-muted" style="padding:1rem;text-align:center;">Nenhuma opção nesta categoria.</p>';

    grid.querySelectorAll('[data-option-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = options.find((x) => String(x.id) === String(btn.dataset.optionId));
        if (opt) openInvestSimulation(type, opt);
      });
    });
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function openInvestSimulation(type, option) {
    const data = investmentData[type];
    if (!data || !option) return;
    currentInvestOption = option;
    showInvestStep('simulate');

    const bcProd = document.getElementById('bcProduct');
    if (bcProd) {
      bcProd.hidden = false;
      bcProd.textContent = option.name;
      bcProd.classList.add('is-active');
    }
    document.querySelectorAll('.invest-bc-sim-sep').forEach((el) => { el.hidden = false; });
    const bcCat = document.getElementById('bcCategory');
    if (bcCat) bcCat.classList.remove('is-active');

    const backLabel = document.getElementById('investBackLabel');
    if (backLabel) backLabel.textContent = `Voltar para ${data.title}`;

    document.getElementById('simProductName').textContent = option.name;
    document.getElementById('simProductDesc').textContent = option.desc || data.description || '';
    document.getElementById('modalRisk').textContent = option.risk || data.risk;
    document.getElementById('modalLiquidity').textContent = option.liquidity || data.liquidity;
    document.getElementById('modalTax').textContent = data.tax;
    document.getElementById('modalGuarantee').textContent = data.guarantee;

    const rateInput = document.getElementById('investRateInput');
    if (rateInput) rateInput.value = option.rate != null ? option.rate : data.rate;

    const val = document.getElementById('investValue');
    const period = document.getElementById('investPeriod');
    const monthly = document.getElementById('investMonthly');
    if (val && !val.value) val.value = '1000';
    if (period && !period.value) period.value = '12';
    if (monthly && monthly.value === '') monthly.value = '0';

    runInvestSimulation();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function runInvestSimulation() {
    const modal = document.getElementById('investModal');
    if (!modal) return;
    const type = modal.dataset.currentInvest;
    const data = investmentData[type];
    if (!data) return;

    const value = parseFloat(document.getElementById('investValue')?.value) || 0;
    const monthly = parseFloat(document.getElementById('investMonthly')?.value) || 0;
    const period = parseInt(document.getElementById('investPeriod')?.value, 10) || 0;
    const annualRate = parseFloat(document.getElementById('investRateInput')?.value);
    const rate = Number.isFinite(annualRate) ? annualRate : (currentInvestOption?.rate ?? data.rate);

    if (value < 0 || period <= 0) {
      return;
    }

    const monthlyRate = rate / 100 / 12;
    // FV = P*(1+r)^n + PMT * (((1+r)^n - 1) / r)
    let totalValue = value * Math.pow(1 + monthlyRate, period);
    if (monthly > 0 && monthlyRate !== 0) {
      totalValue += monthly * (Math.pow(1 + monthlyRate, period) - 1) / monthlyRate;
    } else if (monthly > 0) {
      totalValue += monthly * period;
    }
    const totalInvested = value + monthly * period;
    const profit = totalValue - totalInvested;
    const effectiveRate = totalInvested > 0 ? ((totalValue / totalInvested - 1) * 100) : 0;

    const fmt = typeof formatCurrency === 'function' ? formatCurrency : (n) => 'R$ ' + (Number(n) || 0).toFixed(2);
    document.getElementById('resultInvested').textContent = fmt(totalInvested);
    document.getElementById('resultTotal').textContent = fmt(totalValue);
    document.getElementById('resultProfit').textContent = fmt(profit);
    document.getElementById('resultRate').textContent = (effectiveRate >= 0 ? '+' : '') + effectiveRate.toFixed(2) + '%';
    const aportesEl = document.getElementById('resultAportes');
    if (aportesEl) aportesEl.textContent = `Total de aportes: ${fmt(totalInvested)}`;
    const prazoEl = document.getElementById('resultPrazo');
    if (prazoEl) prazoEl.textContent = `Prazo: ${period} mese${period === 1 ? '' : 's'}`;

    const color = data.iconColor || '#00C8FF';
    generateInvestmentChart(value, monthly, monthlyRate, period, color);
  }

  // Close modal
  document.getElementById('closeInvestModal')?.addEventListener('click', () => {
    document.getElementById('investModal')?.classList.remove('show');
  });
  document.getElementById('investModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });

  // Navigation
  document.getElementById('investBackToCategories')?.addEventListener('click', () => {
    document.getElementById('investModal')?.classList.remove('show');
  });
  document.getElementById('investBackToOptions')?.addEventListener('click', () => {
    const modal = document.getElementById('investModal');
    const type = modal?.dataset.currentInvest;
    currentInvestOption = null;
    showInvestStep('options');
    const bcProd = document.getElementById('bcProduct');
    if (bcProd) { bcProd.hidden = true; bcProd.classList.remove('is-active'); }
    document.querySelectorAll('.invest-bc-sim-sep').forEach((el) => { el.hidden = true; });
    document.getElementById('bcCategory')?.classList.add('is-active');
    if (type) renderInvestOptions(type, document.getElementById('investOptionSearch')?.value || '');
  });
  document.querySelectorAll('#investBreadcrumb [data-invest-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.investStep;
      if (step === 'categories') {
        document.getElementById('investModal')?.classList.remove('show');
      } else if (step === 'options') {
        document.getElementById('investBackToOptions')?.click();
      }
    });
  });

  // Live simulation
  ['investValue', 'investMonthly', 'investPeriod', 'investRateInput'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (!document.getElementById('investStepSimulate')?.hidden) runInvestSimulation();
    });
  });

  // Search options
  document.getElementById('investOptionSearch')?.addEventListener('input', (e) => {
    const modal = document.getElementById('investModal');
    const type = modal?.dataset.currentInvest;
    if (type) renderInvestOptions(type, e.target.value);
  });

  // Legacy calculate button (if still present)
  document.getElementById('calculateBtn')?.addEventListener('click', () => runInvestSimulation());

  // Apply investment
  document.getElementById('applyInvestmentBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('investModal');
    const type = modal?.dataset.currentInvest;
    const data = investmentData[type];
    if (!data) return;

    const value = parseFloat(document.getElementById('investValue')?.value) || 0;
    const monthly = parseFloat(document.getElementById('investMonthly')?.value) || 0;
    const period = parseInt(document.getElementById('investPeriod')?.value, 10) || 0;
    const annualRate = parseFloat(document.getElementById('investRateInput')?.value);
    const rate = Number.isFinite(annualRate) ? annualRate : (currentInvestOption?.rate ?? data.rate);

    if (value <= 0 && monthly <= 0) {
      showToast('Informe um valor inicial ou aporte mensal válido');
      return;
    }
    if (period <= 0) {
      showToast('Informe um prazo válido');
      return;
    }

    const monthlyRate = rate / 100 / 12;
    let totalValue = value * Math.pow(1 + monthlyRate, period);
    if (monthly > 0 && monthlyRate !== 0) {
      totalValue += monthly * (Math.pow(1 + monthlyRate, period) - 1) / monthlyRate;
    } else if (monthly > 0) {
      totalValue += monthly * period;
    }
    const totalInvested = value + monthly * period;
    const profit = totalValue - totalInvested;
    const effectiveRate = totalInvested > 0 ? ((totalValue / totalInvested - 1) * 100) : 0;

    const productName = currentInvestOption?.name || data.title;
    const existingInvestments = Array.isArray(investimentos) ? investimentos : [];

    const newInvestment = {
      id: Date.now(),
      tipo: type,
      nome: productName,
      ticker: currentInvestOption?.ticker || '',
      assetId: currentInvestOption?.assetId || currentInvestOption?.id || '',
      valorInvestido: totalInvested,
      valorAplicado: value > 0 ? value : totalInvested,
      valor: value > 0 ? value : totalInvested,
      valorAtual: totalValue,
      valorTotal: totalValue,
      periodo: period,
      lucro: profit,
      rentabilidade: parseFloat(effectiveRate.toFixed(2)),
      rent: parseFloat(effectiveRate.toFixed(2)),
      status: 'ativo',
      instituicao: '',
      historico: [{ tipo: 'aporte', valor: value > 0 ? value : totalInvested, data: new Date().toISOString().split('T')[0], obs: 'Aplicação via simulador · ' + productName }],
      dataAplicacao: new Date().toISOString().split('T')[0],
      dataVencimento: new Date(Date.now() + period * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      icon: data.icon || 'trending-up',
      rateAssumed: rate,
      monthlyContribution: monthly
    };

    existingInvestments.push(newInvestment);
    investimentos = existingInvestments;
    saveDataStorage(STORAGE_KEYS.investimentos, investimentos);
    if (typeof recalculateAll === 'function') recalculateAll();
    else if (typeof renderInvestimentos === 'function') renderInvestimentos();

    modal.classList.remove('show');
    showToast(`Investimento em ${productName} aplicado com sucesso!`, {
      label: 'Ver carteira',
      onClick: () => {
        const nav = document.querySelector('.nav-item[data-section="carteira-ativos"]') || document.getElementById('btnCarteiraInvestimentos');
        if (nav) nav.click();
      }
    });
    if (typeof refreshIcons === 'function') refreshIcons();
  });

  function generateInvestmentChart(initialValue, monthlyContribution, monthlyRate, months, color) {
    const canvas = document.getElementById('investmentChart');
    if (!canvas || typeof window.Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const labels = [];
    const dataPoints = [];
    let current = initialValue || 0;
    for (let i = 0; i <= months; i++) {
      labels.push(i === 0 ? 'Início' : `M${i}`);
      dataPoints.push(Math.round(current * 100) / 100);
      if (i < months) {
        current = current * (1 + monthlyRate) + (monthlyContribution || 0);
      }
    }
    if (investmentChart) {
      try { investmentChart.destroy(); } catch (_) {}
    }
    investmentChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Valor acumulado',
          data: dataPoints,
          borderColor: color || '#00C8FF',
          backgroundColor: (color || '#00C8FF') + '22',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: months > 36 ? 0 : 2,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                return typeof formatCurrency === 'function' ? formatCurrency(v) : 'R$ ' + v.toFixed(2);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: 'rgba(241,245,249,0.55)', maxTicksLimit: 8, font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: {
              color: 'rgba(241,245,249,0.55)',
              font: { size: 10 },
              callback: (v) => {
                if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1) + 'M';
                if (v >= 1e3) return 'R$ ' + (v / 1e3).toFixed(0) + 'k';
                return 'R$ ' + v;
              }
            },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  // ==================== PRISMA AI: MOTOR DE ANÁLISE, RECOMENDAÇÕES E PLANO DE ECONOMIA ====================
  let aiActivePeriod = '30d';
  let aiActiveFilter = 'all';
  let aiCategoryChartInstance = null;
  let aiComparisonChartInstance = null;
  window.__currentAiAnalysis = null;
  window.__currentAiRecommendations = [];

  function getAiSavingsPlanKey() {
    return getScopedStorageKey('prisma_ai_savings_plan');
  }

  function getAiSavingsPlan() {
    let list = getJSONFromStorage(getAiSavingsPlanKey(), null);
    if (list === null) {
      list = getJSONFromStorage(getScopedStorageKey('prisma_recomendacoes_aplicadas'), []);
    }
    return Array.isArray(list) ? list : [];
  }

  function saveAiSavingsPlan(plan) {
    const arr = Array.isArray(plan) ? plan : [];
    setJSONToStorage(getAiSavingsPlanKey(), arr);
    setJSONToStorage(getScopedStorageKey('prisma_recomendacoes_aplicadas'), arr);
    if (typeof scheduleServerSync === 'function') scheduleServerSync();
    if (serverAuthenticated) {
      apiFetch('/api/prisma-ai/plan', {
        method: 'POST',
        body: JSON.stringify({ savingsPlan: arr })
      }).catch(err => console.warn('[PrismaAI] Sync plan warn:', err.message));
    }
  }

  async function analyzeFinances() {
    return runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: true });
  }

  async function runPrismaAiAnalysis(period = aiActivePeriod, options = {}) {
    aiActivePeriod = period;
    const showBot = options.showBotMessage !== false;

    // Obter transações reais do usuário autenticado / perfil ativo
    const recsList = typeof getReceitas === 'function' ? getReceitas() : getJSONFromStorage(STORAGE_KEYS.receitas, []);
    const despList = typeof getDespesas === 'function' ? getDespesas() : getJSONFromStorage(STORAGE_KEYS.despesas, []);
    const goalsList = typeof getGoals === 'function' ? getGoals() : getJSONFromStorage(STORAGE_KEYS.goals, []);

    if (showBot) {
      addBotMessage(`🔍 Analisando suas finanças para o período de ${periodLabel(period)} com base em seus lançamentos reais... Preservando despesas essenciais e calculando oportunidades de economia.`);
    }

    // Executar cálculo determinístico com o PrismaFinance
    let engine = window.PrismaFinance;

    // Lazy-merge: se os métodos de AI não estiverem no engine atual,
    // tenta encontrá-los num objeto PrismaFinance alternativo que o
    // prisma-finance-engine.js pode ter sobrescrito antes deste IIFE rodar.
    if (engine && typeof engine.analyzeFinances !== 'function') {
      const AI_ENGINE_METHODS = [
        'analyzeFinances', 'generateRecommendations', 'calculateConsolidatedSavings',
        'filterTransactionsByPeriod', 'classifyExpense',
        'detectRecurringAndSubscriptions', 'detectAtypicalAndDuplicates'
      ];
      // O engine.js usa UMD, então tenta root.PrismaFinance via globalThis backup
      const candidates = [window._PrismaFinanceEngine, globalThis._PrismaFinanceEngine];
      for (const candidate of candidates) {
        if (candidate && typeof candidate.analyzeFinances === 'function') {
          AI_ENGINE_METHODS.forEach(m => {
            if (typeof candidate[m] === 'function') {
              engine[m] = candidate[m].bind(candidate);
            }
          });
          break;
        }
      }
    }

    if (!engine || typeof engine.analyzeFinances !== 'function') {
      console.error('[PrismaAI] PrismaFinance engine não inicializado.');
      showToast('Erro ao carregar o motor financeiro.');
      return;
    }


    const analysis = engine.analyzeFinances({
      receitas: recsList,
      despesas: despList,
      goals: goalsList,
      period: aiActivePeriod
    });

    const savingsPlan = getAiSavingsPlan();
    const recommendations = engine.generateRecommendations(analysis, savingsPlan);
    const consolidated = engine.calculateConsolidatedSavings(
      recommendations,
      savingsPlan,
      analysis.transacoesDespesas,
      analysis.despesasAnteriorTotal
    );

    window.__currentAiAnalysis = analysis;
    window.__currentAiRecommendations = recommendations;

    // Atualizar UI
    scheduleServerSync();
    renderAiKpis(analysis, consolidated);
    renderAiDiagnostics(analysis, consolidated);
    renderAiCategoryChart(analysis);
    renderAiComparisonChart(analysis, consolidated);
    renderAiRecommendations(recommendations);
    renderAiSavingsPlan(savingsPlan, consolidated);

    // Persistir snapshot no backend se conectado
    if (serverAuthenticated) {
      apiFetch('/api/prisma-ai/analysis', {
        method: 'POST',
        body: JSON.stringify({ analysis, recommendations, healthScore: window.__currentAiHealthScore })
      }).catch(err => console.warn('[PrismaAI] Sync analysis warn:', err.message));
    }

    if (showBot) {
      let botMsg = `✅ Análise concluída com sucesso para o período de ${periodLabel(period)}!\n\n`;
      botMsg += `• Receitas analisadas: ${formatCurrency(analysis.receitasTotal)}\n`;
      botMsg += `• Despesas totais: ${formatCurrency(analysis.despesasTotal)} (${analysis.percentualEssencial.toFixed(0)}% essenciais / ${analysis.percentualNaoEssencial.toFixed(0)}% discricionárias)\n`;
      botMsg += `• Saldo disponível: ${formatCurrency(analysis.saldo)}\n`;
      botMsg += `• Taxa de poupança atual: ${analysis.taxaPoupanca.toFixed(1)}%\n\n`;

      if (recommendations.length > 0) {
        botMsg += `💡 Identifiquei ${recommendations.length} recomendação(ões) fundamentada(s) nos seus dados, com potencial de economia de até ${formatCurrency(consolidated.economiaPotencialTotal)} mensais (sem sobreposição).\n\n`;
        botMsg += `Veja os detalhes abaixo, selecione as ações que deseja adotar e clique em "Adicionar ao Plano" para transformá-las em metas!`;
      } else {
        botMsg += `🎉 Suas finanças estão muito bem equilibradas no período analisado! Não foram detectados gastos excessivos nem anomalias.`;
      }

      addBotMessage(botMsg);
      showToast('Análise financeira atualizada com sucesso!');
    }

    refreshIcons();
    return { analysis, recommendations, consolidated };
  }

  function periodLabel(p) {
    switch (p) {
      case '7d': return 'últimos 7 dias';
      case '30d': return 'últimos 30 dias';
      case '3m': return 'últimos 3 meses';
      case '6m': return 'últimos 6 meses';
      case '1y': return 'último 1 ano';
      case 'all': return 'todo o histórico cadastrado';
      default: return 'período selecionado';
    }
  }

  function renderAiKpis(analysis, consolidated) {
    const elRec = document.getElementById('aiValReceitas');
    const elDesp = document.getElementById('aiValDespesas');
    const elSaldo = document.getElementById('aiValSaldo');
    const elPot = document.getElementById('aiValPotencial');
    const elMeta = document.getElementById('aiValMeta');
    const elSubMeta = document.getElementById('aiSubMeta');
    const elReal = document.getElementById('aiValRealizada');
    const elTagReal = document.getElementById('aiTagRealizada');

    if (elRec) elRec.textContent = formatCurrency(analysis.receitasTotal);
    if (elDesp) elDesp.textContent = formatCurrency(analysis.despesasTotal);
    if (elSaldo) {
      elSaldo.textContent = formatCurrency(analysis.saldo);
      elSaldo.className = 'ai-kpi-val ' + (analysis.saldo >= 0 ? 'positive' : 'negative');
    }
    if (elPot) elPot.textContent = formatCurrency(consolidated.economiaPotencialTotal);
    if (elMeta) elMeta.textContent = formatCurrency(consolidated.economiaEstimada);
    if (elSubMeta) elSubMeta.textContent = `${consolidated.planoAtivoCount} meta(s) ativa(s)`;
    if (elReal) elReal.textContent = formatCurrency(consolidated.economiaRealizada);

    if (elTagReal) {
      if (consolidated.economiaRealizada > 0) {
        elTagReal.textContent = 'Comprovada';
        elTagReal.className = 'ai-kpi-tag verified';
      } else if (consolidated.temMetasPendentes) {
        elTagReal.textContent = 'Pendente';
        elTagReal.className = 'ai-kpi-tag pending';
      } else {
        elTagReal.textContent = 'Sem Metas';
        elTagReal.className = 'ai-kpi-tag pending';
      }
    }
  }

  function calculateFinancialHealthScore(analysis, consolidated) {
    let score = 50;
    const tp = analysis.taxaPoupanca || 0;
    if (tp >= 25) score += 30;
    else if (tp >= 20) score += 25;
    else if (tp >= 10) score += 15;
    else if (tp > 0) score += 5;
    else score -= 15;

    const ess = analysis.percentualEssencial || 0;
    if (ess >= 45 && ess <= 65) score += 15;
    else if (ess <= 75) score += 8;
    else if (ess > 85) score -= 10;

    if (analysis.saldo > 0) score += 15;
    else if (analysis.saldo < 0) score -= 20;

    if (analysis.duplicados && analysis.duplicados.length > 0) score -= 8;
    if (analysis.atipicos && analysis.atipicos.length > 0) score -= 5;

    score = Math.max(5, Math.min(100, Math.round(score)));

    return { score, ...getFinancialHealthPresentation(score) };
  }

  function getFinancialHealthPresentation(score) {
    if (score >= 80) {
      return {
        label: 'Excelente',
        badgeClass: 'saudavel',
        strokeColor: '#2ec4b6',
        desc: 'Parabéns! Sua taxa de poupança é sólida e seus gastos essenciais estão dentro da faixa ideal de segurança.'
      };
    }
    if (score >= 65) {
      return {
        label: 'Saudável',
        badgeClass: 'saudavel',
        strokeColor: '#00b4d8',
        desc: 'Situação estável com margem positiva. Há boas oportunidades para otimizar despesas discricionárias.'
      };
    }
    if (score < 45) {
      return {
        label: 'Atenção',
        badgeClass: 'critico',
        strokeColor: '#ef4444',
        desc: 'Despesas elevadas no período analisado. Priorize as recomendações de corte de alta prioridade.'
      };
    }
    return {
      label: 'Moderado',
      badgeClass: 'atencao',
      strokeColor: '#f59e0b',
      desc: 'Finanças em equilíbrio intermediário. Adote as recomendações sugeridas para acelerar sua capacidade de poupança.'
    };
  }

  function renderFinancialHealthScore(health, metrics) {
    const scoreNumEl = document.getElementById('aiScoreNumber');
    const scorePathEl = document.getElementById('aiScoreCirclePath');
    const scoreBadgeEl = document.getElementById('aiScoreBadge');
    const scoreDescEl = document.getElementById('aiScoreDesc');
    const poupValEl = document.getElementById('aiScorePoupVal');
    const essValEl = document.getElementById('aiScoreEssVal');
    const potValEl = document.getElementById('aiScorePotVal');

    if (scoreNumEl) scoreNumEl.textContent = health.score;
    if (scorePathEl) {
      scorePathEl.setAttribute('stroke-dasharray', `${health.score}, 100`);
      scorePathEl.style.stroke = health.strokeColor;
    }
    if (scoreBadgeEl) {
      scoreBadgeEl.textContent = health.label;
      scoreBadgeEl.className = `ai-score-badge ${health.badgeClass}`;
    }
    if (scoreDescEl) scoreDescEl.textContent = health.desc;
    if (poupValEl) poupValEl.textContent = `${Number(metrics.taxaPoupanca || 0).toFixed(0)}%`;
    if (essValEl) essValEl.textContent = `${Number(metrics.percentualEssencial || 0).toFixed(0)}%`;
    if (potValEl) potValEl.textContent = formatCurrency(Number(metrics.economiaPotencialTotal || 0));
  }

  function renderSavedFinancialHealthScore(snapshot) {
    const score = Number(snapshot?.score);
    if (!snapshot || !Number.isFinite(score)) {
      const scoreNumEl = document.getElementById('aiScoreNumber');
      const scorePathEl = document.getElementById('aiScoreCirclePath');
      const scoreBadgeEl = document.getElementById('aiScoreBadge');
      const scoreDescEl = document.getElementById('aiScoreDesc');
      if (scoreNumEl) scoreNumEl.textContent = '--';
      if (scorePathEl) {
        scorePathEl.setAttribute('stroke-dasharray', '0, 100');
        scorePathEl.style.stroke = '';
      }
      if (scoreBadgeEl) {
        scoreBadgeEl.textContent = 'Aguardando Análise';
        scoreBadgeEl.className = 'ai-score-badge';
      }
      if (scoreDescEl) scoreDescEl.textContent = 'Clique em "Analisar Finanças" para calcular seu índice de saúde, equilíbrio de gastos e capacidade de poupança.';
      const poupValEl = document.getElementById('aiScorePoupVal');
      const essValEl = document.getElementById('aiScoreEssVal');
      const potValEl = document.getElementById('aiScorePotVal');
      if (poupValEl) poupValEl.textContent = '--%';
      if (essValEl) essValEl.textContent = '--%';
      if (potValEl) potValEl.textContent = formatCurrency(0);
      return;
    }
    const normalizedScore = Math.max(5, Math.min(100, Math.round(score)));
    renderFinancialHealthScore(
      { score: normalizedScore, ...getFinancialHealthPresentation(normalizedScore) },
      snapshot
    );
  }

  function renderAiDiagnostics(analysis, consolidated) {
    // 1. Atualizar Cockpit de Saúde Financeira
    const health = calculateFinancialHealthScore(analysis, consolidated);
    const healthScore = {
      score: health.score,
      taxaPoupanca: Number(analysis.taxaPoupanca) || 0,
      percentualEssencial: Number(analysis.percentualEssencial) || 0,
      economiaPotencialTotal: Number(consolidated?.economiaPotencialTotal) || 0,
      period: aiActivePeriod
    };
    window.__currentAiHealthScore = healthScore;
    setJSONToStorage(getAiHealthScoreStorageKey(), healthScore);
    if (typeof scheduleServerSync === 'function') scheduleServerSync();
    renderFinancialHealthScore(health, healthScore);

    // 2. Barra Visual de Poupança (meta 20% = 100% da barra)
    const poupBarEl = document.getElementById('diagPoupancaBar');
    if (poupBarEl) {
      const poupPercent = Math.max(0, Math.min(100, (analysis.taxaPoupanca / 20) * 100));
      poupBarEl.style.width = `${poupPercent}%`;
      poupBarEl.style.background = analysis.taxaPoupanca >= 20
        ? 'linear-gradient(90deg, #2ec4b6, #22c55e)'
        : (analysis.taxaPoupanca > 0 ? 'linear-gradient(90deg, #00b4d8, #4361ee)' : '#ef4444');
    }

    // 3. Barra Visual Bipartida Essencial vs Discricionário
    const essBarEl = document.getElementById('diagEssBar');
    const discBarEl = document.getElementById('diagDiscBar');
    if (essBarEl && discBarEl) {
      essBarEl.style.width = `${Math.round(analysis.percentualEssencial)}%`;
      discBarEl.style.width = `${Math.round(analysis.percentualNaoEssencial)}%`;
    }

    // 4. Detalhamento Textual dos Diagnósticos
    const elPoup = document.getElementById('diagPoupancaText');
    const elEss = document.getElementById('diagEssenciaisText');
    const elAss = document.getElementById('diagAssinaturasText');
    const elTend = document.getElementById('diagTendenciasText');

    if (elPoup) {
      const tp = analysis.taxaPoupanca;
      let text = `Taxa de ${tp.toFixed(1)}%. `;
      if (tp >= 20) text += 'Excelente hábito de poupança (acima de 20%).';
      else if (tp >= 10) text += 'Bom caminho! Tente alcançar 20% para maior segurança.';
      else if (tp > 0) text += 'Abaixo de 10%. Priorize criar uma reserva de emergência.';
      else text += 'Atenção: Despesas superando receitas no período.';
      elPoup.textContent = text;
    }

    if (elEss) {
      elEss.textContent = `${analysis.percentualEssencial.toFixed(0)}% Essenciais (${formatCurrency(analysis.gastosEssenciaisTotal)}) · ${analysis.percentualNaoEssencial.toFixed(0)}% Discricionários (${formatCurrency(analysis.gastosNaoEssenciaisTotal)})`;
    }

    if (elAss) {
      if (analysis.recorrentes && analysis.recorrentes.length > 0) {
        elAss.textContent = `${analysis.recorrentes.length} serviço(s) recorrente(s) somando ${formatCurrency(analysis.totalRecorrentes)}/mês.`;
      } else {
        elAss.textContent = 'Nenhuma assinatura recorrente crítica detectada.';
      }
    }

    if (elTend) {
      if (analysis.duplicados && analysis.duplicados.length > 0) {
        elTend.textContent = `Atenção: ${analysis.duplicados.length} lançamento(s) com suspeita de duplicidade.`;
      } else if (analysis.categoriasEmAlta && analysis.categoriasEmAlta.length > 0) {
        const top = analysis.categoriasEmAlta[0];
        elTend.textContent = `Alta expressiva em ${top.categoria} (${top.variacao.text} vs período anterior).`;
      } else if (analysis.atipicos && analysis.atipicos.length > 0) {
        elTend.textContent = `${analysis.atipicos.length} despesa(s) acima de 2.5x a média da categoria.`;
      } else {
        elTend.textContent = 'Sem variações anômalas ou aumentos bruscos identificados.';
      }
    }
  }

  function renderAiCategoryChart(analysis) {
    const canvas = document.getElementById('aiCategoryChart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    if (aiCategoryChartInstance) {
      try { aiCategoryChartInstance.destroy(); } catch (_) {}
    }

    const categories = analysis.gastosPorCategoria.slice(0, 6);
    if (!categories.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const labels = categories.map(c => c.categoria);
    const data = categories.map(c => c.total);
    const colors = [
      '#00b4d8', '#4361ee', '#2ec4b6', '#7209b7', '#f59e0b', '#ec4899'
    ];

    aiCategoryChartInstance = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#0c0e14',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { size: 11 },
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const total = data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderAiComparisonChart(analysis, consolidated) {
    const canvas = document.getElementById('aiComparisonChart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    if (aiComparisonChartInstance) {
      try { aiComparisonChartInstance.destroy(); } catch (_) {}
    }

    const receitas = analysis.receitasTotal;
    const despAntes = analysis.despesasTotal;
    const economiaAplicada = consolidated.economiaEstimada;
    const despDepois = Math.max(0, despAntes - economiaAplicada);
    const saldoAntes = analysis.saldo;
    const saldoDepois = receitas - despDepois;

    aiComparisonChartInstance = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Desp. Atual', 'Desp. com Metas', 'Saldo Atual', 'Saldo Projetado'],
        datasets: [{
          data: [receitas, despAntes, despDepois, saldoAntes, saldoDepois],
          backgroundColor: [
            'rgba(0, 180, 216, 0.7)',
            'rgba(239, 68, 68, 0.7)',
            'rgba(46, 196, 182, 0.7)',
            'rgba(148, 163, 184, 0.7)',
            'rgba(46, 196, 182, 0.7)'
          ],
          borderColor: [
            '#00b4d8', '#ef4444', '#2ec4b6', '#94a3b8', '#2ec4b6'
          ],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (v) => formatCurrency(v)
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  function renderAiRecommendations(recommendations) {
    const container = document.getElementById('aiRecommendationsList');
    if (!container) return;
    container.innerHTML = '';

    const recs = Array.isArray(recommendations) ? recommendations : [];

    // Atualizar badge de contagem de recomendações na aba
    const countBadge = document.getElementById('aiRecsCountBadge');
    if (countBadge) {
      const activeCount = recs.filter(r => r.status !== 'recusada').length;
      countBadge.textContent = activeCount;
      countBadge.style.display = activeCount > 0 ? 'inline-flex' : 'none';
    }

    const filtered = recs.filter(r => {
      if (aiActiveFilter === 'all') return true;
      if (aiActiveFilter === 'aceita') return r.status === 'aceita';
      return r.prioridade === aiActiveFilter;
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="ai-empty-prompt">
          <i data-lucide="check-circle-2"></i>
          <p>Nenhuma recomendação com o filtro selecionado (${aiActiveFilter}). Suas finanças estão alinhadas!</p>
        </div>
      `;
      refreshIcons();
      return;
    }

    filtered.forEach(rec => {
      const card = document.createElement('div');
      card.className = `ai-rec-card prio-${rec.prioridade} status-${rec.status}`;
      card.dataset.id = rec.id;

      const isAccepted = rec.status === 'aceita';

      card.innerHTML = `
        <div class="ai-rec-card-top">
          <div class="ai-rec-title-wrap">
            <h4>${escapeHtml(rec.titulo)}</h4>
            <span class="ai-rec-category-badge">${escapeHtml(rec.categoria)}</span>
          </div>
          <div class="ai-rec-badges">
            <span class="ai-rec-prio-badge ${rec.prioridade}">${rec.prioridade}</span>
          </div>
        </div>

        <div class="ai-rec-body">
          <p class="ai-rec-problem"><strong>Problema:</strong> ${escapeHtml(rec.problema)}</p>
          <div class="ai-rec-evidence"><i data-lucide="database"></i> <strong>Evidência:</strong> ${escapeHtml(rec.evidencia)}</div>
          <p class="ai-rec-action-text"><i data-lucide="check"></i> <strong>Ação sugerida:</strong> ${escapeHtml(rec.acaoRecomendada)}</p>
        </div>

        <div class="ai-rec-bottom">
          <div class="ai-rec-numbers">
            <div class="ai-rec-stat">
              <span class="ai-rec-stat-label">Gasto no período</span>
              <span class="ai-rec-stat-val">${formatCurrency(rec.valorGasto)}</span>
            </div>
            <div class="ai-rec-stat">
              <span class="ai-rec-stat-label">Economia potencial</span>
              <span class="ai-rec-stat-val positive">+${formatCurrency(rec.economiaPotencial)}/mês (-${rec.percentualReducao}%)</span>
            </div>
            <div class="ai-rec-stat">
              <span class="ai-rec-stat-label">Meta mensal sugerida</span>
              <span class="ai-rec-stat-val">${formatCurrency(rec.metaMensalSugerida)}</span>
            </div>
          </div>

          <div class="ai-rec-actions-btns">
            <button type="button" class="ai-btn-sm dismiss" data-action="details" data-id="${rec.id}">
              <i data-lucide="info"></i> Detalhes
            </button>
            ${isAccepted ? `
              <span class="ai-btn-sm in-plan"><i data-lucide="check"></i> No Plano</span>
            ` : `
              <button type="button" class="ai-btn-sm accept" data-action="accept" data-id="${rec.id}">
                <i data-lucide="plus-circle"></i> Adicionar ao Plano
              </button>
              <button type="button" class="ai-btn-sm dismiss" data-action="dismiss" data-id="${rec.id}" title="Recusar recomendação">
                <i data-lucide="x"></i>
              </button>
            `}
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    refreshIcons();
  }

  function renderAiSavingsPlan(savingsPlan, consolidated) {
    const container = document.getElementById('aiPlanContainer');
    if (!container) return;
    container.innerHTML = '';

    const plan = Array.isArray(savingsPlan) ? savingsPlan.filter(p => p && p.status !== 'recusada') : [];

    if (!plan.length) {
      container.innerHTML = `
        <div class="ai-empty-prompt">
          <i data-lucide="clipboard-list"></i>
          <p>Nenhuma meta ativa no momento. Clique em <strong>"Adicionar ao Plano"</strong> em qualquer recomendação acima para começar seu acompanhamento.</p>
        </div>
      `;
      refreshIcons();
      return;
    }

    plan.forEach((meta, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'ai-plan-item';
      itemEl.dataset.id = meta.id;

      // Localizar detalhe de comprovação
      const detalhe = (consolidated && consolidated.detalheMetas)
        ? consolidated.detalheMetas.find(d => d.id === meta.id)
        : null;

      const realizadaVal = detalhe ? detalhe.economiaRealizada : 0;
      const progressoPct = detalhe ? detalhe.progressoPct : 0;
      const statusConf = detalhe ? detalhe.statusConfirmacao : 'pendente_confirmacao';
      const statusLabel = statusConf === 'comprovada' ? 'Economia Comprovada ✓' : 'Aguardando Período Posterior';

      itemEl.innerHTML = `
        <div class="ai-plan-item-header">
          <div class="ai-plan-item-title">
            <i data-lucide="target"></i>
            <span>${escapeHtml(meta.titulo || meta.categoria)}</span>
          </div>
          <span class="ai-plan-item-tag ${meta.status || 'ativa'}">${meta.status || 'ativa'}</span>
        </div>

        <div class="ai-plan-progress-wrap">
          <div class="ai-plan-progress-labels">
            <span>Meta Mensal: <strong>${formatCurrency(meta.metaMensal || meta.economiaPotencial)}</strong></span>
            <span>Economia Realizada: <strong class="${realizadaVal > 0 ? 'text-positive' : ''}">${formatCurrency(realizadaVal)}</strong> (${statusLabel})</span>
          </div>
          <div class="ai-plan-progress-bar">
            <div class="ai-plan-progress-fill" style="width: ${progressoPct}%"></div>
          </div>
        </div>

        <div class="ai-plan-item-footer">
          <div>
            <span>Prazo: ${meta.prazoMeses || 1} mês(es) · Categoria: ${escapeHtml(meta.categoria)}</span>
            ${meta.justificativa ? `<br><small class="text-muted">Nota: ${escapeHtml(meta.justificativa)}</small>` : ''}
          </div>
          <div class="ai-plan-item-actions">
            ${meta.status !== 'concluida' ? `
              <button type="button" class="btn btn-sm secondary" data-action="complete-goal" data-id="${meta.id}">
                <i data-lucide="check"></i> Concluir
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm secondary" data-action="remove-goal" data-id="${meta.id}" title="Remover meta">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;

      container.appendChild(itemEl);
    });

    refreshIcons();
  }

  // Interações de Recomendação e Plano
  function acceptRecommendation(recId) {
    const recs = window.__currentAiRecommendations || [];
    const rec = recs.find(r => r.id === recId);
    if (!rec) return;

    rec.status = 'aceita';
    const plan = getAiSavingsPlan();
    const existingIdx = plan.findIndex(p => p.id === rec.id || p.categoria === rec.categoria);

    const goalEntry = {
      id: rec.id,
      recId: rec.id,
      titulo: rec.titulo,
      categoria: rec.categoria,
      metaMensal: rec.economiaPotencial,
      economiaPotencial: rec.economiaPotencial,
      percentualReducao: rec.percentualReducao,
      valorGastoAnterior: rec.valorGasto,
      prazoMeses: rec.prazoMeses || 1,
      dataAdesao: new Date().toISOString(),
      status: 'ativa',
      justificativa: rec.acaoRecomendada
    };

    if (existingIdx >= 0) {
      plan[existingIdx] = goalEntry;
    } else {
      plan.push(goalEntry);
    }

    saveAiSavingsPlan(plan);
    runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });

    addBotMessage(`🎯 Excelente! Você adotou a meta: "${rec.titulo}". Economia estimada de ${formatCurrency(rec.economiaPotencial)}/mês adicionada ao seu plano. Continue acompanhando seus gastos!`);
    showToast(`✓ Meta "${rec.categoria}" adicionada ao plano de economia!`);
  }

  function dismissRecommendation(recId) {
    const recs = window.__currentAiRecommendations || [];
    const rec = recs.find(r => r.id === recId);
    if (!rec) return;
    rec.status = 'recusada';
    renderAiRecommendations(recs);
    showToast('Recomendação recusada.');
  }

  function openRecommendationDetails(recId) {
    const recs = window.__currentAiRecommendations || [];
    const rec = recs.find(r => r.id === recId);
    if (!rec) return;

    const modal = document.getElementById('aiDetailModal');
    const titleEl = document.getElementById('aiDetailModalTitle');
    const bodyEl = document.getElementById('aiDetailModalBody');
    const acceptBtn = document.getElementById('acceptFromModalBtn');

    if (!modal || !bodyEl) return;
    if (titleEl) titleEl.textContent = rec.titulo;

    bodyEl.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); padding: 12px 14px; border-radius: 10px; border-left: 3px solid #00b4d8;">
        <strong>Categoria:</strong> ${escapeHtml(rec.categoria)} &nbsp;·&nbsp; 
        <strong>Prioridade:</strong> <span style="text-transform:capitalize;">${rec.prioridade}</span> &nbsp;·&nbsp;
        <strong>Confiança:</strong> <span style="text-transform:capitalize;">${rec.confianca}</span>
      </div>
      <div>
        <h5 style="color:#FFFFFF; margin-bottom: 4px;">Problema Identificado</h5>
        <p style="color:#94a3b8; font-size:13px; line-height:1.5;">${escapeHtml(rec.problema)}</p>
      </div>
      <div>
        <h5 style="color:#FFFFFF; margin-bottom: 4px;">Evidência nos Dados</h5>
        <p style="color:#94a3b8; font-size:13px; line-height:1.5;">${escapeHtml(rec.evidencia)}</p>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px;">
        <div>
          <span style="font-size:11px; color:#94a3b8;">Gasto Médio no Período</span>
          <div style="font-size:15px; font-weight:700; color:#FFFFFF;">${formatCurrency(rec.valorGasto)}</div>
        </div>
        <div>
          <span style="font-size:11px; color:#94a3b8;">Economia Potencial</span>
          <div style="font-size:15px; font-weight:700; color:#2ec4b6;">+${formatCurrency(rec.economiaPotencial)}/mês (-${rec.percentualReducao}%)</div>
        </div>
      </div>
      <div>
        <h5 style="color:#FFFFFF; margin-bottom: 4px;">Ação Prática Recomendada</h5>
        <p style="color:#38bdf8; font-size:13px; line-height:1.5;">${escapeHtml(rec.acaoRecomendada)}</p>
      </div>
      <div>
        <span style="font-size:12px; color:#94a3b8;">Meta Mensal Teto: <strong>${formatCurrency(rec.metaMensalSugerida)}</strong> · Prazo: <strong>${rec.prazoMeses} mês(es)</strong></span>
      </div>
    `;

    if (acceptBtn) {
      acceptBtn.style.display = rec.status === 'aceita' ? 'none' : '';
      acceptBtn.onclick = () => {
        acceptRecommendation(rec.id);
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      };
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    refreshIcons();
  }

  function completePlanGoal(goalId) {
    const plan = getAiSavingsPlan();
    const goal = plan.find(g => g.id === goalId);
    if (!goal) return;

    goal.status = 'concluida';
    goal.dataConclusao = new Date().toISOString();
    saveAiSavingsPlan(plan);
    runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });

    addBotMessage(`🎉 Parabéns! Você concluiu com sucesso a meta de economia: "${goal.titulo || goal.categoria}"!`);
    showToast('Meta marcada como concluída.');
  }

  function removePlanGoal(goalId) {
    let plan = getAiSavingsPlan();
    plan = plan.filter(g => g.id !== goalId);
    saveAiSavingsPlan(plan);

    // Restaurar recomendação correspondente para pendente
    const recs = window.__currentAiRecommendations || [];
    const rec = recs.find(r => r.id === goalId);
    if (rec) rec.status = 'pendente';

    runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });
    showToast('Meta removida do plano de economia.');
  }

  function openCustomGoalModal() {
    const modal = document.getElementById('aiCustomGoalModal');
    if (!modal) return;
    const form = document.getElementById('aiCustomGoalForm');
    if (form) form.reset();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    refreshIcons();
  }

  function limparRecomendacoesAplicadas() {
    const plan = getAiSavingsPlan();
    if (!confirm(`Deseja realmente reiniciar as recomendações e metas do plano de economia?\nIsso removerá as metas ativas atuais.`)) {
      return;
    }

    saveAiSavingsPlan([]);
    localStorage.removeItem('prisma_recomendacoes_aplicadas');

    runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: true });
    showToast('✓ Análise e metas reiniciadas com sucesso.');
  }

  // ==================== GERAÇÃO DO RELATÓRIO PDF COMPLETO ====================
  const aiPdfBtn = document.getElementById('aiPdfBtn');
  if (aiPdfBtn) {
    aiPdfBtn.addEventListener('click', generateAIPDF);
  }

  const aiResetBtn = document.getElementById('aiResetBtn');
  if (aiResetBtn) {
    aiResetBtn.addEventListener('click', limparRecomendacoesAplicadas);
  }

  async function generateAIPDF() {
    addBotMessage('📄 Preparando e gerando relatório completo em PDF... Isso levará alguns instantes.');
    showToast('Gerando relatório PDF da análise...');

    try {
      const JsPDF = await ensurePdfLibrary();
      const logoData = await loadPrismaLogoForPDF();

      // Garantir que a análise mais recente esteja executada
      if (!window.__currentAiAnalysis) {
        await runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });
      }

      const analysis = window.__currentAiAnalysis;
      if (!analysis) {
        throw new Error('Não há dados de análise disponíveis.');
      }

      const recommendations = window.__currentAiRecommendations || [];
      const savingsPlan = getAiSavingsPlan();
      const consolidated = window.PrismaFinance.calculateConsolidatedSavings(
        recommendations,
        savingsPlan,
        analysis.transacoesDespesas || [],
        analysis.despesasAnteriorTotal || 0
      );

      const pdf = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const periodName = periodLabel(aiActivePeriod);

      // Helper local para títulos de seção refinados
      function drawAiSectionHeader(title, sectionY) {
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, sectionY, contentWidth, 22, 'F');
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, sectionY, 4, 22, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(title, margin + 12, sectionY + 15);
        return sectionY + 28;
      }

      // ==================== PÁGINA 1: VISÃO GERAL EXECUTIVA ====================
      let y = drawPrismaHeader(pdf, {
        margin,
        logoData,
        title: 'Prisma AI — Relatório Financeiro',
        subtitle: 'Diagnóstico Inteligente e Plano de Economia Pessoal',
        showProfile: true
      });
      y += 6;

      // Badge de Período e Metadados
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(margin, y, contentWidth, 22, 4, 4, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(29, 78, 216);
      pdf.text(`PERÍODO ANALISADO: ${periodName.toUpperCase()}`, margin + 10, y + 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('MOEDA: BRL (R$)  ·  ANÁLISE DETERMINÍSTICA', pageWidth - margin - 10, y + 14, { align: 'right' });
      y += 30;

      // Seção 1: Indicadores Chave de Desempenho (KPIs em 2 Linhas Bem Distribuídas)
      y = drawAiSectionHeader('1. Indicadores Financeiros do Período', y);

      // Linha 1 de KPIs (3 caixas principais: Receitas, Despesas, Saldo)
      const kpiGap = 8;
      const kpiRow1W = (contentWidth - kpiGap * 2) / 3;
      const kpiRow1H = 48;

      const mainKpis = [
        { label: 'Receitas Identificadas', val: formatCurrency(analysis.receitasTotal), color: [2, 132, 199], sub: 'Total recebido' },
        { label: 'Despesas Consolidadas', val: formatCurrency(analysis.despesasTotal), color: [220, 38, 38], sub: 'Gastos totais' },
        {
          label: 'Saldo Disponível',
          val: formatCurrency(analysis.saldo),
          color: analysis.saldo >= 0 ? [5, 150, 105] : [220, 38, 38],
          sub: analysis.saldo >= 0 ? 'Superávit líquido' : 'Déficit no período'
        }
      ];

      mainKpis.forEach((kpi, idx) => {
        const kX = margin + idx * (kpiRow1W + kpiGap);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(kX, y, kpiRow1W, kpiRow1H, 5, 5, 'FD');

        // Tarja de acento
        pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        pdf.rect(kX, y, 3, kpiRow1H, 'F');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(kpi.label, kX + 10, y + 14);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(pdfTruncate(pdf, kpi.val, kpiRow1W - 16), kX + 10, y + 30);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(kpi.sub, kX + 10, y + 42);
      });
      y += kpiRow1H + 6;

      // Linha 2 de KPIs (2 caixas executivas: Economia Potencial e Economia Realizada/Metas)
      const kpiRow2W = (contentWidth - kpiGap) / 2;
      const kpiRow2H = 46;

      const subKpis = [
        {
          label: 'Economia Potencial Estimada (IA)',
          val: `+${formatCurrency(consolidated.economiaPotencialTotal)} / mês`,
          color: [124, 58, 237],
          desc: 'Sem sobreposição entre recomendações'
        },
        {
          label: 'Economia em Metas / Realizada',
          val: consolidated.economiaRealizada > 0
            ? `${formatCurrency(consolidated.economiaRealizada)} (Comprovada)`
            : `${formatCurrency(consolidated.economiaEstimada)} (${consolidated.planoAtivoCount || 0} meta(s) ativas)`,
          color: [22, 163, 74],
          desc: consolidated.economiaRealizada > 0 ? 'Redução real apurada vs período anterior' : 'Aguardando apuração de fechamento'
        }
      ];

      subKpis.forEach((kpi, idx) => {
        const kX = margin + idx * (kpiRow2W + kpiGap);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(kX, y, kpiRow2W, kpiRow2H, 5, 5, 'FD');

        pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        pdf.rect(kX, y, 3, kpiRow2H, 'F');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(kpi.label, kX + 10, y + 14);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        pdf.text(pdfTruncate(pdf, kpi.val, kpiRow2W - 16), kX + 10, y + 29);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(kpi.desc, kX + 10, y + 40);
      });
      y += kpiRow2H + 16;

      // Seção 2: Estrutura de Gastos por Categoria
      y = drawAiSectionHeader('2. Estrutura de Gastos e Representatividade', y);

      // Cabeçalho da Tabela
      pdf.setFillColor(15, 23, 42);
      pdf.rect(margin, y, contentWidth, 18, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Categoria', margin + 8, y + 12);
      pdf.text('Total Gasto', margin + 175, y + 12, { align: 'right' });
      pdf.text('% Total', margin + 235, y + 12, { align: 'right' });
      pdf.text('Proporção Visual', margin + 250, y + 12);
      pdf.text('Classificação', margin + 355, y + 12);
      pdf.text('Tendência', pageWidth - margin - 8, y + 12, { align: 'right' });
      y += 18;

      const topCats = (analysis.gastosPorCategoria || []).slice(0, 7);
      if (!topCats.length) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Nenhuma despesa registrada para o período selecionado.', margin + 8, y + 14);
        y += 24;
      } else {
        topCats.forEach((cat, idx) => {
          const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
          pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
          pdf.rect(margin, y, contentWidth, 18, 'F');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(15, 23, 42);
          pdf.text(pdfTruncate(pdf, cat.categoria, 130), margin + 8, y + 12);

          // Valor
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatCurrency(cat.total), margin + 175, y + 12, { align: 'right' });

          // Percentual
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(71, 85, 105);
          pdf.text(`${cat.percentual.toFixed(1)}%`, margin + 235, y + 12, { align: 'right' });

          // Mini Barra de Progresso Proporcional (visual executivo)
          const barMaxW = 80;
          const barFillW = Math.max(2, Math.min(barMaxW, (cat.percentual / 100) * barMaxW * 1.5));
          pdf.setFillColor(226, 232, 240);
          pdf.roundedRect(margin + 250, y + 5, barMaxW, 7, 2, 2, 'F');
          const barColor = cat.isEssential ? [2, 132, 199] : [217, 119, 6];
          pdf.setFillColor(barColor[0], barColor[1], barColor[2]);
          pdf.roundedRect(margin + 250, y + 5, barFillW, 7, 2, 2, 'F');

          // Classificação
          if (cat.isEssential) {
            pdf.setTextColor(2, 132, 199);
            pdf.text('Essencial', margin + 355, y + 12);
          } else {
            pdf.setTextColor(180, 83, 9);
            pdf.text('Discricionário', margin + 355, y + 12);
          }

          // Tendência
          const varText = cat.variacao ? cat.variacao.text : 'Estável';
          const isAlta = cat.variacao && cat.variacao.pct > 5;
          const isBaixa = cat.variacao && cat.variacao.pct < -5;
          if (isAlta) {
            pdf.setTextColor(220, 38, 38);
            pdf.text(`▲ ${varText}`, pageWidth - margin - 8, y + 12, { align: 'right' });
          } else if (isBaixa) {
            pdf.setTextColor(22, 163, 74);
            pdf.text(`▼ ${varText}`, pageWidth - margin - 8, y + 12, { align: 'right' });
          } else {
            pdf.setTextColor(148, 163, 184);
            pdf.text('— Estável', pageWidth - margin - 8, y + 12, { align: 'right' });
          }

          // Divisória sutil
          pdf.setDrawColor(241, 245, 249);
          pdf.setLineWidth(0.5);
          pdf.line(margin, y + 18, pageWidth - margin, y + 18);
          y += 18;
        });
      }
      y += 14;

      // Seção 3: Diagnóstico e Saúde Financeira
      y = drawAiSectionHeader('3. Diagnóstico Estratégico da IA', y);

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, contentWidth, 80, 6, 6, 'FD');

      // Bloco 1: Equilíbrio Orçamentário (Essencial vs Discricionário)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('• Composição de Gastos:', margin + 12, y + 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text(
        `${analysis.percentualEssencial.toFixed(1)}% Essenciais (${formatCurrency(analysis.gastosEssenciaisTotal)})  ·  ${analysis.percentualNaoEssencial.toFixed(1)}% Discricionários (${formatCurrency(analysis.gastosNaoEssenciaisTotal)})`,
        margin + 120,
        y + 18
      );

      // Bloco 2: Assinaturas Recorrentes
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('• Custos Recorrentes:', margin + 12, y + 36);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const subsInfo = (analysis.recorrentes && analysis.recorrentes.length > 0)
        ? `${analysis.recorrentes.length} serviço(s) recorrente(s) mapeado(s), somando ${formatCurrency(analysis.totalRecorrentes)}/mês (${analysis.recorrentes.slice(0, 3).map(s => s.nome).join(', ')}).`
        : 'Nenhuma assinatura excessiva ou despesa recorrente crítica detectada no período.';
      pdf.text(pdfTruncate(pdf, subsInfo, contentWidth - 140), margin + 120, y + 36);

      // Bloco 3: Taxa de Poupança e Hábitos
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('• Taxa de Poupança:', margin + 12, y + 54);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const tp = analysis.taxaPoupanca || 0;
      let tpVerdict = `${tp.toFixed(1)}% das receitas poupadas. `;
      if (tp >= 20) tpVerdict += 'Nível excelente (acima da meta recomendada de 20%).';
      else if (tp >= 10) tpVerdict += 'Nível adequado. Oportunidade de elevar para 20% com as recomendações.';
      else if (tp > 0) tpVerdict += 'Nível baixo. Recomendado priorizar formação de reserva de emergência.';
      else tpVerdict += 'Alerta: Despesas superaram as receitas no período analisado.';
      pdf.text(pdfTruncate(pdf, tpVerdict, contentWidth - 140), margin + 120, y + 54);

      // Bloco 4: Anomalias / Transações Atípicas
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('• Análise de Anomalias:', margin + 12, y + 71);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      let anomText = 'Nenhuma duplicidade ou transação fora do padrão detectada.';
      if (analysis.duplicados && analysis.duplicados.length > 0) {
        anomText = `Atenção: ${analysis.duplicados.length} lançamento(s) com suspeita de duplicidade encontrados.`;
      } else if (analysis.atipicos && analysis.atipicos.length > 0) {
        anomText = `${analysis.atipicos.length} despesa(s) identificadas muito acima da média habitual da categoria.`;
      }
      pdf.text(pdfTruncate(pdf, anomText, contentWidth - 140), margin + 120, y + 71);

      // ==================== PÁGINA 2: OPORTUNIDADES E METAS ====================
      pdf.addPage();
      y = drawPrismaHeader(pdf, {
        margin,
        logoData,
        title: 'Prisma AI — Recomendações e Metas',
        subtitle: 'Oportunidades de Economia Calculadas e Governança',
        showProfile: false
      });
      y += 8;

      // Seção 4: Recomendações Personalizadas de Economia
      y = drawAiSectionHeader('4. Recomendações Personalizadas de Redução de Gastos', y);

      const printableRecs = recommendations.slice(0, 4);
      if (!printableRecs.length) {
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, y, contentWidth, 42, 6, 6, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(22, 163, 74);
        pdf.text('✓ Finanças Otimizadas!', margin + 14, y + 18);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Seus gastos estão equilibrados no período analisado. Nenhuma oportunidade imediata de corte agressivo foi identificada.', margin + 14, y + 32);
        y += 52;
      } else {
        printableRecs.forEach((r, idx) => {
          // Medir textos para altura dinâmica e sem cortes com "…"
          const maxTextW = contentWidth - 28;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          const probLines = pdf.splitTextToSize(`Diagnóstico: ${r.problema || ''}`, maxTextW);
          const acaoLines = pdf.splitTextToSize(`Ação Sugerida: ${r.acaoRecomendada || ''}`, maxTextW);

          const probH = (Array.isArray(probLines) ? probLines.length : 1) * 11;
          const acaoH = (Array.isArray(acaoLines) ? acaoLines.length : 1) * 11;
          const cardH = 34 + probH + acaoH + 18;

          // Se passar da margem da página, cria nova página de continuação
          if (y + cardH > pageHeight - 50) {
            pdf.addPage();
            y = drawPrismaHeader(pdf, {
              margin,
              logoData,
              title: 'Prisma AI — Recomendações (Continuação)',
              subtitle: 'Detalhamento de Oportunidades',
              showProfile: false
            }) + 10;
          }

          // Card container
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.roundedRect(margin, y, contentWidth, cardH, 6, 6, 'FD');

          // Tarja colorida por prioridade
          const prioColors = {
            alta: [220, 38, 38],
            media: [217, 119, 6],
            baixa: [2, 132, 199]
          };
          const pColor = prioColors[r.prioridade] || [2, 132, 199];
          pdf.setFillColor(pColor[0], pColor[1], pColor[2]);
          pdf.rect(margin, y, 4, cardH, 'F');

          // Título e Prioridade Badge
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text(`${idx + 1}. ${r.titulo}`, margin + 12, y + 16);

          // Valor em destaque verde
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(22, 163, 74);
          pdf.text(`+${formatCurrency(r.economiaPotencial)} / mês (-${r.percentualReducao}%)`, pageWidth - margin - 12, y + 16, { align: 'right' });

          // Texto do Diagnóstico
          let curY = y + 28;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          pdf.text(probLines, margin + 12, curY);
          curY += probH + 3;

          // Texto da Ação Prática
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(2, 132, 199);
          pdf.text(acaoLines, margin + 12, curY);
          curY += acaoH + 5;

          // Rodapé do card: Meta teto e prazo
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(148, 163, 184);
          const metaText = `Meta Mensal Sugerida: ${formatCurrency(r.metaMensalSugerida || 0)}  ·  Prazo estimado: ${r.prazoMeses || 1} mês(es)  ·  Grau de Confiança: ${(r.confianca || 'alta').toUpperCase()}`;
          pdf.text(metaText, margin + 12, curY);

          y += cardH + 7;
        });
      }
      y += 8;

      // Seção 5: Plano de Economia e Metas Adotadas
      if (y + 80 > pageHeight - 50) {
        pdf.addPage();
        y = drawPrismaHeader(pdf, {
          margin,
          logoData,
          title: 'Prisma AI — Plano e Metas',
          subtitle: 'Acompanhamento de Resultados',
          showProfile: false
        }) + 10;
      }

      y = drawAiSectionHeader('5. Metas do Plano de Economia em Andamento', y);

      const activeGoals = savingsPlan.filter(p => p && p.status !== 'recusada');
      if (!activeGoals.length) {
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, y, contentWidth, 32, 5, 5, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Nenhuma meta foi adicionada ao plano ainda. Acesse a aba "Recomendações" no Prisma AI para adotar metas.', margin + 12, y + 19);
        y += 40;
      } else {
        pdf.setFillColor(15, 23, 42);
        pdf.rect(margin, y, contentWidth, 16, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Meta Adotada / Descrição', margin + 8, y + 11);
        pdf.text('Categoria', margin + 220, y + 11);
        pdf.text('Meta Mensal', margin + 330, y + 11);
        pdf.text('Status de Apuração', pageWidth - margin - 8, y + 11, { align: 'right' });
        y += 16;

        activeGoals.slice(0, 4).forEach((g, gIdx) => {
          const rowBg = gIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
          pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
          pdf.rect(margin, y, contentWidth, 16, 'F');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text(pdfTruncate(pdf, g.titulo || g.categoria, 200), margin + 8, y + 11);
          pdf.setTextColor(100, 116, 139);
          pdf.text(pdfTruncate(pdf, g.categoria, 100), margin + 220, y + 11);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text(formatCurrency(g.metaMensal || g.economiaPotencial), margin + 330, y + 11);

          const isReal = consolidated.economiaRealizada > 0;
          if (isReal) {
            pdf.setTextColor(22, 163, 74);
            pdf.text('✓ Comprovada', pageWidth - margin - 8, y + 11, { align: 'right' });
          } else {
            pdf.setTextColor(217, 119, 6);
            pdf.text('⏳ Em Acompanhamento', pageWidth - margin - 8, y + 11, { align: 'right' });
          }

          pdf.setDrawColor(241, 245, 249);
          pdf.line(margin, y + 16, pageWidth - margin, y + 16);
          y += 16;
        });
        y += 10;
      }

      // Seção 6: Metodologia e Transparência
      if (y + 85 > pageHeight - 50) {
        pdf.addPage();
        y = drawPrismaHeader(pdf, {
          margin,
          logoData,
          title: 'Prisma AI — Metodologia e Governança',
          subtitle: 'Critérios Analíticos',
          showProfile: false
        }) + 10;
      }

      y = drawAiSectionHeader('6. Critérios Analíticos e Governança', y);

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, contentWidth, 68, 5, 5, 'FD');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);

      const methodologyRules = [
        '1. Deduplicação e Não-Sobreposição: Múltiplas oportunidades na mesma categoria não somam valores fictícios.',
        '2. Blindagem de Necessidades Básicas: Despesas de moradia, saúde e alimentação básica são estritamente preservadas.',
        '3. Economia Realizada Estrita: Poupança realizada só é contabilizada após apuração real em período fechado.',
        '4. Privacidade e Determinismo: Os cálculos operam em modo local/determinado sem inferência invasiva de terceiros.'
      ];

      methodologyRules.forEach((rule, rIdx) => {
        pdf.text(rule, margin + 10, y + 13 + (rIdx * 14));
      });
      y += 76;

      // Rodapé padronizado em todas as páginas criadas
      drawPrismaFooterAllPages(pdf, {
        margin,
        disclaimer: 'Prisma AI — Relatório gerado com base estrita nos dados cadastrados. Análise independente e confidencial.'
      });

      // Salvar e fazer download
      const todayIso = new Date().toISOString().split('T')[0];
      const fileName = `prisma-ai-relatorio-${todayIso}.pdf`;
      pdf.save(fileName);

      addBotMessage('✅ Relatório PDF do Prisma AI gerado e baixado com sucesso!');
      showToast('✓ Relatório PDF baixado com sucesso!');
      try {
        if (window.PrismaNotify) {
          window.PrismaNotify('PDF Gerado', 'Relatório completo do Prisma AI pronto para visualização.', 'pdf');
        }
      } catch (_) {}

    } catch (err) {
      console.error('[PrismaAI] Erro ao gerar PDF:', err);
      addBotMessage('❌ Não foi possível gerar o PDF. Verifique se há bloqueador de pop-ups ativo e tente novamente.');
      showToast('Erro ao gerar relatório PDF.');
    }
  }

  // Resposta inteligente do consultor baseada em dados reais analisados
  function showAiTyping() {
    const ind = document.getElementById('aiTypingIndicator');
    if (ind) ind.style.display = 'flex';
    const chat = document.getElementById('aiChat');
    if (chat) chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
  }

  function hideAiTyping() {
    const ind = document.getElementById('aiTypingIndicator');
    if (ind) ind.style.display = 'none';
  }

  function renderProgressiveAnalysisChat(analysis, recommendations, consolidated) {
    const chat = document.getElementById('aiChat');
    if (!chat) return;

    const recs = Array.isArray(recommendations) ? recommendations.slice(0, 3) : [];
    const planoHtml = recs.length > 0
      ? recs.map((r, i) => `<li><strong>${i + 1}. ${escapeHtml(r.titulo)}:</strong> ${escapeHtml(r.acaoRecomendada)} (potencial: ${fmtMoney(r.economiaPotencial)}/mês)</li>`).join('')
      : '<li>Mantenha seus registros atualizados e continue acompanhando seus gastos regularmente.</li>';

    const card = document.createElement('div');
    card.className = 'ai-msg bot';
    card.innerHTML = `
      <span class="ai-avatar"><i data-lucide="sparkles"></i></span>
      <div class="bubble ai-progressive-bubble">
        <div class="ai-progressive-card">
          <div class="ai-step-item">
            <div class="ai-step-header">
              <span class="ai-step-badge">Etapa 1</span>
              <h4>Diagnóstico Financeiro</h4>
            </div>
            <p class="ai-step-text">
              No período de ${periodLabel(aiActivePeriod)}, você registrou <strong>${fmtMoney(analysis.receitasTotal)}</strong> em receitas e <strong>${fmtMoney(analysis.despesasTotal)}</strong> em despesas.
              Seu saldo é <strong>${fmtMoney(analysis.saldo)}</strong>, com taxa de poupança de <strong>${analysis.taxaPoupanca.toFixed(1)}%</strong> (${analysis.percentualEssencial.toFixed(0)}% gastos essenciais).
            </p>
          </div>

          <div class="ai-step-item">
            <div class="ai-step-header">
              <span class="ai-step-badge">Etapa 2</span>
              <h4>Oportunidades de Otimização</h4>
            </div>
            <p class="ai-step-text">
              ${recs.length > 0
                ? `Identificamos ${recs.length} áreas com potencial de ajuste de custos em despesas não essenciais ou serviços recorrentes.`
                : 'Seus gastos estão equilibrados sem excessos aparentes nas categorias analisadas.'}
            </p>
          </div>

          <div class="ai-step-item">
            <div class="ai-step-header">
              <span class="ai-step-badge">Etapa 3</span>
              <h4>Plano de Ação Recomendado</h4>
            </div>
            <ul class="ai-action-list">${planoHtml}</ul>
          </div>

          <div class="ai-step-item">
            <div class="ai-step-header">
              <span class="ai-step-badge">Etapa 4</span>
              <h4>Resultado Estimado</h4>
            </div>
            <div class="ai-step-result">
              <strong>${fmtMoney(consolidated.economiaPotencialTotal)} / mês</strong>
              <p class="ai-result-subtext">Economia anual projetada de até ${fmtMoney(consolidated.economiaPotencialTotal * 12)} com a execução do plano.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    chat.appendChild(card);
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
    refreshIcons();
  }

  function handleConsultorQuestion(question) {
    const chat = document.getElementById('aiChat');
    if (!chat || !question) return;

    // Adiciona mensagem do usuário
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg user';
    userMsg.innerHTML = `<div class="bubble">${escapeHtml(question)}</div>`;
    chat.appendChild(userMsg);
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });

    showAiTyping();

    const analysis = window.__currentAiAnalysis;
    const recs = window.__currentAiRecommendations || [];
    const qLower = question.toLowerCase();

    setTimeout(async () => {
      hideAiTyping();

      if (qLower.includes('analisar') || qLower.includes('gasto') || qLower.includes('análise')) {
        const res = await runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });
        if (res) {
          renderProgressiveAnalysisChat(res.analysis, res.recommendations, res.consolidated);
        } else {
          addBotMessage('Cadastre suas receitas e despesas para que eu possa gerar a análise financeira completa.');
        }
      } else if (qLower.includes('economizar') || qLower.includes('cortar') || qLower.includes('onde')) {
        if (recs.length > 0) {
          const top3 = recs.slice(0, 3);
          const reply = `💡 **Oportunidades de Economia Calculadas:**\n\n` +
            top3.map((r, i) => `${i + 1}. **${r.titulo}** (${r.categoria}): Economia de **${fmtMoney(r.economiaPotencial)}/mês** (-${r.percentualReducao}%).\n   👉 *Ação:* ${r.acaoRecomendada}`).join('\n\n') +
            `\n\nAbra o painel **Métricas & Gráficos** acima para ativar essas metas no seu plano!`;
          addBotMessage(reply);
        } else {
          addBotMessage('🎉 Seus gastos estão equilibrados no período selecionado! Não há despesas com indício de excesso no momento.');
        }
      } else if (qLower.includes('investimento') || qLower.includes('carteira') || qLower.includes('patrimônio')) {
        const list = Array.isArray(investimentos) ? investimentos : [];
        if (!list.length) {
          addBotMessage('Você ainda não cadastrou ativos na Carteira de Ativos. Acesse a seção Investimentos e registre suas posições para receber recomendações de alocação.');
        } else {
          const totalAplicado = list.reduce((sum, inv) => sum + getInvestValorAplicado(inv), 0);
          const totalAtual = list.reduce((sum, inv) => sum + getInvestValorAtual(inv), 0);
          const lucro = totalAtual - totalAplicado;
          const rent = totalAplicado > 0 ? (lucro / totalAplicado) * 100 : 0;
          const msg = `📈 **Diagnóstico da Carteira de Ativos:**\n\n` +
            `• Patrimônio investido: **${fmtMoney(totalAtual)}** (aplicado: ${fmtMoney(totalAplicado)})\n` +
            `• Resultado acumulado: **${lucro >= 0 ? '+' : ''}${fmtMoney(lucro)}** (${rent.toFixed(2)}%)\n` +
            `• Posições ativas: **${list.length} ativos** cadastrados.\n\n` +
            `💡 *Dica Prisma AI:* Mantenha sua carteira diversificada entre Renda Fixa e Renda Variável de acordo com seus objetivos.`;
          addBotMessage(msg);
        }
      } else if (qLower.includes('planejar') || qLower.includes('plano') || qLower.includes('meta')) {
        const metas = Array.isArray(goals) ? goals : [];
        const msg = `🎯 **Planejamento Financeiro:**\n\n` +
          `• Metas cadastradas: **${metas.length} objetivos**\n` +
          (analysis ? `• Taxa de poupança: **${analysis.taxaPoupanca.toFixed(1)}%**\n` : '') +
          `• Recomendação: priorize sua Reserva de Emergência (equivalente a 6 meses de custos fixos) antes de assumir riscos maiores.\n\n` +
          `Defina novas metas no menu **Metas** para acompanharmos juntos o seu progresso.`;
        addBotMessage(msg);
      } else if (qLower.includes('relatório') || qLower.includes('pdf')) {
        addBotMessage('📄 Gerando seu relatório executivo em PDF com base nos dados do período...');
        generateAIPDF();
      } else {
        addBotMessage(`Estou à disposição! Você pode usar as ações rápidas acima para analisar gastos, identificar economias, avaliar investimentos, planejar finanças ou gerar relatórios.`);
      }
    }, 450);
  }

  // ==================== INICIALIZAÇÃO E EVENTOS DO PRISMA AI ====================
  function initPrismaAiEvents() {
    const aiSection = document.getElementById('prisma-ai');
    if (!aiSection || aiSection.dataset.eventsInitialized) return;
    aiSection.dataset.eventsInitialized = '1';

    // Toggle Cockpit Drawer (Métricas & Gráficos sob demanda)
    const toggleCockpitBtn = document.getElementById('aiToggleCockpitBtn');
    const cockpitDrawer = document.getElementById('aiCockpitDrawer');
    if (toggleCockpitBtn && cockpitDrawer) {
      toggleCockpitBtn.addEventListener('click', () => {
        const isOpen = cockpitDrawer.classList.toggle('open');
        toggleCockpitBtn.classList.toggle('active', isOpen);
        toggleCockpitBtn.innerHTML = isOpen
          ? '<i data-lucide="chevron-up"></i> Ocultar Métricas'
          : '<i data-lucide="sliders-horizontal"></i> Métricas & Gráficos';
        refreshIcons();
        if (isOpen) {
          requestAnimationFrame(() => {
            window.aiCategoryChartInstance?.resize?.();
            window.aiComparisonChartInstance?.resize?.();
          });
        }
      });
    }

    // Reset Chat Button
    const resetChatBtn = document.getElementById('aiResetChatBtn');
    if (resetChatBtn) {
      resetChatBtn.addEventListener('click', () => {
        const chat = document.getElementById('aiChat');
        if (chat) {
          chat.innerHTML = `
            <div class="ai-msg bot">
              <span class="ai-avatar"><i data-lucide="sparkles"></i></span>
              <div class="bubble">
                <strong>Olá! Eu sou o Prisma AI.</strong>
                <p>Seu assistente financeiro pessoal. Como posso ajudar na gestão do seu patrimônio hoje?</p>
              </div>
            </div>
          `;
          refreshIcons();
        }
      });
    }

    // Export PDF Button
    const exportPdfBtn = document.getElementById('aiExportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        generateAIPDF();
      });
    }

    // 5 Ações Inteligentes Prominentes
    aiSection.querySelectorAll('.ai-smart-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.aiAction;
        if (action === 'gastos') {
          handleConsultorQuestion('Analisar meus gastos');
        } else if (action === 'economizar') {
          handleConsultorQuestion('Como posso economizar?');
        } else if (action === 'investimentos') {
          handleConsultorQuestion('Avaliar meus investimentos');
        } else if (action === 'planejar') {
          handleConsultorQuestion('Planejar minhas finanças');
        } else if (action === 'relatorio') {
          handleConsultorQuestion('Gerar relatório financeiro');
        }
      });
    });

    // 0. Seletor de Visão em Abas (reduz poluição visual)
    const tabPanes = {
      recs: document.getElementById('aiTabPane_recs'),
      analytics: document.getElementById('aiTabPane_analytics'),
      chat: document.getElementById('aiTabPane_chat')
    };
    aiSection.querySelectorAll('.ai-view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        // atualizar estado dos botões
        aiSection.querySelectorAll('.ai-view-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        // mostrar / esconder painéis
        Object.entries(tabPanes).forEach(([key, pane]) => {
          if (!pane) return;
          pane.style.display = key === target ? '' : 'none';
        });
        // forçar Chart.js a redesenhar se o painel de gráficos ficou visível
        if (target === 'analytics') {
          requestAnimationFrame(() => {
            window.aiCategoryChartInstance?.resize?.();
            window.aiComparisonChartInstance?.resize?.();
            try { if (aiCategoryChartInstance) aiCategoryChartInstance.resize(); } catch (_) {}
            try { if (aiComparisonChartInstance) aiComparisonChartInstance.resize(); } catch (_) {}
          });
        }
      });
    });

    // 0.1 Chips de Perguntas Rápidas do Consultor
    aiSection.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.question;
        handleConsultorQuestion(q);
      });
    });

    // 0.2 Input de Texto Livre do Consultor
    const aiInput = document.getElementById('aiInput');
    const aiSend = document.getElementById('aiSend');
    function sendAiTextMessage() {
      if (!aiInput) return;
      const text = aiInput.value.trim();
      if (!text) return;
      aiInput.value = '';
      handleConsultorQuestion(text);
    }
    aiSend?.addEventListener('click', sendAiTextMessage);
    aiInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendAiTextMessage();
    });

    // 1. Botões de Período
    aiSection.querySelectorAll('.ai-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        aiSection.querySelectorAll('.ai-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period || '30d';
        runPrismaAiAnalysis(period, { showBotMessage: true });
      });
    });

    // 2. Filtros de Prioridade
    aiSection.querySelectorAll('.ai-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        aiSection.querySelectorAll('.ai-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        aiActiveFilter = pill.dataset.filter || 'all';
        renderAiRecommendations(window.__currentAiRecommendations || []);
      });
    });

    // 3. Ações nas Recomendações (delegação de evento)
    const recList = document.getElementById('aiRecommendationsList');
    if (recList) {
      recList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'accept') acceptRecommendation(id);
        else if (action === 'dismiss') dismissRecommendation(id);
        else if (action === 'details') openRecommendationDetails(id);
      });
    }

    // 4. Ações no Plano de Economia
    const planContainer = document.getElementById('aiPlanContainer');
    if (planContainer) {
      planContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'complete-goal') completePlanGoal(id);
        else if (action === 'remove-goal') removePlanGoal(id);
      });
    }

    // 5. Botão Nova Meta Manual
    const newGoalBtn = document.getElementById('aiNewGoalModalBtn');
    if (newGoalBtn) newGoalBtn.addEventListener('click', openCustomGoalModal);

    // 6. Formulário de Meta Manual
    const customGoalForm = document.getElementById('aiCustomGoalForm');
    if (customGoalForm) {
      customGoalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('aiGoalTitle')?.value.trim();
        const category = document.getElementById('aiGoalCategory')?.value.trim();
        const amount = parseFloat(document.getElementById('aiGoalAmount')?.value) || 0;
        const deadline = parseInt(document.getElementById('aiGoalDeadline')?.value, 10) || 1;
        const notes = document.getElementById('aiGoalNotes')?.value.trim() || '';

        if (!title || !category || amount <= 0) {
          showToast('Preencha os campos obrigatórios da meta.');
          return;
        }

        const plan = getAiSavingsPlan();
        plan.push({
          id: 'custom_goal_' + Date.now(),
          titulo: title,
          categoria: category,
          metaMensal: amount,
          economiaPotencial: amount,
          prazoMeses: deadline,
          dataAdesao: new Date().toISOString(),
          status: 'ativa',
          justificativa: notes
        });

        saveAiSavingsPlan(plan);
        const modal = document.getElementById('aiCustomGoalModal');
        if (modal) {
          modal.style.display = 'none';
          modal.setAttribute('aria-hidden', 'true');
        }

        runPrismaAiAnalysis(aiActivePeriod, { showBotMessage: false });
        addBotMessage(`🎯 Nova meta personalizada criada: "${title}" com objetivo de economizar ${formatCurrency(amount)}/mês!`);
        showToast('✓ Meta personalizada adicionada ao plano!');
      });
    }

    // 7. Fechamento de Modais
    ['closeAiDetailModal', 'closeAiDetailBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        const modal = document.getElementById('aiDetailModal');
        if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
      });
    });

    ['closeAiCustomGoalModal', 'cancelAiCustomGoalBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        const modal = document.getElementById('aiCustomGoalModal');
        if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
      });
    });
  }

  // Executar inicialização quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrismaAiEvents);
  } else {
    initPrismaAiEvents();
  }

  // Exportar para escopo global para integração com prisma-patch e outros módulos
  window.prismaAnalyzeFinances = analyzeFinances;
  window.analyzeFinances = analyzeFinances;
  window.generateAIPDF = generateAIPDF;
  window.runPrismaAiAnalysis = runPrismaAiAnalysis;
  window.PrismaAI = {
    runAnalysis: runPrismaAiAnalysis,
    generatePDF: generateAIPDF,
    getSavingsPlan: getAiSavingsPlan,
    saveSavingsPlan: saveAiSavingsPlan
  };

  // Export chart functions to global scope so they can be called externally
  window.initCashflowChart = initCashflowChart;
  window.initPieChart = initPieChart;
  window.updatePieChart = updatePieChart;
  window.initIncomePieChart = initIncomePieChart;
  window.updateIncomePieChart = updateIncomePieChart;
  window.initReportChart = initReportChart;
  window.initializeCharts = initializeCharts;
  window.getLast12Months = getLast12Months;

  window.renderCashflowChart = function() {
    if (cashflowChart) {
      cashflowChart.resize();
      cashflowChart.update();
    } else if (typeof initCashflowChart === 'function') {
      initCashflowChart();
    }
  };
  window.renderPieChart = function() {
    if (pieChart) {
      pieChart.resize();
      pieChart.update();
    } else if (typeof initPieChart === 'function') {
      initPieChart();
    }
  };
  window.renderIncomePieChart = function() {
    if (incomePieChart) {
      incomePieChart.resize();
      incomePieChart.update();
    } else if (typeof initIncomePieChart === 'function') {
      initIncomePieChart();
    }
  };

  const dashInsightEl = document.getElementById('dashInsight');
  if (dashInsightEl) {
    const openCf = () => {
      if (typeof window.navigateToSection === 'function') {
        window.navigateToSection('centro-financeiro');
      }
    };
    dashInsightEl.addEventListener('click', openCf);
    dashInsightEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCf();
      }
    });
  }
  
  // Initialize months if not already done
  if (!window.months || window.months.length === 0) {
    window.months = getLast12Months().labels;
  }

  // Inicialização do aplicativo (DOMContentLoaded continua até o fim dos handlers principais)

  // ==================== ENVIO DE PDF DA EDUCAÇÃO ====================
  let pendingEducationPdfId = null;
  let educationPdfSending = false;
  let educationPdfLastFocused = null;

  function setEducationPdfEmailState(mode, message='') {
    const status = document.getElementById('educationPdfEmailStatus');
    const sendBtn = document.getElementById('educationPdfEmailSend');
    const cancelBtn = document.getElementById('educationPdfEmailCancel');
    const question = document.getElementById('educationPdfEmailQuestion');
    if (status) {
      status.className = `education-pdf-email-status ${mode || ''}`;
      status.innerHTML = message;
    }
    if (sendBtn) {
      sendBtn.disabled = mode === 'sending' || educationPdfSending;
      sendBtn.innerHTML = mode === 'sending' ? '<i data-lucide="loader-circle"></i> Enviando...' : '<i data-lucide="send"></i> Enviar PDF';
    }
    if (cancelBtn) cancelBtn.disabled = mode === 'sending' || educationPdfSending;
    if (question) question.hidden = mode === 'success' || mode === 'error';
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  async function openEducationPdfEmail(contentId) {
    const rawId = String(contentId || '').toLowerCase().trim();
    const cleanId = rawId.replace(/[^a-z0-9]/g, '');
    const module = educationModules.find(m => m.id === rawId || (cleanId && m.id.replace(/[^a-z0-9]/g, '') === cleanId) || (m.pdf && m.pdf.toLowerCase().includes(rawId)));
    if (!module || !module.pdf) return showToast('Este conteúdo não possui PDF disponível.');
    const modal = document.getElementById('educationPdfEmailModal');
    if (!modal) return;
    try {
      const user = await getAuthenticatedUserForEmail();
      pendingEducationPdfId = contentId;
      educationPdfLastFocused = document.activeElement;
      document.getElementById('educationPdfEmailTitle').textContent = 'Enviar material por e-mail';
      document.getElementById('educationPdfEmailText').textContent = `O PDF “${module.title}” será enviado para:`;
      document.getElementById('educationPdfEmailRecipient').textContent = user.email;
      document.getElementById('educationPdfEmailQuestion').textContent = 'Deseja receber este material nesse endereço?';
      setEducationPdfEmailState('', '');
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => document.getElementById('educationPdfEmailSend')?.focus());
      if (typeof refreshIcons === 'function') refreshIcons();
    } catch (error) {
      showToast('Não foi possível identificar o e-mail da conta.');
    }
  }

  function closeEducationPdfEmail() {
    if (educationPdfSending) return;
    const modal = document.getElementById('educationPdfEmailModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    pendingEducationPdfId = null;
    if (educationPdfLastFocused && typeof educationPdfLastFocused.focus === 'function') educationPdfLastFocused.focus();
  }

  async function sendEducationPdfEmail() {
    if (!pendingEducationPdfId || educationPdfSending) return;
    educationPdfSending = true;
    setEducationPdfEmailState('sending', '<strong>📤 Enviando seu material...</strong><br><span>Aguarde alguns instantes.</span>');
    try {
      const data = await apiFetch('/api/education/pdf/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: pendingEducationPdfId })
      });
      if (!data.ok) throw new Error(data.error || 'Não foi possível enviar o PDF.');
      const recipient = data.recipient || document.getElementById('educationPdfEmailRecipient')?.textContent || '';
      setEducationPdfEmailState('success', `<strong>✅ PDF enviado!</strong><br><span>O material foi enviado para <b>${escapeHtmlSafe(recipient)}</b>.<br>Verifique sua caixa de entrada e, caso não encontre a mensagem, confira também a pasta de spam.</span>`);
      const sendBtn = document.getElementById('educationPdfEmailSend');
      if (sendBtn) sendBtn.innerHTML = '<i data-lucide="check"></i> Enviado';
      const cancelBtn = document.getElementById('educationPdfEmailCancel');
      if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = 'Fechar'; }
      if (typeof refreshIcons === 'function') refreshIcons();
    } catch (error) {
      console.error('Erro no envio do PDF:', error);
      setEducationPdfEmailState('error', '<strong>⚠️ Não foi possível enviar o PDF</strong><br><span>Ocorreu um problema ao tentar enviar o material. Verifique sua conexão e tente novamente.</span>');
      const sendBtn = document.getElementById('educationPdfEmailSend');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Tentar novamente'; }
      if (typeof refreshIcons === 'function') refreshIcons();
    } finally {
      educationPdfSending = false;
    }
  }

  function escapeHtmlSafe(value) {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  document.getElementById('educationPdfEmailClose')?.addEventListener('click', closeEducationPdfEmail);
  document.getElementById('educationPdfEmailCancel')?.addEventListener('click', closeEducationPdfEmail);
  document.getElementById('educationPdfEmailSend')?.addEventListener('click', sendEducationPdfEmail);
  document.getElementById('educationPdfEmailModal')?.addEventListener('click', e => {
    if (e.target.id === 'educationPdfEmailModal') closeEducationPdfEmail();
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-send-education-pdf]');
    if (btn) {
      e.stopPropagation();
      openEducationPdfEmail(btn.dataset.sendEducationPdf);
    }
  });
  document.addEventListener('keydown', e => {
    const modal = document.getElementById('educationPdfEmailModal');
    if (!modal || !modal.classList.contains('show')) return;
    if (e.key === 'Escape') closeEducationPdfEmail();
    if (e.key === 'Enter' && document.activeElement?.id === 'educationPdfEmailSend') sendEducationPdfEmail();
  });

  // ==================== EDUCAÇÃO FINANCEIRA ====================
  const educationModules = [
    { id:'orcamento', level:'iniciante', phase:1, pdf:'conteudos/educacao-financeira/01-orcamento-inteligente.pdf', title:'Orçamento inteligente', desc:'Aprenda a organizar receitas, despesas e limites sem complicação.', icon:'wallet', time:'8 min', points:50, lesson:'Um orçamento começa com três perguntas: quanto entra, quanto sai e quanto você quer guardar. Registre receitas e despesas, defina limites por categoria e revise o resultado todo mês.' },
    { id:'dividas', level:'iniciante', phase:2, pdf:'conteudos/educacao-financeira/02-dividas-sob-controle.pdf', title:'Dívidas sob controle', desc:'Entenda juros, prioridades e estratégias para sair do endividamento.', icon:'shield-alert', time:'10 min', points:60, lesson:'Liste suas dívidas pelo custo dos juros. Priorize as mais caras, evite novas dívidas e negocie quando possível. O objetivo é transformar parcelas e juros em um plano com prazo para terminar.' },
    { id:'reserva', level:'iniciante', phase:2, pdf:'conteudos/educacao-financeira/03-reserva-de-emergencia.pdf', title:'Reserva de emergência', desc:'Descubra como construir uma proteção financeira para imprevistos.', icon:'umbrella', time:'7 min', points:50, lesson:'A reserva de emergência existe para imprevistos, não para gastos planejados. O tamanho adequado depende da estabilidade da renda e das despesas essenciais. Mantenha o dinheiro acessível e de baixo risco.' },
    { id:'investir', level:'intermediario', phase:4, pdf:'conteudos/educacao-financeira/04-primeiros-passos-investir.pdf', title:'Primeiros passos para investir', desc:'Conheça risco, liquidez, diversificação e objetivos antes de investir.', icon:'trending-up', time:'12 min', points:70, lesson:'Antes de investir, defina objetivo, prazo e tolerância a perdas. Entenda risco, liquidez e diversificação. Nunca escolha um investimento apenas porque ele promete retorno maior.' },
    { id:'cartao', level:'iniciante', phase:2, pdf:'conteudos/educacao-financeira/05-cartao-de-credito.pdf', title:'Cartão de crédito', desc:'Use o cartão como ferramenta, evitando juros e perda de controle.', icon:'credit-card', time:'6 min', points:40, lesson:'Cartão não aumenta sua renda: ele antecipa o pagamento. Acompanhe o limite, registre as compras e evite pagar apenas o mínimo da fatura, pois os juros podem crescer rapidamente.' },
    { id:'metas', level:'intermediario', phase:3, pdf:'conteudos/educacao-financeira/06-metas-e-habitos.pdf', title:'Metas e hábitos', desc:'Transforme objetivos financeiros em planos mensuráveis e sustentáveis.', icon:'target', time:'8 min', points:50, lesson:'Uma boa meta é específica, mensurável e tem prazo. Divida o objetivo em aportes mensais e acompanhe o progresso. Hábitos pequenos e consistentes superam esforços esporádicos.' },
    { id:'alocacao', level:'avancado', phase:5, pdf:'conteudos/educacao-financeira/07-alocacao-de-ativos.pdf', title:'Alocação de Ativos', desc:'Distribua o patrimônio conforme objetivo, prazo e risco com diversificação consciente.', icon:'pie-chart', time:'14 min', points:80, lesson:'Alocação de ativos define a maior parte do retorno e da volatilidade de uma carteira no longo prazo. Equilibre renda fixa, renda variável e reserva conforme seu horizonte de tempo e capacidade de suportar flutuações.' },
    { id:'rendafixa', level:'avancado', phase:5, pdf:'conteudos/educacao-financeira/08-renda-fixa-avancada.pdf', title:'Renda Fixa Avançada', desc:'Juros reais, marcação a mercado e comparação entre títulos públicos e privados.', icon:'layers', time:'15 min', points:80, lesson:'Títulos de renda fixa sofrem marcação a mercado quando vendidos antes do vencimento. Compreenda indexadores (Selic, CDI, IPCA+) e a diferença entre emissores soberanos (Tesouro Direto) e de crédito privado (CDBs, LCIs, LCAs, debêntures).' },
    { id:'acoes', level:'avancado', phase:5, pdf:'conteudos/educacao-financeira/09-acoes-e-fiis.pdf', title:'Ações e Fundos Imobiliários', desc:'Análise de fundamentos, proventos, volatilidade e disciplina em renda variável.', icon:'bar-chart-2', time:'16 min', points:90, lesson:'Investir em ações e FIIs significa tornar-se sócio de negócios e imóveis reais. Foque em indicadores de governança, saúde de fluxo de caixa e consistência de dividendos, mantendo disciplina e aportes periódicos sem tentar prever o mercado a curto prazo.' },
    { id:'impostos', level:'avancado', phase:6, pdf:'conteudos/educacao-financeira/10-impostos-sobre-investimentos.pdf', title:'Impostos sobre Investimentos', desc:'Tributação de renda fixa, ações e FIIs: pague o devido sem multas nem excessos.', icon:'file-check', time:'12 min', points:70, lesson:'A tributação varia conforme a classe de ativos: tabela regressiva para renda fixa, apuração mensal de DARF e regras de isenção em renda variável, e recolhimento específico sobre ganhos de capital em FIIs. Manter registros organizados evita pendências com o fisco.' },
    { id:'previdencia', level:'avancado', phase:6, pdf:'conteudos/educacao-financeira/11-protecao-e-previdencia.pdf', title:'Proteção e Previdência', desc:'Proteja renda, família e patrimônio contra eventos de alto impacto e planeje o futuro.', icon:'shield-check', time:'14 min', points:80, lesson:'Planejar o futuro exige proteger o presente. Avalie seguros de vida e invalidez proporcionais à dependência financeira da sua família e escolha com critério entre planos PGBL (com benefício fiscal) ou VGBL, considerando regimes progressivo e regressivo.' },
    { id:'independencia', level:'avancado', phase:6, pdf:'conteudos/educacao-financeira/12-independencia-financeira.pdf', title:'Independência Financeira', desc:'Planeje a formação do patrimônio gerador de renda que sustentará seu estilo de vida.', icon:'award', time:'18 min', points:100, lesson:'Atingir a independência financeira requer calcular o custo anual de vida e estimar a taxa segura de retirada do patrimônio. O segredo está no controle da taxa de poupança, na consistência de reinvestimento de proventos e na blindagem emocional durante ciclos de crise.' }
  ];

  const EDU_PHASES = [
    { id:1, level:'iniciante', title:'Fundamentos', desc:'Base da educação financeira', modules:['orcamento'] },
    { id:2, level:'iniciante', title:'Organização', desc:'Orçamento, dívidas e reserva', modules:['dividas','reserva','cartao'] },
    { id:3, level:'intermediario', title:'Planejamento', desc:'Metas e hábitos sustentáveis', modules:['metas'] },
    { id:4, level:'intermediario', title:'Investimentos', desc:'Primeiros passos com consciência', modules:['investir'] },
    { id:5, level:'avancado', title:'Estratégias', desc:'Alocação, renda fixa avançada e renda variável', modules:['alocacao','rendafixa','acoes'] },
    { id:6, level:'avancado', title:'Gestão patrimonial', desc:'Impostos, proteção e independência', modules:['impostos','previdencia','independencia'] }
  ];

  const EDU_ACHIEVEMENTS = [
    { id:'primeiro_quiz', icon:'🎯', name:'Primeiro Quiz', desc:'Conclua seu primeiro quiz' },
    { id:'mestre_orcamento', icon:'📒', name:'Mestre do Orçamento', desc:'Conclua a trilha de orçamento' },
    { id:'juros', icon:'📈', name:'Especialista em Juros', desc:'Acerte quizzes de juros' },
    { id:'investidor', icon:'💼', name:'Investidor Consciente', desc:'Conclua a trilha de investimentos' },
    { id:'planejador', icon:'🗺️', name:'Planejador Financeiro', desc:'Conclua a trilha de metas' },
    { id:'diversificacao', icon:'🧩', name:'Mestre da Diversificação', desc:'Acerte quiz de diversificação' },
    { id:'xp100', icon:'⭐', name:'100 XP', desc:'Acumule 100 pontos' },
    { id:'xp250', icon:'🏆', name:'250 XP', desc:'Acumule 250 pontos' }
  ];

  // 30+ quizzes (id único, nível, tema, questões)
  const EDU_QUIZZES = [
    // INICIANTE (10+)
    { id:'q_ini_orcamento', level:'iniciante', title:'Orçamento básico', topic:'orcamento', questions:[
      { q:'Qual é o primeiro passo para montar um orçamento pessoal?', options:['Investir em ações','Registrar receitas e despesas','Pedir aumento de salário','Cancelar todos os cartões'], correct:1, explain:'Sem saber quanto entra e quanto sai, qualquer plano fica no escuro. O registro é a base.' },
      { q:'Necessidade e desejo diferem porque:', options:['Desejo sempre custa mais','Necessidade é essencial à sobrevivência/rotina; desejo é opcional','Desejos não entram no orçamento','Necessidades não podem ser reduzidas'], correct:1, explain:'Classificar gastos ajuda a priorizar cortes sem comprometer o essencial.' },
      { q:'Uma pessoa recebe R$ 3.000 e tem despesas essenciais de R$ 1.700. Uma estratégia adequada para o restante seria:', options:['Gastar tudo em lazer, pois já pagou o essencial','Dividir entre reserva, metas e consumos conscientes','Investir 100% em cripto','Ignorar o restante até o fim do mês'], correct:1, explain:'Com margem positiva, faz sentido equilibrar proteção (reserva), objetivos e lazer planejado.' }
    ]},
    { id:'q_ini_reserva', level:'iniciante', title:'Reserva de emergência', topic:'reserva', questions:[
      { q:'Para que serve a reserva de emergência?', options:['Comprar bens de consumo','Cobrir imprevistos sem endividar','Aumentar o limite do cartão','Pagar férias internacionais'], correct:1, explain:'A reserva evita que imprevistos virem dívida cara.' },
      { q:'Onde costuma ser mais adequado manter a reserva de emergência?', options:['Em ativo de altíssima volatilidade','Em opção com liquidez e baixo risco','Somente em espécie em casa','Em bem imóvel'], correct:1, explain:'Liquidez e segurança importam mais que rentabilidade máxima na reserva.' }
    ]},
    { q_id:'q_ini_cartao', id:'q_ini_cartao', level:'iniciante', title:'Cartão de crédito', topic:'cartao', questions:[
      { q:'Pagar só o mínimo da fatura tende a:', options:['Zerar a dívida rapidamente','Gerar juros altos sobre o saldo restante','Aumentar o score automaticamente','Eliminar anuidade'], correct:1, explain:'O rotativo/parcelamento da fatura costuma ter custo elevado.' },
      { q:'O cartão de crédito:', options:['Aumenta sua renda','Antecipa poder de compra sobre renda futura','Substitui a necessidade de orçamento','É sempre a melhor forma de pagar'], correct:1, explain:'É crédito, não renda extra.' }
    ]},
    { id:'q_ini_dividas', level:'iniciante', title:'Dívidas sob controle', topic:'dividas', questions:[
      { q:'Ao priorizar dívidas, em geral faz sentido olhar primeiro:', options:['A de menor valor sempre','A com maior custo de juros','A mais antiga sem olhar juros','Qualquer uma, tanto faz'], correct:1, explain:'Reduzir o custo total dos juros acelera a saída do endividamento.' },
      { q:'Verdadeiro ou falso: renegociar pode ser uma ferramenta útil se reduzir juros ou adequar o fluxo.', options:['Verdadeiro','Falso'], correct:0, explain:'Renegociação bem feita pode melhorar condições, mas deve ser avaliada com números.' }
    ]},
    { id:'q_ini_juros', level:'iniciante', title:'Juros simples e compostos', topic:'juros', questions:[
      { q:'Juros compostos diferem dos simples principalmente porque:', options:['São sempre ilegais','Incidem sobre o valor acumulado (juros sobre juros)','Só existem em poupança','Não dependem do tempo'], correct:1, explain:'No composto, o rendimento de um período entra na base do seguinte.' },
      { q:'Se uma dívida cobra juros altos e você tem reserva ociosa cara de manter, uma decisão racional pode ser:', options:['Ignorar a dívida','Avaliar quitar ou reduzir a dívida cara','Investir só em ativos de risco máximo','Aumentar o limite do cartão'], correct:1, explain:'Custo da dívida vs. retorno da reserva deve ser comparado com cuidado.' }
    ]},
    { id:'q_ini_inflacao', level:'iniciante', title:'Inflação no dia a dia', topic:'inflacao', questions:[
      { q:'Inflação alta tende a:', options:['Aumentar o poder de compra do dinheiro parado','Reduzir o poder de compra se a renda não acompanhar','Eliminar a necessidade de orçamento','Garantir retornos reais positivos'], correct:1, explain:'Com preços subindo e renda estável, sobra menos no bolso.' },
      { q:'Retorno real considera:', options:['Só o valor nominal investido','Rendimento descontada a inflação','Apenas o CDI','Somente o IR'], correct:1, explain:'O que importa para o poder de compra é o retorno acima da inflação.' }
    ]},
    { id:'q_ini_planejamento', level:'iniciante', title:'Planejamento básico', topic:'planejamento', questions:[
      { q:'Um plano financeiro útil costuma incluir:', options:['Só investimentos de risco','Receitas, despesas, metas e revisão periódica','Apenas o extrato do cartão','Promessas de enriquecimento rápido'], correct:1, explain:'Planejamento é ciclo contínuo, não um evento único.' },
      { q:'Verdadeiro ou falso: “guardar o que sobrar” costuma funcionar melhor que definir um valor de poupança primeiro.', options:['Verdadeiro','Falso'], correct:1, explain:'Na prática, definir a poupança como prioridade (pay yourself first) costuma ser mais eficaz.' }
    ]},
    { id:'q_ini_necessidades', level:'iniciante', title:'Necessidade vs desejo', topic:'orcamento', questions:[
      { q:'Qual item costuma ser classificado como desejo (não necessidade básica)?', options:['Aluguel da moradia principal','Alimentação básica','Streaming premium de lazer','Remédios de uso contínuo'], correct:2, explain:'Lazer é importante, mas em geral é flexível frente ao essencial.' },
      { q:'Cortar desejos antes de necessidades essenciais é:', options:['Sempre um erro','Uma ordem comum de prioridade em aperto orçamentário','Proibido por lei','Inútil'], correct:1, explain:'Em aperto, preserva-se o essencial e revisa-se o discricionário.' }
    ]},
    { id:'q_ini_503020', level:'iniciante', title:'Regra 50-30-20', topic:'orcamento', questions:[
      { q:'Na regra orientativa 50-30-20, os 20% referem-se a:', options:['Impostos','Poupança e objetivos financeiros','Lazer obrigatório','Tarifas bancárias'], correct:1, explain:'Os 20% são direcionados a reserva, dívidas extras ou investimentos conforme o caso.' },
      { q:'A regra 50-30-20 deve ser vista como:', options:['Lei obrigatória para todos','Referência adaptável à realidade de cada pessoa','Única forma correta de orçar','Garantia de riqueza'], correct:1, explain:'É um guia didático, não uma camisa de força.' }
    ]},
    { id:'q_ini_habitos', level:'iniciante', title:'Hábitos financeiros', topic:'metas', questions:[
      { q:'Um hábito financeiro saudável é:', options:['Revisar extratos e orçamento com regularidade','Nunca olhar o saldo','Usar só o limite do cartão','Copiar investimentos de desconhecidos'], correct:0, explain:'Consistência e acompanhamento batem impulsos isolados.' },
      { q:'Metas SMART ajudam porque:', options:['Eliminam todo risco','Tornam objetivos específicos e mensuráveis','Garantem retorno de investimento','Substituem a reserva'], correct:1, explain:'Clareza de meta facilita plano de aportes e prazos.' }
    ]},
    // INTERMEDIÁRIO (10+)
    { id:'q_int_compostos', level:'intermediario', title:'Juros compostos na prática', topic:'juros', questions:[
      { q:'Quanto maior o tempo no juros compostos (com taxa positiva):', options:['Menor o efeito acumulado','Maior tende a ser o efeito acumulado','O tempo não importa','Só importa o valor inicial'], correct:1, explain:'Tempo é um dos motores do composto.' },
      { q:'CET (custo efetivo total) de um crédito ajuda a:', options:['Esconder tarifas','Comparar o custo real entre ofertas','Calcular só IOF','Definir o score'], correct:1, explain:'CET reúne juros e encargos para comparação.' }
    ]},
    { id:'q_int_credito', level:'intermediario', title:'Crédito e financiamentos', topic:'credito', questions:[
      { q:'Antes de financiar um bem, é prudente avaliar:', options:['Só a parcela mensal','Parcela, prazo, taxa, CET e impacto no orçamento','Apenas a cor do bem','Só a propaganda'], correct:1, explain:'Parcela baixa com prazo longo pode sair cara no total.' },
      { q:'Empréstimo com taxa muito acima do que você rende em investimentos seguros:', options:['Sempre deve ser maximizado','Merece cautela — o custo pode destruir margem','É sempre melhor que poupar','Não tem relação com o orçamento'], correct:1, explain:'Custo de crédito alto compete com qualquer plano de acumulação.' }
    ]},
    { id:'q_int_rf', level:'intermediario', title:'Renda fixa', topic:'investimentos', questions:[
      { q:'Renda fixa, em geral, caracteriza-se por:', options:['Retorno diário garantido em qualquer cenário','Regras de remuneração conhecidas no momento da aplicação (com ressalvas)','Ausência total de risco','Ser idêntica a ações'], correct:1, explain:'Há risco de crédito, liquidez e marcação a mercado em alguns títulos.' },
      { q:'Diversificar entre emissores e prazos na renda fixa pode:', options:['Aumentar concentração','Reduzir dependência de um único risco de crédito/prazo','Eliminar impostos','Garantir o CDI+'], correct:1, explain:'Diversificação não elimina risco, mas dilui fontes específicas.' }
    ]},
    { id:'q_int_rv', level:'intermediario', title:'Renda variável', topic:'investimentos', questions:[
      { q:'Ações e FIIs costumam ter:', options:['Rentabilidade fixa mensal garantida','Maior oscilação de preço no curto prazo que a maioria da renda fixa','Zero necessidade de horizonte','Proteção integral do FGC'], correct:1, explain:'Volatilidade é característica central da renda variável.' },
      { q:'Investir em renda variável sem reserva de emergência pode:', options:['Ser sempre ideal','Forçar venda em mau momento se houver imprevisto','Eliminar o risco de mercado','Aumentar o FGC'], correct:1, explain:'Reserva reduz a chance de liquidar ativos sob pressão.' }
    ]},
    { id:'q_int_diversificacao', level:'intermediario', title:'Diversificação', topic:'diversificacao', questions:[
      { q:'Diversificar a carteira busca principalmente:', options:['Maximizar um único ativo','Evitar concentração excessiva em um fator de risco','Garantir o maior retorno possível','Eliminar a necessidade de estudo'], correct:1, explain:'É gestão de risco, não magia de retorno.' },
      { q:'Ter 100% em um único ativo:', options:['É o ápice da diversificação','Concentra risco nesse ativo','É exigido por lei','Remove a volatilidade'], correct:1, explain:'Concentração eleva o impacto de um único evento negativo.' }
    ]},
    { id:'q_int_risco', level:'intermediario', title:'Gestão de risco', topic:'risco', questions:[
      { q:'Risco e retorno esperado, em geral:', options:['Não se relacionam','Caminham juntos — maior retorno esperado costuma exigir maior risco','Garantem lucro se o risco for alto','Só existem em cripto'], correct:1, explain:'Não há almoço grátis: retorno extra costuma vir com incerteza extra.' },
      { q:'Horizonte longo em ativos voláteis:', options:['Elimina totalmente as perdas','Pode ajudar a suportar oscilações de curto prazo','Garante superação da inflação','Torna análise desnecessária'], correct:1, explain:'Tempo ajuda, mas não é garantia.' }
    ]},
    { id:'q_int_metas', level:'intermediario', title:'Metas e prazos', topic:'metas', questions:[
      { q:'Objetivo de curto prazo costuma combinar melhor com:', options:['Ativos de altíssima volatilidade','Maior liquidez e menor oscilação','Somente criptomoedas','Alavancagem máxima'], correct:1, explain:'Prazo curto reduz capacidade de esperar recuperação de preços.' },
      { q:'Calcular o aporte mensal para uma meta exige:', options:['Apenas o valor do sonho','Valor-alvo, prazo e eventual rentabilidade estimada','Somente o signo do zodíaco','Ignorar a inflação sempre'], correct:1, explain:'Plano quantificado torna a meta executável.' }
    ]},
    { id:'q_int_fundos', level:'intermediario', title:'Fundos e ETFs', topic:'investimentos', questions:[
      { q:'ETFs costumam:', options:['Replicar índices com custo relativamente transparente','Garantir retorno fixo','Eliminar risco de mercado','Ser iguais a CDB'], correct:0, explain:'ETFs facilitam exposição diversificada a um índice, com riscos do próprio índice.' },
      { q:'Antes de investir em um fundo, é útil olhar:', options:['Só a propaganda','Taxas, estratégia, histórico e adequação ao objetivo','Apenas o nome do gestor famoso','Somente o valor da cota de ontem'], correct:1, explain:'Adequação e custos importam mais que marketing.' }
    ]},
    { id:'q_int_independencia', level:'intermediario', title:'Independência financeira', topic:'planejamento', questions:[
      { q:'Independência financeira está mais relacionada a:', options:['Gastar todo o salário','Construir ativos que sustentem o padrão de vida desejado','Nunca investir','Só aumentar o limite de crédito'], correct:1, explain:'É sobre patrimônio e renda passiva/adequada ao custo de vida.' },
      { q:'Taxa de poupança elevada ao longo do tempo:', options:['É irrelevante','Acelera a construção de patrimônio, ceteris paribus','Garante ações vencedoras','Substitui qualquer estudo'], correct:1, explain:'Poupar e investir com consistência é alicerce do longo prazo.' }
    ]},
    { id:'q_int_cenario', level:'intermediario', title:'Cenário prático', topic:'planejamento', questions:[
      { q:'João tem reserva de 1 mês de gastos e dívida de cartão a 10% a.m. A prioridade mais sensata costuma ser:', options:['Comprar ações alavancadas','Atacar a dívida cara e fortalecer a reserva','Ignorar ambos','Aumentar desejos'], correct:1, explain:'Juros de cartão nessa magnitude corroem qualquer plano.' },
      { q:'Verdadeiro ou falso: comparar ofertas de crédito pelo CET é mais completo que olhar só a taxa anunciada.', options:['Verdadeiro','Falso'], correct:0, explain:'CET inclui encargos além da taxa nominal.' }
    ]},
    // AVANÇADO (10+)
    { id:'q_adv_alocacao', level:'avancado', title:'Alocação de ativos', topic:'alocacao', questions:[
      { q:'Alocação de ativos busca:', options:['Escolher só o ativo da moda','Distribuir recursos entre classes conforme objetivos e risco','Garantir retorno mínimo legal','Eliminar rebalanceamento'], correct:1, explain:'É a decisão estrutural da carteira.' },
      { q:'Rebalancear periodicamente serve para:', options:['Aumentar concentração automática','Trazer pesos de volta à política definida','Eliminar IR sempre','Copiar o Ibovespa obrigatoriamente'], correct:1, explain:'Evita que a carteira “ande” para um perfil de risco indesejado.' }
    ]},
    { id:'q_adv_volatilidade', level:'avancado', title:'Volatilidade e correlação', topic:'risco', questions:[
      { q:'Ativos com correlação baixa entre si podem:', options:['Piorar sempre a diversificação','Ajudar a reduzir a volatilidade combinada da carteira','Garantir lucro em crises','Eliminar drawdowns'], correct:1, explain:'Diversificação efetiva depende de não se moverem todos iguais.' },
      { q:'Volatilidade alta significa:', options:['Retorno garantido alto','Oscilações de preço mais amplas','Risco zero','Isenção de impostos'], correct:1, explain:'Volatilidade mede dispersão, não garante prêmio.' }
    ]},
    { id:'q_adv_retorno_real', level:'avancado', title:'Retorno real e inflação', topic:'inflacao', questions:[
      { q:'Se um investimento rende 10% e a inflação no período foi 6%, o retorno real aproximado é:', options:['16%','4%','10%','6%'], correct:1, explain:'Retorno real ≈ nominal − inflação (aproximação simples).' },
      { q:'Ignorar a inflação em metas de longo prazo pode:', options:['Superestimar o poder de compra futuro','Não ter efeito algum','Eliminar a necessidade de aportes','Garantir a aposentadoria'], correct:0, explain:'Metas em R$ de hoje precisam de ajuste ou premissas claras.' }
    ]},
    { id:'q_adv_tributacao', level:'avancado', title:'Tributação e custos', topic:'tributacao', questions:[
      { q:'Custos e impostos sobre investimentos:', options:['São irrelevantes no longo prazo','Reduzem o retorno líquido e devem entrar na análise','Aumentam automaticamente o patrimônio','Só existem em ações'], correct:1, explain:'Retorno que importa é o líquido de custos e tributos.' },
      { q:'Comparar produtos só pelo retorno bruto:', options:['É sempre suficiente','Pode induzir a erro se custos/tributos diferirem','Elimina risco de crédito','É exigido pela CVM para pessoa física'], correct:1, explain:'Bruto ≠ líquido.' }
    ]},
    { id:'q_adv_rebalance', level:'avancado', title:'Rebalanceamento', topic:'alocacao', questions:[
      { q:'Após uma forte alta de uma classe, o peso dela na carteira:', options:['Permanece igual automaticamente','Tende a aumentar, elevando o risco relativo','Cai sempre','Some'], correct:1, explain:'Por isso políticas de rebalanceamento existem.' },
      { q:'Rebalancear pode envolver:', options:['Só comprar o que mais subiu','Vender o que excedeu o peso-alvo e reforçar o que ficou abaixo','Eliminar toda renda fixa','Zerar a reserva'], correct:1, explain:'É realinhar aos alvos definidos.' }
    ]},
    { id:'q_adv_cenarios', level:'avancado', title:'Análise de cenários', topic:'planejamento', questions:[
      { q:'Testar cenários (otimista, base, estresse) ajuda a:', options:['Prever o futuro com certeza','Entender sensibilidades do plano a choques','Eliminar a necessidade de reserva','Garantir o cenário base'], correct:1, explain:'Preparação ≠ previsão perfeita.' },
      { q:'Verdadeiro ou falso: projeções de patrimônio futuro são estimativas, não garantias.', options:['Verdadeiro','Falso'], correct:0, explain:'Premissas de taxa e aportes podem não se confirmar.' }
    ]},
    { id:'q_adv_aposentadoria', level:'avancado', title:'Planejamento de aposentadoria', topic:'planejamento', questions:[
      { q:'Planejar aposentadoria envolve tipicamente:', options:['Só o INSS obrigatoriamente como único pilar','Estimativa de gastos futuros, fontes de renda e horizonte','Ignorar a inflação','Concentrar 100% em um único ativo de risco'], correct:1, explain:'É um problema de longo prazo com várias fontes possíveis.' },
      { q:'Sequência de retornos ruins no início da fase de desacumulação:', options:['Não importa','Pode prejudicar a sustentabilidade da carteira','Garante recuperação imediata','Elimina a necessidade de reserva'], correct:1, explain:'Risco de sequência é crítico na aposentadoria.' }
    ]},
    { id:'q_adv_patrimonio', level:'avancado', title:'Gestão patrimonial', topic:'alocacao', questions:[
      { q:'Gestão patrimonial ampla considera:', options:['Apenas a cotação do dia','Ativos, passivos, objetivos, risco e sucessão','Só a conta corrente','Somente o cartão de crédito'], correct:1, explain:'Visão integral do balanço pessoal/familiar.' },
      { q:'Concentração excessiva no próprio negócio ou imóvel único:', options:['É sempre diversificação perfeita','Pode representar risco concentrado de patrimônio','Elimina necessidade de liquidez','Garante renda vitalícia'], correct:1, explain:'Risco idiossincrático elevado merece atenção.' }
    ]},
    { id:'q_adv_liquidez', level:'avancado', title:'Liquidez e prazos', topic:'risco', questions:[
      { q:'Ativo ilíquido em necessidade súbita de caixa pode forçar:', options:['Compra automática com desconto','Venda em condições desfavoráveis','Isenção de IR','Aumento do FGC'], correct:1, explain:'Liquidez é parte do risco prático.' },
      { q:'Casar prazos de objetivos com liquidez dos ativos:', options:['É boa prática de planejamento','É ilegal','Garante retorno real','Elimina volatilidade'], correct:0, explain:'Objetivo de 6 meses ≠ travar em produto de 5 anos sem liquidez.' }
    ]},
    { id:'q_adv_estrategia', level:'avancado', title:'Estratégia de longo prazo', topic:'planejamento', questions:[
      { q:'Disciplina de aportes regulares costuma ser mais relevante do que:', options:['Escolher o “ativo perfeito” uma vez','Ignorar custos','Nunca rebalancear','Concentrar em dicas quentes'], correct:0, explain:'Consistência de aportes e política de investimento tendem a pesar mais que timing perfeito.' },
      { q:'Verdadeiro ou falso: educação financeira contínua reduz a chance de decisões impulsivas.', options:['Verdadeiro','Falso'], correct:0, explain:'Conhecimento e processo ajudam a filtrar ruído.' }
    ]}
  ];

  let eduLevelFilter = 'todos';
  let eduSimChart = null;
  let currentQuiz = null;
  let currentQuizIndex = 0;
  let currentQuizScore = 0;
  let educationLessonReturnFocus = null;

  function getEducationStorageKey() { return `prisma_education_data_${currentProfileId || 'default'}`; }
  function getEducationData() {
    const defaults = {
      completed: [], points: 0, challengeDone: false,
      quizzesCompleted: [], quizScores: {}, wrongTopics: [], achievements: []
    };
    try {
      const raw = JSON.parse(localStorage.getItem(getEducationStorageKey()) || '{}');
      return {
        ...defaults,
        ...raw,
        completed: Array.isArray(raw.completed) ? raw.completed : [],
        quizzesCompleted: Array.isArray(raw.quizzesCompleted) ? raw.quizzesCompleted : [],
        quizScores: raw.quizScores && typeof raw.quizScores === 'object' ? raw.quizScores : {},
        wrongTopics: Array.isArray(raw.wrongTopics) ? raw.wrongTopics : [],
        achievements: Array.isArray(raw.achievements) ? raw.achievements : []
      };
    } catch (_) { return { ...defaults }; }
  }
  function saveEducationData(data) { localStorage.setItem(getEducationStorageKey(), JSON.stringify(data)); if (typeof scheduleServerSync === 'function') scheduleServerSync(); }

  function unlockAchievements(data) {
    const add = (id) => { if (!data.achievements.includes(id)) data.achievements.push(id); };
    if (data.quizzesCompleted.length >= 1) add('primeiro_quiz');
    if (data.completed.includes('orcamento')) add('mestre_orcamento');
    if (data.completed.includes('investir')) add('investidor');
    if (data.completed.includes('metas')) add('planejador');
    if (data.quizzesCompleted.includes('q_int_diversificacao') || data.quizzesCompleted.includes('q_adv_alocacao')) add('diversificacao');
    if (data.quizScores && Object.keys(data.quizScores).some(k => k.includes('juros') || (data.quizzesCompleted || []).some(id => id.includes('juros')))) add('juros');
    if ((data.quizzesCompleted || []).some(id => String(id).includes('juros'))) add('juros');
    if (data.points >= 100) add('xp100');
    if (data.points >= 250) add('xp250');
  }

  function renderEduAchievements() {
    const grid = document.getElementById('eduAchievementsGrid');
    if (!grid) return;
    const unlocked = new Set(getEducationData().achievements);
    grid.innerHTML = EDU_ACHIEVEMENTS.map(achievement => {
      const isUnlocked = unlocked.has(achievement.id);
      return `<div class="edu-ach ${isUnlocked ? 'unlocked' : ''}" title="${achievement.desc}" aria-label="${achievement.name}: ${isUnlocked ? 'conquistada' : 'bloqueada'}">
        <div class="ea-icon" aria-hidden="true">${achievement.icon}</div>
        <div class="ea-name">${achievement.name}</div>
      </div>`;
    }).join('');
  }

  function isPhaseUnlocked(phaseId, data) {
    if (phaseId <= 1) return true;
    // Fase N desbloqueia se fase N-1 tiver >= 50% dos módulos concluídos (ou nenhum módulo = libera por quizzes do nível)
    const prev = EDU_PHASES.find(p => p.id === phaseId - 1);
    if (!prev) return true;
    if (!prev.modules.length) return true;
    const done = prev.modules.filter(m => data.completed.includes(m)).length;
    return done >= Math.ceil(prev.modules.length * 0.5);
  }

  function renderEduPhases() {
    const el = document.getElementById('eduPhases');
    if (!el) return;
    const data = getEducationData();
    el.innerHTML = EDU_PHASES.map(ph => {
      const unlocked = isPhaseUnlocked(ph.id, data);
      const total = ph.modules.length || 1;
      const done = ph.modules.filter(m => data.completed.includes(m)).length;
      const pct = ph.modules.length ? Math.round((done / total) * 100) : (data.quizzesCompleted.filter(q => {
        const quiz = EDU_QUIZZES.find(x => x.id === q);
        return quiz && quiz.level === ph.level;
      }).length > 0 ? 50 : 0);
      const status = !unlocked ? 'locked' : (pct >= 100 ? 'done' : (pct > 0 ? 'active' : ''));
      const levelEmoji = ph.level === 'iniciante' ? '🟢' : ph.level === 'intermediario' ? '🟡' : '🔴';
      return `<div class="edu-phase ${status}">
        <div class="ep-level">${levelEmoji} Fase ${ph.id}</div>
        <div class="ep-title">${ph.title}</div>
        <div class="ep-desc">${ph.desc}</div>
        <div class="ep-bar"><span style="width:${unlocked ? pct : 0}%"></span></div>
        <div class="ep-meta"><span>${unlocked ? pct + '% concluído' : '🔒 Bloqueada'}</span><span>${ph.modules.length ? ph.modules.length + ' conteúdos' : 'Quizzes'}</span></div>
      </div>`;
    }).join('');
  }

  let eduSearchQuery = '';
  function renderEducation() {
    const grid = document.getElementById('educationCourses');
    if (!grid) return;
    const data = getEducationData();
    let modules = educationModules;

    if (eduLevelFilter && eduLevelFilter !== 'todos' && eduLevelFilter !== 'pdf') {
      modules = modules.filter(m => m.level === eduLevelFilter);
    }

    if (eduSearchQuery.trim()) {
      const q = eduSearchQuery.toLowerCase().trim();
      modules = modules.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.lesson.toLowerCase().includes(q)
      );
    }

    if (!modules.length) {
      grid.innerHTML = `<div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
        <p class="text-muted" style="margin: 0;">Nenhuma trilha encontrada para a busca "${escapeHtmlSafe(eduSearchQuery)}".</p>
      </div>`;
    } else {
      grid.innerHTML = modules.map(m => {
        const done = data.completed.includes(m.id);
        const badge = m.level === 'iniciante' ? 'iniciante' : m.level === 'intermediario' ? 'intermediario' : 'avancado';
        const badgeLabel = m.level === 'iniciante' ? 'Iniciante' : m.level === 'intermediario' ? 'Intermediário' : 'Avançado';
        return `<article class="education-course ${done ? 'completed' : ''}" data-module="${m.id}" role="article" tabindex="0" aria-label="Trilha ${escapeHtmlSafe(m.title)}">
          <div class="education-course-top">
            <div class="education-course-icon"><i data-lucide="${m.icon}"></i></div>
            ${done ? '<span class="education-course-status">✓ Concluído</span>' : '<span class="education-mini-label">TRILHA</span>'}
            <span class="edu-level-badge ${badge}">${badgeLabel}</span>
          </div>
          <h4>${m.title}</h4>
          <p>${m.desc}</p>
          <div class="education-course-meta">
            <span><i data-lucide="clock"></i> ${m.time} de leitura</span>
            <span>+${m.points} XP</span>
          </div>
          <div class="education-course-actions">
            <button type="button" class="btn primary btn-sm btn-start-lesson" data-open-lesson="${m.id}"><i data-lucide="book-open"></i> Iniciar Aula</button>
            <a class="btn secondary btn-sm education-course-pdf" href="${m.pdf}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i data-lucide="file-text"></i> PDF</a>
            <button type="button" class="btn secondary btn-sm education-course-email" data-send-education-pdf="${m.id}" onclick="event.stopPropagation()"><i data-lucide="mail"></i> E-mail</button>
          </div>
        </article>`;
      }).join('');
    }

    grid.querySelectorAll('[data-open-lesson]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openEducationLesson(button.dataset.openLesson);
      });
    });

    grid.querySelectorAll('.education-course').forEach(card => {
      card.addEventListener('click', () => {
        educationLessonReturnFocus = card;
        openEducationLesson(card.dataset.module);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        educationLessonReturnFocus = card;
        openEducationLesson(card.dataset.module);
      });
    });

    grid.querySelectorAll('[data-send-education-pdf]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openEducationPdfEmail(button.dataset.sendEducationPdf);
      });
    });

    updateEducationProgress();
    renderEduPhases();
    renderEduQuizList();
    renderEduAchievements();
    renderEduAiInsight();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function openEducationLesson(id) {
    const module = educationModules.find(m => m.id === id);
    if (!module) return;
    let modal = document.getElementById('educationLessonModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'educationLessonModal';
      modal.className = 'education-lesson-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="education-lesson-card" role="document">
      <button type="button" class="education-lesson-close" aria-label="Fechar aula"><i data-lucide="x"></i></button>
      <div class="education-card-icon"><i data-lucide="${module.icon}"></i></div>
      <span class="education-mini-label">TRILHA · ${module.time}</span>
      <h3 id="educationLessonTitle">${module.title}</h3>
      <p>${module.lesson}</p>
      <div class="education-lesson-actions">
        <a class="btn secondary" href="${module.pdf}" target="_blank" rel="noopener"><i data-lucide="file-text"></i> Abrir PDF</a>
        <button class="btn secondary education-pdf-email-btn"><i data-lucide="mail"></i> Enviar PDF por e-mail</button>
        <button class="btn primary education-complete-btn"><i data-lucide="check"></i> Marcar como concluída</button>
      </div>
    </div>`;
    modal.setAttribute('aria-labelledby', 'educationLessonTitle');
    modal.setAttribute('aria-hidden', 'false');
    modal.tabIndex = -1;
    modal.classList.add('show');
    if (typeof refreshIcons === 'function') refreshIcons();
    const closeLesson = () => {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      if (educationLessonReturnFocus && typeof educationLessonReturnFocus.focus === 'function') educationLessonReturnFocus.focus();
    };
    modal.querySelector('.education-lesson-close').onclick = closeLesson;
    modal.onclick = e => { if (e.target === modal) closeLesson(); };
    modal.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); closeLesson(); } };
    const lessonEmailBtn = modal.querySelector('.education-pdf-email-btn');
    if (lessonEmailBtn) lessonEmailBtn.onclick = () => openEducationPdfEmail(module.id);
    modal.querySelector('.education-complete-btn').onclick = () => {
      completeEducationModule(id);
      closeLesson();
    };
    modal.focus();
    requestAnimationFrame(() => modal.querySelector('.education-lesson-close')?.focus());
  }

  function completeEducationModule(id) {
    const data = getEducationData();
    if (!data.completed.includes(id)) {
      const module = educationModules.find(m => m.id === id);
      data.completed.push(id);
      data.points += module ? module.points : 0;
      unlockAchievements(data);
      saveEducationData(data);
      showToast(`📚 ${module ? module.title : 'Trilha'} concluída! +${module ? module.points : 0} XP`);
      renderEducation();
    } else {
      showToast('Esta trilha já foi concluída.');
    }
  }

  function updateEducationProgress() {
    const data = getEducationData();
    const total = Math.max(1, educationModules.length);
    const contentPct = Math.round((data.completed.length / total) * 100);
    const quizPct = EDU_QUIZZES.length ? Math.round((data.quizzesCompleted.length / EDU_QUIZZES.length) * 100) : 0;
    const pct = Math.round(contentPct * 0.5 + quizPct * 0.5);
    const bar = document.getElementById('educationProgressBar');
    const text = document.getElementById('educationProgressText');
    const points = document.getElementById('educationPoints');
    const level = document.getElementById('educationLevel');
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${pct}% concluído`;
    if (points) points.textContent = `${data.points} XP`;
    if (level) level.textContent = data.points >= 250 ? 'Especialista' : data.points >= 120 ? 'Intermediário' : data.points >= 50 ? 'Aprendiz' : 'Iniciante';

    const scores = Object.values(data.quizScores || {});
    const avgAcc = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const elQ = document.getElementById('eduStatQuizzes');
    const elA = document.getElementById('eduStatAccuracy');
    const elC = document.getElementById('eduStatContents');
    const elAch = document.getElementById('eduStatAchievements');
    if (elQ) elQ.textContent = String(data.quizzesCompleted.length);
    if (elA) elA.textContent = avgAcc != null ? avgAcc + '%' : '—';
    if (elC) elC.textContent = String(data.completed.length);
    if (elAch) elAch.textContent = String((data.achievements || []).length);

    const next = document.getElementById('eduNextStep');
    const nextHint = document.getElementById('eduNextStepHint');
    if (next) {
      const incomplete = educationModules.find(m => !data.completed.includes(m.id));
      if (incomplete) {
        next.textContent = incomplete.title;
        if (nextHint) nextHint.textContent = 'Trilha recomendada';
      } else if (data.wrongTopics.length) {
        next.textContent = 'Revisar: ' + data.wrongTopics[data.wrongTopics.length - 1];
        if (nextHint) nextHint.textContent = 'Com base nos erros recentes';
      } else {
        next.textContent = 'Explorar quizzes avançados';
        if (nextHint) nextHint.textContent = 'Continue praticando';
      }
    }
  }

  function renderEduQuizList() {
    const list = document.getElementById('eduQuizList');
    const sel = document.getElementById('eduQuizLevelSelect');
    if (!list) return;
    const level = sel ? sel.value : 'iniciante';
    const data = getEducationData();
    const quizzes = EDU_QUIZZES.filter(q => q.level === level);
    list.innerHTML = quizzes.map(q => {
      const done = data.quizzesCompleted.includes(q.id);
      const score = data.quizScores[q.id];
      return `<div class="edu-quiz-item ${done ? 'done' : ''}" data-quiz-id="${q.id}" role="button" tabindex="0" aria-label="Iniciar quiz ${escapeHtmlSafe(q.title)}">
        <div class="eq-title">${q.title}</div>
        <div class="eq-meta">${q.questions.length} questões · ${done ? (score != null ? score + '% acerto' : 'Concluído') : 'Disponível'}</div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-quiz-id]').forEach(el => {
      el.addEventListener('click', () => startEduQuiz(el.dataset.quizId));
      el.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        startEduQuiz(el.dataset.quizId);
      });
    });
  }

  function startEduQuiz(quizId) {
    const quiz = EDU_QUIZZES.find(q => q.id === quizId);
    if (!quiz) return;
    currentQuiz = quiz;
    currentQuizIndex = 0;
    currentQuizScore = 0;
    document.getElementById('eduQuizList').hidden = true;
    const player = document.getElementById('eduQuizPlayer');
    if (player) player.hidden = false;
    document.getElementById('eduQuizNext').hidden = true;
    showEduQuizQuestion();
  }

  function showEduQuizQuestion() {
    if (!currentQuiz) return;
    const q = currentQuiz.questions[currentQuizIndex];
    const total = currentQuiz.questions.length;
    document.getElementById('eduQuizCounter').textContent = `${currentQuizIndex + 1} / ${total}`;
    document.getElementById('eduQuizProgressBar').style.width = `${((currentQuizIndex) / total) * 100}%`;
    document.getElementById('eduQuizQuestion').textContent = q.q;
    document.getElementById('eduQuizFeedback').innerHTML = '';
    document.getElementById('eduQuizNext').hidden = true;
    const answers = document.getElementById('eduQuizAnswers');
    answers.innerHTML = q.options.map((opt, i) =>
      `<button class="education-answer" data-idx="${i}">${opt}</button>`
    ).join('');
    answers.querySelectorAll('.education-answer').forEach(btn => {
      btn.addEventListener('click', () => answerEduQuiz(parseInt(btn.dataset.idx, 10)));
    });
  }

  function answerEduQuiz(idx) {
    if (!currentQuiz) return;
    const q = currentQuiz.questions[currentQuizIndex];
    const answers = document.getElementById('eduQuizAnswers');
    answers.querySelectorAll('.education-answer').forEach(btn => {
      btn.disabled = true;
      const i = parseInt(btn.dataset.idx, 10);
      if (i === q.correct) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    });
    const fb = document.getElementById('eduQuizFeedback');
    const ok = idx === q.correct;
    if (ok) {
      currentQuizScore++;
      fb.innerHTML = `<strong style="color:#22C55E">✅ Resposta correta</strong><p style="margin:0.35rem 0 0;font-size:0.85rem;color:var(--text-muted)">${q.explain || ''}</p>`;
    } else {
      fb.innerHTML = `<strong style="color:#EF4444">❌ Resposta incorreta</strong><p style="margin:0.35rem 0 0;font-size:0.85rem;color:var(--text-muted)">${q.explain || ''}</p>`;
      const data = getEducationData();
      if (currentQuiz.topic && !data.wrongTopics.includes(currentQuiz.topic)) {
        data.wrongTopics.push(currentQuiz.topic);
        if (data.wrongTopics.length > 10) data.wrongTopics.shift();
        saveEducationData(data);
      }
    }
    document.getElementById('eduQuizNext').hidden = false;
    document.getElementById('eduQuizNext').textContent = currentQuizIndex + 1 >= currentQuiz.questions.length ? 'Finalizar' : 'Próxima';
  }

  function finishEduQuiz() {
    if (!currentQuiz) return;
    const total = currentQuiz.questions.length;
    const pct = Math.round((currentQuizScore / total) * 100);
    const xpGain = currentQuizScore * 10;
    const data = getEducationData();
    if (!data.quizzesCompleted.includes(currentQuiz.id)) data.quizzesCompleted.push(currentQuiz.id);
    data.quizScores[currentQuiz.id] = pct;
    data.points += xpGain;
    unlockAchievements(data);
    saveEducationData(data);
    showToast(`Quiz finalizado! ${currentQuizScore}/${total} acertos · +${xpGain} XP`);
    currentQuiz = null;
    document.getElementById('eduQuizPlayer').hidden = true;
    document.getElementById('eduQuizList').hidden = false;
    renderEducation();
  }

  // Fluxo de Caixa Botão Interativo Expansível
  function setupCashflowToggle() {
    const toggleBtn = document.getElementById('btnToggleCashflow');
    const chartHead = document.getElementById('toggleCashflowChart');
    const chartBody = document.getElementById('cashflowChartBody');

    if (!chartHead || !chartBody) return;

    function toggleCashflowDisplay(e) {
      if (e) e.stopPropagation();
      const isHidden = chartBody.style.display === 'none' || !chartBody.style.display;
      chartBody.style.display = isHidden ? 'block' : 'none';
      if (toggleBtn) {
        toggleBtn.innerHTML = `<span>${isHidden ? 'Ocultar Gráfico' : 'Ver Gráfico'}</span><i data-lucide="${isHidden ? 'chevron-up' : 'chevron-down'}"></i>`;
        if (typeof refreshIcons === 'function') refreshIcons();
      }
      chartHead.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      if (isHidden) {
        setTimeout(() => {
          if (typeof renderCashflowChart === 'function') {
            renderCashflowChart();
          } else if (cashflowChart) {
            cashflowChart.resize();
            cashflowChart.update();
          } else if (typeof initCashflowChart === 'function') {
            initCashflowChart();
          }
        }, 50);
      }
    }

    if (toggleBtn) toggleBtn.addEventListener('click', toggleCashflowDisplay);
    chartHead.addEventListener('click', toggleCashflowDisplay);
  }
  setupCashflowToggle();

  // Seletor de Abas Prisma para Gráficos de Distribuição (Gastos x Receitas)
  function setupPieTabSwitcher() {
    const btnExpenses = document.getElementById('btnPieExpenses');
    const btnIncome = document.getElementById('btnPieIncome');
    const tabExpenses = document.getElementById('pieTabExpenses');
    const tabIncome = document.getElementById('pieTabIncome');

    if (!btnExpenses || !btnIncome || !tabExpenses || !tabIncome) return;

    btnExpenses.addEventListener('click', () => {
      btnExpenses.classList.add('active');
      btnExpenses.setAttribute('aria-selected', 'true');
      btnIncome.classList.remove('active');
      btnIncome.setAttribute('aria-selected', 'false');

      tabExpenses.style.display = 'block';
      tabExpenses.classList.add('active');
      tabIncome.style.display = 'none';
      tabIncome.classList.remove('active');

      setTimeout(() => {
        if (typeof renderPieChart === 'function') {
          renderPieChart();
        } else if (pieChart) {
          pieChart.resize();
          pieChart.update();
        } else if (typeof initPieChart === 'function') {
          initPieChart();
        }
      }, 50);
    });

    btnIncome.addEventListener('click', () => {
      btnIncome.classList.add('active');
      btnIncome.setAttribute('aria-selected', 'true');
      btnExpenses.classList.remove('active');
      btnExpenses.setAttribute('aria-selected', 'false');

      tabIncome.style.display = 'block';
      tabIncome.classList.add('active');
      tabExpenses.style.display = 'none';
      tabExpenses.classList.remove('active');

      setTimeout(() => {
        if (typeof renderIncomePieChart === 'function') {
          renderIncomePieChart();
        } else if (incomePieChart) {
          incomePieChart.resize();
          incomePieChart.update();
        } else if (typeof initIncomePieChart === 'function') {
          initIncomePieChart();
        }
      }, 50);
    });
  }
  setupPieTabSwitcher();

  function renderEduAiInsight() {
    const title = document.getElementById('eduAiTitle');
    const text = document.getElementById('eduAiText');
    if (!title || !text) return;
    const data = getEducationData();
    if (!data.completed.length && !data.quizzesCompleted.length) {
      title.textContent = 'Comece sua jornada';
      text.textContent = 'Conclua a trilha de Orçamento e faça um quiz iniciante. Os insights da Prisma AI usam apenas o seu progresso real nesta área.';
      return;
    }
    if (data.wrongTopics.includes('juros') || data.wrongTopics.includes('inflacao')) {
      title.textContent = 'Revise juros e inflação';
      text.textContent = 'Seus erros recentes apontam para esses temas. Releia o material e refaça o quiz correspondente antes de avançar para alocação avançada.';
      return;
    }
    if (data.completed.length < educationModules.length) {
      const next = educationModules.find(m => !data.completed.includes(m.id));
      title.textContent = 'Próximo conteúdo sugerido';
      text.textContent = next ? `Continue com “${next.title}” (${next.level}). Você já concluiu ${data.completed.length} de ${educationModules.length} trilhas.` : 'Explore os quizzes do seu nível.';
      return;
    }
    title.textContent = 'Desempenho sólido nas trilhas';
    text.textContent = `Você concluiu as trilhas disponíveis e ${data.quizzesCompleted.length} quiz(zes). Pratique os quizzes avançados para reforçar alocação e risco.`;
  }

  // --- Simulador 50-30-20 pro ---
  function parseEduMoney(raw) {
    if (typeof parseMoneyInput === 'function') return parseMoneyInput(raw) || 0;
    const n = parseFloat(String(raw || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function fmtEduMoney(v) {
    if (typeof fmtMoney === 'function') return fmtMoney(v);
    return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function projectMonthly(monthly, months, annualRate) {
    const r = (annualRate / 100) / 12;
    let bal = 0;
    for (let i = 0; i < months; i++) bal = bal * (1 + r) + monthly;
    return bal;
  }
  function updateEduSimulator() {
    const incomeEl = document.getElementById('educationIncome');
    const income = parseEduMoney(incomeEl ? incomeEl.value : 0);
    const needs = income * 0.5;
    const wants = income * 0.3;
    const goals = income * 0.2;
    const elN = document.getElementById('educationNeeds');
    const elW = document.getElementById('educationWants');
    const elG = document.getElementById('educationGoals');
    if (elN) elN.textContent = fmtEduMoney(needs);
    if (elW) elW.textContent = fmtEduMoney(wants);
    if (elG) elG.textContent = fmtEduMoney(goals);
    const results = document.getElementById('educationSimResults');
    if (results) results.hidden = false;

    // Chart
    const canvas = document.getElementById('eduSimChart');
    if (canvas && typeof window.Chart !== 'undefined') {
      if (eduSimChart) eduSimChart.destroy();
      eduSimChart = new window.Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Necessidades 50%', 'Desejos 30%', 'Poupança 20%'],
          datasets: [{ data: [needs || 1, wants || 1, goals || 1], backgroundColor: ['#0066FF', '#F2A900', '#22C55E'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.label + ': ' + fmtEduMoney(c.parsed) } } }
        }
      });
    }

    // Reality comparison
    const panel = document.getElementById('eduRealityPanel');
    const alerts = document.getElementById('eduSimAlerts');
    if (panel && !panel.hidden && alerts) {
      const rn = parseEduMoney(document.getElementById('eduRealNeeds')?.value);
      const rw = parseEduMoney(document.getElementById('eduRealWants')?.value);
      const rs = parseEduMoney(document.getElementById('eduRealSave')?.value);
      const msgs = [];
      if (income > 0) {
        if (rn / income > 0.5) msgs.push({ t: 'warn', m: '⚠️ Seus gastos essenciais estão acima da referência de 50%.' });
        if (rw / income > 0.3) msgs.push({ t: 'tip', m: '💡 Seus gastos com desejos estão acima da referência de 30%.' });
        if (rs / income < 0.2) msgs.push({ t: 'tip', m: '🎯 Você está destinando menos que a referência de 20% para objetivos financeiros.' });
        if (!msgs.length) msgs.push({ t: 'ok', m: '✅ Sua distribuição está alinhada à referência orientativa 50-30-20.' });
      }
      alerts.innerHTML = msgs.map(x => `<div class="edu-alert ${x.t}">${x.m}</div>`).join('');
    }

    // Projection
    const taxa = parseFloat(document.getElementById('eduProjTaxa')?.value) || 8;
    const monthlySave = goals;
    const setP = (id, m) => { const el = document.getElementById(id); if (el) el.textContent = fmtEduMoney(projectMonthly(monthlySave, m, taxa)); };
    setP('eduProj1', 12); setP('eduProj3', 36); setP('eduProj5', 60); setP('eduProj10', 120);

    // Content recommendations
    const recs = document.getElementById('eduSimRecs');
    if (recs) {
      const tips = [];
      if (income > 0) {
        tips.push('Conecte o simulador ao aprendizado: revise a trilha de <strong>Orçamento inteligente</strong>.');
        if (goals < income * 0.15) tips.push('Poupança baixa? Estude <strong>Reserva de emergência</strong> e o quiz 50-30-20.');
      }
      recs.innerHTML = tips.join('<br>') || '';
    }
  }

  function initEducation() {
    renderEducation();

    // Lógica Helper para abrir e fechar modais da Educação
    const wireEduModal = (btnId, modalId, closeId) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      const closeBtn = document.getElementById(closeId);

      if (btn && modal) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          modal.style.display = 'flex';
          modal.classList.add('active', 'show');
          if (typeof refreshIcons === 'function') refreshIcons();
        });
      }

      if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
          modal.classList.remove('active', 'show');
        });
      }

      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('active', 'show');
          }
        });
      }
    };

    wireEduModal('btnViewPhases', 'eduPhasesModal', 'closeEduPhasesModal');
    wireEduModal('btnOpenTrilhas', 'modalEduTrilhas', 'closeEduTrilhas');
    wireEduModal('btnOpenQuizzes', 'modalEduQuizzes', 'closeEduQuizzes');
    wireEduModal('btnOpenPdf', 'modalEduPdf', 'closeEduPdf');
    wireEduModal('btnOpenSimulador', 'modalEduSimulador', 'closeEduSimulador');

    // Busca em tempo real
    const searchInput = document.getElementById('eduSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        eduSearchQuery = e.target.value || '';
        renderEducation();
      });
    }

    // Tabs e Filtros da Educação
    const lf = document.getElementById('eduLevelFilters');
    if (lf) {
      lf.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-edu-level], [data-edu-view]');
        if (!btn) return;
        lf.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.eduView;
        const level = btn.dataset.eduLevel;

        if (level && level !== 'pdf') {
          eduLevelFilter = level;
        }

        const coursesGrid = document.getElementById('educationCourses');
        const pdfLib = document.getElementById('eduPdfLibrary');
        const quizHub = document.getElementById('eduQuizHub');
        const simCard = document.getElementById('eduSimulatorCard');

        if (view === 'trilhas') {
          if (coursesGrid) coursesGrid.style.display = 'grid';
          if (pdfLib) pdfLib.style.display = 'none';
          if (quizHub) quizHub.style.display = 'none';
          if (simCard) simCard.style.display = 'none';
        } else if (view === 'quizzes') {
          if (coursesGrid) coursesGrid.style.display = 'none';
          if (pdfLib) pdfLib.style.display = 'none';
          if (quizHub) quizHub.style.display = 'block';
          if (simCard) simCard.style.display = 'none';
        } else if (view === 'pdf' || level === 'pdf') {
          if (coursesGrid) coursesGrid.style.display = 'none';
          if (pdfLib) pdfLib.style.display = 'block';
          if (quizHub) quizHub.style.display = 'none';
          if (simCard) simCard.style.display = 'none';
          if (pdfLib) pdfLib.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (view === 'simulador') {
          if (coursesGrid) coursesGrid.style.display = 'none';
          if (pdfLib) pdfLib.style.display = 'none';
          if (quizHub) quizHub.style.display = 'none';
          if (simCard) simCard.style.display = 'block';
          if (simCard) simCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // view === 'all'
          if (coursesGrid) coursesGrid.style.display = 'grid';
          if (pdfLib) pdfLib.style.display = 'block';
          if (quizHub) quizHub.style.display = 'block';
          if (simCard) simCard.style.display = 'block';
        }

        renderEducation();
      });
    }
    const quizSel = document.getElementById('eduQuizLevelSelect');
    if (quizSel) quizSel.addEventListener('change', renderEduQuizList);
    const quizNext = document.getElementById('eduQuizNext');
    if (quizNext) quizNext.addEventListener('click', () => {
      if (!currentQuiz) return;
      if (currentQuizIndex + 1 >= currentQuiz.questions.length) finishEduQuiz();
      else { currentQuizIndex++; showEduQuizQuestion(); }
    });
    const quizExit = document.getElementById('eduQuizExit');
    if (quizExit) quizExit.addEventListener('click', () => {
      currentQuiz = null;
      document.getElementById('eduQuizPlayer').hidden = true;
      document.getElementById('eduQuizList').hidden = false;
    });
    const aiRef = document.getElementById('eduAiRefresh');
    if (aiRef) aiRef.addEventListener('click', () => { renderEduAiInsight(); showToast('Insight atualizado'); });

    // Challenge do dia (existente)
    const answers = document.querySelectorAll('#educationChallengeAnswers .education-answer');
    const data = getEducationData();
    if (data.challengeDone) {
      answers.forEach(btn => btn.disabled = true);
      const correct = document.querySelector('#educationChallengeAnswers .education-answer[data-correct="true"]');
      if (correct) correct.classList.add('correct');
      const feedback = document.getElementById('educationChallengeFeedback');
      if (feedback) feedback.innerHTML = '<strong style="color:#22C55E">Desafio já concluído hoje.</strong>';
    } else {
      answers.forEach(btn => {
        btn.addEventListener('click', () => {
          if (getEducationData().challengeDone) return;
          answers.forEach(b => b.disabled = true);
          const isCorrect = btn.dataset.correct === 'true';
          answers.forEach(b => {
            if (b.dataset.correct === 'true') b.classList.add('correct');
            else if (b === btn) b.classList.add('wrong');
          });
          const feedback = document.getElementById('educationChallengeFeedback');
          if (isCorrect) {
            const d = getEducationData();
            d.challengeDone = true;
            d.points += 20;
            unlockAchievements(d);
            saveEducationData(d);
            if (feedback) feedback.innerHTML = '<strong style="color:#22C55E">✅ Correto!</strong> Reservar parte da renda, conforme o orçamento, é a base da reserva. +20 XP';
            showToast('Desafio concluído! +20 XP');
            updateEducationProgress();
            renderEduAchievements();
          } else {
            if (feedback) feedback.innerHTML = '<strong style="color:#EF4444">❌ Não é o ideal.</strong> O mais adequado é destinar uma parte planejada da renda para reserva, não esperar sobrar “por acaso”.';
          }
        });
      });
    }

    // Simulator realtime
    const incomeEl = document.getElementById('educationIncome');
    if (incomeEl) {
      incomeEl.addEventListener('input', updateEduSimulator);
      incomeEl.addEventListener('change', updateEduSimulator);
    }
    const oldBtn = document.getElementById('educationSimulateBtn');
    if (oldBtn) oldBtn.addEventListener('click', updateEduSimulator);
    ['eduRealNeeds','eduRealWants','eduRealSave','eduProjTaxa'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateEduSimulator);
    });
    const tog = document.getElementById('eduToggleReality');
    if (tog) tog.addEventListener('click', () => {
      const panel = document.getElementById('eduRealityPanel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      updateEduSimulator();
    });
    updateEduSimulator();

    const insightBtn = document.getElementById('educationInsightBtn');
    if (insightBtn) insightBtn.addEventListener('click', () => {
      const d = (typeof despesas !== 'undefined') ? despesas : [];
      const r = (typeof receitas !== 'undefined') ? receitas : [];
      const income = r.reduce((s,x)=>s+Number(x.valor||0),0);
      const expense = d.reduce((s,x)=>s+Number(x.valor||0),0);
      const title = document.getElementById('educationInsightTitle');
      const text = document.getElementById('educationInsightText');
      if (income && expense > income) {
        if(title) title.textContent='Priorize o equilíbrio';
        if(text) text.textContent='Se as despesas estão acima das receitas, o primeiro passo é reduzir gastos e reorganizar o orçamento antes de pensar em aumentar o risco.';
      } else if (income && expense / income > .8) {
        if(title) title.textContent='Aumente sua margem';
        if(text) text.textContent='Seu orçamento parece apertado. Procure criar uma margem mensal antes de acelerar metas e investimentos.';
      } else {
        if(title) title.textContent='Você tem espaço para avançar';
        if(text) text.textContent='Com uma margem positiva, você pode direcionar parte dela para reserva, metas e investimentos de acordo com seus objetivos.';
      }
    });
  }

  // script.js já executa dentro do callback principal de DOMContentLoaded.
  // Registrar outro listener aqui faria a tela permanecer sem trilhas/quizzes.
  initEducation();



/* =========================================================
   NOTIFICAÇÕES — painel funcional e indicador de não lidas
   ========================================================= */
(function initNotifications(){
  const STORAGE_KEY = 'prisma_notifications_v2';
  const button = document.getElementById('notificationBtn') || document.querySelector('.notification-btn');
  const panel = document.getElementById('notificationsPanel');
  const list = document.getElementById('notificationsList');
  const empty = document.getElementById('notificationsEmpty');
  const summary = document.getElementById('notificationsSummary');
  const markRead = document.getElementById('markNotificationsRead');
  let currentView = 'active';
  let toolbar;
  let activeTab;
  let trashTab;
  let clearTrashButton;
  let trashList;
  let trashEmpty;

  function readState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const notifications = Array.isArray(parsed.notifications) ? parsed.notifications.filter((item) => item && typeof item === 'object') : [];
      return { notifications };
    } catch(e) {
      console.error('Falha ao carregar as notificações:', e);
      if (typeof window.showToast === 'function') window.showToast('Não foi possível carregar as notificações salvas.');
      return null;
    }
  }
  function saveState(state){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (typeof scheduleServerSync === 'function') scheduleServerSync();
      return true;
    } catch(e) {
      console.error('Falha ao salvar as notificações:', e);
      if (typeof window.showToast === 'function') window.showToast('Não foi possível salvar a alteração das notificações.');
      return false;
    }
  }
  function unreadCount(state){ return state.notifications.filter(n => !n.deletedAt && !n.read).length; }
  function escapeHTML(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function relativeDate(value){
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Math.max(0, Date.now()-d.getTime());
    const mins=Math.floor(diff/60000), hours=Math.floor(diff/3600000), days=Math.floor(diff/86400000);
    if(mins<1) return 'agora'; if(mins<60) return `há ${mins} min`; if(hours<24) return `há ${hours}h`; if(days<7) return `há ${days}d`;
    return d.toLocaleDateString('pt-BR');
  }
  function exactDate(value){
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
  }
  function renderItems(items, isDeleted){
    return items.map((n) => {
      const id = escapeHTML(n.id);
      const type = escapeHTML(n.type || 'info');
      const date = exactDate(n.date || n.createdAt);
      const actions = isDeleted
        ? `<button type="button" class="notification-action" data-notification-action="restore" data-notification-id="${id}" aria-label="Restaurar ${escapeHTML(n.title || 'notificação')}">Restaurar</button><button type="button" class="notification-action danger" data-notification-action="delete" data-notification-id="${id}" aria-label="Excluir definitivamente ${escapeHTML(n.title || 'notificação')}">Excluir</button>`
        : `<button type="button" class="notification-action" data-notification-action="dismiss" data-notification-id="${id}" aria-label="Mover ${escapeHTML(n.title || 'notificação')} para a lixeira">Dispensar</button>`;
      return `<article class="notification-item ${n.read ? 'read' : 'unread'} notification-type-${type}" data-notification-id="${id}" ${isDeleted ? 'data-deleted="true"' : ''}>
        <span class="notification-item-icon"><i data-lucide="${escapeHTML(n.icon || 'bell')}"></i></span>
        <span class="notification-item-content"><strong>${escapeHTML(n.title || 'Notificação')}</strong><span>${escapeHTML(n.message || '')}</span><small>${escapeHTML(date)}${!isDeleted && date ? ` · ${relativeDate(n.date || n.createdAt)}` : ''}${isDeleted && n.deletedAt ? ` · Excluída ${escapeHTML(exactDate(n.deletedAt))}` : ''}</small>
        <span class="notification-item-actions">${actions}</span></span>${!n.read && !isDeleted ? '<span class="notification-unread-dot" aria-label="Não lida"></span>' : ''}
      </article>`;
    }).join('');
  }
  function setupControls(){
    if (!panel || !list || toolbar) return;

    toolbar = document.createElement('div');
    toolbar.className = 'notifications-toolbar';
    toolbar.setAttribute('role', 'tablist');
    toolbar.setAttribute('aria-label', 'Visualização de notificações');

    activeTab = document.createElement('button');
    activeTab.type = 'button';
    activeTab.className = 'notifications-tab';
    activeTab.setAttribute('role', 'tab');
    activeTab.addEventListener('click', () => { currentView = 'active'; updateUI(); });

    trashTab = document.createElement('button');
    trashTab.type = 'button';
    trashTab.className = 'notifications-tab';
    trashTab.setAttribute('role', 'tab');
    trashTab.addEventListener('click', () => { currentView = 'trash'; updateUI(); });

    clearTrashButton = document.createElement('button');
    clearTrashButton.type = 'button';
    clearTrashButton.className = 'notifications-clear-trash';
    clearTrashButton.textContent = 'Esvaziar lixeira';
    clearTrashButton.addEventListener('click', () => {
      const state = readState();
      if (!state || !state.notifications.some((n) => n.deletedAt)) return;
      if (!window.confirm('Excluir permanentemente todas as notificações da lixeira? Esta ação não pode ser desfeita.')) return;
      state.notifications = state.notifications.filter((n) => !n.deletedAt);
      if (saveState(state)) {
        updateUI();
        if (typeof window.showToast === 'function') window.showToast('Lixeira esvaziada.');
      }
    });

    toolbar.append(activeTab, trashTab, clearTrashButton);
    panel.insertBefore(toolbar, list);

    trashList = document.createElement('div');
    trashList.className = 'notifications-list';
    trashList.id = 'notificationsTrashList';
    trashList.hidden = true;
    trashList.setAttribute('aria-label', 'Notificações na lixeira');
    panel.insertBefore(trashList, empty);

    trashEmpty = document.createElement('div');
    trashEmpty.className = 'notifications-empty';
    trashEmpty.hidden = true;
    trashEmpty.innerHTML = '<i data-lucide="trash-2"></i><strong>Lixeira vazia</strong><span>Notificações dispensadas aparecerão aqui.</span>';
    panel.appendChild(trashEmpty);
  }
  function updateUI(){
    setupControls();
    const state=readState();
    if (!state) return;
    const active = state.notifications.filter((n) => !n.deletedAt);
    const trashed = state.notifications.filter((n) => Boolean(n.deletedAt));
    const unread=unreadCount(state);
    if(button){
      button.classList.toggle('has-unread',unread>0);
      button.setAttribute('aria-label',unread ? `Notificações, ${unread} não lida${unread===1?'':'s'}` : 'Notificações');
      button.setAttribute('aria-expanded', panel && !panel.hidden ? 'true':'false');
      const dot=button.querySelector('.notification-dot');
      if(dot){
        dot.hidden=unread===0;
        dot.textContent=unread>9?'9+':String(unread);
      }
    }
    if(summary) summary.textContent=currentView === 'trash'
      ? `${trashed.length} ${trashed.length===1?'notificação':'notificações'} na lixeira`
      : unread ? `${unread} não lida${unread===1?'':'s'} · ${active.length} ${active.length===1?'notificação':'notificações'}` : `${active.length} ${active.length===1?'notificação':'notificações'} · nenhuma nova`;
    if(list){
      list.innerHTML=renderItems(active, false);
      list.hidden=currentView !== 'active' || !active.length;
    }
    if(empty) {
      empty.hidden=currentView !== 'active' || active.length > 0;
      const title=empty.querySelector('strong');
      const message=empty.querySelector('span');
      if(title) title.textContent='Tudo em dia';
      if(message) message.textContent='Você não tem notificações novas.';
    }
    if(trashList) {
      trashList.innerHTML=renderItems(trashed, true);
      trashList.hidden=currentView !== 'trash' || !trashed.length;
    }
    if(trashEmpty) trashEmpty.hidden=currentView !== 'trash' || trashed.length > 0;
    if(activeTab && trashTab && toolbar) {
      activeTab.textContent=`Notificações (${active.length})`;
      trashTab.textContent=`Lixeira (${trashed.length})`;
      activeTab.setAttribute('aria-selected', String(currentView === 'active'));
      trashTab.setAttribute('aria-selected', String(currentView === 'trash'));
      activeTab.tabIndex=currentView === 'active' ? 0 : -1;
      trashTab.tabIndex=currentView === 'trash' ? 0 : -1;
      clearTrashButton.hidden=currentView !== 'trash';
      clearTrashButton.disabled=trashed.length === 0;
    }
    if(markRead) {
      markRead.disabled=unread===0 || currentView !== 'active';
      markRead.hidden=currentView !== 'active';
    }
    if(window.lucide) window.lucide.createIcons();
  }
  function openPanel(){
    if(!panel) return;
    panel.hidden=false; panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
    if(button) button.setAttribute('aria-expanded','true');
    updateUI();
  }
  function closePanel(){
    if(!panel) return;
    panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); panel.hidden=true;
    if(button) button.setAttribute('aria-expanded','false');
  }
  function markAllRead(){
    const state=readState(); if(!state)return;
    state.notifications=state.notifications.map(n=>n.deletedAt ? n : {...n,read:true});
    if(saveState(state)) updateUI();
  }
  function markOneRead(id){
    const state=readState(); if(!state)return;
    state.notifications=state.notifications.map(n=>String(n.id)===String(id)&&!n.deletedAt?{...n,read:true}:n);
    if(saveState(state)) updateUI();
  }
  function addNotification(notification){
    const state=readState(); if(!state)return;
    const item={id:notification?.id||`n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,title:notification?.title||'Nova notificação',message:notification?.message||'',date:notification?.date||new Date().toISOString(),icon:notification?.icon||'bell',read:false};
    if(state.notifications.some(n=>String(n.id)===String(item.id))) return;
    state.notifications=[item,...state.notifications].slice(0,100);
    if(saveState(state)) updateUI();
  }
  function updateNotification(id, operation){
    const state=readState(); if(!state)return;
    const target=state.notifications.find((n)=>String(n.id)===String(id));
    if(!target)return;
    if(operation==='dismiss') {
      if(target.deletedAt)return;
      target.deletedAt=new Date().toISOString();
    } else if(operation==='restore') {
      if(!target.deletedAt)return;
      delete target.deletedAt;
    } else if(operation==='delete') {
      if(!target.deletedAt || !window.confirm('Excluir permanentemente esta notificação? Esta ação não pode ser desfeita.'))return;
      state.notifications=state.notifications.filter((n)=>String(n.id)!==String(id));
    }
    if(saveState(state)) {
      updateUI();
      if (typeof window.showToast === 'function') {
        window.showToast(operation==='dismiss' ? 'Notificação movida para a lixeira.' : operation==='restore' ? 'Notificação restaurada.' : 'Notificação excluída definitivamente.');
      }
    }
  }
  if(button){ button.addEventListener('click',e=>{
    e.stopPropagation();
    if (window.PrismaNavbar) window.PrismaNavbar.toggle('notifications');
    else if(panel?.hidden) openPanel();
    else closePanel();
  }); }
  if(markRead) markRead.addEventListener('click',e=>{e.preventDefault();markAllRead();});
  if(list) list.addEventListener('click',e=>{
    const action=e.target.closest('[data-notification-action]');
    if(action) {
      e.preventDefault();
      e.stopPropagation();
      updateNotification(action.dataset.notificationId, action.dataset.notificationAction);
      return;
    }
    const item=e.target.closest('[data-notification-id]');
    if(item) markOneRead(item.dataset.notificationId);
  });
  if(panel) panel.addEventListener('click',e=>{
    const action=e.target.closest('[data-notification-action]');
    if(!action || !trashList?.contains(action))return;
    e.preventDefault();
    e.stopPropagation();
    updateNotification(action.dataset.notificationId, action.dataset.notificationAction);
  });
  window.PrismaNotifications={getState:readState,add:addNotification,markAllRead,refresh:updateUI,_open:openPanel,_close:closePanel,open:()=>window.PrismaNavbar ? window.PrismaNavbar.open('notifications') : openPanel(),close:()=>window.PrismaNavbar ? window.PrismaNavbar.close('notifications') : closePanel(),moveToTrash:(id)=>updateNotification(id,'dismiss'),restore:(id)=>updateNotification(id,'restore'),deletePermanently:(id)=>updateNotification(id,'delete')};
  updateUI();
})();

/* =========================================================
   GERENCIADOR DE EXCLUSIVIDADE MÚTUA DA NAVBAR SUPERIOR
   ========================================================= */
(function initNavbarManager() {
  const searchBox = document.querySelector('.search-box');
  const searchInput = document.getElementById('globalSearchInput') || document.querySelector('.search-box input');
  const notificationBtn = document.getElementById('notificationBtn') || document.querySelector('.notification-btn');
  const notificationsPanel = document.getElementById('notificationsPanel');
  const mobileMenu = document.getElementById('mobileMenu') || document.querySelector('.mobile-menu');
  const profileBtn = document.getElementById('avatarDropdownBtn');
  const profileDropdown = document.getElementById('profileDropdown') || document.querySelector('.profile-menu');
  const sidebar = document.getElementById('sidebar');
  let activeMenu = null;
  const menuNames = ['notifications', 'profile', 'search', 'mobileMenu'];

  function setExpanded(control, expanded) {
    if (control) control.setAttribute('aria-expanded', String(expanded));
  }

  function closeMenu(menu, { restoreFocus = false } = {}) {
    if (menu === 'notifications') {
      if (window.PrismaNotifications?._close) window.PrismaNotifications._close();
      else if (notificationsPanel) {
        notificationsPanel.classList.remove('open');
        notificationsPanel.setAttribute('aria-hidden', 'true');
        notificationsPanel.hidden = true;
        setExpanded(notificationBtn, false);
      }
    } else if (menu === 'profile' && profileDropdown) {
      profileDropdown.classList.remove('active', 'show');
      profileDropdown.setAttribute('aria-hidden', 'true');
      setExpanded(profileBtn, false);
      if (profileBtn) profileBtn.setAttribute('aria-label', 'Abrir menu do perfil');
    } else if (menu === 'search') {
      if (searchInput) {
        searchInput.classList.remove('active');
        setExpanded(searchInput, false);
        if (document.activeElement === searchInput) searchInput.blur();
      }
      if (searchBox) searchBox.classList.remove('active');
      const results = document.getElementById('globalSearchResults');
      if (results) results.hidden = true;
    } else if (menu === 'mobileMenu' && sidebar) {
      sidebar.classList.remove('active', 'open');
      const sidebarOverlay = document.getElementById('sidebarOverlay');
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove('active');
        sidebarOverlay.style.display = 'none';
      }
      setExpanded(mobileMenu, false);
      if (typeof window.updateMobileMenuIcon === 'function') window.updateMobileMenuIcon();
    }

    if (restoreFocus) {
      const control = menu === 'notifications' ? notificationBtn
        : menu === 'profile' ? profileBtn
          : menu === 'mobileMenu' ? mobileMenu : null;
      if (control && typeof control.focus === 'function') control.focus();
    }
  }

  function openMenu(menu) {
    if (menu === 'notifications') {
      if (window.PrismaNotifications?._open) window.PrismaNotifications._open();
      else if (notificationsPanel) {
        notificationsPanel.hidden = false;
        notificationsPanel.classList.add('open');
        notificationsPanel.setAttribute('aria-hidden', 'false');
        setExpanded(notificationBtn, true);
      }
    } else if (menu === 'profile' && profileDropdown) {
      profileDropdown.style.removeProperty('display');
      profileDropdown.classList.add('show');
      profileDropdown.setAttribute('aria-hidden', 'false');
      setExpanded(profileBtn, true);
      if (profileBtn) profileBtn.setAttribute('aria-label', 'Fechar menu do perfil');
      if (typeof updateProfileDropdown === 'function') updateProfileDropdown();
    } else if (menu === 'search' && searchInput) {
      searchInput.classList.add('active');
      setExpanded(searchInput, true);
      if (searchBox) searchBox.classList.add('active');
    } else if (menu === 'mobileMenu' && sidebar) {
      sidebar.classList.add('open', 'active');
      const sidebarOverlay = document.getElementById('sidebarOverlay');
      if (sidebarOverlay) {
        sidebarOverlay.classList.add('active');
        sidebarOverlay.style.display = 'block';
      }
      setExpanded(mobileMenu, true);
      if (typeof window.updateMobileMenuIcon === 'function') window.updateMobileMenuIcon();
    }
  }

  function closeAllTopOverlays() {
    menuNames.forEach((menu) => closeMenu(menu));
    activeMenu = null;
  }

  function open(menu) {
    if (!menuNames.includes(menu)) throw new TypeError(`Menu superior desconhecido: ${menu}`);
    menuNames.filter((candidate) => candidate !== menu).forEach((candidate) => closeMenu(candidate));
    activeMenu = menu;
    openMenu(menu);
  }

  function close(menu, options = {}) {
    if (menu && !menuNames.includes(menu)) throw new TypeError(`Menu superior desconhecido: ${menu}`);
    if (menu && activeMenu && activeMenu !== menu) return;
    const target = menu || activeMenu;
    if (target) closeMenu(target, options);
    activeMenu = null;
  }

  function toggle(menu) {
    if (!menuNames.includes(menu)) throw new TypeError(`Menu superior desconhecido: ${menu}`);
    if (activeMenu === menu) close(menu);
    else open(menu);
  }

  window.PrismaNavbar = { get activeMenu() { return activeMenu; }, open, close, closeAll: closeAllTopOverlays, toggle };
  window.closeAllTopOverlays = closeAllTopOverlays;

  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      if (activeMenu !== 'search') open('search');
    });
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeMenu !== 'search') open('search');
    });
  }

  document.addEventListener('click', (e) => {
    if (!activeMenu) return;
    const target = e.target;
    const insideActiveMenu = activeMenu === 'notifications'
      ? notificationsPanel?.contains(target) || notificationBtn?.contains(target)
      : activeMenu === 'profile'
        ? profileDropdown?.contains(target) || profileBtn?.contains(target)
        : activeMenu === 'search'
          ? searchBox?.contains(target)
          : activeMenu === 'mobileMenu'
            ? sidebar?.contains(target) || mobileMenu?.contains(target)
            : false;
    if (!insideActiveMenu) {
      closeAllTopOverlays();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !activeMenu) return;
    e.preventDefault();
    const previousMenu = activeMenu;
    close(previousMenu, { restoreFocus: previousMenu !== 'search' });
  }, true);

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024 && activeMenu === 'mobileMenu') close('mobileMenu');
  });
})();

/* =========================================================
   Saldo Atual — carteira verde no positivo e vermelha no negativo
   ========================================================= */
function updateWalletColor(){
  const card=document.querySelector('#dashboard .stat-card');
  if(!card) return;
  const iconWrap=card.querySelector('.stat-icon');
  const icon=iconWrap?.querySelector('[data-lucide="wallet"], .lucide-wallet');
  const value=Number(saldoAtual)||0;
  const positive=value>=0;
  if(iconWrap){
    iconWrap.classList.remove('green','red','balance-positive','balance-negative');
    iconWrap.classList.add(positive?'green':'red',positive?'balance-positive':'balance-negative');
    iconWrap.setAttribute('aria-label',positive?'Saldo positivo':'Saldo negativo');
  }
  if(icon){ icon.classList.remove('balance-positive','balance-negative'); icon.classList.add(positive?'balance-positive':'balance-negative'); }
}
window.PrismaUpdateWalletColor=updateWalletColor;


/* Perfis cadastráveis — garante que cards dinâmicos acompanhem o conteúdo */

setTimeout(restoreSectionFromLocation, 0);

}); // end DOMContentLoaded

(function initAdaptiveProfileCards(){
  function normalizeProfileCards(){
    document.querySelectorAll('.profiles-grid .profile-card').forEach(card => {
      card.style.height = 'auto';
      card.style.minHeight = '0';
      card.style.overflow = 'visible';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeProfileCards, { once: true });
  } else {
    normalizeProfileCards();
  }

  let _profObsT = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(_profObsT);
    _profObsT = setTimeout(normalizeProfileCards, 200);
  });
  // Observa apenas a área de perfis quando existir; senão body com debounce
  const grid = document.querySelector('.profiles-grid');
  observer.observe(grid || document.body, { childList: true, subtree: true });
})();

/* =========================================================
   Auditoria de Usabilidade — camada de robustez
   ========================================================= */
(function initUsabilityGuards(){
  function normalize(){
    document.querySelectorAll('button').forEach(btn => {
      if (!btn.getAttribute('type')) btn.setAttribute('type','button');
      if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
        const icon = btn.querySelector('[data-lucide]');
        if (icon) btn.setAttribute('aria-label', icon.getAttribute('data-lucide') || 'Ação');
      }
    });
  }

  function closeTransientUI(){
    document.querySelectorAll(
      '.modal.show,.modal.active,.modal.open,' +
      '.dropdown.open,.dropdown.active,' +
      '.notification-panel.open,.notification-panel.active'
    ).forEach(el => {
      el.classList.remove('show','active','open');
      if (el.getAttribute('role') === 'dialog') el.setAttribute('aria-hidden','true');
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTransientUI();
  });

  document.addEventListener('click', e => {
    const dead = e.target.closest('a[href="#"]');
    if (dead) e.preventDefault();
  });

  normalize();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalize, {once:true});
  }
  let _usabT = 0;
  new MutationObserver(() => {
    clearTimeout(_usabT);
    _usabT = setTimeout(normalize, 300);
  }).observe(document.body, { childList: true, subtree: false });
})();
