/**
 * Finance ERP Integration Stubs (NetSuite, Ramp, Brex)
 * Replace with actual SDK clients in production.
 */
export interface ERPTransaction { id: string; date: string; amount: number; vendor: string; status: string; }
export interface ERPVendor { id: string; name: string; riskScore?: number; }

export class FinanceERPStub {
  async fetchTransactions(startDate: string, endDate: string): Promise<ERPTransaction[]> {
    console.warn("[ERP] Stub — implement with real NetSuite/Ramp/Brex credentials");
    return [];
  }
  async fetchVendor(vendorId: string): Promise<ERPVendor | null> { return null; }
  async postJournalEntry(lines: Array<{ account: string; debit: number; credit: number }>): Promise<{ success: boolean; journalId?: string }> {
    return { success: false };
  }
  async getBudgetVariances(departmentId: string, period: string): Promise<{ budgeted: number; actual: number; variance: number }[]> {
    return [];
  }
}
