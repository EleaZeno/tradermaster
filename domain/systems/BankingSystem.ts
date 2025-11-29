
import { GameState, Bank, GameContext, Loan } from '../../shared/types';
import { safeDivide } from '../../shared/utils/math';
import { ECO_CONSTANTS } from '../../shared/config';

export class BankingSystem {
    static process(state: GameState, context: GameContext): void {
        const bank = state.bank;
        
        BankingSystem.applyMonetaryPolicy(state, bank);
        BankingSystem.processInterest(state, bank, context);
        BankingSystem.processDeposits(state, bank, context);
        BankingSystem.processLoans(state, bank, context);

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

    private static applyMonetaryPolicy(state: GameState, bank: Bank) {
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

        const history = state.macroHistory;
        let currentInflation = 0;
        if (history.length > 7) {
            const now = history[history.length - 1].cpi;
            const weekAgo = history[history.length - 8].cpi;
            currentInflation = safeDivide(now - weekAgo, weekAgo);
        }

        const unemployed = state.population.residents.filter(r => r.job === 'UNEMPLOYED' || (r.job === 'FARMER' && !r.employerId)).length;
        const totalLaborForce = state.population.total;
        const currentUnemployment = safeDivide(unemployed, totalLaborForce);

        const pi = currentInflation;
        const piStar = bank.targetInflation / 52;
        const rStar = 0.001; 
        const u = currentUnemployment;
        const uStar = bank.targetUnemployment;

        const alphaPi = 0.5;
        const alphaY = 0.5;

        const targetRate = pi + rStar + alphaPi * (pi - piStar) + alphaY * (uStar - u);

        const smoothing = 0.1;
        const nextRate = bank.loanRate * (1 - smoothing) + targetRate * smoothing;

        bank.loanRate = Math.max(0.0001, Math.min(0.15, nextRate)); 
        bank.depositRate = Math.max(0, bank.loanRate - 0.002);
        
        const sentiment = state.population.consumerSentiment;
        const inversionFactor = sentiment < 30 ? -0.002 : 0; 
        
        bank.yieldCurve = {
            rate1d: bank.loanRate,
            rate30d: bank.loanRate * 1.1 + 0.0005 + inversionFactor * 0.5,
            rate365d: Math.max(0.001, bank.loanRate * 1.3 + 0.002 + inversionFactor)
        };
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
            const saveThreshold = 200 * (1 - bank.depositRate * 100); 
            
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
                bank.reserves += excess; // Resident deposits physical cash, increasing reserves
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

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;
        const reserveRequirement = bank.reserveRatio || 0.1;

        companies.forEach(comp => {
            if (comp.isBankrupt) return;

            // 1. Repay existing loans
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

            // 2. Take new loans
            const maxLendingCapacity = (bank.reserves / reserveRequirement) - bank.totalLoans;
            
            const stockValue = Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0); 
            if (comp.cash < 100 && stockValue > 50 && maxLendingCapacity > 100) {
                const creditLimit = stockValue * 0.8;
                const existingDebt = loans.reduce((a,b) => a + b.remainingPrincipal, 0);
                const available = creditLimit - existingDebt;
                
                if (available > 50) {
                    const marketRate = bank.yieldCurve.rate30d;
                    const desperation = comp.cash < 20; 
                    
                    if (marketRate < 0.05 || desperation) {
                        const borrowAmount = 100;
                        if (maxLendingCapacity >= borrowAmount) {
                            const newLoan: Loan = {
                                id: `ln_${Date.now()}_${comp.id}`,
                                borrowerId: comp.id,
                                principal: borrowAmount,
                                remainingPrincipal: borrowAmount,
                                interestRate: marketRate * (1 + (Math.random() * 0.05)), 
                                dueDate: state.day + 30
                            };
                            bank.loans.push(newLoan);
                            // Money Creation
                            comp.cash += borrowAmount; 
                            
                            state.logs.unshift(`🏦 ${comp.name} 获得信贷 ${borrowAmount} oz`);
                        }
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
