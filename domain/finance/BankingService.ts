
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

        bank.moneySupply = bank.totalDeposits + bank.totalLoans + bank.reserves; 
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

    /**
     * LEGITIMATE MONEY PRINTING (Debt Monetization / QE)
     * The ONLY place where new money should enter the system M0.
     */
    static monetizeDebt(state: GameState, amount: number): boolean {
        if (state.bank.system === 'GOLD_STANDARD') {
            state.logs.unshift(`🚫 央行拒绝印钞: 金本位制度限制`);
            return false;
        }

        // Expand Balance Sheet
        state.bank.reserves += amount; 
        // In a real model, Bank gains Assets (Gov Bonds) and Liabilities (Reserves)
        // Here we simplify: Treasury gets the cash immediately
        state.cityTreasury.cash += amount;
        
        // Update M0 tracking immediately to pass audit
        state.economicOverview.totalSystemGold += amount;

        state.logs.unshift(`🖨️ 央行启动印钞机: +${Math.floor(amount)} oz (注入国库)`);
        return true;
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

    // STRICT CREDIT CHECK
    public static assessCredit(comp: Company, bank: Bank): { approved: boolean, reason: string, score: number, limit: number } {
        // 1. Solvency: Debt to Equity
        const loans = bank.loans.filter(l => l.borrowerId === comp.id);
        const totalDebt = loans.reduce((s, l) => s + l.remainingPrincipal, 0);
        const equity = (comp.sharePrice * comp.totalShares) || 1;
        const leverage = totalDebt / equity;

        // 2. Liquidity: Cash vs Short Term Obligations
        // Simple proxy: Cash vs Interest
        const interestLoad = totalDebt * bank.loanRate;
        const interestCoverage = comp.lastProfit > 0 ? comp.lastProfit / Math.max(0.1, interestLoad) : 0;

        // 3. Collateral (Assets)
        const assetsValue = comp.cash + (comp.landTokens || 0) * 100 + Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0);
        
        let score = 100;
        let reasons = [];

        if (comp.lastProfit < 0) {
            score -= 30;
            reasons.push("Negative Profit");
        }
        if (leverage > 2.0) {
            score -= 40;
            reasons.push("High Leverage (>2.0)");
        }
        if (comp.cash < 50) {
            score -= 20;
            reasons.push("Low Cash Reserves");
        }
        if (totalDebt > assetsValue * 0.8) {
            score -= 50;
            reasons.push("Insufficient Collateral");
        }

        // Credit Limit based on Collateral
        const creditLimit = Math.max(0, assetsValue * 0.6 - totalDebt);

        const approved = score > 50 && creditLimit > 10;
        
        return {
            approved,
            reason: reasons.join(", ") || "Good Standing",
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
        const isCreditCrunch = currentCAR < ECO_CONSTANTS.BANKING.CREDIT_CRUNCH_TRIGGER && bank.system !== 'GOLD_STANDARD';

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
                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款`);
                        }
                    }
                }
            });

            // Borrowing Logic - STRICT
            if (comp.cash < 100) {
                if (isCreditCrunch) return;

                const { approved, reason, score, limit } = BankingService.assessCredit(comp, bank);
                
                // Update company KPI for UI
                comp.kpis.creditScore = score;

                if (approved) {
                    if (strategy.canLend(bank, 100)) {
                        const marketRate = bank.yieldCurve.rate30d + (score < 80 ? 0.02 : 0);
                        const borrowAmount = Math.min(100, limit);
                        
                        // Strict check: Is ROI > Interest?
                        // Or is it emergency survival?
                        const expectedROI = comp.kpis.roa || 0;
                        const desperation = comp.cash < 20;

                        if (desperation || expectedROI > marketRate) {
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
                            state.logs.unshift(`🏦 ${comp.name} 获得贷款 ${Math.floor(borrowAmount)} oz (Score: ${score})`);
                        }
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
