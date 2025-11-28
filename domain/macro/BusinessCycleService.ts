
import { GameState, BusinessCyclePhase } from '../../shared/types';

export class BusinessCycleService {
  static updateCycle(state: GameState): void {
    const history = state.macroHistory;
    if (history.length < 10) return;

    const currentPhase = state.businessCycle;
    const last = history[history.length - 1];
    const prev = history[history.length - 5] || last;

    // Indicators
    const gdpGrowth = (last.gdp - prev.gdp) / (prev.gdp || 1); // 5-day growth
    const inflation = last.inflation;
    const unemployment = last.unemployment;

    // Thresholds
    const GROWTH_BOOM = 0.05; // 5% growth over 5 days is fast
    const INFLATION_HIGH = 0.05;
    const RECESSION_NEG_GROWTH = -0.01;

    let nextPhase = currentPhase;

    // State Machine
    switch (currentPhase) {
      case BusinessCyclePhase.RECOVERY:
        // Transition to Expansion if growth is solid and unemployment drops
        if (gdpGrowth > 0.02 && unemployment < 0.08) {
          nextPhase = BusinessCyclePhase.EXPANSION;
          state.logs.unshift(`📈 经济进入扩张期 (Expansion)`);
        }
        break;

      case BusinessCyclePhase.EXPANSION:
        // Transition to Peak if overheating (high inflation) or growth slows down massively
        if (inflation > INFLATION_HIGH || (gdpGrowth < 0.01 && unemployment < 0.04)) {
          nextPhase = BusinessCyclePhase.PEAK;
          state.logs.unshift(`🏔️ 经济见顶 (Peak) - 存在过热风险`);
        }
        break;

      case BusinessCyclePhase.PEAK:
        // Transition to Recession if growth turns negative
        if (gdpGrowth < RECESSION_NEG_GROWTH) {
          nextPhase = BusinessCyclePhase.RECESSION;
          state.logs.unshift(`📉 经济进入衰退 (Recession)`);
        }
        break;

      case BusinessCyclePhase.RECESSION:
        // Transition to Depression if profound negative growth persists
        if (gdpGrowth < -0.10) {
          nextPhase = BusinessCyclePhase.DEPRESSION;
          state.logs.unshift(`☠️ 经济大萧条 (Depression)`);
        } 
        // Transition to Recovery if growth stabilizes
        else if (gdpGrowth > 0.01) {
          nextPhase = BusinessCyclePhase.RECOVERY;
          state.logs.unshift(`🌱 经济开始复苏 (Recovery)`);
        }
        break;

      case BusinessCyclePhase.DEPRESSION:
        // Hard to get out
        if (gdpGrowth > 0.03) {
          nextPhase = BusinessCyclePhase.RECOVERY;
          state.logs.unshift(`🌤️ 终于走出萧条`);
        }
        break;
    }

    state.businessCycle = nextPhase;
  }
}
