
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Wallet, Calendar, Play, Pause, FastForward,
  ShoppingBag, Building2, BarChart3, Plus, Settings, Coffee, Landmark, Wheat, AlertTriangle
} from 'lucide-react';
import { useGameStore } from './store/useGameStore';
import { useGameLoop } from './hooks/useGameLoop';
import { IndustryStat, LivingStandard, IndustryType, ResourceType } from './types';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { CommoditiesTab } from './components/tabs/CommoditiesTab';
import { CompaniesTab } from './components/tabs/CompaniesTab';
import { StatsTab } from './components/tabs/StatsTab';
import { CityHallTab } from './components/tabs/CityHallTab';
import { ChatWidget } from './components/ChatWidget';
import { CompanyModal } from './components/modals/CompanyModal';
import { CreateCompanyModal } from './components/modals/CreateCompanyModal';
import { generateMarketEvent } from './services/advisorService';
import { useGodModeData } from './hooks/useGodModeData';

const App: React.FC = () => {
  // Init Game Loop
  useGameLoop();

  // Use Zustand Store
  const gameState = useGameStore(s => s.gameState);
  const isRunning = useGameStore(s => s.isRunning);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const start = useGameStore(s => s.start);
  const stop = useGameStore(s => s.stop);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  const updateChatHistory = useGameStore(s => s.updateChatHistory);
  const addLog = useGameStore(s => s.addLog);
  const addEvent = useGameStore(s => s.addEvent); 
  
  // Actions
  const createCompany = useGameStore(s => s.createCompany);
  const updateCompany = useGameStore(s => s.updateCompany);
  const payDividend = useGameStore(s => s.payDividend);
  const addLine = useGameStore(s => s.addLine);
  const trade = useGameStore(s => s.trade);
  const buyFutures = useGameStore(s => s.buyFutures);
  const buyStock = useGameStore(s => s.buyStock);
  const sellStock = useGameStore(s => s.sellStock);
  const setLivingStandard = useGameStore(s => s.setLivingStandard);

  const [activeTab, setActiveTab] = useState<'commodities' | 'companies' | 'stats' | 'cityhall'>('commodities');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // --- Real Economic Calculation (Refactored to Hook) ---
  const godModeData = useGodModeData(gameState);

  // --- Event Generation Logic ---
  useEffect(() => {
      if (isRunning && gameState.day % 1 === 0) { // Every tick check
         const tryGenerateEvent = async () => {
             // 限制事件频率，防止刷屏
             if (gameState.events.length > 0 && gameState.day - gameState.events[0].turnCreated < 5) return;
             
             const evt = await generateMarketEvent(gameState.day);
             if (evt) {
                 addEvent(evt);
                 addLog(`📢 突发新闻: ${evt.headline}`);
                 // 移除之前的 stop() 调用，让游戏继续运行
             }
         };
         tryGenerateEvent();
      }
  }, [gameState.day, isRunning]);

  const industryStats: IndustryStat[] = []; // Placeholder for future use

  // --- Derived Data ---
  const selectedCompany = gameState.companies.find(c => c.id === selectedCompanyId);
  const player = gameState.population.residents.find(r => r.isPlayer);
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
      <header className="fixed top-0 inset-x-0 h-16 bg-stone-900/90 backdrop-blur border-b border-stone-800 z-40 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
           <div className="bg-gradient-to-br from-amber-500 to-yellow-600 p-1.5 rounded-lg text-white shadow-lg shadow-amber-900/20">
              <TrendingUp size={20} />
           </div>
           <div>
             <h1 className="text-lg font-bold text-stone-100">伊甸谷 <span className="text-stone-500 text-xs font-normal border border-stone-700 px-1 rounded ml-1">CHAOS MODE</span></h1>
           </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono">
           {player && (
               <div className="flex items-center gap-2 bg-stone-800 rounded p-1 hidden sm:flex">
                   <Coffee size={14} className="ml-2 text-stone-400"/>
                   <select 
                        className="bg-stone-800 text-xs text-stone-300 focus:outline-none"
                        value={player.livingStandard}
                        onChange={(e) => setLivingStandard(e.target.value as LivingStandard)}
                   >
                       <option value="SURVIVAL">生存模式</option>
                       <option value="BASIC">温饱</option>
                       <option value="COMFORT">小康</option>
                       <option value="LUXURY">奢靡</option>
                   </select>
               </div>
           )}

           <div className="hidden sm:flex items-center gap-2 text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded border border-amber-900/50 shadow-inner">
              <Wallet size={14} />
              {gameState.cash.toFixed(2)} oz
           </div>
           <div className="flex items-center gap-2 text-stone-400 bg-stone-800/50 px-3 py-1.5 rounded">
              <Calendar size={14} />
              Day {gameState.day}
           </div>
           
           {/* Time Controls */}
           <div className="flex items-center bg-stone-800 rounded-lg p-1 gap-1 border border-stone-700">
             <button 
                className={`p-1.5 rounded transition-colors ${!isRunning ? 'bg-red-900/50 text-red-200' : 'text-stone-400 hover:bg-stone-700 hover:text-stone-200'}`} 
                onClick={() => stop()}
                title="暂停"
             >
                <Pause size={14} fill={!isRunning ? "currentColor" : "none"}/>
             </button>
             
             <div className="w-px h-4 bg-stone-700 mx-1"></div>

             {[1, 2, 5].map(speed => (
                <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2 py-0.5 text-xs font-mono font-bold rounded transition-all duration-200 ${
                        isRunning && gameSpeed === speed 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 scale-105' 
                        : 'text-stone-500 hover:bg-stone-700 hover:text-stone-300'
                    }`}
                >
                    {speed}x
                </button>
             ))}
           </div>
        </div>
      </header>

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
                <Button className="w-full justify-start" variant={activeTab === 'commodities' ? 'primary' : 'secondary'} onClick={() => setActiveTab('commodities')}><Wheat size={16}/> 商品交易 (期货)</Button>
                <Button className="w-full justify-start" variant={activeTab === 'companies' ? 'primary' : 'secondary'} onClick={() => setActiveTab('companies')}><Building2 size={16}/> 股票与基金</Button>
                <Button className="w-full justify-start" variant={activeTab === 'stats' ? 'primary' : 'secondary'} onClick={() => setActiveTab('stats')}><BarChart3 size={16}/> 宏观数据</Button>
                <Button className="w-full justify-start" variant={activeTab === 'cityhall' ? 'primary' : 'secondary'} onClick={() => setActiveTab('cityhall')}><Landmark size={16}/> 市政厅与选举</Button>
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
            
             <Card className="bg-stone-900 border-stone-800" title="AI 分析概览 (God Mode)">
                <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-stone-800 pb-2">
                        <span className="text-stone-500">基尼系数 (不平等)</span>
                        <span className={`font-mono font-bold ${godModeData.affordabilityIndex > 0.4 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {godModeData.affordabilityIndex}
                        </span>
                    </div>
                    <div className="flex justify-between border-b border-stone-800 pb-2">
                        <span className="text-stone-500">最赚钱行业</span>
                        <span className="text-amber-400">{godModeData.mostProfitableIndustry}</span>
                    </div>
                    <div>
                        <span className="text-stone-500 block mb-1">供需缺口 (Demand Gap)</span>
                         {Object.entries(godModeData.supplyDemandGap).map(([k, v]) => (
                             <div key={k} className="flex justify-between pl-2">
                                 <span>{k === ResourceType.GRAIN ? '粮食' : '面包'}</span>
                                 <span className={v > 0 ? 'text-red-400' : 'text-emerald-400'}>{v > 0 ? `缺 ${v.toFixed(1)}` : '过剩'}</span>
                             </div>
                         ))}
                    </div>
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
