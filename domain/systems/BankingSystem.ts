
import { GameState, Bank, GameContext, Loan, Deposit } from '../../shared/types';
import { Transaction } from '../utils/Transaction';

export class BankingSystem {
    static process(state: GameState, context: GameContext): void {
        const bank = state.bank;
        
        // 0. Monetary Policy (Taylor Rule)
        BankingSystem.applyMonetaryPolicy(state, bank);

        // 1. Accrue Interest
        BankingSystem.processInterest(state, bank, context);

        // 2. Manage Deposits (Households)
        BankingSystem.processDeposits(state, bank, context);

        // 3. Manage Loans (Companies)
        BankingSystem.processLoans(state, bank, context);

        // 4. Record History
        const lastCpi = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length - 1].cpi : 0;
        const prevCpi = state.macroHistory.length > 1 ? state.macroHistory[state.macroHistory.length - 2].cpi : lastCpi;
        const inflation = prevCpi > 0 ? (lastCpi - prevCpi) / prevCpi : 0;

        bank.history.push({ 
            day: state.day, 
            reserves: bank.reserves, 
            rates: bank.loanRate,
            inflation: inflation
        });
        if (bank.history.length > 30) bank.history.shift();
    }

    private static applyMonetaryPolicy(state: GameState, bank: Bank) {
        // Calculate Inflation
        const history = state.macroHistory;
        let currentInflation = 0;
        if (history.length > 7) {
            const now = history[history.length - 1].cpi;
            const weekAgo = history[history.length - 8].cpi;
            currentInflation = (now - weekAgo) / weekAgo; // Weekly inflation roughly
        }

        // Calculate Unemployment
        const unemployed = state.population.residents.filter(r => r.job === 'UNEMPLOYED' || (r.job === 'FARMER' && !r.employerId)).length;
        const totalLaborForce = state.population.total; // Simplification
        const currentUnemployment = unemployed / totalLaborForce;

        // Taylor Rule: i = pi + r* + 0.5(pi - pi*) + 0.5(y - y*)
        // Where y gap is approximated by (u* - u) via Okun's Law
        
        const pi = currentInflation;
        const piStar = bank.targetInflation / 52; // Weekly target approx (annual / 52)
        const rStar = 0.001; // Daily equilibrium real rate (approx 3% annual)
        const u = currentUnemployment;
        const uStar = bank.targetUnemployment;

        // Coefficients
        const alphaPi = 0.5;
        const alphaY = 0.5;

        // Note: Unemployment gap (u* - u) is positive when economy is overheating (u < u*), justifying higher rates
        const targetRate = pi + rStar + alphaPi * (pi - piStar) + alphaY * (uStar - u);

        // Smoothing
        const smoothing = 0.1;
        const nextRate = bank.loanRate * (1 - smoothing) + targetRate * smoothing;

        bank.loanRate = Math.max(0.0001, Math.min(0.05, nextRate)); // Clamp between 0.01% and 5% daily
        bank.depositRate = Math.max(0, bank.loanRate - 0.001); // Spread
    }

    private static processInterest(state: GameState, bank: Bank, context: GameContext) {
        // Loan Interest (Income for Bank)
        bank.loans.forEach(loan => {
            const interest = loan.remainingPrincipal * loan.interestRate;
            loan.remainingPrincipal += interest;
        });

        // Deposit Interest (Expense for Bank)
        bank.deposits.forEach(deposit => {
            const interest = deposit.amount * deposit.interestRate;
            deposit.amount += interest;
        });
    }

    private static processDeposits(state: GameState, bank: Bank, context: GameContext) {
        const residents = state.population.residents;
        
        residents.forEach(res => {
            // If resident has excess cash, deposit it
            const excess = res.cash - 200; // Keep 200 buffer
            if (excess > 50) {
                // Check if already has account
                let dep = bank.deposits.find(d => d.ownerId === res.id);
                if (!dep) {
                    dep = { id: `dep_${Date.now()}_${Math.random()}`, ownerId: res.id, amount: 0, interestRate: bank.depositRate };
                    bank.deposits.push(dep);
                }
                
                res.cash -= excess;
                dep.amount += excess;
                bank.reserves += excess;
                bank.totalDeposits += excess;
            }

            // If resident needs cash, withdraw
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

        companies.forEach(comp => {
            if (comp.isBankrupt) return;

            // 1. Repay existing loans
            const loans = bank.loans.filter(l => l.borrowerId === comp.id);
            loans.forEach(loan => {
                if (comp.cash > 200) {
                    const repayment = Math.min(comp.cash - 150, loan.remainingPrincipal); // Keep buffer
                    if (repayment > 0) {
                        comp.cash -= repayment;
                        loan.remainingPrincipal -= repayment;
                        bank.reserves += repayment;
                        
                        // If paid off
                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款`);
                        }
                    }
                }
            });

            // 2. Take new loans (Leverage)
            // If cash low but profitable or high assets
            const stockValue = Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0); // Est. Value
            if (comp.cash < 100 && stockValue > 50) {
                const creditLimit = stockValue * 0.8;
                const existingDebt = loans.reduce((a,b) => a + b.remainingPrincipal, 0);
                const available = creditLimit - existingDebt;
                
                if (available > 50 && bank.reserves > 200) {
                    const borrowAmount = 100;
                    if (bank.reserves >= borrowAmount) {
                        const newLoan: Loan = {
                            id: `ln_${Date.now()}_${comp.id}`,
                            borrowerId: comp.id,
                            principal: borrowAmount,
                            remainingPrincipal: borrowAmount,
                            interestRate: bank.loanRate * (1 + (Math.random() * 0.05)), // Risk premium
                            dueDate: state.day + 30
                        };
                        bank.loans.push(newLoan);
                        bank.reserves -= borrowAmount;
                        comp.cash += borrowAmount;
                        state.logs.unshift(`🏦 ${comp.name} 获得银行贷款 ${borrowAmount} oz`);
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
