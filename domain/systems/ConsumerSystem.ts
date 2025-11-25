
import { GameState, ProductType, ResourceType } from '../../types';
import { MarketSystem } from './MarketSystem';
import { Transaction } from '../utils/Transaction';

export class ConsumerSystem {
  static process(state: GameState, flowStats: any) {
    const residents = state.population.residents;
    
    residents.forEach(r => {
      // 1. 领工资 (公职人员 - 使用 constants 中定义的较低薪资，或者动态读取)
      // 注意：这里的 salary 属性应该已经在初始化时被设定为较低的值 (Mayor 2.0, Deputy 1.2)
      if (['MAYOR', 'DEPUTY_MAYOR'].includes(r.job)) {
        if (Transaction.transfer('TREASURY', r, r.salary, { treasury: state.cityTreasury, residents })) {
          state.cityTreasury.dailyExpense += r.salary;

          const tax = r.salary * state.cityTreasury.taxPolicy.incomeTaxRate;
          if (Transaction.transfer(r, 'TREASURY', tax, { treasury: state.cityTreasury, residents })) {
             state.cityTreasury.dailyIncome += tax;
          }
        }
      }

      // 2. 吃饭逻辑 (优先吃库存 -> 买面包 -> 买粮食 -> 领救济)
      let ate = false;
      let consumedAmount = 1;

      // 解决商品过剩：富人浪费性消费 (Wasteful Consumption)
      // 如果生活水平是 LUXURY，他们每天消耗 2 单位食物
      if (r.livingStandard === 'LUXURY') consumedAmount = 2;
      
      for (let i = 0; i < consumedAmount; i++) {
        let stepAte = false;

        // 吃库存
        if ((r.inventory[ProductType.BREAD] || 0) >= 1) {
            r.inventory[ProductType.BREAD]! -= 1;
            flowStats[ProductType.BREAD].consumed += 1;
            stepAte = true;
        } else if ((r.inventory[ResourceType.GRAIN] || 0) >= 1) {
            r.inventory[ResourceType.GRAIN]! -= 1;
            flowStats[ResourceType.GRAIN].consumed += 1;
            stepAte = true;
        }

        // 没库存，去买
        if (!stepAte) {
            const breadPrice = state.products[ProductType.BREAD].marketPrice;
            const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
            const isRich = r.livingStandard === 'LUXURY' || r.livingStandard === 'COMFORT';
            // 富人只买面包，穷人买粮食
            const preferBread = isRich || (r.cash > breadPrice * 4);

            let bought = false;
            if (preferBread && r.cash > breadPrice && MarketSystem.attemptPurchase(state, r, ProductType.BREAD)) {
                flowStats[ProductType.BREAD].consumed += 1;
                bought = true;
            }
            
            if (!bought) {
                if (r.cash > grainPrice && MarketSystem.attemptPurchase(state, r, ResourceType.GRAIN)) {
                    flowStats[ResourceType.GRAIN].consumed += 1;
                    bought = true;
                }
            }
            if (bought) stepAte = true;
        }
        
        // 只要吃了一口就算活下来，但吃多口会更快乐
        if (i === 0) ate = stepAte;
      }

      // 还没得吃？领救济 (Welfare)
      // 使用 FinancialSystem 中副市长设定的动态限额 (stored in grainSubsidy as a hack)
      const dailyLimit = state.cityTreasury.taxPolicy.grainSubsidy || 30; 
      
      if (!ate && state.cityTreasury.grainDistributedToday < dailyLimit) {
         if (MarketSystem.attemptPurchase(state, 'TREASURY', ResourceType.GRAIN)) {
            state.cityTreasury.grainDistributedToday++;
            state.cityTreasury.totalGrainDistributed++;
            flowStats[ResourceType.GRAIN].consumed += 1;
            ate = true;
         }
      }

      // 3. 更新幸福度
      if (!ate) r.happiness = Math.max(0, r.happiness - 10);
      else {
        let maxHappy = 100;
        if (r.livingStandard === 'SURVIVAL') maxHappy = 60;
        if (r.livingStandard === 'BASIC') maxHappy = 80;
        
        // 工会主席如果当选，幸福度有额外加成
        if (r.job === 'UNION_LEADER') maxHappy = 100;
        
        r.happiness = Math.min(maxHappy, r.happiness + (consumedAmount > 1 ? 3 : 2));
      }
    });
  }
}
