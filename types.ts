
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

export interface Resident {
  id: string;
  name: string;
  age: number;
  isPlayer: boolean;
  wealth: number; 
  cash: number;   
  job: 'UNEMPLOYED' | 'FARMER' | 'WORKER' | 'EXECUTIVE' | 'MAYOR' | 'DEPUTY_MAYOR' | 'UNION_LEADER' | 'FINANCIER'; 
  employerId?: string; 
  salary: number; 
  intelligence: number; 
  leadership: number;   
  happiness: number;
  livingStandard: LivingStandard; 
  timePreference: number; 
  needs: Record<string, number>; 
  inventory: Partial<Record<string, number>>;
  portfolio: Record<string, number>; 
  futuresPositions: FuturesPosition[]; 
  politicalStance: 'CAPITALIST' | 'SOCIALIST' | 'CENTRIST';
  influence: number; 
  landTokens?: number; // Added Land Scarcity Token
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
  efficiency: number; 
  allocation: number; 
}

export interface Company {
  id: string;
  name: string;
  description?: string;
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
  aiPersonality: 'AGGRESSIVE' | 'CONSERVATIVE' | 'BALANCED';
  boardMembers: string[]; 
  unionTension: number; 
  strikeDays: number; 
  inventory: {
    raw: Partial<Record<ResourceType, number>>;
    finished: Partial<Record<IndustryType, number>>;
  };
  landTokens?: number; // Companies can also own land
  avgCost: number;
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
  landTokens?: number; // Government land
}

export interface Election {
  active: boolean;
  cycle: number; 
  nextDate: number;
  candidates: { residentId: string; name: string; votes: number }[];
  winnerId: string | null;
}

export interface MarketEvent {
  headline: string;
  description: string;
  impactType: 'GOOD' | 'BAD' | 'NEUTRAL';
  turnCreated: number;
  effect?: {
      target: string;
      modifier: number;
  };
}

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

export interface Order {
    id: string;
    ownerId: string;
    ownerType: 'RESIDENT' | 'COMPANY' | 'TREASURY'; 
    itemId: string;
    side: OrderSide;
    type: OrderType;
    price: number; 
    amount: number;
    filled: number;
    timestamp: number;
}

export interface Trade {
    price: number;
    amount: number;
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

export interface GameState {
  cash: number; 
  day: number;
  mayorId: string | null;
  cityTreasury: CityTreasury;
  election: Election;
  population: PopulationState;
  resources: Record<ResourceType, ResourceItem>;
  products: Record<ProductType, ProductItem>;
  companies: Company[];
  funds: Fund[];
  futures: FuturesPosition[];
  events: MarketEvent[];
  netWorthHistory: { day: number; value: number }[];
  macroHistory: { day: number; gdp: number; cpi: number }[];
  chatHistory: ChatMessage[];
  logs: string[];
  economicOverview: EconomicSnapshot; 
  market: Record<string, OrderBook>;
}

export interface AgentAdvice {
  text: string;
  action?: string;
}
