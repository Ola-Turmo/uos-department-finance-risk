import { describe, expect, it } from "vitest";
import { connectors, department, jobs, roles, skills } from "../src";

describe("@uos/department-finance-risk", () => {
  it("captures the finance-risk department boundary", () => {
    expect(department.departmentId).toBe("finance-risk");
    expect(department.parentFunctionId).toBe("finance-risk");
    expect(department.moduleId).toBeNull();
  });

  it("includes the finance and risk roles", () => {
    expect(roles.some((role) => role.roleKey === "finance-fpa-lead")).toBe(true);
    expect(roles.some((role) => role.roleKey === "risk-compliance-lead")).toBe(true);
    expect(jobs.map((job) => job.jobKey)).toEqual([
      "finance-monthly-review",
      "risk-weekly-exception-review",
    ]);
  });

  it("keeps the finance-risk skills and connectors together", () => {
    expect(skills.bundleIds).toContain("uos-finance-risk");
    expect(skills.externalSkills.some((skill) => skill.id === "kurs-ing-policy-surface-review")).toBe(true);
    expect(connectors.requiredToolkits).toContain("googlesheets");
    expect(connectors.requiredToolkits).toContain("stripe");
    expect(connectors.roleToolkits.some((role) => role.roleKey === "finance-fpa-lead")).toBe(true);
  });
});
