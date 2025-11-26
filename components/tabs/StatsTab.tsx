
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { GameState, IndustryStat, ResourceType, ProductType, EconomicSnapshot } from '../../types';
import { Card } from '../Card';
import { RESOURCE_ICONS } from '../../shared/assets';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatsTabProps {
  gameState: GameState;
  industryStats: IndustryStat[];
}

const NAME_MAP: Record<string, string> = {
  [ResourceType.GRAIN]: "粮食",
  [ProductType.BREAD]: "面包"
};

export const StatsTab: React.FC<StatsTabProps> = ({ gameState }) => {
  const { economicOverview } = gameState;
  
  const goldDistribution = [
      { name: '居民现金', value: economicOverview.totalResidentCash },
      { name: '企业现金', value: economicOverview.totalCorporateCash },
      { name: '国库', value: economicOverview.totalCityCash }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#dc2626'];

  // Calculate Macro Indicators
  const cpi = (gameState.resources[ResourceType.GRAIN].currentPrice + gameState.products[ProductType.BREAD].marketPrice).toFixed(2);
  const unemploymentRate = ((gameState.population.residents.filter(r => r.job === 'UNEMPLOYED' || r.job === 'FARMER' && r.employerId === undefined).length - 19) / gameState.population.total * 100).toFixed(1); // Rough estimate, treating subsistence farmers as "employed" but looking for surplus labor

  return (
    <div className="space-y-6 animate-in fade-in">
      <Card title="📜 经济审计总账 (实物守恒)" className="bg-stone-950 border-stone-800 border-2 border-double">
          <div className="p-4 bg-stone-900/50 mb-4 rounded border border-stone-800 text-sm text-stone-400">
              <p>每日总消耗：约 100 单位食物。如果总产出低于 100，必有人挨饿。</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2 mb-6">
             <div className="bg-stone-900 p-3 rounded border border-stone-800 border-l-4 border-l-amber-500">
                 <div className="text-[10px] text-stone-500">货币供应 (M0)</div>
                 <div className="text-xl font-mono text-amber-500 font-bold">{Math.floor(economicOverview.totalSystemGold).toLocaleString()} oz</div>
             </div>
             <div className="bg-stone-900 p-3 rounded border border-stone-800 border-l-4 border-l-purple-500">
                 <div className="text-[10px] text-stone-500">CPI (物价指数)</div>
                 <div className="text-xl font-mono text-purple-400 font-bold">{cpi}</div>
             </div>
             <div className="bg-stone-900 p-3 rounded border border-stone-800 border-l-4 border-l-orange-500">
                 <div className="text-[10px] text-stone-500">平均工资</div>
                 <div className="text-xl font-mono text-orange-400 font-bold">{gameState.population.averageWage.toFixed(2)} oz</div>
             </div>
             <div className="bg-stone-900 p-3 rounded border border-stone-800 border-l-4 border-l-emerald-500">
                 <div className="text-[10px] text-stone-500">企业总现金</div>
                 <div className="text-lg font-mono text-emerald-400">{Math.floor(economicOverview.totalCorporateCash).toLocaleString()} oz</div>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-stone-400">
                 <thead className="text-xs uppercase bg-stone-900 text-stone-500">
                     <tr>
                         <th className="px-3 py-2">商品</th>
                         <th className="px-3 py-2 text-right">总量 (Stock)</th>
                         <th className="px-3 py-2 text-right text-emerald-500">今日产出</th>
                         <th className="px-3 py-2 text-right text-red-500">今日消耗</th>
                         <th className="px-3 py-2 text-right text-stone-500">腐败/损耗</th>
                         <th className="px-3 py-2 text-right text-blue-400">居民仓</th>
                         <th className="px-3 py-2 text-right text-emerald-400">企业仓</th>
                         <th className="px-3 py-2 text-right text-amber-400">市场</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-stone-800">
                     {Object.entries(economicOverview.inventoryAudit).map(([key, rawData]) => {
                         const data = rawData as EconomicSnapshot['inventoryAudit'][string];
                         const netFlow = data.produced - data.consumed - (data.spoiled || 0);
                         return (
                         <tr key={key} className="hover:bg-stone-900">
                             <td className="px-3 py-2 flex items-center gap-2">
                                {/* @ts-ignore */}
                                {RESOURCE_ICONS[key]} <span className="text-white">{NAME_MAP[key] || key}</span>
                             </td>
                             <td className="px-3 py-2 text-right font-mono font-bold text-white flex items-center justify-end gap-1">
                                {Math.floor(data.total)}
                                {netFlow > 0 && <ArrowUp size={10} className="text-emerald-500"/>}
                                {netFlow < 0 && <ArrowDown size={10} className="text-red-500"/>}
                             </td>
                             <td className="px-3 py-2 text-right font-mono text-emerald-500">+{Math.floor(data.produced)}</td>
                             <td className="px-3 py-2 text-right font-mono text-red-500">-{Math.floor(data.consumed)}</td>
                             <td className="px-3 py-2 text-right font-mono text-stone-500">-{Math.floor(data.spoiled || 0)}</td>
                             <td className="px-3 py-2 text-right font-mono text-blue-300">{Math.floor(data.residents)}</td>
                             <td className="px-3 py-2 text-right font-mono text-emerald-300">{Math.floor(data.companies)}</td>
                             <td className="px-3 py-2 text-right font-mono text-amber-300">{Math.floor(data.market)}</td>
                         </tr>
                     )})}
                 </tbody>
             </table>
          </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="财富分布" className="h-80 bg-stone-900 border-stone-800">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={goldDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={2} dataKey="value">
                    {goldDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#1c1917', border: '1px solid #444'}} formatter={(value: number) => `${value.toLocaleString()} oz`} />
                  <Legend verticalAlign="bottom"/>
                </PieChart>
            </ResponsiveContainer>
          </Card>
      </div>
    </div>
  );
};
