import React from "react";

interface MoveCandidate {
  id: string | null;
  name: string;
}

interface CloutModalsProps {
  renameFolderId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onCloseRename: () => void;
  onSaveRename: () => void;
  showMoveDialog: boolean;
  onCloseMove: () => void;
  onMove: () => void;
  moveTargetId: string | null;
  setMoveTargetId: (v: string | null) => void;
  moveCandidates: MoveCandidate[];
  movingCount: number;
}

export default function CloutModals({
  renameFolderId,
  renameValue,
  setRenameValue,
  onCloseRename,
  onSaveRename,
  showMoveDialog,
  onCloseMove,
  onMove,
  moveTargetId,
  setMoveTargetId,
  moveCandidates,
  movingCount,
}: CloutModalsProps) {
  return (
    <>
      {renameFolderId ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center" }}>
          <div style={{ width: 380, background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Rename Folder</h3>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", fontSize: 14 }}
            />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onCloseRename} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "8px 12px" }}>Cancel</button>
              <button onClick={onSaveRename} style={{ border: "none", background: "#0ea5e9", color: "#fff", borderRadius: 8, padding: "8px 12px" }}>Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {showMoveDialog ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center" }}>
          <div style={{ width: 420, background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Move Selected Items</h3>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
              Only editable Clout items are movable. Inventory-linked images are read-only.
            </p>
            <div style={{ marginBottom: 10, fontSize: 12, color: "#334155" }}>
              Moving: {movingCount} item(s)
            </div>
            <select
              value={moveTargetId || ""}
              onChange={(event) => setMoveTargetId(event.target.value || null)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", fontSize: 14 }}
            >
              {moveCandidates.map((candidate) => (
                <option key={candidate.id || "root"} value={candidate.id || ""}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onCloseMove} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "8px 12px" }}>Cancel</button>
              <button onClick={onMove} style={{ border: "none", background: "#0ea5e9", color: "#fff", borderRadius: 8, padding: "8px 12px" }}>Move</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
