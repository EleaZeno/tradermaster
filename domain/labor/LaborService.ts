
import { GameState, Company, Resident, GameContext, GDPFlowAccumulator, ResourceType } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { ECO_CONSTANTS } from '../../shared/config';
import { safeDivide, clamp } from '../../shared/utils/math';

export class LaborService {
  static updateMarketConditions(gameState: GameState): void {
      LaborService.adjustReservationWages(gameState);
      LaborService.processSkills(gameState);
  }

  static processPayrollAndHiring(gameState: GameState, context: GameContext, livingCostBenchmark: number, wagePressureMod: number, gdpFlow: GDPFlowAccumulator): void {
    const { companies } = gameState;
    const residents = gameState.population.residents;
    const employeesByCompany = context.employeesByCompany;

    companies.forEach(company => {
      if (company.isBankrupt) return;
      
      const companyEmployees = employeesByCompany[company.id] || [];

      LaborService.processUnionPolitics(company, companyEmployees, gameState);
      
      if (!company.isPlayerFounded) {
        LaborService.adjustAIStrategy(company, companyEmployees, gameState, wagePressureMod);
      } else {
        LaborService.updatePlayerWage(company, livingCostBenchmark, gameState);
      }

      LaborService.payExecutives(company, companyEmployees, gameState, context, gdpFlow);
      LaborService.manageHeadcount(company, companyEmployees, residents, gameState, context);
    });
  }

  private static processSkills(state: GameState): void {
      state.population.residents.forEach(r => {
          if (r.job !== 'UNEMPLOYED' && r.employerId) {
              r.xp += ECO_CONSTANTS.LABOR.XP_PER_DAY;
              
              if (r.skill === 'NOVICE' && r.xp >= ECO_CONSTANTS.LABOR.SKILL_THRESHOLDS.SKILLED) {
                  r.skill = 'SKILLED';
                  state.logs.unshift(`🎓 ${r.name} 晋升为熟练工 (Skilled)`);
              } else if (r.skill === 'SKILLED' && r.xp >= ECO_CONSTANTS.LABOR.SKILL_THRESHOLDS.EXPERT) {
                  r.skill = 'EXPERT';
                  state.logs.unshift(`🌟 ${r.name} 晋升为专家 (Expert)`);
              }
          }
      });
  }

  private static adjustReservationWages(state: GameState): void {
      const history = state.macroHistory;
      if (history.length < 2) return;
      
      const lastInflation = history[history.length - 1].inflation;
      const effectiveInflation = Math.max(-0.05, lastInflation); 
      
      // High unemployment should drive reservation wages down significantly (Phillips Curve Logic)
      const unemployment = history[history.length - 1].unemployment;
      // More aggressive downward pressure: if u > 5%, pressure increases linearly
      const unemploymentPressure = unemployment > 0.05 ? (unemployment - 0.05) * -0.2 : 0;

      const sensitivity = ECO_CONSTANTS.ECONOMY.WAGE_SENSITIVITY;
      
      state.population.residents.forEach(res => {
          const change = res.reservationWage * (effectiveInflation * sensitivity + unemploymentPressure);
          
          if (change > 0) {
              res.reservationWage += change; 
          } else {
              // Reduction in stickiness: If unemployment is super high (>20%), wages crash
              const stickiness = unemployment > 0.2 ? 0.8 : 0.2; // Allows 80% of the drop if crisis
              res.reservationWage += change * stickiness; 
          }
          
          // Absolute floor
          res.reservationWage = Math.max(0.5, res.reservationWage);
      });
  }

  private static processUnionPolitics(company: Company, employees: Resident[], state: GameState): void {
      const workers = employees.filter(r => r.job === 'WORKER');
      const currentLeader = employees.find(r => r.job === 'UNION_LEADER');
      
      if ((!currentLeader && workers.length > 2) || (state.day % 7 === 0 && workers.length > 2)) {
          const candidates = [...workers].sort((a, b) => {
              const scoreA = a.leadership + (100 - a.happiness);
              const scoreB = b.leadership + (100 - b.happiness);
              return scoreB - scoreA;
          });

          if (candidates.length > 0) {
              const newLeader = candidates[0];
              if (currentLeader && currentLeader.id !== newLeader.id) {
                  currentLeader.job = 'WORKER'; 
                  currentLeader.salary = 0; 
              }
              if (!currentLeader || currentLeader.id !== newLeader.id) {
                  newLeader.job = 'UNION_LEADER';
                  newLeader.salary = company.wageOffer * 1.2; 
                  state.logs.unshift(`✊ ${company.name} 选举结果：${newLeader.name} 当选工会主席！`);
                  company.unionTension = 20;
              }
          }
      }

      if (currentLeader) {
          if (company.wageMultiplier < 1.8) {
              company.unionTension += 5;
          } else {
              company.unionTension = Math.max(0, company.unionTension - 2);
          }
      } else {
          company.unionTension = Math.max(0, company.unionTension - 1);
      }
      
      company.unionTension = clamp(company.unionTension, 0, 100);
  }

  private static updatePlayerWage(company: Company, benchmark: number, state: GameState): void {
    const targetMultiplier = Math.max(0.5, company.wageMultiplier || 1.5);
    const offer = parseFloat((benchmark * targetMultiplier).toFixed(2));
    company.wageOffer = Math.max(0.1, offer);
  }

