import React, { useMemo } from "react";

interface CloutSidebarProps {
  stats: { folders: number; cloutFiles: number; inventoryFiles: number };
  canCreate: boolean;
  canEdit?: boolean;
  busy: boolean;
  canManageInCurrentFolder: boolean;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  selectedCount?: number;
  onPickUpload: () => void;
  onCreateFolder: () => void;
  onMoveSelected?: () => void;
  onBack: () => void;
}

export default function CloutSidebar(props: CloutSidebarProps) {
  const {
    stats,
    canCreate,
    busy,
    canManageInCurrentFolder,
    newFolderName,
    setNewFolderName,
    onPickUpload,
    onCreateFolder,
    onBack,
  } = props;

  const folderNameReady = useMemo(() => newFolderName.trim().length > 0, [newFolderName]);
  const disableCreate = !canCreate || busy || !canManageInCurrentFolder;
  const disableUpload = !canCreate || busy || !canManageInCurrentFolder;

  return (
    <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white shadow-sm">
              C
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Clout</div>
              <div className="truncate text-base font-semibold text-slate-900">Workspace</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-lg font-semibold text-slate-900">{stats.folders}</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Folders</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-lg font-semibold text-slate-900">{stats.cloutFiles}</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Clout</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-lg font-semibold text-slate-900">{stats.inventoryFiles}</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Inventory</div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <button
            type="button"
            onClick={onPickUpload}
            disabled={disableUpload}
            className="flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload
          </button>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Create folder</label>
            <input
              type="text"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="New folder name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (disableCreate || !folderNameReady) return;
                onCreateFolder();
              }}
              disabled={disableCreate || !folderNameReady}
              className="mt-3 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create folder
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span>Back to Dashboard</span>
            <span className="text-slate-400">-&gt;</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
