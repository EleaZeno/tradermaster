
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Database, Activity, FileText, FastForward, Play, Pause } from 'lucide-react';

interface DevToolsProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'state' | 'market' | 'events'>('market');
  
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
                    <span className="font-bold text-white">ECO_TYCOON_DEV_TOOLS v1.0</span>
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
                            {Object.entries(gameState.market).map(([itemId, book]) => (
                                <div key={itemId} className="border border-stone-800 rounded bg-stone-900/50 flex flex-col h-64 overflow-hidden">
                                    <div className="bg-stone-800 px-2 py-1 font-bold text-white flex justify-between">
                                        <span>{itemId}</span>
                                        <span className="text-stone-400">{book.lastPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-1 text-[10px]">
                                        {/* Bids */}
                                        <div className="flex-1 border-r border-stone-800 overflow-y-auto">
                                            <div className="sticky top-0 bg-stone-900 text-emerald-500 px-1 border-b border-stone-800">BIDS (Buy)</div>
                                            {book.bids.map(o => (
                                                <div key={o.id} className="flex justify-between px-2 hover:bg-emerald-900/20">
                                                    <span>{o.price.toFixed(2)}</span>
                                                    <span className="text-stone-400">{o.remainingQuantity.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Asks */}
                                        <div className="flex-1 overflow-y-auto">
                                            <div className="sticky top-0 bg-stone-900 text-red-500 px-1 border-b border-stone-800 text-right">ASKS (Sell)</div>
                                            {book.asks.map(o => (
                                                <div key={o.id} className="flex justify-between px-2 hover:bg-red-900/20">
                                                    <span className="text-stone-400">{o.remainingQuantity.toFixed(1)}</span>
                                                    <span>{o.price.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'events' && (
                        <div className="h-full flex flex-col">
                            <h3 className="text-stone-500 mb-2 font-bold uppercase border-b border-stone-800 pb-1">System Event Stream</h3>
                            <div className="flex-1 overflow-y-auto font-mono space-y-1">
                                {gameState.logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 hover:bg-stone-900 px-2 py-0.5">
                                        <span className="text-stone-600 w-8">[{i}]</span>
                                        <span className={log.includes('!') ? 'text-amber-400' : 'text-stone-400'}>{log}</span>
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
