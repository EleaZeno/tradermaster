
import { GameState, GameContext, MayorPersonality, BusinessCyclePhase, ResourceType } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { BankingService } from '../finance/BankingService';
import { MarketService } from '../market/MarketService';
import { GAME_CONFIG } from '../../shared/config';

export class FiscalService {
  static process(state: GameState, context: GameContext): void {
      // Manual Override Check
      if (state.policyOverrides.taxMultiplier !== 1.0) {
          FiscalService.applyManualOverride(state);
          return;
      }

      const personality = state.mayorPersonality;
      const cycle = state.businessCycle;
      const treasury = state.cityTreasury;
      const M0 = state.economicOverview.totalSystemGold || 1000;
      const hoardingRatio = treasury.cash / M0;
      
      const activeCompaniesCount = state.companies.filter(c => !c.isBankrupt).length;
      
      let status: 'AUSTERITY' | 'NEUTRAL' | 'STIMULUS' = 'NEUTRAL';
      let actionLog = "";

      // 1. Determine Welfare Budget
      const deputy = context.residentsByJob['DEPUTY_MAYOR']?.[0];
      let welfareBudget = 50; 
      
      if (personality === MayorPersonality.POPULIST) welfareBudget = 150;
      if (personality === MayorPersonality.AUSTRIAN) welfareBudget = 10;

      if (deputy && personality !== MayorPersonality.AUSTRIAN) {
          if (treasury.cash > 200) welfareBudget *= 1.5;
          else welfareBudget *= 0.5;
      }
      
      // Boost welfare during recession/depression
      if (cycle === BusinessCyclePhase.DEPRESSION || cycle === BusinessCyclePhase.RECESSION) {
          welfareBudget *= 2.0;
          actionLog += "福利加倍 (Crisis); ";
      }

      treasury.taxPolicy.grainSubsidy = welfareBudget;

      // 2. Strategic Reserves (Government Spending 'G')
      if (treasury.cash > 2000 && hoardingRatio > 0.1) {
          const grainBook = state.market[ResourceType.GRAIN];
          const price = grainBook.lastPrice;
          const buyAmount = Math.floor((treasury.cash * 0.05) / price); 
          
          if (buyAmount > 0) {
              MarketService.submitOrder(state, {
                  ownerId: 'TREASURY', 
                  ownerType: 'TREASURY',
                  itemId: ResourceType.GRAIN,
                  side: 'BUY',
                  type: 'MARKET',
                  price: 0,
                  quantity: buyAmount
              }, context);
              actionLog += `🏛️ 战略收储 (G): ${buyAmount} 粮食; `;
          }
      }

      // 3. Personality-Driven Fiscal Response
      const lastGdp = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].gdp : 100;
      const isCrisis = lastGdp < 10 || cycle === BusinessCyclePhase.DEPRESSION || activeCompaniesCount < 2;

