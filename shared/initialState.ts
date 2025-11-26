
import { Resident, Shareholder, PopulationState, CityTreasury, Election, Candle, ResourceType, ResourceItem, ProductType, ProductItem, Company, CompanyType, WageStructure, Fund, GameState, OrderBook, Bank } from '../types';
import { GAME_CONFIG } from './config';

const generateResidents = (count: number): Resident[] => {
  const residents: Resident[] = [];
  const names = [
    "玩家", "市长·老赵", "副市长·小钱", 
    "CEO·孙总(农业)", "工会·李头(农业)", "CEO·周总(食品)", "工会·吴头(食品)",
    "郑七", "王八", "冯九", "陈十", "褚十一", "卫十二", "蒋十三", "沈十四", "韩十五", "杨十六", 
    "朱十七", "秦十八", "尤十九", "许二十", "何廿一", "吕廿二", "施廿三", "张廿四", "孔廿五", "曹廿六", "严廿七", "华廿八", "金廿九"
  ];
  
  residents.push({
    id: 'res_player', name: names[0], age: 25, isPlayer: true,
    wealth: GAME_CONFIG.INITIAL_PLAYER_CASH, cash: GAME_CONFIG.INITIAL_PLAYER_CASH,
    job: 'UNEMPLOYED', employerId: undefined, salary: 0,
    influence: 50, intelligence: 90, leadership: 50, politicalStance: 'CENTRIST',
    happiness: 100, inventory: { [ResourceType.GRAIN]: 10 }, portfolio: {}, futuresPositions: [],
    livingStandard: 'BASIC', timePreference: 0.1, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 0,
    reservationWage: 1.5, propensityToConsume: 0.8
  });

  residents.push({
    id: 'res_mayor', name: names[1], age: 55, isPlayer: false,
    wealth: 60, cash: 100, 
    job: 'MAYOR', salary: 2.0, 
    influence: 100, intelligence: 80, leadership: 90, politicalStance: 'CENTRIST',
    happiness: 100, inventory: { [ProductType.BREAD]: 5 }, portfolio: {}, futuresPositions: [],
    livingStandard: 'LUXURY', timePreference: 0.2, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 5,
    reservationWage: 5.0, propensityToConsume: 0.9 
  });

  residents.push({
    id: 'res_deputy', name: names[2], age: 40, isPlayer: false,
    wealth: 45, cash: 80,
    job: 'DEPUTY_MAYOR', salary: 1.2, 
    influence: 70, intelligence: 75, leadership: 60, politicalStance: 'CENTRIST',
    happiness: 90, inventory: { [ProductType.BREAD]: 3 }, portfolio: {}, futuresPositions: [],
    livingStandard: 'COMFORT', timePreference: 0.2, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 2,
    reservationWage: 3.0, propensityToConsume: 0.85
  });

  residents.push({
    id: 'res_ceo_grain', name: names[3], age: 50, isPlayer: false,
    wealth: 50, cash: 80,
    job: 'EXECUTIVE', employerId: 'comp_grain', salary: 2.5,
    influence: 80, intelligence: 85, leadership: 80, politicalStance: 'CAPITALIST',
    happiness: 90, inventory: {}, portfolio: {}, futuresPositions: [],
    livingStandard: 'COMFORT', timePreference: 0.1, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 0,
    reservationWage: 2.5, propensityToConsume: 0.7 
  });

  residents.push({
    id: 'res_union_grain', name: names[4], age: 45, isPlayer: false,
    wealth: 30, cash: 60,
    job: 'WORKER', employerId: 'comp_grain', salary: 0, 
    influence: 90, intelligence: 60, leadership: 90, politicalStance: 'SOCIALIST',
    happiness: 95, inventory: {}, portfolio: {}, futuresPositions: [],
    livingStandard: 'BASIC', timePreference: 0.4, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 1,
    reservationWage: 1.2, propensityToConsume: 0.95 
  });

  residents.push({
    id: 'res_ceo_food', name: names[5], age: 48, isPlayer: false,
    wealth: 50, cash: 80,
    job: 'EXECUTIVE', employerId: 'comp_food', salary: 2.5,
    influence: 80, intelligence: 85, leadership: 80, politicalStance: 'CAPITALIST',
    happiness: 90, inventory: {}, portfolio: {}, futuresPositions: [],
    livingStandard: 'COMFORT', timePreference: 0.1, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 0,
    reservationWage: 2.5, propensityToConsume: 0.7 
  });

  residents.push({
    id: 'res_union_food', name: names[6], age: 42, isPlayer: false,
    wealth: 30, cash: 60,
    job: 'WORKER', employerId: 'comp_food', salary: 0,
    influence: 90, intelligence: 60, leadership: 90, politicalStance: 'SOCIALIST',
    happiness: 95, inventory: {}, portfolio: {}, futuresPositions: [],
    livingStandard: 'BASIC', timePreference: 0.4, needs: { [ResourceType.GRAIN]: 100 },
    landTokens: 0,
    reservationWage: 1.2, propensityToConsume: 0.95
  });

  let farmersCount = 0;
  for (let i = 7; i < count; i++) {
    const intelligence = 60 + Math.floor(Math.random() * 40); 
    let job: Resident['job'] = 'FARMER';
    let employerId: string | undefined = undefined;
    let land = 0;

    if (i === 7 || i === 8) { job = 'WORKER'; employerId = 'comp_grain'; }
    else if (i === 9 || i === 10) { job = 'WORKER'; employerId = 'comp_food'; }
    else { 
        farmersCount++;
        land = 2 + Math.floor(Math.random() * 3); 
    }

    residents.push({
      id: `res_${i}`,
      name: names[i] || `居民${i}`,
      age: 20 + Math.floor(Math.random() * 30),
      isPlayer: false,
      wealth: 30, cash: 50, 
      job: job, employerId: employerId,
      salary: 0, 
      influence: 5, intelligence: intelligence, leadership: 5 + Math.floor(Math.random() * 50),
      politicalStance: 'CENTRIST',
      happiness: 70, inventory: { [ResourceType.GRAIN]: 5 }, portfolio: {}, futuresPositions: [],
      livingStandard: 'SURVIVAL',
      timePreference: 0.5,
      needs: { [ResourceType.GRAIN]: 100 },
      landTokens: land,
      reservationWage: 1.0 + (Math.random() * 0.5),
      propensityToConsume: 0.9
    });
  }

  return residents;
};

