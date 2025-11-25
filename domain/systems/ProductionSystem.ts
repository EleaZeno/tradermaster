
import { GameState, ResourceType, ProductType, IndustryType } from '../../types';
import { Transaction } from '../utils/Transaction';

export class ProductionSystem {
  static process(gameState: GameState, flowStats: any, getEventModifier: (t: string) => number) {
    // 1. 处理所有损耗 (Spoilage)
    ProductionSystem.processSpoilage(gameState, flowStats);

    // 2. 农业生产 (Farmers)
    ProductionSystem.processFarming(gameState, flowStats, getEventModifier);

    // 3. 工业生产 (Companies)
    ProductionSystem.processManufacturing(gameState, flowStats, getEventModifier);
  }

  private static processSpoilage(state: GameState, flowStats: any) {
    const apply = (amount: number, type: IndustryType, isCompany: boolean) => {
      if (amount < 0.1) return 0;
      
      // 基础腐烂率
      let baseRate = type === ProductType.BREAD ? 0.05 : 0.02; // 面包坏得快 (2% -> 5%)
      
      // 解决商品过剩：非线性腐烂
      // 库存越多，坏得越快 (模拟仓库管理不善)
      // 如果库存超过 100，腐烂率翻倍
      if (amount > 100) baseRate *= 2;
      if (amount > 300) baseRate *= 2;

      const rate = isCompany ? baseRate * 0.5 : baseRate; // 企业有冷库，坏得慢点
      const loss = amount * rate;
      flowStats[type].spoiled += loss;
      return loss;
    };

    // 居民损耗
    state.population.residents.forEach(r => {
      [ResourceType.GRAIN, ProductType.BREAD].forEach(t => {
        const type = t as IndustryType;
        const loss = apply(r.inventory[type] || 0, type, false);
        if (loss > 0) r.inventory[type]! -= loss;
      });
    });

    // 企业损耗
    state.companies.forEach(c => {
        const grainLoss = apply(c.inventory.raw[ResourceType.GRAIN] || 0, ResourceType.GRAIN, true);
        if (grainLoss > 0) c.inventory.raw[ResourceType.GRAIN]! -= grainLoss;

        [ResourceType.GRAIN, ProductType.BREAD].forEach(t => {
            const type = t as IndustryType;
            const loss = apply(c.inventory.finished[type] || 0, type, true);
            if (loss > 0) c.inventory.finished[type]! -= loss;
        });
    });

    // 市场损耗
    const marketLoss = apply(state.resources[ResourceType.GRAIN].marketInventory, ResourceType.GRAIN, true);
    if (marketLoss > 0) state.resources[ResourceType.GRAIN].marketInventory -= marketLoss;
  }

  private static processFarming(state: GameState, flowStats: any, getMod: (t: string) => number) {
    state.population.residents.forEach(res => {
      if (res.job === 'FARMER') {
        const mod = getMod(ResourceType.GRAIN);
        // 降低基础产出: 4.0 -> 3.5，缓解过剩
        const output = 3.5 * (res.intelligence / 75) * mod;
        res.inventory[ResourceType.GRAIN] = (res.inventory[ResourceType.GRAIN] || 0) + output;
        flowStats[ResourceType.GRAIN].produced += output;

        if ((res.inventory[ResourceType.GRAIN] || 0) > 3.0) {
          const toSell = (res.inventory[ResourceType.GRAIN] || 0) - 3.0;
          res.inventory[ResourceType.GRAIN] = 3.0;
          state.resources[ResourceType.GRAIN].marketInventory += toSell;
        }
      }
    });
  }

