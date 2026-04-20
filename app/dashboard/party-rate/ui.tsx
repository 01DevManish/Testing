import React from "react";

export const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ── Input ──────────────────────────────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            style={{
                width: "100%", padding: "10px 13px",
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 9, color: "#1e293b", fontSize: 13,
                fontFamily: FONT, outline: "none", boxSizing: "border-box",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em", fontFamily: FONT }}>{title}</h1>
                {sub && <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", fontFamily: FONT }}>{sub}</p>}
            </div>
            {children && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: "auto", maxWidth: "100%" }}>{children}</div>}
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

// ── Modal Styles ───────────────────────────────────────────────
export const modalOverlayStyles: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.3)",
    backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, padding: 20, animation: "fadeIn 0.2s ease-out"
};

export const modalCardStyles: React.CSSProperties = {
    background: "#fff", borderRadius: 24, width: "100%", maxWidth: 640,
    maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -6px rgba(0,0,0,0.04)",
    animation: "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
};
