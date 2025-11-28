

import { ReactNode } from 'react';

export enum ResourceType {
  GRAIN = 'GRAIN'
}

export enum ProductType {
  BREAD = 'BREAD'
}

export type IndustryType = ResourceType | ProductType | string; // string for Company IDs

export type LivingStandard = 'SURVIVAL' | 'BASIC' | 'COMFORT' | 'LUXURY';

export enum CompanyType {
  CORPORATION = 'CORPORATION',
  COOPERATIVE = 'COOPERATIVE'
}

export enum WageStructure {
  FLAT = 'FLAT',
  HIERARCHICAL = 'HIERARCHICAL',
  PERFORMANCE = 'PERFORMANCE'
}

export type LifecycleStage = 'STARTUP' | 'GROWTH' | 'MATURITY' | 'DECLINE';

export type SkillLevel = 'NOVICE' | 'SKILLED' | 'EXPERT';

export interface Candle {
  day: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ResourceItem {
  id: ResourceType;
  name: string;
  basePrice: number;
  currentPrice: number;
  owned: number;
  dailySales: number; 
  lastTransactionPrice: number; 
  demand: number;
  turnDemand: number; 
  history: Candle[]; 
}

export interface ProductItem {
  id: ProductType;
  name: string;
  requirements: Partial<Record<ResourceType, number>>;
  marketPrice: number;
  basePrice: number;
  owned: number;
  dailySales: number; 
  lastTransactionPrice: number;
  demand: number;
  turnDemand: number; 
  history: Candle[]; 
}

export interface FuturesPosition {
  id: string;
  resourceId: ResourceType;
  type: 'LONG' | 'SHORT';
  amount: number;
  entryPrice: number; 
  dueDate: number; 
}

export type FuturesContract = FuturesPosition;

export interface Loan {
  id: string;
  borrowerId: string;
  principal: number;
  remainingPrincipal: number;
  interestRate: number; // Daily rate
  dueDate: number;
}

export interface Deposit {
  id: string;
  ownerId: string;
  amount: number;
  interestRate: number;
}

export interface YieldCurve {
  rate1d: number;
  rate30d: number;
  rate365d: number;
}

export interface Bank {
  reserves: number;
  totalDeposits: number;
  totalLoans: number;
  depositRate: number; // Base Rate
  loanRate: number;    // Base Rate
  yieldCurve: YieldCurve; // New: Term structure
  targetInflation: number; // Annualized target (e.g., 0.02)
  targetUnemployment: number; // Target rate (e.g., 0.05)
  loans: Loan[];
  deposits: Deposit[];
  history: { day: number; reserves: number; rates: number; inflation: number }[];
}

export interface Resident {
  id: string;
  name: string;
  age: number;
  isPlayer: boolean;
  wealth: number; 
  cash: number;   
  job: 'UNEMPLOYED' | 'FARMER' | 'WORKER' | 'EXECUTIVE' | 'MAYOR' | 'DEPUTY_MAYOR' | 'UNION_LEADER' | 'FINANCIER'; 
  skill: SkillLevel; // New
  xp: number;        // New: 0-100
  employerId?: string; 
  salary: number; 
  intelligence: number; 
  leadership: number;   
  happiness: number;
  livingStandard: LivingStandard; 
  timePreference: number; 
  // Economic Parameters
  reservationWage: number;
  propensityToConsume: number; // 0.0 to 1.0 (MPC)
  needs: Record<string, number>; 
  inventory: Partial<Record<string, number>>;
  portfolio: Record<string, number>; 
  futuresPositions: FuturesPosition[]; 
  politicalStance: 'CAPITALIST' | 'SOCIALIST' | 'CENTRIST';
  influence: number; 
  landTokens?: number;
}

export interface PopulationState {
  residents: Resident[]; 
  total: number;
  unemployed: number;
  laborers: number;
  farmers: number; 
  financiers: number;
  averageWage: number;
  averageHappiness: number;
  consumerSentiment: number; // New: 0-100
  demographics: {
      births: number;
      deaths: number;
      immigration: number;
  };
  wealthLevel: { low: number, mid: number, high: number };
}

export interface FinancialReport {
  month: number;
  revenue: number;
  netIncome: number;
  eps: number;
  summary: string;
  expenses: {
    wages: number;
    materials: number;
    dividends: number;
    taxes: number;
    interest: number;
    fixed: number; 
  };
  operatingMargin: number;
}

export interface Shareholder {
  id: string; 
  name: string;
  count: number;
  type: 'PLAYER' | 'RESIDENT' | 'FUND' | 'INSTITUTION'; 
}

export interface ProductionLine {
  type: IndustryType;
  isActive: boolean;
  efficiency: number; // Represents 'A' (Total Factor Productivity)
  allocation: number; 
}

export interface CompanyKPIs {
    roe: number; // Return on Equity
    roa: number; // Return on Assets
    roi: number; // Return on Investment (Project specific)
    leverage: number; // Debt / Equity
    marketShare: number; 
}

export interface Company {
  id: string;
  name: string;
  description?: string;
  age: number; // New
  stage: LifecycleStage; // New
  kpis: CompanyKPIs; // New
  productionLines: ProductionLine[];
  cash: number;
  sharePrice: number;
  totalShares: number;
  ownedShares: number; 
  shareholders: Shareholder[]; 
  isPlayerFounded: boolean;
  type: CompanyType;
  wageStructure: WageStructure;
  ceoId: string;
  isBankrupt: boolean;
  employees: number;
  targetEmployees: number;
  
