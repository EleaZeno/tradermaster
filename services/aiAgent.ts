import { GameState, GodModeData } from "../shared/types";

const ADVISOR_PROMPTS = {
  SYSTEM: `You are Alpha, a high-level economic advisor AI in a simulated economy called Eden Valley.
  Your goal is to explain complex economic phenomena (supply/demand, inflation, stock valuation) in simple terms.
  Analyze the user's question based on the provided Game State.
  Be concise, professional, but slightly witty.`,
  
  TEMPLATES: [
    "从数据来看，供需关系是价格波动的核心。",
    "如果一家公司持续亏损，关注它的库存是否积压。",
    "劳动力是宝贵的资源，工资上涨意味着经济繁荣。",
    "作为AI董事，我建议你关注现金流健康度。",
    "不要把鸡蛋放在一个篮子里，ETF是不错的选择。",
    "粮食是经济的基石，如果缺粮，一切都会崩溃。"
  ]
};

export const getFinancialAdvisorResponse = async (
  userMessage: string, 
  gameState: GameState,
  godModeData: GodModeData,
  chatHistory: {role: string, text: string}[]
) => {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes("亏损") || msg.includes("赔钱")) {
    return "如果公司亏损，请检查'进销存'面板。通常是因为原材料太贵，或者生产出来的商品卖不出去（库存积压）。您可以尝试裁员或降薪来度过难关。";
  }
  if (msg.includes("野果") || msg.includes("粮食") || msg.includes("食物")) {
    const grainBook = gameState.market['GRAIN'];
    const stock = grainBook ? grainBook.asks.reduce((acc, order) => acc + (order.amount - order.filled), 0) : 0;
    return `当前的粮食市场供应量为 ${Math.floor(stock)}。如果库存持续下降，建议投资'伊甸农业'或'伊甸食品'来扩大生产。`;
  }
  if (msg.includes("股票") || msg.includes("股价")) {
    return "股价反映了未来的盈利预期。如果公司连续盈利且分红，散户会蜂拥买入，推高股价。反之亦然。";
  }
  
  return ADVISOR_PROMPTS.TEMPLATES[Math.floor(Math.random() * ADVISOR_PROMPTS.TEMPLATES.length)];
};