const initialResidents = generateResidents(GAME_CONFIG.TOTAL_POPULATION);

const distributeInitialShares = (residents: Resident[]): Shareholder[] => {
    let remainingShares = 1000;
    const shareholders: Shareholder[] = [];
    
    const potentialHolders = residents.filter(r => !r.isPlayer);
    potentialHolders.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < 15; i++) {
        if (remainingShares <= 0) break;
        const holder = potentialHolders[i];
        const amount = Math.min(remainingShares, 20 + Math.floor(Math.random() * 130));
        
        shareholders.push({
            id: holder.id,
            name: holder.name,
            count: amount,
            type: 'RESIDENT'
        });
        
        holder.portfolio = { ...holder.portfolio };
        remainingShares -= amount;
    }

    if (remainingShares > 0) {
        shareholders.push({ id: 'inst_gov', name: "国有资产", count: remainingShares, type: 'INSTITUTION' });
    }
    
    return shareholders;
};

const grainShareholders = distributeInitialShares(initialResidents);
const foodShareholders = distributeInitialShares(initialResidents);

initialResidents.forEach(res => {
    const s1 = grainShareholders.find(s => s.id === res.id);
    if (s1) res.portfolio['comp_grain'] = s1.count;
    
    const s2 = foodShareholders.find(s => s.id === res.id);
    if (s2) res.portfolio['comp_food'] = s2.count;
});

export const INITIAL_POPULATION: PopulationState = {
  residents: initialResidents,
  total: GAME_CONFIG.TOTAL_POPULATION,
  unemployed: 1, 
  laborers: 8, 
  farmers: 19, 
  financiers: 0,
  averageWage: 2.0, 
  averageHappiness: 75,
  wealthLevel: { low: 0, mid: 0, high: 0 },
};

export const INITIAL_CITY_TREASURY: CityTreasury = {
    cash: 500, 
    dailyIncome: 0, dailyExpense: 0,
    taxPolicy: { 
      incomeTaxRate: GAME_CONFIG.TAX_RATES.INCOME_LOW, 
      incomeTaxBrackets: [
        { threshold: 5, rate: GAME_CONFIG.TAX_RATES.INCOME_LOW }, 
        { threshold: 10, rate: GAME_CONFIG.TAX_RATES.INCOME_MID }, 
        { threshold: 9999, rate: GAME_CONFIG.TAX_RATES.INCOME_HIGH } 
      ],
      corporateTaxRate: GAME_CONFIG.TAX_RATES.CORPORATE, 
      consumptionTaxRate: GAME_CONFIG.TAX_RATES.CONSUMPTION,
      grainSubsidy: 0.2 
    },
    grainDistributedToday: 0,
    totalGrainDistributed: 0,
    fiscalStatus: 'NEUTRAL',
    fiscalCorrection: "政策稳定",
    landTokens: 10 
};

