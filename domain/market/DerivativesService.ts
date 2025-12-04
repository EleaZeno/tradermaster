
import { GameState, FuturesContract, ResourceType } from '../../shared/types';
import { ECO_CONSTANTS } from '../../shared/config';

export class DerivativesService {
  static process(state: GameState): void {
    const activeContracts: FuturesContract[] = [];
    
    // Process Player Futures
    const player = state.population.residents.find(r => r.isPlayer);
    if (player) {
        const keptPositions: FuturesContract[] = [];
        
        player.futuresPositions.forEach(contract => {
            const isExpired = state.day >= contract.dueDate;
            const currentPrice = state.resources[contract.resourceId]?.currentPrice || 1.0;
            const initialMargin = contract.entryPrice * contract.amount * 0.2; // 20% margin assumed
            
            // Mark-to-Market
            const entryVal = contract.entryPrice * contract.amount;
            const currentVal = currentPrice * contract.amount;
            
            let unrealizedPnL = 0;
            if (contract.type === 'LONG') unrealizedPnL = currentVal - entryVal;
            else unrealizedPnL = entryVal - currentVal;

            // Liquidation Logic (Margin Call)
            // If Loss > Margin, or Cash < Loss (simplified)
            // Actually, exchange liquidates if Equity < Maintenance Margin.
            // Equity = Margin + PnL.
            const equity = initialMargin + unrealizedPnL;
            
            if (equity <= 0) {
                state.logs.unshift(`💥 期货爆仓: ${contract.resourceId} ${contract.type} (强制平仓)`);
                // Margin is lost to Treasury (which holds it). No refund.
                // PnL beyond margin? Player owes debt? For simplicity, we stop at 0 equity.
                // Treasury keeps the margin. No further transfer needed as Treasury already has margin.
                return; 
            }

            if (isExpired) {
                // Settlement: Return Margin + PnL
                const settlementAmount = initialMargin + unrealizedPnL;
                
                player.cash += settlementAmount;
                state.cityTreasury.cash -= settlementAmount;

                state.logs.unshift(`📜 期货交割: ${contract.resourceId} ${contract.type} 盈亏: ${unrealizedPnL.toFixed(2)} oz`);
            } else {
                keptPositions.push(contract);
                activeContracts.push(contract);
            }
        });

        player.futuresPositions = keptPositions;
    }

    state.futures = activeContracts;
  }
}
