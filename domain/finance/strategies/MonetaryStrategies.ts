
import { GameState, Bank } from '../../../shared/types';

export interface MonetaryStrategy {
    /** Sets interest rates based on economic conditions */
    applyPolicy(state: GameState): void;
    /** Checks if the bank has enough liquidity/capital to lend */
    canLend(bank: Bank, borrowAmount: number): boolean;
    /** Handles the accounting side effect of issuing a loan */
    onLoanIssued(bank: Bank, amount: number): void;
    /** Handles the accounting side effect of repaying a loan */
    onLoanRepaid(bank: Bank, amount: number): void;
}

export class GoldStandardStrategy implements MonetaryStrategy {
    applyPolicy(state: GameState): void {
        const bank = state.bank;
        const deposits = Math.max(1, bank.totalDeposits);
        const currentReserveRatio = bank.reserves / deposits;
        const targetRatio = 0.40; // Hard money constraint (40% Gold Backing)
        
        // Mechanism: Price Specie Flow / Reserve Protection
        const error = targetRatio - currentReserveRatio;
        // Aggressive rate hikes if reserves fall below target to attract gold/deposits
        const adjustment = error * 0.1; 
        
        let nextRate = bank.loanRate + adjustment;
        nextRate = Math.max(0.01, Math.min(0.50, nextRate));
        
        bank.loanRate = nextRate;
        bank.depositRate = Math.max(0, nextRate - 0.01);
        
        // Gold Standard typically implies flat yield curve expectations
        bank.yieldCurve = {
            rate1d: bank.loanRate,
            rate30d: bank.loanRate,
            rate365d: bank.loanRate
        };
    }

    canLend(bank: Bank, borrowAmount: number): boolean {
        // Strict reserve requirement: Must maintain 40% backing
        const safeReserves = bank.totalDeposits * 0.4; 
        return (bank.reserves - borrowAmount) > safeReserves;
    }

    onLoanIssued(bank: Bank, amount: number): void {
        // In a physical gold system, lending often implies physical transfer or claims that encumber reserves
        bank.reserves -= amount; 
    }

    onLoanRepaid(bank: Bank, amount: number): void {
        // Repayment returns gold/specie to the vault
        bank.reserves += amount;
    }
}

export class FiatTaylorRuleStrategy implements MonetaryStrategy {
    applyPolicy(state: GameState): void {
        const bank = state.bank;
        const history = state.macroHistory;
        
        let currentInflation = 0;
        if (history.length > 7) {
            const now = history[history.length - 1].cpi;
            const weekAgo = history[history.length - 8].cpi;
            currentInflation = (now - weekAgo) / weekAgo;
        }

        // Taylor Rule: i_t = r* + pi_t + 0.5(pi_t - pi*) + 0.5(y_t)
        const r_star = 0.02; // Neutral Real Rate
        const pi_star = bank.targetInflation / 52; // Weekly inflation target
        
        const u_n = 0.05; // NAIRU (Natural Rate of Unemployment)
        const u_t = state.macroHistory.length > 0 ? state.macroHistory[state.macroHistory.length-1].unemployment : 0.05;
        // Okun's Law approximation for Output Gap (y_t)
        const outputGap = -2.0 * (u_t - u_n);

        const taylorRate = currentInflation + r_star + 0.5*(currentInflation - pi_star) + 0.5*outputGap;

        // Interest Rate Smoothing (Central banks avoid jumping rates)
        const smoothing = 0.15;
        const nextRate = bank.loanRate * (1 - smoothing) + taylorRate * smoothing;

        bank.loanRate = Math.max(0.001, Math.min(0.20, nextRate)); 
        bank.depositRate = Math.max(0, bank.loanRate - 0.005);
        
        // Yield Curve Logic
        const sentiment = state.population.consumerSentiment;
        const inversionFactor = sentiment < 30 ? -0.002 : 0; 
        
        bank.yieldCurve = {
            rate1d: bank.loanRate,
            rate30d: bank.loanRate * 1.1 + 0.0005 + inversionFactor * 0.5,
            rate365d: Math.max(0.001, bank.loanRate * 1.3 + 0.002 + inversionFactor)
        };
    }

    canLend(bank: Bank, borrowAmount: number): boolean {
        // Fractional Reserve Banking: Only need small fraction of deposits
        // Main constraint is Capital Adequacy (handled in Service) and basic liquidity
        const reserveReq = bank.totalDeposits * (bank.reserveRatio || 0.1);
        return bank.reserves > reserveReq;
    }

    onLoanIssued(bank: Bank, amount: number): void {
        // Fiat Money Creation: Loans create Deposits.
        // Balance Sheet Expands. Reserves are NOT consumed, they just back the new deposit.
    }

    onLoanRepaid(bank: Bank, amount: number): void {
        // Money Destruction: Repayment destroys the deposit/asset.
        // However, we capture a small portion (interest/profit) into reserves to prevent total system deflation from interest
        // For simplicity in this simulation, we simulate profit retention:
        bank.reserves += amount * 0.05; 
    }
}
