
import { GameState, Order, OrderBook, GameContext, Trade, ResourceType, ProductType, OrderType, OrderSide } from '../../shared/types';

const MAX_MATCH_DEPTH = 50; 

export class MarketService {
  
  static submitOrder(
      state: GameState, 
      order: Omit<Order, 'id' | 'remainingQuantity' | 'status' | 'timestamp' | 'lockedValue'>,
      context?: GameContext
  ): boolean {
      // 1. Validation
      if (order.type === 'LIMIT' && (order.price <= 0 || !Number.isFinite(order.price))) return false;
      if (order.quantity <= 0 || !Number.isFinite(order.quantity)) return false;
      if (!order.ownerId) return false;

      const fullOrder: Order = {
          ...order,
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          quantity: order.quantity,
          remainingQuantity: order.quantity,
          status: 'PENDING',
          timestamp: state.day,
          lockedValue: 0
      };

      // 2. Asset Locking (Escrow)
      if (!MarketService.AssetLocker.lock(state, fullOrder, context)) {
          return false;
      }

      // 3. Initialize Book if needed
      if (!state.market[order.itemId]) {
          state.market[order.itemId] = { bids: [], asks: [], lastPrice: order.price || 1.0, history: [], volatility: 0, spread: 0 };
      }
      const book = state.market[order.itemId];

      // 4. Insert into Limit Order Book (LOB)
      const isBuy = fullOrder.side === 'BUY';
      const bookSide = isBuy ? book.bids : book.asks;
      
      bookSide.push(fullOrder);
      
      // 5. Strict Sorting: Price Priority, then Time Priority
      if (isBuy) {
          bookSide.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
          bookSide.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }

      MarketService.updateBookMetrics(book);

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
      
      MarketService.updateBookMetrics(book);
  }

  static cancelAllOrders(state: GameState, ownerId: string, itemId: string, context?: GameContext): void {
      const book = state.market[itemId];
      if (!book) return;

      const pruneSide = (side: Order[]) => {
          for (let i = side.length - 1; i >= 0; i--) {
              if (side[i].ownerId === ownerId) {
                  const order = side[i];
                  MarketService.AssetLocker.refund(state, order, order.remainingQuantity, context);
                  order.status = 'CANCELLED';
                  side.splice(i, 1);
              }
          }
      };
      
      pruneSide(book.bids);
      pruneSide(book.asks);
      MarketService.updateBookMetrics(book);
  }

  static pruneStaleOrders(state: GameState, context: GameContext): void {
      const TTL = 5; // Reduced from 14 to 5 to clear blocks faster
      
      Object.keys(state.market).forEach(itemId => {
          const book = state.market[itemId];
          let changed = false;
          
          const prune = (side: Order[]) => {
              for (let i = side.length - 1; i >= 0; i--) {
                  if (state.day - side[i].timestamp > TTL) {
                      const order = side[i];
                      MarketService.AssetLocker.refund(state, order, order.remainingQuantity, context);
                      order.status = 'CANCELLED';
                      side.splice(i, 1);
                      changed = true;
                  }
              }
          };

          prune(book.bids);
          prune(book.asks);
          
          // Liquidity Injection (Market Maker)
          // If book is empty or spread is massive (> 50%), Treasury injects liquidity
          if (!itemId.startsWith('comp_')) {
              const spreadTooHigh = book.spread > book.lastPrice * 0.5;
              const emptyBids = book.bids.length === 0;
              const emptyAsks = book.asks.length === 0;

              if (spreadTooHigh || emptyBids || emptyAsks) {
                  const refPrice = book.lastPrice || 1.0;
                  
                  // Inject Sell (Supply)
                  if (emptyAsks || spreadTooHigh) {
                      if (state.cityTreasury.cash > 50) {
                          // Treasury creates 20 units out of thin air (Strategic Reserves)? 
                          // Or buys them first? For simplicity in "Market Maker" role, we assume pre-stock or printing.
                          // To respect conservation, let's say Treasury uses 'special reserve' permissions but we track it.
                          // Or simply: Treasury only sells if it has cash to buy back later (Shorting?).
                          // Let's stick to simple "Treasury sells slightly above market"
                          MarketService.submitOrder(state, {
                              ownerId: 'TREASURY', ownerType: 'TREASURY', itemId,
                              side: 'SELL', type: 'LIMIT',
                              price: parseFloat((refPrice * 1.2).toFixed(2)), 
                              quantity: 20
                          }, context);
                      }
                  }
                  
                  // Inject Buy (Demand)
                  if (emptyBids || spreadTooHigh) {
                      if (state.cityTreasury.cash > 50) {
                          MarketService.submitOrder(state, {
                              ownerId: 'TREASURY', ownerType: 'TREASURY', itemId,
                              side: 'BUY', type: 'LIMIT',
                              price: parseFloat(Math.max(0.1, refPrice * 0.8).toFixed(2)), 
                              quantity: 20
                          }, context);
                      }
                  }
              }
          }
          
          if (changed) MarketService.updateBookMetrics(book);
      });
  }

