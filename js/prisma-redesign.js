/* Prisma Redesign JS */
document.addEventListener('DOMContentLoaded', () => {
  // Botão do Menu na Navbar Superior (#mobileMenu)
  const mobileMenu = document.getElementById('mobileMenu');
  const sidebar = document.getElementById('sidebar');
  if (mobileMenu && sidebar && window.lucide) {
    lucide.createIcons();
  }

  // 17. INVESTIMENTOS - Agrupar por categorias
  const investmentsGrid = document.querySelector('#investimentos .investments-grid');
  if (investmentsGrid && !investmentsGrid.classList.contains('investment-portal-grid')) {
    const cards = Array.from(investmentsGrid.querySelectorAll('.invest-card'));
    
    // Define Categories
    const categories = {
      'Renda Fixa': ['tesouro', 'cdb'],
      'Renda Variável & FIIs': ['acoes', 'fii'],
      'Fundos & Cripto': ['cripto', 'multimercado']
    };

    // Store unassigned cards to avoid deleting them
    const processedCards = new Set();
    
    // Clear current grid
    investmentsGrid.innerHTML = '';
    investmentsGrid.style.display = 'block'; // Remove grid to stack categories

    for (const [catName, types] of Object.entries(categories)) {
      const catCards = cards.filter(card => types.includes(card.getAttribute('data-invest')));
      if (catCards.length > 0) {
        const catSection = document.createElement('div');
        catSection.className = 'invest-category-section';
        catSection.innerHTML = `<h3 class="invest-category-title">${catName}</h3><div class="investments-grid cat-grid"></div>`;
        const catGrid = catSection.querySelector('.cat-grid');
        
        catCards.forEach(card => {
          catGrid.appendChild(card);
          processedCards.add(card);
        });
        investmentsGrid.appendChild(catSection);
      }
    }

    // Append any leftover cards to an "Outros" category
    const leftoverCards = cards.filter(card => !processedCards.has(card));
    if (leftoverCards.length > 0) {
      const catSection = document.createElement('div');
      catSection.className = 'invest-category-section';
      catSection.innerHTML = `<h3 class="invest-category-title">Outros</h3><div class="investments-grid cat-grid"></div>`;
      const catGrid = catSection.querySelector('.cat-grid');
      leftoverCards.forEach(card => catGrid.appendChild(card));
      investmentsGrid.appendChild(catSection);
    }
  }

  // LÓGICA DAS BARRAS DEGRADÊ DINÂMICAS (Dashboard)
  const updateCardBars = () => {
    document.querySelectorAll('.stat-card').forEach(card => {
      const valueEl = card.querySelector('.stat-value');
      const labelEl = card.querySelector('.stat-label');
      if (!valueEl || !labelEl) return;
      
      const valueStr = valueEl.textContent || '';
      const labelStr = labelEl.textContent || '';
      
      let isNegative = false;
      let isPositive = false;
      
      // Se tiver sinal de menos real ou a label disser 'Dívida' ou 'Despesa'
      if (valueStr.includes('-') || labelStr.toLowerCase().includes('dívida')) {
        isNegative = true;
      } else if (valueStr.match(/[1-9]/)) { 
        isPositive = true;
      }
      
      card.classList.remove('bar-positive', 'bar-negative');
      if (isNegative) card.classList.add('bar-negative');
      else if (isPositive) card.classList.add('bar-positive');
    });
  };

  // Roda uma vez e depois escuta as mudanças que o script original do Prisma faz nos valores
  updateCardBars();
  const dashKpiRow = document.querySelector('.dash-kpi-row');
  if (dashKpiRow) {
    const observer = new MutationObserver(updateCardBars);
    observer.observe(dashKpiRow, { childList: true, subtree: true, characterData: true });
  }

  if (window.lucide) {
    lucide.createIcons();
  }
});
