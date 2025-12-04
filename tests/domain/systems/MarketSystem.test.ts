


import { describe, it, expect, beforeEach } from 'vitest';
import { MarketSystem } from '../../../domain/systems/MarketSystem';
import { INITIAL_POPULATION, INITIAL_CITY_TREASURY, INITIAL_COMPANIES, INITIAL_RESOURCES, INITIAL_PRODUCTS } from '../../../shared/initialState';
import { GameState, ResourceType, ProductType, OrderBook, BusinessCyclePhase, MayorPersonality } from '../../../shared/types';

// Helper to create empty books
const createEmptyBook = (price: number): OrderBook => ({
    bids: [], asks: [], lastPrice: price, history: [], volatility: 0, spread: 0
});

// Helper to create a clean mock state
const createMockState = (): GameState => ({
    day: 1,
    totalTicks: 0,
    cash: 100,
    mayorId: 'res_mayor',
    cityTreasury: { ...INITIAL_CITY_TREASURY, cash: 1000 },
    bank: { 
        system: 'FIAT_MONEY',
        reserves: 1000, moneySupply: 1000, reserveRatio: 0.1, creditMultiplier: 1.0,
        totalDeposits: 0, totalLoans: 0, depositRate: 0.001, loanRate: 0.003, 
        targetInflation: 0.02, targetUnemployment: 0.05,
        yieldCurve: { rate1d: 0.001, rate30d: 0.003, rate365d: 0.005 },
        loans: [], deposits: [], history: [] 
    },
    election: { active: false, cycle: 1, nextDate: 10, candidates: [], winnerId: null },
    population: JSON.parse(JSON.stringify(INITIAL_POPULATION)),
    resources: JSON.parse(JSON.stringify(INITIAL_RESOURCES)),
    products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
    companies: JSON.parse(JSON.stringify(INITIAL_COMPANIES)),
    funds: [],
    futures: [],
    events: [],
    netWorthHistory: [],
    macroHistory: [],
    chatHistory: [],
    logs: [],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    },
    market: {
        [ResourceType.GRAIN]: createEmptyBook(1.0),
        [ProductType.BREAD]: createEmptyBook(2.0)
    },
    map: [],
    achievements: [],
    notifications: [],
    settings: {
        language: 'zh',
        notifications: {
            trades: true,
            achievements: true,
            news: true
        }
    },
    policyOverrides: {
        interestRate: null,
        moneyPrinter: 0,
        migrationRate: 1.0,
        taxMultiplier: 1.0,
        minWage: 0
    },
    businessCycle: BusinessCyclePhase.RECOVERY,
    mayorPersonality: MayorPersonality.KEYNESIAN,
    economicHealth: {
        score: 100, stability: 100, productivity: 50, debtRisk: 0, liquidity: 100, equality: 80
    }
});

describe('MarketSystem', () => {
    let mockState: GameState;

    beforeEach(() => {
        mockState = createMockState();
    });

    describe('Order Submission', () => {
        it('should add ask order to book', () => {
            const seller = mockState.population.residents[0];
            seller.inventory[ResourceType.GRAIN] = 50;
            
            MarketSystem.submitOrder(mockState, {
                ownerId: seller.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'SELL',
                type: 'LIMIT',
                price: 2.0,
                quantity: 10
            });
            
            const book = mockState.market[ResourceType.GRAIN];
            expect(book.asks.length).toBe(1);
            expect(book.asks[0].price).toBe(2.0);
            expect(book.asks[0].remainingQuantity).toBe(10);
            
            // Assets should be locked
            expect(seller.inventory[ResourceType.GRAIN]).toBe(40);
        });
    });

    describe('Order Matching', () => {
        it('should execute trade when bid matches ask exactly', () => {
            const buyer = mockState.population.residents[0];
            buyer.cash = 100;
            buyer.inventory[ResourceType.GRAIN] = 0;

            const seller = mockState.population.residents[1];
            seller.cash = 0;
            seller.inventory[ResourceType.GRAIN] = 20;

            // 1. Submit Sell Limit Order
            MarketSystem.submitOrder(mockState, {
                ownerId: seller.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'SELL',
                type: 'LIMIT',
                price: 5.0,
                quantity: 10
            });

            // 2. Submit Buy Limit Order
            const result = MarketSystem.submitOrder(mockState, {
                ownerId: buyer.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'BUY',
                type: 'LIMIT',
                price: 5.0,
                quantity: 10
            });
            
            expect(result).toBe(true);
            
            // Buyer should have item
            expect(buyer.inventory[ResourceType.GRAIN]).toBe(10);
            // Buyer cash reduced (5.0 * 10 = 50)
            expect(buyer.cash).toBe(50);
            
            // Seller gets cash (50 - 5% tax = 47.5)
            const tax = 50 * 0.05;
            expect(seller.cash).toBe(50 - tax);

            // Books should be empty
            const book = mockState.market[ResourceType.GRAIN];
            expect(book.asks.length).toBe(0);
            expect(book.bids.length).toBe(0);
        });

        it('should partially match when quantities differ', () => {
            const buyer = mockState.population.residents[0];
            buyer.cash = 200;

            const seller = mockState.population.residents[1];
            seller.inventory[ResourceType.GRAIN] = 20;

            // Sell 20
            MarketSystem.submitOrder(mockState, {
                ownerId: seller.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'SELL',
                type: 'LIMIT',
                price: 5.0,
                quantity: 20
            });

            // Buy 10
            MarketSystem.submitOrder(mockState, {
                ownerId: buyer.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'BUY',
                type: 'LIMIT',
                price: 5.0,
                quantity: 10
            });

            const book = mockState.market[ResourceType.GRAIN];
            // Seller order should remain with 10 left
            expect(book.asks.length).toBe(1);
            expect(book.asks[0].remainingQuantity).toBe(10);
            expect(book.asks[0].status).toBe('PARTIALLY_EXECUTED');
        });
    });
});