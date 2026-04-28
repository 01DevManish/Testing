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

const modalShell =
  "fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm";

const modalCard =
  "w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]";

function ModalHeader({
  eyebrow,
  title,
  description,
  accent,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className={`relative overflow-hidden ${accent} px-6 py-5 text-white`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_30%)]" />
      <div className="relative">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/80">
          {eyebrow}
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/80">{description}</p>
      </div>
    </div>
  );
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
  const selectedMoveLabel =
    moveCandidates.find((candidate) => candidate.id === moveTargetId)?.name ?? "Select a destination";

  return (
    <>
      {renameFolderId ? (
        <div
          className={modalShell}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clout-rename-title"
          onClick={onCloseRename}
        >
          <div className={modalCard} onClick={(event) => event.stopPropagation()}>
            <ModalHeader
              eyebrow="Rename folder"
              title="Give the folder a cleaner name"
              description="Keep the structure tidy and easy to scan — like a polished cloud workspace."
              accent="bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500"
            />

            <div className="space-y-5 px-6 py-6">
              <div>
                <label id="clout-rename-title" className="mb-2 block text-sm font-medium text-slate-900">
                  Folder name
                </label>
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  autoFocus
                  placeholder="Enter new folder name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">Short, descriptive names make folders easier to navigate.</p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCloseRename}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveRename}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)] transition hover:bg-slate-800"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showMoveDialog ? (
        <div
          className={modalShell}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clout-move-title"
          onClick={onCloseMove}
        >
          <div className={modalCard} onClick={(event) => event.stopPropagation()}>
            <ModalHeader
              eyebrow="Move selected items"
              title={`Move ${movingCount} editable item${movingCount === 1 ? "" : "s"}`}
              description="Inventory-linked media is read-only. Only Clout items you can edit will be moved."
              accent="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-700"
            />

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p id="clout-move-title" className="text-sm font-medium text-slate-900">
                      Destination folder
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Choose where the selected items should live.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                    {movingCount} selected
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <select
                    value={moveTargetId || ""}
                    onChange={(event) => setMoveTargetId(event.target.value || null)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  >
                    {moveCandidates.map((candidate) => (
                      <option key={candidate.id || "root"} value={candidate.id || ""}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected destination</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedMoveLabel}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCloseMove}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onMove}
                  className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-indigo-500"
                >
                  Move items
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
