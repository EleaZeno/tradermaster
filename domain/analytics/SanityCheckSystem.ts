
import { GameState, ResourceType, ProductType } from '../../shared/types';

export class SanityCheckSystem {
    static check(state: GameState): void {
        const issues: string[] = [];

        // 1. Conservation of Money Audit
        const totalResidentCash = state.population.residents.reduce((s, r) => s + r.cash, 0);
        const totalCorporateCash = state.companies.reduce((s, c) => s + c.cash, 0);
        const totalFundCash = state.funds.reduce((s, f) => s + f.cash, 0);
        const totalCityCash = state.cityTreasury.cash;
        const totalBankReserves = state.bank.reserves;

        const actualM0 = totalResidentCash + totalCorporateCash + totalFundCash + totalCityCash + totalBankReserves;
        const recordedM0 = state.economicOverview.totalSystemGold;

        // Allow small floating point error
        if (Math.abs(actualM0 - recordedM0) > 1.0) {
            issues.push(`[CRITICAL] Money Leak: Actual(${actualM0.toFixed(1)}) != Recorded(${recordedM0.toFixed(1)})`);
            // Auto-correct to prevent crash, but log it
            state.economicOverview.totalSystemGold = actualM0;
        }

        // 2. Check for NaN/Infinity in Macro Indicators
        const macro = state.macroHistory[state.macroHistory.length - 1];
        if (macro) {
            if (!Number.isFinite(macro.gdp)) issues.push(`[NaN] GDP is ${macro.gdp}`);
            if (!Number.isFinite(macro.cpi)) issues.push(`[NaN] CPI is ${macro.cpi}`);
        }

        // 3. Check for Negative Prices, Quantities, or Extremes
        [ResourceType.GRAIN, ProductType.BREAD].forEach(item => {
            const resource = state.resources[item as ResourceType];
            const product = state.products[item as ProductType];
            
            let price = 0;
            if (resource) {
                price = resource.currentPrice;
            } else if (product) {
                price = product.marketPrice;
            }
            
            if (price < 0) issues.push(`[VIOLATION] Negative price for ${item}`);
            if (!Number.isFinite(price)) issues.push(`[NaN] Price for ${item}`);
            if (price > 1000) issues.push(`[ANOMALY] Price Explosion: ${item} @ ${price.toFixed(2)}`);
            
            // Hard clamp correction
            if (price <= 0) {
                if(resource) resource.currentPrice = 0.1;
                else if(product) product.marketPrice = 0.1;
            }
        });

        // 4. Check for Negative Cash (Deep debt implies broken escrow)
        state.companies.forEach(c => {
            if (Number.isNaN(c.cash)) {
                issues.push(`[NaN] Company ${c.name} Cash`);
                c.cash = 0;
            }
            if (c.cash < -1000) issues.push(`[VIOLATION] Deep Negative Cash: ${c.name} (${c.cash.toFixed(0)})`);
        });

        state.population.residents.forEach(r => {
            if (Number.isNaN(r.cash)) {
                issues.push(`[NaN] Resident ${r.id} Cash`);
                r.cash = 0;
            }
            if (r.cash < -50) {
                issues.push(`[VIOLATION] Deep Negative Cash: Resident ${r.id} (${r.cash.toFixed(2)})`);
                r.cash = 0; 
            }
        });

        // 5. Banking Sanity
        if (state.bank.reserves < 0) {
            issues.push(`[CRITICAL] Central Bank Reserves Negative (${state.bank.reserves.toFixed(2)})`);
            state.bank.reserves = 0; 
        }

        // 6. Magic Number / Stagnation Checks (Heuristic)
        if (state.totalTicks > 100 && state.macroHistory.length > 10) {
            const last10 = state.macroHistory.slice(-10);
            const allSame = last10.every(m => Math.abs(m.gdp - last10[0].gdp) < 0.001);
            if (allSame) issues.push(`[STAGNATION] GDP frozen at ${last10[0].gdp} for 10 ticks`);
        }

        if (issues.length > 0) {
            // Only log the first one to avoid spamming the UI log too hard in one tick
            state.logs.unshift(issues[0]);
            // You might want to store all issues in a dedicated debug buffer in the future
        }
    }
}
