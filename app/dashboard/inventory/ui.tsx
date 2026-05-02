import React from "react";
import { FONT } from "./types";

// ── Input ──────────────────────────────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const isNumberField = props.type === "number";
    const mergedClassName = `${props.className || ""}${isNumberField ? " no-number-spinner" : ""}`.trim();
    return (
        <input
            {...props}
            className={mergedClassName}
            style={{
                width: "100%", padding: "10px 13px",
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 9, color: "#1e293b", fontSize: 13,
                fontFamily: FONT, outline: "none", boxSizing: "border-box",
                ...(isNumberField
                    ? {
                        appearance: "textfield" as const,
                        MozAppearance: "textfield" as const,
                    }
                    : {}),
                ...props.style,
            }}
        />
    );
}

// ── Textarea ───────────────────────────────────────────────────
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            style={{
                width: "100%", padding: "10px 13px",
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 9, color: "#1e293b", fontSize: 13,
                fontFamily: FONT, outline: "none", boxSizing: "border-box",
                resize: "vertical",
                ...props.style,
            }}
        />
    );
}

// ── Select ─────────────────────────────────────────────────────
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
    return (
        <select
            {...props}
            style={{
                width: "100%", padding: "10px 13px",
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 9, color: "#1e293b", fontSize: 13,
                fontFamily: FONT, outline: "none", boxSizing: "border-box",
                cursor: "pointer",
                ...props.style,
            }}
        >
            {props.children}
        </select>
    );
}

// ── Label ──────────────────────────────────────────────────────
export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label style={{ display: "block", fontSize: 12, fontWeight: 400, color: "#64748b", marginBottom: 5, fontFamily: FONT }}>
            {children}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </label>
    );
}

// ── FormField ──────────────────────────────────────────────────
export function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <Label required={required}>{label}</Label>
            {children}
        </div>
    );
}

// ── Section divider ────────────────────────────────────────────
export function SectionDivider({ title }: { title: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: FONT, whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>
    );
}

// ── Primary Button ─────────────────────────────────────────────
export function BtnPrimary({ children, loading, disabled, onClick, style }: {
    children: React.ReactNode; loading?: boolean; disabled?: boolean;
    onClick?: () => void; style?: React.CSSProperties;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                padding: "10px 22px", background: "#6366f1", color: "#fff",
                border: "none", borderRadius: 9, fontSize: 13, fontWeight: 400,
                fontFamily: FONT, cursor: disabled || loading ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 7,
                opacity: disabled || loading ? 0.5 : 1, transition: "opacity 0.2s",
                ...style,
            }}
        >
            {loading && (
                <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin-slow 0.7s linear infinite" }} />
            )}
            {children}
        </button>
    );
}

// ── Secondary Button ───────────────────────────────────────────
export function BtnSecondary({ children, loading, disabled, onClick, style }: {
    children: React.ReactNode; loading?: boolean; disabled?: boolean;
    onClick?: () => void; style?: React.CSSProperties;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                padding: "10px 20px", background: "#f8fafc", color: "#475569",
                border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, fontWeight: 500,
                fontFamily: FONT, cursor: disabled || loading ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 7,
                opacity: disabled || loading ? 0.6 : 1, transition: "0.2s",
                ...style,
            }}
        >
            {loading && (
                <span style={{ width: 13, height: 13, border: "2px solid rgba(0,0,0,0.1)", borderTopColor: "#6366f1", borderRadius: "50%", display: "inline-block", animation: "spin-slow 0.7s linear infinite" }} />
            )}
            {children}
        </button>
    );
}

// ── Ghost Button ───────────────────────────────────────────────
export function BtnGhost({ children, onClick, style, disabled }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "10px 18px", background: "#fff", color: "#475569",
                border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13,
                fontWeight: 400, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                opacity: disabled ? 0.6 : 1,
                ...style,
            }}
        >
            {children}
        </button>
    );
}

// ── Page header ────────────────────────────────────────────────
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 12 }}>
            <div>
                <h1 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em", fontFamily: FONT }}>{title}</h1>
                {sub && <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", fontFamily: FONT }}>{sub}</p>}
            </div>
            {children && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{children}</div>}
        </div>
    );
}

// ── Empty state ────────────────────────────────────────────────
export function EmptyState({ title, sub }: { title: string; sub: string }) {
    return (
        <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.85)" />
                    <rect x="11" y="2" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />
                    <rect x="2" y="11" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />
                    <rect x="11" y="11" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.25)" />
                </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 400, color: "#475569", marginBottom: 5, fontFamily: FONT }}>{title}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: FONT }}>{sub}</div>
        </div>
    );
}

// ── Card wrapper ───────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            ...style,
        }}>
            {children}
        </div>
    );
}

// ── Badge ──────────────────────────────────────────────────────
export function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 9px", borderRadius: 20,
            fontSize: 11, fontWeight: 400, color, background: bg,
            border: `1px solid ${color}20`, whiteSpace: "nowrap",
            fontFamily: FONT,
        }}>
            {children}
        </span>
    );
}

// ── Spinner ────────────────────────────────────────────────────
export function Spinner() {
    return (
        <div style={{ padding: "52px 20px", textAlign: "center", color: "#64748b", fontSize: 13, fontFamily: FONT }}>
            <div style={{ width: 26, height: 26, margin: "0 auto 10px", border: "2.5px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
            Loading...
        </div>
    );
}

// ── Success toast-style banner ─────────────────────────────────
export function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#22c55e" />
                <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ flex: 1, fontSize: 13, color: "#15803d", fontWeight: 400, fontFamily: FONT }}>{message}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#16a34a", padding: 0, display: "flex" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
        </div>
    );
}
