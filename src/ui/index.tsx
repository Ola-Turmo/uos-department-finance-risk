import * as React from "react";
import { usePluginAction, usePluginData, type PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";

type HealthData = {
  status: "ok" | "degraded" | "error" | "unknown";
  checkedAt: string;
};

function formatHealthStatus(status?: HealthData["status"]) {
  if (status === "unknown" || !status) return "not yet verified";
  return status;
}

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data, loading, error } = usePluginData<HealthData>("health");
  const ping = usePluginAction("ping");
  const verifyConnectors = usePluginAction("connector.checkHealth");

  if (loading) return <div>Loading plugin health...</div>;
  if (error) return <div>Plugin error: {error.message}</div>;

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <strong>Department Finance Risk</strong>
      <div>Health: {formatHealthStatus(data?.status)}</div>
      <div>Checked: {data?.checkedAt ?? "never"}</div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={() => void ping()}>Ping Worker</button>
        <button onClick={() => void verifyConnectors({})}>Verify Connectors</button>
      </div>
    </div>
  );
}
