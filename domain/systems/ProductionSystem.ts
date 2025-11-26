
import { GameState, ResourceType, ProductType, IndustryType, FlowStats, GameContext } from '../../shared/types';
import { MarketSystem } from './MarketSystem';
import { Transaction } from '../utils/Transaction';

export class ProductionSystem {
  static process(gameState: GameState, context: GameContext, flowStats: FlowStats, getEventModifier: (t: string) => number): void {
    ProductionSystem.processSpoilage(gameState, flowStats);
    ProductionSystem.processFarming(gameState, context, flowStats, getEventModifier);
    ProductionSystem.processManufacturing(gameState, context, flowStats, getEventModifier);
    ProductionSystem.manageSales(gameState, context);
  }

  private static manageSales(state: GameState, context: GameContext): void {
      // 1. Farmers selling Grain (Limit Orders based on Utility?)
      // Simplification: Farmers sell surplus at Market Price +/- noise to create spread
      const farmers = context.residentsByJob['FARMER'] || [];
      const grainLastPrice = state.resources[ResourceType.GRAIN].currentPrice;

      farmers.forEach(r => {
             const surplus = (r.inventory[ResourceType.GRAIN] || 0) - 3.0; 
             if (surplus > 1.0) {
                 // Price Logic: If inventory high, desperate sell. If low, hold out.
                 const urgency = Math.min(1.0, surplus / 20.0);
                 const targetPrice = Math.max(0.1, grainLastPrice * (1.1 - urgency * 0.3)); 
                 
                 MarketSystem.submitOrder(state, {
                     ownerId: r.id,
                     ownerType: 'RESIDENT',
                     itemId: ResourceType.GRAIN,
                     side: 'SELL',
                     type: 'LIMIT',
                     price: parseFloat(targetPrice.toFixed(2)),
                     amount: Math.floor(surplus)
                 }, context);
             }
      });

      // 2. Companies selling Bread (Marginal Cost Pricing)
      state.companies.forEach(c => {
          if (c.isBankrupt) return;
          const stock = c.inventory.finished[ProductType.BREAD] || 0;
          if (stock > 1) {
               // Pricing Strategy: MC * (1 + Markup)
               // Markup depends on market share or scarcity
               const markup = 0.2 + (c.pricePremium || 0); 
               const targetPrice = c.avgCost > 0 ? c.avgCost * (1 + markup) : 2.0;
               
               // Adjust for massive inventory (Clearance)
               const clearanceMod = stock > 50 ? 0.8 : 1.0;
               
               const finalPrice = parseFloat(Math.max(0.5, targetPrice * clearanceMod).toFixed(2));
               
               MarketSystem.submitOrder(state, {
                   ownerId: c.id,
                   ownerType: 'COMPANY',
                   itemId: ProductType.BREAD,
                   side: 'SELL',
                   type: 'LIMIT',
                   price: finalPrice,
                   amount: Math.floor(stock)
               }, context);
          }
      });
  }

  private static processSpoilage(gameState: GameState, flowStats: FlowStats): void {
    const applySpoilage = (amount: number, type: IndustryType, isCompany: boolean) => {
      if (amount < 0.1) return 0;
      let baseRate = type === ProductType.BREAD ? 0.05 : 0.02; 
      if (amount > 100) baseRate *= 2;
      const rate = isCompany ? baseRate * 0.5 : baseRate; 
      const loss = amount * rate;
      flowStats[type].spoiled += loss;
      return loss;
    };

    gameState.population.residents.forEach(resident => {
      ([ResourceType.GRAIN, ProductType.BREAD] as IndustryType[]).forEach(type => {
        const amount = resident.inventory[type] || 0;
        const loss = applySpoilage(amount, type, false);
        if (loss > 0) resident.inventory[type] = amount - loss;
      });
    });

    gameState.companies.forEach(company => {
        const rawGrain = company.inventory.raw[ResourceType.GRAIN] || 0;
        const grainLoss = applySpoilage(rawGrain, ResourceType.GRAIN, true);
        if (grainLoss > 0) company.inventory.raw[ResourceType.GRAIN] = rawGrain - grainLoss;

        ([ResourceType.GRAIN, ProductType.BREAD] as IndustryType[]).forEach(type => {
            const amount = company.inventory.finished[type] || 0;
            const loss = applySpoilage(amount, type, true);
            if (loss > 0) company.inventory.finished[type] = amount - loss;
        });
    });
  }

