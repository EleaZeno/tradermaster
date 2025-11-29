# 🌐 EcoTycoon AI — Technical Audit Document

**Version:** 3.1.0 (Physics Implementation)
**Engine:** React 18 + Zustand (Immer) + Google GenAI SDK
**Purpose:** External Code Review & Economic Logic Audit

---

## 1. System Architecture

The simulation runs on a strict **Tick-Based Game Loop** orchestrated in the Application Layer. State is mutated via **Domain Services** which enforce economic laws (Conservation of Mass, Market Microstructure).

```mermaid
flowchart TD
    subgraph Store [State Container]
        GameState[Zustand Store (Immer)]
    end

    subgraph Loop [Application Layer]
        Orchestrator[GameLoop.ts]
    end

    subgraph Domain [Physics Engine]
        Market[MarketService (LOB)]
        Labor[LaborService (Sticky Wages)]
        Prod[ProductionService (Capital)]
        Bank[BankingService (Credit/Monetary)]
        Cons[ConsumerService (Utility/MPC)]
    end

    subgraph Infra [Infrastructure]
        AI[Gemini Adapter]
    end

    Orchestrator -->|Trigger| Domain
    Domain -->|Mutate| GameState
    AI -->|Inject Events| GameState
```

---

## 2. The Data Model (Source of Truth)

The entire economy is serialized in `GameState`. Note the specific fields added for economic physics (`riskAversion`, `tobinQ`, `yieldCurve`).

### `shared/types/index.ts` (Key Interfaces)

```typescript
// --- MICRO-FOUNDATIONS ---

export interface Resident {
  id: string;
  cash: number;   
  job: 'UNEMPLOYED' | 'FARMER' | 'WORKER' | 'EXECUTIVE' | ...; 
  
  // Economic Parameters
  reservationWage: number; // Inflation-adjusted min wage
  propensityToConsume: number; // Marginal Propensity to Consume (MPC)
  riskAversion: number; // 0.5 - 1.5 (Affects precautionary savings)
  timePreference: number; // Affects savings rate
  
  // Inventory & Assets
  inventory: Partial<Record<string, number>>;
  portfolio: Record<string, number>; 
  landTokens?: number;
}

export interface Company {
  id: string;
  cash: number;
  // Capital Accumulation
  productionLines: {
      efficiency: number; // Depreciates daily
      isActive: boolean;
  }[];
  landTokens?: number;
  
  // Valuation & Strategy
  tobinQ: number; // Market Value / Replacement Cost
  wageOffer: number; 
  lastWageUpdate: number; // For sticky wages (contracts)
  wageMultiplier: number; 
  
  // Financials
  sharePrice: number;
  totalShares: number;
  isBankrupt: boolean;
}

// --- MACRO-ECONOMICS ---

export interface Bank {
  system: 'GOLD_STANDARD' | 'FIAT_MONEY';
  reserves: number; // High Powered Money
  moneySupply: number; // M2
  
  // Monetary Policy
  loanRate: number;    // Base Rate
  depositRate: number;
  yieldCurve: { rate1d: number; rate30d: number; rate365d: number };
  
  // Balance Sheet
  loans: Loan[];
  deposits: Deposit[];
}

export interface OrderBook {
    bids: Order[]; // Buy Side
    asks: Order[]; // Sell Side
    lastPrice: number;
    spread: number;
    volatility: number;
}
```

---

## 3. The Orchestrator (Game Loop)

The heartbeat of the simulation. It separates high-frequency tasks (Market Matching) from daily tasks (Production/Consumption) and monthly tasks (Macro Analysis).

### `application/GameLoop.ts`

