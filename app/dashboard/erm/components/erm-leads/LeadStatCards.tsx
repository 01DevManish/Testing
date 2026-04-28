"use client";
import React from "react";
import { crmCard } from "./styles";
import { LeadRecord } from "./types";
import * as Icons from "./Icons";

interface Props {
  leads: LeadRecord[];
  loading: boolean;
}

export default function LeadStatCards({ leads, loading }: Props) {
  const total = leads.length;
  const newCount = leads.filter((l) => l.status === "new").length;
  const interestedCount = leads.filter((l) => l.status === "interested").length;
  const followUpCount = leads.filter((l) => l.status === "follow_up" || l.status === "scheduled" || l.status === "scheduled_meeting").length;
  const wonCount = leads.filter((l) => l.status === "won" || l.status === "ordered").length;

  const cards = [
    { label: "Total Leads", value: total, color: "#4f46e5", bg: "linear-gradient(135deg, #eef2ff, #e0e7ff)", icon: Icons.IconPieChart },
    { label: "New Leads", value: newCount, color: "#ea580c", bg: "linear-gradient(135deg, #fff7ed, #ffedd5)", icon: Icons.IconFlame },
    { label: "Interested", value: interestedCount, color: "#059669", bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)", icon: Icons.IconCheck },
    { label: "Follow Up", value: followUpCount, color: "#d97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", icon: Icons.IconRefresh },
    { label: "Won / Ordered", value: wonCount, color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", icon: Icons.IconTrophy },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, width: "100%", minWidth: 0 }}>
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            style={{
              ...crmCard,
              background: c.bg,
              borderColor: `${c.color}18`,
              padding: "20px 24px",
              position: "relative",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <Icon size={24} color={c.color} strokeWidth={2.5} />
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>
              {loading ? "—" : c.value}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {c.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
