
import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { useGameStore } from '../../shared/store/useGameStore';
import { Company } from '../../shared/types';

export const CompetitionMatrix: React.FC = () => {
  const companies = useGameStore(s => s.gameState.companies);

  const data = companies.map(c => {
      // X: Market Share proxy (Sales Volume)
      // Y: Profitability (Margin or ROE)
      // Z: Size (Market Cap)
      const marketCap = c.sharePrice * c.totalShares;
      return {
          id: c.id,
          name: c.name,
          x: c.monthlySalesVolume, // Market Share Proxy
          y: (c.margin || 0) * 100, // Profit Margin %
          z: marketCap, // Bubble Size
          color: c.isPlayerFounded ? '#3b82f6' : c.isBankrupt ? '#ef4444' : '#10b981'
      };
  }).filter(d => !d.name.includes('Bankrupt')); // Optional filter

  const avgSales = data.reduce((s, d) => s + d.x, 0) / (data.length || 1);
  const avgMargin = data.reduce((s, d) => s + d.y, 0) / (data.length || 1);

  const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
          const d = payload[0].payload;
          return (
              <div className="bg-stone-900 border border-stone-700 p-2 rounded shadow-xl text-xs font-mono z-50">
                  <div className="font-bold text-white mb-1">{d.name}</div>
                  <div>Sales Vol: {d.x}</div>
                  <div>Margin: {d.y.toFixed(1)}%</div>
                  <div>Valuation: {Math.floor(d.z)} oz</div>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="h-96 w-full bg-stone-900 border border-stone-800 rounded-xl p-4 relative">
        <h3 className="text-sm font-bold text-stone-400 absolute top-4 left-4 z-10">竞争格局矩阵 (Competition Matrix)</h3>
        <div className="absolute top-4 right-4 text-[10px] text-stone-600 flex flex-col items-end z-10">
            <span>Size = Market Cap</span>
            <span>X = Sales Vol, Y = Profit Margin</span>
        </div>
        
        <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" dataKey="x" name="Sales" stroke="#666" label={{ value: '市场份额 (销量)', position: 'bottom', fill: '#666', fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Margin" stroke="#666" label={{ value: '利润率 (%)', angle: -90, position: 'left', fill: '#666', fontSize: 10 }} />
                <ZAxis type="number" dataKey="z" range={[50, 500]} name="Market Cap" />
                
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                
                {/* Quadrant Lines */}
                <ReferenceLine x={avgSales} stroke="#555" strokeDasharray="5 5" />
                <ReferenceLine y={avgMargin} stroke="#555" strokeDasharray="5 5" />

                {/* Quadrant Labels */}
                <text x="95%" y="5%" textAnchor="end" fill="#10b981" fontSize="10" opacity={0.5}>★ STARS</text>
                <text x="5%" y="5%" textAnchor="start" fill="#f59e0b" fontSize="10" opacity={0.5}>? QUESTION MARKS</text>
                <text x="95%" y="95%" textAnchor="end" fill="#3b82f6" fontSize="10" opacity={0.5}>$ CASH COWS</text>
                <text x="5%" y="95%" textAnchor="start" fill="#ef4444" fontSize="10" opacity={0.5}>✘ DOGS</text>

                <Scatter name="Companies" data={data}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.7} stroke="#fff" strokeWidth={1} />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    </div>
  );
};
