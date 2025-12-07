
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
            bank.depositRate = Math.max(0.001, bank.loanRate - 0.02); // Ensure non-zero deposit
            bank.yieldCurve = {
                rate1d: bank.loanRate,
                rate30d: bank.loanRate * 1.1,
                rate365d: bank.loanRate * 1.3
            };
            return;
        }

        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];
        strategy.applyPolicy(state);
        
        // Ensure minimum deposit rate to encourage savings
        bank.depositRate = Math.max(0.001, bank.loanRate * 0.5);
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

        // M2 Calculation
        // Important: Clamp negative cash to 0. Negative cash represents debt (Accounts Payable),
        // not a reduction in the circulating medium.
        const totalResidentCash = state.population.residents.reduce((s, r) => s + Math.max(0, r.cash), 0);
        const totalCorporateCash = state.companies.reduce((s, c) => s + Math.max(0, c.cash), 0);
        const totalTreasuryCash = Math.max(0, state.cityTreasury.cash);
        
        bank.moneySupply = bank.totalDeposits + totalResidentCash + totalCorporateCash + totalTreasuryCash; 
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

    static monetizeDebt(state: GameState, amount: number): boolean {
        if (state.bank.system === 'GOLD_STANDARD') {
            state.logs.unshift(`🚫 央行拒绝印钞: 金本位制度限制 (Gold Standard Blocked Minting)`);
            return false;
        }

        // Expand Balance Sheet
        state.bank.reserves += amount; 
        state.cityTreasury.cash += amount;
        state.economicOverview.totalSystemGold += amount;

        state.logs.unshift(`🖨️ 央行启动印钞机: +${Math.floor(amount)} oz (注入国库)`);
        return true;
    }

    private static processInterest(state: GameState, bank: Bank, context: GameContext) {
        // Fix: Divide annual rate by 365 for daily simulation
        const dailyFactor = 1 / 365;

        bank.loans.forEach(loan => {
            const interest = loan.remainingPrincipal * (loan.interestRate * dailyFactor);
            loan.remainingPrincipal += interest;
        });

        bank.deposits.forEach(deposit => {
            const interest = deposit.amount * (deposit.interestRate * dailyFactor);
            deposit.amount += interest;
        });
    }

    private static processDeposits(state: GameState, bank: Bank, context: GameContext) {
        const residents = state.population.residents;
        
        residents.forEach(res => {
            // Lower threshold to encourage deposits
            const saveThreshold = 100; 
            
            const excess = res.cash - saveThreshold; 
            if (excess > 20) {
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

    public static assessCredit(comp: Company, bank: Bank): { approved: boolean, reason: string, score: number, limit: number } {
        const loans = bank.loans.filter(l => l.borrowerId === comp.id);
        const totalDebt = loans.reduce((s, l) => s + l.remainingPrincipal, 0);
        const equity = (comp.sharePrice * comp.totalShares) || 1;
        const leverage = totalDebt / equity;
        const assetsValue = comp.cash + (comp.landTokens || 0) * 100 + Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0);
        
        let score = 100;
        let reasons = [];

        // Relaxed Scoring: Allow borrowing if cash is negative but assets are positive
        if (comp.lastProfit < 0) {
            score -= 5;
        }
        
        // Penalize zombie-like state but don't outright ban if they have assets
        if (comp.cash < 0) {
            score -= 10;
        }

        if (leverage > 4.0) { // Relaxed from 3.0
            score -= 40;
            reasons.push("杠杆过高 (>4.0)");
        }
        if (totalDebt > assetsValue * 1.1) { // Allow slight over-leverage if asset value dropped
            score -= 50;
            reasons.push("抵押品不足");
        }

        const creditLimit = Math.max(0, assetsValue * 0.8 - totalDebt);
        const approved = score > 35 && creditLimit > 10; // Lowered score threshold
        
        return {
            approved,
            reason: reasons.join(", ") || "信用良好",
            score,
            limit: creditLimit
        };
    }

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;
        const strategy = this.strategies[bank.system] || this.strategies['FIAT_MONEY'];

        const bankAssets = bank.reserves + bank.totalLoans;
        const bankLiabilities = bank.totalDeposits;
        const bankEquity = bankAssets - bankLiabilities;
        const totalRWA = bank.loans.reduce((sum, loan) => sum + (loan.remainingPrincipal * ECO_CONSTANTS.BANKING.RISK_WEIGHT_RWA), 0); 
        const currentCAR = safeDivide(bankEquity, totalRWA, 1.0);
        // Lower crunch trigger to 4%
        const isCreditCrunch = currentCAR < 0.04 && bank.system !== 'GOLD_STANDARD';

        if (isCreditCrunch && state.day % 7 === 0) {
            state.logs.unshift(`📉 信贷紧缩 (Credit Crunch): 银行资本不足 (CAR: ${(currentCAR*100).toFixed(1)}%)，停止放贷。`);
        }

        companies.forEach(comp => {
            if (comp.isBankrupt) return;

            // Repayment Logic
            const loans = bank.loans.filter(l => l.borrowerId === comp.id);
            loans.forEach(loan => {
                if (comp.cash > 200) {
                    const repayment = Math.min(comp.cash - 150, loan.remainingPrincipal); 
                    if (repayment > 0) {
                        comp.cash -= repayment;
                        loan.remainingPrincipal -= repayment;
                        
                        strategy.onLoanRepaid(bank, repayment);
                        if (state.bank.system === 'FIAT_MONEY') {
                             state.economicOverview.totalSystemGold -= (repayment * 0.95); 
                        }

                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款 (Loan Repaid)`);
                        }
                    }
                }
            });

            // Borrowing Logic
            // Allow borrowing if cash < 500 (was 200), companies need runway
            if (comp.cash < 500) {
                if (isCreditCrunch) return;

                const { approved, reason, score, limit } = BankingService.assessCredit(comp, bank);
                
                comp.kpis.creditScore = score;

                if (approved) {
                    if (strategy.canLend(bank, 100)) {
                        const marketRate = bank.yieldCurve.rate30d + (score < 80 ? 0.02 : 0);
                        const borrowAmount = Math.min(300, limit); // Increased cap to 300
                        
                        // Always borrow if broke
                        const desperation = comp.cash < 50;

                        if (desperation || comp.kpis.roa > marketRate) {
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
                            
                            if (state.bank.system === 'FIAT_MONEY') {
                                state.economicOverview.totalSystemGold += borrowAmount;
                            }

                            state.logs.unshift(`🏦 ${comp.name} 获得贷款 ${Math.floor(borrowAmount)} oz (信用分: ${score})`);
                        }
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
