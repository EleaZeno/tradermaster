
import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { Crown, Search, Landmark, ArrowUp, ArrowDown, Briefcase, TrendingUp, Activity, PieChart, Coins, Scale, Brain } from 'lucide-react';
import { getTranslation } from '../../shared/utils/i18n';
import { MonetarySystemType, MayorPersonality } from '../../shared/types';

type SortKey = 'id' | 'wealth' | 'cash' | 'intelligence' | 'production';
type SortOrder = 'asc' | 'desc';

export const CityHallTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>('wealth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const mayorId = useGameStore(s => s.gameState.mayorId);
  const population = useGameStore(s => s.gameState.population);
  const cityTreasury = useGameStore(s => s.gameState.cityTreasury);
  const economicOverview = useGameStore(s => s.gameState.economicOverview);
  const companies = useGameStore(s => s.gameState.companies);
  const bank = useGameStore(s => s.gameState.bank);
  const personality = useGameStore(s => s.gameState.mayorPersonality);
  const lang = useGameStore(s => s.gameState.settings.language);
  
  const setMonetarySystem = useGameStore(s => s.setMonetarySystem);
  const t = (key: string) => getTranslation(key, lang);
  
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

    return list.slice(0, 200); 
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
      return t(`job.${job}`) || job;
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

  const toggleSystem = () => {
      const newSystem: MonetarySystemType = bank.system === 'GOLD_STANDARD' ? 'FIAT_MONEY' : 'GOLD_STANDARD';
      setMonetarySystem(newSystem);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title={t('nav.cityhall')} className="bg-stone-900 border-stone-800">
             <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-amber-900/30 rounded-full border border-amber-700 relative">
                    <Crown size={32} className="text-amber-500" />
                    {playerIsMayor && <div className="absolute -top-2 -right-2 bg-blue-600 text-xs px-2 py-0.5 rounded-full text-white">YOU</div>}
                </div>
                <div className="flex-1">
                    <div className="text-sm text-stone-500">{t('city.mayor')}</div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {mayor ? mayor.name : "VACANT"}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-400 flex items-center gap-1">
                            <Brain size={10}/> {personality}
                        </span>
                    </div>
                </div>
                <div className="ml-auto text-right">
                    <div className="text-xs text-stone-500 mb-1">{t('city.fiscal_status')}</div>
                    <div className={`font-mono font-bold ${getFiscalColor(cityTreasury.fiscalStatus)}`}>
                        {cityTreasury.fiscalStatus}
                    </div>
                    <div className="text-[10px] text-stone-500">{cityTreasury.fiscalCorrection}</div>
                </div>
             </div>
             
             <div className="bg-stone-950 p-4 rounded border border-stone-800">
                 <div className="flex items-center gap-2 text-stone-300 font-bold mb-3 border-b border-stone-800 pb-2">
                     <PieChart size={16}/> {t('city.income_stmt')}
                 </div>
                 <div className="grid grid-cols-2 gap-4 text-xs">
                     <div>
                         <div className="text-stone-500 mb-1">{t('city.revenue')}</div>
                         <div className="text-emerald-400 font-mono text-base">+{cityTreasury.dailyIncome.toFixed(1)}</div>
                     </div>
                     <div className="text-right">
                         <div className="text-stone-500 mb-1">{t('city.expense')}</div>
                         <div className="text-red-400 font-mono text-base">-{cityTreasury.dailyExpense.toFixed(1)}</div>
                     </div>
                 </div>
                 <div className="mt-3 flex justify-between items-center text-xs bg-stone-900 p-2 rounded">
                     <span className="text-stone-400">{t('city.net')}:</span>
                     <span className={`font-mono font-bold ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                         {netIncome >= 0 ? '+' : ''}{netIncome.toFixed(1)} oz
                     </span>
                 </div>
             </div>
          </Card>

          <div className="space-y-6">
            <Card title={t('bank.system')} className="bg-gradient-to-br from-indigo-950 to-stone-900 border-indigo-800/50">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="text-xs text-stone-400 mb-1 uppercase tracking-wider">{t('bank.regime')}</div>
                        <div className={`text-xl font-bold flex items-center gap-2 ${bank.system === 'GOLD_STANDARD' ? 'text-amber-400' : 'text-blue-400'}`}>
                            {bank.system === 'GOLD_STANDARD' ? <Coins size={20}/> : <Scale size={20}/>}
                            {bank.system === 'GOLD_STANDARD' ? t('bank.gold') : t('bank.fiat')}
                        </div>
                    </div>
                    <Button onClick={toggleSystem} size="sm" variant="secondary" className="border border-indigo-500/30 hover:bg-indigo-900/50">
                        {t('bank.switch')}
                    </Button>
                </div>
            </Card>

            <Card title={t('city.treasury')} className="bg-stone-900 border-stone-800">
                <div className="mb-4 flex justify-between items-end">
                    <div>
                        <div className="text-xs text-stone-500 mb-1">{t('city.treasury')}</div>
                        <div className="text-3xl font-mono text-emerald-400 font-bold">{Math.floor(cityTreasury.cash).toLocaleString()} oz</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-stone-500 mb-1 flex items-center justify-end gap-1"><Activity size={10}/> {t('city.absorption')}</div>
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
                        <Landmark size={14} className="text-amber-500"/> {t('city.tax_rates')}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-[10px] text-stone-500">{t('city.tax_income')}</div>
                            <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.incomeTaxRate * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-stone-500">{t('city.tax_corp')}</div>
                            <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.corporateTaxRate * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-stone-500">{t('city.tax_consumption')}</div>
                            <div className="text-lg font-mono text-white">{(cityTreasury.taxPolicy.consumptionTaxRate * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            </Card>
          </div>
      </div>

      <Card className="bg-stone-900 border-stone-800" title={t('city.population') + ` (${population.total})`}>
          <div className="mb-4 flex gap-2">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-stone-500" size={16} />
                <input 
                  type="text" 
                  placeholder={t('city.search')}
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
                    {t('city.col_name')} <SortIcon colKey="id"/>
                </div>
                <div className="col-span-4 px-4 py-3">
                    {t('city.col_job')}
                </div>
                <div className="col-span-2 px-4 py-3 text-right cursor-pointer hover:bg-stone-800 flex items-center justify-end gap-1" onClick={() => handleSort('production')}>
                    {t('city.col_prod')} <SortIcon colKey="production"/>
                </div>
                <div className="col-span-2 px-4 py-3 text-right cursor-pointer hover:bg-stone-800 flex items-center justify-end gap-1" onClick={() => handleSort('cash')}>
                    {t('city.col_cash')} <SortIcon colKey="cash"/>
                </div>
             </div>
             
             {/* List Body */}
             <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredResidents.map(res => (
                   <div key={res.id} className={`grid grid-cols-12 items-center hover:bg-stone-800 border-b border-stone-800 ${res.isPlayer ? 'bg-blue-950/20' : ''} h-[60px]`}>
                         <div className="col-span-4 px-4 py-2 font-medium text-white flex items-center gap-2 overflow-hidden">
                            <span className="truncate text-xs">{res.name}</span>
                            {res.isPlayer && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded shrink-0">YOU</span>}
                            {res.id === mayorId && <Crown size={12} className="text-amber-500 shrink-0"/>}
                         </div>
                         <div className="col-span-4 px-4 py-2 flex flex-col justify-center">
                             <span className={`w-fit px-2 py-0.5 rounded text-[10px] mb-1 flex items-center gap-1 ${
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
                         <div className="col-span-2 px-4 py-2 text-right font-mono text-emerald-500 text-xs flex items-center justify-end">
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
