

import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { CalibrationService } from './CalibrationService';
import { StructuralCheckResult, StabilizationAction } from '../../shared/types';
import { AIDiagnosisPanel } from './AIDiagnosisPanel';
import { PolicyShockLab } from './PolicyShockLab';
import { Beaker, Activity, AlertTriangle, PlayCircle } from 'lucide-react';

export const ValidationTab: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'validate' | 'experiment' | 'diagnosis'>('validate');
  const gameState = useGameStore(s => s.gameState);
  
  const phillips = useMemo(() => CalibrationService.checkPhillipsCurve(gameState.macroHistory), [gameState.macroHistory]);
  const okuns = useMemo(() => CalibrationService.checkOkunsLaw(gameState.macroHistory), [gameState.macroHistory]);
  const qtm = useMemo(() => CalibrationService.checkQuantityTheoryOfMoney(gameState.macroHistory), [gameState.macroHistory]);
  const consumptionSmoothing = useMemo(() => CalibrationService.checkConsumptionSmoothing(gameState.macroHistory), [gameState.macroHistory]);
  const firmSize = useMemo(() => CalibrationService.checkFirmSize(gameState), [gameState]);

  const structural = gameState.structuralAnalysis;

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
        <div className="flex gap-2 border-b border-stone-800 pb-2 overflow-x-auto">
            <Button variant={activeMode === 'validate' ? 'primary' : 'secondary'} onClick={() => setActiveMode('validate')}>
                <Activity size={16}/> 经济模型验证
            </Button>
            <Button variant={activeMode === 'experiment' ? 'primary' : 'secondary'} onClick={() => setActiveMode('experiment')}>
                <Beaker size={16}/> 政策实验室
            </Button>
            <Button variant={activeMode === 'diagnosis' ? 'primary' : 'secondary'} onClick={() => setActiveMode('diagnosis')}>
                <AlertTriangle size={16}/> AI 诊断
            </Button>
        </div>

        {activeMode === 'validate' && (
            <>
                {/* Structural Integrity Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Card title="结构性完整检验 (Structural Integrity)" className="bg-stone-900 border-stone-800 lg:col-span-2">
                        <div className="space-y-3">
                            {structural?.results.map((res, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-stone-950 rounded border border-stone-800">
                                    <div>
                                        <div className="text-xs font-bold text-stone-500 uppercase">{res.category} CHECK</div>
                                        <div className="text-sm text-stone-300">{res.message}</div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                                        res.status === 'HEALTHY' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                                        res.status === 'WARNING' ? 'bg-amber-900/50 text-amber-400 border border-amber-800' :
                                        'bg-red-900/50 text-red-400 border border-red-800'
                                    }`}>
                                        {res.status}
                                    </div>
                                </div>
                            ))}
                            {(!structural || structural.results.length === 0) && <div className="text-stone-500 text-sm p-2">等待数据收集... (Run Simulation)</div>}
                        </div>
                    </Card>

                    <Card title="自动稳定器日志 (Stabilizer)" className="bg-stone-900 border-stone-800">
                        <div className="h-48 overflow-y-auto custom-scrollbar space-y-2">
                            {structural?.logs.map((log, i) => (
                                <div key={i} className="text-xs p-2 rounded bg-stone-950 border border-stone-800">
                                    <div className="flex justify-between text-stone-500 mb-1">
                                        <span>Day {log.day}</span>
                                        <span className="text-blue-400">{log.type}</span>
                                    </div>
                                    <div className="text-stone-300">{log.description}</div>
                                </div>
                            ))}
                            {structural?.logs.length === 0 && <div className="text-stone-500 text-xs text-center mt-10">系统运行平稳，无需干预。</div>}
                        </div>
                    </Card>
                </div>

                {/* Stylized Facts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="1. 菲利普斯曲线 (Phillips Curve)" className="bg-stone-900 border-stone-800">
                        <div className="p-2 mb-2 text-xs text-stone-400 bg-stone-950 rounded">
                            {phillips.description}
                            <div className={`mt-1 font-bold ${phillips.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                Result: {phillips.passed ? 'PASSED' : 'FAILED'} (Score: {phillips.score})
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis type="number" dataKey="x" name="Unemployment" unit="%" stroke="#666" />
                                    <YAxis type="number" dataKey="y" name="Inflation" unit="%" stroke="#666" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                                    <Scatter name="Phillips" data={phillips.chartData} fill="#f472b6" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="2. 奥肯定律 (Okun's Law)" className="bg-stone-900 border-stone-800">
                        <div className="p-2 mb-2 text-xs text-stone-400 bg-stone-950 rounded">
                            {okuns.description}
                            <div className={`mt-1 font-bold ${okuns.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                Result: {okuns.passed ? 'PASSED' : 'FAILED'} (Score: {okuns.score})
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis type="number" dataKey="x" name="GDP Growth" unit="%" stroke="#666" />
                                    <YAxis type="number" dataKey="y" name="Unemployment Change" unit="%" stroke="#666" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                                    <Scatter name="Okun" data={okuns.chartData} fill="#3b82f6" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="3. 货币数量论 (QTM)" className="bg-stone-900 border-stone-800">
                        <div className="p-2 mb-2 text-xs text-stone-400 bg-stone-950 rounded">
                            {qtm.description}
                            <div className={`mt-1 font-bold ${qtm.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                Result: {qtm.passed ? 'PASSED' : 'FAILED'} (Score: {qtm.score})
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis type="number" dataKey="x" name="Money Growth" unit="%" stroke="#666" />
                                    <YAxis type="number" dataKey="y" name="Inflation" unit="%" stroke="#666" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444'}} />
                                    <Scatter name="QTM" data={qtm.chartData} fill="#facc15" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="4. 消费平滑 (Consumption Smoothing)" className="bg-stone-900 border-stone-800">
                        <div className="p-2 mb-2 text-xs text-stone-400 bg-stone-950 rounded">
                            {consumptionSmoothing.description}
                            <div className={`mt-1 font-bold ${consumptionSmoothing.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                Result: {consumptionSmoothing.passed ? 'PASSED' : 'FAILED'} (Ratio: {consumptionSmoothing.score})
                            </div>
                        </div>
                        {/* Assuming we just show the result card here as chart data is less relevant for variance comparison visually */}
                        <div className="h-64 flex items-center justify-center text-stone-500 text-sm">
                            Variance Analysis: GDP Volatility vs Consumption Volatility
                        </div>
                    </Card>
                </div>
            </>
        )}
        
        {activeMode === 'experiment' && <PolicyShockLab />}
        
        {activeMode === 'diagnosis' && <AIDiagnosisPanel />}
    </div>
  );
};