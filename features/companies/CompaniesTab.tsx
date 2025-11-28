
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { Card, Button } from '../../shared/components';
import { useGameStore } from '../../shared/store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { getTranslation } from '../../shared/utils/i18n';

interface CompaniesTabProps {
  onSelectCompany: (id: string) => void;
}

export const CompaniesTab: React.FC<CompaniesTabProps> = ({ onSelectCompany }) => {
  const companies = useGameStore(s => s.gameState.companies);
  const cash = useGameStore(s => s.gameState.cash);
  const player = useGameStore(useShallow(s => s.gameState.population.residents.find(r => r.isPlayer)));
  const lang = useGameStore(s => s.gameState.settings.language);
  
  const buyStock = useGameStore(s => s.buyStock);
  const sellStock = useGameStore(s => s.sellStock);
  const shortStock = useGameStore(s => s.shortStock);
  const coverStock = useGameStore(s => s.coverStock);

  const t = (key: string) => getTranslation(key, lang);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h3 className="text-xl font-bold text-stone-100 mb-4 flex items-center gap-2">
            <span className="bg-blue-600 w-2 h-6 rounded-full"></span>
            {t('market.stocks')}
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {companies.map(comp => {
                const lastReport = comp.reports[0];
                const startPrice = comp.history.length > 0 ? comp.history[0].close : comp.sharePrice;
                const change = ((comp.sharePrice - startPrice) / startPrice) * 100;
                const isPositive = change >= 0;
                const color = isPositive ? '#3b82f6' : '#ef4444'; 
                
                const owned = player?.portfolio[comp.id] || 0;
                const isShort = owned < 0;

                return (
                <Card key={comp.id} className="bg-stone-900 border-stone-800 relative overflow-hidden group hover:border-stone-600 transition-colors cursor-pointer" onClick={() => onSelectCompany(comp.id)}>
                    {comp.isPlayerFounded && <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-bl">{t('comp.my_company')}</div>}
                    
                    {isShort && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-2 py-1 rounded-bl font-bold">SHORT: {owned}</div>}

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                        <h3 className="font-bold text-lg text-stone-100 flex items-center gap-2">
                            {comp.name}
                        </h3>
                        <div className="text-xs text-stone-500 mt-1 flex flex-col gap-0.5 font-mono">
                            <span>{t('comp.eps')}: {lastReport?.eps || 0} oz</span>
                            <span>{t('comp.vol')}: {comp.monthlySalesVolume}</span>
                            <span title="Tobin's Q: Valuation Ratio">Q-Ratio: {comp.tobinQ?.toFixed(2) || '1.00'}</span>
                        </div>
                        </div>
                        <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-white">{comp.sharePrice.toFixed(2)} <span className="text-sm text-stone-600">oz</span></div>
                        <div className={`text-xs font-bold flex items-center justify-end ${isPositive ? 'text-blue-400' : 'text-red-400'}`}>
                            {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </div>
                        </div>
                    </div>

                    <div className="h-28 -mx-5 -mb-2 relative z-0">
                        <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={comp.history}>
                            <defs>
                                <linearGradient id={`grad-${comp.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="close" 
                                stroke={color} 
                                strokeWidth={2} 
                                fill={`url(#grad-${comp.id})`} 
                                isAnimationActive={false}
                            />
                            <YAxis domain={['auto', 'auto']} hide />
                        </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 relative z-10" onClick={e => e.stopPropagation()}>
                        {isShort ? (
                             <>
                                <Button className="flex-1" size="sm" variant="success" onClick={() => coverStock(comp.id)}>
                                    {t('comp.cover')}
                                </Button>
                                <Button className="flex-1" size="sm" variant="danger" onClick={() => shortStock(comp.id)}>
                                    {t('comp.add_short')}
                                </Button>
                             </>
                        ) : (
                             <>
                                <Button className="flex-1" size="sm" onClick={() => buyStock(comp.id)} disabled={cash < comp.sharePrice * 100}>{t('comp.buy')}</Button>
                                {owned > 0 ? (
                                    <Button className="flex-1" size="sm" variant="secondary" onClick={() => sellStock(comp.id)}>{t('comp.sell')}</Button>
                                ) : (
                                    <Button className="flex-1" size="sm" variant="danger" onClick={() => shortStock(comp.id)}>{t('comp.short')}</Button>
                                )}
                             </>
                        )}
                    </div>
                </Card>
                );
            })}
        </div>
      </div>
    </div>
  );
};
