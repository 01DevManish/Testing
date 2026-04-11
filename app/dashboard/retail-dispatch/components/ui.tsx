import React from "react";
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input {...props} style={{
            width: "100%", padding: "10px 13px",
            background: "#f8fafc", border: "1.5px solid #e2e8f0",
            borderRadius: 0, color: "#1e293b", fontSize: 13,
            fontFamily: FONT, outline: "none", boxSizing: "border-box",
            ...props.style,
        }} />
    );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
    return (
        <select {...props} style={{
            width: "100%", padding: "10px 13px",
            background: "#f8fafc", border: "1.5px solid #e2e8f0",
            borderRadius: 0, color: "#1e293b", fontSize: 13,
            fontFamily: FONT, outline: "none", boxSizing: "border-box",
            cursor: "pointer",
            ...props.style,
        }}>
            {props.children}
        </select>
    );
}

export function BtnPrimary({ children, loading, disabled, onClick, style }: {
    children: React.ReactNode; loading?: boolean; disabled?: boolean;
    onClick?: () => void; style?: React.CSSProperties;
}) {
    return (
        <button onClick={onClick} disabled={disabled || loading} style={{
            padding: "10px 22px", background: "#6366f1", color: "#fff",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 400,
            fontFamily: FONT, cursor: disabled || loading ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 7,
            opacity: disabled || loading ? 0.5 : 1, transition: "opacity 0.2s",
            ...style,
        }}>
            {loading && <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
            {children}
        </button>
    );
}

export function BtnGhost({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
    return (
        <button onClick={onClick} style={{
            padding: "10px 18px", background: "#fff", color: "#475569",
            border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13,
            fontWeight: 400, fontFamily: FONT, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            ...style,
        }}>
            {children}
        </button>
    );
}

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

export function Card({ children, style, onClick, className }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void; className?: string }) {
    return (
        <div 
            onClick={onClick}
            className={className}
            style={{
                background: "#fff", borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                overflow: "hidden",
                cursor: onClick ? "pointer" : "default",
                ...style,
            }}
        >
            {children}
        </div>
    );
}

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

export function Spinner() {
    return (
        <div style={{ padding: "52px 20px", textAlign: "center", color: "#64748b", fontSize: 13, fontFamily: FONT }}>
            <div style={{ width: 26, height: 26, margin: "0 auto 10px", border: "2.5px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
            Loading...
        </div>
    );
}
