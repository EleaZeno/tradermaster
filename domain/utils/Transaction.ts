import { Resident, Company, CityTreasury } from '../../shared/types';

export interface TransferContext {
  treasury: CityTreasury;
  residents: Resident[];
}

export class Transaction {
  /**
   * Executes a safe money transfer between entities.
   * Handles validation of funds and updates balances.
   * 
   * @param from - The entity sending money ('TREASURY', 'MARKET', or Object with cash)
   * @param to - The entity receiving money ('TREASURY', 'MARKET', 'GATHERERS', or Object with cash)
   * @param amount - The amount to transfer
   * @param context - Context containing treasury and residents list for special transfers
   * @returns boolean - True if transfer succeeded, False if insufficient funds or invalid amount
   */
  static transfer(
    from: Resident | Company | CityTreasury | 'TREASURY' | 'MARKET',
    to: Resident | Company | CityTreasury | 'TREASURY' | 'MARKET' | 'GATHERERS',
    amount: number,
    context: TransferContext
  ): boolean {
    if (amount <= 0.001) return false;

    let payerCash = 0;
    
    // Determine payer's available cash
    if (from === 'TREASURY') {
      payerCash = context.treasury.cash;
    } else if (from === 'MARKET') {
      payerCash = Number.MAX_SAFE_INTEGER; 
    } else {
      payerCash = from.cash;
    }

    // Validation: Insufficient funds
    if (payerCash < amount) return false;

    // Execute Deduction
    if (from === 'TREASURY') {
      context.treasury.cash -= amount;
    } else if (from !== 'MARKET') {
      from.cash -= amount;
    }

    // Execute Addition
    if (to === 'TREASURY') {
      context.treasury.cash += amount;
    } else if (to === 'GATHERERS') {
      // Special Logic: Gatherers pay income tax automatically on receiving funds
      const taxRate = context.treasury.taxPolicy.incomeTaxRate;
      const tax = amount * taxRate;
      const netIncome = amount - tax;

      context.treasury.cash += tax;
      context.treasury.dailyIncome += tax;

      const farmers = context.residents.filter(resident => resident.job === 'FARMER');
      if (farmers.length > 0) {
        const share = netIncome / farmers.length;
        farmers.forEach(farmer => {
          farmer.cash += share;
        });
      }
    } else if (to !== 'MARKET') {
      // @ts-ignore - 'to' is Resident | Company | CityTreasury which have 'cash'
      to.cash += amount;
    }

    return true;
  }
}