# EcoTycoon AI - Codebase Context

## 1. Project Directory Structure

```text
src/
├── application/
│   └── GameLoop.ts              # Main game loop orchestration
├── domain/
│   ├── analytics/               # Health checks and economic analysis
│   ├── company/                 # Production logic
│   ├── consumer/                # Consumer behavior (Utility, Budgeting)
│   ├── demographics/            # Population dynamics
│   ├── events/                  # Event processing
│   ├── finance/                 # Banking, Stock Market, Transactions
│   ├── labor/                   # Wage setting, Hiring/Firing
│   ├── macro/                   # GDP, Fiscal Policy
│   └── market/                  # LOB (Limit Order Book) Matching Engine
├── features/                    # React UI Feature Components
│   ├── banking/
│   ├── cityhall/
│   ├── commodities/
│   ├── companies/
│   ├── stats/
│   └── validation/
├── infrastructure/
│   └── ai/                      # Gemini API Integration
├── shared/
│   ├── components/              # Reusable UI components
│   ├── config.ts                # Game Constants
│   ├── hooks/                   # React Hooks
│   ├── initialState.ts          # Default Game State
│   ├── store/                   # Zustand State Management
│   ├── types/                   # TypeScript Interfaces
│   └── utils/
├── App.tsx                      # Main Entry Component
└── main.tsx
```

---

## 2. Core Files (Real Code)

### `application/GameLoop.ts`
```typescript
import { GameState, ResourceType, ProductType, FlowStats, GameContext, Resident, GDPFlowAccumulator } from '../shared/types';
import { LaborService } from '../domain/labor/LaborService';
import { ProductionService } from '../domain/company/ProductionService';
import { ConsumerService } from '../domain/consumer/ConsumerService';
import { StockMarketService } from '../domain/finance/StockMarketService';
import { BankingService } from '../domain/finance/BankingService';
import { MarketService } from '../domain/market/MarketService';
import { EventService } from '../domain/events/EventService';
import { DemographicsService } from '../domain/demographics/DemographicsService';
import { GDPService } from '../domain/macro/GDPService';
import { FiscalService } from '../domain/macro/FiscalService';
import { GAME_CONFIG } from '../shared/config';

export const processGameTick = (gameState: GameState): void => {
    performance.mark('tick-start');
    
    gameState.totalTicks = (gameState.totalTicks || 0) + 1;
    const currentTick = gameState.totalTicks;
    const rates = GAME_CONFIG.UPDATE_RATES;

    // 0. Context Building (Optimization)
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

    // --- High Frequency: Market Matching ---
    if (currentTick % rates.MARKET === 0) {
        // Essential for UI responsiveness and trading fluidity
        MarketService.pruneStaleOrders(gameState, context || createFallbackContext(gameState));
    }

    // --- Medium Frequency: Core Economic Cycle ---
    if (currentTick % rates.CORE_ECO === 0 && context) {
        resetDailyCounters(gameState); 
        
        // GDP Flow Accumulator for this day
        const gdpFlow: GDPFlowAccumulator = { C: 0, I: 0, G: 0 };
        const flowStats: FlowStats = {
            [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
            [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
        };

        // Step 1: External Shocks & Events
        EventService.process(gameState); 
        const eventModifier = (t: string) => EventService.getModifier(gameState, t);

        // Step 2: Monetary Policy (Central Bank Sets Rates)
        BankingService.applyMonetaryPolicy(gameState);

        // Step 3: Labor Market Updates (Wage Setting & Skills)
        LaborService.updateMarketConditions(gameState);

        // Step 4: Demographics & Sentiment
        DemographicsService.process(gameState, gdpFlow);

        // Step 5: Consumer Demand (Budgeting & Ordering)
        ConsumerService.process(gameState, context, flowStats, gdpFlow);

        // Step 6: Production & Employment (Supply Response)
        const grainPriceBenchmark = Math.max(0.1, gameState.resources[ResourceType.GRAIN].currentPrice);
        const wageMod = eventModifier('WAGE');
        
        // Hiring/Payroll
        LaborService.processPayrollAndHiring(gameState, context, grainPriceBenchmark, wageMod, gdpFlow);
        
        // Production/Sales/Inventory
        ProductionService.process(gameState, context, flowStats, eventModifier, gdpFlow);

        // Step 8: Financial Operations (Banking)
        if (currentTick % rates.MACRO === 0) {
             BankingService.processFinancials(gameState, context);
        }

        updateCompanyLifecycle(gameState);
        updatePlayerStatus(gameState);
        gameState.day += 1;
        
        // Step 9: Macro Audit & GDP Calculation
        if (currentTick % rates.MACRO === 0) {
             GDPService.process(gameState, flowStats, gdpFlow);
        }
    }

    // --- Low Frequency: Fiscal & Valuation ---
    if (currentTick % rates.MACRO === 0 && context) {
        StockMarketService.processStockMarket(gameState);
        FiscalService.process(gameState, context);
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
    gameState.companies.forEach(company => { company.lastProfit = 0; });
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
```

