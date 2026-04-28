"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import SmartImage from "@/app/components/SmartImage";
import { hasPermission } from "@/app/lib/permissions";
import { normalizeStorageImageUrl } from "@/app/lib/urlUtils";
import CloutSidebar from "./components/CloutSidebar";
import { createCloutFolder, deleteCloutItem, fetchCloutItems, uploadToClout } from "@/app/lib/cloutApi";
import { CloutItem } from "@/app/lib/cloutTypes";

const ROOT_ID = null;
const INVENTORY_FOLDER_ID = "__inventory_used_images__";
const INVENTORY_FILE_PREFIX = "invimg_";

type ViewMode = "list" | "grid";

const sortItems = (items: CloutItem[]): CloutItem[] =>
  [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 33) ^ input.charCodeAt(i);
  return Math.abs(hash >>> 0).toString(36);
};

const extFromUrl = (url: string): string | undefined => {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase() || "";
    return ext || undefined;
  } catch {
    return undefined;
  }
};

const guessMime = (url: string): string | undefined => {
  const ext = extFromUrl(url);
  if (!ext) return undefined;
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return undefined;
};

const parseS3BucketAndKey = (url: string): { bucket: string; key: string } | null => {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    if (!key) return null;

    if (host.includes(".s3.") && host.endsWith(".amazonaws.com")) {
      const bucket = host.split(".s3.")[0];
      if (!bucket) return null;
      return { bucket, key };
    }

    if (host.startsWith("s3.") && host.endsWith(".amazonaws.com")) {
      const [bucket, ...rest] = key.split("/");
      const nestedKey = rest.join("/");
      if (!bucket || !nestedKey) return null;
      return { bucket, key: nestedKey };
    }

    return null;
  } catch {
    return null;
  }
};

const formatDate = (value: number): string =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

