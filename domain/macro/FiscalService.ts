
import { GameState, GameContext, MayorPersonality, BusinessCyclePhase } from '../../shared/types';
import { TransactionService } from '../finance/TransactionService';
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
          if (personality === MayorPersonality.AUSTRIAN) {
              // Austrian: Do nothing, let the rot clear out
              actionLog += "【萧条】市长拒绝干预市场; ";
              status = 'AUSTERITY';
          } else {
              // Stimulus for others
              status = 'STIMULUS';
              const bailout = 1000;
              treasury.cash += bailout;
              state.economicOverview.totalSystemGold += bailout; 
              
              const poor = state.population.residents.filter(r => r.cash < 5);
              const amount = poor.length > 0 ? bailout / poor.length : 0;
              
              if (amount > 0) {
                  poor.forEach(r => {
                      TransactionService.transfer('TREASURY', r, amount, { treasury, residents: state.population.residents, context });
                  });
                  actionLog += `【紧急】市长直升机撒钱; `;
              } else {
                   // Corporate bailout
                   state.companies.forEach(c => c.cash += 200);
                   actionLog += `【紧急】企业纾困注资; `;
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
              // Always spend, low tax
              status = 'STIMULUS';
              if (treasury.taxPolicy.incomeTaxRate > 0.05) FiscalService.adjustTax(state, -0.02);
              
              // Run deficit if needed (borrowing not implemented fully, so just print/burn reserves)
              if (treasury.cash < 50) {
                  treasury.cash += 500; // Silent monetization of debt
                  state.economicOverview.totalSystemGold += 500;
                  actionLog += "赤字开支 (Populist)";
              }
          } 
          else {
              // Austrian / Neutral: Target Surplus
              if (hoardingRatio < 0.1) {
                  status = 'AUSTERITY';
                  FiscalService.adjustTax(state, +0.01);
                  actionLog += "平衡预算 (Austrian)";
              } else if (hoardingRatio > 0.3) {
                  status = 'NEUTRAL';
                  FiscalService.adjustTax(state, -0.005);
              }
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
