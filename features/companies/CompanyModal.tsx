import React, { useState } from 'react';
import { TrendingUp, Users, Briefcase, Activity, Anchor, BarChart, Bot, Sparkles, PieChart, Layers } from 'lucide-react';
import { ProductType, ResourceType, IndustryType } from '../../shared/types';
import { Card, Button } from '../../shared/components';
import { RESOURCE_ICONS } from '../../shared/assets';
import { KLineChart } from '../../shared/components/charts/KLineChart';
import { motion } from 'framer-motion';
import { analyzeCompany } from '../../infrastructure/ai/GeminiAdapter';
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
  
  const updateCompany = useGameStore(s => s.updateCompany);
  const payDividend = useGameStore(s => s.payDividend);

  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'lines' | 'shareholders' | 'ai'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  
  if (!company) return null;

  const ownedShares = playerPortfolio?.[company.id] || 0;
  const grainPrice = resources[ResourceType.GRAIN].currentPrice;
  const wageMultiplier = company.wageMultiplier || 1.5;

  const handleAnalysis = async () => {
      setAnalyzing(true);
      const text = await analyzeCompany(company, useGameStore.getState().gameState);
      setAiAnalysis(text);
      setAnalyzing(false);
  };

  const getStageColor = (stage: string) => {
      if (stage === 'STARTUP') return 'text-blue-400 bg-blue-900/30 border-blue-800';
      if (stage === 'GROWTH') return 'text-emerald-400 bg-emerald-900/30 border-emerald-800';
      if (stage === 'MATURITY') return 'text-amber-400 bg-amber-900/30 border-amber-800';
      return 'text-red-400 bg-red-900/30 border-red-800';
  };

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

            {activeTab === 'ai' && (
                <div className="bg-stone-950 p-6 rounded border border-stone-800 min-h-[30