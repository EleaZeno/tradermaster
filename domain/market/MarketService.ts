
import { GameState, Order, OrderBook, GameContext, Trade, ResourceType, ProductType, OrderType, OrderSide } from '../../shared/types';

const MAX_MATCH_DEPTH = 50; // Prevent infinite loops or UI freeze on huge orders

export class MarketService {
  
  /**
   * Main entry point for submitting orders.
   * Handles validation, asset locking (escrow), insertion, and matching.
   */
  static submitOrder(
      state: GameState, 
      order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>,
      context?: GameContext
  ): boolean {
      // 1. Validation
      if (order.type === 'LIMIT' && order.price <= 0) return false;
      if (order.quantity <= 0) return false;
      if (!order.ownerId) return false;

      // 2. Asset Locking (Escrow)
      // We delegate this to the AssetLocker to keep the service clean
      if (!MarketService.AssetLocker.lock(state, order, context)) {
          return false;
      }

      const fullOrder: Order = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          quantity: order.quantity,
          remainingQuantity: order.quantity,
          status: 'PENDING',
          timestamp: state.day
      };

      // 3. Initialize Book if needed
      if (!state.market[order.itemId]) {
          state.market[order.itemId] = { bids: [], asks: [], lastPrice: order.price || 1.0, history: [] };
      }
      const book = state.market[order.itemId];

      // 4. Insert into Limit Order Book (LOB)
      const isBuy = fullOrder.side === 'BUY';
      const bookSide = isBuy ? book.bids : book.asks;
      
      bookSide.push(fullOrder);
      
      // 5. Strict Sorting: Price Priority, then Time Priority
      // Bids: Descending Price (High to Low)
      // Asks: Ascending Price (Low to High)
      if (isBuy) {
          bookSide.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
          bookSide.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }

      // 6. Try to Match immediately
      MarketService.matchOrder(state, book, fullOrder, context);