  private static adjustAIStrategy(company: Company, employees: Resident[], state: GameState, wagePressure: number): void {
    const workersCount = employees.filter(r => r.job === 'WORKER').length;
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
    
    // Determine Company Health
    const isRich = company.cash > 2000;
    const isPromising = company.tobinQ > 1.0;
    const isInsolvent = company.cash < 0; 
    
    // Hiring Logic: 
    // 1. If stock is low, hire.
    // 2. If labor is cheap (below avg wage), hire speculatively (Substitution effect).
    const laborIsCheap = company.wageOffer < state.population.averageWage * 0.8;

    if (stock > 50 && company.employees > 1 && !isRich) {
        // Only fire if inventory bloated AND not rich
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
    } else if ((stock < 15 && (company.cash > 100 || isPromising)) || isRich || (laborIsCheap && company.cash > 50)) {
        // Hire if low stock, rich, or labor is cheap (and have some cash)
        company.targetEmployees++;
    }

    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workersCount;

    const effectivePressure = wagePressure * (1 + company.unionTension / 100);

    // Wage Adjustment Logic
    if (isInsolvent) {
        // CRISIS MODE: Cut wages immediately to survive
        company.wageMultiplier = Math.max(0.5, company.wageMultiplier - 0.2);
        if (state.day % 3 === 0 && company.employees > 0) state.logs.unshift(`📉 ${company.name} 资金告急，削减工资 (-20%)`);
    } else if (gap > 0 || effectivePressure > 1.05 || (isRich && gap >= 0)) {
        // Expansion / Pressure Mode
        company.wageMultiplier = Math.min(5.0, company.wageMultiplier + 0.15);
    } else if (gap < 0 || (gap === 0 && company.cash < company.wageOffer * 5)) {
        // Contraction Mode
        if (company.unionTension < 30) {
            // Cut faster if not under union pressure
            company.wageMultiplier = Math.max(0.8, company.wageMultiplier - 0.1);
        }
    }
    
    let newOffer = parseFloat((grainPrice * company.wageMultiplier).toFixed(2));
    // Hard floor based on grain price
    const floor = isInsolvent ? grainPrice * 0.5 : grainPrice * 0.9;
    newOffer = Math.max(newOffer, floor);
    
    company.wageOffer = newOffer;
  }

  private static payExecutives(company: Company, employees: Resident[], state: GameState, context: GameContext, gdpFlow: GDPFlowAccumulator): void {
    const executives = employees.filter(r => r.job === 'EXECUTIVE' || r.job === 'UNION_LEADER');
    
    executives.forEach(exec => {
      let salary = 0;
      if (exec.job === 'UNION_LEADER') {
          salary = company.wageOffer * 1.2;
      } else {
          salary = (company.executiveSalary / 1.5) * company.wageOffer;
      }

      if (company.cash >= salary) {
        const success = TransactionService.transfer(company, exec, salary, { treasury: state.cityTreasury, residents: state.population.residents, context });
        if (success) {
            company.accumulatedCosts += salary;
        }
      }
    });
  }

  private static manageHeadcount(company: Company, employees: Resident[], allResidents: Resident[], state: GameState, context: GameContext): void {
    const workers = employees.filter(r => r.job === 'WORKER');
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workers.length;

    // Hiring
    // Relaxed condition: Allow "Credit-Based Hiring" down to -500 cash to prevent death spirals.
    if (gap > 0 && company.cash > -500) {
      const candidate = allResidents.find(r => 
          r.job === 'FARMER' && 
          r.reservationWage <= company.wageOffer
      );
      
      if (candidate) {
        candidate.job = 'WORKER';
        candidate.employerId = company.id;
        candidate.salary = 0; 
        company.employees++;
        
        if (context.employeesByCompany[company.id]) context.employeesByCompany[company.id].push(candidate);
        
        // Signing bonus only if cash positive
        if (company.cash > 0) {
            TransactionService.transfer(company, candidate, company.wageOffer * 0.5, { treasury: state.cityTreasury, residents: allResidents, context });
        }
      }
    } 
    // Firing
    else if (gap < 0) {
      const skillRank = { 'NOVICE': 1, 'SKILLED': 2, 'EXPERT': 3 };
      
      const workerToFire = workers.sort((a, b) => {
          const sA = skillRank[a.skill] || 1;
          const sB = skillRank[b.skill] || 1;
          if (sA !== sB) return sA - sB; 
          return b.happiness - a.happiness; 
      })[0];

      if (workerToFire) {
        workerToFire.job = 'FARMER';
        workerToFire.employerId = undefined;
        company.employees = Math.max(0, company.employees - 1);
        
        const idx = context.employeesByCompany[company.id]?.indexOf(workerToFire);
        if (idx > -1) context.employeesByCompany[company.id].splice(idx, 1);
        
        // Severance package (only if cash positive, otherwise tough luck)
        if (company.cash > 0) {
            TransactionService.transfer(company, workerToFire, company.wageOffer * 2, { treasury: state.cityTreasury, residents: allResidents, context });
        }
        
        workerToFire.happiness = Math.max(0, workerToFire.happiness - 20);
        state.logs.unshift(`🔥 ${company.name} 解雇了 ${workerToFire.name} (${workerToFire.skill})`);
      }
    }
  }
}