  private static updateBookMetrics(book: OrderBook) {
      if (book.bids.length > 0 && book.asks.length > 0) {
          const bestBid = book.bids[0].price;
          const bestAsk = book.asks[0].price;
          book.spread = bestAsk - bestBid;
          const midPrice = (bestAsk + bestBid) / 2;
          book.volatility = midPrice > 0 ? (book.spread / midPrice) : 0;
      } else {
          book.spread = 0;
          book.volatility = 0;
      }
  }

  // --- Matching Engine ---

  private static matchOrder(state: GameState, book: OrderBook, triggerOrder: Order, context?: GameContext): void {
      const isBuy = triggerOrder.side === 'BUY';
      const opposingBook = isBuy ? book.asks : book.bids;
      
      let matchCount = 0;

      // Iterate through opposing orders (best price first)
      for (let i = 0; i < opposingBook.length; i++) {
          if (matchCount >= MAX_MATCH_DEPTH) break; 

          const maker = opposingBook[i];
          
          if (triggerOrder.remainingQuantity <= 0.0001) {
              triggerOrder.status = 'EXECUTED';
              break;
          }

          if (!MarketService.canMatch(triggerOrder, maker)) break;

          // Conservation Check for Market Buys
          const matchPrice = maker.price;
          let matchQty = Math.min(triggerOrder.remainingQuantity, maker.remainingQuantity);
          
          if (triggerOrder.side === 'BUY' && triggerOrder.type === 'MARKET') {
              const maxAffordable = (triggerOrder.lockedValue || 0) / matchPrice;
              if (maxAffordable < matchQty) {
                  matchQty = Math.floor(maxAffordable * 1000) / 1000;
                  if (matchQty <= 0) break; // Out of budget
              }
          }

          // Execute Match
          MarketService.executeTradeTransfer(state, triggerOrder, maker, matchPrice, matchQty, context);

          // Deduct from Locked Values
          if (triggerOrder.side === 'BUY' && triggerOrder.lockedValue !== undefined) {
              triggerOrder.lockedValue -= (matchPrice * matchQty);
          }
          if (maker.side === 'BUY' && maker.lockedValue !== undefined) {
              maker.lockedValue -= (matchPrice * matchQty);
          }

          // Update Quantities
          maker.remainingQuantity -= matchQty;
          triggerOrder.remainingQuantity -= matchQty;

          // Update Status
          if (maker.remainingQuantity <= 0.0001) {
              maker.status = 'EXECUTED';
              matchCount++; 
          } else {
              maker.status = 'PARTIALLY_EXECUTED';
          }
          
          triggerOrder.status = triggerOrder.remainingQuantity <= 0.0001 ? 'EXECUTED' : 'PARTIALLY_EXECUTED';

          // Analytics & Taxes
          MarketService.recordTrade(state, book, triggerOrder, maker, matchPrice, matchQty);
          MarketService.updateCandle(state, triggerOrder.itemId, matchPrice, matchQty, context);
          MarketService.AssetLocker.deductTax(state, maker, triggerOrder, matchPrice, matchQty, context);
      }

      if (matchCount > 0) {
          opposingBook.splice(0, matchCount);
      }

      MarketService.handleOrderRemainder(state, book, triggerOrder, context);
      MarketService.updateBookMetrics(book);
  }

  private static canMatch(taker: Order, maker: Order): boolean {
      if (taker.type === 'LIMIT') {
          if (taker.side === 'BUY') return maker.price <= taker.price; 
          else return maker.price >= taker.price; 
      }
      return true; 
  }

