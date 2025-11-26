
import React from 'react';
import { Bank } from '../../shared/types';
import { Card } from '../../shared/components';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Building2, TrendingUp, PiggyBank, DollarSign } from 'lucide-react';

interface BankingTabProps {
  bank: Bank;
}

export const BankingTab: React.FC<BankingTabProps> = ({ bank }) => {
  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-stone-900 border-stone-800" title="央行储备">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-900/30 rounded-full border border-emerald-700">
                        <Building2 size={24} className="text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-sm text-stone-500">Reserves</div>
                        <div className="text-2xl font-bold font-mono text-emerald-400">{Math.floor(bank.reserves).toLocaleString()} oz</div>
                    </div>
                </div>
            </Card>

            <Card className="bg-stone-900 border-stone-800" title="信贷市场利率">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900/30 rounded-full border border-blue-700">
                        <TrendingUp size={24} className="text-blue-500" />
                    </div>
                    <div>
                         <div className="flex justify-between w-48 mb-1">
                             <span className="text-xs text-stone-500">Deposit Rate</span>
                             <span className="font-mono text-emerald-400">{(bank.depositRate * 100).toFixed(2)}%</span>
                         </div>
                         <div className="flex justify-between w-48">
                             <span className="text-xs text-stone-500">Loan Rate</span>
                             <span className="font-mono text-red-400">{(bank.loanRate * 100).toFixed(2)}%</span>
                         </div>
                    </div>
                </div>
            </Card>

            <Card className="bg-stone-900 border-stone-800" title="系统杠杆">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-900/30 rounded-full border border-amber-700">
                        <DollarSign size={24} className="text-amber-500" />
                    </div>
                    <div>
                        <div className="text-sm text-stone-500">Outstanding Loans</div>
                        <div className="text-2xl font-bold font-mono text-amber-400">{Math.floor(bank.totalLoans).toLocaleString()} oz</div>
                    </div>
                </div>
            </Card>
        </div>

        <Card title="信贷周期趋势" className="bg-stone-900 border-stone-800 h-80">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bank.history}>
                    <defs>
                        <linearGradient id="colorReserves" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="#444" tick={{fontSize: 10}} />
                    <YAxis stroke="#444" tick={{fontSize: 10}} />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#1c1917', border: '1px solid #444', fontSize: '12px'}}
                        labelStyle={{color: '#9ca3af'}}
                    />
                    <Area type="monotone" dataKey="reserves" stroke="#10b981" fillOpacity={1} fill="url(#colorReserves)" />
                </AreaChart>
            </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="活跃贷款簿" className="bg-stone-900 border-stone-800">
                <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left text-stone-400">
                        <thead className="text-stone-500 uppercase bg-stone-950 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Loan ID</th>
                                <th className="px-4 py-2">Borrower</th>
                                <th className="px-4 py-2 text-right">Remaining</th>
                                <th className="px-4 py-2 text-right">Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bank.loans.map(loan => (
                                <tr key={loan.id} className="border-b border-stone-800 hover:bg-stone-800">
                                    <td className="px-4 py-2 font-mono">{loan.id.split('_')[1]}</td>
                                    <td className="px-4 py-2">{loan.borrowerId}</td>
                                    <td className="px-4 py-2 text-right text-red-400 font-mono">{Math.floor(loan.remainingPrincipal)} oz</td>
                                    <td className="px-4 py-2 text-right">Day {loan.dueDate}</td>
                                </tr>
                            ))}
                            {bank.loans.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-4 text-center text-stone-600">No active loans</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="存款簿" className="bg-stone-900 border-stone-800">
                 <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left text-stone-400">
                        <thead className="text-stone-500 uppercase bg-stone-950 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Account</th>
                                <th className="px-4 py-2 text-right">Balance</th>
                                <th className="px-4 py-2 text-right">APY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bank.deposits.map(dep => (
                                <tr key={dep.id} className="border-b border-stone-800 hover:bg-stone-800">
                                    <td className="px-4 py-2">{dep.ownerId}</td>
                                    <td className="px-4 py-2 text-right text-emerald-400 font-mono">{Math.floor(dep.amount)} oz</td>
                                    <td className="px-4 py-2 text-right">{(dep.interestRate * 365 * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                             {bank.deposits.length === 0 && (
                                <tr><td colSpan={3} className="px-4 py-4 text-center text-stone-600">No active deposits</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    </div>
  );
};