const iconForItem = (item: CloutItem): string => {
  if (item.kind === "folder") return "📁";
  const ext = String(item.extension || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "🖼️";
  return "📄";
};

export default function CloutPage() {
  const { userData, loading } = useAuth();
  const { products } = useData();
  const router = useRouter();

  const [serverItems, setServerItems] = useState<CloutItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(ROOT_ID);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const canView = hasPermission(userData, "clout_drive_view");
  const canCreate = hasPermission(userData, "clout_drive_create");

  const inventoryVirtualFiles = useMemo<CloutItem[]>(() => {
    const byUrl = new Map<string, CloutItem>();
    for (const product of products || []) {
      const rawUrls = [product.imageUrl, ...(Array.isArray(product.imageUrls) ? product.imageUrls : [])]
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean);

      for (const rawUrl of rawUrls) {
        const normalizedUrl = normalizeStorageImageUrl(rawUrl);
        if (!normalizedUrl || byUrl.has(normalizedUrl)) continue;

        const fileId = `${INVENTORY_FILE_PREFIX}${hashString(normalizedUrl)}`;
        const sku = String(product.sku || "ITEM").trim() || "ITEM";
        const productName = String(product.productName || "Product").trim() || "Product";
        const ext = extFromUrl(normalizedUrl);
        const safeName = `${sku} - ${productName}${ext ? `.${ext}` : ""}`.slice(0, 180);
        const ts = typeof product.updatedAt === "number" ? product.updatedAt : Date.now();

        byUrl.set(normalizedUrl, {
          id: fileId,
          kind: "file",
          name: safeName,
          parentId: INVENTORY_FOLDER_ID,
          createdAt: ts,
          updatedAt: ts,
          createdByUid: "inventory",
          createdByName: "Inventory Sync",
          s3Url: normalizedUrl,
          mimeType: guessMime(normalizedUrl),
          extension: ext,
        });
      }
    }
    return sortItems(Array.from(byUrl.values()));
  }, [products]);

  const inventorySearchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const product of products || []) {
      const rawUrls = [product.imageUrl, ...(Array.isArray(product.imageUrls) ? product.imageUrls : [])]
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean);
      const sku = String(product.sku || "").trim();
      const productName = String(product.productName || "").trim();
      const collection = String(product.collection || "").trim();
      const searchText = `${sku} ${productName} ${collection}`.toLowerCase();
      for (const rawUrl of rawUrls) {
        const normalizedUrl = normalizeStorageImageUrl(rawUrl);
        if (!normalizedUrl) continue;
        const fileId = `${INVENTORY_FILE_PREFIX}${hashString(normalizedUrl)}`;
        const existing = index.get(fileId);
        index.set(fileId, existing ? `${existing} ${searchText}` : searchText);
      }
    }
    return index;
  }, [products]);

  const inventoryVirtualFolder = useMemo<CloutItem>(() => {
    const now = Date.now();
    return {
      id: INVENTORY_FOLDER_ID,
      kind: "folder",
      name: "Inventory Used Images",
      parentId: ROOT_ID,
      createdAt: now,
      updatedAt: now,
      createdByUid: "system",
      createdByName: "System",
    };
  }, []);

  const items = useMemo<CloutItem[]>(() => [inventoryVirtualFolder, ...serverItems, ...inventoryVirtualFiles], [inventoryVirtualFolder, serverItems, inventoryVirtualFiles]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const serverItemIds = useMemo(() => new Set(serverItems.map((item) => item.id)), [serverItems]);

  const isInventoryVirtualFile = useCallback((itemId: string) => itemId.startsWith(INVENTORY_FILE_PREFIX), []);
  const isInventoryVirtualFolder = useCallback((itemId: string | null) => itemId === INVENTORY_FOLDER_ID, []);

  const refreshItems = useCallback(async () => {
    setBusy(true);
    try {
      const next = await fetchCloutItems();
      setServerItems(next);
      setMessage("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to load Clout data.");
    } finally {
      setBusy(false);
      setBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!canView) {
      router.replace("/dashboard");
      return;
    }
    if (!bootstrapped) void refreshItems();
  }, [bootstrapped, canView, loading, refreshItems, router]);

  const breadcrumbs = useMemo(() => {
    const path: Array<{ id: string | null; name: string }> = [{ id: ROOT_ID, name: "My Clout" }];
    let cursor = currentFolderId;
    let guard = 0;
    while (cursor && guard < 100) {
      const node = byId.get(cursor);
      if (!node) break;
      path.push({ id: node.id, name: node.name });
      cursor = node.parentId;
      guard += 1;
    }
    return path.reverse();
  }, [byId, currentFolderId]);

  const allVisibleInFolder = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    const inFolder = items.filter((item) => item.parentId === currentFolderId);
    const filtered = trimmedSearch
      ? inFolder.filter((item) => {
          const nameMatch = item.name.toLowerCase().includes(trimmedSearch);
          if (nameMatch) return true;
          if (currentFolderId === INVENTORY_FOLDER_ID && item.kind === "file") {
            const indexed = inventorySearchIndex.get(item.id) || "";
            return indexed.includes(trimmedSearch);
          }
          return false;
        })
      : inFolder;
    return sortItems(filtered);
  }, [currentFolderId, inventorySearchIndex, items, searchTerm]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(allVisibleInFolder.length / ITEMS_PER_PAGE)),
    [allVisibleInFolder.length]
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allVisibleInFolder.slice(start, start + ITEMS_PER_PAGE);
  }, [allVisibleInFolder, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId, searchTerm, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const canManageInCurrentFolder = !isInventoryVirtualFolder(currentFolderId);
  const getShareableUrl = (item: CloutItem): string => item.s3Url || "";

  const copyUrl = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("URL copied.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setMessage("URL copied.");
      } catch {
        setMessage("Could not copy URL.");
      }
    }
  };

  const downloadItem = async (item: CloutItem) => {
    if (item.kind !== "file") return;
    const fileUrl = getRenderableUrl(item);
    if (!fileUrl) return;

    try {
      const res = await fetch(fileUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const ext = item.extension ? `.${item.extension}` : "";
      const safeName = (item.name || "clout-file").replace(/[\\/:*?\"<>|]+/g, "_");
      const finalName = safeName.toLowerCase().endsWith(ext.toLowerCase()) ? safeName : `${safeName}${ext}`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setMessage("Download started.");
    } catch {
      setMessage("Could not download file.");
    }
  };

  const handleUploadPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files;
    if (!picked || picked.length === 0) return;
    if (!canManageInCurrentFolder || !canCreate) {
      setMessage("You cannot upload in this folder.");
      return;
    }

    setBusy(true);
    try {
      const uploads = Array.from(picked);
      const created: CloutItem[] = [];
      for (const file of uploads) {
        const item = await uploadToClout(file, currentFolderId);
        created.push(item);
      }
      if (created.length) {
        setServerItems((prev) => [...created, ...prev]);
        setMessage(`${created.length} file(s) uploaded to current folder.`);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadInputKey((k) => k + 1);
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !canManageInCurrentFolder) return;
    setBusy(true);
    try {
      const created = await createCloutFolder({ name, parentId: currentFolderId });
      setServerItems((prev) => [created, ...prev]);
      setNewFolderName("");
      setMessage("Folder created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create folder.");
    } finally {
      setBusy(false);
    }
  };

  const getRenderableUrl = (item: CloutItem): string => {
    if (!item.s3Url) return "";
    if (serverItemIds.has(item.id) && item.kind === "file") {
      return `/api/clout/items/${encodeURIComponent(item.id)}/image`;
    }
    if (isInventoryVirtualFile(item.id)) {
      const parsed = parseS3BucketAndKey(item.s3Url);
      if (parsed) {
        const keyPath = parsed.key
          .split("/")
          .filter(Boolean)
          .map((part) => encodeURIComponent(part))
          .join("/");
        return `/api/inventory-image/${encodeURIComponent(parsed.bucket)}/${keyPath}`;
      }
    }
    return `/api/proxy-image?url=${encodeURIComponent(item.s3Url)}`;
  };

  const handleDeleteFolder = async (item: CloutItem) => {
    if (item.kind !== "folder") return;
    if (isInventoryVirtualFolder(item.id)) return;
    const confirmed = window.confirm(`Are you sure you want to delete folder "${item.name}" and all its contents?`);
    if (!confirmed) return;

    const idsToDelete: string[] = [];
    const walk = (parentId: string) => {
      for (const entry of items) {
        if (entry.parentId !== parentId) continue;
        if (!isInventoryVirtualFolder(entry.id) && !isInventoryVirtualFile(entry.id)) idsToDelete.push(entry.id);
        if (entry.kind === "folder") walk(entry.id);
      }
    };
    idsToDelete.push(item.id);
    walk(item.id);

    setBusy(true);
    try {
      await Promise.all(idsToDelete.map((id) => deleteCloutItem(id)));
      setServerItems((prev) => prev.filter((entry) => !idsToDelete.includes(entry.id)));
      if (currentFolderId === item.id) setCurrentFolderId(ROOT_ID);
      setMessage("Folder deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete folder.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = async (item: CloutItem) => {
    if (item.kind !== "file") return;
    if (isInventoryVirtualFile(item.id)) return;
    const confirmed = window.confirm(`Are you sure you want to delete image "${item.name}"?`);
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteCloutItem(item.id);
      setServerItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setMessage("Image deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete image.");
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const folders = serverItems.filter((item) => item.kind === "folder").length + 1;
    const cloutFiles = serverItems.filter((item) => item.kind === "file").length;
    return { folders, cloutFiles, inventoryFiles: inventoryVirtualFiles.length };
  }, [inventoryVirtualFiles.length, serverItems]);

  if (loading) return null;
  if (!canView) return null;

  const sectionCount = allVisibleInFolder.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.08),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col gap-5 p-4 lg:grid lg:grid-cols-[292px_minmax(0,1fr)] lg:p-5">
        <aside className="hidden min-w-0 lg:block">
          <CloutSidebar
            stats={stats}
            canCreate={canCreate}
            busy={busy}
            canManageInCurrentFolder={canManageInCurrentFolder}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            onPickUpload={() => document.getElementById("clout-upload-input")?.click()}
            onCreateFolder={createFolder}
            onBack={() => router.push("/dashboard")}
          />
        </aside>

        <input
          id="clout-upload-input"
          key={uploadInputKey}
          type="file"
          multiple
          className="hidden"
          onChange={handleUploadPick}
        />

        <main className="order-2 min-w-0 space-y-4 lg:order-none">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Clout
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  {breadcrumbs.map((crumb, index) => (
                    <button
                      key={`${crumb.id || "root"}_${index}`}
                      type="button"
                      onClick={() => setCurrentFolderId(crumb.id)}
                      className={`rounded-full px-2.5 py-1 transition ${
                        crumb.id === currentFolderId ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {crumb.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:min-w-[420px] sm:flex-row sm:items-center sm:justify-end">
                <div className="relative flex-1">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search folders/files"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("clout-upload-input")?.click()}
                    disabled={!canManageInCurrentFolder || !canCreate || busy}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                      viewMode === "list" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                      viewMode === "grid" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Grid
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Back to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(ROOT_ID)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Root
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(INVENTORY_FOLDER_ID)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    currentFolderId === INVENTORY_FOLDER_ID ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Inventory
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  {busy ? "Working..." : `${sectionCount} item(s)`}
                </span>
              </div>
            </div>

            {message ? (
              <div className="mx-5 mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            {allVisibleInFolder.length === 0 ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <h2 className="mt-5 text-xl font-semibold text-slate-900">Nothing here yet</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Create folders to organize your clout workspace.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {paginatedItems.map((item) => {
                  const isInventory = isInventoryVirtualFile(item.id) || isInventoryVirtualFolder(item.id);
                  const itemUrl = item.s3Url ? getRenderableUrl(item) : "";

                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.kind === "folder") setCurrentFolderId(item.id);
                          else if (item.s3Url) window.open(itemUrl, "_blank", "noopener,noreferrer");
                        }}
                        className="block w-full bg-slate-50 text-left"
                      >
                        {item.kind === "file" && item.s3Url ? (
                          <div className="relative h-52 overflow-hidden bg-slate-100">
                            <SmartImage src={itemUrl} alt={item.name} zoomable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </div>
                        ) : (
                          <div className="flex h-52 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500">
                            <div className="text-center">
                              <div className="text-5xl">{iconForItem(item)}</div>
                              <div className="mt-2 text-sm font-medium text-slate-700">{item.kind === "folder" ? "Folder" : "File"}</div>
                            </div>
                          </div>
                        )}
                      </button>

                      <div className="flex flex-col gap-3 p-4">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-slate-900" title={item.name}>{item.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span className={`rounded-full px-2 py-1 font-medium ${isInventory ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {isInventory ? "Inventory" : item.kind}
                            </span>
                            {item.extension ? <span>{item.extension.toUpperCase()}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {item.kind === "file" && item.s3Url ? (
                            <button
                              type="button"
                              onClick={() => void copyUrl(getShareableUrl(item))}
                              aria-label="Copy URL"
                              title="Copy URL"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <span aria-hidden="true">🔗</span>
                            </button>
                          ) : null}
                          {item.kind === "file" && item.s3Url ? (
                            <button
                              type="button"
                              onClick={() => void downloadItem(item)}
                              aria-label="Download"
                              title="Download"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <span aria-hidden="true">⬇️</span>
                            </button>
                          ) : null}
                          {item.kind === "file" && !isInventory ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteFile(item)}
                              aria-label="Delete"
                              title="Delete"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700 transition hover:bg-rose-100"
                            >
                              <span aria-hidden="true">🗑️</span>
                            </button>
                          ) : null}
                          {item.kind === "folder" && !isInventory ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteFolder(item)}
                              className="w-fit rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                            >
                              Delete folder
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-[56px_minmax(0,1fr)_180px_140px_240px] items-center gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <div />
                  <div>Name</div>
                  <div>Type</div>
                  <div>Updated</div>
                  <div className="text-right">Actions</div>
                </div>

                {paginatedItems.map((item) => {
                  const isInventory = isInventoryVirtualFile(item.id) || isInventoryVirtualFolder(item.id);
                  const itemUrl = item.s3Url ? getRenderableUrl(item) : "";

                  return (
                    <div key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_180px_140px_240px] items-center gap-3 bg-white px-4 py-3 transition hover:bg-slate-50">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.kind === "folder") setCurrentFolderId(item.id);
                          else if (item.s3Url) window.open(itemUrl, "_blank", "noopener,noreferrer");
                        }}
                        className="h-12 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-0"
                      >
                        {item.kind === "file" && item.s3Url ? (
                          <SmartImage src={itemUrl} alt={item.name} zoomable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xl text-slate-600">{iconForItem(item)}</div>
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900" title={item.name}>{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.kind === "folder" ? "Folder" : "File"}{isInventory ? " - Inventory linked" : ""}</div>
                      </div>

                      <div className="text-sm text-slate-600">{isInventory ? "Inventory" : item.kind}</div>
                      <div className="text-sm text-slate-600">{formatDate(item.updatedAt)}</div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {item.kind === "file" && item.s3Url ? (
                          <button
                            type="button"
                            onClick={() => void copyUrl(getShareableUrl(item))}
                            aria-label="Copy URL"
                            title="Copy URL"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <span aria-hidden="true">🔗</span>
                          </button>
                        ) : null}
                        {item.kind === "file" && item.s3Url ? (
                          <button
                            type="button"
                            onClick={() => void downloadItem(item)}
                            aria-label="Download"
                            title="Download"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <span aria-hidden="true">⬇️</span>
                          </button>
                        ) : null}
                        {item.kind === "file" && !isInventory ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteFile(item)}
                            aria-label="Delete"
                            title="Delete"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700 transition hover:bg-rose-100"
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        ) : null}
                        {item.kind === "folder" && !isInventory && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteFolder(item)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete folder
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {allVisibleInFolder.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      <div className="order-first lg:hidden">
        <CloutSidebar
          stats={stats}
          canCreate={canCreate}
          busy={busy}
          canManageInCurrentFolder={canManageInCurrentFolder}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          onPickUpload={() => document.getElementById("clout-upload-input")?.click()}
          onCreateFolder={createFolder}
          onBack={() => router.push("/dashboard")}
        />
      </div>
    </div>
  );
}
