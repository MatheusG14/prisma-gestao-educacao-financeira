const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
const dashboardHtml = fs.readFileSync(path.join(__dirname, '../telas/dashboard.html'), 'utf-8');
const scriptJs = fs.readFileSync(path.join(__dirname, '../js/script.js'), 'utf-8');
const modernCss = fs.readFileSync(path.join(__dirname, '../css/prisma-modern.css'), 'utf-8');
const dashboardPremiumCss = fs.readFileSync(path.join(__dirname, '../css/prisma-dashboard-premium.css'), 'utf-8');

test('1. Grand Card Structure in index.html & telas/dashboard.html', () => {
    [
        { name: 'index.html', html: indexHtml },
        { name: 'telas/dashboard.html', html: dashboardHtml }
    ].forEach(({ name, html }) => {
        // Grand Card container
        assert.ok(html.includes('id="grandCardFinancial"'), `${name} must include id="grandCardFinancial"`);
        assert.ok(html.includes('grand-card-financial'), `${name} must include class grand-card-financial`);

        // Title and Subtitle required by specifications
        assert.ok(html.includes('Visão Financeira'), `${name} must include title 'Visão Financeira'`);
        assert.ok(
            html.includes('Todos os seus indicadores financeiros em um só lugar.') ||
            html.includes('Todos os seus indicadores financeiros em um só lugar'),
            `${name} must include subtitle 'Todos os seus indicadores financeiros em um só lugar.'`
        );

        // 4 Modules
        assert.ok(html.includes('data-open-module="cashflow"'), `${name} must contain data-open-module="cashflow"`);
        assert.ok(html.includes('data-open-module="distribution"'), `${name} must contain data-open-module="distribution"`);
        assert.ok(html.includes('data-open-module="monitoring"'), `${name} must contain data-open-module="monitoring"`);
        assert.ok(html.includes('data-open-module="income-expense"'), `${name} must contain data-open-module="income-expense"`);

        // Live preview elements
        assert.ok(html.includes('id="grandKpiCashflow"'), `${name} must contain #grandKpiCashflow`);
        assert.ok(html.includes('id="grandModuleCashflowVal"'), `${name} must contain #grandModuleCashflowVal`);
        assert.ok(html.includes('id="grandModuleDistVal"'), `${name} must contain #grandModuleDistVal`);
        assert.ok(html.includes('id="grandMonitoringStatus"'), `${name} must contain #grandMonitoringStatus`);
        assert.ok(html.includes('id="grandModuleAlertsBadge"'), `${name} must contain #grandModuleAlertsBadge`);
        assert.ok(html.includes('id="grandModuleFlowRatioBadge"'), `${name} must contain #grandModuleFlowRatioBadge`);
    });
});

test('2. Independent Modals Existence and Content in index.html & telas/dashboard.html', () => {
    [
        { name: 'index.html', html: indexHtml },
        { name: 'telas/dashboard.html', html: dashboardHtml }
    ].forEach(({ name, html }) => {
        // Modal 1: Fluxo de Caixa
        assert.ok(html.includes('id="modalModuleCashflow"'), `${name} must include #modalModuleCashflow`);
        assert.ok(html.includes('id="cashflowChart"'), `${name} must include #cashflowChart inside Cashflow Modal`);
        assert.ok(html.includes('id="cashflowLegend"'), `${name} must include #cashflowLegend`);

        // Modal 2: Distribuição
        assert.ok(html.includes('id="modalModuleDistribution"'), `${name} must include #modalModuleDistribution`);
        assert.ok(html.includes('id="btnPieExpenses"'), `${name} must include #btnPieExpenses`);
        assert.ok(html.includes('id="btnPieIncome"'), `${name} must include #btnPieIncome`);
        assert.ok(html.includes('id="pieTabExpenses"'), `${name} must include #pieTabExpenses`);
        assert.ok(html.includes('id="pieTabIncome"'), `${name} must include #pieTabIncome`);
        assert.ok(html.includes('id="pieChart"'), `${name} must include #pieChart`);
        assert.ok(html.includes('id="incomePieChart"'), `${name} must include #incomePieChart`);
        assert.ok(html.includes('id="categoryList"'), `${name} must include #categoryList`);
        assert.ok(html.includes('id="incomeCategoryList"'), `${name} must include #incomeCategoryList`);

        // Modal 3: Central de Monitoramento
        assert.ok(html.includes('id="modalModuleMonitoring"'), `${name} must include #modalModuleMonitoring`);
        assert.ok(html.includes('id="dashMonitoringContent"'), `${name} must include #dashMonitoringContent`);
        assert.ok(html.includes('id="mPriorityBanner"'), `${name} must include #mPriorityBanner`);
        assert.ok(html.includes('id="mFinancialInsightsList"'), `${name} must include #mFinancialInsightsList`);
        assert.ok(html.includes('id="mRevenueAlertsList"'), `${name} must include #mRevenueAlertsList`);

        // Modal 4: Gastos e Receitas
        assert.ok(html.includes('id="modalModuleIncomeExpense"'), `${name} must include #modalModuleIncomeExpense`);
        assert.ok(html.includes('id="dashIncomeTotal"'), `${name} must include #dashIncomeTotal`);
        assert.ok(html.includes('id="dashExpenseTotal"'), `${name} must include #dashExpenseTotal`);
        assert.ok(html.includes('id="dashFlowRatioBadge"'), `${name} must include #dashFlowRatioBadge`);
        assert.ok(html.includes('data-action="add-receita"'), `${name} must include data-action="add-receita"`);
        assert.ok(html.includes('data-action="add-despesa"'), `${name} must include data-action="add-despesa"`);

        // Modal accessibility standards
        assert.ok(html.includes('role="dialog"'), `${name} must contain role="dialog"`);
        assert.ok(html.includes('aria-modal="true"'), `${name} must contain aria-modal="true"`);
        assert.ok(html.includes('data-close-module'), `${name} must contain data-close-module controls`);
    });
});

