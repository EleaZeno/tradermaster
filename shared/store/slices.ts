
import { StateCreator } from 'zustand';
import { GameState, MarketEvent, IndustryType, Company, ResourceType, FuturesContract, Bank } from '../types';
import { INITIAL_STATE } from '../initialState';
import { processGameTick } from '../../domain/gameLogic';
import { MarketSystem } from '../../domain/systems/MarketSystem';
import { checkAchievements, ACHIEVEMENTS } from '../../services/achievementService';

// --- Types ---
export interface GameSlice {
  gameState: GameState;
  isRunning: boolean;
  gameSpeed: number;
  start: () => void;
  stop: () => void;
  setGameSpeed: (speed: number) => void;
  tick: () => void;
  addLog: (log: string) => void;
  addEvent: (event: MarketEvent) => void;
  updateChatHistory: (history: any[]) => void;
  dismissNotification: (id: string) => void;
}

export interface PlayerSlice {
  trade: (action: 'buy' | 'sell', itemId: IndustryType) => void;
  buyStock: (id: string, isFund?: boolean) => void;
  sellStock: (id: string, isFund?: boolean) => void;
  shortStock: (id: string, isFund?: boolean) => void;
  coverStock: (id: string, isFund?: boolean) => void;
  buyFutures: (resId: ResourceType, type: 'LONG' | 'SHORT') => void;
  setLivingStandard: (level: any) => void;
}

export interface CompanySlice {
  createCompany: (name: string, type: IndustryType) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  payDividend: (compId: string) => void;
  addLine: (compId: string, type: IndustryType) => void;
}

export interface BankSlice {
  updateBank: (updates: Partial<Bank>) => void;
}

export type GameStore = GameSlice & PlayerSlice & CompanySlice & BankSlice;

// --- Slices Implementation ---

export const createGameSlice: StateCreator<GameStore, [["zustand/immer", never]], [], GameSlice> = (set) => ({
  gameState: INITIAL_STATE,
  isRunning: false,
  gameSpeed: 1,

  start: () => set((state) => { state.isRunning = true }),
  stop: () => set((state) => { state.isRunning = false }),
  setGameSpeed: (speed) => set((state) => { state.gameSpeed = speed }),

  tick: () => set((state) => {
    processGameTick(state.gameState);
    if (state.gameState.logs.length > 50) state.gameState.logs = state.gameState.logs.slice(0, 50);

    // Check Achievements
    const newUnlocked = checkAchievements(state.gameState);
    newUnlocked.forEach(id => {
        state.gameState.achievements.push({ id, unlockedAt: Date.now() });
        const meta = ACHIEVEMENTS.find(a => a.id === id);
        state.gameState.notifications.push({
            id: `ach_${Date.now()}_${id}`,
            message: `🏆 解锁成就: ${meta?.name || id} - ${meta?.description}`,
            type: 'success',
            timestamp: Date.now()
        });
        state.gameState.logs.unshift(`🏆 成就解锁: ${meta?.name}`);
    });
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

  dismissNotification: (id) => set((state) => {
      const idx = state.gameState.notifications.findIndex(n => n.id === id);
      if (idx !== -1) state.gameState.notifications.splice(idx, 1);
  })
});

export const createPlayerSlice: StateCreator<GameStore, [["zustand/immer", never]], [], PlayerSlice> = (set) => ({
  trade: (action, itemId) => set((state) => {
    const residents = state.gameState.population.residents;
    const playerRes = residents.find(r => r.isPlayer);
    if (!playerRes) return;

    const isRes = Object.values(ResourceType).includes(itemId as ResourceType);
    let quantity = isRes ? 10 : 1;

    MarketSystem.submitOrder(state.gameState, {
      ownerId: playerRes.id,
      ownerType: 'RESIDENT',
      itemId: itemId,
      side: action === 'buy' ? 'BUY' : 'SELL',
      type: 'MARKET',
      price: 0,
      quantity: quantity
    });

    state.gameState.cash = playerRes.cash;
  }),

  buyStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    if (!isFund) {
      MarketSystem.submitOrder(state.gameState, {
        ownerId: player.id,
        ownerType: 'RESIDENT',
        itemId: id,
        side: 'BUY',
        type: 'MARKET',
        price: 0,
        quantity: 100
      });
      state.gameState.cash = player.cash;
    }
  }),

  sellStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    MarketSystem.submitOrder(state.gameState, {
      ownerId: player.id,
      ownerType: 'RESIDENT',
      itemId: id,
      side: 'SELL',
      type: 'MARKET',
      price: 0,
      quantity: 100
    });
    state.gameState.cash = player.cash;
  }),

  shortStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    MarketSystem.submitOrder(state.gameState, {
      ownerId: player.id,
      ownerType: 'RESIDENT',
      itemId: id,
      side: 'SELL',
      type: 'MARKET',
      price: 0,
      quantity: 100
    });

    state.gameState.cash = player.cash;
    state.gameState.logs.unshift(`📉 做空 (Short) ${id} - 100股`);
  }),

  coverStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    MarketSystem.submitOrder(state.gameState, {
      ownerId: player.id,
      ownerType: 'RESIDENT',
      itemId: id,
      side: 'BUY',
      type: 'MARKET',
      price: 0,
      quantity: 100
    });

    state.gameState.cash = player.cash;
    state.gameState.logs.unshift(`📈 平仓 (Cover) ${id} + 100股`);
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
  }),
});

export const createCompanySlice: StateCreator<GameStore, [["zustand/immer", never]], [], CompanySlice> = (set) => ({
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
        // @ts-ignore
        type: 'CORPORATION', wageStructure: 'PERFORMANCE', ceoId: 'res_player', isBankrupt: false, landTokens: 0,
        avgCost: 0, accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
        lastRevenue: 0, lastProfit: 0, monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: [],
        tobinQ: 1.0
      });
      
      // Init market for new company
      state.gameState.market[newId] = { bids: [], asks: [], lastPrice: 1.0, history: [] };

      state.gameState.logs.unshift(`🎉 ${name} 上市成功！`);
      
      // Notify
      state.gameState.notifications.push({
          id: `ipo_${Date.now()}`,
          message: `新公司 ${name} IPO 成功，当前股价 1.0 oz`,
          type: 'success',
          timestamp: Date.now()
      });
    }
  }),

  updateCompany: (id, updates) => set((state) => {
    const comp = state.gameState.companies.find(c => c.id === id);
    if (comp) Object.assign(comp, updates);
  }),

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
    state.gameState.notifications.push({
         id: `div_${Date.now()}`,
         message: `${comp.name} 发放分红，你获得了 ${(totalDiv/comp.totalShares * (comp.shareholders.find(s=>s.type === 'PLAYER')?.count || 0)).toFixed(2)} oz`,
         type: 'success',
         timestamp: Date.now()
    });
  }),

  addLine: (compId, type) => set((state) => {
    const comp = state.gameState.companies.find(c => c.id === compId);
    if (comp && comp.cash > 100) {
      comp.cash -= 100;
      comp.productionLines.push({ type, isActive: true, efficiency: 0.8, allocation: 0.2 });
      comp.productionLines.forEach(l => l.allocation = 1 / comp.productionLines.length);
    }
  }),
});

export const createBankSlice: StateCreator<GameStore, [["zustand/immer", never]], [], BankSlice> = (set) => ({
  updateBank: (updates) => set((state) => {
    Object.assign(state.gameState.bank, updates);
  }),
});
