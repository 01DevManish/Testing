import React from "react";

const SIDEBAR_WIDTH = 240;

export function getStyles(isMobile: boolean, isTablet: boolean, isDesktop: boolean, sidebarOpen: boolean) {
  return {
    page: {
      display: "flex",
      minHeight: "100vh",
      fontFamily: "inherit",
      background: "#f8fafc",
    } as React.CSSProperties,

    sidebar: {
      width: SIDEBAR_WIDTH,
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      display: "flex",
      flexDirection: "column" as const,
      padding: "20px 14px",
      position: "fixed" as const,
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 200,
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      overflowY: "auto" as const,
      transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
    } as React.CSSProperties,

    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 199,
      backdropFilter: "blur(4px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,

    main: {
      flex: 1,
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
      padding: isMobile ? "16px 14px 24px" : isTablet ? "20px 20px 28px" : "28px 32px 32px",
      minHeight: "100vh",
      maxWidth: "100%",
      overflow: "hidden",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: isMobile ? 18 : 24,
      gap: 12,
    } as React.CSSProperties,

    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
      gap: isMobile ? 10 : 14,
      marginBottom: isMobile ? 18 : 22,
    } as React.CSSProperties,

    statCard: {
      background: "#fff",
      borderRadius: 14,
      padding: isMobile ? "14px 12px" : "20px 18px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative" as const,
      overflow: "hidden" as const,
    } as React.CSSProperties,

    statStripe: (gradient: string) => ({
      position: "absolute" as const,
      top: 0, left: 0, right: 0,
      height: 3,
      background: gradient,
      borderRadius: "14px 14px 0 0",
    }),

    tableContainer: {
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      overflowX: "auto" as const, // Fix mobile clipping
      WebkitOverflowScrolling: "touch" as const,
    } as React.CSSProperties,

    th: {
      padding: isMobile ? "10px 12px" : "13px 18px",
      textAlign: "left" as const,
      fontSize: 11,
      fontWeight: 400,
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      color: "#94a3b8",
      borderBottom: "1px solid #e2e8f0",
      background: "#fafbfc",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    td: {
      padding: isMobile ? "12px 12px" : "14px 18px",
      fontSize: isMobile ? 13 : 14,
      color: "#475569",
      borderBottom: "1px solid #f1f5f9",
      verticalAlign: "middle" as const,
    } as React.CSSProperties,

    btnPrimary: {
      padding: isMobile ? "9px 14px" : "10px 20px",
      background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      fontSize: isMobile ? 13 : 14,
      fontWeight: 400,
      fontFamily: "inherit",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      transition: "all 0.2s",
      boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnSecondary: {
      padding: isMobile ? "9px 12px" : "10px 16px",
      background: "#fff",
      color: "#475569",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      fontSize: isMobile ? 13 : 14,
      fontWeight: 400,
      fontFamily: "inherit",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      transition: "all 0.2s",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnIcon: {
      minWidth: 36,
      height: 36,
      borderRadius: 9,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      color: "#64748b",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: 400,
      padding: "0 10px",
    } as React.CSSProperties,

    badge: (color: string, bg: string) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 400,
      color,
      background: bg,
      border: `1px solid ${color}20`,
      whiteSpace: "nowrap" as const,
    }),

    modalOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(15,23,42,0.6)",
      backdropFilter: "blur(8px)",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? 12 : 24,
    } as React.CSSProperties,

    modalCard: {
      background: "#fff",
      borderRadius: 18,
      padding: isMobile ? "24px 18px" : "30px 26px",
      maxWidth: 480,
      width: "100%",
      boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
      position: "relative" as const,
      maxHeight: "90vh",
      overflowY: "auto" as const,
    } as React.CSSProperties,

    input: {
      width: "100%",
      padding: isMobile ? "10px 12px" : "11px 14px",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      borderRadius: 10,
      color: "#1e293b",
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      transition: "all 0.2s",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    label: {
      display: "block",
      fontSize: 12,
      fontWeight: 400,
      color: "#64748b",
      marginBottom: 5,
    } as React.CSSProperties,

    tabContent: {
      animation: "fadeInUp 0.4s ease-out",
    } as React.CSSProperties,

    activityCard: {
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      padding: isMobile ? "16px 14px" : "24px 20px",
      marginBottom: 24,
    } as React.CSSProperties,

    activityItem: {
      display: "flex",
      gap: 14,
      padding: "16px 0",
      borderBottom: "1px solid #f1f5f9",
      position: "relative" as const,
    } as React.CSSProperties,
  };
}

export type AdminStyles = ReturnType<typeof getStyles>;
