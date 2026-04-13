/**
 * ML-powered approval routing with cost/risk-aware decisioning.
 */
export interface RoutingDecision {
  approverId: string;
  confidence: number;
  reasoning: string;
  predictedOutcome: "approve" | "deny" | "escalate";
  predictedDays: number;
  riskFlags: string[];
}

export class ApprovalRouter {
  route(params: {
    request: { id: string; amount: number; category: string; requesterRole: string; description?: string };
    availableApprovers: Array<{ id: string; role: string; maxAmount: number; currentLoad: number }>;
    requesterHistory: Array<{ approved: boolean; amount: number; approverId: string }>;
    segregationMatrix: Record<string, string[]>;
  }): RoutingDecision {
    const { request, availableApprovers, requesterHistory, segregationMatrix } = params;
    const blockedRoles = segregationMatrix[request.requesterRole] ?? [];
    const eligible = availableApprovers.filter(a => !blockedRoles.includes(a.role) && request.amount <= a.maxAmount);
    if (eligible.length === 0) return { approverId: "", confidence: 0, reasoning: "No eligible approvers", predictedOutcome: "escalate", predictedDays: 5, riskFlags: ["no_approver"] };
    const scored = eligible.map(a => {
      const history = requesterHistory.filter(h => h.approverId === a.id);
      const approvalRate = history.length > 0 ? history.filter(h => h.approved).length / history.length : 0.8;
      const workloadScore = Math.max(0, 1 - a.currentLoad / 10);
      const amountFit = 1 - request.amount / a.maxAmount;
      return { id: a.id, score: approvalRate * 0.5 + workloadScore * 0.3 + amountFit * 0.2, approvalRate, days: history.length > 0 ? 2 : 1 };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const riskFlags: string[] = [];
    if (request.amount > 50000) riskFlags.push("high_value");
    if (request.category === "refund") riskFlags.push("refund_category");
    if (requesterHistory.filter(h => !h.approved).length > 2) riskFlags.push("poor_history");
    return {
      approverId: best.id,
      confidence: best.score,
      reasoning: `Score ${best.score.toFixed(2)}: ${(best.approvalRate * 100).toFixed(0)}% rate`,
      predictedOutcome: best.score > 0.7 ? "approve" : best.score > 0.5 ? "approve" : "deny",
      predictedDays: best.days + (riskFlags.length > 0 ? 1 : 0),
      riskFlags,
    };
  }
}
