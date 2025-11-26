
import { GoogleGenAI } from "@google/genai";
import { GameState, GodModeData, ResourceType, ProductType } from "../shared/types";

const NEWS_EVENTS = [
    { headline: "遭遇旱灾", description: "由于持续的高温干旱，全谷的粮食产量预计将下降 30%。", impactType: "BAD", target: ResourceType.GRAIN, modifier: -0.3 },
    { headline: "大丰收", description: "风调雨顺，今年每亩土地的产出提高了 20%。", impactType: "GOOD", target: ResourceType.GRAIN, modifier: 0.2 },
    { headline: "酵母菌改良", description: "食品厂引入了新型发酵技术，面包生产效率大幅提升。", impactType: "GOOD", target: ProductType.BREAD, modifier: 0.25 },
    { headline: "食品安全丑闻", description: "某批次面包被发现发霉，导致居民对加工食品的需求暂时下降。", impactType: "BAD", target: ProductType.BREAD, modifier: -0.4 },
    { headline: "工会运动", description: "工人阶级联合起来要求更高的待遇，所有企业的工资压力上升。", impactType: "NEUTRAL", target: "WAGE", modifier: 0.15 },
];

const getEconomicSummary = (gameState: GameState, godModeData: GodModeData) => {
    // Helper to get total size from OrderBook Asks
    const getSupply = (itemId: string) => {
        const book = gameState.market[itemId];
        return book ? book.asks.reduce((s, o) => s + (o.amount - o.filled), 0) : 0;
    };

    return {
        day: gameState.day,
        prices: {
            grain: gameState.resources[ResourceType.GRAIN].currentPrice,
            bread: gameState.products[ProductType.BREAD].marketPrice,
        },
        inventory: {
            grain: getSupply(ResourceType.GRAIN),
            bread: getSupply(ProductType.BREAD),
        },
        companies: gameState.companies.map(c => ({
            name: c.name,
            cash: Math.floor(c.cash),
            profit: Math.floor(c.lastProfit),
            wage: c.wageOffer,
            employees: c.employees,
            bankrupt: c.isBankrupt
        })),
        macro: {
            avgWage: gameState.population.averageWage.toFixed(2),
            gini: godModeData.affordabilityIndex.toFixed(2),
            mostProfitable: godModeData.mostProfitableIndustry,
            treasury: Math.floor(gameState.cityTreasury.cash),
            fiscal: gameState.cityTreasury.fiscalStatus
        },
        gaps: godModeData.supplyDemandGap
    };
};

export const getFinancialAdvisorResponse = async (
  userMessage: string, 
  gameState: GameState,
  godModeData: GodModeData,
  chatHistory: {role: string, text: string}[]
): Promise<string> => {
  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summary = getEconomicSummary(gameState, godModeData);
      
      const prompt = `
      You are Alpha, the AI Chief Economist of Eden Valley.
      Current Economic State (JSON): ${JSON.stringify(summary)}

      User Question: "${userMessage}"

      Instructions:
      1. Analyze the JSON data to answer the user. 
      2. If companies are losing money, check if wages are too high compared to profit.
      3. If prices are high, check the inventory shortage.
      4. Keep your answer concise (under 100 words) and roleplay as a smart, slightly cynical economist.
      5. Use Markdown for emphasis.
      6. Respond in Chinese.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text || "AI 暂时无法连接，请检查网络设置。";
  } catch (error) {
      console.error("Gemini API Error:", error);
      return "系统离线：无法连接到 Gemini 神经网络。请确保 API KEY 配置正确。";
  }
};

export const generateMarketEvent = async (currentDay: number): Promise<{headline: string, description: string, impactType: 'GOOD'|'BAD'|'NEUTRAL', turnCreated: number, effect?: any} | null> => {
    if (Math.random() > 0.1) return null;

    const eventTemplate = NEWS_EVENTS[Math.floor(Math.random() * NEWS_EVENTS.length)];
    
    return {
        headline: eventTemplate.headline,
        description: eventTemplate.description,
        impactType: eventTemplate.impactType as any,
        turnCreated: currentDay,
        effect: { target: eventTemplate.target, modifier: eventTemplate.modifier }
    };
};
