/**
 * Control exception logger — ensures 100% exception coverage with full audit trail.
 */
export interface ControlException {
  id: string;
  controlId: string;
  controlName: string;
  exceptionType: "missed_sla" | "failed_check" | "manual_override" | "policy_breach" | "access_violation";
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "resolved";
  description: string;
  owner: string;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: string;
  detectedBy: "automated" | "manual" | "llm";
}

export class ControlExceptionLogger {
  private exceptions: ControlException[] = [];

  log(params: Omit<ControlException, "id" | "status" | "detectedAt">): ControlException {
    const exc: ControlException = {
      ...params,
      id: `ctrl-exc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "open",
      detectedAt: new Date().toISOString(),
    };
    this.exceptions.push(exc);
    return exc;
  }

  resolve(exceptionId: string, resolution: string): void {
    const exc = this.exceptions.find(e => e.id === exceptionId);
    if (!exc) throw new Error(`Exception ${exceptionId} not found`);
    exc.status = "resolved";
    exc.resolvedAt = new Date().toISOString();
    exc.resolution = resolution;
  }

  getOpen(): ControlException[] {
    return this.exceptions.filter(e => e.status === "open").sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }

  complianceReport(startDate: string, endDate: string) {
    const period = this.exceptions.filter(e => e.detectedAt >= startDate && e.detectedAt <= endDate);
    const resolved = period.filter(e => e.resolvedAt);
    return {
      total: period.length,
      resolved: resolved.length,
      open: period.length - resolved.length,
      byType: Object.fromEntries(["missed_sla", "failed_check", "manual_override", "policy_breach", "access_violation"].map(t => [t, period.filter(e => e.exceptionType === t).length])),
      meanResolutionHours: resolved.length > 0 ? resolved.reduce((s, e) => s + (new Date(e.resolvedAt!).getTime() - new Date(e.detectedAt).getTime()) / 3600000, 0) / resolved.length : 0,
    };
  }
}