      return true;
  }

  static cancelOrder(state: GameState, orderId: string, itemId: string, context?: GameContext): void {
      const book = state.market[itemId];
      if (!book) return;

      const findAndCancel = (side: Order[]) => {
          const index = side.findIndex(o => o.id === orderId);
          if (index !== -1) {
              const order = side[index];
              MarketService.AssetLocker.refund(state, order, order.remainingQuantity, context);
              order.status = 'CANCELLED';
              side.splice(index, 1);
              return true;
          }
          return false;
      };

      if (!findAndCancel(book.bids)) {
          findAndCancel(book.asks);
      }
  }

  static pruneStaleOrders(state: GameState, context: GameContext): void {
      const TTL = 3; // Orders live for 3 days
      
      Object.keys(state.market).forEach(itemId => {
          const book = state.market[itemId];
          
          const prune = (side: Order[]) => {
              for (let i = side.length - 1; i >= 0; i--) {
                  if (state.day - side[i].timestamp > TTL) {
                      const order = side[i];
                      MarketService.AssetLocker.refund(state, order, order.remainingQuantity, context);
                      order.status = 'CANCELLED';
                      side.splice(i, 1);
                  }
              }
          };

          prune(book.bids);
          prune(book.asks);
      });
  }

  // --- Matching Engine ---

  private static matchOrder(state: GameState, book: OrderBook, triggerOrder: Order, context?: GameContext): void {
      const isBuy = triggerOrder.side === 'BUY';
      const opposingBook = isBuy ? book.asks : book.bids;
      
      let matchCount = 0;

      // Iterate through opposing orders (best price first)
      for (let i = 0; i < opposingBook.length; i++) {
          if (matchCount >= MAX_MATCH_DEPTH) break; // Safety break

          const maker = opposingBook[i];
          
          // Optimization: If trigger is filled, stop
          if (triggerOrder.remainingQuantity <= 0.0001) {
              triggerOrder.status = 'EXECUTED';
              break;
          }

          // Price Check
          if (!MarketService.canMatch(triggerOrder, maker)) break;

          // Execute Match
          const matchQty = Math.min(triggerOrder.remainingQuantity, maker.remainingQuantity);
          const matchPrice = maker.price; // Maker sets the price (Limit order on book)

          MarketService.executeTradeTransfer(state, triggerOrder, maker, matchPrice, matchQty, context);

          // Update Quantities
          maker.remainingQuantity -= matchQty;
          triggerOrder.remainingQuantity -= matchQty;

          // Update Status
          if (maker.remainingQuantity <= 0.0001) {
              maker.status = 'EXECUTED';
              matchCount++; // Will be removed
          } else {
              maker.status = 'PARTIALLY_EXECUTED';
          }
          
          triggerOrder.status = triggerOrder.remainingQuantity <= 0.0001 ? 'EXECUTED' : 'PARTIALLY_EXECUTED';

          // Analytics & Taxes
          MarketService.recordTrade(state, book, triggerOrder, maker, matchPrice, matchQty);
          MarketService.updateCandle(state, triggerOrder.itemId, matchPrice, matchQty, context);
          MarketService.AssetLocker.deductTax(state, maker, triggerOrder, matchPrice, matchQty, context);
      }

      // Batch remove filled orders from the top (since they are sorted by best price)
      if (matchCount > 0) {
          opposingBook.splice(0, matchCount);
      }

      MarketService.handleOrderRemainder(state, book, triggerOrder, context);
  }

  private static canMatch(taker: Order, maker: Order): boolean {
      if (taker.type === 'LIMIT') {
          if (taker.side === 'BUY') return maker.price <= taker.price; // Buy low
          else return maker.price >= taker.price; // Sell high
      }
      return true; // Market order takes best available
  }

  private static handleOrderRemainder(state: GameState, book: OrderBook, taker: Order, context?: GameContext): void {
      if (taker.remainingQuantity <= 0.0001) return;

      if (taker.type === 'LIMIT') {
          // Limit orders stay in book.
          // Check if it was fully executed (rare here as we check remainder above, but safety)
          if (taker.status === 'EXECUTED') {
              const side = taker.side === 'BUY' ? book.bids : book.asks;
              const idx = side.indexOf(taker);
              if (idx > -1) side.splice(idx, 1);
          }
      } else {
          // Market Order Remainder: Cancel and Refund
          // Market orders are Fill-or-Kill / Immediate-or-Cancel usually, 
          // but here we treat remaining as Cancel to avoid sticking in book with no price.
          
          MarketService.AssetLocker.refundRemainder(state, taker, context);
          
          taker.status = 'EXECUTED'; // Effectively cancelled
          
          // Remove from book
          const side = taker.side === 'BUY' ? book.bids : book.asks;
          const idx = side.indexOf(taker);
          if (idx > -1) side.splice(idx, 1);
      }
  }

  private static executeTradeTransfer(state: GameState, taker: Order, maker: Order, price: number, qty: number, context?: GameContext): void {
      const buyerId = taker.side === 'BUY' ? taker.ownerId : maker.ownerId;
      const buyerType = taker.side === 'BUY' ? taker.ownerType : maker.ownerType;
      
      const sellerId = taker.side === 'SELL' ? taker.ownerId : maker.ownerId;
      const sellerType = taker.side === 'SELL' ? taker.ownerType : maker.ownerType;

      // 1. Transfer Goods to Buyer
      // (Seller already had goods locked/deducted)
      if (buyerType === 'RESIDENT') {
          const r = context?.residentMap.get(buyerId) || state.population.residents.find(x => x.id === buyerId);
          if (r) {
              if (taker.itemId.startsWith('comp_')) {
                  // If short covering, this adds to negative balance (approaching zero)
                  r.portfolio[taker.itemId] = (r.portfolio[taker.itemId] || 0) + qty;
              } else {
                  r.inventory[taker.itemId] = (r.inventory[taker.itemId] || 0) + qty;
              }
          }
      } else if (buyerType === 'COMPANY') {
          const c = context?.companyMap.get(buyerId) || state.companies.find(x => x.id === buyerId);
          if (c) c.inventory.finished[taker.itemId] = (c.inventory.finished[taker.itemId] || 0) + qty; 
      }

      // 2. Transfer Cash to Seller
      // (Buyer already had cash locked/deducted)
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

      // 3. Price Improvement Refund (Limit Buy)
      // If Buyer bid 10 but matched at 8, refund 2
      if (taker.side === 'BUY' && taker.type === 'LIMIT' && taker.price > price) {
           const excess = (taker.price - price) * qty;
           const r = context?.residentMap.get(taker.ownerId) || state.population.residents.find(x => x.id === taker.ownerId);
           if (r) r.cash += excess;
      }
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

  // --- Internal Helper Class for Asset Management ---
  
  private static AssetLocker = class {
      
      static lock(state: GameState, order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp'>, context?: GameContext): boolean {
          if (order.side === 'BUY') return this.lockForBuy(state, order, context);
          else return this.lockForSell(state, order, context);
      }

      static refund(state: GameState, order: Order, amount: number, context?: GameContext): void {
          if (amount <= 0.0001) return;
          
          // NOTE: We don't track original lock price for Market orders easily here without extra state.
          // For Limit orders, we refund price * quantity.
          // For Market orders, we approximate refund based on lastPrice or current logic.
          
          if (order.side === 'BUY') {
              if (order.type === 'LIMIT') {
                  this.creditCash(state, order.ownerId, order.ownerType, order.price * amount, context);
              } else {
                  // Fallback for Market Buy refund (if cancelled manually)
                  // Assuming locked at some safety margin, but we don't know it exactly.
                  // We use current market price as best effort approximation for refund value,
                  // or better, if we had "frozenAmt" on order. 
                  // Since we don't, this is a limitation. We use lastPrice * 1.2 used in lock.
                  const book = state.market[order.itemId];
                  const price = book ? book.lastPrice : 1.0;
                  this.creditCash(state, order.ownerId, order.ownerType, price * 1.2 * amount, context);
              }
          } else {
              this.creditItem(state, order.ownerId, order.ownerType, order.itemId, amount, context);
          }
      }

      static refundRemainder(state: GameState, order: Order, context?: GameContext): void {
          // Special handling for Market Order remainders
          if (order.side === 'BUY') {
               const book = state.market[order.itemId];
               // We locked 1.2x bestAsk. We should refund the unused portion.
               // Since we can't track exactly what was locked vs spent per order in this simplified model,
               // we refund the remainder quantity * (lockPrice estimate).
               const estimatedLockPrice = (book?.lastPrice || 1.0) * 1.2;
               const refundCash = estimatedLockPrice * order.remainingQuantity;
               this.creditCash(state, order.ownerId, order.ownerType, refundCash, context);
          } else {
              this.creditItem(state, order.ownerId, order.ownerType, order.itemId, order.remainingQuantity, context);
          }
      }

      static deductTax(state: GameState, maker: Order, taker: Order, price: number, qty: number, context?: GameContext) {
          if (maker.ownerType === 'TREASURY' || taker.ownerType === 'TREASURY') return;
          
          const isBuy = taker.side === 'BUY';
          // Seller pays tax
          const sellerId = isBuy ? maker.ownerId : taker.ownerId;
          const sellerType = isBuy ? maker.ownerType : taker.ownerType;
          
          const tax = (price * qty) * state.cityTreasury.taxPolicy.consumptionTaxRate;
          
          // Seller just received Cash = price * qty. We deduct from their balance.
          this.debitCash(state, sellerId, sellerType, tax, context);
          
          state.cityTreasury.cash += tax;
          state.cityTreasury.dailyIncome += tax;
      }

      // --- Private Implementation ---

      private static lockForBuy(state: GameState, order: any, context?: GameContext): boolean {
          let costToLock = 0;
          if (order.type === 'LIMIT') {
              costToLock = order.price * order.quantity;
          } else {
             // Market Buy: Lock based on best ask + safety margin
             const book = state.market[order.itemId];
             if (!book || book.asks.length === 0) return false;
             const bestAsk = book.asks[0].price;
             costToLock = bestAsk * order.quantity * 1.2; // 20% slippage protection
          }
          
          return this.debitCash(state, order.ownerId, order.ownerType, costToLock, context);
      }

      private static lockForSell(state: GameState, order: any, context?: GameContext): boolean {
          return this.debitItem(state, order.ownerId, order.ownerType, order.itemId, order.quantity, context);
      }

      private static debitCash(state: GameState, id: string, type: string, amount: number, context?: GameContext): boolean {
          if (type === 'RESIDENT') {
              const r = context?.residentMap.get(id) || state.population.residents.find(x => x.id === id);
              if (!r || r.cash < amount) return false;
              r.cash -= amount;
              return true;
          } else if (type === 'COMPANY') {
              const c = context?.companyMap.get(id) || state.companies.find(x => x.id === id);
              if (!c || c.cash < amount) return false;
              c.cash -= amount;
              return true;
          } else if (type === 'TREASURY') {
              if (state.cityTreasury.cash < amount) return false;
              state.cityTreasury.cash -= amount;
              return true;
          }
          return false;
      }

      private static creditCash(state: GameState, id: string, type: string, amount: number, context?: GameContext) {
          if (type === 'RESIDENT') {
              const r = context?.residentMap.get(id) || state.population.residents.find(x => x.id === id);
              if (r) r.cash += amount;
          } else if (type === 'COMPANY') {
              const c = context?.companyMap.get(id) || state.companies.find(x => x.id === id);
              if (c) c.cash += amount;
          } else if (type === 'TREASURY') {
              state.cityTreasury.cash += amount;
          }
      }

      private static debitItem(state: GameState, id: string, type: string, itemId: string, qty: number, context?: GameContext): boolean {
          if (type === 'RESIDENT') {
              const r = context?.residentMap.get(id) || state.population.residents.find(x => x.id === id);
              if (!r) return false;
              
              if (itemId.startsWith('comp_')) {
                  // Stock
                  const currentShares = r.portfolio[itemId] || 0;
                  if (r.isPlayer) {
                      // Player can Short (Negative Balance allowed conceptually, but here we just decrement)
                      // Logic: If Player, we assume logic is handled via margin check elsewhere or we allow it.
                      // For simplicity here, we allow negative portfolio.
                      r.portfolio[itemId] = currentShares - qty;
                      return true;
                  } else {
                      // AI cannot short
                      if (currentShares < qty) return false;
                      r.portfolio[itemId] = currentShares - qty;
                      return true;
                  }
              } else {
                  // Commodity
                  const currentInv = r.inventory[itemId] || 0;
                  if (currentInv < qty) return false;
                  r.inventory[itemId] = currentInv - qty;
                  return true;
              }
          } else if (type === 'COMPANY') {
              const c = context?.companyMap.get(id) || state.companies.find(x => x.id === id);
              if (!c) return false;
              const currentInv = c.inventory.finished[itemId] || 0;
              if (currentInv < qty) return false;
              c.inventory.finished[itemId] = currentInv - qty;
              return true;
          }
          return false;
      }

      private static creditItem(state: GameState, id: string, type: string, itemId: string, qty: number, context?: GameContext) {
          if (type === 'RESIDENT') {
              const r = context?.residentMap.get(id) || state.population.residents.find(x => x.id === id);
              if (r) {
                  if (itemId.startsWith('comp_')) {
                      r.portfolio[itemId] = (r.portfolio[itemId] || 0) + qty;
                  } else {
                      r.inventory[itemId] = (r.inventory[itemId] || 0) + qty;
                  }
              }
          } else if (type === 'COMPANY') {
              const c = context?.companyMap.get(id) || state.companies.find(x => x.id === id);
              if (c) c.inventory.finished[itemId] = (c.inventory.finished[itemId] || 0) + qty;
          }
      }
  }
}
