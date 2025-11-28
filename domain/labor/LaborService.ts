
import { GameState, Company, Resident, GameContext, SkillLevel, GDPFlowAccumulator } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { GAME_CONFIG } from '../../shared/config';

export class LaborService {
  static process(gameState: GameState, context: GameContext, livingCostBenchmark: number, wagePressureMod: number, gdpFlow: GDPFlowAccumulator): void {
    const { companies } = gameState;
    const residents = gameState.population.residents;

    // 0. Inflation Wage Adjustment (Wage-Price Spiral)
    LaborService.adjustReservationWages(gameState);

    // 1. Process Skills (XP Gain)
    LaborService.processSkills(gameState);

    LaborService.processSocialMobility(gameState);

    const employeesByCompany = context.employeesByCompany;

    companies.forEach(company => {
      if (company.isBankrupt) return;
      
      const companyEmployees = employeesByCompany[company.id] || [];

      LaborService.processUnionPolitics(company, companyEmployees, gameState);
      LaborService.updateWageOffer(company, livingCostBenchmark, gameState);

      if (!company.isPlayerFounded) {
        LaborService.adjustAIStrategy(company, companyEmployees, wagePressureMod);
      }

      LaborService.payExecutives(company, companyEmployees, gameState, context);
      LaborService.manageHeadcount(company, companyEmployees, residents, gameState, context);
    });
  }

  private static processSkills(state: GameState): void {
      state.population.residents.forEach(r => {
          if (r.job !== 'UNEMPLOYED' && r.employerId) {
              r.xp += GAME_CONFIG.LABOR.XP_PER_DAY;
              
              // Level Up Logic
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
          const change = res.reservationWage * lastInflation * sensitivity;
          if (change > 0) res.reservationWage += change; 
          else res.reservationWage += change * 0.1; 
          
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

  private static processSocialMobility(gameState: GameState): void {
    const WEALTH_THRESHOLD = 350; 
    const POVERTY_LINE = 20; 

    gameState.population.residents.forEach(resident => {
        if (resident.isPlayer || resident.job === 'MAYOR' || resident.job === 'DEPUTY_MAYOR' || resident.job === 'EXECUTIVE' || resident.job === 'UNION_LEADER') return;

        if (resident.cash > WEALTH_THRESHOLD && (resident.job === 'FARMER' || resident.job === 'WORKER')) {
            if (resident.job === 'WORKER' && resident.employerId) {
                 const company = gameState.companies.find(c => c.id === resident.employerId);
                 if (company) company.employees--;
            }
            
            resident.job = 'FINANCIER';
            resident.employerId = undefined;
            resident.livingStandard = 'LUXURY'; 
            gameState.logs.unshift(`👔 ${resident.name} 积累了巨额财富，决定退休成为全职投资人。`);
        }

        if (resident.cash < POVERTY_LINE && resident.job === 'FINANCIER') {
            resident.job = 'FARMER';
            resident.livingStandard = 'SURVIVAL'; 
            gameState.logs.unshift(`🚜 ${resident.name} 投资破产，被迫重新下地务农。`);
        }
    });
    
    gameState.population.financiers = gameState.population.residents.filter(r => r.job === 'FINANCIER').length;
    gameState.population.farmers = gameState.population.residents.filter(r => r.job === 'FARMER').length;
  }

  private static updateWageOffer(company: Company, benchmark: number, gameState: GameState): void {
    let targetMultiplier = company.wageMultiplier || 1.5;
    
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

  private static adjustAIStrategy(company: Company, employees: Resident[], wagePressure: number): void {
    const workersCount = employees.filter(r => r.job === 'WORKER').length;
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    
    const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    
    if (stock > 50 && company.employees > 1) {
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
    } else if (stock < 15 && company.cash > 200) {
        company.targetEmployees++;
    }

    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workersCount;

    if (gap > 0 || wagePressure > 1.05 || company.unionTension > 60) {
      company.wageMultiplier = Math.min(5.0, company.wageMultiplier + 0.15);
    } else if (gap < 0 || (gap === 0 && company.cash < company.wageOffer * 5)) {
      if (company.unionTension < 30) {
          company.wageMultiplier = Math.max(1.2, company.wageMultiplier - 0.05);
      }
    }
  }

  private static payExecutives(company: Company, employees: Resident[], gameState: GameState, context: GameContext): void {
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
      }
    });
  }

  private static manageHeadcount(company: Company, employees: Resident[], allResidents: Resident[], gameState: GameState, context: GameContext): void {
    const workers = employees.filter(r => r.job === 'WORKER');
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workers.length;

    if (gap > 0 && company.cash > company.wageOffer * 3) { 
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
        
        TransactionService.transfer(company, workerToFire, company.wageOffer * 2, { treasury: gameState.cityTreasury, residents: allResidents, context });
      }
    }
  }
}
