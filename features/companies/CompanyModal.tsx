import React, { useState } from 'react';
import { TrendingUp, Users, Briefcase, Activity, Anchor, BarChart, Bot, Sparkles, PieChart, Layers, Scale } from 'lucide-react';
import { ProductType, ResourceType, IndustryType } from '../../shared/types';
import { Card, Button } from '../../shared/components';
import { RESOURCE_ICONS } from '../../shared/assets';
import { KLineChart } from '../../shared/components/charts/KLineChart';
import { motion } from 'framer-motion';
import { aiService } from '../../infrastructure/ai/GeminiAdapter';
import { useGameStore } from '../../shared/store/useGameStore';

interface CompanyModalProps {
  companyId: string;
  onClose: () => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({ 
  companyId, onClose
}) => {
  const company = useGameStore(s => s.gameState.companies.find(c => c.id === companyId));
  const resources = useGameStore(s => s.gameState.resources);
  const playerPortfolio = useGameStore(s => s.gameState.population.residents.find(r => r.isPlayer)?.portfolio);
  const bank = useGameStore(s => s.gameState.bank);
  
  const updateCompany = useGameStore(s => s.updateCompany);
  const payDividend = useGameStore(s => s.payDividend);

  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'lines' | 'finance' | 'shareholders' | 'ai'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  
  if (!company) return null;

  const ownedShares = playerPortfolio?.[company.id] || 0;
  const grainPrice = resources[ResourceType.GRAIN].currentPrice;
  const wageMultiplier = company.wageMultiplier || 1.5;

  const handleAnalysis = async () => {
      setAnalyzing(true);
      const text = await aiService.analyzeCompany(company, useGameStore.getState().gameState);
      setAiAnalysis(text);
      setAnalyzing(false);
  };

  const getStageColor = (stage: string) => {
      if (stage === 'STARTUP') return 'text-blue-400 bg-blue-900/30 border-blue-800';
      if (stage === 'GROWTH') return 'text-emerald-400 bg-emerald-900/30 border-emerald-800';
      if (stage === 'MATURITY') return 'text-amber-400 bg-amber-900/30 border-amber-800';
      return 'text-red-400 bg-red-900/30 border-red-800';
  };

  // Finance Calcs
  const equity = company.sharePrice * company.totalShares;
  const debt = bank.loans.filter(l => l.borrowerId === company.id).reduce((s,l) => s + l.remainingPrincipal, 0);
  const assets = company.cash + (company.landTokens || 0) * 100 + Object.values(company.inventory.finished).reduce<number>((a,b)=>a+(Number(b)||0),0);
  const leverage = debt / (equity || 1);
  const creditScore = company.kpis.creditScore || 0;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="w-full max-w-4xl"
      >
        <Card className={`w-full bg-stone-900 border-stone-700 max-h-[90vh] overflow-y-auto ${company.isBankrupt ? 'grayscale opacity-90' : ''}`} title={`公司控制台: ${company.name}`}>
          {company.isBankrupt && <div className="bg-red-900/80 text-white text-center p-2 mb-4 font-bold rounded">🚫 已破产</div>}

          <div className="flex items-center gap-4 mb-4">
              <span className={`px-2 py-0.5 rounded text-xs border font-bold ${getStageColor(company.stage || 'STARTUP')}`}>
                  {company.stage || 'STARTUP'} STAGE
              </span>
              <span className="text-stone-500 text-xs">成立: {company.age || 0} 天</span>
          </div>

          <div className="flex gap-2 mb-4 border-b border-stone-800 pb-2 overflow-x-auto whitespace-nowrap custom-scrollbar">
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'overview' ? 'bg-blue-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('overview')}><Activity size={12}/> 经营</button>
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'finance' ? 'bg-blue-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('finance')}><Scale size={12}/> 财务</button>
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'chart' ? 'bg-blue-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('chart')}><BarChart size={12}/> 股价</button>
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'lines' ? 'bg-blue-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('lines')}><Briefcase size={12}/> 生产</button>
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'shareholders' ? 'bg-blue-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('shareholders')}><Users size={12}/> 股东</button>
            <button className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${activeTab === 'ai' ? 'bg-purple-900 text-white' : 'text-stone-400'}`} onClick={() => setActiveTab('ai')}><Sparkles size={12}/> AI 研报</button>
          </div>

          <div className="space-y-6">
            {activeTab === 'chart' && (
                <div className="bg-stone-950 p-4 rounded border border-stone-800">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <div className="text-2xl font-bold text-white">{company.sharePrice.toFixed(2)} oz</div>
                            <div className="text-xs text-stone-500">Real-time Quote</div>
                        </div>
                        <div className="text-right text-xs text-stone-500">
                            <div>Total Shares: {company.totalShares}</div>
                            <div>Market Cap: {(company.sharePrice * company.totalShares).toFixed(0)} oz</div>
                        </div>
                    </div>
                    <div className="h-[300px] sm:h-[400px]">
                        <KLineChart data={company.history} height={undefined} />
                    </div>
                </div>
            )}

            {activeTab === 'finance' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-stone-950 p-3 rounded border border-stone-800 text-center">
                            <div className="text-xs text-stone-500">Credit Score</div>
                            <div className={`text-xl font-bold ${creditScore > 70 ? 'text-emerald-400' : 'text-red-400'}`}>{creditScore.toFixed(0)}</div>
                        </div>
                        <div className="bg-stone-950 p-3 rounded border border-stone-800 text-center">
                            <div className="text-xs text-stone-500">Total Debt</div>
                            <div className="text-xl font-bold text-red-400">{Math.floor(debt)} oz</div>
                        </div>
                        <div className="bg-stone-950 p-3 rounded border border-stone-800 text-center">
                            <div className="text-xs text-stone-500">Assets</div>
                            <div className="text-xl font-bold text-blue-400">{Math.floor(assets)} oz</div>
                        </div>
                        <div className="bg-stone-950 p-3 rounded border border-stone-800 text-center">
                            <div className="text-xs text-stone-500">Leverage (D/E)</div>
                            <div className="text-xl font-bold text-white">{leverage.toFixed(2)}x</div>
                        </div>
                    </div>

                    <div className="bg-stone-950 p-4 rounded border border-stone-800">
                        <h4 className="text-sm font-bold text-stone-300 mb-2">Loan Eligibility Status</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Solvency Check (D/E &lt; 2.0)</span>
                                <span className={leverage < 2 ? "text-emerald-500" : "text-red-500"}>{leverage < 2 ? "PASS" : "FAIL"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Profitability (Last Period)</span>
                                <span className={company.lastProfit > 0 ? "text-emerald-500" : "text-red-500"}>{company.lastProfit > 0 ? "POSITIVE" : "NEGATIVE"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Collateral Sufficiency</span>
                                <span className={assets > debt * 1.5 ? "text-emerald-500" : "text-amber-500"}>{assets > debt * 1.5 ? "HIGH" : "LOW"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ai' && (
                <div className="bg-stone-950 p-6 rounded border border-stone-800 min-h-[300px]">
                    <div className="text-center mb-6">
                        <div className="inline-block p-4 bg-purple-900/20 rounded-full border border-purple-500/30 mb-3">
                            <Bot size={32} className="text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-purple-200">Gemini 深度分析</h3>
                        <p className="text-xs text-purple-400/60">Powered by Gemini 2.5 Flash</p>
                    </div>
                    
                    {!aiAnalysis ? (
                        <div className="text-center">
                            <Button onClick={handleAnalysis} disabled={analyzing} className="mx-auto" variant="primary">
                                {analyzing ? '分析中...' : '生成研报'}
                            </Button>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none text-left bg-stone-900 p-4 rounded border border-stone-700">
                            <pre className="whitespace-pre-wrap font-sans">{aiAnalysis}</pre>
                            <div className="mt-4 text-center">
                                <button onClick={() => setAiAnalysis("")} className="text-xs text-stone-500 hover:text-white underline">重新分析</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'overview' && (
              <>
                {company.isPlayerFounded && !company.isBankrupt && (
                    <div className="space-y-4 mb-6 bg-stone-950/50 p-4 rounded border border-stone-800">
                        <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                        <TrendingUp size={14}/> CEO 决策面板
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 智能薪资控制 */}
                            <div className="bg-stone-900 p-3 rounded border border-stone-800">
                                <label className="text-xs text-stone-500 block mb-2 font-bold flex items-center gap-1">
                                    <Anchor size={12}/> 智能薪资锚定 (Smart Wage)
                                </label>
                                
                                <div className="flex items-center gap-2 mb-2">
                                    <input 
                                        type="range" min="1.0" max="3.0" step="0.1" 
                                        value={wageMultiplier} 
                                        className="flex-1 accent-emerald-500 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                                        onChange={(e) => updateCompany(company.id, { wageMultiplier: parseFloat(e.target.value) })}
                                    />
                                    <span className="text-lg font-mono text-emerald-400 w-12 text-right">{wageMultiplier.toFixed(1)}x</span>
                                </div>
                                
                                <div className="bg-stone-950 p-2 rounded flex justify-between items-center">
                                    <div className="text-xs text-stone-400">
                                        <div className="text-[10px] text-stone-600">粮价基准</div>
                                        {grainPrice.toFixed(2)} oz
                                    </div>
                                    <div className="text-stone-600">×</div>
                                    <div className="text-xs text-stone-400">
                                        <div className="text-[10px] text-stone-600">倍率</div>
                                        {wageMultiplier}
                                    </div>
                                    <div className="text-stone-600">=</div>
                                    <div className="text-sm font-mono text-white font-bold">
                                        {company.wageOffer} oz/天
                                    </div>
                                </div>
                            </div>

                            {/* 价格控制 */}
                            <div className="bg-stone-900 p-3 rounded border border-stone-800">
                                <label className="text-xs text-stone-500 block mb-2 font-bold">产品定价策略</label>
                                <div className="flex items-center gap-2 mb-2">
                                    <input 
                                        type="range" min="-0.5" max="0.5" step="0.05" 
                                        value={company.pricePremium || 0} 
                                        className="flex-1 accent-blue-600 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                                        onChange={(e) => updateCompany(company.id, { pricePremium: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-emerald-500">倾销 (-50%)</span>
                                    <span className="text-white">{((company.pricePremium || 0) * 100).toFixed(0)}%</span>
                                    <span className="text-red-500">暴利 (+50%)</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 border-t border-stone-800 pt-3">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs text-stone-500 block mb-1">目标员工数: <span className="text-white font-bold">{company.targetEmployees}</span></label>
                                <div className="flex items-center gap-2">
                                    <button className="bg-stone-800 px-2 rounded hover:bg-stone-700" onClick={() => updateCompany(company.id, { targetEmployees: Math.max(0, company.targetEmployees - 1) })}>-</button>
                                    <button className="bg-stone-800 px-2 rounded hover:bg-stone-700" onClick={() => updateCompany(company.id, { targetEmployees: company.targetEmployees + 1 })}>+</button>
                                </div>
                                <div className="text-[10px] text-stone-500 mt-1">
                                    实际: {company.employees}人
                                </div>
                            </div>
                            <Button variant="success" size="sm" onClick={() => payDividend(company.id)} disabled={company.cash < 500}>分红</Button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-stone-950 p-2 rounded border border-stone-800">
                        <div className="text-stone-500 text-xs">现金</div>
                        <div className="text-emerald-400 font-mono">{Math.floor(company.cash)} oz</div>
                    </div>
                    <div className="bg-stone-950 p-2 rounded border border-stone-800">
                        <div className="text-stone-500 text-xs">原料库存</div>
                        <div className="text-stone-200 font-mono">{Object.values(company.inventory.raw).reduce<number>((a, b) => a + (Number(b) || 0), 0)}</div>
                    </div>
                    <div className="bg-stone-950 p-2 rounded border border-stone-800">
                        <div className="text-stone-500 text-xs">成品库存</div>
                        <div className="text-blue-300 font-mono">{Object.values(company.inventory.finished).reduce<number>((a, b) => a + (Number(b) || 0), 0)}</div>
                    </div>
                </div>
              </>
            )}

            {activeTab === 'lines' && (
               <div className="space-y-4">
                  {company.productionLines.map((line, idx) => (
                      <div key={idx} className="bg-stone-800 p-3 rounded flex justify-between items-center border border-stone-700">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-stone-900 rounded border border-stone-600">{RESOURCE_ICONS[line.type]}</div>
                              <div>
                                  <div className="font-bold text-stone-200">{line.type === 'GRAIN' ? '粮食种植' : '面包烘焙'}</div>
                                  <div className="text-xs text-stone-500 flex flex-col">
                                      <span>效率: {(line.efficiency * 100).toFixed(0)}%</span>
                                      <span className="text-[10px]">Max Cap: {line.maxCapacity || 50} units</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
            )}

            {activeTab === 'shareholders' && (
                <div className="border border-stone-800 rounded overflow-hidden">
                    <table className="w-full text-sm text-left text-stone-400">
                        <thead className="text-xs uppercase bg-stone-800 text-stone-400">
                            <tr><th className="px-3 py-2">股东</th><th className="px-3 py-2 text-right">持股</th></tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800">
                            {company.shareholders.map((s, idx) => (
                                <tr key={idx}><td className="px-3 py-2">{s.name}</td><td className="px-3 py-2 text-right">{s.count}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="pt-4 border-t border-stone-800">
                <Button className="w-full" variant="secondary" onClick={onClose}>关闭</Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};