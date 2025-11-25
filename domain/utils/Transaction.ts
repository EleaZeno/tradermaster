
import { Resident, Company, CityTreasury } from '../../types';

export class Transaction {
  /**
   * 安全转账：从 Source 转移到 Target
   * @returns boolean 成功或失败
   */
  static transfer(
    from: Resident | Company | CityTreasury | 'TREASURY' | 'MARKET',
    to: Resident | Company | CityTreasury | 'TREASURY' | 'MARKET' | 'GATHERERS',
    amount: number,
    context: { treasury: CityTreasury, residents: Resident[] }
  ): boolean {
    if (amount <= 0.001) return false;

    // 1. 检查付款方余额
    let payerCash = 0;
    if (from === 'TREASURY') payerCash = context.treasury.cash;
    else if (from === 'MARKET') payerCash = Number.MAX_SAFE_INTEGER; // 市场（上帝）有无限资金
    else payerCash = from.cash;

    if (payerCash < amount) return false;

    // 2. 扣款
    if (from === 'TREASURY') {
      context.treasury.cash -= amount;
      // 注意：expense 统计通常在调用处处理，因为这里不知道这笔钱是干嘛的（工资？福利？）
    }
    else if (from !== 'MARKET') from.cash -= amount;

    // 3. 收款
    if (to === 'TREASURY') {
      context.treasury.cash += amount;
      // income 统计通常也在调用处处理，但如果这是纯税务转账，可以加
    } else if (to === 'GATHERERS') {
      // === 核心修复：农民卖粮税收拦截 ===
      // 农民是最大的群体，如果他们卖粮不交税，国库就收不到钱
      const taxRate = context.treasury.taxPolicy.incomeTaxRate;
      const tax = amount * taxRate;
      const netIncome = amount - tax;

      // 3.1 税款进国库
      context.treasury.cash += tax;
      context.treasury.dailyIncome += tax;

      // 3.2 净收入分给农民
      const farmers = context.residents.filter(r => r.job === 'FARMER');
      if (farmers.length > 0) {
        const share = netIncome / farmers.length;
        farmers.forEach(f => f.cash += share);
      }
    } else if (to !== 'MARKET') {
      // @ts-ignore
      to.cash += amount;
    }

    return true;
  }
}
