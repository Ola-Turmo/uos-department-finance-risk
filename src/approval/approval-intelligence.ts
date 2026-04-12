/**
 * Approval Intelligence Engine
 * PRD: AI-powered approval recommendations with risk context.
 * Delegation optimization based on approver capacity.
 * Approval pipeline bottleneck prediction.
 */

import { nanoid } from "nanoid";
import type {
  ApprovalRequest,
  ApprovalPriority,
  ApprovalCategory,
  ControlBoundaryLevel,
  ApprovalIntelligenceState,
  TrackedApprovalRequest,
  HistoricalApproval,
  ApproverCapacity,
  ApprovalRecommendation,
  ApprovalRiskContext,
  DelegationSuggestion,
  BottleneckPrediction,
  PipelineAnalytics,
} from "../types.js";

// Re-export types for convenience
export type {
  ApprovalIntelligenceState,
  TrackedApprovalRequest,
  HistoricalApproval,
  ApproverCapacity,
  ApprovalRecommendation,
  ApprovalRiskContext,
  DelegationSuggestion,
  BottleneckPrediction,
  PipelineAnalytics,
} from "../types.js";

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate approver load based on pending requests and SLA urgency
 */
export function calculateApproverLoad(
  pendingRequests: Array<{ priority: ApprovalPriority; slaDeadlineHours: number }>
): { score: number; utilizationPercent: number; criticalCount: number; urgentCount: number } {
  let score = 0;
  let criticalCount = 0;
  let urgentCount = 0;

  for (const req of pendingRequests) {
    // Priority weights
    switch (req.priority) {
      case "critical":
        score += 40;
        criticalCount++;
        urgentCount++;
        break;
      case "high":
        score += 25;
        urgentCount++;
        break;
      case "medium":
        score += 10;
        break;
      case "low":
        score += 5;
        break;
    }

    // SLA urgency bonus (if deadline is soon)
    if (req.slaDeadlineHours <= 4) {
      score += 20;
    } else if (req.slaDeadlineHours <= 24) {
      score += 10;
    }
  }

  // Cap at 100
  const cappedScore = Math.min(score, 100);

  return {
    score: cappedScore,
    utilizationPercent: cappedScore,
    criticalCount,
    urgentCount,
  };
}

/**
 * Calculate risk score for an approval request
 */
export function calculateRiskScore(context: {
  amount?: number;
  priority: ApprovalPriority;
  controlBoundaryLevel: ControlBoundaryLevel;
  requiresSecondApproval: boolean;
  hasExceptions: boolean;
  daysInQueue: number;
  evidenceCompleteness: number;
}): number {
  let score = 0;

  // Amount-based risk (high value = higher risk)
  if (context.amount !== undefined) {
    if (context.amount >= 100000) score += 30;
    else if (context.amount >= 50000) score += 20;
    else if (context.amount >= 10000) score += 10;
    else score += 5;
  }

  // Priority-based risk
  switch (context.priority) {
    case "critical":
      score += 25;
      break;
    case "high":
      score += 15;
      break;
    case "medium":
      score += 8;
      break;
    case "low":
      score += 3;
      break;
  }

  // Control boundary risk
  switch (context.controlBoundaryLevel) {
    case "prohibited":
      score += 30;
      break;
    case "restricted":
      score += 20;
      break;
    case "elevated":
      score += 12;
      break;
    case "standard":
      score += 5;
      break;
  }

  // Second approval requirement
  if (context.requiresSecondApproval) score += 10;

  // Exception risk
  if (context.hasExceptions) score += 15;

  // Queue delay risk
  if (context.daysInQueue > 3) score += 10;
  else if (context.daysInQueue > 1) score += 5;

  // Evidence completeness (incomplete = higher risk)
  if (context.evidenceCompleteness < 50) score += 15;
  else if (context.evidenceCompleteness < 80) score += 8;

  return Math.min(score, 100);
}

/**
 * Predict approval time based on queue and capacity
 */
