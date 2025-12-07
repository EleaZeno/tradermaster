
import React, { useState, useMemo } from 'react';
import { ResourceItem, ProductItem, IndustryType, ResourceType, ProductType } from '../../shared/types';
import { RESOURCE_ICONS } from '../../shared/assets';
import { Card } from '../../shared/components';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { CommodityModal } from './CommodityModal';
import { FuturesPanel } from './FuturesPanel'; 
import { useGameStore } from '../../shared/store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export const CommoditiesTab: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<ResourceItem | ProductItem | null>(null);

  const resources = useGameStore(s => s.gameState.resources);
  const products = useGameStore(s => s.gameState.products);
  const cash = useGameStore(s => s.gameState.cash);
  const market = useGameStore(s => s.gameState.market);
  
  const trade = useGameStore(s => s.trade);

  const renderMiniChart = (history: any[], color: string, id: string) => (
    <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history}>
            <defs>
                <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
            </defs>
            <Area 
                type="monotone" 
                dataKey="close" 
                stroke={color} 
                fill={`url(#gradient-${id})`} 
                strokeWidth={2} 
                isAnimationActive={false}
            />
            <YAxis domain={['auto', 'auto']} hide />
        </AreaChart>
    </ResponsiveContainer>
  );

  const getTrendColor = (history: any[]) => {
      if (history.length < 2) return '#9ca3af';
      const start = history[0].close;
      const end = history[history.length - 1].close;
      return end >= start ? '#10b981' : '#f59e0b';
  };

  const allItems = [...Object.values(resources), ...Object.values(products)] as (ResourceItem | ProductItem)[];

  // Market Health Status
  const isMarketFrozen = useMemo(() => {
      const grainBook = market[ResourceType.GRAIN];
      const breadBook = market[ProductType.BREAD];
      // Frozen if no asks in either major market
      return (grainBook && grainBook.asks.length === 0) || (breadBook && breadBook.asks.length === 0);
  }, [market]);

  return (
    <div className="space-y-8 animate-in fade-in pb-10">
      <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-stone-100 flex items-center gap-2">
                <span className="bg-emerald-600 w-2 h-6 rounded-full"></span>
                商品现货 (Spot Commodities)
            </h3>
            {isMarketFrozen ? (
                <div className="flex items-center gap-2 bg-red-950/50 text-red-400 px-3 py-1 rounded border border-red-900 text-xs font-bold animate-pulse">
                    <AlertTriangle size={14} /> LIQUIDITY CRISIS: MARKETS FROZEN
                </div>
            ) : (
                <div className="flex items-center gap-2 bg-emerald-950/50 text-emerald-400 px-3 py-1 rounded border border-emerald-900 text-xs font-bold">
                    <CheckCircle2 size={14} /> MARKET ACTIVE
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allItems.map((item) => {
              const color = getTrendColor(item.history);
              const price = item.history.length > 0 ? item.history[item.history.length - 1].close : 0;
              const prevPrice = item.history.length > 10 ? item.history[item.history.length - 10].close : price;
              const change = ((price - prevPrice) / prevPrice) * 100;
              
              const book = market[item.id];
              const asks = book ? book.asks.reduce((s, o) => s + o.remainingQuantity, 0) : 0;

              return (
              <Card 
                key={item.id} 
                className="border-stone-800 bg-stone-900 relative overflow-hidden group hover:border-stone-600 transition-all cursor-pointer hover:shadow-lg hover:shadow-stone-900/50"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex justify-between items-center mb-2 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-stone-800/80 backdrop-blur rounded-lg border border-stone-700 shadow-sm">{RESOURCE_ICONS[item.id]}</div>
                      <div>
                        <span className="font-bold block text-lg">{item.name}</span>
                        <span className="text-xl font-mono text-white block font-bold mt-1">{price.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-xs font-bold ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono mt-1">
                             Vol: {item.dailySales}
                        </div>
                    </div>
                </div>

                <div className="h-24 -mx-5 -mb-2 relative z-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {renderMiniChart(item.history, color, item.id)}
                </div>

                <div className="absolute bottom-3 left-4 right-4 flex justify-between text-xs text-stone-500 font-mono z-10 pointer-events-none">
                     <span>Own: {item.owned || 0}</span>
                     <span className={asks === 0 ? "text-red-500 font-bold" : "text-emerald-500"}>
                        Supply: {Math.floor(asks)}
                     </span>
                </div>
              </Card>
          )})}
        </div>
      </div>

      <div className="border-t border-stone-800 pt-6">
          <FuturesPanel resources={resources} />
      </div>

      {selectedItem && (
          <CommodityModal 
            item={selectedItem} 
            cash={cash} 
            onClose={() => setSelectedItem(null)} 
            onTrade={(type, id) => {
                trade(type, id);
            }}
          />
      )}
    </div>
  );
};
