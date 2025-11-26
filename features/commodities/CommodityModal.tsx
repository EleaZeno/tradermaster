import React from 'react';
import { ResourceItem, ProductItem } from '../../shared/types';
import { Card, Button } from '../../shared/components';
import { KLineChart } from '../../shared/components/charts/KLineChart';
import { X, TrendingUp } from 'lucide-react';

interface CommodityModalProps {
  item: ResourceItem | ProductItem;
  cash: number;
  onClose: () => void;
  onTrade: (type: 'buy' | 'sell', item: any) => void;
}

export const CommodityModal: React.FC<CommodityModalProps> = ({ item, cash, onClose, onTrade }) => {
  const currentPrice = item.history.length > 0 ? item.history[item.history.length - 1].close : 0;
  const openPrice = item.history.length > 0 ? item.history[item.history.length - 1].open : 0;
  const change = ((currentPrice - openPrice) / openPrice) * 100;
  const isRising = change >= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[800px] bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900">
             <div className="flex items-center gap-3">
                 <div className="bg-stone-800 p-2 rounded-lg border border-stone-700">
                    <TrendingUp size={24} className={isRising ? "text-emerald-400" : "text-red-400"} />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white tracking-tight">{item.name}</h2>
                     <div className="flex items-center gap-2 text-sm font-mono">
                         <span className="text-2xl text-white">{currentPrice.toFixed(2)}</span>
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

          <div className="flex-1 p-6 bg-stone-950/50">
             <div className="h-[350px] w-full">
                 <KLineChart data={item.history} height={350} />
             </div>
             <div className="flex justify-center gap-6 mt-4 text-xs text-stone-500 font-mono">
                 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> MA5</div>
                 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Vol</div>
             </div>
          </div>

          <div className="p-4 bg-stone-900 border-t border-stone-800 grid grid-cols-2 gap-4">
              <div className="flex flex-col justify-center text-xs text-stone-500 px-2">
                 <div className="flex justify-between mb-1">
                    <span>Market Depth</span>
                    <span className="text-stone-300">{Math.floor(item.marketInventory)} units</span>
                 </div>
                 <div className="flex justify-between">
                    <span>Your Balance</span>
                    <span className="text-amber-400">{cash.toFixed(1)} oz</span>
                 </div>
              </div>
              <div className="flex gap-2">
                  <Button className="flex-1 h-12 text-lg" variant="success" onClick={() => onTrade('buy', item.id)} disabled={cash < currentPrice}>
                     Buy
                  </Button>
                  <Button className="flex-1 h-12 text-lg" variant="danger" onClick={() => onTrade('sell', item.id)} disabled={item.owned <= 0}>
                     Sell
                  </Button>
              </div>
          </div>
      </div>
    </div>
  );
};