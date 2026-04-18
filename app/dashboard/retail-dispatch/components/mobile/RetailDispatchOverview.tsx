import { Card } from "../ui";
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
  status === "Completed" ? "Shipped" : "Ready to ship";

export default function RetailDispatchOverviewMobile({
  stats,
  statsDate,
  searchQuery,
  dispatches,
  canCreatePacking,
  canCreateDispatch,
  canViewDispatch,
  canViewBox,
  onStatsDateChange,
  onSearchQueryChange,
  onClearSearch,
  onNavigate,
}: RetailDispatchOverviewProps) {
  const quickActions = [
    { label: "Create Packing", sublabel: "Build a new list", color: "#6366f1", view: "create-packing-list" as const, enabled: canCreatePacking },
    { label: "Create Dispatch", sublabel: "Assign shipment", color: "#0f766e", view: "create-dispatch-list" as const, enabled: canCreateDispatch },
    { label: "Dispatch History", sublabel: "Review shipped lists", color: "#1d4ed8", view: "all-dispatch-lists" as const, enabled: canViewDispatch },
    { label: "Box Management", sublabel: "Track retail boxes", color: "#ea580c", view: "box-management" as const, enabled: canViewBox },
  ].filter((action) => action.enabled);

  return (
    <div className="animate-in fade-in duration-300" style={{ display: "grid", gap: 16 }}>
      <Card style={{ padding: 14, background: "#fff", boxShadow: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {[
            { label: "Today Packing", value: stats.todayPacking, tone: "#6366f1" },
            { label: "Today Dispatch", value: stats.todayDispatch, tone: "#10b981" },
            { label: "Total Dispatch", value: stats.totalDispatch, tone: "#3b82f6" },
            { label: "Pending Orders", value: stats.pending, tone: "#f59e0b" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "14px 14px 12px", display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: item.tone, flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, fontFamily: FONT }}>
                  {item.label}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1, color: "#0f172a", fontFamily: FONT }}>{item.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 16, display: "grid", gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", fontFamily: FONT }}>Quick filters</div>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, minWidth: 0, flex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="no-focus-ring"
              type="text"
              value={searchQuery}
              placeholder="Search dispatch / LR"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#0f172a", fontFamily: FONT, minWidth: 0 }}
            />
            {searchQuery && (
              <button onClick={onClearSearch} style={{ border: "none", background: "transparent", color: "#6366f1", fontSize: 12, fontWeight: 600, padding: 0, fontFamily: FONT, whiteSpace: "nowrap" }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, width: 128, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <input
              type="date"
              value={statsDate}
              onChange={(event) => onStatsDateChange(event.target.value)}
              aria-label="Dispatch date"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12, color: "#0f172a", fontWeight: 600, fontFamily: FONT, minWidth: 0 }}
            />
          </div>
        </div>
      </Card>

      {quickActions.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ padding: "0 2px", fontSize: 16, fontWeight: 600, color: "#0f172a", fontFamily: FONT }}>Quick actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                style={{ textAlign: "left", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 18, padding: 14, display: "grid", gap: 10, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)" }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: `${action.color}14`, color: action.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 999, background: action.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 3, fontFamily: FONT }}>{action.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, fontFamily: FONT }}>{action.sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 2px" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 4, fontFamily: FONT }}>Recent dispatches</div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, fontFamily: FONT }}>
              Showing activity for {statsDate}
            </div>
          </div>
          {canViewDispatch && (
            <button onClick={() => onNavigate("all-dispatch-lists")} style={{ border: "none", background: "transparent", color: "#6366f1", fontSize: 12, fontWeight: 600, padding: 0, fontFamily: FONT }}>
              View all
            </button>
          )}
        </div>

        {dispatches.length === 0 && (
          <Card style={{ padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6, fontFamily: FONT }}>No dispatches for this date</div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, fontFamily: FONT }}>
              Try another date or clear the search to see more dispatch activity.
            </div>
          </Card>
        )}

        {dispatches.map((dispatch) => {
          const totalUnits = dispatch.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
          const statusColor = dispatch.status === "Completed" ? "#10b981" : "#f59e0b";

          return (
            <Card key={dispatch.id} style={{ padding: 16, display: "grid", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 6, fontFamily: FONT }}>
                    Dispatch
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", lineHeight: 1.1, fontFamily: FONT }}>
                    #{dispatch.dispatchId || dispatch.id.slice(-6).toUpperCase()}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontFamily: FONT }}>
                    {formatDispatchDate(dispatch.dispatchedAt)}
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "8px 12px", background: `${statusColor}14`, color: statusColor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT }}>
                  {getDispatchLabel(dispatch.status)}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4, fontFamily: FONT }}>
                    Party
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 2, fontFamily: FONT }}>{dispatch.partyName}</div>
                </div>

                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                  {[
                    { label: "LR", value: dispatch.lrNo || "Pending" },
                    { label: "Units", value: totalUnits },
                    { label: "Items", value: dispatch.items?.length || 0 },
                    { label: "Pack", value: dispatch.bails || 0 },
                  ].map((metric) => (
                    <div key={metric.label} style={{ minWidth: 84, flex: "0 0 auto", padding: "10px 10px", borderRadius: 14, background: "#fff", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{metric.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: FONT, whiteSpace: "nowrap" }}>{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
