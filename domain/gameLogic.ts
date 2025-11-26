import { GameState, ResourceType, ProductType } from '../shared/types';
import { LaborSystem } from './systems/LaborSystem';
import { ProductionSystem } from './systems/ProductionSystem';
import { MarketSystem } from './systems/MarketSystem';
import { ConsumerSystem } from './systems/ConsumerSystem';
import { FinancialSystem } from './systems/FinancialSystem';

/**
 * Main Game Loop Processor
 * Executes all sub-systems in order for a single game day.
 */
export const processGameTick = (gameState: GameState) => {
    resetDailyCounters(gameState);
    
    // Track production flows for auditing
    const flowStats = {
        [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
        [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
    };
    
    // Helper to calculate modifiers from active events
    const getEventModifier = (target: string) => {
        let modifier = 1.0;
        // Filter events created within the last 5 days
        const activeEvents = gameState.events.filter(event => gameState.day - event.turnCreated < 5);
        activeEvents.forEach(event => {
            if (event.effect && event.effect.target === target) {
                modifier += event.effect.modifier;
            }
        });
        return modifier;
    };

    // 1. Labor System: Wages, Employment, Social Mobility
    const grainPriceBenchmark = Math.max(0.1, gameState.resources[ResourceType.GRAIN].currentPrice);
    const wagePressureModifier = getEventModifier('WAGE');
    LaborSystem.process(gameState, grainPriceBenchmark, wagePressureModifier);

    // 2. Production System: Farming, Manufacturing, Spoilage
    ProductionSystem.process(gameState, flowStats, getEventModifier);

    // 3. Consumer System: Eating, Buying Food, Happiness
    ConsumerSystem.process(gameState, flowStats);

    // 4. Financial System: Stock Market, Fiscal Policy, Audits
    FinancialSystem.processStockMarket(gameState);
    FinancialSystem.manageFiscalPolicy(gameState); 
    FinancialSystem.runAudit(gameState, flowStats);

    // 5. Market System: Price Updates
    MarketSystem.updatePrices(gameState, getEventModifier);

    // Finalize Turn
    updatePlayerStatus(gameState);
    gameState.day += 1;
};

const resetDailyCounters = (gameState: GameState) => {
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

const updatePlayerStatus = (gameState: GameState) => {
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