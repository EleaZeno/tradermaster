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
    const gaps = {
        [ResourceType.GRAIN]: gameState.resources[ResourceType.GRAIN].demand - gameState.resources[ResourceType.GRAIN].dailySales,
        [ProductType.BREAD]: gameState.products[ProductType.BREAD].demand - gameState.products[ProductType.BREAD].dailySales
    };

    return {
      supplyDemandGap: gaps,
      mostProfitableIndustry: grainProfit > breadProfit ? "农业 (Grain)" : "食品加工 (Bread)",
      laborShortage: gameState.companies.some(c => c.targetEmployees > c.employees && c.wageOffer > gameState.population.averageWage * 1.2),
      affordabilityIndex: parseFloat(gini.toFixed(3)) 
    };
  }, [
      gameState.day,
      gameState.population.residents,
      gameState.companies,
      gameState.resources,
      gameState.products
  ]);
};