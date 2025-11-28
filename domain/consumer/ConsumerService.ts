
import { GameState, ProductType, ResourceType, FlowStats, GameContext, GDPFlowAccumulator, Resident } from '../../shared/types';
import { MarketService } from '../market/MarketService';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class ConsumerService {
  static process(state: GameState, context: GameContext, flowStats: FlowStats, gdpFlow: GDPFlowAccumulator): void {
    const { residents } = state.population;
    const products = state.products;
    const resources = state.resources;
    const treasury = state.cityTreasury;

    const breadPrice = products[ProductType.BREAD].marketPrice;
    const grainPrice = resources[ResourceType.GRAIN].currentPrice;

    // --- MACRO: Inflation Expectations (Adaptive) ---
    // \pi^e_t = \pi_{t-1} + \lambda (\pi_{t-1} - \pi_{t-2})
    const history = state.macroHistory;
    let expectedInflation = 0;
    if (history.length > 1) {
        const last = history[history.length - 1].inflation;
        const prev = history[history.length - 2].inflation;
        expectedInflation = last + 0.5 * (last - prev);
    }

    residents.forEach(resident => {
      // 1. Receive Government Salaries (if applicable)
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         TransactionService.transfer('TREASURY', resident, resident.salary, { treasury, residents, context });
         gdpFlow.G += resident.salary; 
      }

      // 2. Budget Determination with Expectations
      // Dynamic MPC: If expecting inflation, consume more now (Intertemporal Substitution)
      let baseMPC = resident.propensityToConsume || 0.8;
      const adjustedMPC = Math.max(0.5, Math.min(0.99, baseMPC + (expectedInflation * 2.0)));
      
      const nominalBudget = resident.cash * adjustedMPC;

      // 3. Stone-Geary Utility Maximization
      // U = \prod (q_i - \gamma_i)^\alpha_i
      // Step A: Subsistence Layer (\gamma)
      const survivalNeed = GAME_CONFIG.DAILY_GRAIN_NEED;
      
      // Calculate cost of subsistence bundle (Cheapest Calorie)
      const costViaGrain = survivalNeed * grainPrice;
      const costViaBread = (survivalNeed * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO) * breadPrice;
      const isBreadCheaper = costViaBread < costViaGrain;
      const subsistenceCost = Math.min(costViaGrain, costViaBread);

      let discretionaryIncome = nominalBudget - subsistenceCost;
      
      let qBread = 0;
      let qGrain = 0;

      if (discretionaryIncome < 0) {
          // SURVIVAL MODE: Budget < Subsistence
          // Ignore preferences, spend accumulated Savings (Cash) to stay alive
          const emergencyBudget = resident.cash; 
          
          if (isBreadCheaper) {
              qBread = emergencyBudget / Math.max(0.1, breadPrice);
          } else {
              qGrain = emergencyBudget / Math.max(0.1, grainPrice);
          }
      } else {
          // COMFORT MODE: Discretionary Spending
          // 1. Buy Subsistence
          if (isBreadCheaper) qBread += (survivalNeed * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO);
          else qGrain += survivalNeed;

          // 2. Allocate Discretionary via Cobb-Douglas Weights
          if (!resident.preferenceWeights) {
              resident.preferenceWeights = { 
                  [ProductType.BREAD]: 0.6, 
                  [ResourceType.GRAIN]: 0.3,
                  savings: 0.1 
              };
          }

          const alphaBread = resident.preferenceWeights[ProductType.BREAD] || 0.6;
          const alphaGrain = resident.preferenceWeights[ResourceType.GRAIN] || 0.3;
          const sumGoodsAlpha = alphaBread + alphaGrain;

          const spendBread = discretionaryIncome * (alphaBread / sumGoodsAlpha);
          const spendGrain = discretionaryIncome * (alphaGrain / sumGoodsAlpha);

          qBread += spendBread / Math.max(0.1, breadPrice);
          qGrain += spendGrain / Math.max(0.1, grainPrice);
      }

      // 4. Submit Orders (Integer constraints for items usually, but we allow fractional for simulation smoothness)
      qBread = Math.floor(qBread);
      qGrain = Math.floor(qGrain);

      if (qBread > 0) {
          MarketService.submitOrder(state, {
              ownerId: resident.id,
              ownerType: 'RESIDENT',
              itemId: ProductType.BREAD,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              quantity: qBread
          }, context);
          gdpFlow.C += (qBread * breadPrice); 
      }

      if (qGrain > 0) {
          MarketService.submitOrder(state, {
              ownerId: resident.id,
              ownerType: 'RESIDENT',
              itemId: ResourceType.GRAIN,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              quantity: qGrain
          }, context);
          gdpFlow.C += (qGrain * grainPrice);
      }

      // 5. Physical Consumption
      ConsumerService.consumeFood(resident, flowStats, state);
    });
  }

  private static consumeFood(resident: Resident, flowStats: FlowStats, state: GameState) {
      const caloriesNeeded = GAME_CONFIG.DAILY_GRAIN_NEED;
      let caloriesEaten = 0;

      const breadInv = resident.inventory.BREAD || 0;
      const grainInv = resident.inventory.GRAIN || 0;

      const breadToEat = Math.min(breadInv, caloriesNeeded / GAME_CONFIG.BREAD_SUBSTITUTE_RATIO);
      if (breadToEat > 0) {
          resident.inventory.BREAD = breadInv - breadToEat;
          caloriesEaten += breadToEat * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO; // 1 Bread = More Calories? Or efficiency ratio
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
              state.logs.unshift(`⚰️ ${resident.name} 饿死街头 (Budget: ${Math.floor(resident.cash)})`);
          }
      } else {
          resident.happiness = Math.min(100, resident.happiness + 1);
      }
  }
}
