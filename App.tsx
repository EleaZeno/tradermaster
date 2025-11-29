
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
import { aiService } from './infrastructure/ai/GeminiAdapter';
import { ToastContainer } from './components/ui/ToastContainer';
import { FloatingTextLayer } from './components/ui/FloatingTextLayer';
import { DevTools } from './components/devtools/DevTools';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './shared/store/useGameStore';
import { getTranslation } from './shared/utils/i18n';
import { Wheat, Building2, BarChart3, Landmark, Beaker, Briefcase, Plus, Settings, TrendingUp, Home, PieChart, Cpu, Activity, LayoutDashboard, Coins } from 'lucide-react';
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
  const lang = useGameStore(s => s.gameState.settings.language);
  
  const myCompanies = useGameStore(useShallow(s => s.gameState.companies.filter(c => c.isPlayerFounded)));
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'banking' | 'validation' | 'commodities' | 'companies' | 'cityhall'>('dashboard');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  const t = (key: string) => getTranslation(key, lang);

  useEffect(() => {
      document.title = t('header.title');
  }, [lang]);

  useEffect(() => {
      if (isRunning && day % 3 === 0) { 
         let isActive = true;
         const tryGenerateEvent = async () => {
             const currentEvents = useGameStore.getState().gameState.events;
             if (currentEvents.length > 0 && day - currentEvents[0].turnCreated < 5) return;
             
             const evt = await aiService.generateMarketEvent(day);
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

  const NavItem = ({ id, label, icon: Icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
            activeTab === id 
            ? 'bg-gradient-to-r from-blue-900/50 to-transparent text-white border-l-2 border-blue-500' 
            : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
        }`}
      >
          <Icon size={18} className={activeTab === id ? "text-blue-400" : "text-stone-500 group-hover:text-stone-300"} />
          <span className="text-sm font-medium">{label}</span>
      </button>
  );

  return (
    <div className="flex h-screen w-full bg-[#0c0a09] text-stone-200 font-sans overflow-hidden">
      {/* --- DESKTOP SIDEBAR --- */}
      {isDesktop && (
          <aside className="w-64 bg-stone-950 border-r border-stone-800 flex flex-col shrink-0 relative z-20">
              {/* Logo Area */}
              <div className="h-16 flex items-center px-6 border-b border-stone-800 bg-stone-950/50 backdrop-blur-sm">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/20 mr-3">
                      <TrendingUp size={18} className="text-white" />
                  </div>
                  <div>
                      <h1 className="font-bold text-stone-100 tracking-tight leading-none">EcoTycoon</h1>
                      <span className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">Pro Simulation</span>
                  </div>
              </div>

              {/* Navigation Structure */}
              <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                  
                  {/* CORE SYSTEMS */}
                  <div className="px-3 pb-2 text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                      <Cpu size={10} /> {t('nav.core')}
                  </div>
                  <NavItem id="dashboard" label={t('nav.dashboard')} icon={LayoutDashboard} />
                  <NavItem id="banking" label={t('nav.banking')} icon={Coins} />
                  <NavItem id="validation" label={t('nav.validation')} icon={Beaker} />
                  
                  <div className="my-4 border-t border-stone-800 mx-3"></div>

                  {/* MARKET SYSTEMS */}
                  <div className="px-3 pb-2 text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={10} /> {t('nav.market')}
                  </div>
                  <NavItem id="commodities" label={t('nav.commodities')} icon={Wheat} />
                  <NavItem id="companies" label={t('nav.companies')} icon={BarChart3} />
                  
                  <div className="my-4 border-t border-stone-800 mx-3"></div>

                  {/* CITY SYSTEMS */}
                  <div className="px-3 pb-2 text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                      <Building2 size={10} /> {t('nav.city')}
                  </div>
                  <NavItem id="cityhall" label={t('nav.cityhall')} icon={Landmark} />
              </div>

              {/* My Empire Mini-Panel */}
              <div className="p-4 border-t border-stone-800 bg-stone-900/30">
                  <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-stone-500 uppercase">{t('nav.empire')}</span>
                      <button 
                        onClick={() => setShowCreateCompany(true)}
                        className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-emerald-400 transition-colors"
                        title={t('comp.create_title')}
                      >
                          <Plus size={14} />
                      </button>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                      {myCompanies.map(c => (
                          <div 
                            key={c.id}
                            onClick={() => setSelectedCompanyId(c.id)}
                            className="flex items-center justify-between p-2 rounded bg-stone-800/50 hover:bg-stone-800 cursor-pointer border border-transparent hover:border-stone-700 transition-all group"
                          >
                              <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                                  <span className="text-xs text-stone-300 truncate">{c.name}</span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500 group-hover:text-stone-300">{Math.floor(c.cash)}oz</span>
                          </div>
                      ))}
                      {myCompanies.length === 0 && (
                          <div className="text-center py-4 border-2 border-dashed border-stone-800 rounded-lg">
                              <span className="text-xs text-stone-600">{t('nav.nocompany')}</span>
                          </div>
                      )}
                  </div>
              </div>
          </aside>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0a09] relative">
          {/* Header (Top Bar) */}
          <Header 
            onStop={useGameStore.getState().stop} 
            onSetGameSpeed={handleSpeedChange}
            onToggleDevTools={() => setShowDevTools(p => !p)}
          />

          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar relative z-0">
             <div className="max-w-7xl mx-auto min-h-full pb-20 lg:pb-0">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'dashboard' && <StatsTab />}
                        {activeTab === 'commodities' && <CommoditiesTab />}
                        {activeTab === 'companies' && <CompaniesTab onSelectCompany={setSelectedCompanyId} />}
                        {activeTab === 'banking' && <BankingTab />}
                        {activeTab === 'cityhall' && <CityHallTab />}
                        {activeTab === 'validation' && <ValidationTab />}
                    </motion.div>
                </AnimatePresence>
             </div>
          </main>

          {/* --- MOBILE NAV --- */}
          {isMobile && (
            <div className="fixed bottom-0 inset-x-0 z-50 bg-stone-900/95 backdrop-blur border-t border-stone-800 pb-safe">
                <div className="flex justify-around p-2">
                    <button className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'dashboard' ? 'text-blue-400 bg-blue-950/30' : 'text-stone-500'}`} onClick={() => setActiveTab('dashboard')}>
                        <LayoutDashboard size={20}/>
                    </button>
                    <button className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'commodities' ? 'text-emerald-400 bg-emerald-950/30' : 'text-stone-500'}`} onClick={() => setActiveTab('commodities')}>
                        <Wheat size={20}/>
                    </button>
                    <button className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'companies' ? 'text-purple-400 bg-purple-950/30' : 'text-stone-500'}`} onClick={() => setActiveTab('companies')}>
                        <Building2 size={20}/>
                    </button>
                    <button className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'banking' ? 'text-amber-400 bg-amber-950/30' : 'text-stone-500'}`} onClick={() => setActiveTab('banking')}>
                        <Coins size={20}/>
                    </button>
                    <button className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'validation' ? 'text-pink-400 bg-pink-950/30' : 'text-stone-500'}`} onClick={() => setActiveTab('validation')}>
                        <Beaker size={20}/>
                    </button>
                </div>
            </div>
          )}
      </div>

      <ToastContainer />
      <FloatingTextLayer />
      <DevTools isOpen={showDevTools} onToggle={() => setShowDevTools(p => !p)} /> 
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
