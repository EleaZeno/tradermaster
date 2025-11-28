
import { GameState } from '../../shared/types';

export class PlayerService {
  static updateStatus(gameState: GameState): void {
    const player = gameState.population.residents.find(resident => resident.isPlayer);
    
    // Sync GameState cash with Resident Entity Cash
    if (player) {
        gameState.cash = player.cash;
        player.wealth = player.cash; 
        
        // Calculate total wealth (Cash + Portfolio + Land)
        let portfolioValue = 0;
        Object.entries(player.portfolio).forEach(([compId, shares]) => {
            const comp = gameState.companies.find(c => c.id === compId);
            if (comp) portfolioValue += Math.abs(shares) * comp.sharePrice;
        });
        player.wealth += portfolioValue;
    }

    // Update Global Statistics
    if (gameState.companies.length > 0) {
        const totalWages = gameState.companies.reduce((sum, company) => sum + company.wageOffer, 0);
        gameState.population.averageWage = totalWages / gameState.companies.length;
    } else {
        gameState.population.averageWage = 1.5;
    }
  }
}
