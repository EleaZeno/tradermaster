
import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { LandPlot } from '../../shared/types';
import { Card } from '../../shared/components';
import { useShallow } from 'zustand/react/shallow';
import { TreePine, Home, Factory, ShoppingBag, Lock } from 'lucide-react';

export const MapPanel: React.FC = () => {
  const map = useGameStore(s => s.gameState.map);
  const player = useGameStore(useShallow(s => s.gameState.population.residents.find(r => r.isPlayer)));
  const buyPlot = useGameStore(s => s.buyPlot);
  
  if (!map) return <div>No Map Data</div>;

  const gridSize = Math.sqrt(map.length);

  const getPlotColor = (plot: LandPlot) => {
      if (plot.ownerId === player?.id) return 'bg-blue-600 border-blue-400';
      if (plot.ownerId) return 'bg-stone-800 border-stone-600 opacity-50'; // Owned by others
      if (plot.type === 'AGRICULTURAL') return 'bg-amber-900/40 border-amber-800 hover:bg-amber-800/60 cursor-pointer';
      return 'bg-stone-800/40 border-stone-700 hover:bg-stone-700/60 cursor-pointer';
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'AGRICULTURAL': return <TreePine size={16} className="text-amber-500"/>;
          case 'RESIDENTIAL': return <Home size={16} className="text-stone-400"/>;
          case 'INDUSTRIAL': return <Factory size={16} className="text-orange-500"/>;
          default: return <ShoppingBag size={16}/>;
      }
  };

  const handleBuy = (plot: LandPlot) => {
      if (plot.ownerId) return;
      if (player && player.cash >= plot.price) {
          buyPlot(plot.id);
      }
  };

  return (
    <Card title="城市规划 (Land Map)" className="bg-stone-950 border-stone-800">
        <div className="flex gap-6">
            <div 
                className="grid gap-1 p-2 bg-stone-900 rounded-lg border border-stone-800 shadow-inner"
                style={{ 
                    gridTemplateColumns: `repeat(${gridSize}, minmax(40px, 1fr))`,
                    width: 'fit-content'
                }}
            >
                {map.map(plot => (
                    <div 
                        key={plot.id}
                        onClick={() => handleBuy(plot)}
                        className={`w-12 h-12 rounded border flex flex-col items-center justify-center relative transition-colors ${getPlotColor(plot)}`}
                        title={`Plot ${plot.x},${plot.y} - ${plot.type}\nPrice: ${plot.price}`}
                    >
                        {getIcon(plot.type)}
                        {plot.ownerId && <Lock size={10} className="absolute top-1 right-1 text-stone-500"/>}
                        {!plot.ownerId && <span className="text-[9px] text-stone-500 mt-1">${plot.price}</span>}
                    </div>
                ))}
            </div>

            <div className="flex-1 space-y-4">
                <div className="bg-stone-900 p-4 rounded border border-stone-800">
                    <h4 className="text-sm font-bold text-stone-300 mb-2">地块信息</h4>
                    <ul className="text-xs text-stone-400 space-y-2">
                        <li className="flex items-center gap-2"><TreePine size={14}/> 农业用地: 购买后可增加种植效率</li>
                        <li className="flex items-center gap-2"><Home size={14}/> 居住用地: 购买后可出租给居民 (Coming Soon)</li>
                        <li className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div> 蓝色代表已拥有</li>
                    </ul>
                </div>
                <div className="bg-stone-900 p-4 rounded border border-stone-800">
                    <h4 className="text-sm font-bold text-stone-300 mb-2">我的资产</h4>
                    <div className="text-xs text-stone-400">
                        持有地块: {map.filter(p => p.ownerId === player?.id).length}
                    </div>
                </div>
            </div>
        </div>
    </Card>
  );
};
    