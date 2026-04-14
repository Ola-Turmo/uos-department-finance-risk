/**
 * Statutory Report Service — formal financial statements per IFRS/GAAP.
 * XBRL-ready: every line item tagged with US GAAP / IFRS taxonomy concepts.
 */

import { FinancialDataWarehouse } from '../warehouse/warehouse.js';
import { DimAccountService, DimEntityService } from '../dimensional/dim-services.js';
import { DimTimeService } from '../dimensional/dim-services.js';
import { XbrlTag } from '../dimensional/core-types.js';

export interface BalanceSheetStatement {
  reportType: 'balance_sheet'; asOfDate: string; currency: string; audited: boolean;
  xbrlTags: XbrlTag[];
  presentationStandard: 'IFRS' | 'US_GAAP' | 'LOCAL_GAAP';
  sections: { assets: BalanceSheetSection; liabilities: BalanceSheetSection; equity: BalanceSheetSection; };
  totalAssets: string; totalLiabilities: string; totalEquity: string;
  isBalanced: boolean; balanceDifference: string;
  comparative?: { priorPeriod: { assets: string; liabilities: string; equity: string; }; priorYear: { assets: string; liabilities: string; equity: string; }; };
}

export interface BalanceSheetSection {
  title: string;
  lineItems: Array<{ code: string; description: string; note: string; xbrlConcept: string; taxonomy: 'US_GAAP' | 'IFRS'; currentPeriod: string; priorPeriod: string; priorYear: string; isTotal: boolean; isBold: boolean; }>;
  subtotal: string;
}

const USGAAP_MAPPING: Record<string, string> = {
  '1000': 'us-gaap:CashAndCashEquivalentsAtCarryingValue', '1100': 'us-gaap:AccountsReceivableNetCurrent',
  '1200': 'us-gaap:InventoryNet', '1500': 'us-gaap:PropertyPlantAndEquipmentNet',
  '1510': 'us-gaap:AccumulatedDepreciationAndAmortizationPropertyPlantAndEquipment',
  '2000': 'us-gaap:AccountsPayableCurrent', '2100': 'us-gaap:AccruedLiabilitiesCurrent',
  '2200': 'us-gaap:TaxesPayableCurrent', '2300': 'us-gaap:EmployeeBenefitsLiabilitiesNoncurrent',
  '2500': 'us-gaap:LongTermDebtNoncurrent', '3000': 'us-gaap:CommonStock',
  '3200': 'us-gaap:RetainedEarningsAccumulatedDeficit', '3300': 'us-gaap:NetIncomeLoss',
  '4000': 'us-gaap:RevenueFromContractsWithCustomers', '5000': 'us-gaap:CostOfGoodsSold',
  '6000': 'us-gaap:SalariesAndWages', '6100': 'us-gaap:OfficeExpense',
  '6200': 'us-gaap:EmployeeBenefitsExpense', '6300': 'us-gaap:RentExpense',
  '6400': 'us-gaap:DepreciationAndAmortization', '6500': 'us-gaap:ProfessionalFees',
  '8991': 'us-gaap:IncomeTaxExpenseBenefit',
};

export class StatutoryReportService {
  constructor(
    private warehouse: FinancialDataWarehouse, private dimAccount: DimAccountService,
    private dimEntity: DimEntityService, private dimTime: DimTimeService,
  ) {}

  async generateBalanceSheet(params: {
    dateKey: string; entityKey: string; standard: 'IFRS' | 'US_GAAP' | 'LOCAL_GAAP';
    currency: string; includeComparative: boolean;
  }): Promise<BalanceSheetStatement> {
    const { dateKey, entityKey, standard, currency, includeComparative } = params;
    const currentBalances = await this.warehouse.getTrialBalanceData({ entityKey, dateKey, includeZeroBalance: false });
    const priorDateKey = this.getPriorPeriodDateKey(dateKey);
    const priorYearDateKey = this.getPriorYearDateKey(dateKey);
    const priorBalances = includeComparative ? await this.warehouse.getTrialBalanceData({ entityKey, dateKey: priorDateKey, includeZeroBalance: false }) : [];
    const priorYearBalances = includeComparative ? await this.warehouse.getTrialBalanceData({ entityKey, dateKey: priorYearDateKey, includeZeroBalance: false }) : [];

    const getBalance = (code: string, balances: typeof currentBalances): string => {
      const bal = balances.find(b => b.accountCode === code);
      return bal ? Math.abs(parseFloat(bal.endingBalance)).toFixed(2) : '0.00';
    };

    const assetCodes = ['1000','1100','1200','1300','1500','1510','1900'];
    const liabCodes = ['2000','2100','2200','2300','2500','2600'];
    const equityCodes = ['3000','3100','3200','3300'];

    const totalAssets = currentBalances.filter(b => assetCodes.some(c => b.accountCode.startsWith(c))).reduce((s, b) => s + parseFloat(b.endingBalance), 0);
    const totalLiab = currentBalances.filter(b => liabCodes.some(c => b.accountCode.startsWith(c))).reduce((s, b) => s + parseFloat(b.endingBalance), 0);
    const totalEq = currentBalances.filter(b => equityCodes.some(c => b.accountCode.startsWith(c))).reduce((s, b) => s + parseFloat(b.endingBalance), 0);
    const isBalanced = Math.abs(totalAssets - (totalLiab + totalEq)) < 0.01;

    const makeSection = (title: string, codes: string[]): BalanceSheetSection => ({
      title,
      lineItems: codes.map(code => ({
        code, description: code, note: '', xbrlConcept: USGAAP_MAPPING[code] ?? 'us-gaap:Other',
        taxonomy: 'US_GAAP' as const, currentPeriod: getBalance(code, currentBalances),
        priorPeriod: getBalance(code, priorBalances), priorYear: getBalance(code, priorYearBalances),
        isTotal: false, isBold: false,
      })),
      subtotal: title === 'ASSETS' ? Math.abs(totalAssets).toFixed(2) : title === 'LIABILITIES' ? Math.abs(totalLiab).toFixed(2) : Math.abs(totalEq).toFixed(2),
    });

    return {
      reportType: 'balance_sheet', asOfDate: dateKey, currency, audited: false,
      xbrlTags: currentBalances.filter(b => USGAAP_MAPPING[b.accountCode]).map(b => ({
        concept: USGAAP_MAPPING[b.accountCode], taxonomy: 'US_GAAP' as const,
        value: Math.abs(parseFloat(b.endingBalance)).toFixed(0), decimals: 0, contextRef: 'CurrentYear', unitRef: currency,
      })),
      presentationStandard: standard,
      sections: { assets: makeSection('ASSETS', assetCodes), liabilities: makeSection('LIABILITIES', liabCodes), equity: makeSection('EQUITY', equityCodes) },
      totalAssets: Math.abs(totalAssets).toFixed(2), totalLiabilities: Math.abs(totalLiab).toFixed(2), totalEquity: Math.abs(totalEq).toFixed(2),
      isBalanced, balanceDifference: (totalAssets - totalLiab - totalEq).toFixed(2),
    };
  }

  private getPriorPeriodDateKey(dateKey: string): string {
    const dimT = this.dimTime.getByDateKey(dateKey);
    if (!dimT) return dateKey;
    return this.dimTime.getPeriodEndDateKey(dimT.fiscalYear, dimT.fiscalPeriod - 1);
  }

  private getPriorYearDateKey(dateKey: string): string {
    const dimT = this.dimTime.getByDateKey(dateKey);
    if (!dimT) return dateKey;
    return this.dimTime.getPeriodEndDateKey(dimT.fiscalYear - 1, dimT.fiscalPeriod);
  }
}
