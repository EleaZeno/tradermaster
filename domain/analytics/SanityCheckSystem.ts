
import { GameState, ResourceType, ProductType, OrderBook, IndustryType } from '../../shared/types';

export class SanityCheckSystem {
    static check(state: GameState): void {
        const issues: string[] = [];

        // 1. Conservation of Money Audit (Forensic Level)
        const totalResidentCash = state.population.residents.reduce((s, r) => s + r.cash, 0);
        const totalCorporateCash = state.companies.reduce((s, c) => s + c.cash, 0);
        const totalFundCash = state.funds.reduce((s, f) => s + f.cash, 0);
        const totalCityCash = state.cityTreasury.cash;
        const totalBankReserves = state.bank.reserves;

        // Calculate Locked Cash in Market Orders (Escrow)
        let totalLockedInMarket = 0;
        Object.values(state.market).forEach((book: OrderBook) => {
            book.bids.forEach(order => {
                if (order.lockedValue) totalLockedInMarket += order.lockedValue;
            });
        });

        const actualSum = totalResidentCash + totalCorporateCash + totalFundCash + totalCityCash + totalBankReserves + totalLockedInMarket;
        const recordedM0 = state.economicOverview.totalSystemGold;

        // Allow small floating point error
        const diff = actualSum - recordedM0;
        if (Math.abs(diff) > 1.0) {
            const auditLog = `[CRITICAL] Money Leak (M0 Breach): Actual(${actualSum.toFixed(1)}) != Recorded(${recordedM0.toFixed(1)}) | Diff: ${diff.toFixed(2)}`;
            issues.push(auditLog);
            // Auto-correct to prevent crash
            state.economicOverview.totalSystemGold = actualSum;
        }

        // 2. Check for NaN/Infinity in Macro
        const macro = state.macroHistory[state.macroHistory.length - 1];
        if (macro) {
            if (!Number.isFinite(macro.gdp)) issues.push(`[CRITICAL] GDP Corruption: NaN/Infinity detected`);
            if (!Number.isFinite(macro.cpi)) issues.push(`[CRITICAL] CPI Corruption: NaN/Infinity detected`);
        }

        // 3. Market Microstructure Integrity
        Object.entries(state.market).forEach(([itemId, book]) => {
            const castBook = book as OrderBook;
            const bestBid = castBook.bids[0]?.price || 0;
            const bestAsk = castBook.asks[0]?.price || Infinity;

            // Crossed Book Check (Bid >= Ask means matching engine failed to execute)
            if (bestBid >= bestAsk) {
                issues.push(`[CRITICAL] Crossed Order Book for ${itemId}: Bid(${bestBid}) >= Ask(${bestAsk}). Matching engine stalled.`);
            }

            // Price Sanity
            if (castBook.lastPrice <= 0) issues.push(`[WARNING] Invalid Price for ${itemId}: ${castBook.lastPrice}`);
            if (castBook.lastPrice > 5000) issues.push(`[WARNING] Hyperinflation Alert: ${itemId} price > 5000`);
        });

        // 4. Entity Integrity (Negative Assets)
        state.companies.forEach(c => {
            if (Number.isNaN(c.cash)) {
                issues.push(`[CRITICAL] Company ${c.name} Cash is NaN`);
                c.cash = 0;
            }
            // Negative Inventory Check
            Object.entries(c.inventory.finished).forEach(([k, v]) => {
                if ((v as number) < 0) issues.push(`[WARNING] Negative Inventory: ${c.name} has ${v} ${k}`);
            });
        });

        state.population.residents.forEach(r => {
            if (Number.isNaN(r.cash)) {
                issues.push(`[CRITICAL] Resident ${r.name} Cash is NaN`);
                r.cash = 0;
            }
            if (r.happiness < 0 || r.happiness > 100) {
                // Silent correction for UI
                r.happiness = Math.max(0, Math.min(100, r.happiness));
            }
        });

        // 5. Economic Stagnation Check
        // If GDP is 0 but Money Supply > 0, we have a velocity of 0 (Deadlock)
        if (macro && macro.gdp < 1.0 && actualSum > 1000) {
            // Only warn every 10 ticks to avoid spam
            if (state.totalTicks % 10 === 0) {
                issues.push(`[WARNING] Liquidity Trap Detected: GDP near zero despite ${Math.floor(actualSum)} oz in system.`);
            }
        }

        if (issues.length > 0) {
            // Unshift distinct issues only to avoid log spam
            issues.forEach(issue => {
                if (!state.logs.includes(issue)) {
                    state.logs.unshift(issue);
                }
            });
        }
    }
}