  wageOffer: number;      
  wageMultiplier: number; 

  pricePremium: number; 
  executiveSalary: number; 
  dividendRate: number;
  margin: number; 
  tobinQ: number; 
  aiPersonality: 'AGGRESSIVE' | 'CONSERVATIVE' | 'BALANCED';
  boardMembers: string[]; 
  unionTension: number; 
  strikeDays: number; 
  inventory: {
    raw: Partial<Record<ResourceType, number>>;
    finished: Partial<Record<IndustryType, number>>;
  };
  landTokens?: number; // Represents 'K' (Capital)
  avgCost: number; // WAC (Weighted Average Cost)
  lastFixedCost: number; 
  accumulatedRevenue: number;
  accumulatedCosts: number;
  accumulatedWages: number;
  accumulatedMaterialCosts: number;
  lastRevenue: number;
  lastProfit: number;
  monthlySalesVolume: number;
  monthlyProductionVolume: number;
  reports: FinancialReport[];
  history: Candle[]; 
}

export interface Fund {
  id: string;
  name: string;
  managerId: string; 
  nav: number; 
  cash: number; 
  totalUnits: number;
  ownedUnits: number; 
  shareholders: Shareholder[]; 
  portfolio: Record<string, number>; 
  futuresPositions: FuturesPosition[]; 
  history: Candle[]; 
}

export interface TaxBracket {
  threshold: number;
  rate: number;
}

export interface TaxPolicy {
  incomeTaxRate: number; 
  incomeTaxBrackets: TaxBracket[]; 
  corporateTaxRate: number; 
  consumptionTaxRate: number; 
  grainSubsidy: number; 
}

export interface CityTreasury {
  cash: number;
  dailyIncome: number;
  dailyExpense: number;
  taxPolicy: TaxPolicy;
  grainDistributedToday: number;
  totalGrainDistributed: number;
  fiscalStatus: 'AUSTERITY' | 'NEUTRAL' | 'STIMULUS';
  fiscalCorrection: string; 
  landTokens?: number;
}

export interface Election {
  active: boolean;
  cycle: number; 
  nextDate: number;
  candidates: { residentId: string; name: string; votes: number }[];
  winnerId: string | null;
}

export type MarketEventType = 'NEWS' | 'PRICE_CHANGE' | 'ORDER_EXECUTED' | 'MARKET_CRASH';

export interface BaseEvent {
  turnCreated: number;
  type: MarketEventType;
}

export interface NewsEvent extends BaseEvent {
  type: 'NEWS';
  headline: string;
  description: string;
  impactType: 'GOOD' | 'BAD' | 'NEUTRAL';
  effect?: {
      target: string;
      modifier: number;
  };
}

export interface PriceChangeEvent extends BaseEvent {
  type: 'PRICE_CHANGE';
  itemId: string;
  oldPrice: number;
  newPrice: number;
}

export interface OrderExecutedEvent extends BaseEvent {
  type: 'ORDER_EXECUTED';
  orderId: string;
  tradeDetails: Trade;
}

export type MarketEvent = NewsEvent | PriceChangeEvent | OrderExecutedEvent;

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface GodModeData {
  supplyDemandGap: Record<string, number>;
  mostProfitableIndustry: string;
  laborShortage: boolean;
  affordabilityIndex: number;
}

export interface IndustryStat {
  name: string;
  profit: number;
  marketShare: number;
}

export interface InventoryAuditItem {
  total: number;
  residents: number;
  companies: number;
  market: number; 
  produced: number; 
  consumed: number; 
  spoiled: number;
}

export interface EconomicSnapshot {
  totalResidentCash: number;
  totalCorporateCash: number;
  totalFundCash: number;
  totalCityCash: number; 
  totalSystemGold: number; 
  totalInventoryValue: number; 
  totalMarketCap: number; 
  totalFuturesNotional: number; 
  inventoryAudit: Record<string, InventoryAuditItem>;
}

// --- ORDER BOOK TYPES ---

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'PARTIALLY_EXECUTED';

export interface Order {
    id: string;
    ownerId: string;
    ownerType: 'RESIDENT' | 'COMPANY' | 'TREASURY'; 
    itemId: string;
    side: OrderSide;
    type: OrderType;
    price: number; 
    quantity: number; // Replaces 'amount'
    remainingQuantity: number; // New: explicit tracking
    status: OrderStatus;
    timestamp: number;
}

export interface Trade {
    price: number;
    quantity: number;
    timestamp: number;
    buyerId: string;
    sellerId: string;
}

export interface OrderBook {
    bids: Order[]; // Sorted Price Descending
    asks: Order[]; // Sorted Price Ascending
    lastPrice: number;
    history: Trade[];
}

export interface MacroMetric {
  day: number;
  gdp: number;         // Nominal GDP estimate
  consumption: number; // Total consumption Value
  investment: number;  // Est investment
  cpi: number;         // Consumer Price Index
  inflation: number;   // Daily inflation rate
  unemployment: number;// Unemployment rate (0-1)
  moneySupply?: number; // M0 (Total System Gold)
}

export interface AchievementState {
  id: string;
  unlockedAt: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface GameSettings {
  language: 'zh' | 'en';
  notifications: {
    trades: boolean;
    achievements: boolean;
    news: boolean;
  };
}

export interface GameState {
  cash: number; 
  day: number;
  totalTicks: number; // Optimization: Track engine ticks separate from days
  mayorId: string | null;
  cityTreasury: CityTreasury;
  bank: Bank; // Central Bank
  election: Election;
  population: PopulationState;
  resources: Record<ResourceType, ResourceItem>;
  products: Record<ProductType, ProductItem>;
  companies: Company[];
  funds: Fund[];
  futures: FuturesPosition[];
  events: MarketEvent[];
  netWorthHistory: { day: number; value: number }[];
  macroHistory: MacroMetric[]; // Updated to track stylized facts data
  chatHistory: ChatMessage[];
  logs: string[];
  economicOverview: EconomicSnapshot; 
  market: Record<string, OrderBook>;
  
  // New features
  achievements: AchievementState[];
  notifications: Notification[];
  settings: GameSettings;
}

export interface AgentAdvice {
  text: string;
  action?: string;
}

export interface CashEntity {
  cash: number;
}

export interface FlowStatsData {
  produced: number;
  consumed: number;
  spoiled: number;
}

export type FlowStats = Record<IndustryType, FlowStatsData>;

export type TransactionParty = Resident | Company | CityTreasury | 'TREASURY' | 'MARKET' | 'GATHERERS';

export interface GameContext {
    residentMap: Map<string, Resident>;
    companyMap: Map<string, Company>;
    employeesByCompany: Record<string, Resident[]>;
    residentsByJob: Record<string, Resident[]>;
}
