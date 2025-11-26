
import React, { useState, useEffect } from 'react';
import { 
  Wheat, Building2, BarChart3, Landmark, Plus, Settings, AlertTriangle, Briefcase 
} from 'lucide-react';
import { useGameStore } from './shared/store/useGameStore';
import { useGameLoop } from './shared/hooks/useGameLoop';
import { IndustryStat, IndustryType } from './shared/types';
import { Button, Card } from './shared/components';
import { Header } from './components/Header';
import { CommoditiesTab } from './features/commodities/CommoditiesTab';
import { CompaniesTab } from './features/companies/CompaniesTab';
import { StatsTab } from './features/stats/StatsTab';
import { CityHallTab } from './features/cityhall/CityHallTab';
import { BankingTab } from './features/banking/BankingTab';
import { ChatWidget } from './components/ChatWidget';
import { CompanyModal } from './features/companies/CompanyModal';
import { CreateCompanyModal } from './features/companies/CreateCompanyModal';
import { generateMarketEvent } from './services/advisorService';
import { useGodModeData } from './shared/hooks/useGodModeData';

const App: React.FC = () => {
  useGameLoop();

  // Store Selectors
  const gameState = useGameStore(s => s.gameState);
  const isRunning = useGameStore(s => s.isRunning);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const start = useGameStore(s => s.start);
  const stop = useGameStore(s => s.stop);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  const updateChatHistory = useGameStore(s => s.updateChatHistory);
  const addLog = useGameStore(s => s.addLog);
  const addEvent = useGameStore(s => s.addEvent); 
  
  const createCompany = useGameStore(s => s.createCompany);
  const updateCompany = useGameStore(s => s.updateCompany);
  const payDividend = useGameStore(s => s.payDividend);
  const addLine = useGameStore(s => s.addLine);
  const trade = useGameStore(s => s.trade);
  const buyFutures = useGameStore(s => s.buyFutures);
  const buyStock = useGameStore(s => s.buyStock);
  const sellStock = useGameStore(s => s.sellStock);
  const setLivingStandard = useGameStore(s => s.setLivingStandard);

  const [activeTab, setActiveTab] = useState<'commodities' | 'companies' | 'stats' | 'cityhall' | 'banking'>('commodities');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const godModeData = useGodModeData(gameState);

  useEffect(() => {
      if (isRunning && gameState.day % 1 === 0) { 
         const tryGenerateEvent = async () => {
             if (gameState.events.length > 0 && gameState.day - gameState.events[0].turnCreated < 5) return;
             
             const evt = await generateMarketEvent(gameState.day);
             if (evt) {
                 addEvent(evt);
                 addLog(`📢 突发新闻: ${evt.headline}`);
             }
         };
         tryGenerateEvent();
      }
  }, [gameState.day, isRunning]);

  const industryStats: IndustryStat[] = []; 

  const selectedCompany = gameState.companies.find(c => c.id === selectedCompanyId);
  const latestEvent = gameState.events.length > 0 ? gameState.events[0] : null;

  const handleCreateCompany = (name: string, type: IndustryType) => {
      createCompany(name, type);
      setShowCreateCompany(false);
  };

  const handleSpeedChange = (speed: number) => {
      setGameSpeed(speed);
      if (!isRunning) start();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans pb-20">
      <Header 
        gameState={gameState} 
        isRunning={isRunning} 
        gameSpeed={gameSpeed} 
        onStop={stop} 
        onSetGameSpeed={handleSpeedChange} 
        onSetLivingStandard={setLivingStandard}
      />

      <main className="pt-24 pb-10 px-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-3 space-y-4 h-fit sticky top-24">
            
            {latestEvent && (gameState.day - latestEvent.turnCreated < 5) && (
                <div className="animate-in slide-in-from-top-4 duration-500">
                    <Card className={`border-l-4 ${latestEvent.impactType === 'BAD' ? 'border-l-red-500 bg-red-950/20' : latestEvent.impactType === 'GOOD' ? 'border-l-emerald-500 bg-emerald-950/20' : 'border-l-blue-500'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle size={14} className={latestEvent.impactType === 'BAD' ? 'text-red-500' : 'text-stone-400'}/>
                            <h3 className="font-bold text-sm">{latestEvent.headline}</h3>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed">{latestEvent.description}</p>
                    </Card>
                </div>
            )}

            <Card className="bg-stone-900 border-stone-800" title="市场导航">
              <div className="space-y-1">
                <Button className="w-full justify-start" variant={activeTab === 'commodities' ? 'primary' : 'secondary'} onClick={() => setActiveTab('commodities')}><Wheat size={16}/> 商品现货 & LOB</Button>
                <Button className="w-full justify-start" variant={activeTab === 'companies' ? 'primary' : 'secondary'} onClick={() => setActiveTab('companies')}><Building2 size={16}/> 股票交易所</Button>
                <Button className="w-full justify-start" variant={activeTab === 'banking' ? 'primary' : 'secondary'} onClick={() => setActiveTab('banking')}><Briefcase size={16}/> 央行与信贷</Button>
                <Button className="w-full justify-start" variant={activeTab === 'stats' ? 'primary' : 'secondary'} onClick={() => setActiveTab('stats')}><BarChart3 size={16}/> 宏观数据</Button>
                <Button className="w-full justify-start" variant={activeTab === 'cityhall' ? 'primary' : 'secondary'} onClick={() => setActiveTab('cityhall')}><Landmark size={16}/> 市政厅与人口</Button>
              </div>
            </Card>

            <Card className="bg-gradient-to-b from-stone-800 to-stone-900 border-stone-700" title="我的商业帝国">
               <div className="space-y-2">
                 {gameState.companies.filter(c => c.isPlayerFounded).map(c => (
                    <div key={c.id} className="p-3 bg-stone-950 rounded border border-stone-800 hover:border-stone-600 cursor-pointer flex justify-between items-center" onClick={() => setSelectedCompanyId(c.id)}>
                       <div>
                          <div className="font-bold text-sm flex items-center gap-1">
                            {c.name} {c.isBankrupt && <span className="text-red-500 text-[10px] bg-red-900/20 px-1 rounded">破产</span>}
                          </div>
                          <div className="text-xs text-stone-500">员工: {c.employees} | 现金: {Math.floor(c.cash)} oz</div>
                       </div>
                       <Settings size={14} className="text-stone-500"/>
                    </div>
                 ))}
                 <Button className="w-full mt-2" variant="success" size="sm" onClick={() => setShowCreateCompany(true)}>
                    <Plus size={14}/> 注册新公司 (20 oz)
                 </Button>
               </div>
            </Card>

            <Card className="h-64 flex flex-col bg-stone-900 border-stone-800" title="系统日志">
               <div className="flex-1 overflow-y-auto text-xs space-y-3 pr-2 text-stone-400 font-mono custom-scrollbar">
                  {gameState.logs.map((l, i) => (
                     <div key={i} className="border-b border-stone-800 pb-2 last:border-0">
                       <span className="text-stone-600 mr-2">[{gameState.day - i > 0 ? gameState.day - i : 1}]</span>
                       {l}
                     </div>
                  ))}
               </div>
            </Card>
         </div>

         <div className="lg:col-span-9 space-y-6">
            {activeTab === 'commodities' && (
              <CommoditiesTab 
                resources={gameState.resources} 
                products={gameState.products} 
                cash={gameState.cash} 
                futures={gameState.futures}
                day={gameState.day}
                onTrade={trade} 
                onBuyFutures={buyFutures}
              />
            )}

            {activeTab === 'companies' && (
              <CompaniesTab 
                companies={gameState.companies} 
                funds={gameState.funds}
                products={gameState.products} 
                cash={gameState.cash}
                onBuy={(id, isFund) => buyStock(id, isFund)}
                onSell={(id, isFund) => sellStock(id, isFund)}
                onShort={() => {}} 
                onCover={() => {}}
                onSelectCompany={setSelectedCompanyId}
              />
            )}

            {activeTab === 'banking' && (
              <BankingTab bank={gameState.bank} />
            )}

            {activeTab === 'stats' && (
              <StatsTab gameState={gameState} industryStats={industryStats} />
            )}

            {activeTab === 'cityhall' && (
              <CityHallTab gameState={gameState} companies={gameState.companies} />
            )}
         </div>
      </main>

      <ChatWidget 
        gameState={gameState} 
        godModeData={godModeData} 
        onUpdateHistory={updateChatHistory} 
      />

      {showCreateCompany && (
        <CreateCompanyModal 
          products={gameState.products}
          resources={gameState.resources}
          cash={gameState.cash} 
          onClose={() => setShowCreateCompany(false)} 
          onCreate={handleCreateCompany} 
        />
      )}

      {selectedCompany && (
        <CompanyModal 
          company={selectedCompany} 
          products={gameState.products} 
          resources={gameState.resources}
          marketWage={gameState.population.averageWage}
          onClose={() => setSelectedCompanyId(null)}
          onUpdate={updateCompany}
          onDividend={payDividend}
          onPivot={() => {}}
          onAddLine={addLine}
        />
      )}
    </div>
  );
};

export default App;
