
import React, { useState, useMemo } from 'react';
import { GameState, Company } from '../../shared/types';
import { Card } from '../../shared/components';
import { Crown, Search, Landmark, ArrowUp, ArrowDown, Briefcase, TrendingUp, Activity, PieChart } from 'lucide-react';

interface CityHallTabProps {
  gameState: GameState;
  companies: Company[];
}

type SortKey = 'id' | 'wealth' | 'cash' | 'intelligence' | 'production';
type SortOrder = 'asc' | 'desc';

export const CityHallTab: React.FC<CityHallTabProps> = ({ gameState, companies }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>('wealth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { mayorId, population, cityTreasury, economicOverview } = gameState;
  
  const mayor = population.residents.find(r => r.id === mayorId);
  const playerIsMayor = mayorId === 'res_player';
  
  const getDailyProduction = (r: any) => {
      const iqMultiplier = r.intelligence / 75;
      if (r.job === 'FARMER') return 1.5 * iqMultiplier;
      if (r.job === 'WORKER') return 2.0 * iqMultiplier;
      return 0;
  }

  const filteredResidents = useMemo(() => {
    let list = population.residents.map(r => ({
        ...r,
        calculatedProduction: getDailyProduction(r)
    })).filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.job.toLowerCase().includes(searchTerm.toLowerCase())
    );

    list.sort((a, b) => {
        let valA: any = a[sortKey];
        let valB: any = b[sortKey];
        
        if (sortKey === 'id') {
            const numA = parseInt(a.id.split('_')[1] || '0') || 0;
            const numB = parseInt(b.id.split('_')[1] || '0') || 0;
            valA = numA; valB = numB;
        } else if (sortKey === 'production') {
            valA = a.calculatedProduction;
            valB = b.calculatedProduction;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    return list.slice(0, 50);
  }, [population.residents, searchTerm, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
      if (sortKey === key) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKey(key);
          setSortOrder('desc'); 
      }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
      if (sortKey !== colKey) return <span className="w-4 inline-block"></span>;
      return sortOrder === 'asc' ? <ArrowUp size={12} className="inline ml-1"/> : <ArrowDown size={12} className="inline ml-1"/>;
  };

  const getJobLabel = (job: string) => {
      switch(job) {
          case 'FARMER': return '农民';
          case 'WORKER': return '工人';
          case 'MAYOR': return '市长';
          case 'DEPUTY_MAYOR': return '副市长';
          case 'EXECUTIVE': return 'CEO';
          case 'UNION_LEADER': return '工会主席';
          case 'FINANCIER': return '金融家';
          case 'UNEMPLOYED': return '无业';
          default: return job;
      }
  };

  const getEmployerName = (employerId?: string) => {
      if (!employerId) return "-";
      const comp = companies.find(c => c.id === employerId);
      return comp ? comp.name : employerId;
  };
  
  const getFiscalColor = (status: string) => {
      if (status === 'STIMULUS') return 'text-emerald-400';
      if (status === 'AUSTERITY') return 'text-red-400';
      return 'text-blue-400';
  };
  
  const hoardingRatio = (cityTreasury.cash / (economicOverview.totalSystemGold || 1)) * 100;
  const netIncome = cityTreasury.dailyIncome - cityTreasury.dailyExpense;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="市政厅核心" className="bg-stone-900 border-stone-800">
             <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-amber-900/30 rounded-full border border-amber-700 relative">
                    <Crown size={32} className="text-amber-500" />
                    {playerIsMayor && <div className="absolute -top-2 -right-2 bg-blue-600 text-xs px-2 py-0.5 rounded-full text-white">YOU</div>}
                </div>
                <div>
                    <div className="text-sm text-stone-500">现任市长</div>
                    <div className="text-2xl font-bold text-white">
                        {mayor ? mayor.name : "职位空缺"}
                    </div>
                </div>
                <div className="ml-auto text-right">
                    <div className="text-xs text-stone-500 mb-1">自动财政状态</div>
                    <div className={`font-mono font-bold ${getFiscalColor(cityTreasury.fiscalStatus)}`}>
                        {cityTreasury.fiscalStatus}
                    </div>
                    <div className="text-[10px] text-stone-500">{cityTreasury.fiscalCorrection}</div>
                </div>
             </div>
             
             <div className="bg-stone-950 p-4 rounded border border-stone-800">
                 <div className="flex items-center gap-2 text-stone-300 font-bold mb-3 border-b border-stone-800 pb-2">
                     <PieChart size={16}/> 昨日收支明细 (Income Statement)
                 </div>
                 <div className="grid grid-cols-2 gap-4 text-xs">
                     <div>
                         <div className="text-stone-500 mb-1">总收入 (Revenue)</div>
                         <div className="text-emerald-400 font-mono text-base">+{cityTreasury.dailyIncome.toFixed(1)}</div>
                     </div>
                     <div className="text-right">
                         <div className="text-stone-500 mb-1">总支出 (Expense)</div>
                         <div className="text-red-400 font-mono text-base">-{cityTreasury.dailyExpense.toFixed(1)}</div>
                     </div>
                 </div>
                 <div className="mt-3 flex justify-between items-center text-xs bg-stone-900 p-2 rounded">
                     <span className="text-stone-400">净赤字/盈余:</span>
                     <span className={`font-mono font-bold ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                         {netIncome >= 0 ? '+' : ''}{netIncome.toFixed(1)} oz
                     </span>
                 </div>
             </div>
          </Card>

          <Card title="国库与流动性监控" className="bg-stone-900 border-stone-800">
              <div className="mb-4 flex justify-between items-end">
                  <div>
                    <div className="text-xs text-stone-500 mb-1">国库储备 (Reserves)</div>
                    <div className="text-3xl font-mono text-emerald-400 font-bold">{Math.floor(cityTreasury.cash).toLocaleString()} oz</div>
                  </div>
                  <div className="text-right">
                     <div className="text-xs text-stone-500 mb-1 flex items-center justify-end gap-1"><Activity size={10}/> 市场吸纳率</div>
                     <div className={`text-lg font-mono font-bold ${hoardingRatio > 25 ? 'text-red-500' : 'text-stone-300'}`}>
                         {hoardingRatio.toFixed(1)}%
                     </div>
                  </div>
              </div>
              
              <div className="w-full h-2 bg-stone-800 rounded-full mb-4 overflow-hidden">
                  <div 
                    className={`h-full ${hoardingRatio > 25 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                    style={{width: `${Math.min(100, hoardingRatio)}%`}}
                  ></div>
              </div>

              <div className="bg-stone-950 p-3 rounded border border-stone-800 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-stone-300 mb-2 border-b border-stone-800 pb-2">
                      <Landmark size={14} className="text-amber-500"/> 实时调节税率
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                          <div className="text-[10px] text-stone-500">个税</div>
                          <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.incomeTaxRate * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                          <div className="text-[10px] text-stone-500">企税</div>
                          <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.corporateTaxRate * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                          <div className="text-[10px] text-stone-500">消费税</div>
                          <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.consumptionTaxRate * 100).toFixed(1)}%</div>
                      </div>
                  </div>
              </div>
          </Card>
      </div>

      <Card className="bg-stone-900 border-stone-800" title={`居民数据库 (人口: ${population.total})`}>
          <div className="mb-4 flex gap-2">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-stone-500" size={16} />
                <input 
                  type="text" 
                  placeholder="搜索居民..." 
                  className="w-full bg-stone-950 border border-stone-700 rounded py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-amber-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-950">
             {/* List Header */}
             <div className="grid grid-cols-12 text-xs uppercase bg-stone-900 text-stone-500 font-bold border-b border-stone-800 select-none">
                <div className="col-span-4 px-4 py-3 cursor-pointer hover:bg-stone-800 flex items-center gap-1" onClick={() => handleSort('id')}>
                    姓名 (ID) <SortIcon colKey="id"/>
                </div>
                <div className="col-span-4 px-4 py-3">
                    职业 & 雇主
                </div>
                <div className="col-span-2 px-4 py-3 text-right cursor-pointer hover:bg-stone-800 flex items-center justify-end gap-1" onClick={() => handleSort('production')}>
                    日产出 <SortIcon colKey="production"/>
                </div>
                <div className="col-span-2 px-4 py-3 text-right cursor-pointer hover:bg-stone-800 flex items-center justify-end gap-1" onClick={() => handleSort('cash')}>
                    现金 <SortIcon colKey="cash"/>
                </div>
             </div>
             
             {/* List Body */}
             <div className="h-[500px] overflow-y-auto custom-scrollbar">
               {filteredResidents.map(res => (
                   <div key={res.id} className={`grid grid-cols-12 items-center hover:bg-stone-800 border-b border-stone-800 ${res.isPlayer ? 'bg-blue-950/20' : ''}`}>
                         <div className="col-span-4 px-4 py-2 font-medium text-white flex items-center gap-2 overflow-hidden">
                            <span className="truncate">{res.name}</span>
                            {res.isPlayer && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded shrink-0">YOU</span>}
                            {res.id === mayorId && <Crown size={12} className="text-amber-500 shrink-0"/>}
                         </div>
                         <div className="col-span-4 px-4 py-2 flex flex-col justify-center">
                             <span className={`w-fit px-2 py-0.5 rounded text-xs mb-1 flex items-center gap-1 ${
                                res.job === 'UNEMPLOYED' ? 'bg-red-900/50 text-red-400' :
                                res.job === 'FARMER' ? 'bg-stone-700 text-stone-300' :
                                res.job === 'WORKER' ? 'bg-emerald-900/50 text-emerald-400' :
                                res.job === 'FINANCIER' ? 'bg-purple-900/50 text-purple-300' :
                                'bg-blue-900/50 text-blue-200'
                            }`}>
                                {res.job === 'FINANCIER' && <TrendingUp size={10}/>}
                                {getJobLabel(res.job)}
                            </span>
                            {res.employerId && (
                                <span className="text-[10px] text-stone-500 flex items-center gap-1 truncate">
                                    <Briefcase size={10}/> {getEmployerName(res.employerId)}
                                </span>
                            )}
                         </div>
                         <div className="col-span-2 px-4 py-2 text-right flex items-center justify-end">
                             {res.calculatedProduction > 0 ? (
                                <span className="text-emerald-500 font-mono text-xs">
                                   +{res.calculatedProduction.toFixed(2)}
                                </span>
                             ) : (
                                <span className="text-stone-600 text-xs">-</span>
                             )}
                         </div>
                         <div className="col-span-2 px-4 py-2 text-right font-mono text-emerald-500 flex items-center justify-end">
                            {Math.floor(res.cash).toLocaleString()} oz
                         </div>
                    </div>
               ))}
             </div>
          </div>
      </Card>
    </div>
  );
};
