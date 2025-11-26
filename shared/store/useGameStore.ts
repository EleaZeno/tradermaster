import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GameState, Company, ResourceType, ProductType, IndustryType, Resident, FuturesContract, MarketEvent } from '../types';
import { INITIAL_PLAYER_CASH, INITIAL_CITY_TREASURY, INITIAL_RESOURCES, INITIAL_PRODUCTS, INITIAL_COMPANIES, INITIAL_FUNDS, INITIAL_POPULATION, INITIAL_ELECTION } from '../../constants';
import { processGameTick } from '../../domain/gameLogic';

interface GameStore {
  gameState: GameState;
  isRunning: boolean;
  gameSpeed: number;
  
  // Actions
  start: (v?: boolean) => void;
  stop: (v?: boolean) => void;
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

const INITIAL_STATE: GameState = {
    cash: INITIAL_PLAYER_CASH,
    day: 1,
    mayorId: 'res_mayor',
    cityTreasury: INITIAL_CITY_TREASURY,
    election: INITIAL_ELECTION,
    population: INITIAL_POPULATION,
    resources: INITIAL_RESOURCES,
    products: INITIAL_PRODUCTS,
    companies: INITIAL_COMPANIES,
    funds: INITIAL_FUNDS,
    futures: [], 
    events: [],
    netWorthHistory: [{ day: 1, value: INITIAL_PLAYER_CASH }],
    macroHistory: [],
    chatHistory: [{ role: 'model', text: '微型社会模拟 v6.0 (Chaos Mode) 已启动。\n系统已接入本地事件引擎。', timestamp: Date.now() }],
    logs: ["🏗️ 系统初始化完成"],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    }
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    gameState: INITIAL_STATE,
    isRunning: false,
    gameSpeed: 1, 

    start: (v) => set((state) => { state.isRunning = true }),
    stop: (v) => set((state) => { state.isRunning = false }),
    setGameSpeed: (speed) => set((state) => { state.gameSpeed = speed }),

    tick: () => set((state) => {
        processGameTick(state.gameState);
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
          const price = isRes 
            ? state.gameState.resources[itemId as ResourceType].currentPrice 
            : state.gameState.products[itemId as ProductType].marketPrice;
            
          let amount = isRes ? 10 : 1; 
          let cost = price * amount;

          if (action === 'buy') {
               if (playerRes.cash >= cost) {
                   playerRes.cash -= cost;
                   state.gameState.cash = playerRes.cash;
                   playerRes.inventory[itemId] = (playerRes.inventory[itemId] || 0) + amount;
                   
                   if (isRes) {
                       state.gameState.resources[itemId as ResourceType].marketInventory -= amount;
                        const gatherers = residents.filter(r => r.job === 'FARMER');
                        if (gatherers.length > 0) gatherers.forEach(g => g.cash += cost / gatherers.length);
                   } else {
                       const seller = state.gameState.companies.find(c => (c.inventory.finished[itemId as ProductType] || 0) > 0);
                       if (seller) {
                           seller.inventory.finished[itemId as ProductType]! -= amount;
                           seller.cash += cost;
                       }
                   }
               }
          } else {
               if ((playerRes.inventory[itemId] || 0) >= amount) {
                   playerRes.inventory[itemId]! -= amount;
                   playerRes.cash += cost * 0.8; 
                   state.gameState.cash = playerRes.cash;
                   if (isRes) state.gameState.resources[itemId as ResourceType].marketInventory += amount;
               }
          }
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
                inventory: { raw: {}, finished: {} }, avgCost: 0,
                accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
                monthlySalesVolume: 0, monthlyProductionVolume: 0, lastRevenue: 0, lastProfit: 0,
                reports: [], history: [{ day: state.gameState.day, open: 1.0, high: 1.0, low: 1.0, close: 1.0, volume: 0 }],
                // @ts-ignore
                type: 'CORPORATION', wageStructure: 'PERFORMANCE', ceoId: 'res_player', isBankrupt: false
            });
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
            const comp = state.gameState.companies.find(c => c.id === id);
            if (comp) {
                const cost = comp.sharePrice * 100;
                if (player.cash >= cost) {
                    player.cash -= cost;
                    state.gameState.cash = player.cash;
                    player.portfolio[id] = (player.portfolio[id] || 0) + 100;
                    comp.ownedShares += 100;
                    
                    const sh = comp.shareholders.find(s => s.type === 'PLAYER');
                    if (sh) sh.count += 100;
                    else comp.shareholders.push({id: 'res_player', name: 'Player', count: 100, type: 'PLAYER'});
                }
            }
        }
    }),

    sellStock: (id, isFund) => set((state) => {
         const player = state.gameState.population.residents.find(r => r.isPlayer);
         if (!player) return;
         
         const current = player.portfolio[id] || 0;
         if (current >= 100) {
             const comp = state.gameState.companies.find(c => c.id === id);
             if (comp) {
                 const val = comp.sharePrice * 100;
                 player.cash += val;
                 state.gameState.cash = player.cash;
                 player.portfolio[id] -= 100;
                 comp.ownedShares -= 100;
                 const sh = comp.shareholders.find(s => s.type === 'PLAYER');
                 if (sh) sh.count -= 100;
             }
         }
    }),
    
    shortStock: () => {}, 
    coverStock: () => {}, 
    
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