export function predictApprovalTime(
  queueLength: number,
  avgTimePerApproval: number,
  slaDeadlineHours: number
): {
  estimatedHours: number;
  willMeetSLA: boolean;
  slaBreachHours?: number;
} {
  const estimatedHours = queueLength * avgTimePerApproval;
  const willMeetSLA = estimatedHours <= slaDeadlineHours;

  return {
    estimatedHours,
    willMeetSLA,
    slaBreachHours: willMeetSLA ? undefined : estimatedHours - slaDeadlineHours,
  };
}

/**
 * Suggest optimal delegation based on approver capacity
 */
export function suggestOptimalDelegation(
  currentApprover: ApproverCapacity,
  alternativeApprovers: ApproverCapacity[]
): {
  suggestedDelegate: string;
  confidence: number;
  reasoning: string;
} | null {
  if (alternativeApprovers.length === 0) return null;

  // Filter out approvers with equal or higher load
  const betterApprovers = alternativeApprovers.filter(
    (alt) => alt.pendingCount < currentApprover.pendingCount
  );

  if (betterApprovers.length === 0) return null;

  // Find the one with lowest utilization
  const best = betterApprovers.reduce((a, b) =>
    a.utilizationPercent < b.utilizationPercent ? a : b
  );

  // Confidence based on how much better the alternative is
  const loadDiff = currentApprover.utilizationPercent - best.utilizationPercent;
  const confidence = Math.min(loadDiff / 50, 1); // Max confidence at 50% difference

  return {
    suggestedDelegate: "best",
    confidence,
    reasoning: `Delegate has ${loadDiff.toFixed(0)}% lower utilization (${best.utilizationPercent}% vs ${currentApprover.utilizationPercent}%)`,
  };
}

// ============================================
// Approval Intelligence Class
// ============================================

export class ApprovalIntelligence {
  private state: ApprovalIntelligenceState;

  constructor(initialState?: ApprovalIntelligenceState) {
    this.state = initialState ?? {
      pendingRequests: [],
      historicalApprovals: [],
      approverCapacity: {},
    };
  }

  /**
   * Get current intelligence state
   */
  getState(): ApprovalIntelligenceState {
    return this.state;
  }

  /**
   * Track a new pending approval request
   */
  trackRequest(request: ApprovalRequest): void {
    // Check if already tracked
    if (this.state.pendingRequests.some((p) => p.requestId === request.id)) {
      return;
    }

    // Calculate SLA deadline hours (5 business days = 120 hours)
    const slaDeadlineHours = 24 * 5;

    const tracked: TrackedApprovalRequest = {
      requestId: request.id,
      category: request.category,
      priority: request.priority,
      amount: request.amount,
      currency: request.currency,
      approverRoleKeys: request.approvalChain.map((e) => e.approverRoleKey),
      slaDeadlineHours,
      requestedAt: request.requestedAt,
    };

    this.state.pendingRequests.push(tracked);

    // Update approver capacity tracking
    for (const entry of request.approvalChain) {
      if (entry.status === "pending") {
        this.incrementApproverPending(entry.approverRoleKey);
      }
    }
  }

