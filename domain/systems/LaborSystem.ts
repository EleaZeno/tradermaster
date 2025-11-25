
import { GameState, Company, Resident } from '../../types';
import { Transaction } from '../utils/Transaction';

export class LaborSystem {
  static process(gameState: GameState, livingCostBenchmark: number, wagePressureMod: number) {
    const { companies } = gameState;
    const residents = gameState.population.residents;

    // 0. 社会阶层流动 (Social Mobility)
    LaborSystem.processSocialMobility(gameState);

    companies.forEach(comp => {
      if (comp.isBankrupt) return;

      // 1. 工会选举与压力 (Union Logic)
      LaborSystem.processUnionPolitics(comp, residents, gameState);

      // 2. 更新工资报价 (锚定粮价 + 生活成本保护 + 工会压力)
      LaborSystem.updateWageOffer(comp, livingCostBenchmark);

      // 3. AI 调整策略 (非玩家公司)
      if (!comp.isPlayerFounded) {
        LaborSystem.adjustAIStrategy(comp, residents, wagePressureMod);
      }

      // 4. 支付高管 & 工会主席
      LaborSystem.payExecutives(comp, residents, gameState);

      // 5. 执行招聘/解雇
      LaborSystem.manageHeadcount(comp, residents, gameState);
    });
  }

  /**
   * 工会政治：
   * 1. 如果没有工会主席，从工人中选举（Leadership高 或 Happiness低）。
   * 2. 工会主席会增加 unionTension。
   * 3. 如果工资低于标准，Tension 激增。
   */
  private static processUnionPolitics(comp: Company, residents: Resident[], state: GameState) {
      const workers = residents.filter(r => r.employerId === comp.id && r.job === 'WORKER');
      
      // 检查现任主席
      let currentLeader = residents.find(r => r.employerId === comp.id && r.job === 'UNION_LEADER');
      
      // 选举逻辑：每周(7天)或者职位空缺时
      if ((!currentLeader && workers.length > 2) || (state.day % 7 === 0 && workers.length > 2)) {
          // 候选人：Leadership 高 或者 最不爽的 (激进派)
          const candidates = [...workers].sort((a, b) => {
              const scoreA = a.leadership + (100 - a.happiness);
              const scoreB = b.leadership + (100 - b.happiness);
              return scoreB - scoreA;
          });

          if (candidates.length > 0) {
              const newLeader = candidates[0];
              // 卸任旧主席
              if (currentLeader) {
                  currentLeader.job = 'WORKER'; // 变回普通工人
                  currentLeader.salary = 0; // 重置额外津贴
              }
              // 上任新主席
              newLeader.job = 'UNION_LEADER';
              newLeader.salary = comp.wageOffer * 1.2; // 主席津贴
              state.logs.unshift(`✊ ${comp.name} 选举结果：${newLeader.name} 当选工会主席！`);
              comp.unionTension = 20; // 初始压力
          }
      }

      // 工会压力计算
      if (currentLeader) {
          // 如果工资低，压力大
          if (comp.wageMultiplier < 1.8) {
              comp.unionTension += 5;
          } else {
              comp.unionTension = Math.max(0, comp.unionTension - 2);
          }
      }
  }

  private static processSocialMobility(state: GameState) {
    const WEALTH_THRESHOLD = 350; 
    const POVERTY_LINE = 20; // 降低贫困线，更难回去种地，增加危机感

    state.population.residents.forEach(r => {
        if (r.isPlayer || ['MAYOR', 'DEPUTY_MAYOR', 'EXECUTIVE', 'UNION_LEADER'].includes(r.job)) return;

        // 晋升：农民/工人 -> 金融家
        if (r.cash > WEALTH_THRESHOLD && (r.job === 'FARMER' || r.job === 'WORKER')) {
            if (r.job === 'WORKER' && r.employerId) {
                 const comp = state.companies.find(c => c.id === r.employerId);
                 if (comp) comp.employees--;
            }
            
            r.job = 'FINANCIER';
            r.employerId = undefined;
            r.livingStandard = 'LUXURY'; 
            state.logs.unshift(`👔 ${r.name} 积累了巨额财富，决定退休成为全职投资人。`);
        }

        // 降级：金融家 -> 农民
        if (r.cash < POVERTY_LINE && r.job === 'FINANCIER') {
            r.job = 'FARMER';
            r.livingStandard = 'SURVIVAL'; 
            state.logs.unshift(`🚜 ${r.name} 投资破产，被迫重新下地务农。`);
        }
    });
    
    state.population.financiers = state.population.residents.filter(r => r.job === 'FINANCIER').length;
    state.population.farmers = state.population.residents.filter(r => r.job === 'FARMER').length;
  }

