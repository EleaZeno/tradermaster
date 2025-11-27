
import { GameState, GodModeData, ResourceType, ProductType } from "../shared/types";

const ADVICE_TEMPLATES = {
  CRISIS_FAMINE: [
    "警告：全市粮食储备已跌破警戒线！饥饿将导致暴动，请立即补贴农业或进口粮食。",
    "市场上的粮食正在枯竭。如果不能提高产量，由于需求缺乏弹性，粮价将呈指数级暴涨。",
  ],
  CRISIS_POVERTY: [
    "基尼系数过高（{{gini}}）。由于底层购买力不足，即便工厂生产出面包也卖不出去，这将导致滞胀。",
    "由于工资过低，工人们买不起自己生产的面包。建议提高最低工资以刺激内需。",
  ],
  OPPORTUNITY_ARBITRAGE: [
    "注意：{{product}} 的价格与其原材料成本出现了严重倒挂，利润率高达 {{margin}}%。现在是扩产的好时机。",
    "{{product}} 目前处于卖方市场，供需缺口为 {{gap}}。您可以尝试提高定价。",
  ],
  COMPANY_TROUBLE: [
    "您的公司 {{company}} 现金流吃紧（仅剩 {{cash}} oz）。建议停止分红，并考虑裁员或变卖库存。",
    "{{company}} 的库存积压严重（{{stock}} 单位）。您现在的定价策略可能过于激进，建议打折促销回笼资金。",
  ],
  GENERAL_BULL: [
    "宏观经济欣欣向荣，平均工资上涨带动了消费。建议在此期间加大杠杆投资。",
    "市场情绪高涨，资金正在涌入股市。这是 IPO 或增发股票的好机会。",
  ]
};

const NEWS_EVENTS = [
    { headline: "遭遇旱灾", description: "由于持续的高温干旱，全谷的粮食产量预计将下降 30%。", impactType: "BAD", target: ResourceType.GRAIN, modifier: -0.3 },
    { headline: "大丰收", description: "风调雨顺，今年每亩土地的产出提高了 20%。", impactType: "GOOD", target: ResourceType.GRAIN, modifier: 0.2 },
    { headline: "酵母菌改良", description: "食品厂引入了新型发酵技术，面包生产效率大幅提升。", impactType: "GOOD", target: ProductType.BREAD, modifier: 0.25 },
    { headline: "食品安全丑闻", description: "某批次面包被发现发霉，导致居民对加工食品的需求暂时下降。", impactType: "BAD", target: ProductType.BREAD, modifier: -0.4 },
    { headline: "工会运动", description: "工人阶级联合起来要求更高的待遇，所有企业的工资压力上升。", impactType: "NEUTRAL", target: "WAGE", modifier: 0.15 },
];

export const getFinancialAdvisorResponse = async (
  userMessage: string, 
  gameState: GameState,
  godModeData: GodModeData,
  chatHistory: {role: string, text: string}[]
): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const msg = userMessage.toLowerCase();
  
  const grainMarket = gameState.market[ResourceType.GRAIN];
  // Fix: Order uses quantity/remainingQuantity now, not amount/filled
  const grainStock = grainMarket ? grainMarket.asks.reduce((acc, order) => acc + (order.remainingQuantity), 0) : 0;
  
  if (grainStock < 20) return pickTemplate(ADVICE_TEMPLATES.CRISIS_FAMINE, {});

  if (godModeData.affordabilityIndex > 0.45) {
      return pickTemplate(ADVICE_TEMPLATES.CRISIS_POVERTY, { gini: godModeData.affordabilityIndex.toFixed(2) });
  }

  const playerCompany = gameState.companies.find(c => c.isPlayerFounded);
  if (playerCompany) {
      if (playerCompany.cash < 50) {
          return pickTemplate(ADVICE_TEMPLATES.COMPANY_TROUBLE, { company: playerCompany.name, cash: playerCompany.cash.toFixed(0) });
      }
      const stock = Object.values(playerCompany.inventory.finished).reduce((a,b)=>a+(Number(b)||0), 0);
      if (stock > 50) {
          return pickTemplate(ADVICE_TEMPLATES.COMPANY_TROUBLE, { company: playerCompany.name, stock: stock.toFixed(0) });
      }
  }

  if (msg.includes("赚") || msg.includes("利润") || msg.includes("投资")) {
      return `当前最赚钱的行业是【${godModeData.mostProfitableIndustry}】。请关注其 P/E 值和供需缺口。`;
  }

  if (msg.includes("股票")) {
      return "股价短期由供需决定，长期由分红能力决定。如果您看到某家公司市盈率(PE)低于 5，那是被严重低估的资产。";
  }

  if (msg.includes("缺") || msg.includes("需求")) {
     const grainGap = godModeData.supplyDemandGap[ResourceType.GRAIN];
     const breadGap = godModeData.supplyDemandGap[ProductType.BREAD];
     return `目前市场缺口：粮食缺 ${grainGap > 0 ? grainGap.toFixed(0) : 0}，面包缺 ${breadGap > 0 ? breadGap.toFixed(0) : 0}。`;
  }

  const grainGap = godModeData.supplyDemandGap[ResourceType.GRAIN];
  if (grainGap > 10) {
      return pickTemplate(ADVICE_TEMPLATES.OPPORTUNITY_ARBITRAGE, { product: "粮食", margin: "30", gap: grainGap.toFixed(0) });
  }
  
  return pickTemplate(ADVICE_TEMPLATES.GENERAL_BULL, {});
};

const pickTemplate = (templates: string[], data: Record<string, string>) => {
    let text = templates[Math.floor(Math.random() * templates.length)];
    Object.entries(data).forEach(([key, val]) => {
        text = text.replace(`{{${key}}}`, val);
    });
    return text;
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