      if (isCrisis) {
          const isGoldStandard = state.bank.system === 'GOLD_STANDARD';

          if (personality === MayorPersonality.AUSTRIAN) {
              actionLog += "【萧条】市长拒绝干预市场 (奥地利学派)";
              status = 'AUSTERITY';
          } else {
              // Stimulus Attempt
              status = 'STIMULUS';
              const bailoutNeeded = 1000;
              let fundingSecured = false;

              if (treasury.cash >= bailoutNeeded) {
                  fundingSecured = true;
                  actionLog += "【紧急】使用国库盈余救市; ";
              } else {
                  if (!isGoldStandard) {
                      const success = BankingService.monetizeDebt(state, bailoutNeeded);
                      if (success) {
                          fundingSecured = true;
                          actionLog += "【紧急】债务货币化 (QE); ";
                      } else {
                          actionLog += "【失败】央行拒绝融资; ";
                      }
                  } else {
                      actionLog += "【萧条】金本位限制：国库空虚且无法印钞; ";
                  }
              }
              
              if (fundingSecured) {
                  const poor = state.population.residents.filter(r => r.cash < 10);
                  if (poor.length > 0) {
                      const amount = bailoutNeeded / poor.length;
                      poor.forEach(r => {
                          TransactionService.transfer('TREASURY', r, amount, { treasury, residents: state.population.residents, context });
                      });
                      actionLog += `直升机撒钱 (Helicopter Money); `;
                  } else {
                       // Bailout Logic: Target any non-bankrupt company with negative cash
                       state.companies.forEach(c => {
                           if (c.cash < 0 && !c.isBankrupt) {
                               const injection = Math.abs(c.cash) + 200; // Restore to positive + buffer
                               TransactionService.transfer('TREASURY', c, injection, { treasury, residents: state.population.residents, context });
                               state.logs.unshift(`🏛️ 财政部注资挽救 ${c.name} (+${Math.floor(injection)})`);
                           }
                       });
                       actionLog += `企业纾困注资 (Bailout); `;
                  }
              }
          }
      } 
      // NORMAL CYCLE MANAGEMENT
      else {
          if (personality === MayorPersonality.KEYNESIAN) {
              if (cycle === BusinessCyclePhase.RECESSION || cycle === BusinessCyclePhase.RECOVERY) {
                  status = 'STIMULUS';
                  FiscalService.adjustTax(state, -0.01);
                  actionLog += "逆周期刺激 (凯恩斯主义)";
              } else if (cycle === BusinessCyclePhase.PEAK) {
                  status = 'AUSTERITY';
                  FiscalService.adjustTax(state, +0.01);
                  actionLog += "冷却过热经济";
              }
          } 
          else if (personality === MayorPersonality.POPULIST) {
              status = 'STIMULUS';
              if (treasury.taxPolicy.incomeTaxRate > 0.05) FiscalService.adjustTax(state, -0.02);
              if (treasury.cash < 50 && state.bank.system !== 'GOLD_STANDARD') {
                  BankingService.monetizeDebt(state, 500);
                  actionLog += "赤字开支 (民粹主义)";
              }
          } 
          
          if (hoardingRatio > 0.15) {
              status = 'STIMULUS';
              if (treasury.taxPolicy.incomeTaxRate > 0.05) FiscalService.adjustTax(state, -0.005);
              
              // Only do Citizen Dividend if surplus is HUGE
              const surplus = treasury.cash - (M0 * 0.10); 
              if (surplus > 500) { 
                  const residents = state.population.residents;
                  const perCapita = surplus / residents.length;
                  residents.forEach(r => {
                      TransactionService.transfer('TREASURY', r, perCapita, { treasury, residents, context });
                  });
                  actionLog += `全民分红 ${Math.floor(surplus)} oz`;
              } else {
                  actionLog += "逐步降税 (盈余过高)";
              }
          } else if (personality === MayorPersonality.AUSTRIAN && hoardingRatio < 0.05) {
              status = 'AUSTERITY';
              FiscalService.adjustTax(state, +0.01);
              actionLog += "平衡预算";
          }
      }

      // Execute Welfare Payments (The missing link)
      FiscalService.processWelfare(state, context);

      state.cityTreasury.fiscalStatus = status;
      state.cityTreasury.fiscalCorrection = actionLog;
  }

  private static processWelfare(state: GameState, context: GameContext) {
      // Basic Income for Extreme Poverty
      const treasury = state.cityTreasury;
      const povertyLine = 15; 
      const poor = state.population.residents.filter(r => r.cash < povertyLine && r.job !== 'MAYOR');
      
      const subsidy = state.cityTreasury.taxPolicy.grainSubsidy; // e.g. 50+ total budget
      if (poor.length === 0 || subsidy <= 0) return;

      const amountPerPerson = Math.min(10, subsidy / poor.length); 
      const totalNeeded = amountPerPerson * poor.length;

      // Fix: If treasury is empty but in Fiat, print money to prevent starvation
      if (treasury.cash < totalNeeded && state.bank.system !== 'GOLD_STANDARD') {
          BankingService.monetizeDebt(state, totalNeeded - treasury.cash + 100);
      }

      if (treasury.cash >= totalNeeded) {
          poor.forEach(r => {
              TransactionService.transfer('TREASURY', r, amountPerPerson, { treasury, residents: state.population.residents, context });
          });
          state.cityTreasury.dailyExpense += totalNeeded;
      }
  }

  private static adjustTax(state: GameState, delta: number) {
      const p = state.cityTreasury.taxPolicy;
      p.incomeTaxRate = Math.max(0.01, Math.min(0.5, p.incomeTaxRate + delta));
      p.corporateTaxRate = Math.max(0.01, Math.min(0.5, p.corporateTaxRate + delta));
  }

  private static applyManualOverride(state: GameState): void {
      const pol = state.cityTreasury.taxPolicy;
      const mult = state.policyOverrides.taxMultiplier;
      
      pol.incomeTaxRate = Math.min(0.8, GAME_CONFIG.TAX_RATES.INCOME_LOW * mult);
      pol.corporateTaxRate = Math.min(0.8, GAME_CONFIG.TAX_RATES.CORPORATE * mult);
      pol.consumptionTaxRate = Math.min(0.5, GAME_CONFIG.TAX_RATES.CONSUMPTION * mult);
      
      state.cityTreasury.fiscalStatus = 'NEUTRAL'; 
      state.cityTreasury.fiscalCorrection = `人工干预 (${mult.toFixed(1)}x)`;
  }
}
