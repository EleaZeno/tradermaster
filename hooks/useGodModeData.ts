
import { useMemo } from 'react';
import { GameState, GodModeData, ResourceType, ProductType } from '../types';

export const useGodModeData = (gameState: GameState): GodModeData => {
  return useMemo<GodModeData>(() => {
    // 1. 基尼系数计算 (财富不平等)
    const wealths = gameState.population.residents.map(r => r.wealth + r.cash).sort((a, b) => a - b);
    const n = wealths.length;
    let numerator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i + 1) * wealths[i];
    }
    const totalWealth = wealths.reduce((a, b) => a + b, 0) || 1;
    // 简化的基尼公式
    const gini = (2 * numerator) / (n * totalWealth) - (n + 1) / n;

    // 2. 最赚钱的行业分析
    const grainProfit = gameState.companies
        .filter(c => c.productionLines.some(l => l.type === ResourceType.GRAIN))
        .reduce((acc, c) => acc + c.lastProfit, 0);
    const breadProfit = gameState.companies
        .filter(c => c.productionLines.some(l => l.type === ProductType.BREAD))
        .reduce((acc, c) => acc + c.lastProfit, 0);

    // 3. 供需缺口计算
    // Gap = 需求 (Demand) - 实际销量 (Sales)
    // 如果 Gap > 0，说明供不应求； Gap <= 0 说明供过于求或刚好平衡
    const gaps = {
        [ResourceType.GRAIN]: gameState.resources[ResourceType.GRAIN].demand - gameState.resources[ResourceType.GRAIN].dailySales,
        [ProductType.BREAD]: gameState.products[ProductType.BREAD].demand - gameState.products[ProductType.BREAD].dailySales
    };

    return {
      supplyDemandGap: gaps,
      mostProfitableIndustry: grainProfit > breadProfit ? "农业 (Grain)" : "食品加工 (Bread)",
      laborShortage: gameState.companies.some(c => c.targetEmployees > c.employees && c.wageOffer > gameState.population.averageWage * 1.2),
      affordabilityIndex: parseFloat(gini.toFixed(3)) // 复用此字段显示基尼系数
    };
  }, [
      // 依赖项：仅当以下数据变化时重新计算
      gameState.day, // 每天计算一次即可，不用每次渲染都算，除非是实时Tick
      gameState.population.residents,
      gameState.companies,
      gameState.resources,
      gameState.products
  ]);
};
