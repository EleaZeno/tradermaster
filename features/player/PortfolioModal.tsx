
import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { motion } from 'framer-motion';
import { X, PieChart, Wallet, Building2, Package, TrendingUp, DollarSign } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ResponsiveContainer, PieChart as RePie, Pie, Cell, Tooltip } from 'recharts';

interface PortfolioModalProps {
  onClose: () => void;
}

export const PortfolioModal: React.FC<PortfolioModalProps> = ({ onClose }) => {
  const player = useGameStore(useShallow(s => s.gameState.population.residents.find(r => r.isPlayer)));
  const companies = useGameStore(s => s.gameState.companies);
  const resources = useGameStore(s => s.gameState.resources);
  const products = useGameStore(s => s.gameState.products);

  if (!player) return null;

  // 1. Calculate Asset Classes
  const cash = player.cash;
  
  let stockValue = 0;
  const stocks = Object.entries(player.portfolio).map(([id, rawAmount]) => {
      const amount = rawAmount as number;
      const comp = companies.find(c => c.id === id);
      if(!comp) return null;
      const val = Math.abs(amount) * comp.sharePrice; // Value of holding
      if (amount > 0) stockValue += val;
      return { name: comp.name, amount, price: comp.sharePrice, val: val, isShort: amount < 0 };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  let inventoryValue = 0;
  Object.entries(player.inventory).forEach(([id, rawAmt]) => {
      const amt = rawAmt as number;
      const price = resources[id as any]?.currentPrice || products[id as any]?.marketPrice || 0;
      inventoryValue += (amt || 0) * price;
  });

  // Futures PnL (Unrealized)
  let futuresPnL = 0;
  let futuresMargin = 0;
  (player.futuresPositions || []).forEach(f => {
      const resItem = resources[f.resourceId];
      if (!resItem) return;
      const curr = resItem.currentPrice;
      const val = f.amount * curr;
      const entry = f.amount * f.entryPrice;
      if (f.type === 'LONG') futuresPnL += (val - entry);
      else futuresPnL += (entry - val);
      futuresMargin += (f.entryPrice * f.amount * 0.2); // Sunk margin
  });

  const totalNetWorth = cash + stockValue + inventoryValue + futuresPnL + futuresMargin; // Approximation

  const data = [
      { name: '现金 (Cash)', value: Math.max(0, cash), color: '#10b981' },
      { name: '股票 (Stocks)', value: stockValue, color: '#3b82f6' },
      { name: '库存 (Inventory)', value: inventoryValue, color: '#f59e0b' },
      { name: '保证金 (Margin)', value: futuresMargin, color: '#8b5cf6' },
  ].filter(d => d.value > 1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
       <motion.div
         initial={{ scale: 0.95, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="w-full max-w-4xl bg-stone-900 border border-stone-700 rounded-xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
       >
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950">
             <div className="flex items-center gap-3">
                 <div className="bg-indigo-600 p-2 rounded-lg">
                     <Wallet size={24} className="text-white"/>
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white">我的资产组合 (Portfolio)</h2>
                     <div className="text-xs text-stone-400">Net Worth Overview</div>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 hover:text-white">
                 <X size={20} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-stone-900/50 p-6">
             {/* Summary Cards */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                 <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                     <div className="text-stone-500 text-xs mb-1 uppercase">Total Net Worth</div>
                     <div className="text-2xl font-mono font-bold text-white">{Math.floor(totalNetWorth).toLocaleString()} <span className="text-sm">oz</span></div>
                 </div>
                 <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                     <div className="text-stone-500 text-xs mb-1 uppercase">Liquid Cash</div>
                     <div className="text-xl font-mono font-bold text-emerald-400">{Math.floor(cash).toLocaleString()} oz</div>
                 </div>
                 <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                     <div className="text-stone-500 text-xs mb-1 uppercase">Stocks Value</div>
                     <div className="text-xl font-mono font-bold text-blue-400">{Math.floor(stockValue).toLocaleString()} oz</div>
                 </div>
                 <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                     <div className="text-stone-500 text-xs mb-1 uppercase">Futures PnL</div>
                     <div className={`text-xl font-mono font-bold ${futuresPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                         {futuresPnL > 0 ? '+' : ''}{futuresPnL.toFixed(1)} oz
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Chart */}
                 <div className="md:col-span-1 h-64 bg-stone-950 rounded-xl border border-stone-800 p-2 relative">
                     <h3 className="absolute top-2 left-4 text-xs font-bold text-stone-500">资产分布</h3>
                     <ResponsiveContainer width="100%" height="100%">
                        <RePie data={data} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', borderRadius: '8px'}} formatter={(val: number) => val.toFixed(0)}/>
                        </RePie>
                     </ResponsiveContainer>
                 </div>

                 {/* Stock Details */}
                 <div className="md:col-span-2 space-y-4">
                     <div className="bg-stone-950 rounded-xl border border-stone-800 overflow-hidden">
                         <div className="px-4 py-2 bg-stone-900 border-b border-stone-800 font-bold text-stone-400 text-xs uppercase flex items-center gap-2">
                             <Building2 size={14}/> 持仓股票
                         </div>
                         <table className="w-full text-xs text-left text-stone-300">
                             <thead className="text-stone-500 border-b border-stone-800 bg-stone-900/50">
                                 <tr>
                                     <th className="px-4 py-2">公司</th>
                                     <th className="px-4 py-2 text-right">持股数</th>
                                     <th className="px-4 py-2 text-right">现价</th>
                                     <th className="px-4 py-2 text-right">市值</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {stocks.map((s, i) => s && (
                                     <tr key={i} className="border-b border-stone-800 hover:bg-stone-900">
                                         <td className="px-4 py-2 font-medium text-white">{s.name}</td>
                                         <td className={`px-4 py-2 text-right ${s.isShort ? 'text-red-400' : 'text-stone-300'}`}>
                                             {s.isShort ? 'SHORT ' : ''}{Math.abs(s.amount)}
                                         </td>
                                         <td className="px-4 py-2 text-right font-mono">{s.price.toFixed(2)}</td>
                                         <td className="px-4 py-2 text-right font-mono text-blue-300">{Math.floor(s.val)}</td>
                                     </tr>
                                 ))}
                                 {stocks.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-stone-600">空仓</td></tr>}
                             </tbody>
                         </table>
                     </div>

                     <div className="bg-stone-950 rounded-xl border border-stone-800 overflow-hidden">
                         <div className="px-4 py-2 bg-stone-900 border-b border-stone-800 font-bold text-stone-400 text-xs uppercase flex items-center gap-2">
                             <Package size={14}/> 库存商品
                         </div>
                         <div className="p-3 grid grid-cols-3 gap-2">
                             {Object.entries(player.inventory).map(([k, rawV]) => {
                                 const v = rawV as number;
                                 return (
                                     <div key={k} className="bg-stone-900 p-2 rounded flex justify-between items-center border border-stone-800">
                                         <span className="text-xs text-stone-400">{k}</span>
                                         <span className="text-sm font-mono text-white">{Math.floor(v || 0)}</span>
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                 </div>
             </div>
          </div>
       </motion.div>
    </div>
  );
};
