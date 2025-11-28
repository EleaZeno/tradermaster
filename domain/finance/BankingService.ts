
import { GameState, Bank, GameContext, Loan, Company } from '../../shared/types';
import { MonetaryStrategy, GoldStandardStrategy, FiatTaylorRuleStrategy } from './strategies/MonetaryStrategies';

export class BankingService {
    
    private static strategies: Record<string, MonetaryStrategy> = {
        'GOLD_STANDARD': new GoldStandardStrategy(),
        'FIAT_MONEY': new FiatTaylorRuleStrategy()
    };

    /**
     * Phase 1: Set Monetary Policy (Interest Rates)
     * Run at start of tick
     */
    static applyMonetaryPolicy(state: GameState): void {
        const bank = state.bank;

        // --- OVERRIDE LOGIC (Manual Intervention) ---
        if (state.policyOverrides.interestRate !== null) {
            bank.loanRate = state.policyOverrides.interestRate;
            bank.depositRate = Math.max(0, bank.loanRate - 0.002);
            bank.yieldCurve = {
                rate1d: bank.loanRate,
                rate30d: bank.loanRate * 1.1,
                rate365d: bank.loanRate * 1.3
            };
            return;
        }
        // ---------------------------------------------

        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];
        strategy.applyPolicy(state);
    }

    /**
     * Phase 2: Operations (Loans, Interest, Deposits)
     * Run after production/sales/consumption cycles
     */
    static processFinancials(state: GameState, context: GameContext): void {
        const bank = state.bank;

        // 1. Accrue Interest
        BankingService.processInterest(state, bank, context);

        // 2. Manage Deposits (Households)
        BankingService.processDeposits(state, bank, context);

        // 3. Manage Loans (Companies) - With Risk Controls
        BankingService.processLoans(state, bank, context);

        // 4. Update Stats
        bank.moneySupply = bank.totalDeposits + bank.totalLoans; 
        bank.creditMultiplier = bank.moneySupply / Math.max(1, bank.reserves);

        // 5. History
        const lastCpi = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].cpi : 0;
        const prevCpi = state.macroHistory.length > 1 ? state.macroHistory[state.macroHistory.length - 2].cpi : lastCpi;
        const inflation = prevCpi > 0 ? (lastCpi - prevCpi) / prevCpi : 0;

        bank.history.push({ 
            day: state.day, 
            reserves: bank.reserves, 
            rates: bank.loanRate,
            inflation: inflation,
            m2: bank.moneySupply
        });
        if (bank.history.length > 30) bank.history.shift();
    }

    private static processInterest(state: GameState, bank: Bank, context: GameContext) {
        bank.loans.forEach(loan => {
            const interest = loan.remainingPrincipal * loan.interestRate;
            loan.remainingPrincipal += interest;
        });

        bank.deposits.forEach(deposit => {
            const interest = deposit.amount * deposit.interestRate;
            deposit.amount += interest;
        });
    }

    private static processDeposits(state: GameState, bank: Bank, context: GameContext) {
        const residents = state.population.residents;
        
        residents.forEach(res => {
            // Hot money flows based on Interest Rate
            const saveThreshold = 200 / (1 + bank.depositRate * 10); 
            
            const excess = res.cash - saveThreshold; 
            if (excess > 50) {
                let dep = bank.deposits.find(d => d.ownerId === res.id);
                if (!dep) {
                    dep = { id: `dep_${Date.now()}_${Math.random()}`, ownerId: res.id, amount: 0, interestRate: bank.depositRate };
                    bank.deposits.push(dep);
                } else {
                    dep.interestRate = bank.depositRate;
                }
                
                res.cash -= excess;
                dep.amount += excess;
                bank.reserves += excess;
                bank.totalDeposits += excess;
            }

            if (res.cash < 50) {
                let dep = bank.deposits.find(d => d.ownerId === res.id);
                if (dep && dep.amount > 0) {
                    const need = 100 - res.cash;
                    const withdraw = Math.min(need, dep.amount);
                    if (bank.reserves >= withdraw) {
                        dep.amount -= withdraw;
                        res.cash += withdraw;
                        bank.reserves -= withdraw;
                        bank.totalDeposits -= withdraw;
                    }
                }
            }
        });
    }

    private static calculateDefaultProbability(comp: Company): number {
        // Simple Merton Model proxy
        // PD increases if Assets < Liabilities or Cashflow is negative
        const assets = comp.cash + (comp.landTokens || 0) * 100 + Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)*2),0);
        const debt = 500; // Placeholder debt assumption
        
        let pd = 0.01;
        if (comp.lastProfit < 0) pd += 0.05;
        if (comp.cash < 100) pd += 0.10;
        if (assets < debt) pd += 0.20;
        
        return Math.min(0.99, pd);
    }

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;
        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];

        // Basel III Style Capital Adequacy Check
        // Capital (Equity) / Risk Weighted Assets >= 8%
        const bankEquity = bank.reserves + bank.totalLoans - bank.totalDeposits;
        const totalRWA = bank.loans.reduce((sum, loan) => sum + (loan.remainingPrincipal * 1.0), 0); // Corporate risk weight 100%
        
        const currentCAR = totalRWA > 0 ? bankEquity / totalRWA : 1.0;
        const minimumCAR = 0.08;

        companies.forEach(comp => {
            if (comp.isBankrupt) return;

            // Repay Logic
            const loans = bank.loans.filter(l => l.borrowerId === comp.id);
            loans.forEach(loan => {
                if (comp.cash > 200) {
                    const repayment = Math.min(comp.cash - 150, loan.remainingPrincipal); 
                    if (repayment > 0) {
                        comp.cash -= repayment;
                        loan.remainingPrincipal -= repayment;
                        // Repayment destroys M2 but restores Bank Equity/Reserves capacity
                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款`);
                        }
                    }
                }
            });

            // Borrow Logic
            const stockValue = Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0); 
            
            // Credit Risk Check
            const pd = BankingService.calculateDefaultProbability(comp);
            const riskPremium = pd * 0.1; // Add spread for risk

            if (comp.cash < 100 && stockValue > 50) {
                // Regulatory Limit Check
                if (currentCAR < minimumCAR && bank.system !== 'GOLD_STANDARD') {
                    // Credit Crunch: Bank cannot lend due to capital constraints
                    return;
                }

                const creditLimit = stockValue * 0.8;
                const existingDebt = loans.reduce((a,b) => a + b.remainingPrincipal, 0);
                const available = creditLimit - existingDebt;
                
                if (available > 50) {
                    // Strategy Check: Reserve/Liquidity Constraints
                    if (strategy.canLend(bank, 100)) {
                        const marketRate = bank.yieldCurve.rate30d + riskPremium;
                        const desperation = comp.cash < 20; 
                        
                        if (marketRate < 0.15 || desperation) {
                            const borrowAmount = 100;
                            const newLoan: Loan = {
                                id: `ln_${Date.now()}_${comp.id}`,
                                borrowerId: comp.id,
                                principal: borrowAmount,
                                remainingPrincipal: borrowAmount,
                                interestRate: marketRate, 
                                dueDate: state.day + 30
                            };
                            bank.loans.push(newLoan);
                            
                            // Strategy Effect: Adjust Reserves (Gold) vs Balance Sheet Expansion (Fiat)
                            strategy.onLoanIssued(bank, borrowAmount);
                            
                            comp.cash += borrowAmount;
                            state.logs.unshift(`🏦 ${comp.name} 获得贷款 ${borrowAmount} oz (Rate: ${(newLoan.interestRate*100).toFixed(2)}%)`);
                        }
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
