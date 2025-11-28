
import { GameState, ProductType, ResourceType, GDPFlowAccumulator } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/config';

export class DemographicsService {
  static process(gameState: GameState, gdpFlow: GDPFlowAccumulator): void {
      DemographicsService.updateSentiment(gameState, gdpFlow);
      DemographicsService.processMigration(gameState);
      DemographicsService.processSocialMobility(gameState);
  }

  private static updateSentiment(state: GameState, gdpFlow: GDPFlowAccumulator) {
    const history = state.macroHistory;
    if (history.length < 2) return;
    
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    
    // Real time growth check (using flow accumulator vs previous tick's recorded GDP)
    // Note: gdpFlow is for the CURRENT tick. 
    const currentGdp = gdpFlow.C + gdpFlow.I + gdpFlow.G;
    const prevGdp = last.gdp || 1;
    
    // Simple momentum indicators
    const inflation = last.inflation;
    const unemployment = last.unemployment;
    
    // Sentiment Model:
    // Base 50
    // Growth adds to sentiment
    // Inflation hurts sentiment (heavily)
    // Unemployment hurts sentiment
    const growthComponent = (currentGdp - prevGdp) / prevGdp * 100;
    
    let sentiment = 50 + (growthComponent * 2) - (inflation * 200) - (unemployment * 100);
    sentiment = Math.max(0, Math.min(100, sentiment));
    
    state.population.consumerSentiment = parseFloat(sentiment.toFixed(1));
    
    // Update Residents' Propensity to Consume based on Sentiment
    // High Sentiment -> High Spending, Low Savings
    // Low Sentiment -> High Savings (Precautionary)
    state.population.residents.forEach(r => {
        const base = 0.8;
        const sentimentFactor = (sentiment - 50) / 200; // +/- 0.25 range
        r.propensityToConsume = Math.max(0.1, Math.min(1.0, base + sentimentFactor));
        
        // Also update preference for savings
        if (r.preferenceWeights) {
            // If sentiment is low, savings weight goes up
            r.preferenceWeights.savings = Math.max(0.05, 1.0 - r.propensityToConsume);
        }
    });
  }

  private static processMigration(state: GameState) {
    if (state.day % 30 !== 0) return; // Monthly check

    const pop = state.population;
    const multiplier = state.policyOverrides.migrationRate;
    
    // Immigration
    if (pop.averageHappiness > (80 / Math.max(0.1, multiplier)) && pop.total < 150) {
        const id = `res_imm_${state.day}_${Math.random().toString(36).substr(2,4)}`;
        state.logs.unshift(`👶 新移民加入: 社区迎来了一位新成员`);
        state.population.residents.push({
            id, name: `移民 ${state.day}`, age: 20, isPlayer: false,
            wealth: 10, cash: 10, job: 'UNEMPLOYED', salary: 0,
            skill: 'NOVICE', xp: 0,
            influence: 0, intelligence: 50 + Math.random()*30, leadership: 10,
            politicalStance: 'CENTRIST', happiness: 70, inventory: {}, portfolio: {}, futuresPositions: [],
            livingStandard: 'SURVIVAL', timePreference: 0.5, needs: {}, landTokens: 0,
            reservationWage: 1.0, propensityToConsume: 0.9,
            preferenceWeights: { [ProductType.BREAD]: 0.6, [ResourceType.GRAIN]: 0.3, savings: 0.1 }
        });
        pop.total++;
        pop.demographics.immigration++;
    }

    // Emigration / Death
    const deathThreshold = 30 * Math.min(1, 1/multiplier);
    if (pop.averageHappiness < deathThreshold && pop.total > 10) {
        const unhappy = pop.residents.filter(r => !r.isPlayer && r.happiness < 20);
        if (unhappy.length > 0) {
            const leaver = unhappy[0];
            state.population.residents = state.population.residents.filter(r => r.id !== leaver.id);
            pop.total--;
            pop.demographics.deaths++;
            state.logs.unshift(`🏃 ${leaver.name} 因生活困苦离开了山谷`);
        }
    }
  }

  private static processSocialMobility(gameState: GameState): void {
    const WEALTH_THRESHOLD = 350; 
    const POVERTY_LINE = 20; 

    gameState.population.residents.forEach(resident => {
        if (resident.isPlayer || ['MAYOR', 'DEPUTY_MAYOR', 'EXECUTIVE', 'UNION_LEADER'].includes(resident.job)) return;

        // Upward Mobility
        if (resident.cash > WEALTH_THRESHOLD && (resident.job === 'FARMER' || resident.job === 'WORKER')) {
            if (resident.job === 'WORKER' && resident.employerId) {
                 const company = gameState.companies.find(c => c.id === resident.employerId);
                 if (company) company.employees--;
            }
            
            resident.job = 'FINANCIER';
            resident.employerId = undefined;
            resident.livingStandard = 'LUXURY'; 
            gameState.logs.unshift(`👔 ${resident.name} 积累了巨额财富，决定退休成为全职投资人。`);
        }

        // Downward Mobility
        if (resident.cash < POVERTY_LINE && resident.job === 'FINANCIER') {
            resident.job = 'FARMER';
            resident.livingStandard = 'SURVIVAL'; 
            gameState.logs.unshift(`🚜 ${resident.name} 投资破产，被迫重新下地务农。`);
        }
    });
    
    gameState.population.financiers = gameState.population.residents.filter(r => r.job === 'FINANCIER').length;
    gameState.population.farmers = gameState.population.residents.filter(r => r.job === 'FARMER').length;
  }
}
