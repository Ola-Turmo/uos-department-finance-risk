/**
 * Financial Data Warehouse — Core Types
 * 
 * Based on Kimball dimensional modeling + SAP ACDOCA universal journal concept.
 * Every financial fact is stored with full dimensional context for maximum
 * analytical flexibility without ever hitting the OLTP system.
 * 
 * Design principles:
 * - Immutable inserts only (no updates/deletes on fact tables)
 * - Surrogate keys for all dimensions (stable across source system changes)
 * - Effective dating on all master data (SCD Type 2 ready)
 * - All amounts in both original currency AND functional currency
 * - Balance aggregation tables for O(1) report generation
 */

import { AccountNormalBalance } from '../../core/chart-of-accounts-config.js';

// ═══════════════════════════════════════════════════════════════
// MONEY & CURRENCY
// ═══════════════════════════════════════════════════════════════

export interface Money {
  amount: string;      // String decimal to avoid floating-point errors (e.g. "123456.78")
  currency: string;    // ISO 4217: USD, EUR, GBP, NOK
  precision: number;   // Decimal places (2 for most, 0 for JPY/KRW)
}

export interface MultiCurrencyMoney {
  /** Amount in the transaction/original currency */
  amount: string;
  currency: string;
  precision: number;
  /** Amount in the entity's functional currency */
  amountLcy: string;
  /** Amount in group/consolidation currency */
  amountGcy?: string;
  exchangeRate: string;
  exchangeRateType: 'SPOT' | 'AVERAGE_MONTHLY' | 'AVERAGE_QUARTERLY' | 'HISTORICAL';
}

export function toNumber(m: Money | string): number {
  if (typeof m === 'string') return parseFloat(m);
  return parseFloat(m.amount);
}

export function addMoney(a: Money, b: Money, currency: string): Money {
  const precision = Math.max(a.precision, b.precision);
  const scale = Math.pow(10, precision);
  const aVal = Math.round(parseFloat(a.amount) * scale);
  const bVal = Math.round(parseFloat(b.amount) * scale);
  return { amount: ((aVal + bVal) / scale).toFixed(precision), currency, precision };
}

export function negateMoney(m: Money): Money {
  return { ...m, amount: (-parseFloat(m.amount)).toFixed(m.precision) };
}

// ═══════════════════════════════════════════════════════════════
// DIMENSIONS
// ═══════════════════════════════════════════════════════════════

export interface DimAccount {
  accountKey: string;           // Surrogate key
  accountCode: string;         // Natural key (e.g. "1100")
  accountName: string;
  accountType: AccountDimensionType;
  balanceType: AccountNormalBalance;
  /** For income statement classification */
  incomeStatementRole: 'revenue' | 'cogs' | 'operating_expense' | 'other_income' | 'other_expense' | 'income_tax' | 'none';
  /** For balance sheet classification */
  balanceSheetRole: 'current_asset' | 'noncurrent_asset' | 'current_liability' | 'noncurrent_liability' | 'equity' | 'none';
  /** GAAP/IFRS classification for statutory reporting */
  gaapClassification?: string;
  ifrsClassification?: string;
  taxCode?: string;             // VAT/GST treatment
  isContra: boolean;            // Accumulated depreciation is contra to fixed assets
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  version: number;
}

export type AccountDimensionType =
  | 'asset' | 'liability' | 'equity'
  | 'revenue' | 'expense'
  | 'other_income' | 'other_expense';

