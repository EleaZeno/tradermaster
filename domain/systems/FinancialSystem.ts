
import { GameState, EconomicSnapshot, ResourceType, ProductType, IndustryType, FlowStats, GameContext } from '../../shared/types';
import { Transaction } from '../utils/Transaction';

export class FinancialSystem {
  static updateStockPrices(state: GameState): void {
      state.companies.forEach(comp => {
        if (comp.isBankrupt) {
          comp.sharePrice = Math.max(0.01, comp.sharePrice * 0.95);
          return;
        }

        const eps = comp.lastProfit / comp.totalShares;
        
        // Use PE ratio (simplified)
        let targetPrice = 0;
        const bookValue = comp.cash / comp.totalShares; 
        
        if (eps > 0) {
            targetPrice = eps * 15;
            if (comp.dividendRate > 0.05) targetPrice *= 1.2;
        } else {
            targetPrice = bookValue * 0.8; 
        }

        const smoothedPrice = (comp.sharePrice * 0.9) + (targetPrice * 0.1);
        const noise = 1 + (Math.random() - 0.5) * 0.05;
        let finalPrice = smoothedPrice * noise;
        
        finalPrice = Math.max(0.1, finalPrice);
        
        const open = comp.sharePrice;
        const close = parseFloat(finalPrice.toFixed(2));
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        const volume = Math.floor(comp.monthlySalesVolume * (1 + Math.random()));

        comp.sharePrice = close;
        comp.history.push({ day: state.day, open, high, low, close, volume });
        if (comp.history.length > 60) comp.history.shift();
      });
  }

  static processStockMarket(state: GameState): void {
      this.updateStockPrices(state);
  }

