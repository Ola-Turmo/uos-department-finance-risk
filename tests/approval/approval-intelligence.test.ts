/**
 * Approval Intelligence Tests
 * PRD: AI-powered approval recommendations with risk context.
 * Delegation optimization based on approver capacity.
 * Approval pipeline bottleneck prediction.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import {
  ApprovalIntelligence,
  calculateApproverLoad,
  calculateRiskScore,
  predictApprovalTime,
  suggestOptimalDelegation,
  type ApprovalRecommendation,
  type DelegationSuggestion,
  type BottleneckPrediction,
  type ApproverCapacity,
  type ApprovalRiskContext,
  type PipelineAnalytics,
} from "../../src/approval/approval-intelligence.js";
import type { ApprovalRequest, ApprovalRoute, ApprovalChainEntry, ApprovalPriority, ApprovalCategory } from "../../src/types.js";

// Test fixtures
function createMockRoute(overrides: Partial<ApprovalRoute> = {}): ApprovalRoute {
  const now = new Date().toISOString();
  return {
    id: `route-${nanoid(8)}`,
    name: "Test Route",
    category: "expense",
    description: "Test route for unit testing",
    requiredApproverRoleKeys: ["finance-reviewer", "finance-controllership-lead", "finance-director"],
    minimumApprovals: 2,
    controlBoundary: {
      level: "standard",
      description: "Standard control",
      requiresSecondApproval: false,
      escalationRequired: false,
      blockedRoles: [],
    },
    evidenceRequirements: ["receipt", "justification"],
    slaBusinessDays: 5,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockRequest(route: ApprovalRoute, overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  const now = new Date().toISOString();
  return {
    id: `req-${nanoid(8)}`,
    routeId: route.id,
    title: "Test Approval Request",
    description: "Test request for unit testing",
    category: "expense",
    priority: "medium",
    status: "pending",
    requesterRoleKey: "finance-fpa-lead",
    requestedAt: now,
    updatedAt: now,
    amount: 5000,
    currency: "USD",
    evidence: [],
    approvalChain: route.requiredApproverRoleKeys.map((roleKey) => ({
      id: `chain-${nanoid(8)}`,
      approverRoleKey: roleKey,
      status: "pending" as const,
    })),
    disposition: { status: "approved", summary: "" },
    exceptions: [],
    auditTrail: [],
    relatedRequestIds: [],
    ...overrides,
  };
}

describe("ApprovalIntelligence", () => {
  let intelligence: ApprovalIntelligence;

  beforeEach(() => {
    intelligence = new ApprovalIntelligence();
  });

  describe("constructor and initialization", () => {
    it("initializes with empty state", () => {
      expect(intelligence.getState().pendingRequests).toEqual([]);
      expect(intelligence.getState().historicalApprovals).toEqual([]);
      expect(intelligence.getState().approverCapacity).toEqual({});
    });

    it("accepts initial state", () => {
      const initialState = {
        pendingRequests: [],
        historicalApprovals: [
          {
            requestId: "test-1",
            approverRoleKey: "finance-reviewer",
            decision: "approved" as const,
            decidedAt: new Date().toISOString(),
            durationHours: 4,
          },
        ],
        approverCapacity: {
          "finance-reviewer": { pendingCount: 5, avgApprovalTimeHours: 4, utilizationPercent: 50 },
        },
      };
      const intel = new ApprovalIntelligence(initialState);
      expect(intel.getState().historicalApprovals).toHaveLength(1);
      expect(intel.getState().approverCapacity["finance-reviewer"].pendingCount).toBe(5);
    });
  });

  describe("trackRequest", () => {
    it("tracks a new pending approval request", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);

      const state = intelligence.getState();
      expect(state.pendingRequests).toHaveLength(1);
      expect(state.pendingRequests[0].requestId).toBe(request.id);
      expect(state.pendingRequests[0].category).toBe("expense");
      expect(state.pendingRequests[0].priority).toBe("medium");
    });

    it("extracts approver capacity from tracked request", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);

      const state = intelligence.getState();
      const approvers = Object.keys(state.approverCapacity);
      expect(approvers).toContain("finance-reviewer");
      expect(approvers).toContain("finance-controllership-lead");
      expect(approvers).toContain("finance-director");
    });

    it("does not duplicate already-tracked requests", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);
      intelligence.trackRequest(request); // Track twice

      expect(intelligence.getState().pendingRequests).toHaveLength(1);
    });

    it("extracts risk context from request metadata", () => {
      const route = createMockRoute({
        controlBoundary: {
          level: "elevated",
          description: "Elevated risk",
          requiresSecondApproval: true,
          escalationRequired: true,
          blockedRoles: [],
        },
      });
      const request = createMockRequest(route, {
        amount: 50000,
        priority: "critical",
      });

      intelligence.trackRequest(request);

      const riskContext = intelligence.getRiskContext(request.id);
      expect(riskContext).toBeDefined();
      expect(riskContext!.riskScore).toBeGreaterThan(50);
      expect(riskContext!.isHighValue).toBe(true);
      expect(riskContext!.controlBoundaryLevel).toBe("elevated");
    });
  });

  describe("recordApprovalDecision", () => {
    it("records an approval decision and updates capacity metrics", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);

      // Simulate approval by finance-reviewer
      intelligence.recordApprovalDecision({
        requestId: request.id,
        approverRoleKey: "finance-reviewer",
        decision: "approved",
        decidedAt: new Date().toISOString(),
      });

      const state = intelligence.getState();
      expect(state.historicalApprovals).toHaveLength(1);
      expect(state.historicalApprovals[0].decision).toBe("approved");
      expect(state.historicalApprovals[0].durationHours).toBeGreaterThanOrEqual(0);
    });

    it("calculates average approval time per approver", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);

      // First approval
      intelligence.recordApprovalDecision({
        requestId: request.id,
        approverRoleKey: "finance-reviewer",
        decision: "approved",
        decidedAt: new Date().toISOString(),
        durationHours: 2,
      });

      const capacity = intelligence.getApproverCapacity("finance-reviewer");
      expect(capacity?.avgApprovalTimeHours).toBe(2);
      expect(capacity?.pendingCount).toBe(0); // After approving, count should decrease
    });

    it("handles rejection decisions", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);

      intelligence.trackRequest(request);

      intelligence.recordApprovalDecision({
        requestId: request.id,
        approverRoleKey: "finance-reviewer",
        decision: "rejected",
        decidedAt: new Date().toISOString(),
      });

      const state = intelligence.getState();
      expect(state.historicalApprovals[0].decision).toBe("rejected");
    });

    it("removes request from pending when final approval is recorded", () => {
      const route = createMockRoute({ minimumApprovals: 1 });
      const request = createMockRequest(route, {
        approvalChain: [
          { id: "chain-1", approverRoleKey: "finance-reviewer", status: "pending" as const },
        ],
      });

      intelligence.trackRequest(request);
      intelligence.recordApprovalDecision({
        requestId: request.id,
        approverRoleKey: "finance-reviewer",
        decision: "approved",
        decidedAt: new Date().toISOString(),
      });

      expect(intelligence.getState().pendingRequests).toHaveLength(0);
    });
  });

  describe("getRecommendation", () => {
    it("returns recommendation for pending request", () => {
      const route = createMockRoute();
      const request = createMockRequest(route, { priority: "high" });

      intelligence.trackRequest(request);

      const recommendation = intelligence.getRecommendation(request.id);

      expect(recommendation).toBeDefined();
      expect(recommendation!.requestId).toBe(request.id);
      expect(recommendation!.suggestedApprover).toBeDefined();
      expect(recommendation!.confidence).toBeGreaterThan(0);
      expect(recommendation!.reasoning).toBeDefined();
    });

    it("returns null for unknown request", () => {
      const recommendation = intelligence.getRecommendation("unknown-id");
      expect(recommendation).toBeNull();
    });

    it("considers approver capacity in recommendations", () => {
      const route = createMockRoute({
        requiredApproverRoleKeys: ["finance-reviewer", "finance-director"],
      });
      const request = createMockRequest(route);

      // Add some load to finance-reviewer
      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 10,
        avgApprovalTimeHours: 8,
        utilizationPercent: 90,
      });

      intelligence.trackRequest(request);

      const recommendation = intelligence.getRecommendation(request.id);
      // Should recommend finance-director if they have lower load
      expect(recommendation!.suggestedApprover).toBe("finance-director");
    });

    it("recommends fastest approver for urgent requests", () => {
      const route = createMockRoute();
      const request = createMockRequest(route, { priority: "critical" });

      intelligence.trackRequest(request);

      // Add capacity data - finance-reviewer is faster
      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 2,
        avgApprovalTimeHours: 1,
        utilizationPercent: 20,
      });
      intelligence.updateApproverCapacity("finance-controllership-lead", {
        pendingCount: 10,
        avgApprovalTimeHours: 8,
        utilizationPercent: 95,
      });

      const recommendation = intelligence.getRecommendation(request.id);
      // Should recommend faster approver for critical
      expect(recommendation!.suggestedApprover).toBe("finance-reviewer");
    });
  });

  describe("suggestOptimalDelegation", () => {
    it("suggests delegation when approver is overloaded and has alternatives", () => {
      // Set up a route with multiple approvers
      const route = createMockRoute();
      const request = createMockRequest(route);
      intelligence.trackRequest(request);

      // Set finance-reviewer to overloaded
      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 15,
        avgApprovalTimeHours: 12,
        utilizationPercent: 100,
      });

      const suggestion = intelligence.suggestOptimalDelegation("finance-reviewer");

      expect(suggestion).toBeDefined();
      expect(suggestion!.fromRoleKey).toBe("finance-reviewer");
      expect(suggestion!.suggestedDelegate).toBeDefined();
      expect(suggestion!.reasoning).toContain("utilization");
    });

    it("returns null when approver has normal capacity", () => {
      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 2,
        avgApprovalTimeHours: 4,
        utilizationPercent: 30,
      });

      const suggestion = intelligence.suggestOptimalDelegation("finance-reviewer");
      expect(suggestion).toBeNull();
    });

    it("considers SLA urgency when suggesting delegation", () => {
      // Set up a route with multiple approvers
      const route = createMockRoute();
      const request = createMockRequest(route);
      intelligence.trackRequest(request);

      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 8,
        avgApprovalTimeHours: 10,
        utilizationPercent: 80,
      });

      const suggestion = intelligence.suggestOptimalDelegation("finance-reviewer", {
        slaDeadlineHours: 4,
        isBusinessCritical: true,
      });

      expect(suggestion).toBeDefined();
      expect(suggestion!.urgency).toBe("critical");
    });
  });

  describe("predictBottleneck", () => {
    it("identifies bottleneck when approver is overloaded", () => {
      // Need at least 3 requests assigned to the same approver to trigger bottleneck
      const route = createMockRoute({
        requiredApproverRoleKeys: ["finance-reviewer", "finance-controllership-lead"],
      });

      // Track 3 separate requests - each with finance-reviewer as approver
      const request1 = createMockRequest(route);
      const request2 = createMockRequest(route);
      const request3 = createMockRequest(route);
      intelligence.trackRequest(request1);
      intelligence.trackRequest(request2);
      intelligence.trackRequest(request3);

      // Set finance-reviewer to overloaded
      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 10,
        avgApprovalTimeHours: 24,
        utilizationPercent: 100,
      });

      const predictions = intelligence.predictBottleneck();
      expect(predictions).toHaveLength(1);
      expect(predictions[0].approverRoleKey).toBe("finance-reviewer");
      expect(predictions[0].currentLoad).toBeGreaterThan(80);
    });

    it("returns empty array when no bottlenecks", () => {
      const route = createMockRoute();
      const request = createMockRequest(route);
      intelligence.trackRequest(request);

      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 2,
        avgApprovalTimeHours: 4,
        utilizationPercent: 20,
      });

      const predictions = intelligence.predictBottleneck();
      expect(predictions).toHaveLength(0);
    });

    it("includes predicted delay in bottleneck prediction", () => {
      // Need at least 3 requests for bottleneck detection
      const route = createMockRoute({
        requiredApproverRoleKeys: ["finance-reviewer"],
      });
      const request1 = createMockRequest(route);
      const request2 = createMockRequest(route);
      const request3 = createMockRequest(route);
      intelligence.trackRequest(request1);
      intelligence.trackRequest(request2);
      intelligence.trackRequest(request3);

      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 10,
        avgApprovalTimeHours: 48,
        utilizationPercent: 100,
      });

      const predictions = intelligence.predictBottleneck();
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].predictedDelayHours).toBeGreaterThan(0);
      expect(predictions[0].slaAtRisk).toBe(true);
    });
  });

  describe("getPipelineAnalytics", () => {
    it("calculates pipeline analytics", () => {
      const route = createMockRoute();

      // Add some requests
      for (let i = 0; i < 3; i++) {
        const request = createMockRequest(route);
        intelligence.trackRequest(request);
      }

      // Record some approvals
      const pending = intelligence.getState().pendingRequests;
      if (pending.length > 0) {
        intelligence.recordApprovalDecision({
          requestId: pending[0].requestId,
          approverRoleKey: "finance-reviewer",
          decision: "approved",
          decidedAt: new Date().toISOString(),
          durationHours: 3,
        });
      }

      const analytics = intelligence.getPipelineAnalytics();

      expect(analytics.totalPending).toBeGreaterThanOrEqual(0);
      expect(analytics.avgTimeInQueueHours).toBeGreaterThanOrEqual(0);
      expect(analytics.approvalRate).toBeGreaterThanOrEqual(0);
    });

    it("identifies top bottlenecks in analytics", () => {
      // Use route with single approver to have predictable results
      const route = createMockRoute({
        requiredApproverRoleKeys: ["finance-reviewer"],
      });

      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(route);
        intelligence.trackRequest(request);
      }

      intelligence.updateApproverCapacity("finance-reviewer", {
        pendingCount: 10,
        avgApprovalTimeHours: 20,
        utilizationPercent: 95,
      });

      const analytics = intelligence.getPipelineAnalytics();
      expect(analytics.topBottlenecks.length).toBeGreaterThan(0);
      expect(analytics.topBottlenecks[0].approverRoleKey).toBe("finance-reviewer");
    });
  });

  describe("getRiskContext", () => {
    it("extracts risk factors from request", () => {
      const route = createMockRoute({
        controlBoundary: {
          level: "restricted",
          description: "Restricted transactions",
          requiresSecondApproval: true,
          escalationRequired: true,
          blockedRoles: ["executor"],
        },
      });
      const request = createMockRequest(route, {
        amount: 100000,
        priority: "critical",
      });

      intelligence.trackRequest(request);

      const riskContext = intelligence.getRiskContext(request.id);

      expect(riskContext).toBeDefined();
      expect(riskContext!.riskScore).toBeGreaterThanOrEqual(70);
      expect(riskContext!.isHighValue).toBe(true);
      expect(riskContext!.requiresSecondApproval).toBe(true);
      expect(riskContext!.urgencyLevel).toBe("critical");
    });

    it("returns null for unknown request", () => {
      const riskContext = intelligence.getRiskContext("unknown-id");
      expect(riskContext).toBeNull();
    });
  });

  describe("clearResolvedRequests", () => {
    it("clears resolved requests from pending tracking", () => {
      const route = createMockRoute();
      const request1 = createMockRequest(route);
      const request2 = createMockRequest(route);

      intelligence.trackRequest(request1);
      intelligence.trackRequest(request2);

      // Record final approval for request1
      intelligence.recordApprovalDecision({
        requestId: request1.id,
        approverRoleKey: "finance-reviewer",
        decision: "approved",
        decidedAt: new Date().toISOString(),
      });

      intelligence.clearResolvedRequests();

      expect(intelligence.getState().pendingRequests).toHaveLength(1);
      expect(intelligence.getState().pendingRequests[0].requestId).toBe(request2.id);
    });
  });

  describe("static utility functions", () => {
    describe("calculateApproverLoad", () => {
      it("calculates load based on pending count and SLA", () => {
        const pendingRequests: Array<{ priority: ApprovalPriority; slaDeadlineHours: number }> = [
          { priority: "critical", slaDeadlineHours: 4 },
          { priority: "high", slaDeadlineHours: 24 },
          { priority: "medium", slaDeadlineHours: 48 },
          { priority: "low", slaDeadlineHours: 120 },
        ];

        const load = calculateApproverLoad(pendingRequests);
        expect(load.score).toBeGreaterThan(0);
        expect(load.utilizationPercent).toBeGreaterThan(0);
        expect(load.criticalCount).toBe(1);
      });
    });

    describe("calculateRiskScore", () => {
      it("calculates risk score based on request attributes", () => {
        const riskContext = {
          amount: 100000,
          priority: "critical" as ApprovalPriority,
          controlBoundaryLevel: "restricted" as const,
          requiresSecondApproval: true,
          hasExceptions: true,
          daysInQueue: 3,
          evidenceCompleteness: 50,
        };

        const score = calculateRiskScore(riskContext);
        expect(score).toBeGreaterThanOrEqual(50);
      });

      it("returns lower risk for normal requests", () => {
        const riskContext = {
          amount: 500,
          priority: "low" as ApprovalPriority,
          controlBoundaryLevel: "standard" as const,
          requiresSecondApproval: false,
          hasExceptions: false,
          daysInQueue: 1,
          evidenceCompleteness: 100,
        };

        const score = calculateRiskScore(riskContext);
        expect(score).toBeLessThan(30);
      });
    });

    describe("predictApprovalTime", () => {
      it("estimates approval time based on queue length and capacity", () => {
        const queueLength = 5;
        const avgTimePerApproval = 4; // hours
        const slaDeadlineHours = 48;

        const prediction = predictApprovalTime(queueLength, avgTimePerApproval, slaDeadlineHours);
        expect(prediction.estimatedHours).toBe(20);
        expect(prediction.willMeetSLA).toBe(true);
      });

      it("indicates SLA breach when queue is too long", () => {
        const queueLength = 20;
        const avgTimePerApproval = 4; // hours
        const slaDeadlineHours = 48;

        const prediction = predictApprovalTime(queueLength, avgTimePerApproval, slaDeadlineHours);
        expect(prediction.estimatedHours).toBe(80);
        expect(prediction.willMeetSLA).toBe(false);
        expect(prediction.slaBreachHours).toBe(32);
      });
    });

    describe("suggestOptimalDelegation (static)", () => {
      it("suggests delegate based on lower load", () => {
        const currentApprover: ApproverCapacity = {
          pendingCount: 15,
          avgApprovalTimeHours: 10,
          utilizationPercent: 95,
        };
        const alternatives: ApproverCapacity[] = [
          { pendingCount: 3, avgApprovalTimeHours: 5, utilizationPercent: 30 },
          { pendingCount: 1, avgApprovalTimeHours: 2, utilizationPercent: 10 },
        ];

        const suggestion = suggestOptimalDelegation(currentApprover, alternatives);

        expect(suggestion).toBeDefined();
        expect(suggestion!.suggestedDelegate).toBe("best");
        expect(suggestion!.reasoning).toContain("lower utilization");
      });

      it("returns null when no better alternative exists", () => {
        const currentApprover: ApproverCapacity = {
          pendingCount: 2,
          avgApprovalTimeHours: 4,
          utilizationPercent: 20,
        };
        const alternatives: ApproverCapacity[] = [
          { pendingCount: 3, avgApprovalTimeHours: 5, utilizationPercent: 30 },
        ];

        const suggestion = suggestOptimalDelegation(currentApprover, alternatives);
        expect(suggestion).toBeNull();
      });
    });
  });
});
