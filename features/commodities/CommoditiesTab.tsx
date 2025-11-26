import React, { useState } from 'react';
import { ResourceType, ResourceItem, ProductType, ProductItem, FuturesContract, IndustryType } from '../../shared/types';
import { RESOURCE_ICONS } from '../../constants';
import { Card } from '../../shared/components';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { CommodityModal } from './CommodityModal';

interface CommoditiesTabProps {
  resources: Record<ResourceType, ResourceItem>;
  products: Record<ProductType, ProductItem>;
  cash: number;
  futures: FuturesContract[];
  day: number;
  onTrade: (type: 'buy' | 'sell', itemId: IndustryType) => void;
  onBuyFutures: (resId: ResourceType, type: 'LONG' | 'SHORT') => void;
}

export const CommoditiesTab: React.FC<CommoditiesTabProps> = ({ resources, products, cash, futures, day, onTrade, onBuyFutures }) => {
  const [selectedItem, setSelectedItem] = useState<ResourceItem | ProductItem | null>(null);

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

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h3 className="text-xl font-bold text-stone-100 mb-4 flex items-center gap-2">
            <span className="bg-emerald-600 w-2 h-6 rounded-full"></span>
            商品现货 (Commodities)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allItems.map((item) => {
              const color = getTrendColor(item.history);
              const price = item.history.length > 0 ? item.history[item.history.length - 1].close : 0;
              const prevPrice = item.history.length > 10 ? item.history[item.history.length - 10].close : price;
              const change = ((price - prevPrice) / prevPrice) * 100;

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
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono">Spot Market</span>
                      </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-mono text-white block font-bold">{price.toFixed(2)}</span>
                        <div className={`text-xs font-bold ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div className="h-24 -mx-5 -mb-2 relative z-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {renderMiniChart(item.history, color, item.id)}
                </div>

                <div className="absolute bottom-3 left-4 right-4 flex justify-between text-xs text-stone-500 font-mono z-10 pointer-events-none">
                     <span>Vol: {item.dailySales}</span>
                     <span>Own: {item.owned || 0}</span>
                </div>
              </Card>
          )})}
        </div>
      </div>

      {selectedItem && (
          <CommodityModal 
            item={selectedItem} 
            cash={cash} 
            onClose={() => setSelectedItem(null)} 
            onTrade={(type, id) => {
                onTrade(type, id);
            }}
          />
      )}
    </div>
  );
};