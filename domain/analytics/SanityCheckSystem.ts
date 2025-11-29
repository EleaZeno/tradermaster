
import { GameState, ResourceType, ProductType } from '../../shared/types';

export class SanityCheckSystem {
    static check(state: GameState): void {
        const issues: string[] = [];

        // 1. Check for NaN/Infinity in Macro Indicators
        const macro = state.macroHistory[state.macroHistory.length - 1];
        if (macro) {
            if (!Number.isFinite(macro.gdp)) issues.push("CRITICAL: GDP is NaN/Infinity");
            if (!Number.isFinite(macro.cpi)) issues.push("CRITICAL: CPI is NaN/Infinity");
        }

        // 2. Check for Negative Prices or Quantities
        [ResourceType.GRAIN, ProductType.BREAD].forEach(item => {
            const resource = state.resources[item as ResourceType];
            const product = state.products[item as ProductType];
            
            let price = 0;
            if (resource) {
                price = resource.currentPrice;
            } else if (product) {
                price = product.marketPrice;
            }
            
            if (price < 0) issues.push(`VIOLATION: Negative price for ${item}`);
            if (!Number.isFinite(price)) issues.push(`VIOLATION: NaN price for ${item}`);
            
            // Hard clamp correction
            if (price <= 0) {
                if(resource) resource.currentPrice = 0.1;
                else if(product) product.marketPrice = 0.1;
            }
        });

        // 3. Check for Negative Cash
        state.companies.forEach(c => {
            if (Number.isNaN(c.cash)) {
                issues.push(`VIOLATION: Company ${c.name} has NaN cash`);
                c.cash = 0;
            }
        });

        state.population.residents.forEach(r => {
            if (Number.isNaN(r.cash)) {
                issues.push(`VIOLATION: Resident ${r.id} has NaN cash`);
                r.cash = 0;
            }
            if (r.cash < -100) {
                // Allow small debts, but deep negative is a bug in the escrow logic
                issues.push(`VIOLATION: Resident ${r.id} in deep negative cash (${r.cash.toFixed(2)})`);
                r.cash = 0; // Bankruptcy reset
            }
        });

        // 4. Banking Sanity
        if (state.bank.reserves < 0) {
            issues.push(`CRITICAL: Central Bank Reserves Negative (${state.bank.reserves})`);
            state.bank.reserves = 0; // Bailout
        }

        if (issues.length > 0) {
            console.warn("[Sanity Check Failed]", issues);
            state.logs.unshift(`⚠️ 系统异常检测: ${issues[0]}`);
        }
    }
}
