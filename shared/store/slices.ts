
import { StateCreator } from 'zustand';
import { GameState, MarketEvent, IndustryType, Company, ResourceType, FuturesContract, Bank, GameSettings, Resident, CompanyType, WageStructure, PolicyOverrides, MonetarySystemType } from '../types';
import { INITIAL_STATE } from '../initialState';
import { processGameTick } from '../../application/GameLoop';
import { MarketService } from '../../domain/market/MarketService';
import { checkAchievements, ACHIEVEMENTS } from '../../services/achievementService';

export interface UISlice {
  addLog: (log: string) => void;
  addEvent: (event: MarketEvent) => void;
  updateChatHistory: (history: any[]) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<GameSettings> | Partial<GameSettings['notifications']>) => void;
}

export interface MarketSlice {
  trade: (action: 'buy' | 'sell', itemId: IndustryType) => void;
  buyFutures: (resId: ResourceType, type: 'LONG' | 'SHORT') => void;
}

export interface PlayerSlice {
  buyStock: (id: string, isFund?: boolean) => void;
  sellStock: (id: string, isFund?: boolean) => void;
  shortStock: (id: string, isFund?: boolean) => void;
  coverStock: (id: string, isFund?: boolean) => void;
  setLivingStandard: (level: Resident['livingStandard']) => void;
}

export interface CompanySlice {
  createCompany: (name: string, type: IndustryType) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  payDividend: (compId: string) => void;
  addLine: (compId: string, type: IndustryType) => void;
}

export interface BankSlice {
  updateBank: (updates: Partial<Bank>) => void;
  setMonetarySystem: (system: MonetarySystemType) => void;
}

export interface GameSlice {
  gameState: GameState;
  isRunning: boolean;
  gameSpeed: number;
  start: () => void;
  stop: () => void;
  setGameSpeed: (speed: number) => void;
  tick: () => void;
  setPolicyOverride: (overrides: Partial<PolicyOverrides>) => void;
}

export type GameStore = GameSlice & UISlice & MarketSlice & PlayerSlice & CompanySlice & BankSlice;

export const createUISlice: StateCreator<GameStore, [["zustand/immer", never]], [], UISlice> = (set) => ({
  addLog: (log) => set((state) => {
    state.gameState.logs.unshift(log);
    if (state.gameState.logs.length > 50) state.gameState.logs.pop();
  }),

  addEvent: (event) => set((state) => {
    state.gameState.events.unshift(event);
    if (state.gameState.events.length > 5) state.gameState.events.pop();

    if (event.type === 'NEWS' && state.gameState.settings.notifications.news) {
        state.gameState.notifications.push({
            id: `news_${Date.now()}`,
            message: `📰 ${event.headline}`,
            type: event.impactType === 'BAD' ? 'error' : event.impactType === 'GOOD' ? 'success' : 'info',
            timestamp: Date.now()
        });
    }
  }),

  updateChatHistory: (history) => set((state) => {
    state.gameState.chatHistory = history;
  }),

  dismissNotification: (id) => set((state) => {
      const idx = state.gameState.notifications.findIndex(n => n.id === id);
      if (idx !== -1) state.gameState.notifications.splice(idx, 1);
  }),

  clearNotifications: () => set((state) => {
      state.gameState.notifications = [];
  }),

  updateSettings: (settings) => set((state) => {
      if ('trades' in settings || 'achievements' in settings || 'news' in settings) {
          Object.assign(state.gameState.settings.notifications, settings);
      } else {
          Object.assign(state.gameState.settings, settings);
      }
  })
});

