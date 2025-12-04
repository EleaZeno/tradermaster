import React, { useState } from 'react';
import { ResourceType, ResourceItem } from '../../shared/types';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

interface FuturesPanelProps {
    resources: Record<ResourceType, ResourceItem>;
}

export const FuturesPanel: React.FC<FuturesPanelProps> = ({ resources }) => {
    const [selectedRes, setSelectedRes] = useState<ResourceType>(ResourceType.GRAIN);
    
    const buyFutures = useGameStore(s => s.buyFutures);
    const closeFuture = useGameStore(s => s.closeFuture);
    const player = useGameStore(useShallow(s => s.gameState.population.residents.find(r => r.isPlayer)));
    const currentDay = useGameStore(s => s.gameState.day);

    if (!player) return null;

    const currentPrice = resources[selectedRes].currentPrice;
    const marginReq = 0.2; // 20%
    const contractSize = 50;
    const requiredMargin = currentPrice * contractSize * marginReq;

    const handleTrade = (type: 'LONG' | 'SHORT') => {
        buyFutures(selectedRes, type);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Trading Desk */}
            <div className="lg:col-span-5 space-y-4">
                <Card className="bg-stone-900 border-stone-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <ShieldCheck size={100} />
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="text-purple-400" /> 期货交易所 (Futures)
                    </h3>

                    <div className="space-y-4">
                        <div className="bg-stone-950 p-3 rounded border border-stone-800">
                            <label className="text-xs text-stone-500 block mb-1">标的物 (Underlying)</label>
                            <select 
                                className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-white"
                                value={selectedRes}
                                onChange={(e) => setSelectedRes(e.target.value as ResourceType)}
                            >
                                {(Object.values(resources) as ResourceItem[]).map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.currentPrice.toFixed(2)})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-stone-950 p-2 rounded">
                                <div className="text-stone-500">杠杆 (Leverage)</div>
                                <div className="text-purple-400 font-bold font-mono">5x</div>
                            </div>
                            <div className="bg-stone-900 p-2 rounded border border-stone-800">
                                <div className="text-stone-500">所需保证金</div>
                                <div className="text-white font-bold font-mono">{requiredMargin.toFixed(1)} oz</div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button 
                                className="flex-1" 
                                variant="success" 
                                onClick={() => handleTrade('LONG')}
                                disabled={player.cash < requiredMargin}
                            >
                                做多 (Long)
                            </Button>
                            <Button 
                                className="flex-1" 
                                variant="danger" 
                                onClick={() => handleTrade('SHORT')}
                                disabled={player.cash < requiredMargin}
                            >
                                做空 (Short)
                            </Button>
                        </div>
                        <div className="text-[10px] text-stone-500 text-center">
                            * 合约期限: 7天 | 强平线: 保证金归零
                        </div>
                    </div>
                </Card>
            </div>

            {/* Positions List */}
            <div className="lg:col-span-7">
                <Card className="bg-stone-900 border-stone-800 h-full" title="持仓监控 (Positions)">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-stone-400">
                            <thead className="bg-stone-950 text-stone-500 uppercase">
                                <tr>
                                    <th className="px-3 py-2">合约</th>
                                    <th className="px-3 py-2">方向</th>
                                    <th className="px-3 py-2 text-right">开仓价</th>
                                    <th className="px-3 py-2 text-right">现价</th>
                                    <th className="px-3 py-2 text-right">浮动盈亏 (PnL)</th>
                                    <th className="px-3 py-2 text-right">到期</th>
                                    <th className="px-3 py-2 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800">
                                {player.futuresPositions.map(pos => {
                                    const currPrice = resources[pos.resourceId].currentPrice;
                                    const entryVal = pos.entryPrice * pos.amount;
                                    const currVal = currPrice * pos.amount;
                                    let pnl = 0;
                                    if (pos.type === 'LONG') pnl = currVal - entryVal;
                                    else pnl = entryVal - currVal;
                                    
                                    const isProfit = pnl >= 0;
                                    const daysLeft = pos.dueDate - currentDay;

                                    return (
                                        <tr key={pos.id} className="hover:bg-stone-800">
                                            <td className="px-3 py-2 font-bold text-white">{resources[pos.resourceId].name}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${pos.type === 'LONG' ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
                                                    {pos.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">{pos.entryPrice.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-white">{currPrice.toFixed(2)}</td>
                                            <td className={`px-3 py-2 text-right font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isProfit ? '+' : ''}{pnl.toFixed(1)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-amber-500 flex items-center justify-end gap-1">
                                                <Clock size={10}/> {daysLeft}d
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button 
                                                    onClick={() => closeFuture(pos.id)}
                                                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded text-[10px] border border-stone-600 transition-colors"
                                                >
                                                    平仓
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {player.futuresPositions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-stone-600">
                                            暂无持仓
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};