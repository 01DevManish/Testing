/* ── ERM Leads – Premium CRM Styles ── */
import React from "react";

/* ── Shared style objects ── */
export const crmCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.03)",
  transition: "box-shadow 0.2s ease",
};

export const crmInput: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  background: "#f8fafc",
  color: "#0f172a",
  transition: "border-color 0.15s, box-shadow 0.15s",
  width: "100%",
  boxSizing: "border-box",
};

export const crmSelect: React.CSSProperties = {
  ...crmInput,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 32,
  cursor: "pointer",
};

export const crmBtnPrimary: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s, transform 0.1s",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

export const crmBtnSecondary: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#334155",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

export const crmBtnGhost: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#6366f1",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

export const crmLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

export const crmTh: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  padding: "10px 12px",
  borderBottom: "2px solid #e2e8f0",
  background: "#f8fafc",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

export const crmTd: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  color: "#1e293b",
  verticalAlign: "middle",
};

export const crmOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.5)",
  backdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 16px",
  overflowY: "auto",
};

export const crmModalBox: React.CSSProperties = {
  width: "min(780px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
  overflow: "hidden",
};
