
import { EconomicStabilizer } from '../domain/systems/EconomicStabilizer';

// ... existing imports ...

// ... inside processGameTick ...

    // 4. Banking (Credit Creation)
    if (currentTick % rates.MACRO === 0) {
         BankingService.process(gameState, context);
    }

    // --- NEW: Economic Stabilizer (Feedback Control) ---
    // Runs slightly less often than Banking, e.g., every "week" (7 days approx or 35 ticks)
    // To ensure responsiveness, we can run it with MACRO ticks for now.
    if (currentTick % rates.MACRO === 0 && context) {
        EconomicStabilizer.process(gameState, context);
    }

    // --- Demographics & Sentiment ---
    updateDemographics(gameState);
// ... rest of file ...
