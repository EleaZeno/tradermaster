
import { GameState, ResourceType, ProductType } from '../types';
import { LaborSystem } from './systems/LaborSystem';
import { ProductionSystem } from './systems/ProductionSystem';
import { MarketSystem } from './systems/MarketSystem';
import { ConsumerSystem } from './systems/ConsumerSystem';
import { FinancialSystem } from './systems/FinancialSystem';

// === 核心逻辑：游戏的一帧 (Tick) ===
export const processGameTick = (draft: GameState) => {
    // 0. 初始化计数器
    resetDailyCounters(draft);
    const flowStats = {
        [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
        [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
    };
    
    // 事件修正函数
    const getEventModifier = (target: string) => {
        let mod = 1.0;
        draft.events.filter(e => draft.day - e.turnCreated < 5).forEach(e => {
            if (e.effect && e.effect.target === target) mod += e.effect.modifier;
        });
        return mod;
    };

    // 1. 劳动力系统 (Labor): 发工资、招聘、解雇、AI 调整
    // 计算生存基准线 (粮食现价)
    const benchmark = Math.max(0.1, draft.resources[ResourceType.GRAIN].currentPrice);
    const wagePressure = getEventModifier('WAGE');
    LaborSystem.process(draft, benchmark, wagePressure);

    // 2. 生产系统 (Production): 种植、制造、腐烂
    ProductionSystem.process(draft, flowStats, getEventModifier);

    // 3. 消费系统 (Consumer): 居民买饭、吃库存、领救济
    ConsumerSystem.process(draft, flowStats);

    // 4. 金融系统 (Finance) - 优先于市场更新，因为可能涉及撒钱影响 M0
    FinancialSystem.processStockMarket(draft);
    FinancialSystem.manageFiscalPolicy(draft); // <--- 新增：自动市长调控
    FinancialSystem.runAudit(draft, flowStats);

    // 5. 市场系统 (Market): 价格更新 (现在依赖 FinancialSystem 算出的 Liquidity)
    MarketSystem.updatePrices(draft, getEventModifier);

    // 6. 杂项更新
    updatePlayerStatus(draft);
    draft.day += 1;
};

// 辅助：重置每日计数器
const resetDailyCounters = (state: GameState) => {
    state.resources[ResourceType.GRAIN].dailySales = 0;
    state.resources[ResourceType.GRAIN].demand = 0;
    state.products[ProductType.BREAD].dailySales = 0;
    state.products[ProductType.BREAD].demand = 0;
    
    state.cityTreasury.dailyIncome = 0;
    state.cityTreasury.dailyExpense = 0;
    state.cityTreasury.grainDistributedToday = 0;

    // Reset daily profit tracking for companies
    state.companies.forEach(c => {
        c.lastProfit = 0; // Will be accumulated during transactions
        // Note: In strict accounting, we should track flows differently, 
        // but for this sim, we reset and let the Systems accumulate +- 
    });
};

const updatePlayerStatus = (state: GameState) => {
    const player = state.population.residents.find(r => r.isPlayer);
    if (player) {
        state.cash = player.cash;
        player.wealth = player.cash; // Simplify wealth calc
    }
    state.population.averageWage = state.companies.length > 0 ? state.companies.reduce((s,c)=>s+c.wageOffer,0)/state.companies.length : 1.5;
};