```typescript
const rates = {
    MARKET: 1,      // Every tick (UI responsiveness)
    CORE_ECO: 5,    // Every 5 ticks (1 Day)
    MACRO: 20       // Every 20 ticks (GDP Calc, Banking)
};

export const processGameTick = (gameState: GameState): void => {
    // 1. Build O(1) Lookup Context for performance
    const context = GameContextFactory.build(gameState);

    // 2. High Frequency Trading
    if (tick % rates.MARKET === 0) {
        MarketService.pruneStaleOrders(gameState, context);
    }

    // 3. The Economic "Day"
    if (tick % rates.CORE_ECO === 0) {
        // A. Expectations & Sentiment
        LaborService.updateMarketConditions(gameState); 
        DemographicsService.process(gameState, gdpFlow);
        
        // B. Demand Side
        ConsumerService.process(gameState, context, flowStats, gdpFlow);

        // C. Supply Side & Labor Market Clearing
        LaborService.processPayrollAndHiring(gameState, context, ...);
        ProductionService.process(gameState, context, flowStats, ...);
        
        // D. Financial Operations
        BankingService.processFinancials(gameState, context);
    }

    // 4. Macro Analysis & Policy Response
    if (tick % rates.MACRO === 0) {
        StockMarketService.processStockMarket(gameState);
        FiscalService.process(gameState, context); // Gov Spending/Tax
        BusinessCycleService.updateCycle(gameState); // Recession detection
        HealthCheckService.updateHealthIndex(gameState);
    }
};
```

---

## 4. Domain Logic (The Physics Engine)

### 4.1 Market Microstructure (LOB)
**File:** `domain/market/MarketService.ts`
**Key Feature:** Double Auction with Asset Escrow (Prevention of negative balances).

```typescript
static submitOrder(state: GameState, order: Order, context: GameContext): boolean {
    // 1. Lock Assets (Escrow)
    if (!AssetLocker.lock(state, order)) return false;

    // 2. Add to Order Book (Sorted by Price/Time)
    const book = state.market[order.itemId];
    const isBuy = order.side === 'BUY';
    const side = isBuy ? book.bids : book.asks;
    side.push(order);
    // Sort: Bids Descending, Asks Ascending
    side.sort((a, b) => isBuy ? b.price - a.price : a.price - b.price);

    // 3. Match immediately (Continuous Auction)
    this.matchOrder(state, book, order);
    
    // 4. Update Volatility Metrics
    const spread = book.asks[0]?.price - book.bids[0]?.price;
    book.volatility = spread / book.lastPrice; 
    return true;
}

private static matchOrder(state: GameState, book: OrderBook, taker: Order) {
    // Matches taker against maker orders.
    // Executes transfer of Cash and Goods directly between Agent entities.
    // Updates Candle history (OHLCV).
}
```

### 4.2 Labor Market (Wage Stickiness & Phillips Curve)
**File:** `domain/labor/LaborService.ts`
**Key Feature:** Wages react slowly to inflation; Hiring is based on Marginal Productivity of Labor (MPL).

```typescript
// 1. Reservation Wages (Supply Side)
private static adjustReservationWages(gameState: GameState): void {
    const inflation = gameState.macroHistory.last().inflation;
    gameState.population.residents.forEach(res => {
        // Sticky Downwards: Wages rise fast with inflation, fall slow with deflation
        const change = res.reservationWage * inflation * sensitivity;
        if (change > 0) res.reservationWage += change;
        else res.reservationWage += change * 0.1; // 90% Resistance to cuts
    });
}

// 2. Corporate Hiring Strategy (Demand Side)
private static adjustAIStrategy(company: Company): void {
    // Calculate VMPL (Value of Marginal Product of Labor)
    // Production Function: Y = A * K^0.3 * L^0.7
    const MPL = 0.7 * (currentOutput / Labor);
    const VMPL = MPL * outputPrice;

    // Hiring Decision
    if (VMPL > wage) company.targetEmployees++;
    
    // Wage Setting (Nominal Rigidity)
    const daysSinceUpdate = state.day - company.lastWageUpdate;
    if (daysSinceUpdate > 7) { // Weekly contracts only
        // Adjust wage towards VMPL, but cap cuts at 1%
        const maxCut = currentWage * 0.01;
        newWage = Math.max(targetWage, currentWage - maxCut);
        company.wageOffer = newWage;
        company.lastWageUpdate = state.day;
    }
}
```

### 4.3 Production (Capital Accumulation)
**File:** `domain/company/ProductionService.ts`
**Key Feature:** Capital Depreciation and Tobin's Q Investment Logic.

