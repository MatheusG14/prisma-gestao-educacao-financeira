/**
 * Sistema de Carregamento Dinâmico de Telas - Prisma
 * Carrega telas sob demanda para melhorar performance
 */

const ScreenNavigator = {
  currentScreen: 'dashboard',
  screenCache: new Map(),
  
  // Mapeamento de telas para seus arquivos HTML
  screenPaths: {
    'dashboard': 'telas/dashboard.html',
    'centro-financeiro': 'telas/centro-financeiro.html',
    'receitas': 'telas/receitas.html',
    'despesas': 'telas/despesas.html',
    'contas': 'telas/contas.html',
    'cartoes': 'telas/cartoes.html',
    'metas': 'telas/metas.html',
    'investimentos': 'telas/investimentos.html',
    'carteira-ativos': 'telas/carteira-ativos.html',
    'educacao-financeira': 'telas/educacao-financeira.html',
    'relatorios': 'telas/relatorios.html',
    'prisma-ai': 'telas/prisma-ai.html',
    'dados': 'telas/perfil.html',
    'configuracoes': 'telas/configuracoes.html',
    'admin': 'telas/admin.html'
  },
  
  /**
   * Carrega uma tela específica (Navegação Unificada)
   */
  async loadScreen(screenId, forceReload = false) {
    if (!screenId) return;

    if (typeof window.navigateToSection === 'function') {
      window.navigateToSection(screenId);
      this.currentScreen = screenId;
      this.dispatchEvent('screenChanged', { screenId });
      return;
    }

    // Fallback de contingência
    const existingSection = document.getElementById(screenId);
    if (existingSection) {
      document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
        s.style.display = '';
      });
      existingSection.classList.add('active');
      this.updateNavigation(screenId);
      this.currentScreen = screenId;
      try {
        if (screenId === 'dados' && typeof renderProfiles === 'function') renderProfiles();
        if (screenId === 'investimentos' && typeof renderInvestimentos === 'function') renderInvestimentos();
        if (screenId === 'metas' && typeof renderGoals === 'function') renderGoals();
      } catch (err) {
        console.warn('Atualização de tela:', err);
      }
      this.dispatchEvent('screenChanged', { screenId });
      return;
    }

    // 2. Se a seção não está no DOM, limpa cache se necessário
    if (forceReload && this.screenCache.has(screenId)) {
      this.screenCache.delete(screenId);
    }
    
    // Se já está carregada no cache e não está forçando recarregamento, retorna do cache
    if (!forceReload && this.screenCache.has(screenId)) {
      this.renderScreen(screenId, this.screenCache.get(screenId));
      return;
    }
    
    const screenPath = this.screenPaths[screenId];
    if (!screenPath) {
      console.error(`Tela não encontrada: ${screenId}`);
      return;
    }
    
    try {
      const timestamp = new Date().getTime();
      const urlWithCacheBuster = `${screenPath}?v=${timestamp}`;
      
      const response = await fetch(urlWithCacheBuster);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      this.screenCache.set(screenId, html);
      this.renderScreen(screenId, html);
      
    } catch (error) {
      console.warn(`Aviso ao carregar arquivo de tela ${screenId}:`, error);
      // Se houver elemento no DOM, tenta ativá-lo como fallback
      if (existingSection) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        existingSection.classList.add('active');
        this.updateNavigation(screenId);
      }
    }
  },
  
  /**
   * Renderiza a tela no DOM
   */
  renderScreen(screenId, html) {
    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;
    
    // Remover classe active da tela anterior
    const previousScreen = document.querySelector('.section.active');
    if (previousScreen) {
      previousScreen.classList.remove('active');
    }
    
    // Inserir novo conteúdo
    pageContent.innerHTML = html;
    
    // Adicionar classe active à nova tela
    const newScreen = document.querySelector(`#${screenId}`);
    if (newScreen) {
      newScreen.classList.add('active');
    }
    
    // Atualizar navegação sidebar
    this.updateNavigation(screenId);
    
    // Recarregar ícones Lucide
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
    
    // Atualizar estado atual
    this.currentScreen = screenId;
    
    // Disparar evento de troca de tela
    this.dispatchEvent('screenChanged', { screenId });
  },
  
  /**
   * Atualiza a navegação na sidebar
   */
  updateNavigation(screenId) {
    // Remover classe active de todos os itens
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Adicionar classe active ao item atual
    const activeItem = document.querySelector(`[data-section="${screenId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  },
  
  /**
   * Sistema de eventos simples
   */
  eventListeners: {},
  
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  },
  
  dispatchEvent(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  },
  
  /**
   * Pré-carrega telas comuns para melhorar performance
   */
  async preloadCommonScreens() {
    const commonScreens = ['dashboard', 'receitas', 'despesas', 'contas'];
    
    for (const screenId of commonScreens) {
      if (!this.screenCache.has(screenId)) {
        try {
          const screenPath = this.screenPaths[screenId];
          const response = await fetch(screenPath);
          const html = await response.text();
          this.screenCache.set(screenId, html);
        } catch (error) {
          console.warn(`Não foi possível pré-carregar ${screenId}:`, error);
        }
      }
    }
  },
  
  /**
   * Limpa o cache de telas (útil para liberar memória)
   */
  clearCache() {
    this.screenCache.clear();
  },
  
  /**
   * Força recarregamento de uma tela específica
   */
  async reloadScreen(screenId) {
    if (this.screenCache.has(screenId)) {
      this.screenCache.delete(screenId);
    }
    await this.loadScreen(screenId, true);
  },
  
  /**
   * Força recarregamento da tela atual
   */
  async reloadCurrentScreen() {
    await this.reloadScreen(this.currentScreen);
  }
};

// Inicializar navegação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Captura global de navegação por qualquer elemento com data-section
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-section], [data-target-section], .nav-item');
    if (el) {
      const screenId = el.getAttribute('data-section') || el.getAttribute('data-target-section');
      if (screenId && document.getElementById(screenId)) {
        e.preventDefault();
        ScreenNavigator.loadScreen(screenId);
      }
    }
  });

  // Expor globalmente para uso no script principal
  window.ScreenNavigator = ScreenNavigator;
});