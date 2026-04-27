import React from "react";

interface CloutSidebarProps {
  stats: { folders: number; cloutFiles: number; inventoryFiles: number };
  canCreate: boolean;
  canEdit: boolean;
  busy: boolean;
  canManageInCurrentFolder: boolean;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  selectedCount: number;
  onPickUpload: () => void;
  onCreateFolder: () => void;
  onMoveSelected: () => void;
  onBack: () => void;
}

export default function CloutSidebar({
  stats,
  canCreate,
  canEdit,
  busy,
  canManageInCurrentFolder,
  newFolderName,
  setNewFolderName,
  selectedCount,
  onPickUpload,
  onCreateFolder,
  onMoveSelected,
  onBack,
}: CloutSidebarProps) {
  const disabledAction = !canCreate || busy || !canManageInCurrentFolder;
  const disabledMove = !canEdit || busy || !selectedCount;

  return (
    <aside style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 40px)", position: "sticky", top: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em", color: "#0f172a", fontWeight: 700 }}>Clout</h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Drive-style media workspace</p>
      </div>

      <button
        disabled={disabledAction}
        onClick={onPickUpload}
        style={{ padding: "10px 12px", borderRadius: 10, border: "none", background: disabledAction ? "#94a3b8" : "#2563eb", color: "#ffffff", cursor: disabledAction ? "not-allowed" : "pointer", fontWeight: 700, textAlign: "left" }}
      >
        + New Upload
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#ffffff" }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>Folders</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{stats.folders}</div>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#ffffff" }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>Clout Files</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{stats.cloutFiles}</div>
        </div>
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 10, padding: "8px 10px" }}>
        <div style={{ fontSize: 11, color: "#1d4ed8" }}>Inventory-linked Images</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1e3a8a" }}>{stats.inventoryFiles}</div>
        <div style={{ fontSize: 11, color: "#334155" }}>Only images used in inventory are shown.</div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder"
          disabled={disabledAction}
          style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", fontSize: 13, background: "#ffffff", color: "#0f172a" }}
        />
        <button
          disabled={disabledAction || !newFolderName.trim()}
          onClick={onCreateFolder}
          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #2563eb", background: "#ffffff", color: "#1d4ed8", cursor: disabledAction || !newFolderName.trim() ? "not-allowed" : "pointer" }}
        >
          Create
        </button>
      </div>

      <button
        disabled={disabledMove}
        onClick={onMoveSelected}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#1e293b", cursor: disabledMove ? "not-allowed" : "pointer", fontWeight: 600 }}
      >
        Move Selected ({selectedCount})
      </button>
      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.35 }}>
        Move flow: item select karo, `Move Selected` dabao, target folder choose karo, phir `Move`.
      </div>

      <button
        onClick={onBack}
        style={{ marginTop: "auto", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", cursor: "pointer" }}
      >
        Back To Dashboard
      </button>
    </aside>
  );
}
