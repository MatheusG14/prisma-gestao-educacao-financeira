/**
 * Prisma — Central de Monitoramento Financeiro & Gastos e Receitas
 * Motor puro de regras para alertas de receitas e insights financeiros.
 * Compatível com Node.js (testes automatizados) e Browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./prisma-finance-engine.js'));
  } else {
    root.PrismaMonitoringCenter = factory(root.PrismaFinance || root._PrismaFinanceEngine);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PrismaFinance) {
  'use strict';

  function parseDateSafe(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
    const s = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parts = s.split('T')[0].split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const parts = s.split('/');
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatBRL(v) {
    const n = Number(v) || 0;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getMoney(v) {
    if (PrismaFinance && typeof PrismaFinance.money === 'function') {
      return PrismaFinance.money(v);
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (!v) return 0;
    const s = String(v).replace(/[R$\s]/g, '').trim();
    const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }

  const PrismaMonitoringCenter = {
    parseDateSafe,
    formatBRL,

    /**
     * Gera alertas reais de receitas com base em regras de negócio consistentes.
     * Não gera dados fictícios.
     *
     * @param {Object} params
     * @param {Array} params.receitas - Lista de receitas cadastradas
     * @param {Date|string} [params.referenceDate] - Data de referência (default: hoje)
     * @param {Array} [params.dismissedAlertIds] - IDs de alertas já dispensados
     * @param {Array} [params.previousReceitas] - Receitas do período anterior para comparação
     */
    generateRevenueAlerts({
      receitas = [],
      referenceDate = null,
      dismissedAlertIds = [],
      previousReceitas = []
    } = {}) {
      const now = referenceDate ? (parseDateSafe(referenceDate) || new Date()) : new Date();
      now.setHours(0, 0, 0, 0);

      const dismissedSet = new Set(dismissedAlertIds || []);
      const alerts = [];

      const list = Array.isArray(receitas) ? receitas : [];
      let totalPendente = 0;
      let totalRealizado = 0;
      let countAtrasadas = 0;

      list.forEach((rec, idx) => {
        if (!rec) return;
        const val = getMoney(rec.valor);
        if (val <= 0) return;

        const isPaid = String(rec.status || '').toLowerCase() === 'paid' || rec.pago === true;
        const desc = rec.descricao || rec.origem || 'Receita sem descrição';
        const recDate = parseDateSafe(rec.data);
        const idBase = rec.id != null ? String(rec.id) : `rec_idx_${idx}`;

        if (isPaid) {
          totalRealizado += val;
          return;
        }

        totalPendente += val;

        if (recDate) {
          recDate.setHours(0, 0, 0, 0);
          const diffMs = recDate.getTime() - now.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          // 1. Receita Atrasada (data no passado e não recebida)
          if (diffDays < 0) {
            countAtrasadas++;
            const daysAgo = Math.abs(diffDays);
            const alertId = `alert_revenue_overdue_${idBase}`;
            alerts.push({
              id: alertId,
              tipo: 'receita_atrasada',
              prioridade: 'critica',
              prioridadeLabel: 'Urgente',
              titulo: `Receita em atraso: ${desc}`,
              problema: `A entrada de ${formatBRL(val)} prevista para ${rec.data || 'data anterior'} está atrasada há ${daysAgo} dia${daysAgo === 1 ? '' : 's'}.`,
              valor: val,
              dataReferencia: rec.data,
              diasDiferenca: diffDays,
              acaoRecomendada: 'Confira seu extrato bancário e atualize o status para recebido ou ajuste a data.',
              destinoTela: 'receitas',
              itemRef: rec,
              lido: dismissedSet.has(alertId)
            });
            return;
          }

          // 2. Receita com Vencimento Próximo (dentro dos próximos 5 dias)
          if (diffDays >= 0 && diffDays <= 5) {
            const alertId = `alert_revenue_upcoming_${idBase}`;
            const whenText = diffDays === 0 ? 'vence hoje' : diffDays === 1 ? 'vence amanhã' : `vence em ${diffDays} dias`;
            alerts.push({
              id: alertId,
              tipo: 'vencimento_proximo',
              prioridade: diffDays <= 1 ? 'alta' : 'media',
              prioridadeLabel: diffDays <= 1 ? 'Atenção' : 'Aviso',
              titulo: `Receita prevista (${whenText}): ${desc}`,
              problema: `Entrada de ${formatBRL(val)} programada para ${rec.data} (${whenText}).`,
              valor: val,
              dataReferencia: rec.data,
              diasDiferenca: diffDays,
              acaoRecomendada: 'Acompanhe a compensação na conta para manter a previsão financeira precisa.',
              destinoTela: 'receitas',
              itemRef: rec,
              lido: dismissedSet.has(alertId)
            });
            return;
          }

          // 3. Receita Futura Pendente (> 5 dias)
          const alertId = `alert_revenue_pending_${idBase}`;
          alerts.push({
            id: alertId,
            tipo: 'receita_futura',
            prioridade: 'info',
            prioridadeLabel: 'Informativo',
            titulo: `Receita programada: ${desc}`,
            problema: `Valor de ${formatBRL(val)} com previsão para ${rec.data}.`,
            valor: val,
            dataReferencia: rec.data,
            diasDiferenca: diffDays,
            acaoRecomendada: 'Previsão registrada. O saldo do fluxo contabilizará o valor após compensação.',
            destinoTela: 'receitas',
            itemRef: rec,
            lido: dismissedSet.has(alertId)
          });
        } else {
          // Sem data definida mas marcada como pendente
          const alertId = `alert_revenue_nodate_${idBase}`;
          alerts.push({
            id: alertId,
            tipo: 'receita_sem_data',
            prioridade: 'media',
            prioridadeLabel: 'Aviso',
            titulo: `Receita pendente sem data: ${desc}`,
            problema: `Valor de ${formatBRL(val)} cadastrado sem data de previsão definida.`,
            valor: val,
            dataReferencia: null,
            diasDiferenca: null,
            acaoRecomendada: 'Defina a data prevista de recebimento para melhorar a precisão do fluxo.',
            destinoTela: 'receitas',
            itemRef: rec,
            lido: dismissedSet.has(alertId)
          });
        }
      });

      // 4. Divergência relevante: grande volume de receitas pendentes vs realizadas em carteira com múltiplos lançamentos
      const totalGeral = totalRealizado + totalPendente;
      if (totalRealizado > 0 && totalPendente > 0 && (totalPendente / totalGeral) >= 0.5 && totalPendente >= 500 && list.length >= 3) {
        const pctPendente = Math.round((totalPendente / totalGeral) * 100);
        const alertId = 'alert_revenue_divergence_heavy_pending';
        alerts.push({
          id: alertId,
          tipo: 'divergencia_previsao',
          prioridade: countAtrasadas > 0 ? 'alta' : 'media',
          prioridadeLabel: countAtrasadas > 0 ? 'Atenção' : 'Aviso',
          titulo: 'Grande volume de receitas ainda pendentes',
          problema: `${pctPendente}% do total de receitas esperadas (${formatBRL(totalPendente)}) ainda não foram confirmadas.`,
          valor: totalPendente,
          dataReferencia: null,
          diasDiferenca: null,
          acaoRecomendada: 'Confirme os recebimentos efetivados para que o saldo real reflita sua liquidez atual.',
          destinoTela: 'receitas',
          lido: dismissedSet.has(alertId)
        });
      }

      // 5. Redução significativa de receitas em relação ao período anterior
      const prevList = Array.isArray(previousReceitas) ? previousReceitas : [];
      if (prevList.length > 0) {
        const totalAnterior = prevList.reduce((s, r) => s + getMoney(r && r.valor), 0);
        if (totalAnterior >= 300 && totalRealizado + totalPendente < totalAnterior * 0.85) {
          const queda = totalAnterior - (totalRealizado + totalPendente);
          const pctQueda = Math.round((queda / totalAnterior) * 100);
          const alertId = 'alert_revenue_drop_compared';
          alerts.push({
            id: alertId,
            tipo: 'reducao_receitas',
            prioridade: 'alta',
            prioridadeLabel: 'Atenção',
            titulo: `Redução de ${pctQueda}% nas entradas financeiras`,
            problema: `Receitas acumuladas de ${formatBRL(totalRealizado + totalPendente)} estão ${formatBRL(queda)} abaixo do período comparado (${formatBRL(totalAnterior)}).`,
            valor: queda,
            dataReferencia: null,
            diasDiferenca: null,
            acaoRecomendada: 'Revise previsões de pagamentos, contratos ou freelas pendentes de cobrança.',
            destinoTela: 'receitas',
            lido: dismissedSet.has(alertId)
          });
        }
      }

      // Ordenar por prioridade (critica > alta > media > info) e depois por dias
      const prioRank = { critica: 0, alta: 1, media: 2, info: 3 };
      alerts.sort((a, b) => {
        const dPrio = (prioRank[a.prioridade] ?? 4) - (prioRank[b.prioridade] ?? 4);
        if (dPrio !== 0) return dPrio;
        return (a.diasDiferenca ?? 999) - (b.diasDiferenca ?? 999);
      });

      return {
        total: alerts.length,
        pendentesNaoLidos: alerts.filter(a => !a.lido).length,
        criticosCount: alerts.filter(a => a.prioridade === 'critica' && !a.lido).length,
        atrasadasCount: countAtrasadas,
        totalValorPendente: totalPendente,
        totalValorRealizado: totalRealizado,
        alerts
      };
    },

    /**
     * Gera insights financeiros fundamentados estritamente em dados reais.
     * Reutiliza PrismaFinance quando disponível.
     */
    generateFinancialInsights({
      receitas = [],
      despesas = [],
      contas = [],
      cartoes = [],
      investimentos = [],
      goals = [],
      period = '30d',
      referenceDate = null
    } = {}) {
      const insights = [];

      let analysis = null;
      if (PrismaFinance && typeof PrismaFinance.analyzeFinances === 'function') {
        try {
          analysis = PrismaFinance.analyzeFinances({
            receitas,
            despesas,
            goals,
            period,
            referenceDate
          });
        } catch (_) {
          analysis = null;
        }
      }

      const recTotal = analysis ? analysis.receitasTotal : (receitas || []).reduce((s, r) => s + getMoney(r && r.valor), 0);
      const despTotal = analysis ? analysis.despesasTotal : (despesas || []).reduce((s, d) => s + getMoney(d && d.valor), 0);
      const saldo = recTotal - despTotal;
      const sr = recTotal > 0 ? (saldo / recTotal) * 100 : null;

      // 1. Relação entre gastos e receitas
      if (recTotal > 0 || despTotal > 0) {
        if (saldo < 0) {
          insights.push({
            id: 'insight_deficit',
            categoria: 'Fluxo de Caixa',
            icone: 'alert-triangle',
            nivel: 'atencao',
            titulo: 'Despesas superam receitas no período',
            descricao: `Seus gastos somaram ${formatBRL(despTotal)} contra ${formatBRL(recTotal)} de entradas, resultando em saldo negativo de ${formatBRL(Math.abs(saldo))}.`,
            impacto: 'Déficit de fluxo pressiona reservas e aumenta risco de endividamento.',
            recomendacao: 'Priorize gastos essenciais e renegocie ou adie despesas discricionárias neste período.',
            destinoTela: 'centro-financeiro'
          });
        } else if (sr !== null && sr >= 20) {
          insights.push({
            id: 'insight_healthy_savings',
            categoria: 'Poupança & Aportes',
            icone: 'trending-up',
            nivel: 'positivo',
            titulo: `Excelente taxa de poupança: ${sr.toFixed(1)}%`,
            descricao: `Você economizou ${formatBRL(saldo)} das suas receitas no período atual, superando a meta educacional de 20%.`,
            impacto: 'Fortalecimento acelerado do patrimônio e da reserva de emergência.',
            recomendacao: 'Considere direcionar o saldo excedente para suas metas prioritárias ou investimentos de renda fixa.',
            destinoTela: 'investimentos'
          });
        } else if (sr !== null && sr > 0 && sr < 10) {
          insights.push({
            id: 'insight_low_savings',
            categoria: 'Margem Financeira',
            icone: 'activity',
            nivel: 'atencao',
            titulo: `Taxa de poupança em ${sr.toFixed(1)}% (margem reduzida)`,
            descricao: `Seu saldo líquido de ${formatBRL(saldo)} representa menos de 10% da renda. Pequenos imprevistos podem afetar o fluxo.`,
            impacto: 'Pouca flexibilidade diante de despesas atípicas.',
            recomendacao: 'Identifique categorias com despesas variáveis para construir uma margem mensal de segurança.',
            destinoTela: 'despesas'
          });
        }
      }

      // 2. Categorias em alta nas despesas
      if (analysis && Array.isArray(analysis.categoriasEmAlta) && analysis.categoriasEmAlta.length > 0) {
        const topIncrease = analysis.categoriasEmAlta[0];
        const dif = topIncrease.total - topIncrease.prevTotal;
        insights.push({
          id: `insight_cat_increase_${topIncrease.categoria}`,
          categoria: 'Tendência de Gastos',
          icone: 'trending-up',
          nivel: 'atencao',
          titulo: `Aumento expressivo em ${topIncrease.categoria}`,
          descricao: `Gastos em ${topIncrease.categoria} subiram ${topIncrease.variacao?.text || ''} (+${formatBRL(dif)}) em relação ao período anterior, totalizando ${formatBRL(topIncrease.total)}.`,
          impacto: `Consome ${topIncrease.percentual ? topIncrease.percentual.toFixed(1) + '%' : ''} do total de despesas atuais.`,
          recomendacao: `Estabeleça um teto para ${topIncrease.categoria} para retomar o patamar anterior.`,
          destinoTela: 'despesas'
        });
      }

      // 3. Assinaturas e serviços recorrentes
      if (analysis && Array.isArray(analysis.recorrentes) && analysis.recorrentes.length >= 2) {
        const totalRec = analysis.totalRecorrentes || analysis.recorrentes.reduce((acc, r) => acc + r.total, 0);
        if (totalRec >= 60) {
          const names = analysis.recorrentes.slice(0, 3).map(r => r.nome).join(', ');
          insights.push({
            id: 'insight_subscriptions',
            categoria: 'Custos Recorrentes',
            icone: 'credit-card',
            nivel: 'informativo',
            titulo: `${analysis.recorrentes.length} assinaturas detectadas (${formatBRL(totalRec)})`,
            descricao: `Serviços recorrentes identificados: ${names}.`,
            impacto: `Corresponde a ${formatBRL(totalRec * 12)} ao ano no orçamento fixo.`,
            recomendacao: 'Revise assinaturas pouco utilizadas e avalie cancelamentos ou compartilhamento de planos.',
            destinoTela: 'despesas'
          });
        }
      }

      // 4. Cartão de Crédito e comprometimento do limite
      if (Array.isArray(cartoes) && cartoes.length > 0) {
        const debt = cartoes.reduce((s, c) => s + getMoney(c.usado != null ? c.usado : c.fatura != null ? c.fatura : c.saldo), 0);
        const limit = cartoes.reduce((s, c) => s + getMoney(c.limite), 0);
        if (limit > 0) {
          const utilPct = (debt / limit) * 100;
          if (utilPct >= 80) {
            insights.push({
              id: 'insight_card_high_utilization',
              categoria: 'Uso de Cartão',
              icone: 'alert-circle',
              nivel: 'critica',
              titulo: `Utilização de cartão em ${utilPct.toFixed(0)}% do limite`,
              descricao: `Faturas acumuladas somam ${formatBRL(debt)} de um limite total de ${formatBRL(limit)}.`,
              impacto: 'Risco de juros rotativos e redução da margem de crédito disponível.',
              recomendacao: 'Planeje a quitação integral na data de vencimento para evitar encargos financeiros.',
              destinoTela: 'cartoes'
            });
          }
        }
      }

      // 5. Oportunidades de economia comprovadas nos dados
      if (analysis && PrismaFinance && typeof PrismaFinance.generateRecommendations === 'function') {
        try {
          const recs = PrismaFinance.generateRecommendations(analysis);
          if (recs && recs.length > 0) {
            const topRec = recs[0];
            if (topRec.economiaPotencial >= 25) {
              insights.push({
                id: `insight_rec_${topRec.id}`,
                categoria: 'Oportunidade de Economia',
                icone: 'sparkles',
                nivel: 'positivo',
                titulo: topRec.titulo,
                descricao: topRec.problema,
                impacto: `Potencial de poupança estimada de até ${formatBRL(topRec.economiaPotencial)} por mês.`,
                recomendacao: topRec.acaoRecomendada,
                destinoTela: 'centro-financeiro'
              });
            }
          }
        } catch (_) {}
      }

      // Fallback quando não há dados suficientes
      if (insights.length === 0) {
        insights.push({
          id: 'insight_initial_prompt',
          categoria: 'Início',
          icone: 'info',
          nivel: 'informativo',
          titulo: 'Adicione lançamentos para liberar insights',
          descricao: 'Assim que você cadastrar despesas e receitas, o motor analisará tendências e oportunidades personalizadas.',
          impacto: 'Visão financeira baseada em evidências.',
          recomendacao: 'Registre suas movimentações habituais para ativar o monitoramento contínuo.',
          destinoTela: 'receitas'
        });
      }

      return {
        total: insights.length,
        insights
      };
    },

    /**
     * Calcula o status consolidado de saúde financeira.
     */
    computeGeneralHealthStatus({ revenueAlertsResult, insightsResult, cashFlow = 0, savingsRate = null }) {
      if (revenueAlertsResult.criticosCount > 0 || cashFlow < 0) {
        return { label: 'Atenção', statusClass: 'health-warn', badgeIcon: 'alert-triangle', dotClass: 'dot-warn' };
      }
      if (revenueAlertsResult.pendentesNaoLidos > 0) {
        return { label: 'Regular', statusClass: 'health-regular', badgeIcon: 'alert-circle', dotClass: 'dot-regular' };
      }
      if (savingsRate != null && savingsRate >= 15) {
        return { label: 'Excelente', statusClass: 'health-ok', badgeIcon: 'check-circle-2', dotClass: 'dot-ok' };
      }
      return { label: 'Estável', statusClass: 'health-ok', badgeIcon: 'shield-check', dotClass: 'dot-ok' };
    }
  };

  return PrismaMonitoringCenter;
});
