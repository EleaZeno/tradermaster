

import { GameState, ProductType, ResourceType, FlowStats, GameContext } from '../../shared/types';
import { MarketService } from '../market/MarketService';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class ConsumerService {
  static process(state: GameState, context: GameContext, flowStats: FlowStats): void {
    const { residents } = state.population;
    const products = state.products;
    const treasury = state.cityTreasury;

    const breadPrice = products[ProductType.BREAD].marketPrice;

    residents.forEach(resident => {
      // 1. Receive Salary (Government Officials only here, others in LaborSystem/Production)
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         TransactionService.transfer('TREASURY', resident, resident.salary, { treasury, residents, context });
      }

      // 2. Determine Consumption Budget (Keynesian Consumption Function)
      const propensity = resident.propensityToConsume || 0.8;
      const budget = resident.cash * 0.1 * propensity; // Spend a portion of cash daily

      // 3. Needs Satisfaction (Food)
      const caloriesNeeded = GAME_CONFIG.DAILY_GRAIN_NEED;
      let caloriesEaten = 0;

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

      // 4. Purchasing (Demand Generation with Elasticity)
      const deficit = caloriesNeeded - caloriesEaten;
      
      if (deficit > 0.1 && budget > 0) {
          // --- ELASTICITY MODEL ---
          // Probability P = (Price / RefPrice) ^ Elasticity
          // If Elasticity is negative (normal good):
          // Price > RefPrice -> P < 1 (Buy Less)
          // Price < RefPrice -> P > 1 (Buy More/Certain)
          
          const elasticity = GAME_CONFIG.ECONOMY.DEMAND_ELASTICITY.BREAD; // e.g., -0.8
          const refPrice = 2.0; // Anchoring price
          
          const priceRatio = Math.max(0.1, breadPrice / refPrice);
          const demandProbability = Math.pow(priceRatio, elasticity);
          
          // Residents will try to buy based on this probability
          const willBuyBread = Math.random() < demandProbability;

          if (willBuyBread) {
              const affordableAmount = Math.floor(budget / breadPrice);
              const amountToBuy = Math.min(Math.ceil(deficit), affordableAmount);
              
              if (amountToBuy > 0) {
                  MarketService.submitOrder(state, {
                      ownerId: resident.id,
                      ownerType: 'RESIDENT',
                      itemId: ProductType.BREAD,
                      side: 'BUY',
                      type: 'MARKET',
                      price: 0,
                      quantity: amountToBuy
                  }, context);
              }
          } else {
              // Substitution Effect: Buy Grain (Inferior Substitute)
              // Grain is inelastic necessity if Bread is too expensive
              const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
              if (budget >= grainPrice * deficit) {
                   MarketService.submitOrder(state, {
                      ownerId: resident.id,
                      ownerType: 'RESIDENT',
                      itemId: ResourceType.GRAIN,
                      side: 'BUY',
                      type: 'MARKET',
                      price: 0,
                      quantity: Math.ceil(deficit)
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
          resident.happiness = Math.min(100, resident.happiness + 1);
      }
    });
  }
}