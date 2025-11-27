
import { GameState, ResourceType, ProductType, FlowStats, GameContext, Resident } from '../shared/types';
import { LaborSystem } from './systems/LaborSystem';
import { ProductionSystem } from './systems/ProductionSystem';
import { ConsumerSystem } from './systems/ConsumerSystem';
import { FinancialSystem } from './systems/FinancialSystem';
import { BankingSystem } from './systems/BankingSystem';
import { MarketSystem } from './systems/MarketSystem';

/**
 * Main Game Loop Processor
 * Executes all sub-systems in order for a single game day.
 */
export const processGameTick = (gameState: GameState): void => {
    performance.mark('tick-start');

    resetDailyCounters(gameState);
    
    // --- OPTIMIZATION: Build Indices & Cache ---
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

    const context: GameContext = {
        residentMap,
        companyMap,
        employeesByCompany,
        residentsByJob
    };
    // -----------------------------------------------------------------------------------------
    
    const flowStats: FlowStats = {
        [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
        [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
    };
    
    const getEventModifier = (target: string): number => {
        let modifier = 1.0;
        const activeEvents = gameState.events.filter(event => gameState.day - event.turnCreated < 5);
        activeEvents.forEach(event => {
            if (event.effect && event.effect.target === target) {
                modifier += event.effect.modifier;
            }
        });
        return modifier;
    };

    // 0. Market Maintenance (Crucial for preventing liquidity locks)
    MarketSystem.pruneStaleOrders(gameState, context);

    // 0. Banking System (Credit Creation/Destruction)
    BankingSystem.process(gameState, context);

    // 1. Labor System
    const grainPriceBenchmark = Math.max(0.1, gameState.resources[ResourceType.GRAIN].currentPrice);
    const wagePressureModifier = getEventModifier('WAGE');
    LaborSystem.process(gameState, context, grainPriceBenchmark, wagePressureModifier);

    // 2. Production System (Cobb-Douglas)
    ProductionSystem.process(gameState, context, flowStats, getEventModifier);

    // 3. Consumer System (Keynesian)
    ConsumerSystem.process(gameState, context, flowStats);

    // 4. Financial System
    FinancialSystem.processStockMarket(gameState);
    FinancialSystem.manageFiscalPolicy(gameState, context); 
    FinancialSystem.runAudit(gameState, flowStats);

    // Finalize Turn
    updatePlayerStatus(gameState);
    gameState.day += 1;

    performance.mark('tick-end');
    performance.measure('game-tick', 'tick-start', 'tick-end');
};

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
