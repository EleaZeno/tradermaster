
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
            
            // Mark-to-Market (Daily PnL Check for Margin Call)
            // Simplified: We don't deduct daily unless closed, but we check for liquidation
            const entryVal = contract.entryPrice * contract.amount;
            const currentVal = currentPrice * contract.amount;
            
            let unrealizedPnL = 0;
            if (contract.type === 'LONG') unrealizedPnL = currentVal - entryVal;
            else unrealizedPnL = entryVal - currentVal;

            // Liquidation Logic (Margin Call)
            // If loss exceeds cash buffer (simplified maintenance margin)
            if (player.cash + unrealizedPnL < 0) {
                state.logs.unshift(`💥 期货爆仓: ${contract.resourceId} ${contract.type} (强制平仓)`);
                // Realize the loss
                player.cash += unrealizedPnL; 
                return; // Contract removed
            }

            if (isExpired) {
                // Settlement
                player.cash += unrealizedPnL;
                state.logs.unshift(`📜 期货交割: ${contract.resourceId} ${contract.type} 盈亏: ${unrealizedPnL.toFixed(2)} oz`);
            } else {
                keptPositions.push(contract);
                activeContracts.push(contract); // Global registry
            }
        });

        player.futuresPositions = keptPositions;
    }

    state.futures = activeContracts;
  }
}
