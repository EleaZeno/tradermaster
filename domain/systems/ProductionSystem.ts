import { GameState, ResourceType, ProductType, IndustryType } from '../../shared/types';
import { Transaction } from '../utils/Transaction';

export class ProductionSystem {
  static process(gameState: GameState, flowStats: any, getEventModifier: (t: string) => number) {
    ProductionSystem.processSpoilage(gameState, flowStats);
    ProductionSystem.processFarming(gameState, flowStats, getEventModifier);
    ProductionSystem.processManufacturing(gameState, flowStats, getEventModifier);
  }

  private static processSpoilage(gameState: GameState, flowStats: any) {
    const applySpoilage = (amount: number, type: IndustryType, isCompany: boolean) => {
      if (amount < 0.1) return 0;
      
      let baseRate = type === ProductType.BREAD ? 0.05 : 0.02; 
      
      // Accelerate spoilage for hoarding
      if (amount > 100) baseRate *= 2;
      if (amount > 300) baseRate *= 2;

      const rate = isCompany ? baseRate * 0.5 : baseRate; 
      const loss = amount * rate;
      flowStats[type].spoiled += loss;
      return loss;
    };

    // Resident Inventory Spoilage
    gameState.population.residents.forEach(resident => {
      [ResourceType.GRAIN, ProductType.BREAD].forEach(t => {
        const type = t as IndustryType;
        const loss = applySpoilage(resident.inventory[type] || 0, type, false);
        if (loss > 0) resident.inventory[type]! -= loss;
      });
    });

    // Company Inventory Spoilage
    gameState.companies.forEach(company => {
        const grainLoss = applySpoilage(company.inventory.raw[ResourceType.GRAIN] || 0, ResourceType.GRAIN, true);
        if (grainLoss > 0) company.inventory.raw[ResourceType.GRAIN]! -= grainLoss;

        [ResourceType.GRAIN, ProductType.BREAD].forEach(t => {
            const type = t as IndustryType;
            const loss = applySpoilage(company.inventory.finished[type] || 0, type, true);
            if (loss > 0) company.inventory.finished[type]! -= loss;
        });
    });

    // Market Inventory Spoilage
    const marketLoss = applySpoilage(gameState.resources[ResourceType.GRAIN].marketInventory, ResourceType.GRAIN, true);
    if (marketLoss > 0) gameState.resources[ResourceType.GRAIN].marketInventory -= marketLoss;
  }

  private static processFarming(gameState: GameState, flowStats: any, getMod: (t: string) => number) {
    gameState.population.residents.forEach(resident => {
      if (resident.job === 'FARMER') {
        const mod = getMod(ResourceType.GRAIN);
        const landFactor = resident.landTokens || 1; 
        
        const output = landFactor * 2.2 * (resident.intelligence / 75) * mod;
        
        resident.inventory[ResourceType.GRAIN] = (resident.inventory[ResourceType.GRAIN] || 0) + output;
        flowStats[ResourceType.GRAIN].produced += output;

        // Auto-sell surplus
        if ((resident.inventory[ResourceType.GRAIN] || 0) > 3.0) {
          const toSell = (resident.inventory[ResourceType.GRAIN] || 0) - 3.0;
          resident.inventory[ResourceType.GRAIN] = 3.0;
          gameState.resources[ResourceType.GRAIN].marketInventory += toSell;
        }
      }
    });
  }

  private static processManufacturing(gameState: GameState, flowStats: any, getMod: (t: string) => number) {
    gameState.companies.forEach(company => {
      if (company.isBankrupt) return;

      const employees = gameState.population.residents.filter(r => r.employerId === company.id && (r.job === 'WORKER' || r.job === 'UNION_LEADER'));
      const actualWorkers = employees.filter(r => r.job === 'WORKER');
      
      const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
      const wageBill = employees.length * company.wageOffer;
      
      // Stop production if inventory full or cash empty
      if (stock > 40 || company.cash < wageBill) return; 

      let totalWageCost = 0;

      // Pay Wages
      actualWorkers.forEach(worker => {
        Transaction.transfer(company, worker, company.wageOffer, { treasury: gameState.cityTreasury, residents: gameState.population.residents });
        company.accumulatedCosts += company.wageOffer;
        totalWageCost += company.wageOffer;
        
        // Income Tax
        const taxRate = gameState.cityTreasury.taxPolicy.incomeTaxRate; 
        const tax = company.wageOffer * taxRate;
        Transaction.transfer(worker, 'TREASURY', tax, { treasury: gameState.cityTreasury, residents: gameState.population.residents });
        gameState.cityTreasury.dailyIncome += tax;
      });

      // Production Lines
      company.productionLines.forEach(line => {
        if (!line.isActive) return;
        
        const teamMod = Math.max(0.5, 1.0 - (actualWorkers.length - 2) * 0.1);
        const mod = getMod(line.type);
        
        let landMod = 1.0;
        if (line.type === ResourceType.GRAIN) {
            const land = company.landTokens || 0;
            if (land === 0) landMod = 0.1; 
            else landMod = 1.0 + (land / 20); 
        }

        let output = 0;
        actualWorkers.forEach(w => output += (6.0 * (w.intelligence / 75) * line.efficiency * teamMod * mod * landMod));
        
        // CEO Bonus
        const ceo = gameState.population.residents.find(r => r.id === company.ceoId);
        if (ceo) output *= (1 + (ceo.leadership - 50) / 200);

        let materialCost = 0;
        
        // Supply Chain Logic for Manufacturing
        if (line.type === ProductType.BREAD) {
            const needed = output * 0.8;
            let currentRaw = company.inventory.raw[ResourceType.GRAIN] || 0;
            
            // Try to buy raw materials if missing
            if (currentRaw < needed && company.cash > 0) {
                const price = gameState.resources[ResourceType.GRAIN].currentPrice;
                const marketInv = gameState.resources[ResourceType.GRAIN].marketInventory;
                const buyAmount = Math.min(marketInv, needed - currentRaw + 20, Math.floor(company.cash/price));
                
                if (buyAmount > 0) {
                    if (Transaction.transfer(company, 'GATHERERS', buyAmount * price, { treasury: gameState.cityTreasury, residents: gameState.population.residents })) {
                        gameState.resources[ResourceType.GRAIN].marketInventory -= buyAmount;
                        company.inventory.raw[ResourceType.GRAIN] = (company.inventory.raw[ResourceType.GRAIN] || 0) + buyAmount;
                        currentRaw += buyAmount;
                        gameState.resources[ResourceType.GRAIN].dailySales += buyAmount;
                        materialCost += buyAmount * price;
                    }
                }
            }

            // Cap output by available raw materials
            if (currentRaw < needed) output = currentRaw / 0.8; 
            const consumed = output * 0.8;
            if (consumed > 0) {
                company.inventory.raw[ResourceType.GRAIN]! -= consumed;
                flowStats[ResourceType.GRAIN].consumed += consumed;
                materialCost += consumed * gameState.resources[ResourceType.GRAIN].currentPrice; 
            }
        }

        if (output > 0) {
            company.inventory.finished[line.type] = (company.inventory.finished[line.type] || 0) + output;
            flowStats[line.type].produced += output;
            company.monthlyProductionVolume += output;
            
            // Update average cost accounting
            const unitCost = (totalWageCost + materialCost) / output;
            if (output > 0 && unitCost > 0) {
                 company.avgCost = (company.avgCost * 0.7) + (unitCost * 0.3);
            }
        }
      });
    });
  }
}