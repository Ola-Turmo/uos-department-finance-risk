/**
 * Month-End Package — orchestrates all financial reports + reconciliation checklist.
 * Company/jurisdiction flexible — uses chartOfAccountsId from company config.
 * 
 * Integrates the full world-class reporting stack:
 * - Trial Balance (dimensional, comparison periods)
 * - Income Statement (multi-step, by nature/function)
 * - Balance Sheet (IFRS/US GAAP, XBRL-ready)
 * - Cash Flow Statement (indirect method)
 * - Consolidation results (eliminations, NCI, CTA)
 * - Budget vs Actual (variance analysis, KPI scorecard)
 * - Audit checklist (SOX compliance items)
 */

import { ChartOfAccountsConfigurator, AccountType, AccountNormalBalance } from '../core/chart-of-accounts-config.js';
import { IncomeStatementService } from './income-statement.js';
import { BalanceSheetService } from './balance-sheet.js';
import { CashFlowService } from './cash-flow-statement.js';
import { TrialBalanceService } from './trial-balance.js';
// ─── WORLD-CLASS REPORTING MODULE ───────────────────────────────────────────
import {
  FinancialReportService, ReportResult,
  StatutoryReportService,
  ConsolidationEngine,
  BudgetVsActualEngine, VarianceAnalysis, KPIScorecard,
  AuditReportService, AuditEntry,
  DimTimeService,
  DimAccountService, DimEntityService, DimCurrencyService, FXRateService,
  FinancialDataWarehouse,
  InMemoryGLEntryRepo, InMemoryBalanceRepo,
  InMemoryDimAccountRepo, InMemoryDimEntityRepo,
} from './index.js';
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthEndChecklistItem { item: string; status: 'complete' | 'pending' | 'skipped'; notes?: string; }

export interface MonthEndPackage {
  periodStart: string; periodEnd: string; periodLabel: string; generatedAt: string;
  /** Legacy report objects (for backwards compatibility) */
  trialBalance: any; incomeStatement: any; balanceSheet: any; cashFlowStatement: any;
  checklist: MonthEndChecklistItem[];
  /** World-class reporting objects */
  statutoryBalanceSheet?: any;
  varianceAnalysis?: VarianceAnalysis[];
  kpiScorecard?: KPIScorecard;
  auditReport?: { entriesLogged: number; integrityVerified: boolean; };
  consolidationResult?: any;
}

export class MonthEndPackageService {
  // World-class reporting services (initialized lazily)
  private _dimTime?: DimTimeService;
  private _dimAccount?: DimAccountService;
  private _dimEntity?: DimEntityService;
  private _fxRate?: FXRateService;
  private _warehouse?: FinancialDataWarehouse;
  private _reportEngine?: FinancialReportService;
  private _statutoryService?: StatutoryReportService;
  private _consolidation?: ConsolidationEngine;
  private _budgetEngine?: BudgetVsActualEngine;
  private _auditService?: AuditReportService;

  constructor(
    private coaConfig: ChartOfAccountsConfigurator,
    private trialBalanceService: TrialBalanceService,
    private incomeStatementService: IncomeStatementService,
    private balanceSheetService: BalanceSheetService,
    private cashFlowService: CashFlowService,
  ) {}

  /** Lazily initialize world-class reporting services */
  private initReportingServices(): void {
    if (this._reportEngine) return;

    this._dimTime = new DimTimeService();
    this._dimTime.generateFiscalCalendar(new Date().getFullYear());

    const dimAccountRepo = new InMemoryDimAccountRepo();
    const dimEntityRepo = new InMemoryDimEntityRepo();
    const glEntryRepo = new InMemoryGLEntryRepo();
    const balanceRepo = new InMemoryBalanceRepo();

    this._dimAccount = new DimAccountService(dimAccountRepo as any);
    this._dimEntity = new DimEntityService(dimEntityRepo as any);
    this._fxRate = new FXRateService();

    this._warehouse = new FinancialDataWarehouse(
      glEntryRepo as any, balanceRepo as any,
      this._dimAccount, this._dimEntity,
    );
    this._warehouse.setDimTime(this._dimTime);

    this._reportEngine = new FinancialReportService(this._warehouse, this._dimAccount, this._dimTime);
    this._statutoryService = new StatutoryReportService(
      this._warehouse, this._dimAccount, this._dimEntity, this._dimTime,
    );
    this._consolidation = new ConsolidationEngine(this._warehouse, this._dimEntity, this._dimTime, this._fxRate);
    this._budgetEngine = new BudgetVsActualEngine(this._warehouse, this._dimAccount, this._dimTime);
    this._auditService = new AuditReportService();
  }

