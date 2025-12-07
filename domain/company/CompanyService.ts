
import { GameState, CompanyType, WageStructure, ResourceType, ProductType, Company, IndustryType } from '../../shared/types';
import { ECO_CONSTANTS } from '../../shared/config';
import { MarketService } from '../market/MarketService';

export class CompanyService {
  static updateLifecycle(state: GameState): void {
    // 1. Process Bankruptcy FIRST to clear dead entities before aging
    CompanyService.processBankruptcy(state);
    
    // 2. Create new challengers
    CompanyService.processAICreation(state);

    state.companies.forEach(c => {
        if (c.isBankrupt) return;
        c.age += 1;
        
        // --- Zombie Detection ---
        if (c.cash < 0) {
            c.consecutiveNegativeCashDays = (c.consecutiveNegativeCashDays || 0) + 1;
        } else {
            c.consecutiveNegativeCashDays = 0;
        }
        
        // Force bankruptcy if insolvent for too long (14 days) or DEEP debt (-500)
        // Player companies get a bit more leniency or game over logic elsewhere
        if ((c.consecutiveNegativeCashDays > 14 || c.cash < -500) && !c.isPlayerFounded) {
             // Nudge to threshold to ensure next pass catches it
             if (c.cash > -500) c.cash = -501; 
             state.logs.unshift(`⚠️ ${c.name} 资金链断裂 (Solvency Crisis) - 僵尸企业清理`);
        }
        // ------------------------

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
            creditScore: c.kpis.creditScore
        };
    });
  }

  private static processBankruptcy(state: GameState): void {
      const debtThreshold = -500; 

      state.companies.forEach(comp => {
          if (comp.isBankrupt) return;

          if (comp.cash < debtThreshold) {
              comp.isBankrupt = true;
              comp.stage = 'LIQUIDATED';
              comp.targetEmployees = 0;
              state.logs.unshift(`☠️ ${comp.name} 正式破产清算 (负债: ${Math.floor(comp.cash)})`);
              
              // 0. M0 Conservation Fix: Debt Assumption
              // The Treasury assumes the toxic debt/overdraft to balance the books.
              // comp.cash is negative (e.g. -600). Treasury cash reduces by 600.
              // This ensures Sum(Cash) remains constant before and after company removal/zeroing.
              state.cityTreasury.cash += comp.cash;
              comp.cash = 0; // Reset to 0 for cleanliness, though it's marked bankrupt

              // 1. Fire Everyone
              const employees = state.population.residents.filter(r => r.employerId === comp.id);
              employees.forEach(e => {
                  e.job = 'UNEMPLOYED';
                  e.employerId = undefined;
              });
              comp.employees = 0;

              // 2. Liquidate Inventory (Seizure by Treasury/State)
              // Instead of market dumping which might fail if market is frozen, 
              // we transfer assets to Treasury to auction later (or just consume).
              // This clears the bankrupt company's books immediately.
              Object.entries(comp.inventory.finished).forEach(([item, qty]) => {
                  if (qty && qty > 0) {
                      MarketService.cancelAllOrders(state, comp.id, item);
                      // Transfer to Treasury (Seizure)
                      // Treasury logic in FiscalService can sell it later if needed
                      // For now, we assume it's seized and auctioned off-screen or added to public stockpile?
                      // Let's simplified: Burn it (Spoilage due to bankruptcy chaos) OR give to Treasury
                      // Burning is safer to prevent clutter, but Treasury selling helps deflation.
                      // Let's Burn for now to ensure "Bankrupt companies don't hold assets"
                      // state.logs.unshift(`🔥 ${comp.name} 库存被查封销毁: ${qty.toFixed(1)} ${item}`);
                      comp.inventory.finished[item as IndustryType] = 0;
                  }
              });
              
              // Clear Raw Materials too
              Object.entries(comp.inventory.raw).forEach(([item, qty]) => {
                  if (qty && qty > 0) {
                      MarketService.cancelAllOrders(state, comp.id, item);
                      comp.inventory.raw[item as ResourceType] = 0;
                  }
              });

              // 3. Default on Loans (Bank takes hit)
              const badLoans = state.bank.loans.filter(l => l.borrowerId === comp.id);
              badLoans.forEach(l => {
                  state.bank.totalLoans -= l.remainingPrincipal;
                  // Bank Equity takes the hit, Reserves unaffected (unless run on bank)
              });
              state.bank.loans = state.bank.loans.filter(l => l.borrowerId !== comp.id);
          }
      });
  }

  private static processAICreation(state: GameState): void {
      const activeCompanies = state.companies.filter(c => !c.isBankrupt).length;
      const isEmergency = activeCompanies < 5; 
      
      // Increased cap to 15 to allow for Zipf distribution
      if (activeCompanies >= 15 && state.day % 30 !== 0) return; 
      if (!isEmergency && state.day % 7 !== 0) return; 

      // Lower capital requirement to encourage more startups
      const capitalReq = isEmergency ? 100 : 1000; 

      const richResidents = state.population.residents.filter(r => 
          !r.isPlayer && 
          r.cash > capitalReq && 
          r.job !== 'MAYOR'
      );

      if (richResidents.length > 0) {
          const founder = richResidents[Math.floor(Math.random() * richResidents.length)];
          
          const grainPrice = state.resources[ResourceType.GRAIN].currentPrice;
          const breadPrice = state.products[ProductType.BREAD].marketPrice;
          
          // Basic heuristic for opportunity
          const type = breadPrice > grainPrice * 2.5 ? ProductType.BREAD : ResourceType.GRAIN;
          const name = `${founder.name} ${type === ResourceType.GRAIN ? '农场' : '工坊'}`;
          
          const ipoCost = isEmergency ? 50 : 500;
          founder.cash -= ipoCost;
          if (founder.job !== 'EXECUTIVE') founder.job = 'EXECUTIVE';
          
          state.cityTreasury.cash += ipoCost;
          
          const newId = `comp_ai_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
          const initialCapital = isEmergency ? 500 : ipoCost; 
          
          if (isEmergency) {
              state.cityTreasury.cash -= (initialCapital - ipoCost);
          } else {
              founder.cash -= (initialCapital - ipoCost);
          }

          const newComp: Company = {
            id: newId, name: name,
            productionLines: [{ type, isActive: true, efficiency: 1.0, allocation: 1.0, maxCapacity: 50 }],
            cash: initialCapital, 
            sharePrice: 1.0, totalShares: 1000, ownedShares: 1000,
            shareholders: [{ id: founder.id, name: founder.name, count: 1000, type: 'RESIDENT' }],
            isPlayerFounded: false, employees: 1, targetEmployees: 5,
            wageOffer: 1.5, wageMultiplier: 1.5, lastWageUpdate: state.day,
            pricePremium: 0, executiveSalary: isEmergency ? 1.0 : 3.0, dividendRate: 0.2, margin: 0.2,
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
            kpis: { roe: 0, roa: 0, roi: 0, leverage: 0, marketShare: 0, creditScore: 100 },
            consecutiveNegativeCashDays: 0
          };
          
          founder.employerId = newId;
          founder.portfolio[newId] = 1000;
          
          state.companies.push(newComp);
          state.market[newId] = { bids: [], asks: [], lastPrice: 1.0, history: [], volatility: 0, spread: 0 };
          
          const reason = isEmergency ? "🚨 紧急救市 IPO" : "🚀 新股上市";
          state.logs.unshift(`${reason}: ${name} (由 ${founder.name} 创立)`);
      } else if (isEmergency && activeCompanies < 2) {
          // SOE Creation (Government Bailout)
          if (state.cityTreasury.cash > 200 || state.bank.system !== 'GOLD_STANDARD') {
              if (state.cityTreasury.cash < 500) {
                  state.bank.reserves += 500;
                  state.cityTreasury.cash += 500;
                  state.economicOverview.totalSystemGold += 500;
              }
              state.cityTreasury.cash -= 500; 
              
              const newId = `comp_soe_${Date.now()}`;
              state.companies.push({
                  id: newId, name: "国立应急粮厂",
                  productionLines: [{ type: ResourceType.GRAIN, isActive: true, efficiency: 1.0, allocation: 1.0, maxCapacity: 100 }],
                  cash: 500, 
                  sharePrice: 1.0, totalShares: 1000, ownedShares: 1000,
                  shareholders: [{ id: 'TREASURY', name: "Government", count: 1000, type: 'INSTITUTION' }],
                  isPlayerFounded: false, employees: 0, targetEmployees: 10,
                  wageOffer: 2.5, wageMultiplier: 1.5, lastWageUpdate: state.day,
                  pricePremium: 0, executiveSalary: 0, dividendRate: 0, margin: 0, aiPersonality: 'BALANCED', boardMembers: [], unionTension: 0, strikeDays: 0,
                  inventory: { raw: {}, finished: {} }, type: CompanyType.CORPORATION, wageStructure: WageStructure.FLAT, ceoId: 'res_mayor', isBankrupt: false,
                  landTokens: 5, avgCost: 0, lastFixedCost: 0, accumulatedRevenue: 0, accumulatedCosts: 0, accumulatedWages: 0, accumulatedMaterialCosts: 0,
                  lastRevenue: 0, lastProfit: 0, monthlySalesVolume: 0, monthlyProductionVolume: 0, reports: [], history: [], tobinQ: 1, age: 0, stage: 'STARTUP',
                  kpis: { roe: 0, roa: 0, roi: 0, leverage: 0, marketShare: 0, creditScore: 100 }, consecutiveNegativeCashDays: 0
              });
              state.market[newId] = { bids: [], asks: [], lastPrice: 1.0, history: [], volatility: 0, spread: 0 };
              state.logs.unshift(`🏛️ 政府直接干预：成立国立企业以恢复生产。`);
          }
      }
  }

  static resetDailyCounters(state: GameState): void {
      state.companies.forEach(company => {
          company.lastProfit = 0; 
      });
  }
}
