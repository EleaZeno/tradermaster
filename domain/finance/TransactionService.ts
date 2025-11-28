

import { Resident, CityTreasury, TransactionParty, CashEntity, GameContext } from '../../shared/types';

export interface TransferContext {
  treasury: CityTreasury;
  residents: Resident[];
  context?: GameContext;
}

export class TransactionService {
  static transfer(
    from: TransactionParty,
    to: TransactionParty,
    amount: number,
    context: TransferContext
  ): boolean {
    if (amount <= 0.001) return false;

    let payerCash = 0;
    
    if (from === 'TREASURY') {
      payerCash = context.treasury.cash;
    } else if (from === 'MARKET') {
      payerCash = Number.MAX_SAFE_INTEGER; 
    } else if (from !== 'GATHERERS' && typeof from === 'object' && 'cash' in from) {
      payerCash = (from as CashEntity).cash;
    } else {
       if (from === 'GATHERERS') return false; 
       return false;
    }

    if (payerCash < amount) return false;

    if (from === 'TREASURY') {
      context.treasury.cash -= amount;
    } else if (typeof from === 'object' && 'cash' in from) {
      (from as CashEntity).cash -= amount;
    }

    if (to === 'TREASURY') {
      context.treasury.cash += amount;
    } else if (to === 'GATHERERS') {
      const taxRate = context.treasury.taxPolicy.incomeTaxRate;
      const tax = amount * taxRate;
      const netIncome = amount - tax;

      context.treasury.cash += tax;
      context.treasury.dailyIncome += tax;

      const farmers = context.context?.residentsByJob['FARMER'] || context.residents.filter(resident => resident.job === 'FARMER');
      
      if (farmers.length > 0) {
        const share = netIncome / farmers.length;
        farmers.forEach(farmer => {
          farmer.cash += share;
        });
      }
    } else if (to !== 'MARKET' && typeof to === 'object' && 'cash' in to) {
      (to as CashEntity).cash += amount;
    }

    return true;
  }
}