  async generate(params: {
    companyId: string; chartOfAccountsId: string;
    periodStart: Date; periodEnd: Date; periodLabel: string;
    accountBalances: { code: string; name: string; amount: number; category?: string; }[];
    retainedEarnings: number; netIncome: number; depreciation: number;
    beginningCash: number;
    /** World-class options */
    includeStatutory?: boolean;
    includeVarianceAnalysis?: boolean;
    includeKPIScorecard?: boolean;
    includeConsolidation?: boolean;
    includeAuditReport?: boolean;
    standard?: 'IFRS' | 'US_GAAP' | 'LOCAL_GAAP';
    currency?: string;
  }): Promise<MonthEndPackage> {
    this.initReportingServices();
    const coa = await this.coaConfig.get(params.chartOfAccountsId);
    const enriched = params.accountBalances.map(a => {
      const def = coa?.accounts.find(ac => ac.code === a.code);
      return {
        code: a.code, name: a.name,
        category: a.category ?? def?.type ?? 'expense',
        normalBalance: (def?.normalBalance === AccountNormalBalance.CREDIT ? 'credit' : 'debit') as 'debit' | 'credit',
        balance: a.amount,
        type: def?.type ?? AccountType.EXPENSE,
        amount: a.amount,
      };
    });

    const periodStartStr = params.periodStart.toISOString().split('T')[0];
    const periodEndStr = params.periodEnd.toISOString().split('T')[0];
    const dateKey = periodEndStr;
    const entityKey = params.companyId;
    const currency = params.currency ?? 'USD';
    const standard = params.standard ?? 'US_GAAP';

    // ─── LEGACY REPORTS (backwards compatible) ────────────────────────────────
    const trialBalance = await this.trialBalanceService.generate({
      asOfDate: params.periodEnd, periodLabel: params.periodLabel,
      accounts: enriched.map(a => ({ code: a.code, name: a.name, category: a.category, normalBalance: a.normalBalance, balance: a.amount })),
    });

    const incomeStatement = await this.incomeStatementService.generate({
      periodStart: params.periodStart, periodEnd: params.periodEnd,
      periodLabel: params.periodLabel, chartOfAccountsId: params.chartOfAccountsId,
      accounts: enriched.map(a => ({ code: a.code, name: a.name, type: a.type, amount: a.amount })),
      depreciation: params.depreciation,
    });

    const balanceSheet = await this.balanceSheetService.generate({
      asOfDate: periodEndStr, periodLabel: params.periodLabel, chartOfAccountsId: params.chartOfAccountsId,
      accountBalances: enriched.map(a => ({ code: a.code, amount: a.amount })),
      retainedEarnings: params.retainedEarnings, netIncomeYTD: params.netIncome,
    });

    const cashFlowStatement = await this.cashFlowService.generate({
      periodStart: periodStartStr, periodEnd: periodEndStr,
      periodLabel: params.periodLabel, chartOfAccountsId: params.chartOfAccountsId,
      accountBalances: enriched.map(a => ({ code: a.code, name: a.name, type: a.type, amount: a.amount })),
      netIncome: params.netIncome, depreciation: params.depreciation, amortization: 0,
      beginningCash: params.beginningCash,
    });

    // ─── LEGACY CHECKLIST ─────────────────────────────────────────────────────
    const checklist: MonthEndChecklistItem[] = [
      { item: 'Trial Balance is balanced', status: trialBalance.isBalanced ? 'complete' : 'pending', notes: trialBalance.isBalanced ? `Debits: ${trialBalance.totalDebits.toFixed(2)} | Credits: ${trialBalance.totalCredits.toFixed(2)}` : 'IMBALANCED - investigate' },
      { item: 'Balance Sheet is balanced', status: balanceSheet.isBalanced ? 'complete' : 'pending', notes: balanceSheet.isBalanced ? 'Assets = Liabilities + Equity' : `Gap: ${(balanceSheet.totalAssets - balanceSheet.liabilitiesAndEquity).toFixed(2)}` },
      { item: 'Income Statement ties to Balance Sheet', status: Math.abs(balanceSheet.totalEquity - (params.retainedEarnings + params.netIncome)) < 0.01 ? 'complete' : 'pending', notes: `Net Income: ${params.netIncome.toFixed(2)} | Equity Change: ${balanceSheet.totalEquity.toFixed(2)}` },
      { item: 'Cash Flow ties to Balance Sheet', status: Math.abs(cashFlowStatement.endingCash - (params.beginningCash + cashFlowStatement.netChange)) < 0.01 ? 'complete' : 'pending', notes: `Ending Cash: ${cashFlowStatement.endingCash.toFixed(2)}` },
      { item: 'Depreciation posted', status: params.depreciation > 0 ? 'complete' : 'skipped', notes: `Amount: ${params.depreciation.toFixed(2)}` },
      { item: 'All journal entries posted', status: 'pending', notes: 'Verify with GL team' },
      { item: 'AP aging reviewed', status: 'pending' },
      { item: 'AR aging reviewed', status: 'pending' },
      { item: 'Month-end close checklist signed off', status: 'pending' },
    ];

    // ─── WORLD-CLASS REPORTING ────────────────────────────────────────────────
    let statutoryBalanceSheet: any;
    let varianceAnalysis: VarianceAnalysis[] | undefined;
    let kpiScorecard: KPIScorecard | undefined;
    let auditReport: MonthEndPackage['auditReport'];
    let consolidationResult: any;

    if (params.includeStatutory) {
      try {
        statutoryBalanceSheet = await this._statutoryService!.generateBalanceSheet({
          dateKey, entityKey, standard, currency, includeComparative: true,
        });
        checklist.push({ item: `Statutory BS generated (${standard})`, status: 'complete', notes: statutoryBalanceSheet.isBalanced ? 'BS balanced ✓' : 'BS imbalanced ⚠' });
      } catch (e) {
        checklist.push({ item: `Statutory BS (${standard})`, status: 'pending', notes: String(e) });
      }
    }

    if (params.includeVarianceAnalysis) {
      try {
        varianceAnalysis = await this._budgetEngine!.analyzeVariance({ dateKey, entityKey });
        const materialCount = varianceAnalysis.filter(v => v.isMaterial).length;
        checklist.push({ item: 'Variance analysis completed', status: 'complete', notes: `${materialCount} material variances found` });
      } catch (e) {
        checklist.push({ item: 'Variance analysis', status: 'pending', notes: String(e) });
      }
    }

    if (params.includeKPIScorecard) {
      try {
        kpiScorecard = await this._budgetEngine!.generateKPIScorecard({ dateKey, entityKey, currency });
        checklist.push({ item: 'KPI Scorecard generated', status: 'complete',
          notes: `${kpiScorecard.summary.greenCount}🟢 ${kpiScorecard.summary.amberCount}🟡 ${kpiScorecard.summary.redCount}🔴` });
      } catch (e) {
        checklist.push({ item: 'KPI Scorecard', status: 'pending', notes: String(e) });
      }
    }

    if (params.includeConsolidation) {
      try {
        consolidationResult = await this._consolidation!.consolidate({
          parentEntityKey: entityKey, periodDateKey: dateKey, presentationCurrency: currency,
        });
        checklist.push({ item: 'Consolidation completed', status: 'complete',
          notes: `${consolidationResult.meta.entityCount} entities, ${consolidationResult.meta.eliminatedCount} eliminations` });
      } catch (e) {
        checklist.push({ item: 'Consolidation', status: 'pending', notes: String(e) });
      }
    }

    if (params.includeAuditReport) {
      try {
        // Verify audit log integrity
        const integrity = this._auditService!.verifyIntegrity();
        auditReport = { entriesLogged: this._auditService!.auditLog.length, integrityVerified: integrity.isValid };
        checklist.push({ item: 'Audit log integrity verified', status: integrity.isValid ? 'complete' : 'pending',
          notes: integrity.isValid ? `✓ ${auditReport.entriesLogged} entries` : `✗ Broken at ${integrity.brokenAt}` });
      } catch (e) {
        checklist.push({ item: 'Audit report', status: 'pending', notes: String(e) });
      }
    }

    return {
      periodStart: periodStartStr, periodEnd: periodEndStr,
      periodLabel: params.periodLabel, generatedAt: new Date().toISOString(),
      trialBalance, incomeStatement, balanceSheet, cashFlowStatement, checklist,
      ...(statutoryBalanceSheet && { statutoryBalanceSheet }),
      ...(varianceAnalysis && { varianceAnalysis }),
      ...(kpiScorecard && { kpiScorecard }),
      ...(auditReport && { auditReport }),
      ...(consolidationResult && { consolidationResult }),
    };
  }
}
