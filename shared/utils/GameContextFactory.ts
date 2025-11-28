
import { GameState, GameContext, Resident } from '../types';

export class GameContextFactory {
  /**
   * Builds the full game context with all O(1) lookup maps.
   * Expensive operation: O(N) where N is population + companies.
   */
  static build(gameState: GameState): GameContext {
    const residentMap = new Map<string, Resident>();
    const companyMap = new Map(gameState.companies.map(c => [c.id, c]));
    const employeesByCompany: Record<string, Resident[]> = {};
    const residentsByJob: Record<string, Resident[]> = {};

    // Single pass through population to build all indices
    gameState.population.residents.forEach(r => {
      residentMap.set(r.id, r);
      
      // Index by Employer
      if (r.employerId) {
        if (!employeesByCompany[r.employerId]) employeesByCompany[r.employerId] = [];
        employeesByCompany[r.employerId].push(r);
      }
      
      // Index by Job
      if (!residentsByJob[r.job]) residentsByJob[r.job] = [];
      residentsByJob[r.job].push(r);
    });

    return { residentMap, companyMap, employeesByCompany, residentsByJob };
  }

  /**
   * Builds a lightweight context when full indices aren't needed.
   * Useful for high-frequency ticks (e.g. just Market matching).
   */
  static buildLite(gameState: GameState): GameContext {
    const residentMap = new Map(gameState.population.residents.map(r => [r.id, r]));
    const companyMap = new Map(gameState.companies.map(c => [c.id, c]));
    return { 
        residentMap, 
        companyMap, 
        employeesByCompany: {}, 
        residentsByJob: {} 
    };
  }
}
