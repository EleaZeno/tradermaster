
import { GameState, ResourceType, ProductType, IndustryType, FlowStats, GameContext, Company } from '../../shared/types';
import { MarketSystem } from './MarketSystem';
import { Transaction } from '../utils/Transaction';
import { ECO_CONSTANTS } from '../../shared/config';

export class ProductionSystem {
  static process(gameState: GameState, context: GameContext, flowStats: FlowStats, getEventModifier: (t: string) => number): void {
    ProductionSystem.processFixedCosts(gameState, context);
    ProductionSystem.processDepreciation(gameState);
    ProductionSystem.processSpoilage(gameState, flowStats);
    ProductionSystem.processFarming(gameState, context, flowStats, getEventModifier);
    ProductionSystem.processManufacturing(gameState, context, flowStats, getEventModifier);
    ProductionSystem.manageSales(gameState, context);
    ProductionSystem.processCapitalAllocation(gameState, context);
  }

  private static processFixedCosts(state: GameState, context: GameContext): void {
      state.companies.forEach(company => {
          if (company.isBankrupt) return;

          const fixedCost = (company.productionLines.length * ECO_CONSTANTS.ECONOMY.FIXED_COST_PER_LINE) + 
                            ((company.landTokens || 0) * ECO_CONSTANTS.ECONOMY.FIXED_COST_PER_LAND);
          
          if (company.cash >= fixedCost) {
               Transaction.transfer(company, 'TREASURY', fixedCost, { treasury: state.cityTreasury, residents: state.population.residents, context });
               company.accumulatedCosts += fixedCost;
               company.lastFixedCost = fixedCost;
          } else {
               company.cash = 0; 
               company.productionLines.forEach(l => l.efficiency *= 0.95);
          }
      });
  }

  private static processDepreciation(state: GameState): void {
      const rate = ECO_CONSTANTS.ECONOMY.DEPRECIATION_RATE;
      const scrapThreshold = ECO_CONSTANTS.ECONOMY.SCRAP_EFFICIENCY_THRESHOLD;

      state.companies.forEach(company => {
          if (company.isBankrupt) return;

          // Capital Depreciation
          for (let i = company.productionLines.length - 1; i >= 0; i--) {
              const line = company.productionLines[i];
              line.efficiency *= (1 - rate);
              
              if (line.efficiency < scrapThreshold) {
                  company.productionLines.splice(i, 1);
                  state.logs.unshift(`🏚️ ${company.name} 生产线报废 (效率过低)`);
              }
          }
      });
  }

  private static processCapitalAllocation(state: GameState, context: GameContext): void {
      state.companies.forEach(company => {
          if (company.isBankrupt || company.isPlayerFounded) return;

          const marketCap = company.sharePrice * company.totalShares;
          
          let inventoryValue = 0;
          Object.entries(company.inventory.raw).forEach(([k, v]) => {
             const price = state.resources[k as ResourceType]?.currentPrice || 1;
             inventoryValue += (v || 0) * price;
          });
          Object.entries(company.inventory.finished).forEach(([k, v]) => {
              inventoryValue += (v || 0) * 2; 
          });

          const replacementCost = company.cash + inventoryValue + (company.productionLines.length * 100) + (company.landTokens || 0) * 50;
          
          const q = marketCap / (replacementCost || 1);
          company.tobinQ = parseFloat(q.toFixed(2));

          if (q > 1.2 && company.cash > 200) {
              const lineType = company.productionLines[0].type;
              company.cash -= 100;
              company.productionLines.push({ type: lineType, isActive: true, efficiency: 1.0, allocation: 0, maxCapacity: 50 });
              const count = company.productionLines.length;
              company.productionLines.forEach(l => l.allocation = 1 / count);
              state.logs.unshift(`🏭 ${company.name} 扩建生产线 (Tobin's Q: ${q.toFixed(2)})`);
          }
      });
  }

