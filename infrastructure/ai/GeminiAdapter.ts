
import { GoogleGenAI } from "@google/genai";
import { GameState, GodModeData, ResourceType, ProductType, Company, NewsEvent } from "../../shared/types";
import { EconomicHealthSnapshot } from "../../domain/analytics/HealthCheckService";

const NEWS_EVENTS = [
    { headline: "遭遇旱灾", description: "由于持续的高温干旱，全谷的粮食产量预计将下降 30%。", impactType: "BAD", target: ResourceType.GRAIN, modifier: -0.3 },
    { headline: "大丰收", description: "风调雨顺，今年每亩土地的产出提高了 20%。", impactType: "GOOD", target: ResourceType.GRAIN, modifier: 0.2 },
    { headline: "酵母菌改良", description: "食品厂引入了新型发酵技术，面包生产效率大幅提升。", impactType: "GOOD", target: ProductType.BREAD, modifier: 0.25 },
    { headline: "食品安全丑闻", description: "某批次面包被发现发霉，导致居民对加工食品的需求暂时下降。", impactType: "BAD", target: ProductType.BREAD, modifier: -0.4 },
    { headline: "工会运动", description: "工人阶级联合起来要求更高的待遇，所有企业的工资压力上升。", impactType: "NEUTRAL", target: "WAGE", modifier: 0.15 },
];

const getEconomicSummary = (gameState: GameState, godModeData: GodModeData) => {
    const getSupply = (itemId: string) => {
        const book = gameState.market[itemId];
        return book ? book.asks.reduce((s, o) => s + (o.remainingQuantity), 0) : 0;
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

export const getFinancialAdvisorResponseStream = async (
  userMessage: string, 
  gameState: GameState,
  godModeData: GodModeData,
  chatHistory: {role: string, text: string}[],
  onChunk: (text: string) => void
): Promise<void> => {
  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summary = getEconomicSummary(gameState, godModeData);
      const lang = gameState.settings.language;
      
      const systemInstruction = `
      You are Alpha, the AI Chief Economist of Eden Valley.
      You are a smart, slightly cynical, but highly professional economist.
      
      Your goal is to answer user questions about the economy using the provided JSON data.
      
      Guidelines:
      1. If companies are losing money, check if wages are too high compared to profit.
      2. If prices are high, check inventory shortage.
      3. Keep answers concise (under 100 words).
      4. Use Markdown for emphasis.
      5. Respond in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.
      `;

      const prompt = `
      Current Economic State (JSON): ${JSON.stringify(summary)}
      
      User Question: "${userMessage}"
      `;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
        }
      });

      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
              onChunk(text);
          }
      }

  } catch (error) {
      console.error("Gemini API Error:", error);
      onChunk("System Offline: Unable to contact neural network.");
  }
};

export const getFinancialAdvisorResponse = async (
    userMessage: string, 
    gameState: GameState,
    godModeData: GodModeData,
    chatHistory: {role: string, text: string}[]
): Promise<string> => {
    let fullText = "";
    await getFinancialAdvisorResponseStream(userMessage, gameState, godModeData, chatHistory, (text) => {
        fullText += text;
    });
    return fullText;
}

export const analyzeCompany = async (company: Company, gameState: GameState): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const lang = gameState.settings.language;
        
        const data = {
            name: company.name,
            price: company.sharePrice,
            cash: company.cash,
            employees: company.employees,
            profit: company.lastProfit,
            inventory: company.inventory,
            tobinQ: company.tobinQ,
            marketAvgWage: gameState.population.averageWage,
            companyWage: company.wageOffer,
            history: company.history.slice(-5) 
        };

        const systemInstruction = `
        You are a ruthless Wall Street Analyst.
        Your job is to provide a "Buy", "Hold", or "Sell" rating for a company based on its financial data.
        
        Output Format:
        - Rating: [Buy/Hold/Sell]
        - 3 Bullet points explaining why (Focus on Liquidity, Efficiency, Valuation).
        - Respond in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}. Use Markdown.
        `;

        const prompt = `Analyze this company data: ${JSON.stringify(data)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction
            }
        });

        return response.text || "Insufficient Data.";
    } catch (error) {
        return "Analysis service unavailable.";
    }
}

export const auditEconomy = async (snapshot: EconomicHealthSnapshot): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Default to Chinese as this function doesn't easily access state without passing it,
        // but typically this app is set to Chinese default. 
        // For robustness, assume Chinese unless otherwise instructed.
        
        const systemInstruction = `
        You are an Economic Simulation Auditor/Doctor.
        Your task is to diagnose the health, logic, and stability of a simulated economy.
        
        Analyze for:
        1. Logical Contradictions (e.g., Supply < Demand but Price Falling?)
        2. Structural Imbalances (e.g., Money Supply exploding vs Flat GDP?)
        3. Pathological Dynamics (Deflationary spiral, Liquidity trap)
        
        Style: Professional, Analytical, Constructive.
        Respond in Chinese (Simplified).
        `;

        const prompt = `
        INPUT DATA (JSON):
        ${JSON.stringify(snapshot, null, 2)}

        Provide a diagnosis report in Markdown:
        ## 🏥 经济诊断报告 (Day ${snapshot.timestamp})
        ### 1. 核心体征
        ### 2. 异常检测 (Critical Alerts)
        ### 3. 结构性分析 (Market Efficiency, Labor, Finance)
        ### 4. 修复/调优建议
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction
            }
        });

        return response.text || "诊断服务无响应。";
    } catch (error) {
        return "诊断连接失败。";
    }
}

export const generateMarketEvent = async (currentDay: number): Promise<NewsEvent | null> => {
    if (Math.random() > 0.1) return null;

    const eventTemplate = NEWS_EVENTS[Math.floor(Math.random() * NEWS_EVENTS.length)];
    
    return {
        type: 'NEWS',
        headline: eventTemplate.headline,
        description: eventTemplate.description,
        impactType: eventTemplate.impactType as any,
        turnCreated: currentDay,
        effect: { target: eventTemplate.target, modifier: eventTemplate.modifier }
    };
};
