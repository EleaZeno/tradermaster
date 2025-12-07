
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

    // --- MARKET SIGNAL: Check for Shortages ---
    const breadBook = state.market[ProductType.BREAD];
    const breadSupply = breadBook ? breadBook.asks.reduce((s, o) => s + (o.remainingQuantity), 0) : 0;
    const isBreadScarce = breadSupply < 5;

    // --- MACRO: Inflation Expectations & Unemployment Risk ---
    const history = state.macroHistory;
    let expectedInflation = 0;
    let unemploymentRisk = 0.05; // Default 5%

    if (history.length > 1) {
        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        expectedInflation = last.inflation + 0.5 * (last.inflation - prev.inflation);
        unemploymentRisk = last.unemployment;
    }

    // Calc Average Wealth for Relative Standing
    const avgWealth = residents.reduce((s,r) => s + r.cash, 0) / residents.length;

    residents.forEach(resident => {
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(resident.job)) {
         TransactionService.transfer('TREASURY', resident, resident.salary, { treasury, residents, context });
         gdpFlow.G += resident.salary; 
      }

      // 2. Budget Determination: Precautionary Savings Model
      // MPC = Base + k1*InflationExp - k2*UnemploymentRisk*RiskAversion - k3*WealthRatio
      // Poor people spend nearly 100% (High MPC). Rich people save more (Low MPC).
      const wealthRatio = Math.min(5, resident.cash / Math.max(1, avgWealth));
      const wealthDrag = wealthRatio * 0.1; // Richer = lower MPC

      let baseMPC = resident.propensityToConsume || 0.8;
      const riskAversion = resident.riskAversion || 1.0;
      
      const inflationTerm = expectedInflation * 1.5; // Intertemporal substitution
      const riskTerm = unemploymentRisk * riskAversion * 2.0; // Precautionary saving
      
      // Allow MPC to go slightly higher to stimulate economy
      const adjustedMPC = Math.max(0.1, Math.min(1.0, baseMPC + inflationTerm - riskTerm - wealthDrag));
      
      const nominalBudget = resident.cash * adjustedMPC;

      // 3. Stone-Geary Utility
      const survivalNeed = GAME_CONFIG.DAILY_GRAIN_NEED;
      const costViaGrain = survivalNeed * grainPrice;
      const costViaBread = (survivalNeed * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO) * breadPrice;
      
      // If Bread is scarce, treat it as infinitely expensive/unavailable
      const effectiveBreadPrice = isBreadScarce ? breadPrice * 10 : breadPrice;
      
      const isBreadCheaper = costViaBread < costViaGrain && !isBreadScarce;
      const subsistenceCost = Math.min(costViaGrain, costViaBread);

      let discretionaryIncome = nominalBudget - subsistenceCost;
      
      let qBread = 0;
      let qGrain = 0;

      if (discretionaryIncome < 0) {
          // SURVIVAL MODE: Spend nearly all cash if needed
          const emergencyBudget = resident.cash * 0.95; 
          if (isBreadCheaper) {
              qBread = emergencyBudget / Math.max(0.1, effectiveBreadPrice);
          } else {
              qGrain = emergencyBudget / Math.max(0.1, grainPrice);
          }
      } else {
          // COMFORT MODE
          if (isBreadCheaper) {
              qBread += (survivalNeed * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO);
          } else {
              // If rich enough, buy bread anyway unless scarce
              if (discretionaryIncome > costViaBread * 2 && !isBreadScarce) {
                  qBread += (survivalNeed * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO);
              } else {
                  qGrain += survivalNeed;
              }
          }

          if (!resident.preferenceWeights) {
              resident.preferenceWeights = { 
                  [ProductType.BREAD]: 0.7, 
                  [ResourceType.GRAIN]: 0.2,
                  savings: 0.1 
              };
          }

          const alphaBread = resident.preferenceWeights[ProductType.BREAD] || 0.7;
          const alphaGrain = resident.preferenceWeights[ResourceType.GRAIN] || 0.2;
          const sumGoodsAlpha = alphaBread + alphaGrain;

          const spendBread = discretionaryIncome * (alphaBread / sumGoodsAlpha);
          const spendGrain = discretionaryIncome * (alphaGrain / sumGoodsAlpha);

          if (!isBreadScarce) {
              qBread += spendBread / Math.max(0.1, effectiveBreadPrice);
          } else {
              // Redirect bread budget to grain if bread is scarce
              qGrain += spendBread / Math.max(0.1, grainPrice);
          }
          qGrain += spendGrain / Math.max(0.1, grainPrice);
      }

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
          caloriesEaten += breadToEat * GAME_CONFIG.BREAD_SUBSTITUTE_RATIO;
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
