
import { GameState, EconomicSnapshot, ResourceType, ProductType, IndustryType } from '../../types';
import { Transaction } from '../utils/Transaction';

export class FinancialSystem {
  static processStockMarket(state: GameState) {
    state.companies.forEach(c => {
        const dailyProfit = c.lastProfit;
        const eps = dailyProfit / c.totalShares;
        
        const inventoryVal = Object.values(c.inventory.finished).reduce((s, v) => s + v * (c.avgCost || 1), 0);
        const bookValue = (c.cash + inventoryVal) / c.totalShares;
        
        const peRatio = c.employees > 2 ? 15 : 8;
        const projectedEPS = eps * 30; 
        
        let targetPrice = bookValue + (projectedEPS > 0 ? projectedEPS * peRatio : projectedEPS * 2);
        targetPrice = Math.max(0.01, targetPrice);
        
        const noise = (Math.random() - 0.5) * 0.15;
        targetPrice = targetPrice * (1 + noise);
        
        const open = c.sharePrice;
        const close = Number((c.sharePrice * 0.9 + targetPrice * 0.1).toFixed(2));
        c.sharePrice = close;
        
        // Generate Candle
        const volatility = Math.abs(open - close) + (open * 0.03);
        const high = Math.max(open, close) + Math.random() * volatility;
        const low = Math.min(open, close) - Math.random() * volatility;
        const volume = Math.floor(Math.random() * 500) + c.monthlySalesVolume;

        c.history.push({ day: state.day + 1, open, high, low, close, volume });
        if (c.history.length > 60) c.history.shift();
    });
  }

  static runAudit(state: GameState, flowStats: any) {
    const audit: EconomicSnapshot['inventoryAudit'] = {};
    
    state.products[ProductType.BREAD].marketInventory = state.companies.reduce((acc, c) => acc + (c.inventory.finished[ProductType.BREAD] || 0), 0);

    [ResourceType.GRAIN, ProductType.BREAD].forEach(t => {
        const type = t as IndustryType;
        let resCount = state.population.residents.reduce((s, r) => s + (r.inventory[type] || 0), 0);
        let compCount = state.companies.reduce((s, c) => s + (c.inventory.finished[type] || 0) + (c.inventory.raw[type as ResourceType] || 0), 0);
        let marketCount = type === ResourceType.GRAIN ? state.resources[ResourceType.GRAIN].marketInventory : 0;

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

  static manageFiscalPolicy(state: GameState) {
      const treasury = state.cityTreasury;
      const M0 = state.economicOverview.totalSystemGold || 1000;
      
      const hoardingRatio = treasury.cash / M0;
      
      let status: 'AUSTERITY' | 'NEUTRAL' | 'STIMULUS' = 'NEUTRAL';
      let actionLog = "";

      const deputy = state.population.residents.find(r => r.job === 'DEPUTY_MAYOR');
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

      if (hoardingRatio > 0.25) {
          status = 'STIMULUS';
          treasury.taxPolicy.incomeTaxRate = Math.max(0.05, treasury.taxPolicy.incomeTaxRate - 0.01);
          treasury.taxPolicy.corporateTaxRate = Math.max(0.10, treasury.taxPolicy.corporateTaxRate - 0.01);
          
          const surplus = treasury.cash - (M0 * 0.20); 
          if (surplus > 0) {
              const residents = state.population.residents;
              const perCapita = surplus / residents.length;
              residents.forEach(r => {
                  Transaction.transfer('TREASURY', r, perCapita, { treasury, residents });
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
