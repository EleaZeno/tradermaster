
import { GameState, IndustryType, ResourceType, ProductType, Company, Resident, Candle } from '../../types';
import { Transaction } from '../utils/Transaction';

interface SellOrder {
    sellerType: 'GATHERERS' | 'COMPANY';
    sellerId: string;
    price: number;
    available: number;
    ref: any;
}

export class MarketSystem {
  static buildOrderBook(state: GameState, itemType: IndustryType): SellOrder[] {
    const orders: SellOrder[] = [];
    
    // 1. 散户收集者 (GATHERERS)
    if (itemType === ResourceType.GRAIN && state.resources[ResourceType.GRAIN].marketInventory > 0.1) {
        orders.push({
            sellerType: 'GATHERERS', sellerId: 'market_gatherers',
            price: state.resources[ResourceType.GRAIN].currentPrice,
            available: state.resources[ResourceType.GRAIN].marketInventory,
            ref: state.resources[ResourceType.GRAIN]
        });
    }

    // 2. 公司 (COMPANIES)
    state.companies.forEach(c => {
        const stock = c.inventory.finished[itemType] || 0;
        if (!c.isBankrupt && stock > 0.1) {
            // 定价策略：成本 + 利润率 + 策略溢价
            const minPrice = Math.max(0.1, c.avgCost * 1.05);
            let ask = Math.max(0.1, c.avgCost * (1 + c.margin));
            ask = ask * (1 + (c.pricePremium || 0));
            
            orders.push({ 
                sellerType: 'COMPANY', sellerId: c.id, 
                price: Math.max(minPrice, ask), 
                available: stock, ref: c 
            });
        }
    });

    return orders.sort((a, b) => a.price - b.price);
  }

  static attemptPurchase(
      state: GameState, 
      buyer: Resident | Company | 'TREASURY', 
      itemType: IndustryType, 
      quantity: number = 1
  ): boolean {
      if (itemType === ResourceType.GRAIN) state.resources[ResourceType.GRAIN].demand += quantity;
      if (itemType === ProductType.BREAD) state.products[ProductType.BREAD].demand += quantity;

      const orders = MarketSystem.buildOrderBook(state, itemType);
      if (orders.length === 0) return false;

      const bestOrder = orders[0];
      const basePrice = bestOrder.price;
      const isGov = buyer === 'TREASURY';
      
      const taxRate = state.cityTreasury.taxPolicy.consumptionTaxRate;
      const tax = isGov ? 0 : basePrice * taxRate;
      const totalCost = basePrice + tax;

      let buyerCash = isGov ? state.cityTreasury.cash : (buyer as any).cash;
      if (buyerCash < totalCost) return false;

      let sellerRef = bestOrder.sellerType === 'GATHERERS' ? 'GATHERERS' : bestOrder.ref;
      
      if (Transaction.transfer(buyer, sellerRef, basePrice, { treasury: state.cityTreasury, residents: state.population.residents })) {
          
          if (!isGov && tax > 0) {
              Transaction.transfer(buyer, 'TREASURY', tax, { treasury: state.cityTreasury, residents: state.population.residents });
              state.cityTreasury.dailyIncome += tax;
          } else if (isGov) {
              state.cityTreasury.dailyExpense += basePrice;
          }

          if (bestOrder.sellerType === 'COMPANY') {
              const comp = bestOrder.ref as Company;
              comp.inventory.finished[itemType]! -= 1;
              comp.monthlySalesVolume += 1;
              comp.accumulatedRevenue += basePrice;
              comp.lastProfit += basePrice;

              const corpTax = basePrice * state.cityTreasury.taxPolicy.corporateTaxRate;
              if (comp.cash >= corpTax) {
                  Transaction.transfer(comp, 'TREASURY', corpTax, { treasury: state.cityTreasury, residents: state.population.residents });
                  state.cityTreasury.dailyIncome += corpTax;
              }

              if (itemType === ProductType.BREAD) state.products[ProductType.BREAD].dailySales += 1;
          } else {
              if (itemType === ResourceType.GRAIN) {
                  state.resources[ResourceType.GRAIN].currentPrice = basePrice;
                  state.resources[ResourceType.GRAIN].marketInventory -= 1;
                  state.resources[ResourceType.GRAIN].dailySales += 1;
              }
          }
          return true;
      }
      return false;
  }

  static updatePrices(state: GameState, getEventMod: (t: string) => number) {
      const totalResidentCash = state.economicOverview.totalResidentCash;
      const totalCompanyCash = state.economicOverview.totalCorporateCash;
      const liquidM0 = totalResidentCash + totalCompanyCash;
      
      // Helper to push candle
      const pushCandle = (history: Candle[], newPrice: number, volume: number, day: number) => {
          const open = history.length > 0 ? history[history.length - 1].close : newPrice;
          const close = newPrice;
          // Simulate intraday volatility
          const volatility = Math.abs(open - close) + (open * 0.02); 
          const high = Math.max(open, close) + (Math.random() * volatility);
          const low = Math.min(open, close) - (Math.random() * volatility);
          
          history.push({ day, open, high, low, close, volume });
          if (history.length > 60) history.shift();
      };

      // 1. 原材料 (GRAIN)
      const grainRes = state.resources[ResourceType.GRAIN];
      const grainInventory = Math.max(1, grainRes.marketInventory);
      
      const grainMoneySupply = liquidM0 * 0.3; 
      const theoreticalPrice = (grainMoneySupply * 0.1) / grainInventory;
      
      const grainRatio = Math.max(0.1, grainRes.demand) / grainInventory;
      const grainMod = Math.log(grainRatio + 1) * 0.5 + 0.5;
      
      let newGrainPrice = (theoreticalPrice * 0.7) + (grainRes.currentPrice * grainMod * 0.3);
      grainRes.currentPrice = parseFloat(Math.max(0.1, newGrainPrice).toFixed(2));
      grainRes.lastTransactionPrice = grainRes.currentPrice;

      pushCandle(grainRes.history, grainRes.currentPrice, grainRes.dailySales, state.day);


      // 2. 制成品 (BREAD)
      const breadProd = state.products[ProductType.BREAD];
      const breadInventory = Math.max(1, breadProd.marketInventory);
      
      const activeSellers = state.companies.filter(c => (c.inventory.finished[ProductType.BREAD] || 0) > 0);
      let avgCost = 1.5;
      if (activeSellers.length > 0) {
          avgCost = activeSellers.reduce((s,c) => s + c.avgCost, 0) / activeSellers.length;
      }
      
      const breadMoneySupply = liquidM0 * 0.2;
      const theoreticalBreadPrice = (breadMoneySupply * 0.1) / breadInventory;
      
      const breadRatio = Math.max(0.1, breadProd.demand) / breadInventory;
      const breadMod = Math.log(breadRatio + 1) * 0.5 + 0.6;

      let newBreadPrice = (theoreticalBreadPrice * 0.4) + (avgCost * breadMod * 0.6);
      
      breadProd.marketPrice = parseFloat(Math.max(avgCost * 0.8, newBreadPrice).toFixed(2));

      pushCandle(breadProd.history, breadProd.marketPrice, breadProd.dailySales, state.day);
  }
}