```typescript
// 1. Depreciation (Capital Destruction)
private static processDepreciation(state: GameState): void {
    const rate = 0.005; // 0.5% per day
    state.companies.forEach(comp => {
        comp.productionLines.forEach(line => {
            line.efficiency *= (1 - rate);
            if (line.efficiency < 0.3) scrapLine(line);
        });
    });
}

// 2. Investment (Capital Creation)
private static processCapitalAllocation(state: GameState): void {
    // Tobin's Q = Market Value / Replacement Cost of Assets
    const marketCap = comp.sharePrice * comp.totalShares;
    const replacementCost = comp.cash + inventoryVal + machineCost;
    const q = marketCap / replacementCost;

    // If Market values firm > cost of assets, BUILD MORE.
    if (q > 1.2 && expectedROI > interestRate) {
        comp.cash -= 100; // CapEx
        comp.productionLines.push({ efficiency: 1.0 }); // New Capital
    }
}
```

### 4.4 Consumer Behavior (Precautionary Savings)
**File:** `domain/consumer/ConsumerService.ts`
**Key Feature:** MPC varies with Wealth and Uncertainty.

```typescript
// Keynesian Consumption Function with Risk
const unemploymentRisk = state.macroHistory.last().unemployment;
const expectedInflation = ...;

residents.forEach(res => {
    // MPC Formula
    // 1. Intertemporal Substitution: Inflation makes spending attractive now
    // 2. Precautionary Savings: Job risk makes saving attractive
    const riskFactor = unemploymentRisk * res.riskAversion * 2.0;
    const inflationFactor = expectedInflation * 1.5;
    
    const adjustedMPC = baseMPC + inflationFactor - riskFactor;
    const budget = res.cash * adjustedMPC;

    // Stone-Geary Utility (Survival Needs First)
    if (budget < subsistenceCost) {
        // Buy only Grain/Bread
    } else {
        // Discretionary spending on diverse goods
    }
});
```

### 4.5 Banking (Monetary Policy & Credit)
**File:** `domain/finance/BankingService.ts`
**Key Feature:** Fractional Reserve Banking & Taylor Rule.

```typescript
// 1. Monetary Policy (The Taylor Rule)
// i = r* + pi + 0.5(pi - pi*) + 0.5(y - y*)
const targetRate = currentInflation + r_neutral + 
                   0.5 * (currentInflation - targetInflation) + 
                   0.5 * (outputGap); // approximated via Okun's Law

bank.loanRate = smooth(targetRate);

// 2. Credit Creation (Endogenous Money)
// Money is created when loans are issued, destroyed when repaid/defaulted.
private static processLoans(state: GameState) {
    const maxLending = (reserves / reserveRatio) - totalLoans;
    
    if (company.isSolvent && company.ROA > bank.loanRate) {
        // Create Loan -> Create Deposit (Cash)
        const loan = { principal: 100, ... };
        bank.loans.push(loan);
        company.cash += 100; // M2 increases here!
    }
}

// 3. Default (Deflationary Shock)
if (company.cash < -50) {
    // Bank writes off loan -> Money Stock permanently destroyed
    bank.equity -= badLoan.amount;
    company.isBankrupt = true;
}
```

---

## 5. Validation & Metrics

The system calculates real-world metrics to verify the "physics".

### `features/validation/CalibrationService.ts`

*   **Consumption Smoothing:** Checks if $\sigma(C) < \sigma(GDP)$.
*   **Phillips Curve:** Checks correlation(Unemployment, Inflation) $< 0$.
*   **Okun's Law:** Checks correlation(GDP Growth, $\Delta$Unemployment) $< 0$.
*   **Quantity Theory:** Checks correlation($\Delta$M2, Inflation) $> 0$ (Long run).

---

## 6. AI Integration Layer

### `infrastructure/ai/GeminiAdapter.ts`

Uses Google Gemini 2.5 Flash to generate narrative and qualitative analysis based on the quantitative `GameState`.

*   `auditEconomy(snapshot)`: Detects logical fallacies or structural imbalances (e.g., "Liquidity Trap detected").
*   `analyzeCompany(company)`: Generates Buy/Sell ratings based on P/E, Tobin's Q, and Cash Flow.
*   `generateMarketEvent()`: Creates exogenous shocks (Droughts, Tech Breakthroughs) that modify parameters in `EventService`.