  /**
   * Record an approval decision
   */
  recordApprovalDecision(params: {
    requestId: string;
    approverRoleKey: string;
    decision: "approved" | "rejected" | "exception" | "delegated";
    decidedAt: string;
    durationHours?: number;
  }): void {
    const tracked = this.state.pendingRequests.find((p) => p.requestId === params.requestId);

    // Calculate duration if not provided
    let durationHours = params.durationHours ?? 0;
    if (durationHours === 0 && tracked) {
      const requestedAt = new Date(tracked.requestedAt);
      const decidedAt = new Date(params.decidedAt);
      durationHours = (decidedAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
    }

    // Add to historical approvals
    const historical: HistoricalApproval = {
      requestId: params.requestId,
      approverRoleKey: params.approverRoleKey,
      decision: params.decision,
      decidedAt: params.decidedAt,
      durationHours,
    };
    this.state.historicalApprovals.push(historical);

    // Update approver capacity
    this.decrementApproverPending(params.approverRoleKey);
    if (params.decision === "approved" || params.decision === "rejected") {
      this.updateAvgApprovalTime(params.approverRoleKey, durationHours);
    }

    // Remove from pending if final decision
    if (params.decision === "approved" || params.decision === "rejected") {
      const idx = this.state.pendingRequests.findIndex((p) => p.requestId === params.requestId);
      if (idx !== -1) {
        this.state.pendingRequests.splice(idx, 1);
      }
    }
  }

  /**
   * Get recommendation for the next best approver
   */
  getRecommendation(requestId: string): ApprovalRecommendation | null {
    const tracked = this.state.pendingRequests.find((p) => p.requestId === requestId);
    if (!tracked) return null;

    const approverKeys = tracked.approverRoleKeys;
    const riskContext = this.getRiskContext(requestId);

    if (approverKeys.length === 0) return null;

    // Find the best approver based on capacity
    // For critical/high priority, prefer fastest approver (lowest avg time)
    // Otherwise, prefer least utilized
    let bestApprover = approverKeys[0];
    let bestScore = Infinity;

    const isUrgent = tracked.priority === "critical" || tracked.priority === "high";

    for (const approverKey of approverKeys) {
      const capacity = this.state.approverCapacity[approverKey];
      if (!capacity) {
        bestApprover = approverKey;
        break;
      }

      // For urgent requests, prefer fastest (lowest avg approval time)
      // For normal requests, prefer lowest utilization
      let score: number;
      if (isUrgent) {
        score = capacity.avgApprovalTimeHours;
      } else {
        score = capacity.utilizationPercent;
      }

      if (score < bestScore) {
        bestScore = score;
        bestApprover = approverKey;
      }
    }

    const capacity = this.state.approverCapacity[bestApprover];
    const reasoning = capacity
      ? isUrgent
        ? `Based on ${capacity.avgApprovalTimeHours}h avg approval time (urgent priority)`
        : `Based on ${capacity.utilizationPercent}% utilization`
      : "Based on workload distribution";

    return {
      requestId,
      suggestedApprover: bestApprover,
      confidence: 0.75,
      reasoning,
      riskContext: riskContext!,
      priorityFactors: this.getPriorityFactors(tracked),
    };
  }

  /**
   * Get risk context for a request
   */
  getRiskContext(requestId: string): ApprovalRiskContext | null {
    const tracked = this.state.pendingRequests.find((p) => p.requestId === requestId);
    if (!tracked) return null;

    // Calculate days in queue
    const requestedAt = new Date(tracked.requestedAt);
    const now = new Date();
    const daysInQueue = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Default control boundary based on amount
    let controlLevel: ControlBoundaryLevel = "standard";
    if (tracked.amount && tracked.amount >= 100000) {
      controlLevel = "restricted";
    } else if (tracked.amount && tracked.amount >= 50000) {
      controlLevel = "elevated";
    }

    const riskScore = calculateRiskScore({
      amount: tracked.amount,
      priority: tracked.priority,
      controlBoundaryLevel: controlLevel,
      requiresSecondApproval: true, // Most requests require this
      hasExceptions: false,
      daysInQueue: Math.floor(daysInQueue),
      evidenceCompleteness: 100, // Default
    });

    return {
      riskScore,
      isHighValue: (tracked.amount ?? 0) >= 50000,
      controlBoundaryLevel: controlLevel,
      requiresSecondApproval: true,
      segregationRisk: false,
      exceptionCount: 0,
      urgencyLevel: tracked.priority,
    };
  }

  /**
   * Suggest delegation for an overloaded approver
   */
  suggestOptimalDelegation(
    approverRoleKey: string,
    options?: { slaDeadlineHours?: number; isBusinessCritical?: boolean }
  ): DelegationSuggestion | null {
    const capacity = this.state.approverCapacity[approverRoleKey];
    if (!capacity) return null;

    // If utilization is low, no delegation needed
    if (capacity.utilizationPercent < 70) return null;

    // Find pending requests for this approver
    const pendingForApprover = this.state.pendingRequests.filter((p) =>
      p.approverRoleKeys.includes(approverRoleKey)
    );

    // Find alternative approvers from same pending requests
    const alternativeSet = new Set<string>();
    for (const pending of pendingForApprover) {
      for (const key of pending.approverRoleKeys) {
        if (key !== approverRoleKey) {
          alternativeSet.add(key);
        }
      }
    }

    // Find best alternative
    let bestAlternative: string | null = null;
    let bestScore = Infinity;

    for (const altKey of alternativeSet) {
      const altCapacity = this.state.approverCapacity[altKey];
      if (altCapacity && altCapacity.utilizationPercent < bestScore) {
        bestScore = altCapacity.utilizationPercent;
        bestAlternative = altKey;
      }
    }

    if (!bestAlternative) return null;

    const altCapacity = this.state.approverCapacity[bestAlternative];
    const loadDiff = capacity.utilizationPercent - (altCapacity?.utilizationPercent ?? 0);

    // Determine urgency
    let urgency: ApprovalPriority = "medium";
    if (options?.isBusinessCritical || (options?.slaDeadlineHours ?? 120) <= 4) {
      urgency = "critical";
    } else if (capacity.utilizationPercent >= 95) {
      urgency = "high";
    }

    const timeSaved = loadDiff > 0 ? (loadDiff / 100) * capacity.avgApprovalTimeHours * pendingForApprover.length : 0;

    return {
      fromRoleKey: approverRoleKey,
      suggestedDelegate: bestAlternative,
      confidence: Math.min(loadDiff / 40, 1),
      reasoning: `Approver at ${capacity.utilizationPercent}% utilization with ${pendingForApprover.length} pending items. ${bestAlternative} at ${altCapacity?.utilizationPercent ?? 0}% can handle more.`,
      urgency,
      estimatedTimeSavedHours: timeSaved > 0 ? timeSaved : undefined,
    };
  }

  /**
   * Predict bottlenecks in the approval pipeline
   */
  predictBottleneck(): BottleneckPrediction[] {
    const bottlenecks: BottleneckPrediction[] = [];

    for (const [approverKey, capacity] of Object.entries(this.state.approverCapacity)) {
      if (capacity.utilizationPercent >= 80) {
        // Find pending requests for this approver
        const pendingForApprover = this.state.pendingRequests.filter((p) =>
          p.approverRoleKeys.includes(approverKey)
        );

        if (pendingForApprover.length >= 3) {
          // Predict delay
          const queueLength = pendingForApprover.length;
          const avgTime = capacity.avgApprovalTimeHours || 4;
          const predictedDelay = queueLength * avgTime;
          const maxSla = Math.max(...pendingForApprover.map((p) => p.slaDeadlineHours));
          const slaAtRisk = predictedDelay > maxSla;

          bottlenecks.push({
            approverRoleKey: approverKey,
            currentLoad: capacity.utilizationPercent,
            predictedDelayHours: predictedDelay,
            slaAtRisk,
            pendingRequestCount: pendingForApprover.length,
            reason:
              capacity.utilizationPercent >= 95
                ? "Critically overloaded"
                : "High utilization with significant queue",
          });
        }
      }
    }

    // Sort by load descending
    return bottlenecks.sort((a, b) => b.currentLoad - a.currentLoad);
  }

  /**
   * Get pipeline analytics
   */
  getPipelineAnalytics(): PipelineAnalytics {
    const totalPending = this.state.pendingRequests.length;

    // Calculate avg time in queue
    let totalQueueTime = 0;
    const now = new Date();
    for (const pending of this.state.pendingRequests) {
      const requestedAt = new Date(pending.requestedAt);
      totalQueueTime += (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
    }
    const avgTimeInQueueHours = totalPending > 0 ? totalQueueTime / totalPending : 0;

    // Calculate approval rate
    const totalDecisions = this.state.historicalApprovals.length;
    const approvals = this.state.historicalApprovals.filter((h) => h.decision === "approved").length;
    const approvalRate = totalDecisions > 0 ? (approvals / totalDecisions) * 100 : 0;

    // Find top bottlenecks
    const bottleneckMap: Record<string, { load: number; count: number }> = {};
    for (const pending of this.state.pendingRequests) {
      for (const approverKey of pending.approverRoleKeys) {
        if (!bottleneckMap[approverKey]) {
          const cap = this.state.approverCapacity[approverKey];
          bottleneckMap[approverKey] = {
            load: cap?.utilizationPercent ?? 0,
            count: 0,
          };
        }
        bottleneckMap[approverKey].count++;
      }
    }

    const topBottlenecks = Object.entries(bottleneckMap)
      .filter(([, data]) => data.load >= 50)
      .sort((a, b) => b[1].load - a[1].load)
      .slice(0, 5)
      .map(([key, data]) => ({
        approverRoleKey: key,
        loadPercent: data.load,
        pendingCount: data.count,
      }));

    // Category breakdown
    const categoryBreakdown: Record<ApprovalCategory, number> = {
      expense: 0,
      purchase: 0,
      budget: 0,
      contract: 0,
      refund: 0,
      adjustment: 0,
      other: 0,
    };
    for (const pending of this.state.pendingRequests) {
      categoryBreakdown[pending.category]++;
    }

    // Priority breakdown
    const priorityBreakdown: Record<ApprovalPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const pending of this.state.pendingRequests) {
      priorityBreakdown[pending.priority]++;
    }

    return {
      totalPending,
      avgTimeInQueueHours,
      approvalRate,
      topBottlenecks,
      categoryBreakdown,
      priorityBreakdown,
    };
  }

  /**
   * Get approver capacity
   */
  getApproverCapacity(approverRoleKey: string): ApproverCapacity | null {
    return this.state.approverCapacity[approverRoleKey] ?? null;
  }

  /**
   * Update approver capacity
   */
  updateApproverCapacity(approverRoleKey: string, capacity: Partial<ApproverCapacity>): void {
    if (!this.state.approverCapacity[approverRoleKey]) {
      this.state.approverCapacity[approverRoleKey] = {
        pendingCount: 0,
        avgApprovalTimeHours: 4,
        utilizationPercent: 0,
      };
    }
    this.state.approverCapacity[approverRoleKey] = {
      ...this.state.approverCapacity[approverRoleKey],
      ...capacity,
    };
  }

  /**
   * Clear resolved requests from tracking
   */
  clearResolvedRequests(): void {
    // Requests are already removed when final decision is recorded
    // This method is for cleanup if needed
    this.state.pendingRequests = this.state.pendingRequests.filter((p) =>
      this.state.historicalApprovals.every((h) => h.requestId !== p.requestId)
    );
  }

  // ============================================
  // Private Methods
  // ============================================

  private incrementApproverPending(approverRoleKey: string): void {
    if (!this.state.approverCapacity[approverRoleKey]) {
      this.state.approverCapacity[approverRoleKey] = {
        pendingCount: 0,
        avgApprovalTimeHours: 4,
        utilizationPercent: 0,
      };
    }
    this.state.approverCapacity[approverRoleKey].pendingCount++;
    this.updateUtilization(approverRoleKey);
  }

  private decrementApproverPending(approverRoleKey: string): void {
    const capacity = this.state.approverCapacity[approverRoleKey];
    if (capacity && capacity.pendingCount > 0) {
      capacity.pendingCount--;
      this.updateUtilization(approverRoleKey);
    }
  }

  private updateUtilization(approverRoleKey: string): void {
    const capacity = this.state.approverCapacity[approverRoleKey];
    if (capacity) {
      // Utilization based on pending count (assuming max of 10 is 100%)
      capacity.utilizationPercent = Math.min(capacity.pendingCount * 10, 100);
    }
  }

  private updateAvgApprovalTime(approverRoleKey: string, durationHours: number): void {
    const capacity = this.state.approverCapacity[approverRoleKey];
    if (capacity) {
      const recentApprovals = capacity.recentApprovals ?? 0;
      const currentAvg = capacity.avgApprovalTimeHours;
      // Rolling average
      capacity.avgApprovalTimeHours =
        (currentAvg * recentApprovals + durationHours) / (recentApprovals + 1);
      capacity.recentApprovals = recentApprovals + 1;
    }
  }

  private getPriorityFactors(tracked: TrackedApprovalRequest): string[] {
    const factors: string[] = [];

    if (tracked.priority === "critical") {
      factors.push("Critical priority requires fastest available approver");
    }
    if (tracked.priority === "high") {
      factors.push("High priority request");
    }
    if (tracked.amount && tracked.amount >= 50000) {
      factors.push("High-value transaction requires additional scrutiny");
    }
    if (tracked.amount && tracked.amount >= 100000) {
      factors.push("Very high-value transaction - restricted controls apply");
    }

    return factors;
  }
}
