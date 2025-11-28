import { GameState, ResourceType, ProductType, OrderBook } from './types';
import { GAME_CONFIG } from './config';

// Helper to create empty books
const createEmptyBook = (price: number): OrderBook => ({
    bids: [], asks: [], lastPrice: price, history: []
});

export const INITIAL_CITY_TREASURY = {
    cash: 1000,
    dailyIncome: 0,
    dailyExpense: 0,
    grainDistributedToday: 0,
    totalGrainDistributed: 0,
    fiscalStatus: 'NEUTRAL' as const,
    fiscalCorrection: '',
    taxPolicy: {
        incomeTaxRate: GAME_CONFIG.TAX_RATES.INCOME_MID,
        incomeTaxBrackets: [],
        corporateTaxRate: GAME_CONFIG.TAX_RATES.CORPORATE,
        consumptionTaxRate: GAME_CONFIG.TAX_RATES.CONSUMPTION,
        grainSubsidy: 0
    },
    landTokens: 0
};

export const INITIAL_BANK = {
    reserves: 5000,
    moneySupply: 5000,
    reserveRatio: 0.1,
    creditMultiplier: 1.0,
    totalDeposits: 0,
    totalLoans: 0,
    depositRate: 0.005,
    loanRate: 0.02,
    yieldCurve: { rate1d: 0.02, rate30d: 0.025, rate365d: 0.03 },
    targetInflation: 0.02,
    targetUnemployment: 0.05,
    loans: [],
    deposits: [],
    history: []
};

export const INITIAL_RESOURCES = {
    [ResourceType.GRAIN]: {
        id: ResourceType.GRAIN, name: "Grain", basePrice: 1.0, currentPrice: 1.0,
        owned: 0, dailySales: 0, lastTransactionPrice: 1.0, demand: 0, turnDemand: 0, history: []
    }
};

export const INITIAL_PRODUCTS = {
    [ProductType.BREAD]: {
        id: ProductType.BREAD, name: "Bread", requirements: { [ResourceType.GRAIN]: 0.8 },
        marketPrice: 2.0, basePrice: 2.0, owned: 0, dailySales: 0, lastTransactionPrice: 2.0,
        demand: 0, turnDemand: 0, history: []
    }
};

export const INITIAL_COMPANIES = []; // Assuming empty start or predefined
export const INITIAL_FUNDS = [];
export const INITIAL_POPULATION = {
    residents: [],
    total: GAME_CONFIG.TOTAL_POPULATION,
    unemployed: 0,
    laborers: 0,
    farmers: 0,
    financiers: 0,
    averageWage: 1.5,
    averageHappiness: 80,
    consumerSentiment: 50,
    demographics: { births: 0, deaths: 0, immigration: 0 },
    wealthLevel: { low: 0, mid: 0, high: 0 }
};

export const INITIAL_ELECTION = {
    active: false, cycle: 1, nextDate: 10, candidates: [], winnerId: null
};

const market: Record<string, OrderBook> = {};
market[ResourceType.GRAIN] = createEmptyBook(1.0);
market[ProductType.BREAD] = createEmptyBook(2.0);

export const INITIAL_STATE: GameState = {
    cash: GAME_CONFIG.INITIAL_PLAYER_CASH,
    day: 1,
    totalTicks: 0,
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
    chatHistory: [{ role: 'model', text: 'Simulation initialized.', timestamp: Date.now() }],
    logs: ["System initialized."],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    },
    market: market,
    achievements: [],
    notifications: [],
    settings: {
        language: 'zh',
        notifications: { trades: true, achievements: true, news: true }
    },
    policyOverrides: {
        interestRate: null,
        moneyPrinter: 0,
        migrationRate: 1.0,
        taxMultiplier: 1.0,
        minWage: 0
    },
    structuralAnalysis: {
        lastCheckDay: 0,
        results: [],
        inflationSource: { costPush: 0, demandPull: 0, monetary: 0 },
        logs: []
    }
};