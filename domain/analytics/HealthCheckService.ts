
import { GameState, ResourceType, ProductType, IndustryType, EconomicHealth, EconomicHealthSnapshot } from '../../shared/types';

export class HealthCheckService {
  
  static updateHealthIndex(state: GameState): void {
      const history = state.macroHistory;
      if (history.length < 5) return; // Need data

      const current = history[history.length - 1];
      
      // 1. Stability (Inflation close to 2% and low volatility)
      // Score drops if inflation > 10% or < -2%
      const infl = current.inflation * 100; // percent
      let stability = 100 - Math.abs(infl - 2) * 5; 
      stability = Math.max(0, Math.min(100, stability));

      // 2. Productivity (Real GDP per capita trend)
      // Simple proxy: Unemployment low = good, GDP high = good
      const unemp = current.unemployment * 100;
      let productivity = 100 - (unemp * 3); // 5% unemp -> 85 score
      if (state.population.averageHappiness < 50) productivity -= 20;
      productivity = Math.max(0, Math.min(100, productivity));

      // 3. Debt Risk (Leverage)
      // Corporate Cash vs Debt
      const totalDebt = state.bank.totalLoans;
      const totalEquity = state.companies.reduce((s, c) => s + (c.sharePrice * c.totalShares), 0);
      const leverage = totalEquity > 0 ? totalDebt / totalEquity : 0;
      // High leverage (> 2.0) is risky
      let debtRisk = 100 - (leverage * 20);
      debtRisk = Math.max(0, Math.min(100, debtRisk));

      // 4. Liquidity (Bank Reserves sufficiency)
      const reserveRatio = state.bank.totalDeposits > 0 ? state.bank.reserves / state.bank.totalDeposits : 1.0;
      // Target 10% (0.1). If < 0.1, score drops fast.
      let liquidity = 100;
      if (reserveRatio < 0.1) liquidity = reserveRatio * 1000; // 0.05 -> 50
      liquidity = Math.max(0, Math.min(100, liquidity));

      // 5. Equality (Gini Coefficient proxy via Affordability)
      // We don't have Gini calc here every tick, so use employment + wage/price
      const breadPrice = state.products[ProductType.BREAD].marketPrice;
      const wage = state.population.averageWage;
      const purchasingPower = wage / Math.max(0.1, breadPrice); // Loaves per day
      // 2 loaves is survival. 5 is good.
      let equality = Math.min(100, purchasingPower * 20);

      // Composite Score
      const totalScore = (stability * 0.3) + (productivity * 0.2) + (debtRisk * 0.2) + (liquidity * 0.15) + (equality * 0.15);

      state.economicHealth = {
          score: parseFloat(totalScore.toFixed(1)),
          stability: parseFloat(stability.toFixed(1)),
          productivity: parseFloat(productivity.toFixed(1)),
          debtRisk: parseFloat(debtRisk.toFixed(1)),
          liquidity: parseFloat(liquidity.toFixed(1)),
          equality: parseFloat(equality.toFixed(1))
      };
  }

  static captureSnapshot(state: GameState): EconomicHealthSnapshot {
    const history = state.macroHistory;
    const currentMacro = history[history.length - 1] || { gdp: 0, inflation: 0, unemployment: 0, moneySupply: 0 };
    const prevMacro = history[history.length - 8] || currentMacro;

    const gdp = currentMacro.gdp;
    const gdpGrowth = prevMacro.gdp > 0 ? (gdp - prevMacro.gdp) / prevMacro.gdp : 0;
    const m2 = state.bank.moneySupply;
    
    const markets: EconomicHealthSnapshot['markets'] = {};
    const trackItems = [ResourceType.GRAIN, ProductType.BREAD];
    
    trackItems.forEach(item => {
        const book = state.market[item];
        const bids = book ? book.bids.reduce((s, o) => s + o.remainingQuantity, 0) : 0;
        const asks = book ? book.asks.reduce((s, o) => s + o.remainingQuantity, 0) : 0;
        const bestBid = book && book.bids.length > 0 ? book.bids[0].price : 0;
        const bestAsk = book && book.asks.length > 0 ? book.asks[0].price : 0;
        
        markets[item] = {
            price: book ? book.lastPrice : 0,
            spread: bestAsk - bestBid,
            buy_pressure: bids,
            sell_pressure: asks,
            inventory_market: asks
        };
    });

    const activeCompanies = state.companies.filter(c => !c.isBankrupt);
    const avgMargin = activeCompanies.reduce((s, c) => s + (c.margin || 0), 0) / (activeCompanies.length || 1);
    const avgCash = activeCompanies.reduce((s, c) => s + c.cash, 0) / (activeCompanies.length || 1);
    const avgTobin = activeCompanies.reduce((s, c) => s + (c.tobinQ || 0), 0) / (activeCompanies.length || 1);
    
    const employed = state.population.total - state.population.unemployed;
    const totalWages = state.companies.reduce((s, c) => s + (c.employees * c.wageOffer), 0);
    
    // Fix: Only calculate labor demand for ACTIVE companies
    const laborDemand = activeCompanies.reduce((s, c) => s + Math.max(0, c.targetEmployees - c.employees), 0);
    
    const totalDebt = state.bank.totalLoans;
    const totalEquity = activeCompanies.reduce((s, c) => s + (c.sharePrice * c.totalShares), 0);

    return {
        timestamp: state.day,
        macro: {
            gdp,
            gdp_growth_7d: parseFloat(gdpGrowth.toFixed(4)),
            inflation_rate: currentMacro.inflation,
            unemployment_rate: currentMacro.unemployment,
            money_supply_m2: m2,
            money_velocity_est: m2 > 0 ? parseFloat((gdp / m2).toFixed(2)) : 0
        },
        markets,
        companies: {
            total: state.companies.length,
            bankrupt: state.companies.filter(c => c.isBankrupt).length,
            avg_profit_margin: parseFloat(avgMargin.toFixed(2)),
            avg_cash: Math.floor(avgCash),
            total_inventory_value: state.economicOverview.totalInventoryValue,
            tobin_q_avg: parseFloat(avgTobin.toFixed(2))
        },
        labor: {
            avg_wage: state.population.averageWage,
            labor_demand_openings: laborDemand,
            labor_supply_unemployed: state.population.unemployed,
            productivity_avg: employed > 0 ? parseFloat((gdp / employed).toFixed(2)) : 0,
            wage_share_gdp: gdp > 0 ? parseFloat((totalWages / gdp).toFixed(2)) : 0
        },
        finance: {
            interest_rate: state.bank.loanRate,
            yield_curve_slope: parseFloat((state.bank.yieldCurve.rate365d - state.bank.yieldCurve.rate1d).toFixed(4)),
            total_debt: Math.floor(totalDebt),
            leverage_ratio: totalEquity > 0 ? parseFloat((totalDebt / totalEquity).toFixed(2)) : 0,
            reserves_ratio: state.bank.totalDeposits > 0 ? parseFloat((state.bank.reserves / state.bank.totalDeposits).toFixed(2)) : 0
        }
    };
  }
}
