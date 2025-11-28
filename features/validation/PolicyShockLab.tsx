

import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card } from '../../shared/components';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Sliders, Zap, TrendingUp, Users, DollarSign, RefreshCw } from 'lucide-react';

export const PolicyShockLab: React.FC = () => {
  const overrides = useGameStore(s => s.gameState.policyOverrides);
  const setOverride = useGameStore(s => s.setPolicyOverride);
  const macroHistory = useGameStore(s => s.gameState.macroHistory);
  
  // Prepare Chart Data (Last 50 ticks)
  const chartData = macroHistory.slice(-50);

  const resetAll = () => {
      setOverride({
          interestRate: null,
          moneyPrinter: 0,
          migrationRate: 1.0,
          taxMultiplier: 1.0,
          minWage: 0
      });
  };

  return (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-red-900 to-stone-900 p-6 rounded-xl border border-red-800/50 relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Zap className="text-red-400" />
                        政策冲击实验室 (Shock Lab)
                    </h2>
                    <p className="text-red-200 mt-2 max-w-2xl">
                        手动干预经济核心参数，观察曲线的即时反馈。警告：极端的政策可能导致经济崩溃。
                    </p>
                </div>
                <button 
                    onClick={resetAll}
                    className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-2 rounded transition-colors"
                >
                    <RefreshCw size={16}/> 重置所有
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Controls Panel */}
            <div className="lg:col-span-4 space-y-4">
                {/* Monetary Policy */}
                <Card className="bg-stone-900 border-stone-800">
                    <h3 className="text-sm font-bold text-stone-400 mb-4 flex items-center gap-2">
                        <DollarSign size={16}/> 货币政策 (Monetary)
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>央行利率 (Interest Rate)</span>
                                <span className={overrides.interestRate !== null ? "text-red-400 font-bold" : "text-stone-500"}>
                                    {overrides.interestRate !== null ? `${(overrides.interestRate * 100).toFixed(1)}%` : 'Auto (Taylor)'}
                                </span>
                            </div>
                            <input 
                                type="range" min="0" max="0.2" step="0.005"
                                value={overrides.interestRate !== null ? overrides.interestRate : 0.05}
                                onChange={(e) => setOverride({ interestRate: parseFloat(e.target.value) })}
                                className="w-full accent-red-500 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-stone-600 mt-1">
                                <button onClick={() => setOverride({ interestRate: null })} className="hover:text-stone-300">Reset to Auto</button>
                                <span>20%</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>直升机撒钱 (Money Printer)</span>
                                <span className={overrides.moneyPrinter > 0 ? "text-red-400 font-bold" : "text-stone-500"}>
                                    {overrides.moneyPrinter > 0 ? `+${overrides.moneyPrinter} /day` : 'Off'}
                                </span>
                            </div>
                            <input 
                                type="range" min="0" max="500" step="50"
                                value={overrides.moneyPrinter}
                                onChange={(e) => setOverride({ moneyPrinter: parseFloat(e.target.value) })}
                                className="w-full accent-emerald-500 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </Card>

                {/* Fiscal & Labor */}
                <Card className="bg-stone-900 border-stone-800">
                    <h3 className="text-sm font-bold text-stone-400 mb-4 flex items-center gap-2">
                        <Sliders size={16}/> 财政与劳动力
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>税收乘数 (Tax Multiplier)</span>
                                <span className="text-blue-400 font-mono">{overrides.taxMultiplier.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="2.0" step="0.1"
                                value={overrides.taxMultiplier}
                                onChange={(e) => setOverride({ taxMultiplier: parseFloat(e.target.value) })}
                                className="w-full accent-blue-500 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>最低工资地板 (Min Wage)</span>
                                <span className="text-amber-400 font-mono">{overrides.minWage.toFixed(1)} oz</span>
                            </div>
                            <input 
                                type="range" min="0" max="10.0" step="0.5"
                                value={overrides.minWage}
                                onChange={(e) => setOverride({ minWage: parseFloat(e.target.value) })}
                                className="w-full accent-amber-500 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>人口流动率 (Migration)</span>
                                <span className="text-purple-400 font-mono">{overrides.migrationRate.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" min="0" max="5.0" step="0.5"
                                value={overrides.migrationRate}
                                onChange={(e) => setOverride({ migrationRate: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Panel */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inflation Chart */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 h-64">
                    <h4 className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-2"><TrendingUp size={12}/> 通胀 (Red) vs 利率 (Green)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="day" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '10px'}} />
                            <Line type="monotone" dataKey="inflation" stroke="#ef4444" dot={false} strokeWidth={2} />
                            {/* We don't have rate history in macroHistory, so we might skip rate line or use a proxy if available */}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Unemployment Chart */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 h-64">
                    <h4 className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-2"><Users size={12}/> 失业率 (Blue)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="day" hide />
                            <YAxis hide domain={[0, 1]} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '10px'}} />
                            <Line type="monotone" dataKey="unemployment" stroke="#3b82f6" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* GDP Chart */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 h-64">
                    <h4 className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-2"><DollarSign size={12}/> GDP (Green) vs M0 (Yellow)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="day" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '10px'}} />
                            <Line type="monotone" dataKey="gdp" stroke="#10b981" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="moneySupply" stroke="#f59e0b" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Phillips Curve (Dynamic) */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 h-64">
                    <h4 className="text-xs font-bold text-stone-500 mb-2">Phillips Curve (Real-time Trace)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis type="number" dataKey="unemployment" hide domain={['auto', 'auto']} />
                            <YAxis type="number" dataKey="inflation" hide domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '10px'}} />
                            <Line dataKey="inflation" stroke="#c084fc" strokeWidth={0} dot={{ r: 2, fill: "#c084fc" }} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );
};