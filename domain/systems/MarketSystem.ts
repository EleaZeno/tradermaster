import { GameState, IndustryType, ResourceType, ProductType, Company, Resident, Candle } from '../../shared/types';
import { Transaction } from '../utils/Transaction';

interface SellOrder {
    sellerType: 'GATHERERS' | 'COMPANY';
    sellerId: string;
    price: number;
    available: number;
    ref: any;
}

export class MarketSystem {
  /**
   * Constructs a sorted list of sell orders for a specific commodity.
   */
  static buildOrderBook(gameState: GameState, itemType: IndustryType): SellOrder[] {
    const orders: SellOrder[] = [];
    
    // 1. Gatherers (Farmers) selling directly to market
    if (itemType === ResourceType.GRAIN && gameState.resources[ResourceType.GRAIN].marketInventory > 0.1) {
        orders.push({
            sellerType: 'GATHERERS', 
            sellerId: 'market_gatherers',
            price: gameState.resources[ResourceType.GRAIN].currentPrice,
            available: gameState.resources[ResourceType.GRAIN].marketInventory,
            ref: gameState.resources[ResourceType.GRAIN]
        });
    }

    // 2. Companies selling finished goods
    gameState.companies.forEach(company => {
        const stock = company.inventory.finished[itemType] || 0;
        if (!company.isBankrupt && stock > 0.1) {
            const minPrice = Math.max(0.1, company.avgCost * 1.05);
            let ask = Math.max(0.1, company.avgCost * (1 + company.margin));
            ask = ask * (1 + (company.pricePremium || 0));
            
            orders.push({ 
                sellerType: 'COMPANY', 
                sellerId: company.id, 
                price: Math.max(minPrice, ask), 
                available: stock, 
                ref: company 
            });
        }
    });

    return orders.sort((a, b) => a.price - b.price);
  }

  /**
   * Attempts to execute a purchase transaction.
   */
  static attemptPurchase(
      gameState: GameState, 
      buyer: Resident | Company | 'TREASURY', 
      itemType: IndustryType, 
      quantity: number = 1
  ): boolean {
      if (quantity <= 0) return false;

      // Track demand
      if (itemType === ResourceType.GRAIN) gameState.resources[ResourceType.GRAIN].demand += quantity;
      if (itemType === ProductType.BREAD) gameState.products[ProductType.BREAD].demand += quantity;

      const orders = MarketSystem.buildOrderBook(gameState, itemType);
      if (orders.length === 0) return false;

      const bestOrder = orders[0];
      const basePrice = bestOrder.price;
      const isGov = buyer === 'TREASURY';
      
      const taxRate = gameState.cityTreasury.taxPolicy.consumptionTaxRate;
      const tax = isGov ? 0 : basePrice * taxRate;
      const totalCost = basePrice + tax;

      // Check Funds
      let buyerCash = isGov ? gameState.cityTreasury.cash : (buyer as any).cash;
      if (buyerCash < totalCost) return false;

      let sellerRef = bestOrder.sellerType === 'GATHERERS' ? 'GATHERERS' : bestOrder.ref;
      
      // Execute Transfer
      if (Transaction.transfer(buyer, sellerRef, basePrice, { treasury: gameState.cityTreasury, residents: gameState.population.residents })) {
          
          // Handle Taxes
          if (!isGov && tax > 0) {
              Transaction.transfer(buyer, 'TREASURY', tax, { treasury: gameState.cityTreasury, residents: gameState.population.residents });
              gameState.cityTreasury.dailyIncome += tax;
          } else if (isGov) {
              gameState.cityTreasury.dailyExpense += basePrice;
          }

          // Handle Inventory & Stats
          if (bestOrder.sellerType === 'COMPANY') {
              const company = bestOrder.ref as Company;
              company.inventory.finished[itemType]! -= 1;
              company.monthlySalesVolume += 1;
              company.accumulatedRevenue += basePrice;
              company.lastProfit += basePrice;

              // Corporate Tax on Revenue (Simplified)
              const corpTax = basePrice * gameState.cityTreasury.taxPolicy.corporateTaxRate;
              if (company.cash >= corpTax) {
                  Transaction.transfer(company, 'TREASURY', corpTax, { treasury: gameState.cityTreasury, residents: gameState.population.residents });
                  gameState.cityTreasury.dailyIncome += corpTax;
              }

              if (itemType === ProductType.BREAD) gameState.products[ProductType.BREAD].dailySales += 1;
          } else {
              if (itemType === ResourceType.GRAIN) {
                  gameState.resources[ResourceType.GRAIN].currentPrice = basePrice;
                  gameState.resources[ResourceType.GRAIN].marketInventory -= 1;
                  gameState.resources[ResourceType.GRAIN].dailySales += 1;
              }
          }
          return true;
      }
      return false;
  }

  static updatePrices(gameState: GameState, getEventMod: (t: string) => number) {
      const totalResidentCash = gameState.economicOverview.totalResidentCash;
      const totalCompanyCash = gameState.economicOverview.totalCorporateCash;
      const liquidM0 = totalResidentCash + totalCompanyCash;
      
      const pushCandle = (history: Candle[], newPrice: number, volume: number, day: number) => {
          const open = history.length > 0 ? history[history.length - 1].close : newPrice;
          const close = newPrice;
          const volatility = Math.abs(open - close) + (open * 0.02); 
          const high = Math.max(open, close) + (Math.random() * volatility);
          const low = Math.min(open, close) - (Math.random() * volatility);
          
          history.push({ day, open, high, low, close, volume });
          if (history.length > 60) history.shift();
      };

      // 1. Update Grain Price
      const grainRes = gameState.resources[ResourceType.GRAIN];
      const grainInventory = Math.max(1, grainRes.marketInventory);
      
      const grainMoneySupply = liquidM0 * 0.3; 
      const theoreticalPrice = (grainMoneySupply * 0.1) / grainInventory;
      
      const grainRatio = Math.max(0.1, grainRes.demand) / grainInventory;
      const grainMod = Math.log(grainRatio + 1) * 0.5 + 0.5;
      
      let newGrainPrice = (theoreticalPrice * 0.7) + (grainRes.currentPrice * grainMod * 0.3);
      grainRes.currentPrice = parseFloat(Math.max(0.1, newGrainPrice).toFixed(2));
      grainRes.lastTransactionPrice = grainRes.currentPrice;

      pushCandle(grainRes.history, grainRes.currentPrice, grainRes.dailySales, gameState.day);

      // 2. Update Bread Price
      const breadProd = gameState.products[ProductType.BREAD];
      const breadInventory = Math.max(1, breadProd.marketInventory);
      
      const activeSellers = gameState.companies.filter(c => (c.inventory.finished[ProductType.BREAD] || 0) > 0);
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

      pushCandle(breadProd.history, breadProd.marketPrice, breadProd.dailySales, gameState.day);
  }
}