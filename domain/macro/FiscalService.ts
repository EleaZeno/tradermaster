
import { GameState, GameContext, MayorPersonality, BusinessCyclePhase } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
import { BankingService } from '../finance/BankingService';
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
      
      let status: 'AUSTERITY' | 'NEUTRAL' | 'STIMULUS' = 'NEUTRAL';
      let actionLog = "";

      // 1. Determine Welfare Budget
      const deputy = context.residentsByJob['DEPUTY_MAYOR']?.[0];
      let welfareBudget = 30; // Base
      
      if (personality === MayorPersonality.POPULIST) welfareBudget = 100;
      if (personality === MayorPersonality.AUSTRIAN) welfareBudget = 5;

      if (deputy && personality !== MayorPersonality.AUSTRIAN) {
          if (treasury.cash > 200) welfareBudget *= 1.5;
          else welfareBudget *= 0.5;
      }
      treasury.taxPolicy.grainSubsidy = welfareBudget;

      // 2. Personality-Driven Fiscal Response
      
      // CRISIS TRIGGER (Independent of personality usually, but response differs)
      const lastGdp = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].gdp : 100;
      const isCrisis = lastGdp < 10 || cycle === BusinessCyclePhase.DEPRESSION;

      if (isCrisis) {
          const isGoldStandard = state.bank.system === 'GOLD_STANDARD';

          if (personality === MayorPersonality.AUSTRIAN) {
              // Austrian: Do nothing, let prices fall
              actionLog += "【萧条】市长拒绝干预市场 (Austrian)";
              status = 'AUSTERITY';
          } else {
              // Stimulus Attempt
              status = 'STIMULUS';
              const bailoutNeeded = 1000;
              let fundingSecured = false;

              // Check if Treasury has cash
              if (treasury.cash >= bailoutNeeded) {
                  fundingSecured = true;
                  actionLog += "【紧急】使用国库盈余救市; ";
              } else {
                  // Treasury broke: Try to print via Central Bank
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
                  // Distribute to Poor
                  const poor = state.population.residents.filter(r => r.cash < 5);
                  if (poor.length > 0) {
                      const amount = bailoutNeeded / poor.length;
                      poor.forEach(r => {
                          TransactionService.transfer('TREASURY', r, amount, { treasury, residents: state.population.residents, context });
                      });
                      actionLog += `直升机撒钱 (Helicopter Money); `;
                  } else {
                       // Corporate bailout
                       state.companies.forEach(c => {
                           if (c.cash < 100 && !c.isBankrupt) {
                               TransactionService.transfer('TREASURY', c, 200, { treasury, residents: state.population.residents, context });
                           }
                       });
                       actionLog += `企业纾困注资 (Corporate Bailout); `;
                  }
              }
          }
      } 
      // NORMAL CYCLE MANAGEMENT
      else {
          if (personality === MayorPersonality.KEYNESIAN) {
              // Counter-cyclical
              if (cycle === BusinessCyclePhase.RECESSION || cycle === BusinessCyclePhase.RECOVERY) {
                  status = 'STIMULUS';
                  FiscalService.adjustTax(state, -0.01);
                  actionLog += "逆周期刺激 (Keynesian)";
              } else if (cycle === BusinessCyclePhase.PEAK) {
                  status = 'AUSTERITY';
                  FiscalService.adjustTax(state, +0.01);
                  actionLog += "冷却过热经济 (Keynesian)";
              }
          } 
          else if (personality === MayorPersonality.POPULIST) {
              status = 'STIMULUS';
              if (treasury.taxPolicy.incomeTaxRate > 0.05) FiscalService.adjustTax(state, -0.02);
              
              // Run deficit if needed
              if (treasury.cash < 50 && state.bank.system !== 'GOLD_STANDARD') {
                  BankingService.monetizeDebt(state, 500);
                  actionLog += "赤字开支 (Populist)";
              }
          } 
          
          // WEALTH REDISTRIBUTION LOGIC (Prevents Infinite Treasury Accumulation)
          if (hoardingRatio > 0.15) {
              status = 'STIMULUS';
              
              // Gradually lower taxes
              if (treasury.taxPolicy.incomeTaxRate > 0.05) FiscalService.adjustTax(state, -0.005);
              
              // Direct Transfer (Citizens Dividend)
              const surplus = treasury.cash - (M0 * 0.10); 
              if (surplus > 100) {
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
              actionLog += "平衡预算 (Austrian)";
          }
      }

      state.cityTreasury.fiscalStatus = status;
      state.cityTreasury.fiscalCorrection = actionLog;
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
