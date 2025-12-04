
import { GameState, CompanyType, WageStructure, ResourceType, ProductType, Company } from '../../shared/types';
import { ECO_CONSTANTS } from '../../shared/config';
import { MarketService } from '../market/MarketService';

export class CompanyService {
  static updateLifecycle(state: GameState): void {
    CompanyService.processBankruptcy(state);
    CompanyService.processAICreation(state);

    state.companies.forEach(c => {
        if (c.isBankrupt) return;
        c.age += 1;
        
        // Stage Transitions
        if (c.stage === 'STARTUP') {
            if (c.age > ECO_CONSTANTS.LIFECYCLE.STARTUP_MAX_AGE) {
                if (c.lastProfit > 0) c.stage = 'GROWTH';
                else c.stage = 'DECLINE';
                state.logs.unshift(`🏢 ${c.name} 进入 ${c.stage} 阶段`);
            }
        } else if (c.stage === 'GROWTH') {
            if (c.monthlySalesVolume > 500 || c.age > 100) {
                c.stage = 'MATURITY';
                state.logs.unshift(`🏢 ${c.name} 进入成熟期`);
            }
        } else if (c.stage === 'MATURITY') {
            if (c.lastProfit < 0 && c.monthlySalesVolume < 100) {
                c.stage = 'DECLINE';
                state.logs.unshift(`📉 ${c.name} 开始衰退`);
            }
        }
        
        // KPI Updates
        const equity = (c.totalShares * c.sharePrice);
        const assets = c.cash + (c.landTokens||0)*100;
        
        c.kpis = {
            roe: equity > 0 ? c.lastProfit / equity : 0,
            roa: assets > 0 ? c.lastProfit / assets : 0,
            roi: 0.1, 
            leverage: equity > 0 ? (assets - equity) / equity : 0,
            marketShare: 0,
            creditScore: c.kpis.creditScore // Preserved from BankingService update
        };
    });
  }

  private static processBankruptcy(state: GameState): void {
      const debtThreshold = -500; // Insolvency limit

      state.companies.forEach(comp => {
          if (comp.isBankrupt) return;

          if (comp.cash < debtThreshold) {
              comp.isBankrupt = true;
              comp.stage = 'LIQUIDATED';
              state.logs.unshift(`☠️ ${comp.name} 正式破产清算 (负债过高)`);
              
              // 1. Fire Everyone
              const employees = state.population.residents.filter(r => r.employerId === comp.id);
              employees.forEach(e => {
                  e.job = 'UNEMPLOYED';
                  e.employerId = undefined;
              });
              comp.employees = 0;

              // 2. Liquidate Inventory to Market (Fire Sale)
              Object.entries(comp.inventory.finished).forEach(([item, qty]) => {
                  if (qty && qty > 0) {
                      MarketService.submitOrder(state, {
                          ownerId: comp.id,
                          ownerType: 'COMPANY',
                          itemId: item,
                          side: 'SELL',
                          type: 'MARKET',
                          price: 0,
                          quantity: qty
                      });
                  }
              });

              // 3. Default on Loans (Bank takes hit)
              const badLoans = state.bank.loans.filter(l => l.borrowerId === comp.id);
              badLoans.forEach(l => {
                  state.bank.totalLoans -= l.remainingPrincipal;
                  // Bank Equity hit (Implicit)
              });
              state.bank.loans = state.bank.loans.filter(l => l.borrowerId !== comp.id);
          }
      });
  }

  private static processAICreation(state: GameState): void {
      // Chance to start a company if rich residents exist
      if (state.day % 7 !== 0) return; // Weekly check

      const richResidents = state.population.residents.filter(r => 
          !r.isPlayer && 
          r.cash > 2000 && 
          r.job !== 'MAYOR' && 
          r.job !== 'EXECUTIVE'
      );

      if (richResidents.length > 0) {
          const founder = richResidents[Math.floor(Math.random() * richResidents.length)];
          
          // Determine best sector based on prices
          const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
          const breadPrice = state.products[ProductType.BREAD].marketPrice;
          
          // Simple heuristic: If Bread > 2x Grain, Bread is profitable. Else Grain.
          const type = breadPrice > grainPrice * 2.5 ? ProductType.BREAD : ResourceType.GRAIN;
          const name = `${founder.name} ${type === ResourceType.GRAIN ? '农场' : '工坊'}`;
          
          const ipoCost = 1000;
          founder.cash -= ipoCost;
          founder.job = 'EXECUTIVE';
          
          const newId = `comp_ai_${Date.now()}`;
          const newComp: Company = {
            id: newId, name: name,
            productionLines: [{ type, isActive: true, efficiency: 1.0, allocation: 1.0, maxCapacity: 50 }],
            cash: 1000, 
            sharePrice: 1.0, totalShares: 1000, ownedShares: 1000,
            shareholders: [{ id: founder.id, name: founder.name, count: 1000, type: 'RESIDENT' }],
            isPlayerFounded: false, employees: 1, targetEmployees: 5,
            wageOffer: 1.5, wageMultiplier: 1.5, lastWageUpdate: state.day,
            pricePremium: 0, executiveSalary: 5.0, dividendRate: 0.2, margin: 0.2,
            aiPersonality: founder.riskAversion > 1 ? 'CONSERVATIVE' : 'AGGRESSIVE', 
            boardMembers: [], unionTension: 0, strikeDays: 0,
            inventory: { raw: {}, finished: { [type]: 0 } },
            type: CompanyType.CORPORATION, 
            wageStructure: WageStructure.HIERARCHICAL, 
            ceoId: founder.id, 
            isBankrupt: false, 
            landTokens: 0,
            avgCost: 0, lastFixedCost: 0,
            accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
            lastRevenue: 0, lastProfit: 0, monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: [],
            tobinQ: 1.0, age: 0, stage: 'STARTUP',
            kpis: { roe: 0, roa: 0, roi: 0, leverage: 0, marketShare: 0, creditScore: 100 }
          };
          
          founder.employerId = newId;
          founder.portfolio[newId] = 1000;
          
          state.companies.push(newComp);
          // Init Market Book
          state.market[newId] = { bids: [], asks: [], lastPrice: 1.0, history: [], volatility: 0, spread: 0 };
          
          state.logs.unshift(`🚀 新股上市: ${name} (由 ${founder.name} 创立)`);
      }
  }

  static resetDailyCounters(state: GameState): void {
      state.companies.forEach(company => {
          company.lastProfit = 0; 
      });
  }
}
    