  private static handleOrderRemainder(state: GameState, book: OrderBook, taker: Order, context?: GameContext): void {
      if (taker.remainingQuantity <= 0.0001) {
          taker.status = 'EXECUTED';
          MarketService.AssetLocker.refund(state, taker, 0, context);
          return;
      }

      if (taker.type === 'LIMIT') {
          if (taker.status === 'EXECUTED') {
              // Should not happen, but safe cleanup
              const side = taker.side === 'BUY' ? book.bids : book.asks;
              const idx = side.indexOf(taker);
              if (idx > -1) side.splice(idx, 1);
          }
      } else {
          // Market Order Remainder: Cancel and Refund
          MarketService.AssetLocker.refund(state, taker, taker.remainingQuantity, context);
          taker.status = 'EXECUTED'; 
          
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
      MarketService.AssetLocker.creditItem(state, buyerId, buyerType, taker.itemId, qty, context);

      // 2. Transfer Cash to Seller
      const cost = price * qty;
      MarketService.AssetLocker.creditCash(state, sellerId, sellerType, cost, context);
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
  
  public static AssetLocker = class {
      
      static lock(state: GameState, order: Order, context?: GameContext): boolean {
          if (order.side === 'BUY') return this.lockForBuy(state, order, context);
          else return this.lockForSell(state, order, context);
      }

      static refund(state: GameState, order: Order, quantityToRefund: number, context?: GameContext): void {
          if (order.side === 'BUY') {
              // Return any remaining locked cash
              const remainingCash = order.lockedValue || 0;
              if (remainingCash > 0) {
                  this.creditCash(state, order.ownerId, order.ownerType, remainingCash, context);
                  order.lockedValue = 0;
              }
          } else {
              // Return items
              if (quantityToRefund > 0) {
                  this.creditItem(state, order.ownerId, order.ownerType, order.itemId, quantityToRefund, context);
              }
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

      private static lockForBuy(state: GameState, order: Order, context?: GameContext): boolean {
          let costToLock = 0;
          if (order.type === 'LIMIT') {
              costToLock = order.price * order.quantity;
          } else {
             const book = state.market[order.itemId];
             // If book empty, assume recent price or 1.0 + 50% buffer
             const refPrice = book?.asks[0]?.price || book?.lastPrice || 1.0;
             costToLock = refPrice * order.quantity * 1.5; 
          }
          
          if (this.debitCash(state, order.ownerId, order.ownerType, costToLock, context)) {
              order.lockedValue = costToLock;
              return true;
          }
          return false;
      }

      private static lockForSell(state: GameState, order: Order, context?: GameContext): boolean {
          return this.debitItem(state, order.ownerId, order.ownerType, order.itemId, order.quantity, context);
      }

      static debitCash(state: GameState, id: string, type: string, amount: number, context?: GameContext): boolean {
          if (type === 'RESIDENT') {
              const r = context?.residentMap.get(id) || state.population.residents.find(x => x.id === id);
              if (!r || r.cash < amount) return false;
              r.cash -= amount;
              return true;
          } else if (type === 'COMPANY') {
              const c = context?.companyMap.get(id) || state.companies.find(x => x.id === id);
              // Companies can go negative temporarily (Credit), but not for Trading Locked Cash?
              // Let's strict for trading to prevent infinite leverage
              if (!c || c.cash < amount) return false;
              c.cash -= amount;
              return true;
          } else if (type === 'TREASURY') {
              // Treasury can print/overdraft if needed, but lets keep check
              if (state.cityTreasury.cash < amount) {
                  // Auto-mint if Treasury empty to prevent deadlock (Seigniorage)
                  if(state.bank.system !== 'GOLD_STANDARD') {
                      state.bank.reserves += amount;
                      state.cityTreasury.cash += amount;
                      state.economicOverview.totalSystemGold += amount;
                  } else {
                      return false;
                  }
              }
              state.cityTreasury.cash -= amount;
              return true;
          }
          return false;
      }

      static creditCash(state: GameState, id: string, type: string, amount: number, context?: GameContext) {
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
                  const currentShares = r.portfolio[itemId] || 0;
                  if (r.isPlayer) {
                      r.portfolio[itemId] = currentShares - qty;
                      return true;
                  } else {
                      if (currentShares < qty) return false;
                      r.portfolio[itemId] = currentShares - qty;
                      return true;
                  }
              } else {
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
          } else if (type === 'TREASURY') {
              // Treasury assumes supply
              return true; 
          }
          return false;
      }

      static creditItem(state: GameState, id: string, type: string, itemId: string, qty: number, context?: GameContext) {
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
