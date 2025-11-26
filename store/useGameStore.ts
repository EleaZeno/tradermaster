
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GameState, Company, ResourceType, ProductType, IndustryType, Resident, FuturesContract, MarketEvent, OrderBook } from '../types';
import { INITIAL_CITY_TREASURY, INITIAL_RESOURCES, INITIAL_PRODUCTS, INITIAL_COMPANIES, INITIAL_FUNDS, INITIAL_POPULATION, INITIAL_ELECTION, INITIAL_BANK } from '../shared/initialState';
import { GAME_CONFIG } from '../shared/config';
import { processGameTick } from '../domain/gameLogic';
import { MarketSystem } from '../domain/systems/MarketSystem';

interface GameStore {
  gameState: GameState;
  isRunning: boolean;
  gameSpeed: number; 
  
  // Actions
  start: () => void;
  stop: () => void;
  setGameSpeed: (speed: number) => void;
  tick: () => void;
  addLog: (log: string) => void;
  addEvent: (event: MarketEvent) => void; 
  updateChatHistory: (history: any[]) => void;
  
  // Game Actions
  trade: (action: 'buy' | 'sell', itemId: IndustryType) => void;
  createCompany: (name: string, type: IndustryType) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  buyStock: (id: string, isFund?: boolean) => void;
  sellStock: (id: string, isFund?: boolean) => void;
  shortStock: (id: string, isFund?: boolean) => void;
  coverStock: (id: string, isFund?: boolean) => void;
  payDividend: (compId: string) => void;
  addLine: (compId: string, type: IndustryType) => void;
  buyFutures: (resId: ResourceType, type: 'LONG' | 'SHORT') => void;
  setLivingStandard: (level: any) => void;
}

// Helper to create empty books
const createEmptyBook = (price: number): OrderBook => ({
    bids: [], asks: [], lastPrice: price, history: []
});

const market: Record<string, OrderBook> = {};
market[ResourceType.GRAIN] = createEmptyBook(1.0);
market[ProductType.BREAD] = createEmptyBook(2.0);
INITIAL_COMPANIES.forEach(c => {
    market[c.id] = createEmptyBook(c.sharePrice);
});

