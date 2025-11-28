
import { GameState, StructuralCheckResult, ResourceType, ProductType, MacroMetric } from '../../shared/types';

export class StructuralAuditor {
    
    static runAll(state: GameState): StructuralCheckResult[] {
        const results: StructuralCheckResult[] = [];
        results.push(this.checkPriceMechanism(state));
        results.push(this.checkConsumptionFunction(state));
        results.push(this.checkProductionFunction(state));
        return results;
    }

    static analyzeInflationSource(state: GameState): { costPush: number, demandPull: number, monetary: number } {
        const history = state.macroHistory;
        if (history.length < 8) return { costPush: 0, demandPull: 0, monetary: 0 };

        const current = history[history.length - 1];
        const prev = history[history.length - 2];
        const old = history[history.length - 8];

        // 1. Monetary: M2 Growth vs CPI
        const m2Growth = (current.moneySupply || 1) / (old.moneySupply || 1) - 1;
        
        // 2. Cost-Push: Wage Growth vs CPI
        // Need to infer wage growth from population state (not tracked in macroHistory deeply, but we can check avgWage in state vs historical proxy)
        // Proxy: Inflation component caused by lack of Supply (Inventory drop)
        const inventoryDrop = (state.economicOverview.inventoryAudit[ResourceType.GRAIN]?.total || 0) < 50;
        
        // 3. Demand-Pull: Consumption Growth vs GDP
        const cGrowth = (current.components.c / (old.components.c || 1)) - 1;
        
        const total = Math.abs(m2Growth) + Math.abs(cGrowth) + (inventoryDrop ? 0.1 : 0);
        
        if (total === 0) return { costPush: 0, demandPull: 0, monetary: 0 };

        return {
            monetary: Math.abs(m2Growth) / total,
            demandPull: Math.abs(cGrowth) / total,
            costPush: (inventoryDrop ? 0.1 : 0) / total
        };
    }

    /**
     * Check 1: Price Mechanism
     * Law: Price changes should inversely track Inventory changes.
     * If Inventory rises, Price should fall.
     */
    private static checkPriceMechanism(state: GameState): StructuralCheckResult {
        const item = ResourceType.GRAIN;
        const currentPrice = state.resources[item].currentPrice;
        
        // We need history to check correlation. 
        // Simplification: Check last 7 days trend.
        const history = state.resources[item].history.slice(-7);
        if (history.length < 5) return { category: 'PRICE', status: 'HEALTHY', message: 'Insufficient data', score: 1 };

        const priceTrend = history[history.length - 1].close - history[0].close;
        // Check if high inventory correlates with low price
        // Get market depth
        const asks = state.market[item]?.asks.reduce((s,o)=>s+o.remainingQuantity,0) || 0;
        
        // Logic: 
        // If Inventory is HUGE (> 200) and Price is RISING -> Broken
        // If Inventory is TINY (< 10) and Price is FALLING -> Broken
        
        if (asks > 200 && priceTrend > 0) {
            return { category: 'PRICE', status: 'CRITICAL', message: 'Price Mechanism Fail: Supply Glut but Prices Rising', score: 0 };
        }
        if (asks < 10 && priceTrend < 0) {
            return { category: 'PRICE', status: 'CRITICAL', message: 'Price Mechanism Fail: Shortage but Prices Falling', score: 0 };
        }

        return { category: 'PRICE', status: 'HEALTHY', message: 'Price responding to inventory signals', score: 1 };
    }

    /**
     * Check 2: Consumption Function
     * Law: 0 < MPC < 1
     * Consumption should rise with Income, but not exceed it permanently (unless debt).
     */
    private static checkConsumptionFunction(state: GameState): StructuralCheckResult {
        const history = state.macroHistory.slice(-10);
        if (history.length < 5) return { category: 'CONSUMPTION', status: 'HEALTHY', message: 'Insufficient data', score: 1 };

        let violations = 0;
        for (let i = 1; i < history.length; i++) {
            const dC = history[i].components.c - history[i-1].components.c;
            const dY = history[i].gdp - history[i-1].gdp;
            
            // If Income rose significantly, Consumption should rise
            if (dY > 50 && dC < 0) violations++;
            
            // If Consumption rose way more than Income (MPC > 1.5) -> Bubble
            if (dY > 10 && dC > dY * 1.5) violations++;
        }

        if (violations > 3) {
            return { category: 'CONSUMPTION', status: 'WARNING', message: 'Consumption disconnected from Income (Possible MPC > 1)', score: 0.5 };
        }
        return { category: 'CONSUMPTION', status: 'HEALTHY', message: 'MPC within Keynesian bounds', score: 1 };
    }

    /**
     * Check 3: Production Function
     * Law: Output < Inputs. Profit logic must hold.
     */
    private static checkProductionFunction(state: GameState): StructuralCheckResult {
        const companies = state.companies.filter(c => !c.isBankrupt && c.age > 10);
        if (companies.length === 0) return { category: 'PRODUCTION', status: 'HEALTHY', message: 'No mature firms', score: 1 };

        let illogicalFirms = 0;
        companies.forEach(c => {
            // Check: Are they producing without employees?
            if (c.monthlyProductionVolume > 10 && c.employees === 0 && !c.isPlayerFounded) {
                illogicalFirms++;
            }
            // Check: Are costs negative?
            if (c.accumulatedCosts < 0) illogicalFirms++;
        });

        if (illogicalFirms > 0) {
            return { category: 'PRODUCTION', status: 'CRITICAL', message: `Found ${illogicalFirms} firms with supernatural production (No Labor)`, score: 0 };
        }
        return { category: 'PRODUCTION', status: 'HEALTHY', message: 'Cobb-Douglas constraints holding', score: 1 };
    }
}
