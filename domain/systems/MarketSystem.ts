
import { GameState, IndustryType, ResourceType, ProductType, Order, OrderSide, OrderType, Trade, OrderBook, GameContext } from '../../shared/types';

export class MarketSystem {
  
  /**
   * Submits an order to the matching engine.
   * Handles asset locking (escrow), matching, and book updates.
   * Uses GameContext for O(1) entity lookups to reduce complexity.
   */
  static submitOrder(
      state: GameState, 
      order: Omit<Order, 'id' | 'filled' | 'timestamp'>,
      context?: GameContext
  ): boolean {
      // 1. Validate and Lock Assets (Escrow)
      if (!MarketSystem.lockAssets(state, order, context)) {
          return false;
      }

      const fullOrder: Order = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filled: 0,
          timestamp: state.day // Use Game Day, not Date.now() for simulation consistency
      };

      // 2. Get or Create Order Book
      if (!state.market[order.itemId]) {
          state.market[order.itemId] = { bids: [], asks: [], lastPrice: order.price || 1.0, history: [] };
      }
      const book = state.market[order.itemId];

      // 3. Match Order
      MarketSystem.matchOrder(state, book, fullOrder, context);

      return true;
  }

  /**
   * Cancels an order and refunds locked assets.
   */
  static cancelOrder(state: GameState, orderId: string, itemId: string, context?: GameContext): void {
      const book = state.market[itemId];
      if (!book) return;

      const bidIndex = book.bids.findIndex(o => o.id === orderId);
      if (bidIndex !== -1) {
          const order = book.bids[bidIndex];
          MarketSystem.refundAssets(state, order, order.amount - order.filled, context);
          book.bids.splice(bidIndex, 1);
          return;
      }

      const askIndex = book.asks.findIndex(o => o.id === orderId);
      if (askIndex !== -1) {
          const order = book.asks[askIndex];
          MarketSystem.refundAssets(state, order, order.amount - order.filled, context);
          book.asks.splice(askIndex, 1);
          return;
      }
  }

  /**
   * Prunes orders that are too old (Time To Live).
   * This forces agents to re-evaluate prices and prevents the book from getting stale.
   */
  static pruneStaleOrders(state: GameState, context: GameContext): void {
      const TTL = 3; // Orders expire after 3 days
      
      Object.keys(state.market).forEach(itemId => {
          const book = state.market[itemId];
          
          // Filter Bids
          for (let i = book.bids.length - 1; i >= 0; i--) {
              if (state.day - book.bids[i].timestamp > TTL) {
                  const order = book.bids[i];
                  MarketSystem.refundAssets(state, order, order.amount - order.filled, context);
                  book.bids.splice(i, 1);
              }
          }

          // Filter Asks
          for (let i = book.asks.length - 1; i >= 0; i--) {
              if (state.day - book.asks[i].timestamp > TTL) {
                  const order = book.asks[i];
                  MarketSystem.refundAssets(state, order, order.amount - order.filled, context);
                  book.asks.splice(i, 1);
              }
          }
      });
  }

  private static lockAssets(state: GameState, order: Omit<Order, 'id' | 'filled' | 'timestamp'>, context?: GameContext): boolean {
      const totalCost = order.price * order.amount; // For Limit Buy
      
      let costToLock = 0;
      let itemToLock = 0;

      if (order.side === 'BUY') {
          // BUY: Lock Cash
          if (order.type === 'LIMIT') {
              costToLock = order.price * order.amount;
          } else {
             // Market Buy: Lock based on best ask or estimation
             const book = state.market[order.itemId];
             // If book empty, market order fails immediately to prevent locking infinite cash
             if (!book || book.asks.length === 0) return false;
             
             // Estimate cost (take worst case of top 5 orders to be safe, or just top 1)
             const bestAsk = book.asks[0].price;
             costToLock = bestAsk * order.amount * 1.5; // 50% buffer for slippage
          }
      } else {
          // SELL: Lock Inventory
          itemToLock = order.amount;
      }

      // Perform Locking - Using Context for O(1) Lookup
      if (order.ownerType === 'RESIDENT') {
          const resident = context?.residentMap.get(order.ownerId) || state.population.residents.find(r => r.id === order.ownerId);
          if (!resident) return false;

          if (order.side === 'BUY') {
              if (resident.cash < costToLock) return false;
              resident.cash -= costToLock;
          } else {
              if (order.itemId.startsWith('comp_')) {
                   // SHORT SELLING LOGIC:
                   // If player is selling and doesn't have enough shares, allow negative (Short)
                   // But require some cash margin (simplification: no hard margin lock, but must have positive cash)
                   const currentShares = resident.portfolio[order.itemId] || 0;
                   
                   if (resident.isPlayer) {
                       // Player can short
                       resident.portfolio[order.itemId] = currentShares - itemToLock;
                   } else {
                       // AI Residents cannot short (prevent bankruptcy loops)
                       if (currentShares < itemToLock) return false;
                       resident.portfolio[order.itemId] = currentShares - itemToLock;
                   }
              } else {
                   if ((resident.inventory[order.itemId] || 0) < itemToLock) return false;
                   resident.inventory[order.itemId]! -= itemToLock;
              }
          }
      } else if (order.ownerType === 'COMPANY') {
          const company = context?.companyMap.get(order.ownerId) || state.companies.find(c => c.id === order.ownerId);
          if (!company) return false;

          if (order.side === 'BUY') {
              if (company.cash < costToLock) return false;
              company.cash -= costToLock;
          } else {
              if ((company.inventory.finished[order.itemId] || 0) < itemToLock) return false;
              company.inventory.finished[order.itemId]! -= itemToLock;
          }
      } else if (order.ownerType === 'TREASURY') {
          if (order.side === 'BUY') {
              if (state.cityTreasury.cash < costToLock) return false;
              state.cityTreasury.cash -= costToLock;
          }
      }

      return true;
  }

  private static refundAssets(state: GameState, order: Order, amountToRefund: number, context?: GameContext): void {
      if (amountToRefund <= 0.0001) return;

      if (order.ownerType === 'RESIDENT') {
          const resident = context?.residentMap.get(order.ownerId) || state.population.residents.find(r => r.id === order.ownerId);
          if (!resident) return;

          if (order.side === 'BUY') {
              if (order.type === 'LIMIT') {
                  resident.cash += order.price * amountToRefund;
              }
          } else {
              if (order.itemId.startsWith('comp_')) {
                   resident.portfolio[order.itemId] = (resident.portfolio[order.itemId] || 0) + amountToRefund;
              } else {
                   resident.inventory[order.itemId] = (resident.inventory[order.itemId] || 0) + amountToRefund;
              }
          }
      } else if (order.ownerType === 'COMPANY') {
          const company = context?.companyMap.get(order.ownerId) || state.companies.find(c => c.id === order.ownerId);
          if (!company) return;

          if (order.side === 'BUY') {
              if (order.type === 'LIMIT') company.cash += order.price * amountToRefund;
          } else {
               company.inventory.finished[order.itemId] = (company.inventory.finished[order.itemId] || 0) + amountToRefund;
          }
      } else if (order.ownerType === 'TREASURY') {
          if (order.side === 'BUY' && order.type === 'LIMIT') {
              state.cityTreasury.cash += order.price * amountToRefund;
          }
      }
  }

  private static matchOrder(state: GameState, book: OrderBook, takerOrder: Order, context?: GameContext): void {
      const isBuy = takerOrder.side === 'BUY';
      const opposingBook = isBuy ? book.asks : book.bids;
      
      let itemsRemaining = takerOrder.amount;
      let matchedCount = 0;

      // Batch Matching
      for (let i = 0; i < opposingBook.length && itemsRemaining > 0.0001; i++) {
          const bestMaker = opposingBook[i];
          
          // Price Check
          if (takerOrder.type === 'LIMIT') {
              if (isBuy && bestMaker.price > takerOrder.price) break; // Asks too high
              if (!isBuy && bestMaker.price < takerOrder.price) break; // Bids too low
          }

          const matchPrice = bestMaker.price; 
          const matchQty = Math.min(itemsRemaining, bestMaker.amount - bestMaker.filled);

          // Execute Trade Transfer (Uses Context O(1))
          MarketSystem.executeTradeTransfer(state, takerOrder, bestMaker, matchPrice, matchQty, context);

          // Update State
          bestMaker.filled += matchQty;
          takerOrder.filled += matchQty;
          itemsRemaining -= matchQty;

          // Record History
          const trade: Trade = {
              price: matchPrice,
              amount: matchQty,
              timestamp: state.day,
              buyerId: isBuy ? takerOrder.ownerId : bestMaker.ownerId,
              sellerId: isBuy ? bestMaker.ownerId : takerOrder.ownerId
          };
          book.history.push(trade);
          if (book.history.length > 50) book.history.shift();
          
          book.lastPrice = matchPrice;
          
          MarketSystem.updateCandle(state, takerOrder.itemId, matchPrice, matchQty, context);
          
          // Tax Logic
          if (!orderIsTreasury(takerOrder) && !orderIsTreasury(bestMaker)) {
              const tax = (matchPrice * matchQty) * state.cityTreasury.taxPolicy.consumptionTaxRate;
              const sellerId = isBuy ? bestMaker.ownerId : takerOrder.ownerId;
              const sellerType = isBuy ? bestMaker.ownerType : takerOrder.ownerType;
              MarketSystem.deductTax(state, sellerId, sellerType, tax, context);
          }

          if (bestMaker.filled >= bestMaker.amount - 0.0001) {
              matchedCount++;
          }
      }

      // Batch Remove Filled Orders
      if (matchedCount > 0) {
          opposingBook.splice(0, matchedCount);
      }

      // Handle Remainder
      if (itemsRemaining > 0.0001) {
          if (takerOrder.type === 'LIMIT') {
              const bookSide = isBuy ? book.bids : book.asks;
              const insertIndex = MarketSystem.getSortedIndex(bookSide, takerOrder.price, isBuy);
              bookSide.splice(insertIndex, 0, takerOrder);
          } else {
              // Market Order Partial Fill / Refund logic
              const book = state.market[takerOrder.itemId];
              const bestAsk = book?.asks[0]?.price || takerOrder.price || 1.0; 
              
              if (takerOrder.side === 'BUY') {
                   const refundCash = bestAsk * itemsRemaining * 1.5; 
                   const r = context?.residentMap.get(takerOrder.ownerId) || state.population.residents.find(x => x.id === takerOrder.ownerId);
                   if (r) r.cash += refundCash;
              } else {
                  MarketSystem.refundAssets(state, takerOrder, itemsRemaining, context);
              }
          }
      }
  }

  private static getSortedIndex(array: Order[], price: number, isDesc: boolean): number {
    let low = 0;
    let high = array.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        const itemPrice = array[mid].price;
        const goRight = isDesc ? itemPrice >= price : itemPrice <= price;

        if (goRight) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low;
  }

  private static executeTradeTransfer(state: GameState, taker: Order, maker: Order, price: number, qty: number, context?: GameContext): void {
      // 1. Identify Buyer and Seller Objects (O(1) with Context)
      const buyerType = taker.side === 'BUY' ? taker.ownerType : maker.ownerType;
      const buyerId = taker.side === 'BUY' ? taker.ownerId : maker.ownerId;
      
      const sellerType = taker.side === 'SELL' ? taker.ownerType : maker.ownerType;
      const sellerId = taker.side === 'SELL' ? taker.ownerId : maker.ownerId;

      // 2. Transfer Item to Buyer (Item already deducted from Seller during Lock)
      if (buyerType === 'RESIDENT') {
          const r = context?.residentMap.get(buyerId) || state.population.residents.find(x => x.id === buyerId);
          if (r) {
              if (taker.itemId.startsWith('comp_')) {
                  // If covering a short position, this increases portfolio from negative towards zero
                  r.portfolio[taker.itemId] = (r.portfolio[taker.itemId] || 0) + qty;
              } else {
                  r.inventory[taker.itemId] = (r.inventory[taker.itemId] || 0) + qty;
              }
          }
      } else if (buyerType === 'COMPANY') {
          const c = context?.companyMap.get(buyerId) || state.companies.find(x => x.id === buyerId);
          if (c) c.inventory.finished[taker.itemId] = (c.inventory.finished[taker.itemId] || 0) + qty; 
      }

      // 3. Transfer Cash to Seller (Cash already deducted from Buyer during Lock)
      const cost = price * qty;
      
      if (sellerType === 'RESIDENT') {
          const r = context?.residentMap.get(sellerId) || state.population.residents.find(x => x.id === sellerId);
          if (r) r.cash += cost;
      } else if (sellerType === 'COMPANY') {
          const c = context?.companyMap.get(sellerId) || state.companies.find(x => x.id === sellerId);
          if (c) {
              c.cash += cost;
              c.accumulatedRevenue += cost;
              c.lastProfit += cost;
              if (taker.itemId === ProductType.BREAD) c.monthlySalesVolume += qty;
          }
      } else if (sellerType === 'TREASURY') {
          state.cityTreasury.cash += cost;
      }

      // 4. Refund Excess Cash to Taker Buyer (Price Improvement)
      if (taker.side === 'BUY' && taker.type === 'LIMIT' && taker.price > price) {
           const excess = (taker.price - price) * qty;
           const r = context?.residentMap.get(taker.ownerId) || state.population.residents.find(x => x.id === taker.ownerId);
           if (r) r.cash += excess;
      }
  }

  private static deductTax(state: GameState, entityId: string, type: string, amount: number, context?: GameContext) {
      if (amount <= 0) return;
      if (type === 'RESIDENT') {
          const r = context?.residentMap.get(entityId) || state.population.residents.find(x => x.id === entityId);
          if (r && r.cash >= amount) {
              r.cash -= amount;
              state.cityTreasury.cash += amount;
              state.cityTreasury.dailyIncome += amount;
          }
      } else if (type === 'COMPANY') {
          const c = context?.companyMap.get(entityId) || state.companies.find(x => x.id === entityId);
          if (c && c.cash >= amount) {
              c.cash -= amount;
              state.cityTreasury.cash += amount;
              state.cityTreasury.dailyIncome += amount;
          }
      }
  }

  private static updateCandle(state: GameState, itemId: string, price: number, volume: number, context?: GameContext) {
      let itemHistory: any[] = [];
      if (Object.values(ResourceType).includes(itemId as ResourceType)) {
          itemHistory = state.resources[itemId as ResourceType].history;
          state.resources[itemId as ResourceType].currentPrice = price;
          state.resources[itemId as ResourceType].dailySales += volume;
      } else if (Object.values(ProductType).includes(itemId as ProductType)) {
          itemHistory = state.products[itemId as ProductType].history;
          state.products[itemId as ProductType].marketPrice = price;
          state.products[itemId as ProductType].dailySales += volume;
      } else {
          const comp = context?.companyMap.get(itemId) || state.companies.find(c => c.id === itemId);
          if (comp) {
              itemHistory = comp.history;
              comp.sharePrice = price;
              comp.monthlySalesVolume += volume;
          }
      }

      if (itemHistory && itemHistory.length > 0) {
        const lastCandle = itemHistory[itemHistory.length - 1];
        if (lastCandle.day === state.day) {
            lastCandle.close = price;
            lastCandle.high = Math.max(lastCandle.high, price);
            lastCandle.low = Math.min(lastCandle.low, price);
            lastCandle.volume += volume;
        } else {
            itemHistory.push({
                day: state.day,
                open: price,
                close: price,
                high: price,
                low: price,
                volume: volume
            });
            if (itemHistory.length > 60) itemHistory.shift();
        }
      }
  }
}

function orderIsTreasury(o: Order) {
    return o.ownerType === 'TREASURY';
}
