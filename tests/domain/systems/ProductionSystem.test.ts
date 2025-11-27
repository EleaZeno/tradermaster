
import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionSystem } from '../../../domain/systems/ProductionSystem';
import { GameState, ResourceType, ProductType, FlowStats, OrderBook, GameContext } from '../../../shared/types';
import { INITIAL_POPULATION, INITIAL_COMPANIES, INITIAL_RESOURCES, INITIAL_PRODUCTS, INITIAL_CITY_TREASURY } from '../../../shared/initialState';

// Helper to create empty books
const createEmptyBook = (price: number): OrderBook => ({
    bids: [], asks: [], lastPrice: price, history: []
});

const createMockState = (): GameState => ({
    day: 1, cash: 100, mayorId: 'res_mayor',
    cityTreasury: JSON.parse(JSON.stringify(INITIAL_CITY_TREASURY)),
    bank: { 
        reserves: 1000, totalDeposits: 0, totalLoans: 0, depositRate: 0.001, loanRate: 0.003, 
        targetInflation: 0.02, targetUnemployment: 0.05,
        loans: [], deposits: [], history: [] 
    },
    election: { active: false, cycle: 1, nextDate: 10, candidates: [], winnerId: null },
    population: JSON.parse(JSON.stringify(INITIAL_POPULATION)),
    resources: JSON.parse(JSON.stringify(INITIAL_RESOURCES)),
    products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
    companies: JSON.parse(JSON.stringify(INITIAL_COMPANIES)),
    funds: [], futures: [], events: [], netWorthHistory: [], macroHistory: [], chatHistory: [], logs: [],
    economicOverview: {
        totalResidentCash: 0, totalCorporateCash: 0, totalFundCash: 0, totalCityCash: 0, totalSystemGold: 0,
        totalInventoryValue: 0, totalMarketCap: 0, totalFuturesNotional: 0,
        inventoryAudit: {}
    },
    market: {
        [ResourceType.GRAIN]: createEmptyBook(1.0),
        [ProductType.BREAD]: createEmptyBook(2.0)
    },
    achievements: [],
    notifications: []
});

const createMockContext = (state: GameState): GameContext => {
    return {
        residentMap: new Map(state.population.residents.map(r => [r.id, r])),
        companyMap: new Map(state.companies.map(c => [c.id, c])),
        employeesByCompany: {},
        residentsByJob: {}
    };
};

describe('ProductionSystem', () => {
    let mockState: GameState;
    let flowStats: FlowStats;
    let mockContext: GameContext;

    beforeEach(() => {
        mockState = createMockState();
        mockContext = createMockContext(mockState);
        flowStats = {
            [ResourceType.GRAIN]: { produced: 0, consumed: 0, spoiled: 0 },
            [ProductType.BREAD]: { produced: 0, consumed: 0, spoiled: 0 }
        };
    });

    it('should calculate farming output correctly', () => {
        const farmer = mockState.population.residents.find(r => r.job === 'FARMER');
        if (farmer) {
            farmer.inventory[ResourceType.GRAIN] = 0;
            farmer.intelligence = 100;
            farmer.landTokens = 1;
            mockContext.residentsByJob['FARMER'] = [farmer];
        }

        ProductionSystem.process(mockState, mockContext, flowStats, () => 1.0);

        if (farmer) {
            expect(farmer.inventory[ResourceType.GRAIN]).toBeGreaterThan(0);
            expect(flowStats[ResourceType.GRAIN].produced).toBeGreaterThan(0);
        }
    });

    it('should consume raw materials for manufacturing', () => {
        const factory = mockState.companies.find(c => c.productionLines.some(l => l.type === ProductType.BREAD));
        if (factory) {
            factory.inventory.raw[ResourceType.GRAIN] = 100;
            factory.inventory.finished[ProductType.BREAD] = 0;
            factory.cash = 1000;
            factory.employees = 5; // Ensure enough workers
            
            // Mock workers
            mockState.population.residents.forEach(r => {
                if (r.job === 'WORKER') r.employerId = factory.id;
            });
            mockContext.employeesByCompany[factory.id] = mockState.population.residents.filter(r => r.employerId === factory.id);
        }

        ProductionSystem.process(mockState, mockContext, flowStats, () => 1.0);

        if (factory) {
            expect(factory.inventory.finished[ProductType.BREAD]).toBeGreaterThan(0);
            expect(factory.inventory.raw[ResourceType.GRAIN]).toBeLessThan(100);
            expect(flowStats[ResourceType.GRAIN].consumed).toBeGreaterThan(0);
        }
    });
});