export const INITIAL_BANK: Bank = {
  reserves: 2000,
  totalDeposits: 0,
  totalLoans: 0,
  depositRate: 0.001, // 0.1% daily
  loanRate: 0.003,    // 0.3% daily
  loans: [],
  deposits: [],
  history: []
};

export const INITIAL_ELECTION: Election = {
  active: false, cycle: 1, nextDate: 30, candidates: [], winnerId: 'res_mayor'
};

const generateFakeHistory = (base: number, volatility: number, days: number): Candle[] => {
    let current = base;
    const history: Candle[] = [];
    for (let i = 1; i <= days; i++) {
        const change = (Math.random() - 0.5) * volatility;
        const open = current;
        const close = current * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.05);
        const low = Math.min(open, close) * (1 - Math.random() * 0.05);
        history.push({ day: i, open, high, low, close, volume: Math.floor(Math.random() * 100) });
        current = close;
    }
    return history;
};

export const INITIAL_RESOURCES: Record<ResourceType, ResourceItem> = {
  [ResourceType.GRAIN]: { 
    id: ResourceType.GRAIN, name: '粮食', basePrice: 1.0, currentPrice: 1.0, 
    owned: 0, dailySales: 0, lastTransactionPrice: 1.0, 
    turnDemand: 0, demand: 0, history: generateFakeHistory(1.0, 0.1, 20)
  },
};

export const INITIAL_PRODUCTS: Record<ProductType, ProductItem> = {
  [ProductType.BREAD]: { 
    id: ProductType.BREAD, name: '面包', requirements: { [ResourceType.GRAIN]: 1 }, 
    marketPrice: 2.0, basePrice: 2.0, owned: 0, 
    dailySales: 0, lastTransactionPrice: 2.0, turnDemand: 0, demand: 0, 
    history: generateFakeHistory(2.0, 0.05, 20)
  },
};

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'comp_grain', name: '红星农业公社',
    description: "专注于粮食种植的集体企业。",
    productionLines: [
        { type: ResourceType.GRAIN, isActive: true, efficiency: 1.0, allocation: 1.0 } 
    ],
    cash: 1000, 
    sharePrice: 1.0, totalShares: 1000, ownedShares: 0,
    shareholders: grainShareholders,
    isPlayerFounded: false, 
    employees: 3, 
    targetEmployees: 6, 
    wageOffer: 2.0, 
    wageMultiplier: 1.8, 
    pricePremium: 0,
    executiveSalary: 3.0, dividendRate: 0.1, margin: 0.2, aiPersonality: 'BALANCED',
    boardMembers: ['inst_gov'], unionTension: 0, strikeDays: 0,
    inventory: { raw: {}, finished: { [ResourceType.GRAIN]: 80 } }, 
    landTokens: 10, 
    avgCost: 0.5,
    accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0, lastRevenue: 0, lastProfit: 0,
    monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: generateFakeHistory(1.0, 0.05, 20),
    type: CompanyType.COOPERATIVE, wageStructure: WageStructure.FLAT, ceoId: 'res_ceo_grain', isBankrupt: false
  },
  {
    id: 'comp_food', name: '大众食品厂',
    description: "加工面包的工厂。",
    productionLines: [
        { type: ProductType.BREAD, isActive: true, efficiency: 1.0, allocation: 1.0 }
    ],
    cash: 1000, 
    sharePrice: 1.0, totalShares: 1000, ownedShares: 0,
    shareholders: foodShareholders,
    isPlayerFounded: false, 
    employees: 3, 
    targetEmployees: 5, 
    wageOffer: 2.0,
    wageMultiplier: 1.8,
    pricePremium: 0,
    executiveSalary: 3.0, dividendRate: 0.1, margin: 0.2, aiPersonality: 'AGGRESSIVE',
    boardMembers: ['inst_gov'], unionTension: 0, strikeDays: 0,
    inventory: { raw: { [ResourceType.GRAIN]: 100 }, finished: { [ProductType.BREAD]: 20 } }, 
    landTokens: 0, 
    avgCost: 1.2,
    accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0, lastRevenue: 0, lastProfit: 0,
    monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: generateFakeHistory(1.0, 0.1, 20),
    type: CompanyType.CORPORATION, wageStructure: WageStructure.HIERARCHICAL, ceoId: 'res_ceo_food', isBankrupt: false
  }
];

export const INITIAL_FUNDS: Fund[] = [];

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

export const INITIAL_STATE: GameState = {
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
    chatHistory: [{ role: 'model', text: '微型社会模拟 v6.0 (Chaos Mode) 已启动。\n系统已接入 Limit Order Book, Cobb-Douglas 生产函数与央行系统。', timestamp: Date.now() }],
    logs: ["🏗️ 系统初始化完成"],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    },
    market: market
};