### `domain/market/MarketService.ts`
```typescript
import { GameState, Order, OrderBook, GameContext, Trade, ResourceType, ProductType } from '../../shared/types';

export class MarketService {
  
  static submitOrder(
      state: GameState, 
      order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>,
      context?: GameContext
  ): boolean {
      if (order.type === 'LIMIT' && order.price <= 0) return false;
      if (order.quantity <= 0) return false;

      // 1. Lock Assets (Escrow)
      if (!MarketService.lockAssets(state, order, context)) return false;

      const fullOrder: Order = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          quantity: order.quantity,
          remainingQuantity: order.quantity,
          status: 'PENDING',
          timestamp: state.day
      };

      if (!state.market[order.itemId]) {
          state.market[order.itemId] = { bids: [], asks: [], lastPrice: order.price || 1.0, history: [] };
      }
      const book = state.market[order.itemId];

      // 2. Insert into LOB
      const isBuy = fullOrder.side === 'BUY';
      const bookSide = isBuy ? book.bids : book.asks;
      bookSide.push(fullOrder);
      
      // 3. Strict Sort: Price Priority, then Time Priority
      if (isBuy) {
          // Bids: Highest Price First
          bookSide.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
          // Asks: Lowest Price First
          bookSide.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }

      // 4. Try Match
      MarketService.matchOrder(state, book, fullOrder, context);

      return true;
  }

  static cancelOrder(state: GameState, orderId: string, itemId: string, context?: GameContext): void {
      const book = state.market[itemId];
      if (!book) return;

      const bidIndex = book.bids.findIndex(o => o.id === orderId);
      if (bidIndex !== -1) {
          const order = book.bids[bidIndex];
          MarketService.refundAssets(state, order, order.remainingQuantity, context);
          order.status = 'CANCELLED';
          book.bids.splice(bidIndex, 1);
          return;
      }

      const askIndex = book.asks.findIndex(o => o.id === orderId);
      if (askIndex !== -1) {
          const order = book.asks[askIndex];
          MarketService.refundAssets(state, order, order.remainingQuantity, context);
          order.status = 'CANCELLED';
          book.asks.splice(askIndex, 1);
          return;
      }
  }

  static pruneStaleOrders(state: GameState, context: GameContext): void {
      const TTL = 3; 
      Object.keys(state.market).forEach(itemId => {
          const book = state.market[itemId];
          // Filter Bids
          for (let i = book.bids.length - 1; i >= 0; i--) {
              if (state.day - book.bids[i].timestamp > TTL) {
                  const order = book.bids[i];
                  MarketService.refundAssets(state, order, order.remainingQuantity, context);
                  order.status = 'CANCELLED';
                  book.bids.splice(i, 1);
              }
          }
          // Filter Asks
          for (let i = book.asks.length - 1; i >= 0; i--) {
              if (state.day - book.asks[i].timestamp > TTL) {
                  const order = book.asks[i];
                  MarketService.refundAssets(state, order, order.remainingQuantity, context);
                  order.status = 'CANCELLED';
                  book.asks.splice(i, 1);
              }
          }
      });
  }

  private static lockAssets(state: GameState, order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>, context?: GameContext): boolean {
      let costToLock = 0;
      let itemToLock = 0;

      if (order.side === 'BUY') {
          if (order.type === 'LIMIT') {
              costToLock = order.price * order.quantity;
          } else {
             // Market Buy protection: Lock 1.2x best ask
             const book = state.market[order.itemId];
             if (!book || book.asks.length === 0) return false;
             const bestAsk = book.asks[0].price;
             costToLock = bestAsk * order.quantity * 1.2; 
          }
      } else {
          itemToLock = order.quantity;
      }

      // Logic for RESIDENT, COMPANY, TREASURY asset locking...
      // (Simplified: Checks balance, deducts if sufficient, returns true/false)
      // See full implementation in codebase.
      // ...
      return true; // Placeholder for logic shown in previous context
  }

  private static refundAssets(state: GameState, order: Order, amountToRefund: number, context?: GameContext): void {
      // Logic to return Cash or Items to Owner...
  }

  private static matchOrder(state: GameState, book: OrderBook, triggerOrder: Order, context?: GameContext): void {
      const isBuy = triggerOrder.side === 'BUY';
      const opposingBook = isBuy ? book.asks : book.bids;
      
      let matchCount = 0;

      for (let i = 0; i < opposingBook.length; i++) {
          const maker = opposingBook[i];
          
          if (triggerOrder.remainingQuantity <= 0.0001) {
              triggerOrder.status = 'EXECUTED';
              break;
          }

          if (!MarketService.canMatch(triggerOrder, maker)) break;

          const matchQty = Math.min(triggerOrder.remainingQuantity, maker.remainingQuantity);
          const matchPrice = maker.price; 

          MarketService.executeTradeTransfer(state, triggerOrder, maker, matchPrice, matchQty, context);

          maker.remainingQuantity -= matchQty;
          triggerOrder.remainingQuantity -= matchQty;

          if (maker.remainingQuantity <= 0.0001) {
              maker.status = 'EXECUTED';
              matchCount++; 
          } else {
              maker.status = 'PARTIALLY_EXECUTED';
          }
          
          triggerOrder.status = triggerOrder.remainingQuantity <= 0.0001 ? 'EXECUTED' : 'PARTIALLY_EXECUTED';

          MarketService.recordTrade(state, book, triggerOrder, maker, matchPrice, matchQty);
          MarketService.updateCandle(state, triggerOrder.itemId, matchPrice, matchQty, context);
          MarketService.applyTradeTax(state, triggerOrder, maker, matchPrice, matchQty, context);
      }

      if (matchCount > 0) {
          opposingBook.splice(0, matchCount);
      }

      MarketService.handleOrderRemainder(state, book, triggerOrder, context);
  }

  private static canMatch(taker: Order, maker: Order): boolean {
      if (taker.type === 'LIMIT') {
          if (taker.side === 'BUY') return maker.price <= taker.price;
          else return maker.price >= taker.price;
      }
      return true; 
  }

  private static handleOrderRemainder(state: GameState, book: OrderBook, taker: Order, context?: GameContext): void {
      if (taker.remainingQuantity <= 0.0001) return;

      if (taker.type === 'LIMIT') {
          if (taker.status === 'EXECUTED') {
              const side = taker.side === 'BUY' ? book.bids : book.asks;
              const idx = side.indexOf(taker);
              if (idx > -1) side.splice(idx, 1);
          }
      } else {
          // Market Order Remainder: Refund and Remove
          if (taker.side === 'BUY') {
               const book = state.market[taker.itemId];
               const bestAsk = book?.asks[0]?.price || taker.price || 1.0; 
               const refundCash = bestAsk * taker.remainingQuantity * 1.2; 
               // Refund logic...
          } else {
              MarketService.refundAssets(state, taker, taker.remainingQuantity, context);
          }
          taker.status = 'EXECUTED'; 
          const side = taker.side === 'BUY' ? book.bids : book.asks;
          const idx = side.indexOf(taker);
          if (idx > -1) side.splice(idx, 1);
      }
  }

  private static executeTradeTransfer(state: GameState, taker: Order, maker: Order, price: number, qty: number, context?: GameContext): void {
      // Transfer Goods & Cash logic...
      // Handles transfers between Residents, Companies, and Treasury
  }

  // ... (deductTax, recordTrade, applyTradeTax, updateCandle implementations)
}
```

