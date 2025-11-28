
import React from 'react';
import { ResourceItem, ProductItem } from '../../shared/types';
import { useGameStore } from '../../shared/store/useGameStore';
import { Button } from '../../shared/components';
import { KLineChart } from '../../shared/components/charts/KLineChart';
import { X, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface CommodityModalProps {
  item: ResourceItem | ProductItem;
  cash: number;
  onClose: () => void;
  onTrade: (type: 'buy' | 'sell', item: any) => void;
}

export const CommodityModal: React.FC<CommodityModalProps> = ({ item, cash, onClose, onTrade }) => {
  const gameState = useGameStore(s => s.gameState);
  const book = gameState.market[item.id] || { bids: [], asks: [], lastPrice: 0, history: [] };

  const currentPrice = item.history.length > 0 ? item.history[item.history.length - 1].close : 0;
  const openPrice = item.history.length > 0 ? item.history[item.history.length - 1].open : 0;
  const change = ((currentPrice - openPrice) / openPrice) * 100;
  const isRising = change >= 0;

  // Calculate max volume for depth bars normalization
  const maxBidVol = Math.max(...book.bids.slice(0, 15).map(o => o.remainingQuantity), 1);
  const maxAskVol = Math.max(...book.asks.slice(0, 15).map(o => o.remainingQuantity), 1);
  const maxVol = Math.max(maxBidVol, maxAskVol);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-5xl bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900">
             <div className="flex items-center gap-3">
                 <div className="bg-stone-800 p-2 rounded-lg border border-stone-700 hidden sm:block">
                    <TrendingUp size={24} className={isRising ? "text-emerald-400" : "text-red-400"} />
                 </div>
                 <div>
                     <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                        {item.name} 
                        <span className="text-stone-500 text-xs font-normal">订单簿交易 (LOB)</span>
                     </h2>
                     <div className="flex items-center gap-2 text-sm font-mono mt-1">
                         <span className="text-xl sm:text-2xl text-white">{currentPrice.toFixed(2)}</span>
                         <span className={`px-1.5 py-0.5 rounded ${isRising ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                             {change > 0 ? '+' : ''}{change.toFixed(2)}%
                         </span>
                     </div>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full transition-colors">
                 <X size={20} className="text-stone-400" />
             </button>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
             {/* Chart */}
             <div className="flex-1 p-2 sm:p-4 bg-stone-950/50 border-b lg:border-b-0 lg:border-r border-stone-800 flex flex-col min-h-[300px] lg:min-h-0 relative overflow-hidden">
                 <div className="absolute inset-4 overflow-hidden">
                     <KLineChart data={item.history} height="100%" />
                 </div>
             </div>

             {/* Order Book */}
             <div className="w-full lg:w-[320px] bg-stone-900 flex flex-col h-[300px] lg:h-auto border-l border-stone-800">
                 <div className="p-2 bg-stone-800 text-xs font-bold text-stone-400 flex justify-between uppercase tracking-wider">
                     <span>Price (oz)</span>
                     <span>Qty</span>
                 </div>
                 
                 {/* Asks (Sells) - Typically displayed top-down from High to Low, or reverse. 
                     Standard Vertical LOB: Asks on top (High -> Low), Bids on bottom (High -> Low)
                     But visually it's often: Asks (High -> Low) ... Mid Price ... Bids (High -> Low)
                     Let's do: Asks (Reverse: High to Low) then Bids.
                 */}
                 <div className="flex-1 overflow-y-auto flex flex-col-reverse custom-scrollbar min-h-0 relative">
                    {book.asks.slice(0, 15).reverse().map((order) => (
                        <div key={order.id} className="flex justify-between px-2 py-0.5 text-xs font-mono hover:bg-stone-800 relative group">
                             {/* Depth Bar */}
                             <div 
                                className="absolute right-0 top-0 bottom-0 bg-red-900/20 transition-all duration-300" 
                                style={{ width: `${(order.remainingQuantity / maxVol) * 100}%` }}
                             ></div>
                             
                             <span className="text-red-400 relative z-10">{order.price.toFixed(2)}</span>
                             <span className="text-stone-300 relative z-10">{(order.remainingQuantity).toFixed(0)}</span>
                        </div>
                    ))}
                    {book.asks.length === 0 && <div className="text-center text-stone-600 text-xs py-4 flex-1 flex items-center justify-center">无卖盘 (No Sellers)</div>}
                 </div>

                 {/* Spread Info */}
                 <div className="p-2 bg-stone-950 text-center font-mono text-sm border-y border-stone-800 shrink-0 z-10 shadow-sm flex justify-between items-center px-4">
                     <span className="text-stone-500 text-xs">SPREAD</span>
                     <span className="text-white font-bold">
                         {book.asks.length > 0 && book.bids.length > 0 
                            ? (book.asks[0].price - book.bids[0].price).toFixed(2) 
                            : '-'}
                     </span>
                 </div>

                 {/* Bids (Buys) */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 relative">
                    {book.bids.slice(0, 15).map((order) => (
                        <div key={order.id} className="flex justify-between px-2 py-0.5 text-xs font-mono hover:bg-stone-800 relative group">
                             {/* Depth Bar */}
                             <div 
                                className="absolute right-0 top-0 bottom-0 bg-emerald-900/20 transition-all duration-300" 
                                style={{ width: `${(order.remainingQuantity / maxVol) * 100}%` }}
                             ></div>

                             <span className="text-emerald-400 relative z-10">{order.price.toFixed(2)}</span>
                             <span className="text-stone-300 relative z-10">{(order.remainingQuantity).toFixed(0)}</span>
                        </div>
                    ))}
                    {book.bids.length === 0 && <div className="text-center text-stone-600 text-xs py-4">无买盘 (No Buyers)</div>}
                 </div>
             </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 bg-stone-900 border-t border-stone-800 grid grid-cols-2 gap-4 shrink-0">
              <div className="flex flex-col justify-center text-xs text-stone-500 px-2">
                 <div className="flex justify-between mb-1">
                    <span>可用资金</span>
                    <span className="text-amber-400 font-mono text-sm">{cash.toFixed(1)} oz</span>
                 </div>
                 <div className="flex justify-between">
                     <span>持有库存</span>
                     <span className="text-blue-300 font-mono text-sm">{item.owned}</span>
                 </div>
              </div>
              <div className="flex gap-2">
                  <Button className="flex-1 h-10 sm:h-12 text-sm sm:text-lg" variant="success" onClick={() => onTrade('buy', item.id)} disabled={cash < currentPrice}>
                     买入 (Buy)
                  </Button>
                  <Button className="flex-1 h-10 sm:h-12 text-sm sm:text-lg" variant="danger" onClick={() => onTrade('sell', item.id)} disabled={item.owned <= 0}>
                     卖出 (Sell)
                  </Button>
              </div>
          </div>
      </motion.div>
    </motion.div>
  );
};
