
import React, { useMemo } from 'react';
import { CalibrationService } from './CalibrationService';
import { Card } from '../../shared/components';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { CheckCircle2, XCircle, Beaker } from 'lucide-react';
import { useGameStore } from '../../shared/store/useGameStore';

export const ValidationTab: React.FC = () => {
  const macroHistory = useGameStore(s => s.gameState.macroHistory);
  // We need full state for some checks
  const gameState = useGameStore(s => s.gameState);

  const phillips = useMemo(() => CalibrationService.checkPhillipsCurve(macroHistory), [macroHistory]);
  const smoothing = useMemo(() => CalibrationService.checkConsumptionSmoothing(macroHistory), [macroHistory]);
  const zipf = useMemo(() => CalibrationService.checkFirmSize(gameState), [gameState.companies]);
  const mpc = useMemo(() => CalibrationService.checkMPC(gameState), [gameState.population.residents]);
  const okuns = useMemo(() => CalibrationService.checkOkunsLaw(macroHistory), [macroHistory]);
  const qtm = useMemo(() => CalibrationService.checkQuantityTheoryOfMoney(macroHistory), [macroHistory]);

  const StatusIcon = ({ passed }: { passed: boolean }) => 
    passed ? <CheckCircle2 className="text-emerald-500" size={20} /> : <XCircle className="text-red-500" size={20} />;

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-gradient-to-r from-indigo-900 to-stone-900 p-6 rounded-xl border border-indigo-700/50 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Beaker className="text-indigo-400" />
                    经济学模型校准实验室
                </h2>
                <p className="text-indigo-200 mt-2 max-w-2xl">
                    验证模拟是否符合现实世界的“典型事实 (Stylized Facts)”。一个真实的经济体应该表现出特定的统计特性。
                </p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1/3 bg-indigo-500/10 blur-3xl rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fact 1: Phillips Curve */}
            <Card title="1. 菲利普斯曲线 (Phillips Curve)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">失业率与通胀率的相关性。预期应为负相关 (&lt; 0)。当前: {phillips.score}</div>
                     <StatusIcon passed={phillips.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" dataKey="x" name="Unemployment" unit="%" stroke="#666" label={{ value: '失业率 (%)', position: 'bottom', offset: 0, fill: '#666' }} />
                            <YAxis type="number" dataKey="y" name="Inflation" unit="%" stroke="#666" label={{ value: '通胀率 (%)', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Scatter name="Phillips" data={phillips.chartData} fill="#f472b6" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 2: Okun's Law */}
            <Card title="2. 奥肯定律 (Okun's Law)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">GDP增长与失业率变化。预期负相关 (&lt; -0.2)。当前: {okuns.score}</div>
                     <StatusIcon passed={okuns.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" dataKey="x" name="GDP Growth" unit="%" stroke="#666" label={{ value: 'GDP增长 (%)', position: 'bottom', offset: 0, fill: '#666' }} />
                            <YAxis type="number" dataKey="y" name="d(Unemployment)" unit="%" stroke="#666" label={{ value: 'Δ 失业率 (%)', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Scatter name="Okuns" data={okuns.chartData} fill="#60a5fa" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 3: Consumption Smoothing */}
            <Card title="3. 消费平滑 (Consumption Smoothing)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">消费波动率与GDP波动率的比率。预期 &lt; 1.0。当前: {smoothing.score}</div>
                     <StatusIcon passed={smoothing.passed} />
                </div>
                <div className="h-64 flex items-center justify-center">
                    {smoothing.meta ? (
                         <div className="flex gap-12 items-end h-48">
                             <div className="flex flex-col items-center gap-2 group">
                                 <div className="text-xs text-stone-500">Vol(GDP)</div>
                                 <div className="w-20 bg-blue-600/80 rounded-t transition-all duration-500 hover:bg-blue-500" style={{ height: `${Math.min(100, smoothing.meta.gdpVol * 800)}%` }}></div>
                                 <div className="font-mono font-bold">{(smoothing.meta.gdpVol * 100).toFixed(2)}%</div>
                             </div>
                             <div className="flex flex-col items-center gap-2 group">
                                 <div className="text-xs text-stone-500">Vol(消费)</div>
                                 <div className={`w-20 rounded-t transition-all duration-500 ${smoothing.passed ? 'bg-emerald-500/80' : 'bg-red-500/80'}`} style={{ height: `${Math.min(100, smoothing.meta.consVol * 800)}%` }}></div>
                                 <div className="font-mono font-bold">{(smoothing.meta.consVol * 100).toFixed(2)}%</div>
                             </div>
                         </div>
                    ) : (
                        <div className="text-stone-500">正在收集数据...</div>
                    )}
                </div>
            </Card>

            {/* Fact 4: Quantity Theory of Money */}
            <Card title="4. 货币数量论 (QTM)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">货币供给增长(M0)与通胀率的相关性。预期正相关。当前: {qtm.score}</div>
                     <StatusIcon passed={qtm.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" dataKey="x" name="M0 Growth" unit="%" stroke="#666" label={{ value: 'M0 增长 (%)', position: 'bottom', offset: 0, fill: '#666' }} />
                            <YAxis type="number" dataKey="y" name="Inflation" unit="%" stroke="#666" label={{ value: '通胀率 (%)', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Scatter name="QTM" data={qtm.chartData} fill="#fbbf24" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 5: Firm Size (Zipf) */}
            <Card title="5. 企业规模分布 (Zipf's Law)" className="bg-stone-900 border-stone-800">
                 <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">企业规模的幂律指数。预期约 -1.0。当前: {zipf.score}</div>
                     <StatusIcon passed={zipf.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={zipf.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="x" stroke="#666" label={{ value: '排名', position: 'bottom', fill: '#666' }} />
                            <YAxis stroke="#666" label={{ value: '员工数', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Bar dataKey="y" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 6: Wealth & MPC */}
            <Card title="6. 边际消费倾向 (MPC by Wealth)" className="bg-stone-900 border-stone-800">
                 <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">按财富四分位数统计的边际消费倾向。穷人应高于富人。</div>
                     <StatusIcon passed={mpc.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={mpc.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="quartile" stroke="#666" />
                            <YAxis stroke="#666" domain={[0, 1]} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Bar dataKey="mpc" fill="#34d399" radius={[4, 4, 0, 0]} name="消费倾向" />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    </div>
  );
};
