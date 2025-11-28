
import { GameState, StructuralAnalysis, StabilizationAction, GameContext } from '../../shared/types';
import { StructuralAuditor } from '../analytics/StructuralAuditor';
import { GAME_CONFIG } from '../../shared/config';

export class EconomicStabilizer {
    
    static process(state: GameState, context: GameContext): void {
        // Run Structural Analysis
        const checks = StructuralAuditor.runAll(state);
        const inflationSource = StructuralAuditor.analyzeInflationSource(state);
        
        state.structuralAnalysis = {
            lastCheckDay: state.day,
            results: checks,
            inflationSource: inflationSource,
            logs: state.structuralAnalysis?.logs || []
        };

        // --- FEEDBACK CONTROL LOOP ---
        
        // 1. Inflation / Deflation Control
        this.stabilizePrices(state, inflationSource);

        // 2. Wage-Price Spiral Breaker (Parameter Tuning)
        this.stabilizeLabor(state);

        // 3. Liquidity Injection (Anti-Depression)
        this.preventLiquidityTrap(state);
    }

    private static stabilizePrices(state: GameState, source: {costPush: number, demandPull: number, monetary: number}) {
        const history = state.macroHistory;
        if (history.length < 5) return;
        
        const cpiCurrent = history[history.length - 1].cpi;
        const cpiPrev = history[history.length - 5].cpi; // Weekly change
        const inflationRate = (cpiCurrent - cpiPrev) / cpiPrev;

        const treasury = state.cityTreasury;
        const bank = state.bank;

        // Threshold: 5% weekly inflation is dangerous
        if (inflationRate > 0.05) {
            let action = "";
            
            if (source.monetary > 0.5) {
                // Monetary Inflation: Hike Rates aggressively
                if (state.policyOverrides.interestRate === null) {
                    bank.targetInflation = Math.max(0.01, bank.targetInflation - 0.01);
                    action = "Central Bank Tightening (Monetary Inflation detected)";
                }
            } else if (source.demandPull > 0.5) {
                // Demand Pull: Raise Taxes to cool consumption
                if (state.policyOverrides.taxMultiplier === 1.0) {
                    treasury.taxPolicy.consumptionTaxRate = Math.min(0.20, treasury.taxPolicy.consumptionTaxRate + 0.02);
                    action = "Fiscal Contraction (Demand Inflation detected)";
                }
            }

            if (action) {
                this.logAction(state, 'MONETARY', action);
            }
        }
    }

    private static stabilizeLabor(state: GameState) {
        // Detect Wage-Price Spiral: Wages growing faster than Productivity
        // Productivity = GDP / Employees
        // Wage = AvgWage
        
        const history = state.macroHistory;
        if (history.length < 10) return;

        const current = history[history.length - 1];
        const prev = history[history.length - 5];
        
        // Safeguard against missing data
        if (!current || !prev) return;

        const gdpGrowth = (current.gdp - prev.gdp) / (prev.gdp || 1);
        const wageGrowth = (state.population.averageWage - (state.structuralAnalysis.meta?.prevWage || state.population.averageWage)) / state.population.averageWage;
        
        // Store for next tick
        if (!state.structuralAnalysis.meta) state.structuralAnalysis.meta = {};
        state.structuralAnalysis.meta.prevWage = state.population.averageWage;

        if (wageGrowth > gdpGrowth * 2 && wageGrowth > 0.1) {
            // Spiral Detected!
            // Corrective Action: Reduce Wage Sensitivity Parameter
            GAME_CONFIG.ECONOMY.WAGE_SENSITIVITY *= 0.9; // Decay parameter
            this.logAction(state, 'PARAM_TUNE', `Dampened Wage Sensitivity (Spiral Detected: Wage Growth ${wageGrowth.toFixed(2)} > GDP ${gdpGrowth.toFixed(2)})`);
        } else {
            // Slowly restore to default
            if (GAME_CONFIG.ECONOMY.WAGE_SENSITIVITY < 0.5) {
                GAME_CONFIG.ECONOMY.WAGE_SENSITIVITY *= 1.05;
            }
        }
    }

    private static preventLiquidityTrap(state: GameState) {
        // Trap: Interest Rates near 0, but GDP falling and M2 Velocity low.
        const history = state.macroHistory;
        if (history.length < 5) return;
        
        const last = history[history.length - 1];
        const bank = state.bank;
        
        if (bank.loanRate < 0.01 && last.gdp < 200 && state.day > 30) {
            // Emergency Fiscal Stimulus
            state.cityTreasury.taxPolicy.grainSubsidy += 0.5;
            state.cityTreasury.taxPolicy.incomeTaxRate = Math.max(0.01, state.cityTreasury.taxPolicy.incomeTaxRate - 0.05);
            
            this.logAction(state, 'FISCAL', "Liquidity Trap Protocol: Aggressive Tax Cuts & Subsidy");
        }
    }

    private static logAction(state: GameState, type: StabilizationAction['type'], desc: string) {
        // Dedup logs: don't spam same action every tick
        const lastLog = state.structuralAnalysis.logs[0];
        if (lastLog && lastLog.day === state.day && lastLog.description === desc) return;

        const action: StabilizationAction = {
            day: state.day,
            type,
            description: desc,
            applied: true
        };
        state.structuralAnalysis.logs.unshift(action);
        if (state.structuralAnalysis.logs.length > 20) state.structuralAnalysis.logs.pop();
        
        state.logs.unshift(`⚖️ [Stabilizer] ${desc}`);
    }
}
