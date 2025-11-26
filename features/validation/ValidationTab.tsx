
import React, { useMemo } from 'react';
import { GameState } from '../../shared/types';
import { CalibrationService } from './CalibrationService';
import { Card, Button } from '../../shared/components';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, CartesianGrid, Legend } from 'recharts';
import { CheckCircle2, XCircle, Beaker, Scale, Activity } from 'lucide-react';

interface ValidationTabProps {
  gameState: GameState;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({ gameState }) => {
  const { macroHistory } = gameState;

  const phillips = useMemo(() => CalibrationService.checkPhillipsCurve(macroHistory), [macroHistory]);
  const smoothing = useMemo(() => CalibrationService.checkConsumptionSmoothing(macroHistory), [macroHistory]);
  const zipf = useMemo(() => CalibrationService.checkFirmSize(gameState), [gameState.companies]);
  const mpc = useMemo(() => CalibrationService.checkMPC(gameState), [gameState.population.residents]);

  const StatusIcon = ({ passed }: { passed: boolean }) => 
    passed ? <CheckCircle2 className="text-emerald-500" size={20} /> : <XCircle className="text-red-500" size={20} />;

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-gradient-to-r from-indigo-900 to-stone-900 p-6 rounded-xl border border-indigo-700/50 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Beaker className="text-indigo-400" />
                    Economy Calibration Lab
                </h2>
                <p className="text-indigo-200 mt-2 max-w-2xl">
                    Verify the simulation against real-world "Stylized Facts". A realistic economy should exhibit specific statistical properties (e.g., negative correlation between unemployment and inflation).
                </p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1/3 bg-indigo-500/10 blur-3xl rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fact 1: Phillips Curve */}
            <Card title="1. Phillips Curve (Inflation vs Unemployment)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">{phillips.description}</div>
                     <StatusIcon passed={phillips.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" dataKey="x" name="Unemployment" unit="%" stroke="#666" label={{ value: 'Unemployment (%)', position: 'bottom', offset: 0, fill: '#666' }} />
                            <YAxis type="number" dataKey="y" name="Inflation" unit="%" stroke="#666" label={{ value: 'Inflation (%)', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Scatter name="Phillips" data={phillips.chartData} fill="#f472b6" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 2: Consumption Smoothing */}
            <Card title="2. Consumption Smoothing (Volatility)" className="bg-stone-900 border-stone-800">
                <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">{smoothing.description}</div>
                     <StatusIcon passed={smoothing.passed} />
                </div>
                <div className="h-64 flex items-center justify-center">
                    {smoothing.meta ? (
                         <div className="flex gap-8 items-end h-48">
                             <div className="flex flex-col items-center gap-2 group">
                                 <div className="text-xs text-stone-500">Vol(Output)</div>
                                 <div className="w-16 bg-blue-600 rounded-t transition-all duration-500 hover:bg-blue-500" style={{ height: `${Math.min(100, smoothing.meta.gdpVol * 1000)}%` }}></div>
                                 <div className="font-mono font-bold">{(smoothing.meta.gdpVol * 100).toFixed(2)}%</div>
                             </div>
                             <div className="flex flex-col items-center gap-2 group">
                                 <div className="text-xs text-stone-500">Vol(Cons)</div>
                                 <div className={`w-16 rounded-t transition-all duration-500 ${smoothing.passed ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ height: `${Math.min(100, smoothing.meta.consVol * 1000)}%` }}></div>
                                 <div className="font-mono font-bold">{(smoothing.meta.consVol * 100).toFixed(2)}%</div>
                             </div>
                         </div>
                    ) : (
                        <div className="text-stone-500">Gathering Data...</div>
                    )}
                </div>
            </Card>

            {/* Fact 3: Firm Size (Zipf) */}
            <Card title="3. Firm Size Distribution (Zipf's Law)" className="bg-stone-900 border-stone-800">
                 <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">{zipf.description}</div>
                     <StatusIcon passed={zipf.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={zipf.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="x" stroke="#666" label={{ value: 'Rank', position: 'bottom', fill: '#666' }} />
                            <YAxis stroke="#666" label={{ value: 'Employees', angle: -90, position: 'left', fill: '#666' }} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Bar dataKey="y" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Fact 4: Wealth & MPC */}
            <Card title="4. MPC by Wealth Quartile (Keynesian)" className="bg-stone-900 border-stone-800">
                 <div className="p-2 flex justify-between items-center bg-stone-950/50 mb-4 rounded border border-stone-800">
                     <div className="text-sm text-stone-400">{mpc.description}</div>
                     <StatusIcon passed={mpc.passed} />
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={mpc.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="quartile" stroke="#666" />
                            <YAxis stroke="#666" domain={[0, 1]} />
                            <Tooltip contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                            <Bar dataKey="mpc" fill="#34d399" radius={[4, 4, 0, 0]} name="Propensity to Consume" />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    </div>
  );
};
