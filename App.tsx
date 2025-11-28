

import React, { useState, useEffect } from 'react';
import { useGameLoop } from './shared/hooks/useGameLoop';
import { usePerformanceMonitor } from './shared/hooks/usePerformanceMonitor';
import { useResponsive } from './shared/hooks/useResponsive';
import { Header } from './components/Header';
import { CommoditiesTab } from './features/commodities/CommoditiesTab';
import { CompaniesTab } from './features/companies/CompaniesTab';
import { StatsTab } from './features/stats/StatsTab';
import { CityHallTab } from './features/cityhall/CityHallTab';
import { BankingTab } from './features/banking/BankingTab';
import { ValidationTab } from './features/validation/ValidationTab';
import { ChatWidget } from './components/ChatWidget';
import { CompanyModal } from './features/companies/CompanyModal';
import { CreateCompanyModal } from './features/companies/CreateCompanyModal';
import { generateMarketEvent } from './infrastructure/ai/GeminiAdapter';
import { ToastContainer } from './components/ui/ToastContainer';
import { DevTools } from './components/devtools/DevTools';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './shared/store/useGameStore';
import { Button, Card } from './shared/components';
import { Wheat, Building2, BarChart3, Landmark, Beaker, Briefcase, Plus, Settings } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

const App: React.FC = () => {
  useGameLoop();
  usePerformanceMonitor();
  const { isMobile, isDesktop } = useResponsive();

  const isRunning = useGameStore(s => s.isRunning);
  const day = useGameStore(s => s.gameState.day);
  const addEvent = useGameStore(s => s.addEvent);
  const start = useGameStore(s => s.start);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  
  // Use shallow to avoid re-renders when the array reference changes but content is same
  const myCompanies = useGameStore(useShallow(s => s.gameState.companies.filter(c => c.isPlayerFounded)));
  
  const [activeTab, setActiveTab] = useState<'commodities' | 'companies' | 'stats' | 'cityhall' | 'banking' | 'validation'>('commodities');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
      if (isRunning && day % 3 === 0) { 
         let isActive = true;
         
         const tryGenerateEvent = async () => {
             // Access state directly to avoid dependency loops in useEffect
             const currentEvents = useGameStore.getState().gameState.events;
             if (currentEvents.length > 0 && day - currentEvents[0].turnCreated < 5) return;
             
             const evt = await generateMarketEvent(day);
             if (isActive && evt) {
                 addEvent(evt);
             }
         };
         tryGenerateEvent();
         return () => { isActive = false; };
      }
  }, [day, isRunning, addEvent]);

  const handleSpeedChange = (speed: number) => {
      setGameSpeed(speed);
      if (!isRunning) start();
  };

  const MobileNav = () => (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-stone-900 border-t border-stone-800 pb-safe">
        <div className="flex justify-around p-2">
            <button className={`flex flex-col items-center p-1 ${activeTab === 'commodities' ? 'text-emerald-400' : 'text-stone-500'}`} onClick={() => setActiveTab('commodities')}>
                <Wheat size={20}/>
                <span className="text-[10px]">现货</span>
            </button>
            <button className={`flex flex-col items-center p-1 ${activeTab === 'companies' ? 'text-blue-400' : 'text-stone-500'}`} onClick={() => setActiveTab('companies')}>
                <Building2 size={20}/>
                <span className="text-[10px]">股市</span>
            </button>
            <button className={`flex flex-col items-center p-1 ${activeTab === 'banking' ? 'text-amber-400' : 'text-stone-500'}`} onClick={() => setActiveTab('banking')}>
                <Briefcase size={20}/>
                <span className="text-[10px]">银行</span>
            </button>
            <button className={`flex flex-col items-center p-1 ${activeTab === 'cityhall' ? 'text-purple-400' : 'text-stone-500'}`} onClick={() => setActiveTab('cityhall')}>
                <Landmark size={20}/>
                <span className="text-[10px]">政务</span>
            </button>
            <button className={`flex flex-col items-center p-1 ${activeTab === 'stats' ? 'text-pink-400' : 'text-stone-500'}`} onClick={() => setActiveTab('stats')}>
                <BarChart3 size={20}/>
                <span className="text-[10px]">数据</span>
            </button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans pb-20">
      <Header 
        onStop={useGameStore.getState().stop} 
        onSetGameSpeed={handleSpeedChange}
        onToggleDevTools={() => setShowDevTools(p => !p)}
      />

      <ToastContainer />
      <DevTools isOpen={showDevTools} onToggle={() => setShowDevTools(p => !p)} /> 
      
      <main className={`pt-20 px-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6`}>
         {isDesktop && (
             <div className="lg:col-span-3 space-y-4 h-fit sticky top-24">
                <Card className="bg-stone-900 border-stone-800" title="市场导航">
                    <div className="space-y-1">
                        <Button className="w-full justify-start" variant={activeTab === 'commodities' ? 'primary' : 'secondary'} onClick={() => setActiveTab('commodities')}><Wheat size={16}/> 现货市场 (LOB)</Button>
                        <Button className="w-full justify-start" variant={activeTab === 'companies' ? 'primary' : 'secondary'} onClick={() => setActiveTab('companies')}><Building2 size={16}/> 股票交易所</Button>
                        <Button className="w-full justify-start" variant={activeTab === 'banking' ? 'primary' : 'secondary'} onClick={() => setActiveTab('banking')}><Briefcase size={16}/> 央行与信贷</Button>
                        <Button className="w-full justify-start" variant={activeTab === 'stats' ? 'primary' : 'secondary'} onClick={() => setActiveTab('stats')}><BarChart3 size={16}/> 宏观数据</Button>
                        <Button className="w-full justify-start" variant={activeTab === 'cityhall' ? 'primary' : 'secondary'} onClick={() => setActiveTab('cityhall')}><Landmark size={16}/> 市政厅与人口</Button>
                        <div className="pt-2 mt-2 border-t border-stone-700">
                            <Button className="w-full justify-start" variant={activeTab === 'validation' ? 'primary' : 'secondary'} onClick={() => setActiveTab('validation')}><Beaker size={16} className="text-indigo-400"/> 经济实验室</Button>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-b from-stone-800 to-stone-900 border-stone-700" title="我的商业帝国">
                    <div className="space-y-2">
                        {myCompanies.map(c => (
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={c.id} 
                            className="p-3 bg-stone-950 rounded border border-stone-800 hover:border-stone-600 cursor-pointer flex justify-between items-center" 
                            onClick={() => setSelectedCompanyId(c.id)}
                        >
                            <div>
                                <div className="font-bold text-sm flex items-center gap-1">
                                {c.name} {c.isBankrupt && <span className="text-red-500 text-[10px] bg-red-900/20 px-1 rounded">破产</span>}
                                </div>
                                <div className="text-xs text-stone-500">员工: {c.employees} | 现金: {Math.floor(c.cash)}</div>
                            </div>
                            <Settings size={14} className="text-stone-500"/>
                        </motion.div>
                        ))}
                        <Button className="w-full mt-2" variant="success" size="sm" onClick={() => setShowCreateCompany(true)}>
                        <Plus size={14}/> 注册新公司 (20 oz)
                        </Button>
                    </div>
                </Card>
             </div>
         )}

         <div className="lg:col-span-9 space-y-6 min-h-[80vh]">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'commodities' && <CommoditiesTab />}
                    {activeTab === 'companies' && <CompaniesTab onSelectCompany={setSelectedCompanyId} />}
                    {activeTab === 'banking' && <BankingTab />}
                    {activeTab === 'stats' && <StatsTab />}
                    {activeTab === 'cityhall' && <CityHallTab />}
                    {activeTab === 'validation' && <ValidationTab />}
                </motion.div>
            </AnimatePresence>
         </div>
      </main>

      {isMobile && <MobileNav />}
      
      <ChatWidget />

      <AnimatePresence>
      {showCreateCompany && (
        <CreateCompanyModal 
          onClose={() => setShowCreateCompany(false)} 
          onCreate={(name, type) => {
              useGameStore.getState().createCompany(name, type);
              setShowCreateCompany(false);
          }} 
        />
      )}
      </AnimatePresence>

      <AnimatePresence>
      {selectedCompanyId && (
        <CompanyModal 
          companyId={selectedCompanyId} 
          onClose={() => setSelectedCompanyId(null)}
        />
      )}
      </AnimatePresence>
    </div>
  );
};

export default App;