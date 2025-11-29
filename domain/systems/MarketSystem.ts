
import { GameState, IndustryType, ResourceType, ProductType, Order, OrderSide, OrderType, Trade, OrderBook, GameContext } from '../../shared/types';
import { GameError } from '../../shared/utils/errorHandler';

export class MarketSystem {
  
  /**
   * Submits an order to the matching engine.
   * Handles asset locking (escrow), matching, and book updates.
   * Uses GameContext for O(1) entity lookups to reduce complexity.
   */
  static submitOrder(
      state: GameState, 
      order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>,
      context?: GameContext
  ): boolean {
      // Robustness check: Ensure price is non-negative for LIMIT orders
      if (order.type === 'LIMIT' && order.price <= 0) {
          return false;
      }
      if (order.quantity <= 0) return false;

      // 1. Validate and Lock Assets (Escrow)
      if (!MarketSystem.lockAssets(state, order, context)) {
          // In strict mode, we might throw here, but for now we return false
          // throw new GameError("Insufficient funds or assets", "BUSINESS", "INSUFFICIENT_FUNDS");
          return false;
      }

      const fullOrder: Order = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          quantity: order.quantity,
          remainingQuantity: order.quantity,
          status: 'PENDING',
          timestamp: state.day // Use Game Day, not Date.now() for simulation consistency
      };

      // 2. Get or Create Order Book
      if (!state.market[order.itemId]) {
          state.market[order.itemId] = { bids: [], asks: [], lastPrice: order.price || 1.0, history: [], volatility: 0, spread: 0 };
      }
      const book = state.market[order.itemId];

      // 3. Insert and Sort (Price/Time Priority)
      const isBuy = fullOrder.side === 'BUY';
      const bookSide = isBuy ? book.bids : book.asks;
      
      bookSide.push(fullOrder);
      
      // Bids: Descending (Highest Price First), Asks: Ascending (Lowest Price First)
      if (isBuy) {
          bookSide.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
          bookSide.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }

