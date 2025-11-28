
import { GameState, ResourceType, ProductType, FlowStats, GameContext, Resident, MarketEvent } from '../shared/types';
import { LaborSystem } from './systems/LaborSystem';
import { ProductionSystem } from './systems/ProductionSystem';
import { ConsumerSystem } from './systems/ConsumerSystem';
import { FinancialSystem } from './systems/FinancialSystem';
import { BankingSystem } from './systems/BankingSystem';
import { MarketSystem } from './systems/MarketSystem';
import { GAME_CONFIG } from '../shared/config';

/**
 * Main Game Loop Processor
 * Executes systems based on frequency configuration to optimize performance.
 */
export const processGameTick = (gameState: GameState): void => {
    performance.mark('tick-start');
    
    // Increment Tick Counter
    gameState.totalTicks = (gameState.totalTicks || 0) + 1;
    const currentTick = gameState.totalTicks;
    const rates = GAME_CONFIG.UPDATE_RATES;

    // --- Optimization: Build Indices & Cache (Keep lightweight if possible) ---
    // We only build full context if we are running the heavier systems
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
    // -------------------------------------------------------------------------

    // 0. Market Maintenance (Every Tick)
    // Essential for UI responsiveness and trading fluidity
    if (currentTick % rates.MARKET === 0) {
        // Only build simple context or pass partial context if needed, 
        // but MarketSystem uses context for O(1) lookups. 
        // If context is undefined (heavy systems not running), we might need to lazy load it or fallback to array find.
        // For stability, let's allow MarketSystem to fallback to array lookups if context is missing,
        // OR simple optimizations inside MarketSystem.
        MarketSystem.pruneStaleOrders(gameState, context || createFallbackContext(gameState));
    }

    // 1. Core Economy (Production, Labor, Consumption) - The "Game Day"
    if (currentTick % rates.CORE_ECO === 0 && context) {
        resetDailyCounters(gameState); // New Day starts here

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

        // Execute Systems
        LaborSystem.process(gameState, context, grainPriceBenchmark, wagePressureModifier);
        ProductionSystem.process(gameState, context, flowStats, getEventModifier);
        ConsumerSystem.process(gameState, context, flowStats);
        
        // Advance Calendar Day
        gameState.day += 1;
        updatePlayerStatus(gameState);
        
        // Run Financial Audit periodically within the Eco cycle or separately
        if (currentTick % rates.MACRO === 0) {
             FinancialSystem.runAudit(gameState, flowStats);
        }
    }

    // 2. Macro Systems (Banking, Stock Valuation)
    if (currentTick % rates.MACRO === 0 && context) {
        BankingSystem.process(gameState, context);
        FinancialSystem.processStockMarket(gameState);
        FinancialSystem.manageFiscalPolicy(gameState, context);
    }

    performance.mark('tick-end');
    performance.measure('game-tick', 'tick-start', 'tick-end');
};

const createFallbackContext = (gameState: GameState): GameContext => {
    // Fallback context creation for ticks where heavy systems don't run but Market needs lookups.
    // Ideally this shouldn't be too heavy if resident count is low (30).
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
    // Update average wage statistic
    if (gameState.companies.length > 0) {
        const totalWages = gameState.companies.reduce((sum, company) => sum + company.wageOffer, 0);
        gameState.population.averageWage = totalWages / gameState.companies.length;
    } else {
        gameState.population.averageWage = 1.5;
    }
};