  private static processFarming(gameState: GameState, context: GameContext, flowStats: FlowStats, getMod: (t: string) => number): void {
    const farmers = context.residentsByJob['FARMER'] || [];
    farmers.forEach(resident => {
        const mod = getMod(ResourceType.GRAIN);
        // Land acts as Capital (K)
        const K = resident.landTokens || 1;
        // Intelligence acts as Productivity (A)
        const A = (resident.intelligence / 75);
        // Labor (L) is fixed at 1 for individual farmers
        const L = 1;
        
        // Simple Cobb-Douglas: Y = A * K^0.5 * L^0.5
        const output = 2.0 * A * Math.pow(K, 0.5) * Math.pow(L, 0.5) * mod;
        
        resident.inventory[ResourceType.GRAIN] = (resident.inventory[ResourceType.GRAIN] || 0) + output;
        flowStats[ResourceType.GRAIN].produced += output;
    });
  }

  private static processManufacturing(gameState: GameState, context: GameContext, flowStats: FlowStats, getMod: (t: string) => number): void {
    const employeesByCompany = context.employeesByCompany;

    gameState.companies.forEach(company => {
      if (company.isBankrupt) return;

      const employees = employeesByCompany[company.id] || [];
      const actualWorkers = employees.filter(r => r.job === 'WORKER');
      
      const wageBill = employees.length * company.wageOffer;
      if (company.cash < wageBill) return; 

      let totalWageCost = 0;

      // Pay Wages
      actualWorkers.forEach(worker => {
        Transaction.transfer(company, worker, company.wageOffer, { treasury: gameState.cityTreasury, residents: gameState.population.residents, context });
        company.accumulatedCosts += company.wageOffer;
        totalWageCost += company.wageOffer;
        
        const taxRate = gameState.cityTreasury.taxPolicy.incomeTaxRate; 
        const tax = company.wageOffer * taxRate;
        Transaction.transfer(worker, 'TREASURY', tax, { treasury: gameState.cityTreasury, residents: gameState.population.residents, context });
        gameState.cityTreasury.dailyIncome += tax;
      });

      // Production Lines
      company.productionLines.forEach(line => {
        if (!line.isActive) return;
        
        const mod = getMod(line.type);
        
        // --- Cobb-Douglas Production Function ---
        // Y = A * K^alpha * L^beta
        
        // A = Efficiency * CEO Leadership
        const ceo = context.residentMap.get(company.ceoId);
        const ceoMod = ceo ? (1 + (ceo.leadership - 50) / 200) : 1.0;
        const A = line.efficiency * ceoMod * mod;

        // K = Capital (Land + Machinery). Machinery approximated by 'landTokens' for now
        const K = Math.max(1, company.landTokens || 1); 

        // L = Labor
        const L = actualWorkers.length;

        // Alpha/Beta parameters (Labor intensive)
        const output = 2.5 * A * Math.pow(K, 0.3) * Math.pow(L, 0.7);

        let materialCost = 0;
        let actualOutput = output;
        
        if (line.type === ProductType.BREAD) {
            const needed = output * 0.8;
            let currentRaw = company.inventory.raw[ResourceType.GRAIN] || 0;
            
            // Just-In-Time Procurement from LOB
            if (currentRaw < needed && company.cash > 0) {
                const book = gameState.market[ResourceType.GRAIN];
                // Check LOB Best Ask
                const bestAsk = book?.asks[0]?.price;
                
                if (bestAsk) {
                   const affordQty = Math.floor(company.cash / bestAsk);
                   const buyAmount = Math.min(Math.ceil(needed - currentRaw + 10), affordQty);
                   
                   if (buyAmount > 0) {
                        MarketSystem.submitOrder(gameState, {
                            ownerId: company.id,
                            ownerType: 'COMPANY',
                            itemId: ResourceType.GRAIN,
                            side: 'BUY',
                            type: 'LIMIT', // Use Limit to avoid slippage? Or Market for speed?
                            price: bestAsk * 1.05, // Willing to pay slight premium
                            amount: buyAmount
                        }, context);
                        currentRaw = company.inventory.raw[ResourceType.GRAIN] || 0;
                   }
                }
            }

            if (currentRaw < needed) actualOutput = currentRaw / 0.8; 
            const consumed = actualOutput * 0.8;
            if (consumed > 0) {
                company.inventory.raw[ResourceType.GRAIN] = (company.inventory.raw[ResourceType.GRAIN] || 0) - consumed;
                flowStats[ResourceType.GRAIN].consumed += consumed;
                materialCost += consumed * gameState.resources[ResourceType.GRAIN].currentPrice; 
            }
        }

        if (actualOutput > 0) {
            company.inventory.finished[line.type] = (company.inventory.finished[line.type] || 0) + actualOutput;
            flowStats[line.type].produced += actualOutput;
            company.monthlyProductionVolume += actualOutput;
            
            // Calculate Unit Cost (MC approximation)
            const unitCost = (totalWageCost + materialCost) / actualOutput;
            if (actualOutput > 0 && unitCost > 0) {
                 // Exponential moving average for cost smoothing
                 company.avgCost = (company.avgCost * 0.8) + (unitCost * 0.2);
            }
        }
      });
    });
  }
}
