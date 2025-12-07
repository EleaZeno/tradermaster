
import { GameState, EconomicSnapshot, ResourceType, ProductType, IndustryType, FlowStats, GDPFlowAccumulator, OrderBook } from '../../shared/types';

export class GDPService {
  static process(state: GameState, flowStats: FlowStats, gdpFlow: GDPFlowAccumulator): void {
    const audit: EconomicSnapshot['inventoryAudit'] = {};
    
    const getMarketSupply = (itemId: string) => {
        const book = state.market[itemId];
        return book ? book.asks.reduce((s, o) => s + (o.remainingQuantity), 0) : 0;
    };

    ([ResourceType.GRAIN, ProductType.BREAD] as IndustryType[]).forEach(type => {
        let resCount = state.population.residents.reduce((s, r) => s + (r.inventory[type] || 0), 0);
        let compCount = state.companies.reduce((s, c) => s + (c.inventory.finished[type] || 0) + (c.inventory.raw[type as ResourceType] || 0), 0);
        let marketCount = getMarketSupply(type);

        audit[type] = {
            total: resCount + compCount + marketCount,
            residents: resCount,
            companies: compCount,
            market: marketCount,
            produced: flowStats[type].produced,
            consumed: flowStats[type].consumed,
            spoiled: flowStats[type].spoiled
        };
    });

    const unemployedCount = state.population.residents.filter(r => r.job === 'UNEMPLOYED').length;
    
    const laborForce = state.population.total;
    const unemploymentRate = laborForce > 0 ? unemployedCount / laborForce : 0;

    // --- Update Population State Stats (Critical for AI and HealthCheck) ---
    state.population.unemployed = unemployedCount;
    state.population.laborers = state.population.residents.filter(r => r.job === 'WORKER').length;
    state.population.farmers = state.population.residents.filter(r => r.job === 'FARMER').length;
    // -----------------------------------------------------------------------

    const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
    const breadPrice = state.products[ProductType.BREAD].marketPrice;
    const cpi = (grainPrice * 0.4) + (breadPrice * 0.6); 

    const prevCpi = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].cpi : cpi;
    const inflation = prevCpi > 0 ? (cpi - prevCpi) / prevCpi : 0;

    // Use Accurate Flows recorded during the tick
    const gdp = gdpFlow.C + gdpFlow.I + gdpFlow.G;

    // --- M0 Accounting (Monetary Base) ---
    // Standardized with SanityCheck: Include negative cash as it represents net position in a closed system.
    // Negative cash is debt to another entity (e.g. Treasury/Bank), but the positive counterpart exists elsewhere.
    // Summing them all (including negative) gives the Net Monetary Base.
    
    const totalResidentCash = state.population.residents.reduce((s, r) => s + r.cash, 0); // Include negative
    const totalCorporateCash = state.companies.reduce((s, c) => s + c.cash, 0); // Include negative
    const totalFundCash = state.funds.reduce((s, f) => s + f.cash, 0); // Include negative
    const totalCityCash = state.cityTreasury.cash; // Can be negative
    const totalReserves = state.bank.reserves;

    // Include Cash Locked in Market (Escrow for Buy Orders)
    let totalLockedInMarket = 0;
    Object.values(state.market).forEach((book: OrderBook) => {
        book.bids.forEach(order => {
            if (order.lockedValue) totalLockedInMarket += order.lockedValue;
        });
    });

    const M0 = totalResidentCash + totalCorporateCash + totalCityCash + totalFundCash + totalReserves + totalLockedInMarket;

    state.macroHistory.push({
        day: state.day,
        gdp: parseFloat(gdp.toFixed(2)),
        components: {
            c: parseFloat(gdpFlow.C.toFixed(2)),
            i: parseFloat(gdpFlow.I.toFixed(2)),
            g: parseFloat(gdpFlow.G.toFixed(2)),
            netX: 0
        },
        cpi: parseFloat(cpi.toFixed(2)),
        inflation: parseFloat(inflation.toFixed(4)),
        unemployment: parseFloat(unemploymentRate.toFixed(4)),
        moneySupply: parseFloat(state.bank.moneySupply.toFixed(0)) // M2 roughly
    });

    if (state.macroHistory.length > 365) state.macroHistory.shift();

    state.economicOverview = {
        totalResidentCash,
        totalCorporateCash,
        totalFundCash,
        totalCityCash,
        totalSystemGold: M0, // Correctly updated to current net sum
        totalInventoryValue: 0, 
        totalMarketCap: 0, 
        totalFuturesNotional: 0,
        inventoryAudit: audit
    };
  }
}
