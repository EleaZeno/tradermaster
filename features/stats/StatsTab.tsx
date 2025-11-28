

import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ResourceType, ProductType, EconomicSnapshot } from '../../shared/types';
import { Card } from '../../shared/components';
import { RESOURCE_ICONS } from '../../shared/assets';
import { useGameStore } from '../../shared/store/useGameStore';
import { SupplyChainViz } from './SupplyChainViz';
import { CompetitionMatrix } from './CompetitionMatrix';
import { 
  ArrowUp, ArrowDown, Coins, Factory, Scale, AlertCircle, ShoppingCart, Package, Users, PieChart as PieChartIcon, Landmark, Smile, Baby, UserMinus
} from 'lucide-react';

const NAME_MAP: Record<string, string> = {
  [ResourceType.GRAIN]: "粮食",
  [ProductType.BREAD]: "面包"
};

export const StatsTab: React.FC = () => {
  const economicOverview = useGameStore(s => s.gameState.economicOverview);
  const population = useGameStore(s => s.gameState.population);
  const companies = useGameStore(s => s.gameState.companies);
  const cityTreasury = useGameStore(s => s.gameState.cityTreasury);
  const resources = useGameStore(s => s.gameState.resources);
  const products = useGameStore(s => s.gameState.products);
  
  const totalResidentCash = population.residents.reduce((sum, r) => sum + r.cash, 0);
  const totalCorporateCash = companies.reduce((sum, c) => sum + c.cash, 0);
  const totalCityCash = cityTreasury.cash;
  const totalSystemGold = totalResidentCash + totalCorporateCash + totalCityCash;

  const moneySupplyData = [
      { name: '居民持有', value: totalResidentCash, color: '#3b82f6' }, 
      { name: '企业持有', value: totalCorporateCash, color: '#10b981' }, 
      { name: '国库持有', value: totalCityCash, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const classData = useMemo(() => {
      const sorted = [...population.residents].sort((a, b) => a.cash - b.cash);
      const poor = sorted.filter(r => r.cash < 50).length;
      const middle = sorted.filter(r => r.cash >= 50 && r.cash < 300).length;
      const rich = sorted.filter(r => r.cash >= 300).length;

      return [
          { name: '底层 (<50oz)', value: poor, color: '#94a3b8' },   
          { name: '中产 (50-300oz)', value: middle, color: '#60a5fa' }, 
          { name: '富裕 (>300oz)', value: rich, color: '#f43f5e' }    
      ].filter(d => d.value > 0);
  }, [population.residents]);

  const cpi = (resources[ResourceType.GRAIN].currentPrice + products[ProductType.BREAD].marketPrice).toFixed(2);
  const sentiment = population.consumerSentiment || 50;

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Macro Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-stone-900 border-stone-800 border-l-4 border-l-amber-500">
             <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-amber-950/50 rounded-lg text-amber-500"><Coins size={18}/></div>
                 <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">货币供应 (M0)</div>
             </div>
             <div className="text-2xl font-mono text-amber-400 font-bold ml-1">{Math.floor(totalSystemGold).toLocaleString()} <span className="text-sm text-stone-600">oz</span></div>
          </Card>

          <Card className="bg-stone-900 border-stone-800 border-l-4 border-l-purple-500">
             <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-purple-950/50 rounded-lg text-purple-400"><Scale size={18}/></div>
                 <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">CPI 物价指数</div>
             </div>
             <div className="text-2xl font-mono text-purple-400 font-bold ml-1">{cpi}</div>
          </Card>

          <Card className="bg-stone-900 border-stone-800 border-l-4 border-l-pink-500">
             <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-pink-950/50 rounded-lg text-pink-400"><Smile size={18}/></div>
                 <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">消费者信心</div>
             </div>
             <div className="text-2xl font-mono text-pink-400 font-bold ml-1">{sentiment} <span className="text-sm text-stone-600">/ 100</span></div>
          </Card>

          <Card className="bg-stone-900 border-stone-800 border-l-4 border-l-emerald-500">
             <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-emerald-950/50 rounded-lg text-emerald-400"><Factory size={18}/></div>
                 <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">企业总现金</div>
             </div>
             <div className="text-2xl font-mono text-emerald-400 font-bold ml-1">{Math.floor(totalCorporateCash).toLocaleString()} <span className="text-sm text-stone-600">oz</span></div>
          </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="产业链全景图 (Supply Chain)" className="bg-stone-900 border-stone-800">
              <SupplyChainViz />
          </Card>
          <CompetitionMatrix />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="货币供应分布 (Money Supply)" className="bg-stone-900 border-stone-800 h-80">
             <div className="w-full h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie data={moneySupplyData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                        {moneySupplyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor:'#1c1917', border: '1px solid #444', borderRadius: '8px'}} formatter={(value: number) => `${Math.floor(value).toLocaleString()} oz`} />
                    <Legend verticalAlign="bottom" iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
          </Card>

          <Card title="社会阶层结构 (Class Structure)" className="bg-stone-900 border-stone-800 h-80">
             <div className="w-full h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie data={classData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                        {classData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor:'#1c1917', border: '1px solid #444', borderRadius: '8px'}} />
                    <Legend verticalAlign="bottom" iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
             </div>
          </Card>
      </div>

      <Card 
        title="📜 经济审计总账 (实物守恒 Audit)" 
        className="bg-stone-950 border-stone-800 border-2 border-double"
        action={<div className="flex items-center gap-1 text-xs text-stone-500"><AlertCircle size={12}/> 数据实时监控</div>}
      >
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-stone-400">
                 <thead className="text-xs uppercase bg-stone-900 text-stone-500">
                     <tr>
                         <th className="px-3 py-3 rounded-tl-lg">商品</th>
                         <th className="px-3 py-3 text-right"><div className="flex items-center justify-end gap-1"><Package size={12}/> 总量</div></th>
                         <th className="px-3 py-3 text-right text-emerald-500"><div className="flex items-center justify-end gap-1"><Factory size={12}/> 产出</div></th>
                         <th className="px-3 py-3 text-right text-red-500"><div className="flex items-center justify-end gap-1"><ShoppingCart size={12}/> 消耗</div></th>
                         <th className="px-3 py-3 text-right text-stone-500"><div className="flex items-center justify-end gap-1"><AlertCircle size={12}/> 损耗</div></th>
                         <th className="px-3 py-3 text-right text-blue-400"><div className="flex items-center justify-end gap-1"><Users size={12}/> 居民仓</div></th>
                         <th className="px-3 py-3 text-right text-emerald-400"><div className="flex items-center justify-end gap-1"><Landmark size={12}/> 企业仓</div></th>
                         <th className="px-3 py-3 rounded-tr-lg text-right text-amber-400"><div className="flex items-center justify-end gap-1"><Scale size={12}/> 市场</div></th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-stone-800/50">
                     {Object.entries(economicOverview.inventoryAudit).map(([key, rawData]) => {
                         const data = rawData as EconomicSnapshot['inventoryAudit'][string];
                         const netFlow = data.produced - data.consumed - (data.spoiled || 0);
                         return (
                         <tr key={key} className="hover:bg-stone-900 transition-colors">
                             <td className="px-3 py-3 flex items-center gap-2 font-medium">
                                {/* @ts-ignore */}
                                {RESOURCE_ICONS[key]} <span className="text-stone-200">{NAME_MAP[key] || key}</span>
                             </td>
                             <td className="px-3 py-3 text-right font-mono font-bold text-white">
                                <div className="flex items-center justify-end gap-1">
                                    {Math.floor(data.total)}
                                    {netFlow > 0 && <ArrowUp size={10} className="text-emerald-500"/>}
                                    {netFlow < 0 && <ArrowDown size={10} className="text-red-500"/>}
                                </div>
                             </td>
                             <td className="px-3 py-3 text-right font-mono text-emerald-500 bg-emerald-950/10">+{Math.floor(data.produced)}</td>
                             <td className="px-3 py-3 text-right font-mono text-red-500 bg-red-950/10">-{Math.floor(data.consumed)}</td>
                             <td className="px-3 py-3 text-right font-mono text-stone-500">-{Math.floor(data.spoiled || 0)}</td>
                             <td className="px-3 py-3 text-right font-mono text-blue-300">{Math.floor(data.residents)}</td>
                             <td className="px-3 py-3 text-right font-mono text-emerald-300">{Math.floor(data.companies)}</td>
                             <td className="px-3 py-3 text-right font-mono text-amber-300">{Math.floor(data.market)}</td>
                         </tr>
                     )})}
                 </tbody>
             </table>
          </div>
      </Card>
    </div>
  );
};
