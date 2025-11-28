
import { GameState, ResourceType, ProductType, IndustryType } from '../../shared/types';

export interface EconomicHealthSnapshot {
  timestamp: number;
  macro: {
    gdp: number;
    gdp_growth_7d: number;
    inflation_rate: number;
    unemployment_rate: number;
    money_supply_m2: number;
    money_velocity_est: number; // GDP / M2
  };
  markets: Record<string, {
    price: number;
    spread: number;
    buy_pressure: number; // Total bid vol
    sell_pressure: number; // Total ask vol
    inventory_market: number;
  }>;
  companies: {
    total: number;
    bankrupt: number;
    avg_profit_margin: number;
    avg_cash: number;
    total_inventory_value: number;
    tobin_q_avg: number;
  };
  labor: {
    avg_wage: number;
    labor_demand_openings: number;
    labor_supply_unemployed: number;
    productivity_avg: number; // GDP / Employed
    wage_share_gdp: number; // Total Wages / GDP
  };
  finance: {
    interest_rate: number;
    yield_curve_slope: number; // 1Y - 1D
    total_debt: number;
    leverage_ratio: number; // Debt / Equity
    reserves_ratio: number;
  };
}

export class HealthCheckService {
  static captureSnapshot(state: GameState): EconomicHealthSnapshot {
    const history = state.macroHistory;
    const currentMacro = history[history.length - 1] || { gdp: 0, inflation: 0, unemployment: 0, moneySupply: 0 };
    const prevMacro = history[history.length - 8] || currentMacro;

    // Macro
    const gdp = currentMacro.gdp;
    const gdpGrowth = prevMacro.gdp > 0 ? (gdp - prevMacro.gdp) / prevMacro.gdp : 0;
    const m2 = state.bank.moneySupply;
    
    // Markets
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

    // Companies
    const activeCompanies = state.companies.filter(c => !c.isBankrupt);
    const avgMargin = activeCompanies.reduce((s, c) => s + (c.margin || 0), 0) / (activeCompanies.length || 1);
    const avgCash = activeCompanies.reduce((s, c) => s + c.cash, 0) / (activeCompanies.length || 1);
    const avgTobin = activeCompanies.reduce((s, c) => s + (c.tobinQ || 0), 0) / (activeCompanies.length || 1);
    
    // Labor
    const employed = state.population.total - state.population.unemployed;
    const totalWages = state.companies.reduce((s, c) => s + (c.employees * c.wageOffer), 0);
    const laborDemand = state.companies.reduce((s, c) => s + Math.max(0, c.targetEmployees - c.employees), 0);
    
    // Finance
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
