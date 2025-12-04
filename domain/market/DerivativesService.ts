
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
            
            // Mark-to-Market
            const entryVal = contract.entryPrice * contract.amount;
            const currentVal = currentPrice * contract.amount;
            
            let unrealizedPnL = 0;
            if (contract.type === 'LONG') unrealizedPnL = currentVal - entryVal;
            else unrealizedPnL = entryVal - currentVal;

            // Liquidation Logic (Margin Call)
            if (player.cash + unrealizedPnL < 0) {
                state.logs.unshift(`💥 期货爆仓: ${contract.resourceId} ${contract.type} (强制平仓)`);
                // Loss Realized
                player.cash += unrealizedPnL; 
                state.cityTreasury.cash -= unrealizedPnL; // Treasury gains the lost margin/PnL (Counterparty)
                return; 
            }

            if (isExpired) {
                // Settlement
                player.cash += unrealizedPnL;
                
                // CONSERVATION OF MONEY:
                // If player wins (PnL > 0), Treasury pays.
                // If player loses (PnL < 0), Treasury gains.
                state.cityTreasury.cash -= unrealizedPnL;

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