  static runAudit(state: GameState, flowStats: FlowStats): void {
    const audit: EconomicSnapshot['inventoryAudit'] = {};
    
    // Check Market Inventory via Order Book (Sell Side)
    const getMarketSupply = (itemId: string) => {
        const book = state.market[itemId];
        // Fix: Use remainingQuantity as per Order type definition
        return book ? book.asks.reduce((s, o) => s + (o.remainingQuantity), 0) : 0;
    };

    let totalConsumptionValue = 0;
    let totalProductionValue = 0;

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
        
        // Estimate values
        const price = type === ResourceType.GRAIN ? state.resources[ResourceType.GRAIN].currentPrice : state.products[ProductType.BREAD].marketPrice;
        totalConsumptionValue += flowStats[type].consumed * price;
        totalProductionValue += flowStats[type].produced * price;
    });

    // --- MACRO STATISTICS & STYLIZED FACTS TRACKING ---
    const unemployedCount = state.population.residents.filter(r => r.job === 'UNEMPLOYED' || (r.job === 'FARMER' && !r.employerId)).length;
    const laborForce = state.population.total;
    const unemploymentRate = unemployedCount / laborForce;

    // CPI Calculation (Simple basket: 1 Grain + 1 Bread)
    const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
    const breadPrice = state.products[ProductType.BREAD].marketPrice;
    const cpi = (grainPrice * 0.4) + (breadPrice * 0.6); // Weighting

    // Inflation
    const prevCpi = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].cpi : cpi;
    const inflation = prevCpi > 0 ? (cpi - prevCpi) / prevCpi : 0;

    // GDP Approximation (Expenditure Approach: C + I + G)
    // C = totalConsumptionValue
    // I = Investment (Construction of lines + Inventory Change) -> Simplification: Just production value for now or corporate cash change
    // G = Government Spending
    const govSpending = state.cityTreasury.dailyExpense;
    
    // Rough Nominal GDP
    const gdp = totalConsumptionValue + govSpending + (totalProductionValue - totalConsumptionValue); // Basic Value Added approx

    state.macroHistory.push({
        day: state.day,
        gdp: parseFloat(gdp.toFixed(2)),
        consumption: parseFloat(totalConsumptionValue.toFixed(2)),
        investment: 0, 
        cpi: parseFloat(cpi.toFixed(2)),
        inflation: parseFloat(inflation.toFixed(4)),
        unemployment: parseFloat(unemploymentRate.toFixed(4))
    });

    if (state.macroHistory.length > 365) state.macroHistory.shift();
    // ------------------------------------------------

    state.economicOverview = {
        totalResidentCash: state.population.residents.reduce((s, r) => s + r.cash, 0),
        totalCorporateCash: state.companies.reduce((s, c) => s + c.cash, 0),
        totalFundCash: state.funds.reduce((s, f) => s + f.cash, 0),
        totalCityCash: state.cityTreasury.cash,
        totalSystemGold: 0, 
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: audit
    };
    state.economicOverview.totalSystemGold = state.economicOverview.totalResidentCash + state.economicOverview.totalCorporateCash + state.economicOverview.totalCityCash + state.economicOverview.totalFundCash;
  }

  static manageFiscalPolicy(state: GameState, context: GameContext): void {
      const treasury = state.cityTreasury;
      const M0 = state.economicOverview.totalSystemGold || 1000;
      
      const hoardingRatio = treasury.cash / M0;
      
      let status: 'AUSTERITY' | 'NEUTRAL' | 'STIMULUS' = 'NEUTRAL';
      let actionLog = "";

      // Optimization: Lookup deputy via context map if possible
      const deputy = context.residentsByJob['DEPUTY_MAYOR']?.[0];
      
      let welfareBudget = 0;
      if (deputy) {
          if (treasury.cash > 200) {
              welfareBudget = state.population.total * 1.5; 
              actionLog += `副市长批准扩大救济 (${welfareBudget.toFixed(0)}份); `;
          } else {
              welfareBudget = 10; 
              actionLog += `副市长削减福利; `;
          }
      } else {
          welfareBudget = 30; 
      }
      
      treasury.taxPolicy.grainSubsidy = welfareBudget;

      // SAFETY NET: Quantitative Easing (QE) if velocity is dead
      // If GDP is near zero but Money Supply exists, it means liquidity trap.
      // Print money and give it to poor people.
      const lastGdp = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].gdp : 100;
      if (lastGdp < 10) {
          status = 'STIMULUS';
          const bailout = 1000;
          treasury.cash += bailout;
          state.economicOverview.totalSystemGold += bailout; // Magic money printing
          
          const poor = state.population.residents.filter(r => r.cash < 5);
          if (poor.length > 0) {
              const amount = bailout / poor.length;
              poor.forEach(r => {
                  Transaction.transfer('TREASURY', r, amount, { treasury, residents: state.population.residents, context });
              });
              actionLog += `【紧急】经济停摆，央行直升机撒钱 (${Math.floor(amount)} oz/人); `;
          } else {
               // Give to companies if residents have money but no production
               state.companies.forEach(c => c.cash += 200);
               actionLog += `【紧急】企业纾困注资; `;
          }
      } 
      else if (hoardingRatio > 0.25) {
          status = 'STIMULUS';
          treasury.taxPolicy.incomeTaxRate = Math.max(0.05, treasury.taxPolicy.incomeTaxRate - 0.01);
          treasury.taxPolicy.corporateTaxRate = Math.max(0.10, treasury.taxPolicy.corporateTaxRate - 0.01);
          
          const surplus = treasury.cash - (M0 * 0.20); 
          if (surplus > 0) {
              const residents = state.population.residents;
              const perCapita = surplus / residents.length;
              residents.forEach(r => {
                  Transaction.transfer('TREASURY', r, perCapita, { treasury, residents, context });
              });
              actionLog += `全民分红 ${Math.floor(surplus)} oz`;
          } else {
              actionLog += "逐步降税";
          }

      } else if (hoardingRatio < 0.05) {
          status = 'AUSTERITY';
          treasury.taxPolicy.incomeTaxRate = Math.min(0.30, treasury.taxPolicy.incomeTaxRate + 0.02);
          treasury.taxPolicy.corporateTaxRate = Math.min(0.35, treasury.taxPolicy.corporateTaxRate + 0.02);
          actionLog += "紧急加税";
      } else {
          status = 'NEUTRAL';
          const baseRate = 0.15;
          if (treasury.taxPolicy.incomeTaxRate > baseRate) treasury.taxPolicy.incomeTaxRate -= 0.005;
          if (treasury.taxPolicy.incomeTaxRate < baseRate) treasury.taxPolicy.incomeTaxRate += 0.005;
          actionLog += "平衡预算";
      }

      treasury.fiscalStatus = status;
      treasury.fiscalCorrection = actionLog;
  }
}