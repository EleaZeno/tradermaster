
import { describe, it, expect, beforeEach } from 'vitest';
import { MarketSystem } from '../../../domain/systems/MarketSystem';
import { INITIAL_POPULATION, INITIAL_CITY_TREASURY, INITIAL_COMPANIES, INITIAL_RESOURCES, INITIAL_PRODUCTS } from '../../../shared/initialState';
import { GameState, ResourceType, ProductType, OrderBook } from '../../../shared/types';

// Helper to create empty books
const createEmptyBook = (price: number): OrderBook => ({
    bids: [], asks: [], lastPrice: price, history: []
});

// Helper to create a clean mock state
const createMockState = (): GameState => ({
    day: 1,
    cash: 100,
    mayorId: 'res_mayor',
    cityTreasury: { ...INITIAL_CITY_TREASURY, cash: 1000 },
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
    }
});

describe('MarketSystem', () => {
    let mockState: GameState;

    beforeEach(() => {
        mockState = createMockState();
    });

    describe('submitOrder (Sell)', () => {
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
                amount: 10
            });
            
            const book = mockState.market[ResourceType.GRAIN];
            expect(book.asks.length).toBe(1);
            expect(book.asks[0].price).toBe(2.0);
            expect(book.asks[0].amount).toBe(10);
            
            // Assets should be locked
            expect(seller.inventory[ResourceType.GRAIN]).toBe(40);
        });
    });

    describe('submitOrder (Buy / Match)', () => {
        it('should execute trade when bid matches ask', () => {
            const buyer = mockState.population.residents[0];
            buyer.cash = 100;
            buyer.inventory[ResourceType.GRAIN] = 0;

            // Setup Ask
            mockState.market[ResourceType.GRAIN].asks.push({
                id: 'ask1', ownerId: 'seller1', ownerType: 'RESIDENT', itemId: ResourceType.GRAIN,
                side: 'SELL', type: 'LIMIT', price: 5.0, amount: 10, filled: 0, timestamp: 0
            });

            // Submit Buy
            const result = MarketSystem.submitOrder(mockState, {
                ownerId: buyer.id,
                ownerType: 'RESIDENT',
                itemId: ResourceType.GRAIN,
                side: 'BUY',
                type: 'LIMIT',
                price: 5.0,
                amount: 1
            });
            
            expect(result).toBe(true);
            
            // Buyer should have item
            expect(buyer.inventory[ResourceType.GRAIN]).toBe(1);
            // Buyer cash reduced (5.0)
            expect(buyer.cash).toBe(95);
            
            // Ask should be filled partial
            const book = mockState.market[ResourceType.GRAIN];
            expect(book.asks[0].filled).toBe(1);
        });
    });
});
