
import { GameState, ProductType, ResourceType, FlowStats, GameContext } from '../../shared/types';
import { MarketSystem } from './MarketSystem';
import { Transaction } from '../utils/Transaction';
import { GAME_CONFIG } from '../../shared/config';

export class ConsumerSystem {
  static process(state: GameState, context: GameContext, flowStats: FlowStats): void {
    const { residents } = state.population;
    const products = state.products;
    const treasury = state.cityTreasury;

    const breadPrice = products[ProductType.BREAD].marketPrice;

    residents.forEach(resident => {
      // 1. Receive Salary (Government Officials only here, others in LaborSystem/Production)
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         Transaction.transfer('TREASURY', resident, resident.salary, { treasury, residents, context });
      }

      // 2. Determine Consumption Budget (Keynesian Consumption Function)
      // C = c0 + c1 * Y
      // We use current Cash as proxy for Income/Wealth combination
      const propensity = resident.propensityToConsume || 0.8;
      const budget = resident.cash * 0.1 * propensity; // Spend a portion of cash daily

      // 3. Needs Satisfaction (Food)
      const caloriesNeeded = GAME_CONFIG.DAILY_GRAIN_NEED;
      let caloriesEaten = 0;

      // Prefer Bread (Higher Utility) > Grain
      // Utility U = Bread^0.7 * Grain^0.3
      // But we simplify: Buy Bread if budget allows, else Grain.

      // Eat Inventory First
      const breadInv = resident.inventory.BREAD || 0;
      const grainInv = resident.inventory.GRAIN || 0;

      // Eat Bread
      const breadToEat = Math.min(breadInv, caloriesNeeded);
      if (breadToEat > 0) {
          resident.inventory.BREAD = breadInv - breadToEat;
          caloriesEaten += breadToEat;
          flowStats[ProductType.BREAD].consumed += breadToEat;
      }

      // Eat Grain if still hungry
      if (caloriesEaten < caloriesNeeded) {
          const needed = caloriesNeeded - caloriesEaten;
          const grainToEat = Math.min(grainInv, needed);
          if (grainToEat > 0) {
              resident.inventory.GRAIN = grainInv - grainToEat;
              caloriesEaten += grainToEat;
              flowStats[ResourceType.GRAIN].consumed += grainToEat;
          }
      }

      // 4. Purchasing (Demand Generation)
      const deficit = caloriesNeeded - caloriesEaten;
      
      if (deficit > 0.1 && budget > 0) {
          // Check Price
          const canAffordBread = budget >= breadPrice * deficit;
          
          if (canAffordBread) {
              // Buy Bread
              MarketSystem.submitOrder(state, {
                  ownerId: resident.id,
                  ownerType: 'RESIDENT',
                  itemId: ProductType.BREAD,
                  side: 'BUY',
                  type: 'MARKET',
                  price: 0,
                  amount: Math.ceil(deficit)
              }, context);
          } else {
              // Buy Grain (Inferior Good)
              const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
              if (budget >= grainPrice * deficit) {
                   MarketSystem.submitOrder(state, {
                      ownerId: resident.id,
                      ownerType: 'RESIDENT',
                      itemId: ResourceType.GRAIN,
                      side: 'BUY',
                      type: 'MARKET',
                      price: 0,
                      amount: Math.ceil(deficit)
                  }, context);
              }
          }
      }

      // 5. Update Happiness
      if (caloriesEaten < caloriesNeeded * 0.8) {
          resident.happiness = Math.max(0, resident.happiness - 5);
          if (resident.happiness === 0 && !resident.isPlayer) {
              state.logs.unshift(`⚰️ ${resident.name} 饿死街头`);
          }
      } else {
          // Diminishing returns on happiness
          resident.happiness = Math.min(100, resident.happiness + 1);
      }
    });
  }
}