      // 4. Match Order
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
          MarketSystem.refundAssets(state, order, order.remainingQuantity, context);
          order.status = 'CANCELLED';
          book.bids.splice(bidIndex, 1);
          return;
      }

      const askIndex = book.asks.findIndex(o => o.id === orderId);
      if (askIndex !== -1) {
          const order = book.asks[askIndex];
          MarketSystem.refundAssets(state, order, order.remainingQuantity, context);
          order.status = 'CANCELLED';
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
                  MarketSystem.refundAssets(state, order, order.remainingQuantity, context);
                  order.status = 'CANCELLED';
                  book.bids.splice(i, 1);
              }
          }

          // Filter Asks
          for (let i = book.asks.length - 1; i >= 0; i--) {
              if (state.day - book.asks[i].timestamp > TTL) {
                  const order = book.asks[i];
                  MarketSystem.refundAssets(state, order, order.remainingQuantity, context);
                  order.status = 'CANCELLED';
                  book.asks.splice(i, 1);
              }
          }
      });
  }

  private static lockAssets(state: GameState, order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>, context?: GameContext): boolean {
      const totalCost = order.price * order.quantity; // For Limit Buy
      
      let costToLock = 0;
      let itemToLock = 0;

      if (order.side === 'BUY') {
          // BUY: Lock Cash
          if (order.type === 'LIMIT') {
              costToLock = order.price * order.quantity;
          } else {
             // Market Buy: Lock based on best ask or estimation
             const book = state.market[order.itemId];
             // If book empty, market order fails immediately to prevent locking infinite cash
             if (!book || book.asks.length === 0) return false;
             
             // Estimate cost (take worst case of top 5 orders to be safe, or just top 1)
             const bestAsk = book.asks[0].price;
             costToLock = bestAsk * order.quantity * 1.5; // 50% buffer for slippage
          }
      } else {
          // SELL: Lock Inventory
          itemToLock = order.quantity;
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

  /**
   * Refactored matchOrder: now splits concerns into clearer sub-methods.
   */
  private static matchOrder(state: GameState, book: OrderBook, takerOrder: Order, context?: GameContext): void {
      const isBuy = takerOrder.side === 'BUY';
      const opposingBook = isBuy ? book.asks : book.bids;
      
      let matchedCount = 0;

      // Iteratively match against opposing orders
      for (let i = 0; i < opposingBook.length && takerOrder.remainingQuantity > 0.0001; i++) {
          const makerOrder = opposingBook[i];
          
          if (!MarketSystem.canMatch(takerOrder, makerOrder)) break;

          MarketSystem.executeMatch(state, book, takerOrder, makerOrder, context);

          if (makerOrder.remainingQuantity < 0.0001) {
              matchedCount++;
          }
      }

      // Batch remove filled orders
      if (matchedCount > 0) {
          opposingBook.splice(0, matchedCount);
      }

      // Handle any remainder of the taker order
      MarketSystem.handleOrderRemainder(state, book, takerOrder, context);
  }

  private static canMatch(taker: Order, maker: Order): boolean {
      if (taker.type === 'LIMIT') {
          if (taker.side === 'BUY') return maker.price <= taker.price;
          else return maker.price >= taker.price;
      }
      return true; // Market order matches best available
  }

  private static executeMatch(state: GameState, book: OrderBook, taker: Order, maker: Order, context?: GameContext): void {
      const matchPrice = maker.price; 
      const matchQty = Math.min(taker.remainingQuantity, maker.remainingQuantity);

      // 1. Execute Trade Transfer (Exchange assets/cash)
      MarketSystem.executeTradeTransfer(state, taker, maker, matchPrice, matchQty, context);

      // 2. Update Maker Status
      maker.remainingQuantity -= matchQty;
      maker.status = maker.remainingQuantity < 0.0001 ? 'EXECUTED' : 'PARTIALLY_EXECUTED';

      // 3. Update Taker Status (Partial)
      taker.remainingQuantity -= matchQty;

      // 4. Record History
      MarketSystem.recordTrade(state, book, taker, maker, matchPrice, matchQty);

      // 5. Update Candles
      MarketSystem.updateCandle(state, taker.itemId, matchPrice, matchQty, context);

      // 6. Apply Transaction Tax
      MarketSystem.applyTradeTax(state, taker, maker, matchPrice, matchQty, context);
  }

  private static recordTrade(state: GameState, book: OrderBook, taker: Order, maker: Order, price: number, qty: number) {
      const isBuy = taker.side === 'BUY';
      const trade: Trade = {
          price: price,
          quantity: qty,
          timestamp: state.day,
          buyerId: isBuy ? taker.ownerId : maker.ownerId,
          sellerId: isBuy ? maker.ownerId : taker.ownerId
      };
      book.history.push(trade);
      if (book.history.length > 50) book.history.shift();
      book.lastPrice = price;
  }

  private static applyTradeTax(state: GameState, taker: Order, maker: Order, price: number, qty: number, context?: GameContext) {
      if (orderIsTreasury(taker) || orderIsTreasury(maker)) return;
      
      const isBuy = taker.side === 'BUY';
      // Seller pays the tax
      const sellerId = isBuy ? maker.ownerId : taker.ownerId;
      const sellerType = isBuy ? maker.ownerType : taker.ownerType;
      
      const tax = (price * qty) * state.cityTreasury.taxPolicy.consumptionTaxRate;
      MarketSystem.deductTax(state, sellerId, sellerType, tax, context);
  }

  private static handleOrderRemainder(state: GameState, book: OrderBook, taker: Order, context?: GameContext): void {
      if (taker.remainingQuantity <= 0.0001) {
          taker.status = 'EXECUTED';
          return;
      }

      if (taker.type === 'LIMIT') {
          // Add remainder to book - ALREADY ADDED in submitOrder step 3
          taker.status = taker.remainingQuantity < taker.quantity ? 'PARTIALLY_EXECUTED' : 'PENDING';
          // No need to re-insert or sort, it is already in the array reference passed as `takerOrder`
      } else {
          // Market Order Remainder Handling (Refund/Cancel)
          if (taker.side === 'BUY') {
               // Refund unused estimated locked cash
               const book = state.market[taker.itemId];
               const bestAsk = book?.asks[0]?.price || taker.price || 1.0; 
               const refundCash = bestAsk * taker.remainingQuantity * 1.5; 
               const r = context?.residentMap.get(taker.ownerId) || state.population.residents.find(x => x.id === taker.ownerId);
               if (r) r.cash += refundCash;
          } else {
              // Sell Market Order Remainder: Refund items
              MarketSystem.refundAssets(state, taker, taker.remainingQuantity, context);
          }
          taker.status = 'EXECUTED'; // Remainder is cancelled
          
          // Remove from book (it was added tentatively)
          const side = taker.side === 'BUY' ? book.bids : book.asks;
          const idx = side.indexOf(taker);
          if (idx !== -1) side.splice(idx, 1);
      }
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

      // 4. Refund Excess Cash to Taker Buyer (Price Improvement for Limit Buy)
      if (taker.side === 'BUY' && taker.type === 'LIMIT' && taker.price > price) {
           const excess = (taker.price - price) * qty;
           const r = context?.residentMap.get(taker.ownerId) || state.population.residents.find(x => x.id === taker.ownerId);
           if (r) r.cash += excess;
      }

      // 5. Notifications
      // Respect settings and localization
      if (state.settings.notifications.trades) {
          const isEn = state.settings.language === 'en';
          
          if (taker.ownerType === 'RESIDENT' && taker.ownerId === 'res_player') {
              const action = taker.side === 'BUY' ? (isEn ? 'Bought' : '买入') : (isEn ? 'Sold' : '卖出');
              const msg = isEn 
                ? `Trade Success: ${action} ${qty.toFixed(0)} ${taker.itemId} @ ${price.toFixed(2)}`
                : `交易成功: ${action} ${qty.toFixed(0)} ${taker.itemId} @ ${price.toFixed(2)}`;
                
              state.notifications.push({
                  id: `ntf_${Date.now()}`,
                  message: msg,
                  type: 'success',
                  timestamp: Date.now()
              });
          }
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
