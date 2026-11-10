/**
 * Prisma Invest — Catálogo centralizado de ativos
 * Separação: Asset (catálogo) ≠ UserInvestment (posição do usuário)
 * Preços de mercado: estrutura pronta para API futura — valores aqui são apenas metadados, não cotações reais.
 */
(function (global) {
  'use strict';

  /** @typedef {{ id:string, name:string, ticker:string, category:string, country:string, market:string, sector:string, currency:string, type:string, description:string, segment?:string }} Asset */

  /** @type {Asset[]} */
  const ASSET_CATALOG = [
    // —— Criptomoedas ——
    { id:'btc', name:'Bitcoin', ticker:'BTC', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Principal criptomoeda por capitalização.' },
    { id:'eth', name:'Ethereum', ticker:'ETH', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Plataforma de contratos inteligentes.' },
    { id:'usdt', name:'Tether', ticker:'USDT', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Stablecoin', currency:'USD', type:'crypto', description:'Stablecoin lastreada em USD.' },
    { id:'bnb', name:'BNB', ticker:'BNB', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Token nativo do ecossistema Binance.' },
    { id:'xrp', name:'XRP', ticker:'XRP', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Token focado em pagamentos internacionais.' },
    { id:'sol', name:'Solana', ticker:'SOL', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Blockchain de alta performance.' },
    { id:'usdc', name:'USD Coin', ticker:'USDC', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Stablecoin', currency:'USD', type:'crypto', description:'Stablecoin regulada lastreada em USD.' },
    { id:'ada', name:'Cardano', ticker:'ADA', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Blockchain proof-of-stake.' },
    { id:'doge', name:'Dogecoin', ticker:'DOGE', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Criptomoeda meme amplamente negociada.' },
    { id:'trx', name:'TRON', ticker:'TRX', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Rede focada em conteúdo descentralizado.' },
    { id:'avax', name:'Avalanche', ticker:'AVAX', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Plataforma de contratos inteligentes.' },
    { id:'link', name:'Chainlink', ticker:'LINK', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Rede de oráculos descentralizados.' },
    { id:'dot', name:'Polkadot', ticker:'DOT', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Protocolo de interoperabilidade entre blockchains.' },
    { id:'pol', name:'Polygon', ticker:'POL', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Solução de escalabilidade Ethereum.' },
    { id:'ltc', name:'Litecoin', ticker:'LTC', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Criptomoeda peer-to-peer.' },
    { id:'shib', name:'Shiba Inu', ticker:'SHIB', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Token meme do ecossistema Ethereum.' },
    { id:'dai', name:'Dai', ticker:'DAI', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Stablecoin', currency:'USD', type:'crypto', description:'Stablecoin descentralizada.' },
    { id:'uni', name:'Uniswap', ticker:'UNI', category:'criptomoedas', country:'Global', market:'Crypto', sector:'DeFi', currency:'USD', type:'crypto', description:'Token de governança do DEX Uniswap.' },
    { id:'atom', name:'Cosmos', ticker:'ATOM', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Ecossistema de blockchains interoperáveis.' },
    { id:'xlm', name:'Stellar', ticker:'XLM', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Rede de pagamentos cross-border.' },
    { id:'xmr', name:'Monero', ticker:'XMR', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Criptomoeda focada em privacidade.' },
    { id:'bch', name:'Bitcoin Cash', ticker:'BCH', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Fork do Bitcoin focado em pagamentos.' },
    { id:'etc', name:'Ethereum Classic', ticker:'ETC', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Continuação da cadeia original Ethereum.' },
    { id:'fil', name:'Filecoin', ticker:'FIL', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Armazenamento descentralizado.' },
    { id:'apt', name:'Aptos', ticker:'APT', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Blockchain L1 de alta performance.' },
    { id:'arb', name:'Arbitrum', ticker:'ARB', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Layer 2 optimistic rollup.' },
    { id:'op', name:'Optimism', ticker:'OP', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Layer 2 Ethereum.' },
    { id:'near', name:'NEAR Protocol', ticker:'NEAR', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Blockchain sharded.' },
    { id:'icp', name:'Internet Computer', ticker:'ICP', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Computação on-chain.' },
    { id:'hbar', name:'Hedera', ticker:'HBAR', category:'criptomoedas', country:'Global', market:'Crypto', sector:'Cripto', currency:'USD', type:'crypto', description:'Ledger de hashgraph.' },

    // —— Ações brasileiras ——
    { id:'petr3', name:'Petrobras ON', ticker:'PETR3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Petróleo e gás — ações ordinárias.' },
    { id:'petr4', name:'Petrobras PN', ticker:'PETR4', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Petróleo e gás — ações preferenciais.' },
    { id:'vale3', name:'Vale', ticker:'VALE3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Mineração', currency:'BRL', type:'stock', description:'Mineração e metais.' },
    { id:'itub3', name:'Itaú Unibanco ON', ticker:'ITUB3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Banco — ações ordinárias.' },
    { id:'itub4', name:'Itaú Unibanco PN', ticker:'ITUB4', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Banco — ações preferenciais.' },
    { id:'bbas3', name:'Banco do Brasil', ticker:'BBAS3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Banco de economia mista.' },
    { id:'bbdc3', name:'Bradesco ON', ticker:'BBDC3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Banco — ON.' },
    { id:'bbdc4', name:'Bradesco PN', ticker:'BBDC4', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Banco — PN.' },
    { id:'sanb11', name:'Santander Brasil', ticker:'SANB11', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Unit do Santander Brasil.' },
    { id:'abev3', name:'Ambev', ticker:'ABEV3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Consumo', currency:'BRL', type:'stock', description:'Bebidas.' },
    { id:'wege3', name:'WEG', ticker:'WEGE3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Equipamentos elétricos industriais.' },
    { id:'mglu3', name:'Magazine Luiza', ticker:'MGLU3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Consumo', currency:'BRL', type:'stock', description:'Varejo e e-commerce.' },
    { id:'b3sa3', name:'B3', ticker:'B3SA3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Financeiro', currency:'BRL', type:'stock', description:'Bolsa de valores do Brasil.' },
    { id:'rent3', name:'Localiza', ticker:'RENT3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Consumo', currency:'BRL', type:'stock', description:'Aluguel de veículos.' },
    { id:'radl3', name:'Raia Drogasil', ticker:'RADL3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Saúde', currency:'BRL', type:'stock', description:'Varejo farmacêutico.' },
    { id:'jbss3', name:'JBS', ticker:'JBSS3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Consumo', currency:'BRL', type:'stock', description:'Proteínas e alimentos.' },
    { id:'suzb3', name:'Suzano', ticker:'SUZB3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Celulose e papel.' },
    { id:'ggbr4', name:'Gerdau PN', ticker:'GGBR4', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Siderurgia.' },
    { id:'usim5', name:'Usiminas PNA', ticker:'USIM5', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Siderurgia.' },
    { id:'embr3', name:'Embraer', ticker:'EMBR3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Aeronáutica.' },
    { id:'vivt3', name:'Telefônica Brasil', ticker:'VIVT3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Telecom', currency:'BRL', type:'stock', description:'Telecomunicações (Vivo).' },
    { id:'tims3', name:'TIM', ticker:'TIMS3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Telecom', currency:'BRL', type:'stock', description:'Telecomunicações.' },
    { id:'klbn11', name:'Klabin', ticker:'KLBN11', category:'acoes-br', country:'Brasil', market:'B3', sector:'Indústria', currency:'BRL', type:'stock', description:'Papel e embalagens — unit.' },
    { id:'egie3', name:'Engie Brasil', ticker:'EGIE3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Geração de energia.' },
    { id:'cpfe3', name:'CPFL Energia', ticker:'CPFE3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Distribuição de energia.' },
    { id:'eqtl3', name:'Equatorial Energia', ticker:'EQTL3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Distribuição de energia.' },
    { id:'elet3', name:'Eletrobras ON', ticker:'ELET3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Geração e transmissão — ON.' },
    { id:'elet6', name:'Eletrobras PNB', ticker:'ELET6', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Geração e transmissão — PNB.' },
    { id:'hype3', name:'Hypera', ticker:'HYPE3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Saúde', currency:'BRL', type:'stock', description:'Farmacêutica.' },
    { id:'prio3', name:'Prio', ticker:'PRIO3', category:'acoes-br', country:'Brasil', market:'B3', sector:'Energia', currency:'BRL', type:'stock', description:'Petróleo e gás.' },

    // —— Ações globais (EUA) ——
    { id:'aapl', name:'Apple', ticker:'AAPL', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Tecnologia e dispositivos.' },
    { id:'msft', name:'Microsoft', ticker:'MSFT', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Software e nuvem.' },
    { id:'googl', name:'Alphabet', ticker:'GOOGL', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Internet e publicidade (Google).' },
    { id:'amzn', name:'Amazon', ticker:'AMZN', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Consumo', currency:'USD', type:'stock', description:'E-commerce e nuvem.' },
    { id:'nvda', name:'NVIDIA', ticker:'NVDA', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Semicondutores e IA.' },
    { id:'meta', name:'Meta Platforms', ticker:'META', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Redes sociais e metaverso.' },
    { id:'tsla', name:'Tesla', ticker:'TSLA', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Consumo', currency:'USD', type:'stock', description:'Veículos elétricos e energia.' },
    { id:'brkb', name:'Berkshire Hathaway', ticker:'BRK.B', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Financeiro', currency:'USD', type:'stock', description:'Holding de investimentos.' },
    { id:'jpm', name:'JPMorgan Chase', ticker:'JPM', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Financeiro', currency:'USD', type:'stock', description:'Banco global.' },
    { id:'v', name:'Visa', ticker:'V', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Financeiro', currency:'USD', type:'stock', description:'Pagamentos.' },
    { id:'ma', name:'Mastercard', ticker:'MA', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Financeiro', currency:'USD', type:'stock', description:'Pagamentos.' },
    { id:'ko', name:'Coca-Cola', ticker:'KO', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Consumo', currency:'USD', type:'stock', description:'Bebidas.' },
    { id:'pep', name:'PepsiCo', ticker:'PEP', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Consumo', currency:'USD', type:'stock', description:'Alimentos e bebidas.' },
    { id:'mcd', name:"McDonald's", ticker:'MCD', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Consumo', currency:'USD', type:'stock', description:'Restaurantes.' },
    { id:'wmt', name:'Walmart', ticker:'WMT', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Consumo', currency:'USD', type:'stock', description:'Varejo.' },
    { id:'jnj', name:'Johnson & Johnson', ticker:'JNJ', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Saúde', currency:'USD', type:'stock', description:'Saúde e farmacêutica.' },
    { id:'pg', name:'Procter & Gamble', ticker:'PG', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Consumo', currency:'USD', type:'stock', description:'Bens de consumo.' },
    { id:'xom', name:'Exxon Mobil', ticker:'XOM', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Energia', currency:'USD', type:'stock', description:'Petróleo e gás.' },
    { id:'cvx', name:'Chevron', ticker:'CVX', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Energia', currency:'USD', type:'stock', description:'Petróleo e gás.' },
    { id:'intc', name:'Intel', ticker:'INTC', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Semicondutores.' },
    { id:'amd', name:'AMD', ticker:'AMD', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Semicondutores.' },
    { id:'nflx', name:'Netflix', ticker:'NFLX', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Streaming.' },
    { id:'adbe', name:'Adobe', ticker:'ADBE', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Software criativo.' },
    { id:'orcl', name:'Oracle', ticker:'ORCL', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Tecnologia', currency:'USD', type:'stock', description:'Software empresarial.' },
    { id:'crm', name:'Salesforce', ticker:'CRM', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Tecnologia', currency:'USD', type:'stock', description:'CRM em nuvem.' },
    { id:'csco', name:'Cisco', ticker:'CSCO', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Redes e infraestrutura.' },
    { id:'uber', name:'Uber', ticker:'UBER', category:'acoes-global', country:'EUA', market:'NYSE', sector:'Tecnologia', currency:'USD', type:'stock', description:'Mobilidade e delivery.' },
    { id:'abnb', name:'Airbnb', ticker:'ABNB', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Consumo', currency:'USD', type:'stock', description:'Hospedagem peer-to-peer.' },
    { id:'pypl', name:'PayPal', ticker:'PYPL', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Financeiro', currency:'USD', type:'stock', description:'Pagamentos digitais.' },
    { id:'qcom', name:'Qualcomm', ticker:'QCOM', category:'acoes-global', country:'EUA', market:'NASDAQ', sector:'Tecnologia', currency:'USD', type:'stock', description:'Semicondutores e wireless.' },

    // —— FIIs ——
    { id:'hglg11', name:'Pátria Log', ticker:'HGLG11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Logística', description:'FII de logística (tijolo).' },
    { id:'xplg11', name:'XP Log', ticker:'XPLG11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Logística', description:'FII de galpões logísticos.' },
    { id:'knri11', name:'Kinea Renda Imobiliária', ticker:'KNRI11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Híbrido', description:'FII de lajes e logística.' },
    { id:'visc11', name:'Vinci Shopping Centers', ticker:'VISC11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Shopping', description:'FII de shopping centers.' },
    { id:'hsml11', name:'HSI Malls', ticker:'HSML11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Shopping', description:'FII de shoppings.' },
    { id:'xpml11', name:'XP Malls', ticker:'XPML11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Shopping', description:'FII de shoppings.' },
    { id:'hgre11', name:'Pátria Escritórios', ticker:'HGRE11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Escritórios', description:'FII de lajes corporativas.' },
    { id:'pvbi11', name:'VBI Prime Properties', ticker:'PVBI11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Escritórios', description:'FII de escritórios.' },
    { id:'rbrp11', name:'RBR Properties', ticker:'RBRP11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Híbrido', description:'FII de propriedades.' },
    { id:'mxrf11', name:'Maxi Renda', ticker:'MXRF11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de recebíveis (papel).' },
    { id:'kncr11', name:'Kinea Rendimentos', ticker:'KNCR11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de CRI.' },
    { id:'knip11', name:'Kinea Índices de Preços', ticker:'KNIP11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de CRI indexados.' },
    { id:'cpts11', name:'Capitânia Securities II', ticker:'CPTS11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de recebíveis.' },
    { id:'irdm11', name:'Iridium Recebíveis', ticker:'IRDM11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de CRI.' },
    { id:'recr11', name:'REC Recebíveis', ticker:'RECR11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de recebíveis imobiliários.' },
    { id:'rbrr11', name:'RBR High Grade', ticker:'RBRR11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de CRI high grade.' },
    { id:'btcr11', name:'BTG Pactual Crédito Imobiliário', ticker:'BTCR11', category:'fiis', country:'Brasil', market:'B3', sector:'Imobiliário', currency:'BRL', type:'fii', segment:'Papel', description:'FII de crédito imobiliário.' }
  ];

  const CATEGORY_LABELS = {
    'criptomoedas': 'Criptomoedas',
    'acoes-br': 'Ações Brasileiras',
    'acoes-global': 'Ações Globais',
    'fiis': 'Fundos Imobiliários',
    'renda-fixa': 'Renda Fixa',
    'fundos': 'Fundos',
    'etfs': 'ETFs',
    'outros': 'Outros'
  };

  function searchAssets(query, filters) {
    const q = String(query || '').trim().toLowerCase();
    const cat = filters && filters.category && filters.category !== 'todas' ? filters.category : null;
    const market = filters && filters.market && filters.market !== 'todos' ? filters.market : null;
    const sector = filters && filters.sector && filters.sector !== 'todos' ? filters.sector : null;
    return ASSET_CATALOG.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (market) {
        const m = String(a.country || a.market || '').toLowerCase();
        if (market === 'brasil' && !m.includes('brasil') && a.market !== 'B3') return false;
        if (market === 'eua' && !m.includes('eua') && a.market !== 'NASDAQ' && a.market !== 'NYSE') return false;
        if (market === 'global' && a.category !== 'criptomoedas' && a.country !== 'Global') return false;
        if (market === 'europa' || market === 'asia') return false; // preparado, catálogo inicial focado
      }
      if (sector && sector !== 'todos') {
        const s = String(a.sector || '').toLowerCase();
        if (!s.includes(sector.toLowerCase()) && !(a.segment && String(a.segment).toLowerCase().includes(sector.toLowerCase()))) return false;
      }
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.ticker.toLowerCase().includes(q) ||
        (a.sector || '').toLowerCase().includes(q) ||
        (CATEGORY_LABELS[a.category] || '').toLowerCase().includes(q) ||
        (a.country || '').toLowerCase().includes(q)
      );
    });
  }

  function getAssetById(id) {
    return ASSET_CATALOG.find((a) => a.id === id) || null;
  }

  function getAssetByTicker(ticker) {
    const t = String(ticker || '').toUpperCase();
    return ASSET_CATALOG.find((a) => a.ticker.toUpperCase() === t) || null;
  }

  global.PrismaAssets = {
    catalog: ASSET_CATALOG,
    categoryLabels: CATEGORY_LABELS,
    search: searchAssets,
    getById: getAssetById,
    getByTicker: getAssetByTicker
  };
})(typeof window !== 'undefined' ? window : globalThis);
