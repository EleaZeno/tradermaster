

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Line, ComposedChart, BarChart, Bar, Cell } from 'recharts';
import { Building2, DollarSign, Activity, TrendingUp } from 'lucide-react';

export const BankingTab: React.FC = () => {
  const bank = useGameStore(s => s.gameState.bank);
  const updateBank = useGameStore(s => s.updateBank);

  const [targetInflation, setTargetInflation] = useState(bank.targetInflation);
  const [targetUnemployment, setTargetUnemployment] = useState(bank.targetUnemployment);

  useEffect(() => {
     setTargetInflation(bank.targetInflation);
     setTargetUnemployment(bank.targetUnemployment);
  }, [bank.targetInflation, bank.targetUnemployment]);

  const handleApply = () => {
      updateBank({ targetInflation, targetUnemployment });
  };

  const yieldCurveData = [
      { name: '1D', rate: bank.yieldCurve.rate1d * 100 },
      { name: '30D', rate: bank.yieldCurve.rate30d * 100 },
      { name: '1Y', rate: bank.yieldCurve.rate365d * 100 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-gradient-to-r from-stone-900 to-emerald-950 p-4 rounded-xl border border-emerald-900/50">
            <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2 mb-2">
                <Building2 /> 中央银行控制台
            </h2>
            <p className="text-sm text-stone-400">
                央行根据泰勒规则 (Taylor Rule) 自动调节利率。请设定政策目标以引导经济。
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-stone-900 border-stone-800" title="央行储备">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-900/30 rounded-full border border-emerald-700">
                        <Building2 size={24} className="text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-sm text-stone-500">总储备金 (Reserves)</div>
                        <div className="text-2xl font-bold font-mono text-emerald-400">{Math.floor(bank.reserves).toLocaleString()} oz</div>
                    </div>
                </div>
            </Card>

            <Card className="bg-stone-900 border-stone-800" title="货币政策目标">
                 <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm">
                         <label className="text-stone-400">通胀目标 ($\pi^*$)</label>
                         <div className="flex items-center gap-1">
                            <input 
                                type="number" step="0.01" 
                                className="w-16 bg-stone-950 border border-stone-700 rounded px-1 text-right text-white focus:border-emerald-500 outline-none"
                                value={targetInflation}
                                onChange={(e) => setTargetInflation(parseFloat(e.target.value))}
                            />
                            <span className="text-stone-500 text-xs">%</span>
                         </div>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                         <label className="text-stone-400">失业率目标 ($u^*$)</label>
                         <div className="flex items-center gap-1">
                            <input 
                                type="number" step="0.01" 
                                className="w-16 bg-stone-950 border border-stone-700 rounded px-1 text-right text-white focus:border-emerald-500 outline-none"
                                value={targetUnemployment}
                                onChange={(e) => setTargetUnemployment(parseFloat(e.target.value))}
                            />
                            <span className="text-stone-500 text-xs">%</span>
                         </div>
                     </div>
                     <Button size="sm" variant="primary" className="w-full mt-2" onClick={handleApply}>应用政策</Button>
                 </div>
            </Card>

            <Card className="bg-stone-900 border-stone-800" title="收益率曲线 (Yield Curve)">
                <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yieldCurveData}>
                            <XAxis dataKey="name" stroke="#666" tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '10px'}} />
                            <Bar dataKey="rate" name="Rate %" radius={[4, 4, 0, 0]}>
                                {yieldCurveData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 2 ? '#f59e0b' : '#10b981'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-xs text-center text-stone-500 mt-1">1D: {(bank.yieldCurve.rate1d*100).toFixed(2)}% | 1Y: {(bank.yieldCurve.rate365d*100).toFixed(2)}%</div>
            </Card>
        </div>

        <Card title="宏观调控数据 (利率 & 通胀)" className="bg-stone-900 border-stone-800 h-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bank.history}>
                    <defs>
                        <linearGradient id="colorReserves" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="#444" tick={{fontSize: 10}} />
                    <YAxis yAxisId="left" stroke="#444" tick={{fontSize: 10}} />
                    <YAxis yAxisId="right" orientation="right" stroke="#444" tick={{fontSize: 10}} domain={['auto', 'auto']} />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '12px'}}
                        labelStyle={{color: '#9ca3af'}}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="reserves" stroke="#10b981" fillOpacity={1} fill="url(#colorReserves)" name="储备金" />
                    <Line yAxisId="right" type="monotone" dataKey="rates" stroke="#f59e0b" dot={false} strokeWidth={2} name="基准利率" />
                    <Line yAxisId="right" type="monotone" dataKey="inflation" stroke="#ef4444" dot={false} strokeWidth={2} name="通胀率 (周)" />
                </ComposedChart>
            </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="活跃贷款簿" className="bg-stone-900 border-stone-800">
                <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left text-stone-400">
                        <thead className="text-stone-500 uppercase bg-stone-950 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">贷款ID</th>
                                <th className="px-4 py-2">借款人</th>
                                <th className="px-4 py-2 text-right">剩余本金</th>
                                <th className="px-4 py-2 text-right">到期日</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bank.loans.map(loan => (
                                <tr key={loan.id} className="border-b border-stone-800 hover:bg-stone-800">
                                    <td className="px-4 py-2 font-mono">{loan.id.split('_')[1]}</td>
                                    <td className="px-4 py-2">{loan.borrowerId}</td>
                                    <td className="px-4 py-2 text-right text-red-400 font-mono">{Math.floor(loan.remainingPrincipal)} oz</td>
                                    <td className="px-4 py-2 text-right">Day {loan.dueDate}</td>
                                </tr>
                            ))}
                            {bank.loans.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-4 text-center text-stone-600">无活跃贷款</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="存款簿" className="bg-stone-900 border-stone-800">
                 <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left text-stone-400">
                        <thead className="text-stone-500 uppercase bg-stone-950 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">账户</th>
                                <th className="px-4 py-2 text-right">余额</th>
                                <th className="px-4 py-2 text-right">年化利率(APY)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bank.deposits.map(dep => (
                                <tr key={dep.id} className="border-b border-stone-800 hover:bg-stone-800">
                                    <td className="px-4 py-2">{dep.ownerId}</td>
                                    <td className="px-4 py-2 text-right text-emerald-400 font-mono">{Math.floor(dep.amount)} oz</td>
                                    <td className="px-4 py-2 text-right">{(dep.interestRate * 365 * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                             {bank.deposits.length === 0 && (
                                <tr><td colSpan={3} className="px-4 py-4 text-center text-stone-600">无活跃存款</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    </div>
  );
};
