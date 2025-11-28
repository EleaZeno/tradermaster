
import { GameState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/config';

export class CompanyService {
  static updateLifecycle(state: GameState): void {
    state.companies.forEach(c => {
        if (c.isBankrupt) return;
        c.age += 1;
        
        // Stage Transitions
        if (c.stage === 'STARTUP') {
            if (c.age > GAME_CONFIG.LIFECYCLE.STARTUP_MAX_AGE) {
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
            marketShare: 0 
        };
    });
  }

  static resetDailyCounters(state: GameState): void {
      state.companies.forEach(company => {
          company.lastProfit = 0; 
      });
  }
}