test('3. JavaScript Manager and Event Handling in js/script.js', () => {
    // Check manager definition
    assert.ok(scriptJs.includes('window.PrismaFinancialDashboard'), 'script.js must export window.PrismaFinancialDashboard');
    assert.ok(scriptJs.includes('function openModule('), 'PrismaFinancialDashboard must define openModule');
    assert.ok(scriptJs.includes('function closeModule('), 'PrismaFinancialDashboard must define closeModule');
    assert.ok(scriptJs.includes('function init(') || scriptJs.includes('init: function') || scriptJs.includes('init() {'), 'PrismaFinancialDashboard must have init');

    // Check modal keydown & escape handling
    assert.ok(scriptJs.includes("e.key === 'Escape'") || scriptJs.includes('e.key === "Escape"'), 'script.js must handle Escape key for modal closing');

    // Check body scroll locking
    assert.ok(scriptJs.includes('modal-module-open'), 'script.js must toggle body class modal-module-open');

    // Check Chart.js resize handling on modal opening
    assert.ok(scriptJs.includes('cashflowChart.resize()'), 'script.js must resize cashflowChart when opening modal');
    assert.ok(scriptJs.includes('pieChart.resize()'), 'script.js must resize pieChart when opening modal');

    // Check action delegation for Add Receita / Add Despesa
    assert.ok(scriptJs.includes('add-receita'), 'script.js must handle add-receita button click in modal');
    assert.ok(scriptJs.includes('add-despesa'), 'script.js must handle add-despesa button click in modal');
    assert.ok(scriptJs.includes('addReceitaBtn'), 'script.js must trigger #addReceitaBtn');
    assert.ok(scriptJs.includes('addDespesaBtn'), 'script.js must trigger #addDespesaBtn');

    // Check live synchronization on Grand Card
    assert.ok(scriptJs.includes('grandKpiCashflow'), 'script.js must synchronize grandKpiCashflow');
    assert.ok(scriptJs.includes('grandModuleDistVal'), 'script.js must synchronize grandModuleDistVal');
    assert.ok(scriptJs.includes('grandMonitoringStatus'), 'script.js must synchronize grandMonitoringStatus');
});

test('4. CSS Styling and Responsiveness in prisma-modern.css', () => {
    // Grand Card styling
    assert.ok(modernCss.includes('.grand-card-financial'), 'CSS must define .grand-card-financial');
    assert.ok(modernCss.includes('.grand-modules-grid'), 'CSS must define .grand-modules-grid');
    assert.ok(modernCss.includes('.grand-module-item'), 'CSS must define .grand-module-item');

    // Modal styling
    assert.ok(modernCss.includes('.financial-module-modal'), 'CSS must define .financial-module-modal');
    assert.ok(modernCss.includes('.financial-modal-backdrop'), 'CSS must define .financial-modal-backdrop');
    assert.ok(modernCss.includes('.financial-modal-dialog'), 'CSS must define .financial-modal-dialog');

    // Mobile / Responsive adaptations
    assert.ok(modernCss.includes('body.modal-module-open'), 'CSS must define body.modal-module-open scroll locking');
    assert.ok(modernCss.includes('@media (max-width: 768px)'), 'CSS must define mobile media queries');
});

test('5. Dashboard module dialogs stay anchored to the viewport', () => {
    assert.match(
        dashboardPremiumCss,
        /body\.modal-module-open\s+#dashboard\.section\.active\s*\{[^}]*animation:\s*none\s*!important;[^}]*transform:\s*none\s*!important;/
    );
});
