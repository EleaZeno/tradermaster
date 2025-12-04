
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Database, Activity, FileText, FastForward, Play, Pause, Bug, Copy, Brain, RefreshCw } from 'lucide-react';
import { aiService } from '../../infrastructure/ai/GeminiAdapter';
import { OrderBook } from '../../shared/types';
import DOMPurify from 'dompurify';

// @ts-ignore
const marked = window.marked;

interface DevToolsProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'state' | 'market' | 'events' | 'debug'>('debug');
  const [aiReport, setAiReport] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [copyStatus, setCopyStatus] = useState("复制上下文");
  
  const gameState = useGameStore(s => s.gameState);
  const isRunning = useGameStore(s => s.isRunning);
  const start = useGameStore(s => s.start);
  const stop = useGameStore(s => s.stop);
  const tick = useGameStore(s => s.tick);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  const handleSkip = (ticks: number) => {
      const wasRunning = isRunning;
      if(wasRunning) stop();
      for(let i=0; i<ticks; i++) tick();
      if(wasRunning) start();
  };

  const getDebugContext = () => {
      return JSON.stringify({
          meta: {
              day: gameState.day,
              tick: gameState.totalTicks,
              version: "3.1.0-Physics"
          },
          anomalies: gameState.logs.filter(l => l.includes('CRITICAL') || l.includes('VIOLATION') || l.includes('NaN')),
          macroHistory: gameState.macroHistory.slice(-20), // Last 20 data points
          bank: gameState.bank,
          treasury: gameState.cityTreasury,
          marketOverview: Object.entries(gameState.market).map(([k, v]) => {
              const book = v as OrderBook;
              return {
                  id: k, 
                  price: book.lastPrice,
                  spread: book.spread,
                  depth: book.bids.length + book.asks.length
              };
          }),
          companies: gameState.companies.map(c => ({
              name: c.name,
              cash: c.cash,
              profit: c.lastProfit,
              employees: c.employees,
              isBankrupt: c.isBankrupt
          }))
      }, null, 2);
  };

  const handleCopyContext = () => {
      const context = getDebugContext();
      navigator.clipboard.writeText(context).then(() => {
          setCopyStatus("已复制!");
          setTimeout(() => setCopyStatus("复制上下文 (Copy Context)"), 2000);
      });
  };

  const handleAiDebug = async () => {
      setAnalyzing(true);
      setAiReport("");
      const context = getDebugContext();
      try {
          const result = await aiService.debugSimulation(context);
          setAiReport(result);
      } catch (e) {
          setAiReport("AI Analysis Failed.");
      } finally {
          setAnalyzing(false);
      }
  };

  const renderMarkdown = (text: string) => {
      if (!text) return null;
      if (!marked) return <pre className="whitespace-pre-wrap">{text}</pre>;
      const rawHtml = marked.parse(text);
      return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml as string) }} />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 bottom-4 top-20 z-[100] bg-stone-950/95 border border-stone-700 shadow-2xl rounded-lg flex flex-col backdrop-blur-md font-mono text-xs text-stone-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-stone-800 bg-stone-900/50 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-emerald-500" />
                    <span className="font-bold text-white">ECO_TYCOON_WORKBENCH</span>
                    <span className="bg-stone-800 px-1 rounded text-stone-500">Tick: {gameState.totalTicks}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-1 hover:bg-stone-800 rounded text-stone-400" onClick={() => handleSkip(10)} title="Skip 10 ticks"><FastForward size={14}/></button>
                    <button className="p-1 hover:bg-stone-800 rounded text-stone-400" onClick={isRunning ? stop : start}>
                        {isRunning ? <Pause size={14}/> : <Play size={14}/>}
                    </button>
                    <button onClick={onToggle} className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded"><X size={16}/></button>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-12 bg-stone-900 border-r border-stone-800 flex flex-col items-center py-2 gap-2">
                    <button 
                        onClick={() => setActiveTab('debug')} 
                        className={`p-2 rounded ${activeTab === 'debug' ? 'bg-red-900 text-red-400' : 'hover:bg-stone-800 text-stone-500'}`}
                        title="Debug Lab"
                    >
                        <Bug size={18}/>
                    </button>
                    <button 
                        onClick={() => setActiveTab('state')} 
                        className={`p-2 rounded ${activeTab === 'state' ? 'bg-blue-900 text-blue-400' : 'hover:bg-stone-800 text-stone-500'}`}
                        title="State Inspector"
                    >
                        <Database size={18}/>
                    </button>
                    <button 
                        onClick={() => setActiveTab('market')} 
                        className={`p-2 rounded ${activeTab === 'market' ? 'bg-emerald-900 text-emerald-400' : 'hover:bg-stone-800 text-stone-500'}`}
                        title="Market Depth"
                    >
                        <Activity size={18}/>
                    </button>
                    <button 
                        onClick={() => setActiveTab('events')} 
                        className={`p-2 rounded ${activeTab === 'events' ? 'bg-amber-900 text-amber-400' : 'hover:bg-stone-800 text-stone-500'}`}
                        title="Event Log"
                    >
                        <FileText size={18}/>
                    </button>
                </div>

                {/* Main Panel */}
                <div className="flex-1 overflow-auto p-4 bg-stone-950">
                    {activeTab === 'debug' && (
                        <div className="h-full flex flex-col gap-4">
                            <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                                <h3 className="text-stone-400 font-bold uppercase flex items-center gap-2"><Bug size={14}/> 异常捕获与 AI 诊断</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleCopyContext}
                                        className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1 rounded transition-colors"
                                    >
                                        <Copy size={12}/> {copyStatus}
                                    </button>
                                    <button 
                                        onClick={handleAiDebug}
                                        disabled={analyzing}
                                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded transition-colors shadow-lg shadow-indigo-900/50"
                                    >
                                        {analyzing ? <RefreshCw className="animate-spin" size={12}/> : <Brain size={12}/>}
                                        AI 代码逻辑审计
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                                {/* Left: Anomaly Log */}
                                <div className="border border-stone-800 rounded bg-stone-900/30 flex flex-col overflow-hidden">
                                    <div className="bg-stone-900 px-3 py-2 text-red-400 font-bold text-xs border-b border-stone-800">
                                        系统异常流 (Anomaly Stream)
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
                                        {gameState.logs.filter(l => l.includes('CRITICAL') || l.includes('VIOLATION') || l.includes('NaN') || l.includes('ANOMALY')).map((log, i) => (
                                            <div key={i} className="text-red-400 border-b border-red-900/20 pb-1 mb-1">
                                                {log}
                                            </div>
                                        ))}
                                        {gameState.logs.filter(l => l.includes('CRITICAL') || l.includes('VIOLATION') || l.includes('NaN') || l.includes('ANOMALY')).length === 0 && (
                                            <div className="text-stone-600 italic text-center mt-10">系统运行正常，未捕获致命错误。</div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: AI Analysis Report */}
                                <div className="border border-stone-800 rounded bg-stone-900/30 flex flex-col overflow-hidden relative">
                                    <div className="bg-stone-900 px-3 py-2 text-indigo-400 font-bold text-xs border-b border-stone-800">
                                        Gemini 诊断报告
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 prose prose-invert prose-sm max-w-none">
                                        {analyzing ? (
                                            <div className="flex flex-col items-center justify-center h-full text-indigo-500 gap-2">
                                                <RefreshCw className="animate-spin" size={24}/>
                                                <span>正在分析 50kb 游戏状态快照...</span>
                                            </div>
                                        ) : aiReport ? (
                                            renderMarkdown(aiReport)
                                        ) : (
                                            <div className="text-stone-600 italic text-center mt-10">
                                                点击 "AI 代码逻辑审计" 让 Gemini 分析当前的经济死锁或数值溢出问题。
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'state' && (
                        <div className="h-full">
                            <h3 className="text-stone-500 mb-2 font-bold uppercase border-b border-stone-800 pb-1">Global State Tree</h3>
                            <pre className="text-[10px] text-blue-300 overflow-auto h-full pb-10 select-text">
                                {JSON.stringify({
                                    cash: gameState.cash,
                                    day: gameState.day,
                                    treasury: gameState.cityTreasury,
                                    bank: gameState.bank,
                                    populationSummary: {
                                        total: gameState.population.total,
                                        unemployed: gameState.population.unemployed,
                                        avgWage: gameState.population.averageWage
                                    },
                                    companies: gameState.companies.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        cash: c.cash,
                                        profit: c.lastProfit,
                                        stock: c.inventory
                                    }))
                                }, null, 2)}
                            </pre>
                        </div>
                    )}

                    {activeTab === 'market' && (
                        <div className="grid grid-cols-2 gap-4 h-full">
                            {Object.entries(gameState.market).map(([itemId, bookVal]) => {
                                const book = bookVal as OrderBook;
                                return (
                                <div key={itemId} className="border border-stone-800 rounded bg-stone-900/50 flex flex-col h-64 overflow-hidden">
                                    <div className="bg-stone-800 px-2 py-1 font-bold text-white flex justify-between">
                                        <span>{itemId}</span>
                                        <span className="text-stone-400">{book.lastPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-1 text-[10px]">
                                        {/* Bids */}
                                        <div className="flex-1 border-r border-stone-800 overflow-y-auto">
                                            <div className="sticky top-0 bg-stone-900 text-emerald-500 px-1 border-b border-stone-800">BIDS (Buy)</div>
                                            {book.bids.map((o: any) => (
                                                <div key={o.id} className="flex justify-between px-2 hover:bg-emerald-900/20">
                                                    <span>{o.price.toFixed(2)}</span>
                                                    <span className="text-stone-400">{o.remainingQuantity.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Asks */}
                                        <div className="flex-1 overflow-y-auto">
                                            <div className="sticky top-0 bg-stone-900 text-red-500 px-1 border-b border-stone-800 text-right">ASKS (Sell)</div>
                                            {book.asks.map((o: any) => (
                                                <div key={o.id} className="flex justify-between px-2 hover:bg-red-900/20">
                                                    <span className="text-stone-400">{o.remainingQuantity.toFixed(1)}</span>
                                                    <span>{o.price.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {activeTab === 'events' && (
                        <div className="h-full flex flex-col">
                            <h3 className="text-stone-500 mb-2 font-bold uppercase border-b border-stone-800 pb-1">System Event Stream</h3>
                            <div className="flex-1 overflow-y-auto font-mono space-y-1">
                                {gameState.logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 hover:bg-stone-900 px-2 py-0.5">
                                        <span className="text-stone-600 w-8">[{i}]</span>
                                        <span className={log.includes('!') || log.includes('CRITICAL') ? 'text-amber-400' : 'text-stone-400'}>{log}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
