
import { GameState, ProductType, ResourceType, FlowStats, GameContext, GDPFlowAccumulator, Resident } from '../../shared/types';
import { MarketService } from '../market/MarketService';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class ConsumerService {
  static process(state: GameState, context: GameContext, flowStats: FlowStats, gdpFlow: GDPFlowAccumulator): void {
    const { residents } = state.population;
    const products = state.products;
    const treasury = state.cityTreasury;

    const breadPrice = products[ProductType.BREAD].marketPrice;
    const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;

    residents.forEach(resident => {
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         TransactionService.transfer('TREASURY', resident, resident.salary, { treasury, residents, context });
         gdpFlow.G += resident.salary; // Gov Wage is part of G
      }

      // --- COBB-DOUGLAS UTILITY MAXIMIZATION ---
      // Budget = Cash * Propensity
      // Maximize U = Bread^alpha * Grain^beta * Savings^gamma
      // Optimal Expenditure on Bread = Budget * (alpha / sum(alphas))
      
      // Default preferences if missing
      if (!resident.preferenceWeights) {
          resident.preferenceWeights = { 
              [ProductType.BREAD]: 0.6, 
              [ResourceType.GRAIN]: 0.3,
              savings: 0.1 
          };
      }

      const budget = resident.cash * (resident.propensityToConsume || 0.8);
      
      const alphaBread = resident.preferenceWeights[ProductType.BREAD] || 0.6;
      const alphaGrain = resident.preferenceWeights[ResourceType.GRAIN] || 0.3;
      const alphaSave = resident.preferenceWeights.savings || 0.1;
      const sumAlpha = alphaBread + alphaGrain + alphaSave;

      // Allocation
      const spendBread = budget * (alphaBread / sumAlpha);
      const spendGrain = budget * (alphaGrain / sumAlpha);

      // Quantities
      const qtyBread = Math.floor(spendBread / Math.max(0.1, breadPrice));
      const qtyGrain = Math.floor(spendGrain / Math.max(0.1, grainPrice));

      // Execution
      if (qtyBread > 0) {
          MarketService.submitOrder(state, {
              ownerId: resident.id,
              ownerType: 'RESIDENT',
              itemId: ProductType.BREAD,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              quantity: qtyBread
          }, context);
          gdpFlow.C += (qtyBread * breadPrice); // Track Consumption
      }

      if (qtyGrain > 0) {
          MarketService.submitOrder(state, {
              ownerId: resident.id,
              ownerType: 'RESIDENT',
              itemId: ResourceType.GRAIN,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              quantity: qtyGrain
          }, context);
          gdpFlow.C += (qtyGrain * grainPrice);
      }

      // Eating logic remains for Survival/Happiness check
      ConsumerService.consumeFood(resident, flowStats, state);
    });
  }

  private static consumeFood(resident: Resident, flowStats: FlowStats, state: GameState) {
      const caloriesNeeded = GAME_CONFIG.DAILY_GRAIN_NEED;
      let caloriesEaten = 0;

      const breadInv = resident.inventory.BREAD || 0;
      const grainInv = resident.inventory.GRAIN || 0;

      const breadToEat = Math.min(breadInv, caloriesNeeded);
      if (breadToEat > 0) {
          resident.inventory.BREAD = breadInv - breadToEat;
          caloriesEaten += breadToEat;
          flowStats[ProductType.BREAD].consumed += breadToEat;
      }

      if (caloriesEaten < caloriesNeeded) {
          const needed = caloriesNeeded - caloriesEaten;
          const grainToEat = Math.min(grainInv, needed);
          if (grainToEat > 0) {
              resident.inventory.GRAIN = grainInv - grainToEat;
              caloriesEaten += grainToEat;
              flowStats[ResourceType.GRAIN].consumed += grainToEat;
          }
      }

      if (caloriesEaten < caloriesNeeded * 0.8) {
          resident.happiness = Math.max(0, resident.happiness - 5);
          if (resident.happiness === 0 && !resident.isPlayer) {
              state.logs.unshift(`⚰️ ${resident.name} 饿死街头`);
          }
      } else {
          resident.happiness = Math.min(100, resident.happiness + 1);
      }
  }
}