### `domain/finance/BankingService.ts`
```typescript
import { GameState, Bank, GameContext, Loan, Company } from '../../shared/types';

export class BankingService {
    static applyMonetaryPolicy(state: GameState): void {
        const bank = state.bank;

        if (state.policyOverrides.interestRate !== null) {
            bank.loanRate = state.policyOverrides.interestRate;
            bank.depositRate = Math.max(0, bank.loanRate - 0.002);
            bank.yieldCurve = { rate1d: bank.loanRate, rate30d: bank.loanRate * 1.1, rate365d: bank.loanRate * 1.3 };
            return;
        }

        if (bank.system === 'GOLD_STANDARD') {
            const deposits = Math.max(1, bank.totalDeposits);
            const currentReserveRatio = bank.reserves / deposits;
            const targetRatio = 0.40; 
            
            const error = targetRatio - currentReserveRatio;
            const adjustment = error * 0.1; 
            
            let nextRate = bank.loanRate + adjustment;
            nextRate = Math.max(0.01, Math.min(0.50, nextRate));
            
            bank.loanRate = nextRate;
            bank.depositRate = Math.max(0, nextRate - 0.01);
            bank.yieldCurve = { rate1d: bank.loanRate, rate30d: bank.loanRate, rate365d: bank.loanRate };

        } else {
            // FIAT (Taylor Rule)
            const history = state.macroHistory;
            let currentInflation = 0;
            if (history.length > 7) {
                const now = history[history.length - 1].cpi;
                const weekAgo = history[history.length - 8].cpi;
                currentInflation = (now - weekAgo) / weekAgo;
            }

            const r_star = 0.02; 
            const pi_star = bank.targetInflation / 52; 
            const u_n = 0.05; 
            const u_t = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length-1].unemployment : 0.05;
            const outputGap = -2.0 * (u_t - u_n);

            const taylorRate = currentInflation + r_star + 0.5*(currentInflation - pi_star) + 0.5*outputGap;
            const smoothing = 0.15;
            const nextRate = bank.loanRate * (1 - smoothing) + taylorRate * smoothing;

            bank.loanRate = Math.max(0.001, Math.min(0.20, nextRate)); 
            bank.depositRate = Math.max(0, bank.loanRate - 0.005);
            
            // Inversion logic based on sentiment
            const sentiment = state.population.consumerSentiment;
            const inversionFactor = sentiment < 30 ? -0.002 : 0; 
            
            bank.yieldCurve = {
                rate1d: bank.loanRate,
                rate30d: bank.loanRate * 1.1 + 0.0005 + inversionFactor * 0.5,
                rate365d: Math.max(0.001, bank.loanRate * 1.3 + 0.002 + inversionFactor)
            };
        }
    }

    static processFinancials(state: GameState, context: GameContext): void {
        const bank = state.bank;
        BankingService.processInterest(state, bank, context);
        BankingService.processDeposits(state, bank, context);
        BankingService.processLoans(state, bank, context);

        bank.moneySupply = bank.totalDeposits + bank.totalLoans; 
        bank.creditMultiplier = bank.moneySupply / Math.max(1, bank.reserves);

        // History recording logic...
    }

    private static processInterest(state: GameState, bank: Bank, context: GameContext) {
        bank.loans.forEach(loan => { loan.remainingPrincipal += loan.remainingPrincipal * loan.interestRate; });
        bank.deposits.forEach(deposit => { deposit.amount += deposit.amount * deposit.interestRate; });
    }

    private static processDeposits(state: GameState, bank: Bank, context: GameContext) {
        const residents = state.population.residents;
        residents.forEach(res => {
            const saveThreshold = 200 / (1 + bank.depositRate * 10); 
            const excess = res.cash - saveThreshold; 
            
            // Deposit Logic
            if (excess > 50) {
                // ... Find or create deposit, move cash from resident to bank reserves/deposit
            }
            // Withdrawal Logic
            if (res.cash < 50) {
                // ... Withdraw from bank
            }
        });
    }

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;
        // Capital Adequacy check...
        
        companies.forEach(comp => {
            if (comp.isBankrupt) return;

            // 1. Repayment Logic
            // ...

            // 2. New Loan Logic
            // Check Credit Risk, Collateral, and Bank Capacity
            // ...
        });
    }
}
```

