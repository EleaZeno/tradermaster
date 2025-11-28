
import { GameState, Company, Resident, GameContext, GDPFlowAccumulator, ResourceType, ProductType } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

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
        LaborService.adjustAIStrategy(company, companyEmployees, gameState);
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
              r.xp += GAME_CONFIG.LABOR.XP_PER_DAY;
              
              if (r.skill === 'NOVICE' && r.xp >= GAME_CONFIG.LABOR.SKILL_THRESHOLDS.SKILLED) {
                  r.skill = 'SKILLED';
                  state.logs.unshift(`🎓 ${r.name} 晋升为熟练工 (Skilled)`);
              } else if (r.skill === 'SKILLED' && r.xp >= GAME_CONFIG.LABOR.SKILL_THRESHOLDS.EXPERT) {
                  r.skill = 'EXPERT';
                  state.logs.unshift(`🎓 ${r.name} 晋升为专家 (Expert)`);
              }
          }
      });
  }

  private static adjustReservationWages(gameState: GameState): void {
      const history = gameState.macroHistory;
      if (history.length < 2) return;
      
      const lastInflation = history[history.length - 1].inflation;
      const sensitivity = GAME_CONFIG.ECONOMY.WAGE_SENSITIVITY;
      
      gameState.population.residents.forEach(res => {
          // Workers adjust reservation wage based on inflation expectations
          const change = res.reservationWage * lastInflation * sensitivity;
          if (change > 0) res.reservationWage += change; 
          else res.reservationWage += change * 0.1; // Downward stickiness
          
          let skillMultiplier = 1.0;
          if (res.skill === 'SKILLED') skillMultiplier = 1.5;
          if (res.skill === 'EXPERT') skillMultiplier = 2.5;
          
          res.reservationWage = Math.max(res.reservationWage, 1.5 * skillMultiplier);
          
          if (gameState.policyOverrides.minWage > 0) {
              res.reservationWage = Math.max(res.reservationWage, gameState.policyOverrides.minWage * skillMultiplier);
          }
      });
  }

  private static processUnionPolitics(company: Company, employees: Resident[], gameState: GameState): void {
      const workers = employees.filter(r => r.job === 'WORKER');
      const currentLeader = employees.find(r => r.job === 'UNION_LEADER');
      
      if ((!currentLeader && workers.length > 2) || (gameState.day % 7 === 0 && workers.length > 2)) {
          const candidates = [...workers].sort((a, b) => {
              const scoreA = a.leadership + (100 - a.happiness);
              const scoreB = b.leadership + (100 - b.happiness);
              return scoreB - scoreA;
          });

          if (candidates.length > 0) {
              const newLeader = candidates[0];
              if (currentLeader) {
                  currentLeader.job = 'WORKER'; 
                  currentLeader.salary = 0; 
              }
              newLeader.job = 'UNION_LEADER';
              newLeader.salary = company.wageOffer * 1.2; 
              gameState.logs.unshift(`✊ ${company.name} 选举结果：${newLeader.name} 当选工会主席！`);
              company.unionTension = 20; 
          }
      }

      if (currentLeader) {
          if (company.wageMultiplier < 1.8) {
              company.unionTension += 5;
          } else {
              company.unionTension = Math.max(0, company.unionTension - 2);
          }
      }
  }

  private static updatePlayerWage(company: Company, benchmark: number, gameState: GameState): void {
    let targetMultiplier = company.wageMultiplier || 1.5;
    
    // Union pressure overrides player setting if too low
    if (company.unionTension > 50) {
        targetMultiplier = Math.max(targetMultiplier, 2.2); 
    }

    let offer = parseFloat((benchmark * targetMultiplier).toFixed(2));
    
    const survivalWage = benchmark * 1.3;
    if (offer < survivalWage) {
        offer = parseFloat(survivalWage.toFixed(2));
        company.wageMultiplier = parseFloat((offer / benchmark).toFixed(1));
    }
    
    if (gameState.policyOverrides.minWage > 0) {
        offer = Math.max(offer, gameState.policyOverrides.minWage);
    }

    company.wageOffer = offer;
  }

  // --- MARGINAL PRODUCTIVITY LOGIC ---
  private static adjustAIStrategy(company: Company, employees: Resident[], state: GameState): void {
    // 1. Calculate Physical Marginal Product of Labor (MPL)
    // Production Function: Y = A * K^0.3 * L^0.7
    // MPL = dY/dL = 0.7 * (Y / L)
    
    const line = company.productionLines[0]; // Assuming single product type for primary decision
    if (!line) return;

    const A = line.efficiency;
    const K = Math.max(1, company.landTokens || 1);
    const workersCount = employees.filter(r => r.job === 'WORKER').length;
    const L = Math.max(1, workersCount);
    
    const currentOutput = 2.5 * A * Math.pow(K, 0.3) * Math.pow(L, 0.7);
    const MPL = 0.7 * (currentOutput / L);
    
    // 2. Calculate Value of Marginal Product (VMPL)
    // VMPL = MPL * Price of Output
    // This represents the revenue generated by the last worker
    let outputPrice = 1.0;
    if (line.type === ResourceType.GRAIN) outputPrice = state.resources[ResourceType.GRAIN].currentPrice;
    if (line.type === ProductType.BREAD) outputPrice = state.products[ProductType.BREAD].marketPrice;
    
    const VMPL = MPL * outputPrice;
    
    // 3. Profit Maximization Condition
    // Standard Econ: Hire until Wage = VMPL
    // Decision Rule:
    // If VMPL > Wage: Hiring generates profit -> Increase Labor Demand
    // If VMPL < Wage: Last worker loses money -> Decrease Labor Demand
    
    const currentWage = company.wageOffer;
    
    // Hiring Target Logic
    if (VMPL > currentWage * 1.1) {
        // Profitable to expand
        company.targetEmployees++;
    } else if (VMPL < currentWage * 0.9) {
        // Losing money at margin
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
    }
    
    // Wage Setting Logic (The Auction)
    // AI firms update their wage offer towards VMPL to attract/retain workers without overpaying
    // w_{t+1} = w_t + \lambda (VMPL - w_t)
    // However, if we can't fill positions, we must bid higher. If we have surplus applicants, we bid lower.
    // Simplifying: Target wage tracks VMPL with a safety margin (profit margin)
    
    const targetWage = VMPL * 0.9; // Target 10% profit on marginal labor
    const adjustmentSpeed = 0.1;
    const newWageOffer = currentWage + adjustmentSpeed * (targetWage - currentWage);
    
    company.wageOffer = parseFloat(Math.max(0.5, newWageOffer).toFixed(2));
    
    // Check Inventory Constraints (Cashflow protection)
    const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    if (stock > 50) {
        // Inventory glut override: Stop hiring, cut costs
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
        company.wageOffer = Math.max(0.5, company.wageOffer * 0.95);
    }

    // Update the multiplier for UI display (Benchmark relative)
    const benchmark = state.resources[ResourceType.GRAIN].currentPrice || 1.0;
    company.wageMultiplier = parseFloat((company.wageOffer / benchmark).toFixed(1));
  }

  private static payExecutives(company: Company, employees: Resident[], gameState: GameState, context: GameContext, gdpFlow: GDPFlowAccumulator): void {
    const executives = employees.filter(r => r.job === 'EXECUTIVE' || r.job === 'UNION_LEADER');
    
    executives.forEach(exec => {
      let salary = 0;
      if (exec.job === 'UNION_LEADER') {
          salary = company.wageOffer * 1.2;
      } else {
          salary = (company.executiveSalary / 1.5) * company.wageOffer;
      }

      if (company.cash >= salary) {
        TransactionService.transfer(company, exec, salary, { treasury: gameState.cityTreasury, residents: gameState.population.residents, context });
        company.accumulatedCosts += salary;
        // Executive pay is essentially Labor Income (part of GDP usually, but functionally profit sharing here)
      }
    });
  }

  private static manageHeadcount(company: Company, employees: Resident[], allResidents: Resident[], gameState: GameState, context: GameContext): void {
    const workers = employees.filter(r => r.job === 'WORKER');
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workers.length;

    if (gap > 0 && company.cash > company.wageOffer * 3) { 
      // Supply Side: Check Reservation Wage
      const candidate = allResidents.find(r => 
          r.job === 'FARMER' && 
          r.reservationWage <= company.wageOffer && 
          r.happiness < 90
      );
      
      if (candidate) {
        candidate.job = 'WORKER';
        candidate.employerId = company.id;
        company.employees++;
        
        if (context.employeesByCompany[company.id]) context.employeesByCompany[company.id].push(candidate);
        
        // Signing Bonus
        TransactionService.transfer(company, candidate, company.wageOffer * 0.5, { treasury: gameState.cityTreasury, residents: allResidents, context });
      }
    } 
    else if (gap < 0) {
      const workerToFire = workers[0];
      if (workerToFire) {
        workerToFire.job = 'FARMER';
        workerToFire.employerId = undefined;
        company.employees--;
        
        const idx = context.employeesByCompany[company.id]?.indexOf(workerToFire);
        if (idx > -1) context.employeesByCompany[company.id].splice(idx, 1);
        
        // Severance
        TransactionService.transfer(company, workerToFire, company.wageOffer * 2, { treasury: gameState.cityTreasury, residents: allResidents, context });
      }
    }
  }
}
