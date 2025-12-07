
import { GoogleGenAI } from "@google/genai";
import { GameState, GodModeData, ResourceType, ProductType, Company, NewsEvent, EconomicHealthSnapshot } from "../../shared/types";
import { AiPort } from "../../domain/ports/AiPort";

const NEWS_EVENTS = [
    { headline: "遭遇旱灾", description: "由于持续的高温干旱，全谷的粮食产量预计将下降 30%。", impactType: "BAD", target: ResourceType.GRAIN, modifier: -0.3 },
    { headline: "大丰收", description: "风调雨顺，今年每亩土地的产出提高了 20%。", impactType: "GOOD", target: ResourceType.GRAIN, modifier: 0.2 },
    { headline: "酵母菌改良", description: "食品厂引入了新型发酵技术，面包生产效率大幅提升。", impactType: "GOOD", target: ProductType.BREAD, modifier: 0.25 },
    { headline: "食品安全丑闻", description: "某批次面包被发现发霉，导致居民对加工食品的需求暂时下降。", impactType: "BAD", target: ProductType.BREAD, modifier: -0.4 },
    { headline: "工会运动", description: "工人阶级联合起来要求更高的待遇，所有企业的工资压力上升。", impactType: "NEUTRAL", target: "WAGE", modifier: 0.15 },
];

const CODEBASE_MAP = `
## 🗺️ Codebase Architecture Map (v3.3 Physics Engine)
- **Orchestrator**: \`application/GameLoop.ts\` (Main Tick Loop, Profiling)
- **Market/LOB**: \`domain/market/MarketService.ts\` (Matching Engine, Order Book, AssetLocker)
- **Derivatives**: \`domain/market/DerivativesService.ts\` (Futures, Margin Calls, Liquidation)
- **Banking**: \`domain/finance/BankingService.ts\` (Monetary Policy strategies, Credit Creation, M2)
- **Stocks**: \`domain/finance/StockMarketService.ts\` (Valuation models, Dividend policies)
- **Labor**: \`domain/labor/LaborService.ts\` (Hiring/Firing logic, Sticky Wages, Union Tension)
- **Production**: \`domain/company/ProductionService.ts\` (Input/Output, Capital Depreciation, Spoilage)
- **Lifecycle**: \`domain/company/CompanyService.ts\` (Bankruptcy logic, Zombie detection, IPOs)
- **Consumption**: \`domain/consumer/ConsumerService.ts\` (Stone-Geary Utility, MPC, Precautionary Savings)
- **Demographics**: \`domain/demographics/DemographicsService.ts\` (Migration, Consumer Sentiment, Social Mobility)
- **Macro**: \`domain/macro/GDPService.ts\` & \`FiscalService.ts\` (GDP Accounting, Taxes, Bailouts, Fiscal Policy)
- **Analytics**: \`domain/analytics/HealthCheckService.ts\` & \`SanityCheckSystem.ts\` (Conservation of Money violations)
- **Land**: \`features/map/MapPanel.tsx\` (Land Plot logic)
`;

export class GeminiAdapter implements AiPort {
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    private getEconomicSummary(gameState: GameState, godModeData: GodModeData) {
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
    }

