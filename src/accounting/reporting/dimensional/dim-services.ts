/**
 * Dimension Services — in-memory implementations of the dimensional layer.
 * These are swappable with real DB implementations (Postgres, ClickHouse, etc.)
 * via the Repository<T> interface from core/interfaces.ts.
 * 
 * All dimensions support SCD Type 2 (effective dating) for point-in-time queries.
 */


import {
  DimAccount, DimEntity, DimTime, DimCurrency,
  DimProduct, DimCustomer, DimVendor, DimCostCenter,
  DimProject, DimJournal,
  AccountDimensionType, JournalType,
} from './core-types.js';
import { AccountNormalBalance } from '../../core/chart-of-accounts-config.js';

// ─────────────────────────────────────────────────────────────────────────────
// DimTime — fiscal calendar service (ISO + fiscal year support)
// ─────────────────────────────────────────────────────────────────────────────

export class DimTimeService {
  private timeMap = new Map<string, DimTime>();

  /** Generate fiscal calendar for a given year. Call once per fiscal year setup. */
  generateFiscalCalendar(year: number, fiscalYearStartMonth: number = 1): DimTime[] {
    const periods: DimTime[] = [];
    let periodNum = 1;
    
    for (let m = 0; m < 12; m++) {
      const month = ((fiscalYearStartMonth - 1 + m) % 12) + 1;
      const fy = fiscalYearStartMonth > month ? year + 1 : year;
      const q = Math.ceil(month / 3);
      
      // Last day of month
      const lastDay = new Date(fy, month, 0);
      const firstDay = new Date(fy, month - 1, 1);
      const daysInMonth = lastDay.getDate();
      const workingDays = this.calcWorkingDays(firstDay, lastDay);
      const dateKey = lastDay.toISOString().split('T')[0];
      
      if (!this.timeMap.has(dateKey)) {
        const dimTime: DimTime = {
          dateKey,
          calendarDate: lastDay,
          fiscalYear: fy,
          fiscalQuarter: q,
          fiscalPeriod: periodNum,
          periodName: `${lastDay.toLocaleString('en-US', { month: 'long' })} ${fy}`,
          isPeriodClosed: false,
          periodEndDate: lastDay,
          calendarYear: lastDay.getFullYear(),
          calendarMonth: lastDay.getMonth() + 1,
          calendarQuarter: Math.ceil((lastDay.getMonth() + 1) / 3),
          isBusinessDay: !this.isWeekend(lastDay),
          isMonthEnd: true,
          isQuarterEnd: month % 3 === 0,
          isYearEnd: month === 12,
          workingDaysInPeriod: workingDays,
        };
        this.timeMap.set(dateKey, dimTime);
        periods.push(dimTime);
        periodNum++;
      }
    }
    return periods;
  }

