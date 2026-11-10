/**
 * educacao-financeira-data.js
 * Fonte única de dados para os 12 módulos da Trilha de Educação Financeira.
 * Toda a interface é gerada a partir deste array — sem HTML manual.
 */
'use strict';

(function () {
  const TRILHA_MODULOS = [
    // ── NÍVEL INICIANTE ────────────────────────────────────────────────────
    {
      id: 'mod-01',
      numero: 1,
      nivel: 'iniciante',
      titulo: 'Orçamento Inteligente',
      subtitulo: 'Como organizar seu dinheiro de forma simples e prática',
      arquivo: 'assets/pdfs/educacao-financeira/01-orcamento-inteligente.pdf',
      cor: '#2563EB',
      // links "Aplicar no Prisma" apontam para seções reais da plataforma
      aplicarLinks: [
        { label: 'Lançar Receitas', section: 'receitas' },
        { label: 'Controlar Despesas', section: 'despesas' }
      ]
    },
    {
      id: 'mod-02',
      numero: 2,
      nivel: 'iniciante',
      titulo: 'Dívidas sob Controle',
      subtitulo: 'Estratégias para sair do vermelho com planejamento',
      arquivo: 'assets/pdfs/educacao-financeira/02-dividas-sob-controle.pdf',
      cor: '#DC2626',
      aplicarLinks: [
        { label: 'Ver Cartões', section: 'cartoes' },
        { label: 'Ver Despesas', section: 'despesas' }
      ]
    },
    {
      id: 'mod-03',
      numero: 3,
      nivel: 'iniciante',
      titulo: 'Reserva de Emergência',
      subtitulo: 'Proteja-se de imprevistos sem desorganizar as contas',
      arquivo: 'assets/pdfs/educacao-financeira/03-reserva-de-emergencia.pdf',
      cor: '#0D9488',
      aplicarLinks: [
        { label: 'Criar Meta de Reserva', section: 'metas' },
        { label: 'Ver Contas', section: 'contas' }
      ]
    },
    // ── NÍVEL INTERMEDIÁRIO ────────────────────────────────────────────────
    {
      id: 'mod-04',
      numero: 4,
      nivel: 'intermediario',
      titulo: 'Primeiros Passos para Investir',
      subtitulo: 'Risco, liquidez, diversificação e objetivos',
      arquivo: 'assets/pdfs/educacao-financeira/04-primeiros-passos-investir.pdf',
      cor: '#16A34A',
      aplicarLinks: [
        { label: 'Ver Investimentos', section: 'investimentos' },
        { label: 'Criar Meta', section: 'metas' }
      ]
    },
    {
      id: 'mod-05',
      numero: 5,
      nivel: 'intermediario',
      titulo: 'Cartão de Crédito',
      subtitulo: 'Use como ferramenta, evitando juros e perda de controle',
      arquivo: 'assets/pdfs/educacao-financeira/05-cartao-de-credito.pdf',
      cor: '#7C3AED',
      aplicarLinks: [
        { label: 'Gerenciar Cartões', section: 'cartoes' },
        { label: 'Ver Despesas', section: 'despesas' }
      ]
    },
    {
      id: 'mod-06',
      numero: 6,
      nivel: 'intermediario',
      titulo: 'Metas e Hábitos',
      subtitulo: 'Transforme objetivos financeiros em planos sustentáveis',
      arquivo: 'assets/pdfs/educacao-financeira/06-metas-e-habitos.pdf',
      cor: '#0891B2',
      aplicarLinks: [
        { label: 'Criar Metas', section: 'metas' },
        { label: 'Painel Financeiro', section: 'centro-financeiro' }
      ]
    },
    // ── NÍVEL AVANÇADO ─────────────────────────────────────────────────────
    {
      id: 'mod-07',
      numero: 7,
      nivel: 'avancado',
      titulo: 'Alocação de Ativos',
      subtitulo: 'Distribua o patrimônio conforme objetivo, prazo e risco',
      arquivo: 'assets/pdfs/educacao-financeira/07-alocacao-de-ativos.pdf',
      cor: '#4F46E5',
      aplicarLinks: [
        { label: 'Ver Carteira', section: 'investimentos' },
        { label: 'Analisar Finanças', section: 'prisma-ai' }
      ]
    },
    {
      id: 'mod-08',
      numero: 8,
      nivel: 'avancado',
      titulo: 'Renda Fixa Avançada',
      subtitulo: 'Juros reais, marcação a mercado e comparação de títulos',
      arquivo: 'assets/pdfs/educacao-financeira/08-renda-fixa-avancada.pdf',
      cor: '#A21CAF',
      aplicarLinks: [
        { label: 'Ver Investimentos', section: 'investimentos' },
        { label: 'Relatório Financeiro', section: 'relatorios' }
      ]
    },
    {
      id: 'mod-09',
      numero: 9,
      nivel: 'avancado',
      titulo: 'Ações e Fundos Imobiliários',
      subtitulo: 'Análise, risco e disciplina em ativos de renda variável',
      arquivo: 'assets/pdfs/educacao-financeira/09-acoes-e-fiis.pdf',
      cor: '#EA580C',
      aplicarLinks: [
        { label: 'Ver Carteira de Ativos', section: 'investimentos' },
        { label: 'Prisma AI', section: 'prisma-ai' }
      ]
    },
    {
      id: 'mod-10',
      numero: 10,
      nivel: 'avancado',
      titulo: 'Impostos sobre Investimentos',
      subtitulo: 'Pague o que deve, sem pagar a mais',
      arquivo: 'assets/pdfs/educacao-financeira/10-impostos-sobre-investimentos.pdf',
      cor: '#65A30D',
      aplicarLinks: [
        { label: 'Ver Investimentos', section: 'investimentos' },
        { label: 'Relatório Financeiro', section: 'relatorios' }
      ]
    },
    {
      id: 'mod-11',
      numero: 11,
      nivel: 'avancado',
      titulo: 'Proteção e Previdência',
      subtitulo: 'Proteja renda, família e patrimônio contra eventos de alto impacto',
      arquivo: 'assets/pdfs/educacao-financeira/11-protecao-e-previdencia.pdf',
      cor: '#CA8A04',
      aplicarLinks: [
        { label: 'Criar Meta de Previdência', section: 'metas' },
        { label: 'Prisma AI', section: 'prisma-ai' }
      ]
    },
    {
      id: 'mod-12',
      numero: 12,
      nivel: 'avancado',
      titulo: 'Independência Financeira',
      subtitulo: 'Planeje o patrimônio que sustenta o seu estilo de vida',
      arquivo: 'assets/pdfs/educacao-financeira/12-independencia-financeira.pdf',
      cor: '#E11D48',
      aplicarLinks: [
        { label: 'Painel Completo', section: 'dashboard' },
        { label: 'Prisma AI', section: 'prisma-ai' }
      ]
    }
  ];

  // Expor globalmente
  window.TRILHA_MODULOS = TRILHA_MODULOS;
})();
