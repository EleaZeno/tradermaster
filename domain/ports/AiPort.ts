
import { GameState, GodModeData, Company, EconomicHealthSnapshot, NewsEvent } from '../../shared/types';

export interface AiPort {
  getFinancialAdvisorResponse(
    userMessage: string,
    gameState: GameState,
    godModeData: GodModeData,
    chatHistory: {role: string, text: string}[]
  ): Promise<string>;

  getFinancialAdvisorResponseStream(
    userMessage: string,
    gameState: GameState,
    godModeData: GodModeData,
    chatHistory: {role: string, text: string}[],
    onChunk: (text: string) => void
  ): Promise<void>;

  analyzeCompany(company: Company, gameState: GameState): Promise<string>;
  
  auditEconomy(snapshot: EconomicHealthSnapshot): Promise<string>;
  
  generateMarketEvent(currentDay: number): Promise<NewsEvent | null>;
}
