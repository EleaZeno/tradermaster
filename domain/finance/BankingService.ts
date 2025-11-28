
import { GameState, Bank, GameContext, Loan } from '../../shared/types';

export class BankingService {
    static process(state: GameState, context: GameContext): void {
        const bank = state.bank;
        
        // 0. Monetary Policy (Taylor Rule vs Gold Standard)
        BankingService.applyMonetaryPolicy(state, bank);

        // 1. Accrue Interest
        BankingService.processInterest(state, bank, context);

        // 2. Manage Deposits (Households)
        BankingService.processDeposits(state, bank, context);

        // 3. Manage Loans (Companies)
        BankingService.processLoans(state, bank, context);

        // 4. Record History
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

    private static applyMonetaryPolicy(state: GameState, bank: Bank) {
        // --- OVERRIDE LOGIC ---
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
        // ----------------------

        if (bank.system === 'GOLD_STANDARD') {
            // GOLD STANDARD LOGIC:
            // 1. Rate determined by Reserve Ratio. Target Ratio e.g., 20%.
            // 2. If Reserves < Target, Rates rise to attract capital (or simulate scarcity).
            // 3. If Reserves > Target, Rates fall.
            
            const deposits = Math.max(1, bank.totalDeposits);
            const currentReserveRatio = bank.reserves / deposits;
            const targetRatio = 0.40; // Hard money requires high coverage
            
            const error = targetRatio - currentReserveRatio;
            
            // Aggressive rate adjustment to protect reserves
            // If error > 0 (Reserves too low), rate goes up.
            // If error < 0 (Reserves surplus), rate goes down.
            const adjustment = error * 0.05; 
            
            let nextRate = bank.loanRate + adjustment;
            nextRate = Math.max(0.01, Math.min(0.25, nextRate)); // Cap at 25% panic rate
            
            bank.loanRate = nextRate;
            bank.depositRate = Math.max(0, nextRate - 0.01);
            
            // Flat Yield Curve usually in Gold Standard (stable expectations)
            bank.yieldCurve = {
                rate1d: bank.loanRate,
                rate30d: bank.loanRate,
                rate365d: bank.loanRate
            };

        } else {
            // FIAT MONEY LOGIC (Taylor Rule):
            
            // Calculate Inflation
            const history = state.macroHistory;
            let currentInflation = 0;
            if (history.length > 7) {
                const now = history[history.length - 1].cpi;
                const weekAgo = history[history.length - 8].cpi;
                currentInflation = (now - weekAgo) / weekAgo;
            }

            // Calculate Unemployment
            const unemployed = state.population.residents.filter(r => r.job === 'UNEMPLOYED' || (r.job === 'FARMER' && !r.employerId)).length;
            const totalLaborForce = state.population.total;
            const currentUnemployment = unemployed / totalLaborForce;

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

    private static processLoans(state: GameState, bank: Bank, context: GameContext) {
        const companies = state.companies;

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
                        
                        // Under Gold Standard, repayment restores Reserves capacity directly? 
                        // Simplified: Repayment always reduces M2.
                        
                        if (loan.remainingPrincipal <= 0.1) {
                            bank.loans = bank.loans.filter(l => l.id !== loan.id);
                            state.logs.unshift(`🏦 ${comp.name} 还清了贷款`);
                        }
                    }
                }
            });

            // 2. Take new loans
            const stockValue = Object.values(comp.inventory.finished).reduce((a,b)=>a+(Number(b)||0)*2, 0); 
            if (comp.cash < 100 && stockValue > 50) {
                const creditLimit = stockValue * 0.8;
                const existingDebt = loans.reduce((a,b) => a + b.remainingPrincipal, 0);
                const available = creditLimit - existingDebt;
                
                const ratePainThreshold = 0.05; 
                const desperation = comp.cash < 20; 
                
                // Credit Constraint Logic
                let canLend = false;
                let lendingCap = 0;

                if (bank.system === 'GOLD_STANDARD') {
                    // Strictly limited by Reserves. Multiplier is low.
                    // Safe coverage ratio must be maintained.
                    const safeReserves = bank.totalDeposits * 0.4; // 40% backing
                    lendingCap = Math.max(0, bank.reserves - safeReserves);
                    canLend = lendingCap > 100;
                } else {
                    // Fiat: Limited by fractional reserve (e.g., 10%)
                    const reqReserves = bank.totalDeposits * 0.1;
                    // In modern banking, loans create deposits. The limit is reserve requirement on NEW deposits.
                    // Simplified: Allow lending if we have excess reserves.
                    lendingCap = (bank.reserves - reqReserves) * 5; // Multiplier allowed
                    canLend = lendingCap > 100 && bank.reserves > 200;
                }
                
                if (available > 50 && canLend) {
                    const marketRate = bank.yieldCurve.rate30d;
                    
                    if (marketRate < ratePainThreshold || desperation) {
                        const borrowAmount = 100;
                        const newLoan: Loan = {
                            id: `ln_${Date.now()}_${comp.id}`,
                            borrowerId: comp.id,
                            principal: borrowAmount,
                            remainingPrincipal: borrowAmount,
                            interestRate: marketRate * (1 + (Math.random() * 0.05)), 
                            dueDate: state.day + 30
                        };
                        bank.loans.push(newLoan);
                        
                        if (bank.system === 'GOLD_STANDARD') {
                            // Gold Standard: Lending consumes reserves (specie outflow risk)
                            // or acts as claim on reserves.
                            // We simplify: Reserves are tied up.
                            bank.reserves -= (borrowAmount * 0.2); // Partial drain
                        } else {
                            // Fiat: Loans create deposits (money). Reserves don't change immediately, but ratio drops.
                            // We don't touch reserves here to simulate "Loans create Deposits"
                        }
                        
                        comp.cash += borrowAmount;
                        state.logs.unshift(`🏦 ${comp.name} 获得贷款 ${borrowAmount} oz (Rate: ${(newLoan.interestRate*100).toFixed(2)}%)`);
                    }
                }
            }
        });

        bank.totalLoans = bank.loans.reduce((a,b) => a + b.remainingPrincipal, 0);
    }
}
