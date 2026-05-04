import NotificationBell from "../../../../components/NotificationBell";
import { Card, PageHeader } from "../ui";
import type { RetailDispatchOverviewProps } from "../overviewTypes";

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

const formatDispatchDate = (timestamp?: number) => {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const getDispatchLabel = (status: string) =>
  status === "Completed" ? "Shipped" : "Ready";

export default function RetailDispatchOverviewDesktop({
  stats,
  statsDate,
  searchQuery,
  dispatches,
  canViewDispatch,
  onStatsDateChange,
  onSearchQueryChange,
  onClearSearch,
  onNavigate,
  onOrderStatusNavigate,
}: RetailDispatchOverviewProps) {
  return (
    <div className="animate-in fade-in duration-300">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageHeader title="Retail Dispatch" sub="Manage and track your retail fulfillment pipeline." />
        <NotificationBell />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Today's Packing", value: stats.todayPacking, color: "#6366f1", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg> },
          { label: "Today's Dispatch", value: stats.todayDispatch, color: "#10b981", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg> },
          { label: "Total Dispatch", value: stats.totalDispatch, color: "#3b82f6", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
          { label: "Pending Orders", value: stats.pending, color: "#f59e0b", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
        ].map((stat) => (
          <Card key={stat.label} style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${stat.color}10`, color: stat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{stat.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#1e293b" }}>{stat.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 320, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="no-focus-ring"
              type="text"
              value={searchQuery}
              placeholder="Search dispatch, party, or LR"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}
            />
            {searchQuery && (
              <button onClick={onClearSearch} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
                Clear
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Pending", "Packed", "Dispatched"].map((status) => (
              <button
                key={status}
                onClick={() => onOrderStatusNavigate(status as "Pending" | "Packed" | "Dispatched")}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden", minHeight: 450 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            Recent Dispatches
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", padding: "6px 10px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", fontFamily: FONT }}>DATE:</span>
              <input
                type="date"
                value={statsDate}
                onChange={(event) => onStatsDateChange(event.target.value)}
                style={{ fontSize: 12, border: "none", background: "transparent", outline: "none", color: "#1e293b", fontWeight: 600, fontFamily: FONT }}
              />
            </div>
            {canViewDispatch && (
              <button onClick={() => onNavigate("all-dispatch-lists")} style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FONT }}>
                View All History
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Dispatch ID", "Party Name", "Units", "Items", "Pkg", "Status", "LR No."].map((heading) => (
                  <th key={heading} style={{ padding: "14px 24px", textAlign: heading === "LR No." ? "right" : (heading === "Items" || heading === "Pkg" || heading === "Status" || heading === "Units") ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", fontFamily: FONT }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatches.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "80px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14, fontFamily: FONT }}>
                    No retail dispatches found in the last 7 days (ending {statsDate}).
                  </td>
                </tr>
              )}
              {dispatches.map((dispatch) => {
                const totalUnits = dispatch.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                const statusColor = dispatch.status === "Completed" ? "#10b981" : "#f59e0b";
                return (
                  <tr key={dispatch.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: FONT }}>
                      #{dispatch.dispatchId || dispatch.id.slice(-6).toUpperCase()}
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>
                        {formatDispatchDate(dispatch.dispatchedAt)}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{dispatch.partyName}</td>
                    <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "center", fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{totalUnits}</td>
                    <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "center", color: "#475569", fontFamily: FONT }}>{dispatch.items?.length || 0}</td>
                    <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600, textAlign: "center", color: "#1e293b", fontFamily: FONT }}>{dispatch.bails || 0}</td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 88, padding: "6px 12px", borderRadius: 999, background: `${statusColor}14`, color: statusColor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT }}>
                        {getDispatchLabel(dispatch.status)}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "right", fontWeight: 600, fontFamily: FONT, color: dispatch.lrNo ? "#1e293b" : "#94a3b8" }}>
                      {dispatch.lrNo || "Pending"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