export const createMarketSlice: StateCreator<GameStore, [["zustand/immer", never]], [], MarketSlice> = (set) => ({
  trade: (action, itemId) => set((state) => {
    const residents = state.gameState.population.residents;
    const playerRes = residents.find(r => r.isPlayer);
    if (!playerRes) return;

    const isRes = Object.values(ResourceType).includes(itemId as ResourceType);
    let quantity = isRes ? 10 : 1;

    MarketService.submitOrder(state.gameState, {
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
});

export const createPlayerSlice: StateCreator<GameStore, [["zustand/immer", never]], [], PlayerSlice> = (set) => ({
  buyStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    if (!isFund) {
      MarketService.submitOrder(state.gameState, {
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

    MarketService.submitOrder(state.gameState, {
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

    MarketService.submitOrder(state.gameState, {
      ownerId: player.id,
      ownerType: 'RESIDENT',
      itemId: id,
      side: 'SELL',
      type: 'MARKET',
      price: 0,
      quantity: 100
    });

    state.gameState.cash = player.cash;
    state.gameState.logs.unshift(`📈 做空 (Short) ${id} - 100股`);
  }),

  coverStock: (id, isFund) => set((state) => {
    const player = state.gameState.population.residents.find(r => r.isPlayer);
    if (!player) return;

    MarketService.submitOrder(state.gameState, {
      ownerId: player.id,
      ownerType: 'RESIDENT',
      itemId: id,
      side: 'BUY',
      type: 'MARKET',
      price: 0,
      quantity: 100
    });

    state.gameState.cash = player.cash;
    state.gameState.logs.unshift(`📉 平仓 (Cover) ${id} + 100股`);
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
        type: CompanyType.CORPORATION, 
        wageStructure: WageStructure.PERFORMANCE, 
        ceoId: 'res_player', 
        isBankrupt: false, 
        landTokens: 0,
        avgCost: 0,
        lastFixedCost: 0,
        accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
        lastRevenue: 0, lastProfit: 0, monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: [],
        tobinQ: 1.0,
        age: 0,
        stage: 'STARTUP',
        kpis: { roe: 0, roa: 0, roi: 0, leverage: 0, marketShare: 0 }
      });
      
      state.gameState.market[newId] = { bids: [], asks: [], lastPrice: 1.0, history: [] };

      state.gameState.logs.unshift(`🎉 ${name} 上市成功！`);
      
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
  setMonetarySystem: (system) => set((state) => {
    state.gameState.bank.system = system;
    state.gameState.logs.unshift(`🏦 货币制度变更为: ${system === 'GOLD_STANDARD' ? '金本位 (Gold Standard)' : '信用货币 (Fiat Money)'}`);
    
    // Immediate effect: Adjust Interest Rates to reflect regime change
    if (system === 'GOLD_STANDARD') {
        // Gold standard often had higher deflationary bias, set rates to protect reserves
        state.gameState.bank.loanRate = 0.05; 
        state.gameState.bank.depositRate = 0.04;
    } else {
        // Fiat resets to a low rate to stimulate
        state.gameState.bank.loanRate = 0.02;
        state.gameState.bank.depositRate = 0.01;
    }
  }),
});

export const createGameSlice: StateCreator<GameStore, [["zustand/immer", never]], [], GameSlice> = (set) => ({
  gameState: INITIAL_STATE,
  isRunning: false,
  gameSpeed: 1,

  start: () => set((state) => { state.isRunning = true }),
  stop: () => set((state) => { state.isRunning = false }),
  setGameSpeed: (speed) => set((state) => { state.gameSpeed = speed }),
  
  setPolicyOverride: (overrides) => set((state) => {
      Object.assign(state.gameState.policyOverrides, overrides);
  }),

  tick: () => set((state) => {
    processGameTick(state.gameState);
    if (state.gameState.logs.length > 50) state.gameState.logs = state.gameState.logs.slice(0, 50);

    const now = Date.now();
    state.gameState.notifications = state.gameState.notifications.filter(n => now - n.timestamp < 5000);
    
    if (state.gameState.notifications.length > 4) {
         state.gameState.notifications = state.gameState.notifications.slice(-4);
    }

    const newUnlocked = checkAchievements(state.gameState);
    if (newUnlocked.length > 0) {
        newUnlocked.forEach(id => {
            state.gameState.achievements.push({ id, unlockedAt: Date.now() });
            const meta = ACHIEVEMENTS.find(a => a.id === id);
            
            if (state.gameState.settings.notifications.achievements) {
                const isEn = state.gameState.settings.language === 'en';
                const msg = isEn 
                    ? `🏆 Achievement Unlocked: ${meta?.name || id}`
                    : `🏆 解锁成就: ${meta?.name || id} - ${meta?.description}`;
                
                state.gameState.notifications.push({
                    id: `ach_${Date.now()}_${id}`,
                    message: msg,
                    type: 'success',
                    timestamp: Date.now()
                });
            }
            state.gameState.logs.unshift(`🏆 成就解锁: ${meta?.name}`);
        });
    }
  }),
});
