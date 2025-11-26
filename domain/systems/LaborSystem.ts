import { GameState, Company, Resident } from '../../shared/types';
import { Transaction } from '../utils/Transaction';

export class LaborSystem {
  /**
   * Processes all labor related activities: hiring, firing, wages, and social mobility.
   */
  static process(gameState: GameState, livingCostBenchmark: number, wagePressureMod: number) {
    const { companies } = gameState;
    const residents = gameState.population.residents;

    LaborSystem.processSocialMobility(gameState);

    companies.forEach(company => {
      if (company.isBankrupt) return;

      LaborSystem.processUnionPolitics(company, residents, gameState);
      LaborSystem.updateWageOffer(company, livingCostBenchmark);

      if (!company.isPlayerFounded) {
        LaborSystem.adjustAIStrategy(company, residents, wagePressureMod);
      }

      LaborSystem.payExecutives(company, residents, gameState);
      LaborSystem.manageHeadcount(company, residents, gameState);
    });
  }

  private static processUnionPolitics(company: Company, residents: Resident[], gameState: GameState) {
      const workers = residents.filter(r => r.employerId === company.id && r.job === 'WORKER');
      
      let currentLeader = residents.find(r => r.employerId === company.id && r.job === 'UNION_LEADER');
      
      // Election logic: every 7 days or if no leader exists
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

  private static processSocialMobility(gameState: GameState) {
    const WEALTH_THRESHOLD = 350; 
    const POVERTY_LINE = 20; 

    gameState.population.residents.forEach(resident => {
        if (resident.isPlayer || ['MAYOR', 'DEPUTY_MAYOR', 'EXECUTIVE', 'UNION_LEADER'].includes(resident.job)) return;

        // Upward Mobility
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

        // Downward Mobility
        if (resident.cash < POVERTY_LINE && resident.job === 'FINANCIER') {
            resident.job = 'FARMER';
            resident.livingStandard = 'SURVIVAL'; 
            gameState.logs.unshift(`🚜 ${resident.name} 投资破产，被迫重新下地务农。`);
        }
    });
    
    gameState.population.financiers = gameState.population.residents.filter(r => r.job === 'FINANCIER').length;
    gameState.population.farmers = gameState.population.residents.filter(r => r.job === 'FARMER').length;
  }

  private static updateWageOffer(company: Company, benchmark: number) {
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

    company.wageOffer = offer;
  }

  private static adjustAIStrategy(company: Company, residents: Resident[], wagePressure: number) {
    const employees = residents.filter(r => r.employerId === company.id);
    const workersCount = employees.filter(r => r.job === 'WORKER').length;
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    
    // Determine Target
    const stock = Object.values(company.inventory.finished).reduce((a, b) => a + (Number(b) || 0), 0);
    
    // Inventory Management Logic
    if (stock > 50 && company.employees > 1) {
        company.targetEmployees = Math.max(1, company.targetEmployees - 1);
    } else if (stock < 15 && company.cash > 200) {
        company.targetEmployees++;
    }

    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workersCount;

    // Wage Adjustment Logic
    if (gap > 0 || wagePressure > 1.05 || company.unionTension > 60) {
      company.wageMultiplier = Math.min(5.0, company.wageMultiplier + 0.15);
    } else if (gap < 0 || (gap === 0 && company.cash < company.wageOffer * 5)) {
      if (company.unionTension < 30) {
          company.wageMultiplier = Math.max(1.2, company.wageMultiplier - 0.05);
      }
    }
  }

  private static payExecutives(company: Company, residents: Resident[], gameState: GameState) {
    const executives = residents.filter(r => (r.job === 'EXECUTIVE' || r.job === 'UNION_LEADER') && r.employerId === company.id);
    
    executives.forEach(exec => {
      let salary = 0;
      if (exec.job === 'UNION_LEADER') {
          salary = company.wageOffer * 1.2;
      } else {
          salary = (company.executiveSalary / 1.5) * company.wageOffer;
      }

      if (company.cash >= salary) {
        Transaction.transfer(company, exec, salary, { treasury: gameState.cityTreasury, residents });
        company.accumulatedCosts += salary;
      }
    });
  }

  private static manageHeadcount(company: Company, residents: Resident[], gameState: GameState) {
    const employees = residents.filter(r => r.employerId === company.id);
    const workers = employees.filter(r => r.job === 'WORKER');
    const nonWorkersCount = employees.filter(r => r.job !== 'WORKER').length;
    const target = Math.max(0, company.targetEmployees - nonWorkersCount);
    const gap = target - workers.length;

    // Hiring
    if (gap > 0 && company.cash > company.wageOffer * 3) { 
      // Find a cheap, unhappy farmer
      const candidate = residents.find(r => r.job === 'FARMER' && r.happiness < 90);
      if (candidate) {
        candidate.job = 'WORKER';
        candidate.employerId = company.id;
        company.employees++;
        // Signing bonus
        Transaction.transfer(company, candidate, company.wageOffer * 0.5, { treasury: gameState.cityTreasury, residents });
      }
    } 
    // Firing
    else if (gap < 0) {
      const workerToFire = workers[0];
      if (workerToFire) {
        workerToFire.job = 'FARMER';
        workerToFire.employerId = undefined;
        company.employees--;
        // Severance pay
        Transaction.transfer(company, workerToFire, company.wageOffer * 2, { treasury: gameState.cityTreasury, residents });
      }
    }
  }
}