  private static updateWageOffer(comp: Company, benchmark: number) {
    // 强制生活工资逻辑：工资必须能买得起 1.5 单位的粮食，否则工人会饿死
    // 基础倍率
    let targetMultiplier = comp.wageMultiplier || 1.5;
    
    // 如果有工会主席，强制提高标准
    // 检查是否有 Union Leader
    // 由于我们在 processUnionPolitics 中可能更新了 job，这里不再遍历查找，而是依赖 unionTension
    // 也可以简单假设 tension > 0 就意味着有压力
    if (comp.unionTension > 50) {
        targetMultiplier = Math.max(targetMultiplier, 2.2); // 强硬工会要求高薪
    }

    // 计算实际金额
    let offer = parseFloat((benchmark * targetMultiplier).toFixed(2));
    
    // 兜底机制：绝对不能低于粮价 * 1.2 (税后生存线)
    // 否则工人越工作越穷
    const survivalWage = benchmark * 1.3;
    if (offer < survivalWage) {
        offer = parseFloat(survivalWage.toFixed(2));
        // 反向更新倍率，让UI显示正确
        comp.wageMultiplier = parseFloat((offer / benchmark).toFixed(1));
    }

    comp.wageOffer = offer;
  }

  private static adjustAIStrategy(comp: Company, residents: Resident[], wagePressure: number) {
    const employees = residents.filter(r => r.employerId === comp.id);
    const workers = employees.filter(r => r.job === 'WORKER').length;
    const target = Math.max(0, comp.targetEmployees - employees.filter(r => r.job !== 'WORKER').length);
    
    const stock = Object.values(comp.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    // 更加保守的库存控制
    if (stock > 50 && comp.employees > 1) comp.targetEmployees = Math.max(1, comp.targetEmployees - 1);
    else if (stock < 15 && comp.cash > 200) comp.targetEmployees++;

    const gap = target - workers;
    if (gap > 0 || wagePressure > 1.05 || comp.unionTension > 60) {
      // 招不到人，或者工会压力大，必须加薪
      comp.wageMultiplier = Math.min(5.0, comp.wageMultiplier + 0.15);
    } else if (gap < 0 || (gap === 0 && comp.cash < comp.wageOffer * 5)) {
      // 只有在没工会压力时才敢降薪
      if (comp.unionTension < 30) {
          comp.wageMultiplier = Math.max(1.2, comp.wageMultiplier - 0.05);
      }
    }
  }

  private static payExecutives(comp: Company, residents: Resident[], state: GameState) {
    const execs = residents.filter(r => (r.job === 'EXECUTIVE' || r.job === 'UNION_LEADER') && r.employerId === comp.id);
    execs.forEach(e => {
      // Union Leader 领的是工人薪水 + 津贴，Executive 领高管薪水
      let salary = 0;
      if (e.job === 'UNION_LEADER') {
          // 工会主席拿 1.2 倍普通工资
          salary = comp.wageOffer * 1.2;
      } else {
          salary = (comp.executiveSalary / 1.5) * comp.wageOffer;
      }

      if (comp.cash >= salary) {
        Transaction.transfer(comp, e, salary, { treasury: state.cityTreasury, residents });
        comp.accumulatedCosts += salary;
        // Executive pay taxes handled in ConsumerSystem usually, but for Transaction utility we rely on it
        // Note: Simple Tax withholding could be added here if we want instant tax
      }
    });
  }

  private static manageHeadcount(comp: Company, residents: Resident[], state: GameState) {
    const employees = residents.filter(r => r.employerId === comp.id);
    const workers = employees.filter(r => r.job === 'WORKER').length;
    // Union Leader 占用编制
    const nonWorkers = employees.filter(r => r.job !== 'WORKER').length;
    const target = Math.max(0, comp.targetEmployees - nonWorkers);
    const gap = target - workers;

    if (gap > 0 && comp.cash > comp.wageOffer * 3) { // 需要更多现金储备才敢招人
      const candidate = residents.find(r => r.job === 'FARMER' && r.happiness < 90);
      if (candidate) {
        candidate.job = 'WORKER';
        candidate.employerId = comp.id;
        comp.employees++;
        Transaction.transfer(comp, candidate, comp.wageOffer * 0.5, { treasury: state.cityTreasury, residents });
      }
    } 
    else if (gap < 0) {
      // 裁员逻辑：不能裁掉工会主席 (除非倒闭)
      const worker = residents.find(r => r.employerId === comp.id && r.job === 'WORKER');
      if (worker) {
        worker.job = 'FARMER';
        worker.employerId = undefined;
        comp.employees--;
        // 遣散费 (Severance)
        Transaction.transfer(comp, worker, comp.wageOffer * 2, { treasury: state.cityTreasury, residents });
      }
    }
  }
}
