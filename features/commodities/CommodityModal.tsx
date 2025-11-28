

import React from 'react';
import { ResourceItem, ProductItem, OrderBook } from '../../shared/types';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
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
             <div className="w-full lg:w-[300px] bg-stone-900 flex flex-col h-[250px] lg:h-auto">
                 <div className="p-2 bg-stone-800 text-xs font-bold text-stone-400 flex justify-between">
                     <span>价格 (Price)</span>
                     <span>数量 (Size)</span>
                 </div>
                 
                 {/* Asks (Sells) */}
                 <div className="flex-1 overflow-y-auto flex flex-col-reverse custom-scrollbar border-b border-stone-800 min-h-0">
                    {book.asks.slice(0, 15).reverse().map((order, i) => (
                        <div key={order.id} className="flex justify-between px-2 py-1 text-xs font-mono hover:bg-stone-800">
                             <span className="text-red-400">{order.price.toFixed(2)}</span>
                             <span className="text-stone-300">{(order.remainingQuantity).toFixed(0)}</span>
                        </div>
                    ))}
                 </div>

                 {/* Spread Info */}
                 <div className="p-2 bg-stone-950 text-center font-mono text-sm border-y border-stone-800 shrink-0">
                     <span className="text-stone-500">价差: </span>
                     <span className="text-white">
                         {book.asks.length > 0 && book.bids.length > 0 
                            ? (book.asks[0].price - book.bids[0].price).toFixed(2) 
                            : '-'}
                     </span>
                 </div>

                 {/* Bids (Buys) */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {book.bids.slice(0, 15).map((order, i) => (
                        <div key={order.id} className="flex justify-between px-2 py-1 text-xs font-mono hover:bg-stone-800">
                             <span className="text-emerald-400">{order.price.toFixed(2)}</span>
                             <span className="text-stone-300">{(order.remainingQuantity).toFixed(0)}</span>
                        </div>
                    ))}
                 </div>
             </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 bg-stone-900 border-t border-stone-800 grid grid-cols-2 gap-4 shrink-0">
              <div className="flex flex-col justify-center text-xs text-stone-500 px-2">
                 <div className="flex justify-between">
                    <span>余额</span>
                    <span className="text-amber-400">{cash.toFixed(1)} oz</span>
                 </div>
                 <div className="flex justify-between">
                     <span>库存</span>
                     <span className="text-blue-300">{item.owned}</span>
                 </div>
              </div>
              <div className="flex gap-2">
                  <Button className="flex-1 h-10 sm:h-12 text-sm sm:text-lg" variant="success" onClick={() => onTrade('buy', item.id)} disabled={cash < currentPrice}>
                     买入
                  </Button>
                  <Button className="flex-1 h-10 sm:h-12 text-sm sm:text-lg" variant="danger" onClick={() => onTrade('sell', item.id)} disabled={item.owned <= 0}>
                     卖出
                  </Button>
              </div>
          </div>
      </motion.div>
    </motion.div>
  );
};