  private static processManufacturing(state: GameState, flowStats: any, getMod: (t: string) => number) {
    state.companies.forEach(comp => {
      if (comp.isBankrupt) return;

      const employees = state.population.residents.filter(r => r.employerId === comp.id && (r.job === 'WORKER' || r.job === 'UNION_LEADER'));
      // 只有 WORKER 干活，UNION_LEADER 不干活
      const actualWorkers = employees.filter(r => r.job === 'WORKER');
      
      const stock = Object.values(comp.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);

      // 智能停产检查
      const wageBill = employees.length * comp.wageOffer;
      if (stock > 40 || comp.cash < wageBill) return; 

      // 支付所有员工工资 (包括工会主席，虽然在LaborSystem已经支付了津贴，但这里为了逻辑统一，假设生产循环中扣除的是基础工资部分? 
      // 不，LaborSystem 已经全额支付了。这里只处理税务记录和生产力计算。)
      // 为了避免重复扣款，我们在 LaborSystem 统一支付工资。这里只计算产出。
      // 但是为了保持 dailyIncome 的税务更新，我们需要在这里确认税务产生？
      // 现在的架构 LaborSystem 负责发钱。ProductionSystem 负责生产。
      // 我们在 LaborSystem 调用 Transaction.transfer 时已经处理了税 (如果 Transaction 逻辑完善)。
      // 检查 LaborSystem 的 payExecutives 和 manageHeadcount (sign-on bonus)，以及 ProductionSystem 之前的逻辑。
      // 之前的 ProductionSystem 包含了 "支付工人工资 + 税" 的逻辑。
      // 这是一个冲突点。
      // 修正：让 ProductionSystem 负责支付普通工人工资 (每日结算)，LaborSystem 负责支付高管/主席津贴/招聘费。
      
      // 支付普通工人工资
      let totalWageCost = 0;
      actualWorkers.forEach(w => {
        // Union Power: 如果有工会主席，工资不能拖欠
        Transaction.transfer(comp, w, comp.wageOffer, { treasury: state.cityTreasury, residents: state.population.residents });
        comp.accumulatedCosts += comp.wageOffer;
        totalWageCost += comp.wageOffer;
        
        const taxRate = state.cityTreasury.taxPolicy.incomeTaxRate; 
        const tax = comp.wageOffer * taxRate;
        Transaction.transfer(w, 'TREASURY', tax, { treasury: state.cityTreasury, residents: state.population.residents });
        state.cityTreasury.dailyIncome += tax;
      });

      // 运行生产线
      comp.productionLines.forEach(line => {
        if (!line.isActive) return;
        
        const teamMod = Math.max(0.5, 1.0 - (actualWorkers.length - 2) * 0.1);
        const mod = getMod(line.type);
        let output = 0;
        // 降低工业基础产出效率 8.0 -> 6.0
        actualWorkers.forEach(w => output += (6.0 * (w.intelligence / 75) * line.efficiency * teamMod * mod));
        
        const ceo = state.population.residents.find(r => r.id === comp.ceoId);
        if (ceo) output *= (1 + (ceo.leadership - 50) / 200);

        let materialCost = 0;
        if (line.type === ProductType.BREAD) {
            const needed = output * 0.8;
            let currentRaw = comp.inventory.raw[ResourceType.GRAIN] || 0;
            
            if (currentRaw < needed && comp.cash > 0) {
                const price = state.resources[ResourceType.GRAIN].currentPrice;
                const marketInv = state.resources[ResourceType.GRAIN].marketInventory;
                const buyAmount = Math.min(marketInv, needed - currentRaw + 20, Math.floor(comp.cash/price));
                
                if (buyAmount > 0) {
                    if (Transaction.transfer(comp, 'GATHERERS', buyAmount * price, { treasury: state.cityTreasury, residents: state.population.residents })) {
                        state.resources[ResourceType.GRAIN].marketInventory -= buyAmount;
                        comp.inventory.raw[ResourceType.GRAIN] = (comp.inventory.raw[ResourceType.GRAIN] || 0) + buyAmount;
                        currentRaw += buyAmount;
                        state.resources[ResourceType.GRAIN].dailySales += buyAmount;
                        materialCost += buyAmount * price;
                    }
                }
            }

            if (currentRaw < needed) output = currentRaw / 0.8; 
            const consumed = output * 0.8;
            if (consumed > 0) {
                comp.inventory.raw[ResourceType.GRAIN]! -= consumed;
                flowStats[ResourceType.GRAIN].consumed += consumed;
                materialCost += consumed * state.resources[ResourceType.GRAIN].currentPrice; 
            }
        }

        if (output > 0) {
            comp.inventory.finished[line.type] = (comp.inventory.finished[line.type] || 0) + output;
            flowStats[line.type].produced += output;
            comp.monthlyProductionVolume += output;
            
            const unitCost = (totalWageCost + materialCost) / output;
            if (output > 0 && unitCost > 0) {
                 comp.avgCost = (comp.avgCost * 0.7) + (unitCost * 0.3);
            }
        }
      });
    });
  }
}