  private isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  private calcWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      if (!this.isWeekend(d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getByDateKey(key: string): DimTime | undefined {
    return this.timeMap.get(key);
  }

  /** Get period end date key for a given year/period */
  getPeriodEndDateKey(fiscalYear: number, fiscalPeriod: number, fiscalYearStartMonth: number = 1): string {
    const month = ((fiscalYearStartMonth - 1 + fiscalPeriod - 1) % 12);
    const year = fiscalPeriod === 1 && fiscalYearStartMonth > 1 ? fiscalYear - 1 : fiscalYear;
    const lastDay = new Date(year, month + 1, 0);
    return lastDay.toISOString().split('T')[0];
  }

  /** Get all period date keys for a fiscal year */
  getYearPeriodKeys(year: number, fiscalYearStartMonth: number = 1): string[] {
    const keys: string[] = [];
    for (let p = 1; p <= 12; p++) {
      keys.push(this.getPeriodEndDateKey(year, p, fiscalYearStartMonth));
    }
    return keys;
  }

  getAll(): DimTime[] {
    return Array.from(this.timeMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DimAccount — account dimension with SCD Type 2
// ─────────────────────────────────────────────────────────────────────────────

export class DimAccountService {
  private repo: any;  // Repository<DimAccount> — using any to avoid { id: string } constraint
  private cache = new Map<string, DimAccount>();

  constructor(repo: any) { this.repo = repo; }

  async upsert(account: DimAccount): Promise<void> {
    const existing = this.cache.get(account.accountKey);
    if (existing && existing.effectiveTo === undefined) {
      // Close the current version
      existing.effectiveTo = new Date(account.effectiveFrom.getTime() - 1);
      await this.repo.update(existing);
    }
    await this.repo.insert(account);
    this.cache.set(account.accountKey, account);
  }

  async getByKey(key: string, asOfDate?: Date): Promise<DimAccount | null> {
    const all = await this.repo.findAll();
    const valid = asOfDate
      ? all.filter((a: any) => a.accountKey === key && a.effectiveFrom <= asOfDate && (!a.effectiveTo || a.effectiveTo > asOfDate))
      : all.filter((a: any) => a.accountKey === key && !a.effectiveTo);
    return valid[valid.length - 1] ?? null;
  }

  async getByCode(code: string, asOfDate?: Date): Promise<DimAccount | null> {
    const all = await this.repo.findAll();
    const valid = asOfDate
      ? all.filter((a: any) => a.accountCode === code && a.effectiveFrom <= asOfDate && (!a.effectiveTo || a.effectiveTo > asOfDate))
      : all.filter((a: any) => a.accountCode === code && !a.effectiveTo);
    return valid[valid.length - 1] ?? null;
  }

  async getAllActive(): Promise<DimAccount[]> {
    const all = await this.repo.findAll();
    return all.filter((a: any) => a.isActive && !a.effectiveTo);
  }

  async getByType(type: AccountDimensionType): Promise<DimAccount[]> {
    return this.getAllActive().then(list => list.filter((a: any) => a.accountType === type));
  }

  async getBalanceSheetAccounts(): Promise<DimAccount[]> {
    const active = await this.getAllActive();
    return active.filter((a: any) => a.balanceSheetRole !== 'none');
  }

  async getIncomeStatementAccounts(): Promise<DimAccount[]> {
    const active = await this.getAllActive();
    return active.filter((a: any) => a.incomeStatementRole !== 'none');
  }

  async seedFromChartOfAccounts(
    coa: Array<{ id: string; code: string; name: string; type: string; normalBalance: string; isActive: boolean; isContra?: boolean; }>
  ): Promise<void> {
    for (const acct of coa) {
      const type = acct.type.toLowerCase().replace('-', '_') as AccountDimensionType;
      const balanceType = acct.normalBalance === AccountNormalBalance.CREDIT ? AccountNormalBalance.CREDIT : AccountNormalBalance.DEBIT;
      let incomeRole: DimAccount['incomeStatementRole'] = 'none';
      let balanceRole: DimAccount['balanceSheetRole'] = 'none';
      
      if (type === 'revenue') incomeRole = acct.code.startsWith('41') ? 'other_income' : 'revenue';
      else if (type === 'expense') {
        if (acct.code === '5000') incomeRole = 'cogs';
        else if (acct.code.startsWith('62')) incomeRole = 'operating_expense';
        else if (acct.code.startsWith('89')) incomeRole = acct.name.toLowerCase().includes('tax') ? 'income_tax' : 'other_expense';
      }
      
      if (['asset', 'liability', 'equity'].includes(type)) {
        if (['1000', '1100', '1200', '1300'].includes(acct.code)) balanceRole = 'current_asset';
        else if (['1500', '1510'].includes(acct.code)) balanceRole = 'noncurrent_asset';
        else if (['2000', '2100', '2200', '2300'].includes(acct.code)) balanceRole = 'current_liability';
        else if (['2500', '2600'].includes(acct.code)) balanceRole = 'noncurrent_liability';
        else if (type === 'equity') balanceRole = 'equity';
      }

      await this.upsert({
        accountKey: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        accountType: type,
        balanceType,
        incomeStatementRole: incomeRole,
        balanceSheetRole: balanceRole,
        isContra: acct.isContra ?? false,
        isActive: acct.isActive,
        effectiveFrom: new Date(),
        version: 1,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DimEntity — legal entity dimension with ownership hierarchy
// ─────────────────────────────────────────────────────────────────────────────

export class DimEntityService {
  private repo: any;  // Repository<DimEntity> — using any to avoid { id: string } constraint
  private cache = new Map<string, DimEntity>();

  constructor(repo: any) { this.repo = repo; }

  async upsert(entity: DimEntity): Promise<void> {
    const existing = this.cache.get(entity.entityKey);
    if (existing && existing.effectiveTo === undefined) {
      existing.effectiveTo = new Date(entity.effectiveFrom.getTime() - 1);
      await this.repo.update(existing);
    }
    await this.repo.insert(entity);
    this.cache.set(entity.entityKey, entity);
  }

  async getByKey(key: string): Promise<DimEntity | null> {
    const all = await this.repo.findAll();
    return all.find((e: any) => e.entityKey === key && !e.effectiveTo) ?? null;
  }

  async getById(id: string): Promise<DimEntity | null> {
    const all = await this.repo.findAll();
    return all.find((e: any) => e.entityId === id && !e.effectiveTo) ?? null;
  }

  async getAllActive(): Promise<DimEntity[]> {
    return this.repo.findAll().then((all: any[]) => all.filter((e: any) => e.isActive && !e.effectiveTo));
  }

  /** Get all subsidiaries under a parent entity */
  async getSubsidiaries(parentKey: string): Promise<DimEntity[]> {
    const all = await this.getAllActive();
    const findChildren = (key: string): DimEntity[] => {
      return all.filter((e: any) => e.parentEntityKey === key).flatMap(e => [e, ...findChildren(e.entityKey)]);
    };
    return findChildren(parentKey);
  }

  /** Build ownership tree */
  async buildOwnershipTree(rootKey: string): Promise<EntityOwnershipNode> {
    const root = await this.getByKey(rootKey);
    if (!root) throw new Error(`Entity ${rootKey} not found`);
    
    const buildNode = async (entity: DimEntity): Promise<EntityOwnershipNode> => {
      const children = (await this.getAllActive()).filter((e: any) => e.parentEntityKey === entity.entityKey);
      return {
        entity,
        ownershipPercent: entity.entityKey === rootKey ? 100 : entity.ownershipPercent,
        children: await Promise.all(children.map(buildNode)),
      };
    };
    return buildNode(root);
  }
}

export interface EntityOwnershipNode {
  entity: DimEntity;
  ownershipPercent: number;
  children: EntityOwnershipNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DimCurrency — currency master with precision
// ─────────────────────────────────────────────────────────────────────────────

const ISO_CURRENCIES: DimCurrency[] = [
  { currencyKey: 'USD', currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$', decimalPlaces: 2, isActive: true },
  { currencyKey: 'EUR', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', decimalPlaces: 2, isActive: true },
  { currencyKey: 'GBP', currencyCode: 'GBP', currencyName: 'British Pound', currencySymbol: '£', decimalPlaces: 2, isActive: true },
  { currencyKey: 'NOK', currencyCode: 'NOK', currencyName: 'Norwegian Krone', currencySymbol: 'kr', decimalPlaces: 2, isActive: true },
  { currencyKey: 'JPY', currencyCode: 'JPY', currencyName: 'Japanese Yen', currencySymbol: '¥', decimalPlaces: 0, isActive: true },
  { currencyKey: 'SEK', currencyCode: 'SEK', currencyName: 'Swedish Krona', currencySymbol: 'kr', decimalPlaces: 2, isActive: true },
  { currencyKey: 'DKK', currencyCode: 'DKK', currencyName: 'Danish Krone', currencySymbol: 'kr', decimalPlaces: 2, isActive: true },
  { currencyKey: 'CHF', currencyCode: 'CHF', currencyName: 'Swiss Franc', currencySymbol: 'CHF', decimalPlaces: 2, isActive: true },
  { currencyKey: 'CAD', currencyCode: 'CAD', currencyName: 'Canadian Dollar', currencySymbol: 'C$', decimalPlaces: 2, isActive: true },
  { currencyKey: 'AUD', currencyCode: 'AUD', currencyName: 'Australian Dollar', currencySymbol: 'A$', decimalPlaces: 2, isActive: true },
  { currencyKey: 'CNY', currencyCode: 'CNY', currencyName: 'Chinese Yuan', currencySymbol: '¥', decimalPlaces: 2, isActive: true },
  { currencyKey: 'INR', currencyCode: 'INR', currencyName: 'Indian Rupee', currencySymbol: '₹', decimalPlaces: 2, isActive: true },
  { currencyKey: 'BRL', currencyCode: 'BRL', currencyName: 'Brazilian Real', currencySymbol: 'R$', decimalPlaces: 2, isActive: true },
];

export class DimCurrencyService {
  private currencies = new Map<string, DimCurrency>();

  constructor() {
    for (const c of ISO_CURRENCIES) this.currencies.set(c.currencyCode, c);
  }

  getByCode(code: string): DimCurrency | undefined {
    return this.currencies.get(code);
  }

  getAll(): DimCurrency[] {
    return Array.from(this.currencies.values()).filter((c: any) => c.isActive);
  }

  addCustom(currency: DimCurrency): void {
    this.currencies.set(currency.currencyCode, currency);
  }

  getPrecision(code: string): number {
    return this.currencies.get(code)?.decimalPlaces ?? 2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FX Rates — exchange rate service
// ─────────────────────────────────────────────────────────────────────────────

export interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: string;               // e.g. "1.2345" (fromCurrency = X units of toCurrency)
  rateType: 'SPOT' | 'AVERAGE_MONTHLY' | 'AVERAGE_QUARTERLY' | 'HISTORICAL';
  effectiveDate: Date;
  source: string;             // 'ECB' | 'FED' | 'MANUAL'
}

export class FXRateService {
  private rates: FXRate[] = [];

  addRate(rate: FXRate): void { this.rates.push(rate); }

  /** Get the most recent rate as of a date */
  getRate(from: string, to: string, asOfDate: Date): string | null {
    const valid = this.rates
      .filter((r: any) => r.fromCurrency === from && r.toCurrency === to && r.effectiveDate <= asOfDate)
      .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());
    return valid[0]?.rate ?? null;
  }

  /** Convert an amount from one currency to another */
  convert(amount: string, from: string, to: string, asOfDate: Date): { amount: string; rate: string } | null {
    if (from === to) return { amount, rate: '1' };
    const rate = this.getRate(from, to, asOfDate);
    if (!rate) return null;
    const result = (parseFloat(amount) * parseFloat(rate)).toFixed(8);
    return { amount: result, rate };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory repositories for each dimension
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryDimAccountRepo {  // Not implementing Repository — uses insert/update directly
  private data: DimAccount[] = [];
  async findAll(): Promise<DimAccount[]> { return [...this.data]; }
  async findById(key: string): Promise<DimAccount | null> { return this.data.find(d => d.accountKey === key) ?? null; }
  async insert(item: DimAccount): Promise<void> { this.data.push(item); }
  async update(item: DimAccount): Promise<void> {
    const idx = this.data.findIndex(d => d.accountKey === item.accountKey);
    if (idx >= 0) this.data[idx] = item;
  }
  async delete(_key: string): Promise<void> { /* no-op for SCD Type 2 */ }
}

export class InMemoryDimEntityRepo {
  private data: DimEntity[] = [];
  async findAll(): Promise<DimEntity[]> { return [...this.data]; }
  async findById(key: string): Promise<DimEntity | null> { return this.data.find(d => d.entityKey === key) ?? null; }
  async insert(item: DimEntity): Promise<void> { this.data.push(item); }
  async update(item: DimEntity): Promise<void> {
    const idx = this.data.findIndex(d => d.entityKey === item.entityKey);
    if (idx >= 0) this.data[idx] = item;
  }
  async delete(_key: string): Promise<void> {}
}

export { DimEntity };
