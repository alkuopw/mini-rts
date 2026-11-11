
export default class Economy {

  // 当前资金
  private balance: number;

  // 初始化资金
  constructor(initialBalance: number = 2000) {

    if (
      !Number.isSafeInteger(initialBalance) ||
      initialBalance < 0
    ) {
      throw new Error('Invalid initial balance');
    }

    this.balance = initialBalance;
  }

  // 获取当前资金
  getBalance(): number {
    return this.balance;
  }

  // 检查是否有足够资金
  canAfford(amount: number): boolean {

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return false;
    }

    return this.balance >= amount;
  }

  // 消耗资金
  spend(amount: number): boolean {

    if (!this.canAfford(amount)) {
      return false;
    }

    this.balance -= amount;

    return true;
  }
}