### `domain/company/ProductionService.ts`
```typescript
import { GameState, ResourceType, ProductType, FlowStats, GameContext, GDPFlowAccumulator } from '../../shared/types';
import { MarketService } from '../market/MarketService';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class ProductionService {
  static process(
      gameState: GameState, 
      context: GameContext, 
      flowStats: FlowStats, 
      getEventModifier: (t: string) => number,
      gdpFlow: GDPFlowAccumulator
  ): void {
    ProductionService.processFixedCosts(gameState, context, gdpFlow);
    ProductionService.processSpoilage(gameState, flowStats);
    ProductionService.processFarming(gameState, context, flowStats, getEventModifier);
    ProductionService.processManufacturing(gameState, context, flowStats, getEventModifier);
    ProductionService.manageSales(gameState, context);
    ProductionService.processCapitalAllocation(gameState, context, gdpFlow);
  }

  // Implementation details for processManufacturing, processFarming, etc.
  // Includes Cobb-Douglas production function, JIT procurement via MarketService, and Wage payments.
  private static processManufacturing(gameState: GameState, context: GameContext, flowStats: FlowStats, getMod: (t: string) => number): void {
      // ...
      // Calculates output: Y = A * K^alpha * L^beta
      // Handles raw material checks and automated buying orders
      // Updates inventory and marginal costs
  }
}
```

