
import { GameState, Company, Resident, GameContext, GDPFlowAccumulator, ResourceType } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { ECO_CONSTANTS } from '../../shared/config';
import { safeDivide, clamp } from '../../shared/utils/math';

export class LaborService {
  /**
   * Phase 1: Update Wages & Skills based on Macro conditions
   * Run before Consumption (Budgets depend on expected wages)
   */
  static updateMarketConditions(gameState: GameState): void {
      // 1. Inflation Wage Adjustment (Sticky Wages)
      LaborService.adjustReservationWages(gameState);

      // 2. Process Skills (XP Gain)
      LaborService.processSkills(gameState);
  }

  /**
   * Phase 2: Hiring/Firing and Payroll
   * Run during Production phase
   */
  static processPayrollAndHiring(gameState: GameState, context: GameContext, livingCostBenchmark: number, wagePressureMod: number, gdpFlow: GDPFlowAccumulator): void {
    const { companies } = gameState;
    const residents = gameState.population.residents;
    const employeesByCompany = context.employeesByCompany;

    companies.forEach(company => {
      if (company.isBankrupt) return;
      
      const companyEmployees = employeesByCompany[company.id] || [];

      // Update Company Wage Policy
      LaborService.processUnionPolitics(company, companyEmployees, gameState);
      
      // Calculate Equilibrium Wage based on Marginal Productivity
      if (!company.isPlayerFounded) {
        LaborService.adjustAIStrategy(company, companyEmployees, gameState, wagePressureMod);
      } else {
        // For player, we just apply the manual slider/multiplier relative to benchmark
        LaborService.updatePlayerWage(company, livingCostBenchmark, gameState);
      }

      // Execute Payroll
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
      // Allow minor deflation without crashing, but prevent extreme negative wage spirals
      const effectiveInflation = Math.max(-0.05, lastInflation); 

      const sensitivity = ECO_CONSTANTS.ECONOMY.WAGE_SENSITIVITY;
      
      state.population.residents.forEach(res => {
          // Sticky Downwards: Wages rise fast with inflation, fall slow with deflation
          const change = res.reservationWage * effectiveInflation * sensitivity;
          
          if (change > 0) {
              res.reservationWage += change; 
          } else {
              res.reservationWage += change * 0.1; // 90% Resistance to cuts (Keynesian Stickiness)
          }
          
          // Absolute Floor
          res.reservationWage = Math.max(0.5, res.reservationWage);
      });
  }

  private static processUnionPolitics(company: Company, employees: Resident[], state: GameState): void {
      const workers = employees.filter(r => r.job === 'WORKER');
      const currentLeader = employees.find(r => r.job === 'UNION_LEADER');
      
      // Election Logic
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

      // Tension Logic
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
    // Enforce reasonable floor even for players to prevent exploiting starving AI
    company.wageOffer = Math.max(0.1, offer);
  }

  private static adjustAIStrategy(company: Company, employees: Resident[], state: GameState, wagePressure: number): void {
    const workersCount = employees.filter(r => r.job === 'WORKER').length;
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    
    // 1. Hiring Strategy (Headcount)
    if (stock > 50 && company.employees > 1) {
        // Overproduction -> Freeze hiring or Fire
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
    } else if (stock < 15 && company.cash > 200) {
        // Shortage + Cash -> Hire
        company.targetEmployees++;
    }

    // 2. Wage Strategy (Price of Labor)
    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workersCount;

    // React to labor shortage (gap > 0) OR external pressure (Events/Unions)
    const effectivePressure = wagePressure * (1 + company.unionTension / 100);

    if (gap > 0 || effectivePressure > 1.05) {
      // Raise wages to attract talent or appease union
      company.wageMultiplier = Math.min(5.0, company.wageMultiplier + 0.15);
    } else if (gap < 0 || (gap === 0 && company.cash < company.wageOffer * 5)) {
      // Lower wages if overstaffed or poor, but respect stickiness
      if (company.unionTension < 30) {
          company.wageMultiplier = Math.max(1.2, company.wageMultiplier - 0.05);
      }
    }
    
    // Apply update
    const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
    company.wageOffer = parseFloat((grainPrice * company.wageMultiplier).toFixed(2));
  }

  private static payExecutives(company: Company, employees: Resident[], state: GameState, context: GameContext, gdpFlow: GDPFlowAccumulator): void {
    const executives = employees.filter(r => r.job === 'EXECUTIVE' || r.job === 'UNION_LEADER');
    
    executives.forEach(exec => {
      let salary = 0;
      if (exec.job === 'UNION_LEADER') {
          salary = company.wageOffer * 1.2;
      } else {
          // Executive salary scales with wage offer and company setting
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
    if (gap > 0 && company.cash > company.wageOffer * 5) { // Need buffer for at least 5 days wages
      // Find candidate: Farmer, Willing to work for offer, Not too happy (willing to switch)
      const candidate = allResidents.find(r => 
          r.job === 'FARMER' && 
          r.reservationWage <= company.wageOffer && 
          r.happiness < 95 // Almost everyone is hireable unless ecstatic
      );
      
      if (candidate) {
        candidate.job = 'WORKER';
        candidate.employerId = company.id;
        candidate.salary = 0; // Workers get daily wage transfers, not fixed salary property
        company.employees++;
        
        // Update context cache
        if (context.employeesByCompany[company.id]) context.employeesByCompany[company.id].push(candidate);
        
        // Signing Bonus (small incentive)
        TransactionService.transfer(company, candidate, company.wageOffer * 0.5, { treasury: state.cityTreasury, residents: allResidents, context });
      }
    } 
    // Firing
    else if (gap < 0) {
      const workerToFire = workers[0]; // LIFO or performance based? currently simple
      if (workerToFire) {
        workerToFire.job = 'FARMER';
        workerToFire.employerId = undefined;
        company.employees = Math.max(0, company.employees - 1);
        
        // Update context cache
        const idx = context.employeesByCompany[company.id]?.indexOf(workerToFire);
        if (idx > -1) context.employeesByCompany[company.id].splice(idx, 1);
        
        // Severance Pay (2 days wages)
        TransactionService.transfer(company, workerToFire, company.wageOffer * 2, { treasury: state.cityTreasury, residents: allResidents, context });
        
        // Morale Hit
        workerToFire.happiness = Math.max(0, workerToFire.happiness - 20);
        state.logs.unshift(`🔥 ${company.name} 解雇了 ${workerToFire.name}`);
      }
    }
  }
}