const INITIAL_STATE_FULL: GameState = {
    cash: GAME_CONFIG.INITIAL_PLAYER_CASH,
    day: 1,
    mayorId: 'res_mayor',
    cityTreasury: INITIAL_CITY_TREASURY,
    bank: INITIAL_BANK,
    election: INITIAL_ELECTION,
    population: INITIAL_POPULATION,
    resources: INITIAL_RESOURCES,
    products: INITIAL_PRODUCTS,
    companies: INITIAL_COMPANIES,
    funds: INITIAL_FUNDS,
    futures: [], 
    events: [],
    netWorthHistory: [{ day: 1, value: GAME_CONFIG.INITIAL_PLAYER_CASH }],
    macroHistory: [],
    chatHistory: [{ role: 'model', text: '微型社会模拟 v6.0 (Chaos Mode) 已启动。\n系统已接入本地事件引擎。', timestamp: Date.now() }],
    logs: ["🏗️ 系统初始化完成"],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    },
    market: market
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    gameState: INITIAL_STATE_FULL,
    isRunning: false,
    gameSpeed: 1, 

    start: () => set((state) => { state.isRunning = true }),
    stop: () => set((state) => { state.isRunning = false }),
    setGameSpeed: (speed) => set((state) => { state.gameSpeed = speed }),

    tick: () => set((state) => {
        processGameTick(state.gameState as any);
        if (state.gameState.logs.length > 50) state.gameState.logs = state.gameState.logs.slice(0, 50);
    }),

    addLog: (log) => set((state) => {
        state.gameState.logs.unshift(log);
    }),

    addEvent: (event) => set((state) => {
        state.gameState.events.unshift(event);
        if (state.gameState.events.length > 5) state.gameState.events.pop();
    }),

    updateChatHistory: (history) => set((state) => {
        state.gameState.chatHistory = history;
    }),

    trade: (action, itemId) => set((state) => {
          const residents = state.gameState.population.residents;
          const playerRes = residents.find(r => r.isPlayer);
          if (!playerRes) return;

          const isRes = Object.values(ResourceType).includes(itemId as ResourceType);
          let amount = isRes ? 10 : 1; 

          // Player trading via Order Book
          MarketSystem.submitOrder(state.gameState as any, {
              ownerId: playerRes.id,
              ownerType: 'RESIDENT',
              itemId: itemId,
              side: action === 'buy' ? 'BUY' : 'SELL',
              type: 'MARKET',
              price: 0,
              amount: amount
          });
          
          state.gameState.cash = playerRes.cash;
    }),

    createCompany: (name, type) => set((state) => {
        const newId = `comp_player_${Date.now()}`;
        const IPO_COST = 20;
        const playerRes = state.gameState.population.residents.find(r => r.isPlayer);
        
        if (playerRes && playerRes.cash >= IPO_COST) {
            playerRes.cash -= IPO_COST;
            playerRes.portfolio[newId] = 1000;
            playerRes.job = 'EXECUTIVE';
            playerRes.employerId = newId;
            state.gameState.cash = playerRes.cash;

            state.gameState.companies.push({
                id: newId, name: name || "New Corp",
                productionLines: [{ type, isActive: true, efficiency: 1.0, allocation: 1.0 }],
                cash: 20, sharePrice: 1.0, totalShares: 1000, ownedShares: 1000,
                shareholders: [{ id: 'res_player', name: "Player", count: 1000, type: 'PLAYER' }],
                isPlayerFounded: true, employees: 1, targetEmployees: 5, 
                wageOffer: 1.5, wageMultiplier: 1.5, 
                pricePremium: 0, executiveSalary: 3.0, dividendRate: 0, margin: 0.2,
                aiPersonality: 'BALANCED', boardMembers: [], unionTension: 0, strikeDays: 0,
                inventory: { raw: {}, finished: { [type]: 0 } },
                avgCost: 0,
                accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
                monthlySalesVolume: 0, monthlyProductionVolume: 0, lastRevenue: 0, lastProfit: 0,
                reports: [], history: [{ day: state.gameState.day, open: 1.0, high: 1.0, low: 1.0, close: 1.0, volume: 0 }],
                // @ts-ignore
                type: 'CORPORATION', wageStructure: 'PERFORMANCE', ceoId: 'res_player', isBankrupt: false, landTokens: 0
            });

            // Init Market
            state.gameState.market[newId] = createEmptyBook(1.0);

            state.gameState.logs.unshift(`🎉 ${name} 上市成功！`);
        }
    }),

    updateCompany: (id, updates) => set((state) => {
        const comp = state.gameState.companies.find(c => c.id === id);
        if (comp) Object.assign(comp, updates);
    }),

    buyStock: (id, isFund) => set((state) => {
        const player = state.gameState.population.residents.find(r => r.isPlayer);
        if (!player) return;
        
        if (!isFund) {
            MarketSystem.submitOrder(state.gameState as any, {
                ownerId: player.id,
                ownerType: 'RESIDENT',
                itemId: id,
                side: 'BUY',
                type: 'MARKET',
                price: 0,
                amount: 100 
            });
            state.gameState.cash = player.cash;
        }
    }),

    sellStock: (id, isFund) => set((state) => {
         const player = state.gameState.population.residents.find(r => r.isPlayer);
         if (!player) return;
         
         MarketSystem.submitOrder(state.gameState as any, {
            ownerId: player.id,
            ownerType: 'RESIDENT',
            itemId: id,
            side: 'SELL',
            type: 'MARKET',
            price: 0,
            amount: 100
        });
        state.gameState.cash = player.cash;
    }),
    
    shortStock: () => {}, // Implement later
    coverStock: () => {}, // Implement later
    
    payDividend: (compId) => set((state) => {
        const comp = state.gameState.companies.find(c => c.id === compId);
        if (!comp || comp.cash < 20) return;
        const totalDiv = comp.cash * 0.5;
        comp.cash -= totalDiv;
        const perShare = totalDiv / comp.totalShares;
        
        comp.shareholders.forEach(s => {
            if (s.type === 'PLAYER') {
                 const p = state.gameState.population.residents.find(r => r.isPlayer);
                 if (p) { p.cash += s.count * perShare; state.gameState.cash = p.cash; }
            }
        });
        state.gameState.logs.unshift(`💸 ${comp.name} 分红 ${totalDiv.toFixed(0)} oz`);
    }),

    addLine: (compId, type) => set((state) => {
        const comp = state.gameState.companies.find(c => c.id === compId);
        if (comp && comp.cash > 100) {
            comp.cash -= 100;
            comp.productionLines.push({ type, isActive: true, efficiency: 0.8, allocation: 0.2 });
            comp.productionLines.forEach(l => l.allocation = 1 / comp.productionLines.length);
        }
    }),

    buyFutures: (resId, type) => set((state) => {
        const res = state.gameState.resources[resId];
        const player = state.gameState.population.residents.find(r => r.isPlayer);
        const amount = 50;
        const margin = res.currentPrice * amount * 0.2;
        
        if (player && player.cash >= margin) {
            player.cash -= margin;
            state.gameState.cash = player.cash;
            const contract: FuturesContract = {
                id: `fut_${Date.now()}`, resourceId: resId, type, amount, entryPrice: res.currentPrice, dueDate: state.gameState.day + 7
            };
            player.futuresPositions.push(contract);
            state.gameState.futures.push(contract);
            state.gameState.logs.unshift(`📜 开仓 ${type} ${res.name}`);
        }
    }),

    setLivingStandard: (level) => set((state) => {
        const p = state.gameState.population.residents.find(r => r.isPlayer);
        if (p) p.livingStandard = level;
    })
  }))
);
