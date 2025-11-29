


import { GameState, ResourceType, ProductType, FlowStats, GameContext, GDPFlowAccumulator } from '../shared/types';
import { GameContextFactory } from '../shared/utils/GameContextFactory';
import { LaborService } from '../domain/labor/LaborService';
import { ProductionService } from '../domain/company/ProductionService';
import { CompanyService } from '../domain/company/CompanyService';
import { PlayerService } from '../domain/player/PlayerService';
import { ConsumerService } from '../domain/consumer/ConsumerService';
import { StockMarketService } from '../domain/finance/StockMarketService';
import { BankingService } from '../domain/finance/BankingService';
import { MarketService } from '../domain/market/MarketService';
import { EventService } from '../domain/events/EventService';
import { DemographicsService } from '../domain/demographics/DemographicsService';
import { GDPService } from '../domain/macro/GDPService';
import { FiscalService } from '../domain/macro/FiscalService';
import { BusinessCycleService } from '../domain/macro/BusinessCycleService';
import { HealthCheckService } from '../domain/analytics/HealthCheckService';
import { SanityCheckSystem } from '../domain/analytics/SanityCheckSystem';
import { GAME_CONFIG } from '../shared/config';

// --- Profiling Helper ---
const measure = (name: string, fn: () => void) => {
    if (typeof performance !== 'undefined' && performance.mark) {
        const startName = `${name}-start`;
        const endName = `${name}-end`;
        performance.mark(startName);
        fn();
        performance.mark(endName);
        performance.measure(name, startName, endName);
    } else {
        fn();
    }
};

const runMarketPipeline = (state: GameState, context: GameContext) => {
    MarketService.pruneStaleOrders(state, context);
};

const runDailyPipeline = (state: GameState, context: GameContext) => {
    resetDailyCounters(state);
    
    const gdpFlow: GDPFlowAccumulator = { C: 0, I: 0, G: 0 };
    const flowStats: FlowStats = {
        [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
        [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
    };

    measure('eco-events', () => EventService.process(state));
    const eventModifier = (t: string) => EventService.getModifier(state, t);

    measure('eco-monetary', () => BankingService.applyMonetaryPolicy(state));
    measure('eco-labor-cond', () => LaborService.updateMarketConditions(state));
    measure('eco-demographics', () => DemographicsService.process(state, gdpFlow));
    measure('eco-consumer', () => ConsumerService.process(state, context, flowStats, gdpFlow));

    const grainPriceBenchmark = Math.max(0.1, state.resources[ResourceType.GRAIN].currentPrice);
    const wageMod = eventModifier('WAGE');
    
    measure('eco-labor-hire', () => LaborService.processPayrollAndHiring(state, context, grainPriceBenchmark, wageMod, gdpFlow));
    measure('eco-production', () => ProductionService.process(state, context, flowStats, eventModifier, gdpFlow));
    measure('eco-banking-ops', () => BankingService.processFinancials(state, context));

    measure('eco-lifecycle', () => {
        CompanyService.updateLifecycle(state);
        PlayerService.updateStatus(state);
    });

    state.day += 1;

    measure('eco-accounting', () => GDPService.process(state, flowStats, gdpFlow));
    
    // Final Safety Check
    measure('eco-sanity', () => SanityCheckSystem.check(state));
};

const runMacroPipeline = (state: GameState, context: GameContext) => {
    measure('macro-stocks', () => StockMarketService.processStockMarket(state));
    measure('macro-fiscal', () => FiscalService.process(state, context));
    measure('macro-cycle', () => BusinessCycleService.updateCycle(state));
    measure('macro-health', () => HealthCheckService.updateHealthIndex(state));
};

export const processGameTick = (gameState: GameState): void => {
    performance.mark('tick-start');
    
    gameState.totalTicks = (gameState.totalTicks || 0) + 1;
    const currentTick = gameState.totalTicks;
    const rates = GAME_CONFIG.UPDATE_RATES;

    const isCoreTick = currentTick % rates.CORE_ECO === 0;
    const isMacroTick = currentTick % rates.MACRO === 0;
    const isMarketTick = currentTick % rates.MARKET === 0;

    let context: GameContext;
    if (isCoreTick || isMacroTick) {
        context = GameContextFactory.build(gameState);
    } else {
        context = GameContextFactory.buildLite(gameState);
    }

    if (isMarketTick) measure('pipeline-market', () => runMarketPipeline(gameState, context));
    if (isCoreTick) measure('pipeline-daily', () => runDailyPipeline(gameState, context));
    if (isMacroTick) measure('pipeline-macro', () => runMacroPipeline(gameState, context));

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
    CompanyService.resetDailyCounters(gameState);
};