export interface DimEntity {
  entityKey: string;            // Surrogate key
  entityId: string;             // Natural key
  entityName: string;
  entityType: 'CORPORATION' | 'LLC' | 'PARTNERSHIP' | 'BRANCH' | 'TRUST' | 'INDIVIDUAL';
  /** Corporate hierarchy */
  parentEntityKey?: string;
  ownershipPercent: number;     // Parent's ownership (0-100)
  consolidationMethod: 'FULL' | 'PROPORTIONATE' | 'EQUITY' | 'COST' | 'NONE';
  /** Functional currency — entity's base currency */
  functionalCurrency: string;
  /** Presentation currency for group reporting */
  presentationCurrency: string;
  taxJurisdiction: string;     // ISO country code
  isIntercompany: boolean;     // True if this is an intercompany entity
  isActive: boolean;
  fiscalYearEndMonth: number;   // 1-12
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface DimTime {
  dateKey: string;              // "2025-03-31" (ISO date string as key)
  calendarDate: Date;
  /** Fiscal periods — flexible for 12 or 13 period years */
  fiscalYear: number;           // e.g. 2025
  fiscalQuarter: number;        // 1-4
  fiscalPeriod: number;         // 1-12 (or 1-13)
  fiscalWeek?: number;
  periodName: string;            // "March 2025" or "Q1 FY2025"
  isPeriodClosed: boolean;
  periodEndDate: Date;
  /** Calendar variants */
  calendarYear: number;
  calendarMonth: number;        // 1-12
  calendarQuarter: number;
  calendarWeek?: number;
  dayOfWeek?: number;
  isBusinessDay: boolean;
  isMonthEnd: boolean;
  isQuarterEnd: boolean;
  isYearEnd: boolean;
  /** Working days for forecasting */
  workingDaysInPeriod: number;
}

export interface DimCurrency {
  currencyKey: string;
  currencyCode: string;         // ISO 4217
  currencyName: string;
  currencySymbol: string;
  decimalPlaces: number;        // 2 for most, 0 for JPY/KRW/HUF
  isActive: boolean;
}

export interface DimProduct {
  productKey: string;
  productId: string;
  productName: string;
  productCategory: string;
  productLine?: string;
  isActive: boolean;
}

export interface DimCustomer {
  customerKey: string;
  customerId: string;
  customerName: string;
  customerSegment: string;
  creditTermsDays: number;
  taxId?: string;
  isActive: boolean;
}

export interface DimVendor {
  vendorKey: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  paymentTermsDays: number;
  taxId?: string;
  isActive: boolean;
}

export interface DimCostCenter {
  costCenterKey: string;
  costCenterId: string;
  costCenterName: string;
  department?: string;
  region?: string;
  entityKey: string;            // Owning entity
  isActive: boolean;
}

export interface DimProject {
  projectKey: string;
  projectId: string;
  projectName: string;
  projectStatus: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  entityKey: string;
  isActive: boolean;
}

export interface DimJournal {
  journalKey: string;
  journalId: string;            // Natural key
  journalName: string;
  journalType: JournalType;
  source: string;               // AR, AP, GL, Payroll, Banking
  isAdjusting: boolean;          // Adjusting journal vs. original
  isReversal: boolean;
  isIntercompany: boolean;
}

export type JournalType =
  | 'MANUAL' | 'SALES' | 'PURCHASE' | 'CASH' | 'PAYROLL'
  | 'DEPRECIATION' | 'AMORTIZATION' | 'CLOSING' | 'ELIMINATION'
  | 'REVERSAL' | 'ADJUSTMENT' | 'CONSOLIDATION' | 'otax';

// ═══════════════════════════════════════════════════════════════
// FACT TABLES
// ═══════════════════════════════════════════════════════════════

export interface FactGLEntry {
  /** Surrogate key */
  entryKey: string;
  /** Natural keys */
  journalId: string;
  journalLineId: string;
  transactionId: string;
  documentNumber: string;
  documentType: string;
  /** Dimensional foreign keys */
  dateKey: string;               // Transaction date
  postingDateKey: string;       // Accounting period date
  accountKey: string;
  entityKey: string;
  currencyKey: string;
  productKey?: string;
  customerKey?: string;
  vendorKey?: string;
  costCenterKey?: string;
  projectKey?: string;
  /** Amounts — signed: debits positive, credits negative */
  amountLcy: string;            // Functional currency
  amountGcy?: string;           // Group/consolidation currency
  /** Debit/credit separately (useful for reports) */
  debitAmount: string;
  creditAmount: string;
  quantity?: string;
  /** Audit */
  sourceSystem: string;
  sourceDocumentId?: string;
  createdAt: Date;
  createdBy: string;
  /** Workflow */
  workflowStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED' | 'DELETED';
  /** Intercompany */
  isIntercompany: boolean;
  counterpartEntityKey?: string;
  counterpartAccountKey?: string;
  /** Tax */
  taxCode?: string;
  taxAmountLcy?: string;
}

export interface FactBalance {
  /** Composite key: entity+account+period */
  balanceKey: string;
  dateKey: string;              // Period end date
  accountKey: string;
  entityKey: string;
  currencyKey: string;
  costCenterKey?: string;
  productKey?: string;
  /** Balances */
  beginningBalance: string;
  periodDebitActivity: string;
  periodCreditActivity: string;
  endingBalance: string;
  /** Metadata */
  transactionCount: number;
  lastTransactionDate?: Date;
  /** Currency conversion */
  exchangeRateEnd?: string;
  exchangeRateAverage?: string;
  /** Audit */
  lastUpdatedAt: Date;
  lastUpdatedBy: string;
}

// ═══════════════════════════════════════════════════════════════
// XBRL READY TAGS
// ═══════════════════════════════════════════════════════════════

export interface XbrlTag {
  concept: string;               // e.g. "us-gaap:Assets"
  taxonomy: 'US_GAAP' | 'IFRS' | 'LOCAL';
  value: string;
  decimals?: number;
  contextRef: string;            // e.g. "CurrentYear", "PriorYear"
  unitRef?: string;             // e.g. "USD"
  isFootnote?: boolean;
}