### `domain/consumer/ConsumerService.ts`
```typescript
import { GameState, ProductType, ResourceType, FlowStats, GameContext, GDPFlowAccumulator } from '../../shared/types';
import { MarketService } from '../market/MarketService';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class ConsumerService {
  static process(state: GameState, context: GameContext, flowStats: FlowStats, gdpFlow: GDPFlowAccumulator): void {
    const { residents } = state.population;
    const history = state.macroHistory;
    
    // Inflation Expectations
    let expectedInflation = 0;
    if (history.length > 1) {
        const last = history[history.length - 1].inflation;
        const prev = history[history.length - 2].inflation;
        expectedInflation = last + 0.5 * (last - prev);
    }

    residents.forEach(resident => {
      // 1. Budgeting (Dynamic MPC based on expectations)
      let baseMPC = resident.propensityToConsume || 0.8;
      const adjustedMPC = Math.max(0.5, Math.min(0.99, baseMPC + (expectedInflation * 2.0)));
      const nominalBudget = resident.cash * adjustedMPC;

      // 2. Utility Maximization (Stone-Geary / Cobb-Douglas)
      // Determines split between Grain (Necessity) and Bread (Luxury/Substitute)
      // ...

      // 3. Place Orders
      if (qBread > 0) {
          MarketService.submitOrder(state, {
              ownerId: resident.id,
              ownerType: 'RESIDENT',
              itemId: ProductType.BREAD,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              quantity: qBread
          }, context);
          gdpFlow.C += (qBread * breadPrice); 
      }
      // ... Same for Grain

      // 4. Consume physical inventory & Update Happiness
      ConsumerService.consumeFood(resident, flowStats, state);
    });
  }
}
```

### `shared/config.ts`
```typescript
export const GAME_CONFIG = {
  TOTAL_POPULATION: 30,
  INITIAL_PLAYER_CASH: 100,
  TOTAL_LAND_TOKENS: 80,
  DAILY_GRAIN_NEED: 1.0,
  BREAD_SUBSTITUTE_RATIO: 0.8,
  GAME_SPEEDS: [1, 2, 5],
  TAX_RATES: {
    INCOME_LOW: 0.10,
    INCOME_MID: 0.20,
    INCOME_HIGH: 0.40,
    CORPORATE: 0.20,
    CONSUMPTION: 0.05
  },
  UPDATE_RATES: {
    MARKET: 1,      
    CORE_ECO: 5,    
    MACRO: 20       
  },
  ECONOMY: {
    FIXED_COST_PER_LINE: 5.0, 
    FIXED_COST_PER_LAND: 2.0, 
    WAGE_SENSITIVITY: 0.5,    
    DEMAND_ELASTICITY: {
      GRAIN: -0.4, 
      BREAD: -0.8  
    }
  },
  LABOR: {
      XP_PER_DAY: 1,
      SKILL_THRESHOLDS: { NOVICE: 0, SKILLED: 100, EXPERT: 300 },
      PRODUCTIVITY_MULTIPLIER: { NOVICE: 1.0, SKILLED: 1.5, EXPERT: 2.2 }
  },
  LIFECYCLE: {
      STARTUP_MAX_AGE: 30, 
      GROWTH_PROFIT_THRESHOLD: 1000,
      DECLINE_LOSS_STREAK: 5
  }
};
```