    async getFinancialAdvisorResponseStream(
        userMessage: string, 
        gameState: GameState,
        godModeData: GodModeData,
        chatHistory: {role: string, text: string}[],
        onChunk: (text: string) => void
    ): Promise<void> {
        try {
            const summary = this.getEconomicSummary(gameState, godModeData);
            const lang = gameState.settings.language;
            
            const systemInstruction = `
            You are Alpha, the AI Chief Economist of Eden Valley.
            You are cynical, data-driven, and slightly elitist. You care about efficiency and market equilibrium.
            
            Context Data (JSON) is provided about the current simulation state.
            
            Rules:
            1. Analyze the 'gaps' and 'macro' sections heavily.
            2. If 'fiscal' is 'AUSTERITY', complain about the mayor being cheap.
            3. If 'fiscal' is 'STIMULUS', warn about inflation.
            4. Keep answers under 80 words. Be punchy.
            5. Use Markdown bolding for key figures.
            6. Respond in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.
            `;

            const prompt = `
            Current Economic State: ${JSON.stringify(summary)}
            User Question: "${userMessage}"
            `;

            const responseStream = await this.client.models.generateContentStream({
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
            onChunk("⚠️ Connection Lost: The neural link to the Central Bank is down. Check your API Key.");
        }
    }

    async getFinancialAdvisorResponse(
        userMessage: string, 
        gameState: GameState,
        godModeData: GodModeData,
        chatHistory: {role: string, text: string}[]
    ): Promise<string> {
        let fullText = "";
        await this.getFinancialAdvisorResponseStream(userMessage, gameState, godModeData, chatHistory, (text) => {
            fullText += text;
        });
        return fullText;
    }

    async analyzeCompany(company: Company, gameState: GameState): Promise<string> {
        try {
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
            ### Rating: [Buy/Hold/Sell]
            *   **Reason 1**: ...
            *   **Reason 2**: ...
            *   **Reason 3**: ...
            
            Focus on Liquidity (Cash), Efficiency (Wage vs Profit), and Valuation (Tobin's Q).
            Respond in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}. Use Markdown.
            `;

            const prompt = `Analyze this company data: ${JSON.stringify(data)}`;

            const response = await this.client.models.generateContent({
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

    async auditEconomy(snapshot: EconomicHealthSnapshot): Promise<string> {
        try {
            const systemInstruction = `
            You are an Economic Simulation Auditor.
            Your task is to diagnose the health of a simulated economy.
            
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

            const response = await this.client.models.generateContent({
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

    async debugSimulation(context: string): Promise<string> {
        try {
            const systemInstruction = `
            You are a **Senior Economic Systems Engineer**. Your role is to analyze the internal state of an Agent-Based Model (ABM) to find bugs, logical deadlocks, or economic failures.

            ${CODEBASE_MAP}

            ### 🎯 Diagnosis Objectives:
            1.  **Forensic Audit**: Identify why M0 (Money Conservation) might be leaking (Check 'audit' field).
            2.  **Calibration Check (Stylized Facts)**: Review the \`stylizedFacts\` section. 
                - **Phillips Curve**: Should be Negative correlation. If Positive, stagflation or logic bug?
                - **Okun's Law**: Should be Negative. If Positive, productivity model is broken.
                - **QTM**: Money Supply should correlate with Inflation.
                - **Zipf**: Firm sizes should follow power law.
            3.  **Market Pathology**: Identify if Order Books are crossed (Bid >= Ask) or empty (Liquidity Crisis).
            4.  **Entity Logic**: Check for "Zombie" companies (Negative Cash but not Bankrupt) or "Starving" agents.
            5.  **Lifecycle**: Ensure bankrupt companies are not trading (Delisting check).

            ### 📝 Output Format (Markdown):
            
            ## 🛠️ System Diagnostic Report
            
            ### 🚨 Critical Anomalies (M0 & Logic)
            *List specific data violations (e.g., "M0 Mismatch of -50oz").*

            ### 📐 Stylized Facts Calibration
            *Analyze the \`stylizedFacts\` scores. Are they realistic?*
            - ✅ Phillips: [Score] (Interpretation)
            - ⚠️ Okun: [Score] (Interpretation)
            ...

            ### 📉 Economic Pathology
            *Analyze the flow of money/goods. Is there a bottleneck? Is inflation runaway? Check if Zombie Companies exist.*

            ### 🧩 Codebase Locality
            *Point to the likely file (from the Map) causing the issue.*
            - **Suspect**: \`path/to/file.ts\`
            - **Reasoning**: ...

            **Respond in Chinese (Simplified). Be technical and precise.**
            `;

            const prompt = `
            DEBUG CONTEXT (FULL STATE DUMP):
            ${context}
            `;

            const response = await this.client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    thinkingConfig: { thinkingBudget: 2048 } // Deep thinking for code path analysis
                }
            });

            return response.text || "Debug analysis failed.";
        } catch (error) {
            console.error(error);
            return "Debugger AI offline.";
        }
    }

    async generateMarketEvent(currentDay: number): Promise<NewsEvent | null> {
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
    }
}

export const aiService = new GeminiAdapter();
