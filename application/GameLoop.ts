
import { GameState, ResourceType, ProductType, FlowStats, GameContext, Resident, GDPFlowAccumulator } from '../shared/types';
import { LaborService } from '../domain/labor/LaborService';
import { ProductionService } from '../domain/company/ProductionService';
import { ConsumerService } from '../domain/consumer/ConsumerService';
import { StockMarketService } from '../domain/finance/StockMarketService';
import { BankingService } from '../domain/finance/BankingService';
import { MarketService } from '../domain/market/MarketService';
import { TransactionService } from '../domain/finance/TransactionService';
import { GAME_CONFIG } from '../shared/config';

export const processGameTick = (gameState: GameState): void => {
    performance.mark('tick-start');
    
    gameState.totalTicks = (gameState.totalTicks || 0) + 1;
    const currentTick = gameState.totalTicks;
    const rates = GAME_CONFIG.UPDATE_RATES;

    let context: GameContext | undefined;
    
    if (currentTick % rates.CORE_ECO === 0 || currentTick % rates.MACRO === 0) {
        const residentMap = new Map<string, Resident>();
        const companyMap = new Map(gameState.companies.map(c => [c.id, c]));
        const employeesByCompany: Record<string, Resident[]> = {};
        const residentsByJob: Record<string, Resident[]> = {};

        gameState.population.residents.forEach(r => {
            residentMap.set(r.id, r);
            if (r.employerId) {
                if (!employeesByCompany[r.employerId]) employeesByCompany[r.employerId] = [];
                employeesByCompany[r.employerId].push(r);
            }
            if (!residentsByJob[r.job]) residentsByJob[r.job] = [];
            residentsByJob[r.job].push(r);
        });
        
        context = { residentMap, companyMap, employeesByCompany, residentsByJob };
    }

    if (currentTick % rates.MARKET === 0) {
        MarketService.pruneStaleOrders(gameState, context || createFallbackContext(gameState));
    }

    // --- Core Economic Cycle (Closed Loop) ---
    // A General Equilibrium Tick
    
    if (currentTick % rates.CORE_ECO === 0 && context) {
        resetDailyCounters(gameState); 
        
        // GDP Flow Accumulator for this day
        const gdpFlow: GDPFlowAccumulator = { C: 0, I: 0, G: 0 };
        
        // --- Policy Shock: Helicopter Money ---
        if (gameState.policyOverrides.moneyPrinter > 0) {
            const amount = gameState.policyOverrides.moneyPrinter / gameState.population.residents.length;
            gameState.population.residents.forEach(r => {
                r.cash += amount;
            });
            // Treat as Gov Spending (G) or Transfer (neg Tax), lets count as G boost to supply
            gameState.cityTreasury.cash += gameState.policyOverrides.moneyPrinter;
            gameState.economicOverview.totalSystemGold += (gameState.policyOverrides.moneyPrinter * 2);
            gdpFlow.G += gameState.policyOverrides.moneyPrinter;
        }
        // -----------------------------------------------------------

        const flowStats: FlowStats = {
            [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
            [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
        };
        
        const getEventModifier = (target: string): number => {
            let modifier = 1.0;
            const activeEvents = gameState.events.filter(event => gameState.day - event.turnCreated < 5);
            activeEvents.forEach(event => {
                if (event.type === 'NEWS' && event.effect && event.effect.target === target) {
                    modifier += event.effect.modifier;
                }
            });
            return modifier;
        };

        const grainPriceBenchmark = Math.max(0.1, gameState.resources[ResourceType.GRAIN].currentPrice);
        const wagePressureModifier = getEventModifier('WAGE');

        // 1. Labor Market acts first (Wage Setting)
        // Wages paid by Gov contribute to G
        LaborService.process(gameState, context, grainPriceBenchmark, wagePressureModifier, gdpFlow);
        
        // 2. Production (Hiring + Output + Sales + Investment)
        // Tracks I (Investment in Lines/Inventory)
        ProductionService.process(gameState, context, flowStats, getEventModifier, gdpFlow);
        
        // 3. Consumption (Utility Maximization)
        // Tracks C (Consumption)
        ConsumerService.process(gameState, context, flowStats, gdpFlow);
        
        // 4. Banking (Credit Creation)
        // Credit creation happens continuously but we reconcile here
        if (currentTick % rates.MACRO === 0) {
             BankingService.process(gameState, context);
        }

        // --- Demographics & Sentiment ---
        updateDemographics(gameState);
        updateSentiment(gameState, gdpFlow); // Use flow Gdp to update sentiment
        updateCompanyLifecycle(gameState);
        
        gameState.day += 1;
        updatePlayerStatus(gameState);
        
        // 5. Audit & GDP Recording
        if (currentTick % rates.MACRO === 0) {
             StockMarketService.runAudit(gameState, flowStats, gdpFlow);
        }
    }

    if (currentTick % rates.MACRO === 0 && context) {
        StockMarketService.processStockMarket(gameState);
        
        if (gameState.policyOverrides.taxMultiplier === 1.0) {
            StockMarketService.manageFiscalPolicy(gameState, context);
        } else {
            // Apply Manual Tax Multiplier Logic
            const pol = gameState.cityTreasury.taxPolicy;
            const mult = gameState.policyOverrides.taxMultiplier;
            pol.incomeTaxRate = Math.min(0.8, GAME_CONFIG.TAX_RATES.INCOME_LOW * mult);
            pol.corporateTaxRate = Math.min(0.8, GAME_CONFIG.TAX_RATES.CORPORATE * mult);
            pol.consumptionTaxRate = Math.min(0.5, GAME_CONFIG.TAX_RATES.CONSUMPTION * mult);
            
            gameState.cityTreasury.fiscalStatus = 'NEUTRAL'; 
            gameState.cityTreasury.fiscalCorrection = `人工干预 (${mult.toFixed(1)}x)`;
        }
    }

    performance.mark('tick-end');
    performance.measure('game-tick', 'tick-start', 'tick-end');
};

const createFallbackContext = (gameState: GameState): GameContext => {
    const residentMap = new Map(gameState.population.residents.map(r => [r.id, r]));
    const companyMap = new Map(gameState.companies.map(c => [c.id, c]));
    return { residentMap, companyMap, employeesByCompany: {}, residentsByJob: {} };
}

const resetDailyCounters = (gameState: GameState): void => {
    gameState.resources[ResourceType.GRAIN].dailySales = 0;
    gameState.resources[ResourceType.GRAIN].demand = 0;
    gameState.products[ProductType.BREAD].dailySales = 0;
    gameState.products[ProductType.BREAD].demand = 0;
    
    gameState.cityTreasury.dailyIncome = 0;
    gameState.cityTreasury.dailyExpense = 0;
    gameState.cityTreasury.grainDistributedToday = 0;

    gameState.companies.forEach(company => {
        company.lastProfit = 0; 
    });
};

const updatePlayerStatus = (gameState: GameState): void => {
    const player = gameState.population.residents.find(resident => resident.isPlayer);
    if (player) {
        gameState.cash = player.cash;
        player.wealth = player.cash; 
    }
    if (gameState.companies.length > 0) {
        const totalWages = gameState.companies.reduce((sum, company) => sum + company.wageOffer, 0);
        gameState.population.averageWage = totalWages / gameState.companies.length;
    } else {
        gameState.population.averageWage = 1.5;
    }
};

const updateDemographics = (state: GameState) => {
    if (state.day % 30 !== 0) return; 

    const pop = state.population;
    const multiplier = state.policyOverrides.migrationRate;
    
    if (pop.averageHappiness > (80 / Math.max(0.1, multiplier)) && pop.total < 150) {
        const id = `res_imm_${state.day}_${Math.random().toString(36).substr(2,4)}`;
        state.logs.unshift(`👶 新移民加入: 社区迎来了一位新成员`);
        state.population.residents.push({
            id, name: `移民 ${state.day}`, age: 20, isPlayer: false,
            wealth: 10, cash: 10, job: 'UNEMPLOYED', salary: 0,
            skill: 'NOVICE', xp: 0,
            influence: 0, intelligence: 50 + Math.random()*30, leadership: 10,
            politicalStance: 'CENTRIST', happiness: 70, inventory: {}, portfolio: {}, futuresPositions: [],
            livingStandard: 'SURVIVAL', timePreference: 0.5, needs: {}, landTokens: 0,
            reservationWage: 1.0, propensityToConsume: 0.9,
            preferenceWeights: { [ProductType.BREAD]: 0.6, [ResourceType.GRAIN]: 0.3, savings: 0.1 }
        });
        pop.total++;
        pop.demographics.immigration++;
    }

    const deathThreshold = 30 * Math.min(1, 1/multiplier);
    if (pop.averageHappiness < deathThreshold && pop.total > 10) {
        const unhappy = pop.residents.filter(r => !r.isPlayer && r.happiness < 20);
        if (unhappy.length > 0) {
            const leaver = unhappy[0];
            state.population.residents = state.population.residents.filter(r => r.id !== leaver.id);
            pop.total--;
            pop.demographics.deaths++;
            state.logs.unshift(`🏃 ${leaver.name} 因生活困苦离开了山谷`);
        }
    }
};

const updateSentiment = (state: GameState, gdpFlow: GDPFlowAccumulator) => {
    const history = state.macroHistory;
    if (history.length < 2) return;
    
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    
    // Real time growth check
    const currentGdp = gdpFlow.C + gdpFlow.I + gdpFlow.G;
    const prevGdp = last.gdp || 1;
    const gdpGrowth = (currentGdp - prevGdp) / prevGdp;
    
    const inflation = last.inflation;
    const unemployment = last.unemployment;
    
    let sentiment = 50 + (gdpGrowth * 100) - (inflation * 200) - (unemployment * 100);
    sentiment = Math.max(0, Math.min(100, sentiment));
    
    state.population.consumerSentiment = parseFloat(sentiment.toFixed(1));
    
    // Propensity Update based on Sentiment
    state.population.residents.forEach(r => {
        const base = 0.8;
        const sentimentFactor = (sentiment - 50) / 200; 
        r.propensityToConsume = Math.max(0.1, Math.min(1.0, base + sentimentFactor));
        // Also update preference for savings
        if (r.preferenceWeights) {
            r.preferenceWeights.savings = 1.0 - r.propensityToConsume;
        }
    });
};

const updateCompanyLifecycle = (state: GameState) => {
    state.companies.forEach(c => {
        if (c.isBankrupt) return;
        c.age += 1;
        
        if (c.stage === 'STARTUP') {
            if (c.age > GAME_CONFIG.LIFECYCLE.STARTUP_MAX_AGE) {
                if (c.lastProfit > 0) c.stage = 'GROWTH';
                else c.stage = 'DECLINE';
                state.logs.unshift(`🏢 ${c.name} 进入 ${c.stage} 阶段`);
            }
        } else if (c.stage === 'GROWTH') {
            if (c.monthlySalesVolume > 500 || c.age > 100) {
                c.stage = 'MATURITY';
                state.logs.unshift(`🏢 ${c.name} 进入成熟期`);
            }
        } else if (c.stage === 'MATURITY') {
            if (c.lastProfit < 0 && c.monthlySalesVolume < 100) {
                c.stage = 'DECLINE';
                state.logs.unshift(`📉 ${c.name} 开始衰退`);
            }
        }
        
        const equity = (c.totalShares * c.sharePrice);
        const assets = c.cash + (c.landTokens||0)*100;
        
        c.kpis = {
            roe: equity > 0 ? c.lastProfit / equity : 0,
            roa: assets > 0 ? c.lastProfit / assets : 0,
            roi: 0.1, 
            leverage: equity > 0 ? (assets - equity) / equity : 0,
            marketShare: 0 
        };
    });
};
