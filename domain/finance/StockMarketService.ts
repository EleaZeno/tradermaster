
import { GameState } from '../../shared/types';

export class StockMarketService {
  static processStockMarket(state: GameState): void {
      state.companies.forEach(comp => {
        if (comp.isBankrupt) {
          comp.sharePrice = Math.max(0.01, comp.sharePrice * 0.95);
          return;
        }

        const eps = comp.lastProfit / comp.totalShares;
        const bookValue = comp.cash / comp.totalShares; 
        
        let targetPE = 15;
        if (comp.stage === 'STARTUP') targetPE = 30;
        if (comp.stage === 'GROWTH') targetPE = 25;
        if (comp.stage === 'DECLINE') targetPE = 8;
        
        let valPE = eps > 0 ? eps * targetPE : 0;

        let targetPB = 1.5;
        if (comp.stage === 'MATURITY') targetPB = 2.0;
        let valPB = bookValue * targetPB;

        const riskFree = state.bank.yieldCurve.rate365d * 365; 
        const growthRate = comp.stage === 'GROWTH' ? 0.1 : 0.02;
        const discountRate = riskFree + 0.05; 
        
        let valDCF = 0;
        if (comp.lastProfit > 0) {
             const projectedCF = comp.lastProfit * (1 + growthRate);
             valDCF = (projectedCF / (discountRate - growthRate)) / comp.totalShares;
             valDCF = Math.min(valDCF, valPE * 3);
        }

        let targetPrice = 0;
        if (eps > 0) {
            targetPrice = (valPE * 0.4) + (valPB * 0.2) + (valDCF * 0.4);
        } else {
            targetPrice = valPB; 
        }
        
        const sentimentMod = state.population.consumerSentiment / 50; 
        targetPrice *= sentimentMod;

        const smoothedPrice = (comp.sharePrice * 0.9) + (targetPrice * 0.1);
        const noise = 1 + (Math.random() - 0.5) * 0.05;
        let finalPrice = smoothedPrice * noise;
        
        finalPrice = Math.max(0.1, finalPrice);
        
        const open = comp.sharePrice;
        const close = parseFloat(finalPrice.toFixed(2));
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        const volume = Math.floor(comp.monthlySalesVolume * (1 + Math.random()));

        comp.sharePrice = close;
        comp.history.push({ day: state.day, open, high, low, close, volume });
        if (comp.history.length > 60) comp.history.shift();
      });
  }
}
