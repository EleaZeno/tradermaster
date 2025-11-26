import { GameState, ProductType, ResourceType } from '../../shared/types';
import { MarketSystem } from './MarketSystem';
import { Transaction } from '../utils/Transaction';

export class ConsumerSystem {
  static DAILY_GRAIN_NEED = 1.0;        
  static BREAD_SUBSTITUTE_RATIO = 0.8;  
  
  static process(state: GameState, flowStats: any) {
    const { residents } = state.population;
    const resources = state.resources;
    const products = state.products;
    // @ts-ignore
    const treasury = state.cityTreasury;

    const grainPrice = resources[ResourceType.GRAIN].currentPrice;
    const breadPrice = products[ProductType.BREAD].marketPrice;

    residents.forEach(resident => {
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         Transaction.transfer('TREASURY', resident, resident.salary, { treasury, residents });
      }

      if (!resident.isPlayer && resident.happiness < 10) {
        resident.happiness = 0;
        state.logs.unshift(`⚰️ ${resident.name} 饿死街头`);
        return;
      }

      let breadToEat = 0;
      const canAffordBread = resident.cash > breadPrice * 1.5; 
      if (canAffordBread && resident.livingStandard !== 'SURVIVAL') {
        breadToEat = Math.min(
          Math.floor(resident.cash / breadPrice),
          resident.inventory.BREAD || 0,
          1 
        );
      }

      const grainNeeded = Math.max(0, ConsumerSystem.DAILY_GRAIN_NEED - breadToEat * 1.0);
      let grainEaten = 0;

      if (grainNeeded > 0) {
        if ((resident.inventory.GRAIN || 0) >= grainNeeded) {
            resident.inventory.GRAIN! -= grainNeeded;
            grainEaten = grainNeeded;
        } else if ((resident.inventory.GRAIN || 0) > 0) {
            grainEaten = resident.inventory.GRAIN || 0;
            resident.inventory.GRAIN = 0;
        }
      }

      const totalSatisfied = grainEaten + breadToEat * 1.0;
      
      if (totalSatisfied < ConsumerSystem.DAILY_GRAIN_NEED * 0.9) {
        
        let boughtBread = 0;
        if (breadToEat === 0 && resident.cash >= breadPrice && products.BREAD.marketInventory > 0) {
          if (MarketSystem.attemptPurchase(state, resident, ProductType.BREAD, 1)) {
            resident.inventory.BREAD = (resident.inventory.BREAD || 0) + 1;
            boughtBread = 1;
            resident.inventory.BREAD -= 1;
            products.BREAD.dailySales += 1; 
            flowStats[ProductType.BREAD].consumed += 1;
            breadToEat += 1; 
          }
        }

        const missingAfterBread = ConsumerSystem.DAILY_GRAIN_NEED - (totalSatisfied + boughtBread * 1.0);
        if (missingAfterBread > 0.1) {
             const cost = grainPrice * missingAfterBread;
             if (resident.cash >= cost && resources.GRAIN.marketInventory > 0) {
                 const unitsToBuy = Math.ceil(missingAfterBread);
                 for (let i=0; i<unitsToBuy; i++) {
                     if(MarketSystem.attemptPurchase(state, resident, ResourceType.GRAIN, 1)) {
                         resident.inventory.GRAIN = (resident.inventory.GRAIN || 0) + 1;
                     } else {
                         break; 
                     }
                 }
                 const available = resident.inventory.GRAIN || 0;
                 const toEat = Math.min(available, missingAfterBread);
                 resident.inventory.GRAIN! -= toEat;
                 grainEaten += toEat;
                 flowStats[ResourceType.GRAIN].consumed += toEat;
             }
        }
        
        const finalSatisfied = grainEaten + breadToEat * 1.0;
        if (finalSatisfied < ConsumerSystem.DAILY_GRAIN_NEED * 0.8) {
            const subsidyLimit = treasury.taxPolicy.grainSubsidy || 10;
            if (treasury.grainDistributedToday < subsidyLimit) {
                if (MarketSystem.attemptPurchase(state, 'TREASURY', ResourceType.GRAIN)) {
                    treasury.grainDistributedToday++;
                    grainEaten += 1; 
                    flowStats[ResourceType.GRAIN].consumed += 1;
                    state.logs.unshift(`🥣 ${resident.name} 领取了政府救济粮`);
                }
            }
        }
        
        const finalTotal = grainEaten + breadToEat * 1.0;
        if (finalTotal < ConsumerSystem.DAILY_GRAIN_NEED * 0.8) {
            resident.happiness = Math.max(0, resident.happiness - 20);
        } else {
            let maxHappy = 100;
            if (resident.livingStandard === 'SURVIVAL') maxHappy = 70;
            resident.happiness = Math.min(maxHappy, resident.happiness + 2);
        }
      } else {
          if (breadToEat > 0) {
             resident.inventory.BREAD! -= breadToEat;
             flowStats[ProductType.BREAD].consumed += breadToEat;
          }
          resident.happiness = Math.min(100, resident.happiness + 1);
      }
    });
  }
}