### `shared/types/index.ts`
```typescript
// (Full content of types/index.ts as provided in prompt)
// Includes GameState, Company, Resident, Bank, Order, Trade, etc.
export enum ResourceType { GRAIN = 'GRAIN' }
export enum ProductType { BREAD = 'BREAD' }
// ... [See full file in codebase]
```

### `infrastructure/ai/GeminiAdapter.ts`
```typescript
import { GoogleGenAI } from "@google/genai";
import { GameState, GodModeData } from "../../shared/types";

export const getFinancialAdvisorResponseStream = async (
  userMessage: string, 
  gameState: GameState,
  godModeData: GodModeData,
  chatHistory: any[],
  onChunk: (text: string) => void
): Promise<void> => {
  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // ... Prompt Construction Logic ...
      const prompt = `You are Alpha, the AI Chief Economist...`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      for await (const chunk of responseStream) {
          if (chunk.text) onChunk(chunk.text);
      }
  } catch (error) {
      console.error("Gemini API Error:", error);
      onChunk("系统离线...");
  }
};

export const auditEconomy = async (snapshot: any): Promise<string> => {
    // Generates a diagnostic report of the economy using Gemini
    // ...
    return "Report...";
}
```

---

## 3. Secondary Files (Pseudocode/Stubs)

### `domain/labor/LaborService.ts`
```typescript
export class LaborService {
  // Updates reservation wages based on inflation (Sticky Wages)
  static updateMarketConditions(gameState: GameState): void { /* ... */ }

  // Handles Union Logic, Wage Negotiations, Hiring and Payroll execution
  static processPayrollAndHiring(gameState: GameState, context: GameContext, benchmark: number, pressure: number, gdp: any): void { 
      // 1. Process Union Pressure
      // 2. Adjust AI Company Wage Offers (Marginal Productivity Theory)
      // 3. Pay Executives
      // 4. Match Job Openings with Unemployed Residents
  }
}
```

### `domain/macro/GDPService.ts`
```typescript
export class GDPService {
  // Calculates GDP components, CPI, Inflation, and updates MacroHistory
  static process(state: GameState, flowStats: FlowStats, gdpFlow: GDPFlowAccumulator): void {
      // Aggregates consumption, investment, government spending
      // Updates EconomicSnapshot
  }
}
```

### `domain/macro/FiscalService.ts`
```typescript
export class FiscalService {
  // Adjusts Tax Rates and Welfare based on Government Surplus/Deficit
  static process(state: GameState, context: GameContext): void {
      // Implements automatic stabilizers or crisis stimulus
  }
}
```

### `shared/store/slices.ts`
```typescript
import { StateCreator } from 'zustand';
// ... imports

// Defines logic for UI actions, Market interactions, Player commands
export const createGameSlice: StateCreator<GameStore> = (set) => ({
    // ... logic for tick(), start(), stop()
});

export const createMarketSlice: StateCreator<GameStore> = (set) => ({
    trade: (action, itemId) => { /* Calls MarketService.submitOrder */ }
});
// ... PlayerSlice, CompanySlice, BankSlice
```

### `App.tsx`
```typescript
// Root Component
// Sets up Layout, Routing (Tabs), Game Loop Hook, and Context Providers
export default function App() {
    useGameLoop(); // Drives the simulation
    // Renders Header, Tab Navigation, and Main Content Area
}
```

### `shared/initialState.ts`
```typescript
// Defines the starting state of the universe
export const INITIAL_STATE: GameState = {
    // 30 Residents (Players, Mayor, Farmers, Workers)
    // 2 Companies (Grain Co-op, Bread Factory)
    // Initial Prices and Market Books
    // ...
};
```