  private static manageSales(state: GameState, context: GameContext): void {
      const farmers = context.residentsByJob['FARMER'] || [];
      const grainLastPrice = state.resources[ResourceType.GRAIN].currentPrice;

      farmers.forEach(r => {
             const surplus = (r.inventory[ResourceType.GRAIN] || 0) - 3.0; 
             if (surplus > 1.0) {
                 const urgency = Math.min(1.0, surplus / 20.0);
                 const targetPrice = Math.max(0.1, grainLastPrice * (1.1 - urgency * 0.3)); 
                 
                 MarketSystem.submitOrder(state, {
                     ownerId: r.id,
                     ownerType: 'RESIDENT',
                     itemId: ResourceType.GRAIN,
                     side: 'SELL',
                     type: 'LIMIT',
                     price: parseFloat(targetPrice.toFixed(2)),
                     quantity: Math.floor(surplus)
                 }, context);
             }
      });

      state.companies.forEach(c => {
          if (c.isBankrupt) return;
          const stock = c.inventory.finished[ProductType.BREAD] || 0;
          if (stock > 1) {
               const baseCost = c.avgCost > 0 ? c.avgCost : 1.5;
               const daysOfInventory = stock / Math.max(1, c.monthlySalesVolume / 30);
               let inventoryMarkupMod = 0;
               if (daysOfInventory > 10) inventoryMarkupMod = -0.1;
               if (daysOfInventory < 3) inventoryMarkupMod = 0.2;

               const markup = 0.2 + (c.pricePremium || 0) + inventoryMarkupMod; 
               const targetPrice = baseCost * (1 + markup);
               
               const finalPrice = parseFloat(Math.max(0.5, targetPrice).toFixed(2));
               
               MarketSystem.submitOrder(state, {
                   ownerId: c.id,
                   ownerType: 'COMPANY',
                   itemId: ProductType.BREAD,
                   side: 'SELL',
                   type: 'LIMIT',
                   price: finalPrice,
                   quantity: Math.floor(stock)
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
        const K = resident.landTokens || 1;
        const A = (resident.intelligence / 75);
        const L = 1;
        
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

      actualWorkers.forEach(worker => {
        Transaction.transfer(company, worker, company.wageOffer, { treasury: gameState.cityTreasury, residents: gameState.population.residents, context });
        company.accumulatedCosts += company.wageOffer;
        totalWageCost += company.wageOffer;
        
        const taxRate = gameState.cityTreasury.taxPolicy.incomeTaxRate; 
        const tax = company.wageOffer * taxRate;
        Transaction.transfer(worker, 'TREASURY', tax, { treasury: gameState.cityTreasury, residents: gameState.population.residents, context });
        gameState.cityTreasury.dailyIncome += tax;
      });

      company.productionLines.forEach(line => {
        if (!line.isActive) return;
        
        const mod = getMod(line.type);
        const ceo = context.residentMap.get(company.ceoId);
        const ceoMod = ceo ? (1 + (ceo.leadership - 50) / 200) : 1.0;
        const A = line.efficiency * ceoMod * mod;
        const K = Math.max(1, company.landTokens || 1); 
        const L = actualWorkers.length;
        const output = 2.5 * A * Math.pow(K, 0.3) * Math.pow(L, 0.7);

        let materialCost = 0;
        let actualOutput = output;
        
        if (line.type === ProductType.BREAD) {
            const needed = output * 0.8;
            let currentRaw = company.inventory.raw[ResourceType.GRAIN] || 0;
            
            if (currentRaw < needed && company.cash > 0) {
                const book = gameState.market[ResourceType.GRAIN];
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
                            type: 'LIMIT', 
                            price: bestAsk * 1.05, 
                            quantity: buyAmount
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
            const oldQty = company.inventory.finished[line.type] || 0;
            const oldCost = company.avgCost; 
            const newTotalCost = totalWageCost + materialCost; 
            const totalQty = oldQty + actualOutput;
            if (totalQty > 0) {
                company.avgCost = ((oldQty * oldCost) + newTotalCost) / totalQty;
            }

            company.inventory.finished[line.type] = oldQty + actualOutput;
            flowStats[line.type].produced += actualOutput;
            company.monthlyProductionVolume += actualOutput;
        }
      });
    });
  }
}
