


import { GameState, Bank, GameContext, Loan, Company } from '../../shared/types';
import { MonetaryStrategy, GoldStandardStrategy, FiatTaylorRuleStrategy } from './strategies/MonetaryStrategies';
import { safeDivide } from '../../shared/utils/math';
import { ECO_CONSTANTS } from '../../shared/config';

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

        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];
        strategy.applyPolicy(state);
    }

    /**
     * Phase 2: Operations (Loans, Interest, Deposits)
     * Run after production/sales/consumption cycles
     */
    static processFinancials(state: GameState, context: GameContext): void {
        const bank = state.bank;

        BankingService.processInterest(state, bank, context);
        BankingService.processDeposits(state, bank, context);
        BankingService.processLoans(state, bank, context);

        bank.moneySupply = bank.totalDeposits + bank.totalLoans; 
        bank.creditMultiplier = safeDivide(bank.moneySupply, Math.max(1, bank.reserves));

        const lastCpi = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].cpi : 0;
        const prevCpi = state.macroHistory.length > 1 ? state.macroHistory[state.macroHistory.length - 2].cpi : lastCpi;
        const inflation = safeDivide(lastCpi - prevCpi, prevCpi);

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
        const assets = comp.cash + (comp.landTokens || 0) * 100 + Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)*2),0);
        const debt = 500; 
        
        let pd = 0.01;
        if (comp.lastProfit < 0) pd += 0.05;
        if (comp.cash < 100) pd += 0.10;
        if (assets < debt) pd += 0.20;
        
        return Math.min(0.99, pd);
    }

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;
        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];

        // --- Basel III Simplified: Capital Adequacy Check ---
        // Equity = Assets (Reserves + Loans) - Liabilities (Deposits)
        const bankAssets = bank.reserves + bank.totalLoans;
        const bankLiabilities = bank.totalDeposits;
        const bankEquity = bankAssets - bankLiabilities;
        
        // Risk Weighted Assets (RWA). Cash = 0%, Loans = 100%
        const totalRWA = bank.loans.reduce((sum, loan) => sum + (loan.remainingPrincipal * ECO_CONSTANTS.BANKING.RISK_WEIGHT_RWA), 0); 
        
        const currentCAR = safeDivide(bankEquity, totalRWA, 1.0); // Capital Adequacy Ratio
        const isCreditCrunch = currentCAR < ECO_CONSTANTS.BANKING.CREDIT_CRUNCH_TRIGGER && bank.system !== 'GOLD_STANDARD';

        if (isCreditCrunch && state.day % 7 === 0) {
            state.logs.unshift(`📉 信贷紧缩 (Credit Crunch): 银行资本不足 (CAR: ${(currentCAR*100).toFixed(1)}%)，停止放贷。`);
        }

        companies.forEach(comp => {
            // Check for Bankruptcy/Default
            if (comp.cash < -50) { // Insolvency buffer
                if (!comp.isBankrupt) {
                    comp.isBankrupt = true;
                    state.logs.unshift(`☠️ ${comp.name} 宣告破产 (资不抵债)`);
                    
                    // Default Event: Bank writes off loan
                    const badLoans = bank.loans.filter(l => l.borrowerId === comp.id);
                    badLoans.forEach(l => {
                        // Destroy Money Supply (Write-off)
                        bank.totalLoans -= l.remainingPrincipal;
                        // Bank Equity hit implies Reserves or Asset value drop.
                        // In fiat, it eats into Equity directly.
                    });
                    bank.loans = bank.loans.filter(l => l.borrowerId !== comp.id);
                }
                return;
            }

            if (comp.isBankrupt) return;

            const loans = bank.loans.filter(l => l.borrowerId === comp.id);
            loans.forEach(loan => {
                if (comp.cash > 200) {
                    const repayment = Math.min(comp.cash - 150, loan.remainingPrincipal); 
                    if (repayment > 0) {
                        comp.cash -= repayment;
                        loan.remainingPrincipal -= repayment;
                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款`);
                        }
                    }
                }
            });

            // Borrow Logic
            const stockValue = Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0); 
            const pd = BankingService.calculateDefaultProbability(comp);
            const riskPremium = pd * 0.2; // Higher spread

            if (comp.cash < 100 && stockValue > 50) {
                // CREDIT CRUNCH CHECK: Deny new loans if bank is risky
                if (isCreditCrunch) return;

                const creditLimit = stockValue * 0.8;
                const existingDebt = loans.reduce((a,b) => a + b.remainingPrincipal, 0);
                const available = creditLimit - existingDebt;
                
                if (available > 50) {
                    if (strategy.canLend(bank, 100)) {
                        const marketRate = bank.yieldCurve.rate30d + riskPremium;
                        const desperation = comp.cash < 20; 
                        
                        // Strict Loan Demand: Only borrow if ROI > Rate
                        const expectedROI = comp.kpis.roa || 0;
                        
                        if (expectedROI > marketRate || desperation) {
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
