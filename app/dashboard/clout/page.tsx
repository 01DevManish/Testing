"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import SmartImage from "@/app/components/SmartImage";
import { hasPermission } from "@/app/lib/permissions";
import { normalizeStorageImageUrl } from "@/app/lib/urlUtils";
import CloutSidebar from "./components/CloutSidebar";
import CloutModals from "./components/CloutModals";
import {
  createCloutFolder,
  deleteCloutItem,
  fetchCloutItems,
  moveCloutItems,
  renameCloutFolder,
  uploadToClout,
} from "@/app/lib/cloutApi";
import { CloutItem } from "@/app/lib/cloutTypes";

const ROOT_ID = null;
const INVENTORY_FOLDER_ID = "__inventory_used_images__";
const INVENTORY_FILE_PREFIX = "invimg_";
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "avif", "heic", "heif"]);
const CLOUT_ROUTE_TEMPORARILY_BLOCKED = true;

type ViewMode = "grid" | "list";

const sortItems = (items: CloutItem[]): CloutItem[] =>
  [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
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

const extensionFromFileName = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase().trim() || "";
  return ext;
};

const isAllowedImageFile = (file: File): boolean => {
  const ext = extensionFromFileName(file.name);
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
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

export default function CloutPage() {
  const { user, userData, loading } = useAuth();
  const { products } = useData();
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [serverItems, setServerItems] = useState<CloutItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(ROOT_ID);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [bootstrapped, setBootstrapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [newFolderName, setNewFolderName] = useState("");
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(ROOT_ID);
  const [copiedUrl, setCopiedUrl] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchTerm, setSearchTerm] = useState("");

  const canView = Boolean(userData) || hasPermission(userData, "clout_drive_view");
  const canCreate = Boolean(userData) || hasPermission(userData, "clout_drive_create");
  const canEdit = Boolean(userData) || hasPermission(userData, "clout_drive_edit");

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

  const items = useMemo<CloutItem[]>(() => {
    return [inventoryVirtualFolder, ...serverItems, ...inventoryVirtualFiles];
  }, [inventoryVirtualFiles, inventoryVirtualFolder, serverItems]);
  const serverItemIds = useMemo(() => new Set(serverItems.map((item) => item.id)), [serverItems]);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

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
    if (CLOUT_ROUTE_TEMPORARILY_BLOCKED) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (CLOUT_ROUTE_TEMPORARILY_BLOCKED) return;
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!canView) {
      router.replace("/dashboard");
      return;
    }
    if (!bootstrapped) void refreshItems();
  }, [bootstrapped, canView, loading, refreshItems, router, user]);

  if (CLOUT_ROUTE_TEMPORARILY_BLOCKED) {
    return null;
  }

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
      ? inFolder.filter((item) => item.name.toLowerCase().includes(trimmedSearch))
      : inFolder;
    return sortItems(filtered);
  }, [currentFolderId, items, searchTerm]);

  const selectedOnlyEditable = useMemo(
    () => selectedIds.filter((id) => !isInventoryVirtualFile(id) && !isInventoryVirtualFolder(id)),
    [isInventoryVirtualFile, isInventoryVirtualFolder, selectedIds]
  );

  const canManageInCurrentFolder = !isInventoryVirtualFolder(currentFolderId);

  const toggleSelection = (id: string) => {
    if (isInventoryVirtualFile(id) || isInventoryVirtualFolder(id)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
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

  const beginRenameFolder = (item: CloutItem) => {
    if (isInventoryVirtualFolder(item.id)) return;
    setRenameFolderId(item.id);
    setRenameValue(item.name);
  };

  const saveRenameFolder = async () => {
    if (!renameFolderId) return;
    const name = renameValue.trim();
    if (!name) return;

    setBusy(true);
    try {
      const updated = await renameCloutFolder(renameFolderId, name);
      setServerItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRenameFolderId(null);
      setRenameValue("");
      setMessage("Folder renamed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not rename folder.");
    } finally {
      setBusy(false);
    }
  };

  const moveSelection = async () => {
    if (!selectedOnlyEditable.length) return;

    setBusy(true);
    try {
      const moved = await moveCloutItems({ itemIds: selectedOnlyEditable, targetParentId: moveTargetId });
      const movedMap = new Map(moved.map((item) => [item.id, item]));
      setServerItems((prev) => prev.map((item) => movedMap.get(item.id) || item));
      setSelectedIds([]);
      setShowMoveDialog(false);
      setMessage("Selected items moved. S3 links stay the same.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not move selected items.");
    } finally {
      setBusy(false);
    }
  };

  const openMoveDialogFor = (itemIds: string[]) => {
    const clean = itemIds.filter((id) => !isInventoryVirtualFile(id) && !isInventoryVirtualFolder(id));
    if (!clean.length) return;
    setSelectedIds(clean);
    setMoveTargetId(ROOT_ID);
    setShowMoveDialog(true);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setMessage("URL copied.");
      setTimeout(() => {
        setCopiedUrl((prev) => (prev === url ? "" : prev));
      }, 1600);
    } catch {
      setMessage("Could not copy URL.");
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

  const getShareableUrl = (item: CloutItem): string => {
    return item.s3Url || "";
  };

  const handleDeleteItem = async (item: CloutItem) => {
    if (item.kind !== "file") return;
    if (isInventoryVirtualFile(item.id)) return;
    const confirmed = window.confirm(`Delete "${item.name}"? This will remove the image from S3 too.`);
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteCloutItem(item.id);
      setServerItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      setMessage("Image deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete image.");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files;
    if (!picked || picked.length === 0 || !canManageInCurrentFolder) return;

    setBusy(true);
    try {
      const uploads = Array.from(picked);
      const validUploads = uploads.filter((file) => isAllowedImageFile(file));
      const rejectedUploads = uploads.filter((file) => !isAllowedImageFile(file));
      if (rejectedUploads.length > 0) {
        setMessage(`Only image files allowed. Skipped ${rejectedUploads.length} file(s).`);
      }
      if (!validUploads.length) return;
      const created: CloutItem[] = [];
      for (const file of validUploads) {
        const item = await uploadToClout(file, currentFolderId);
        created.push(item);
      }
      setServerItems((prev) => [...created, ...prev]);
      setMessage(`${created.length} image(s) uploaded and converted to WebP.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      event.currentTarget.value = "";
    }
  };

  const moveCandidates = useMemo(() => {
    const rootCandidate: { id: string | null; name: string } = { id: ROOT_ID, name: "Root / My Clout" };
    const selectedSet = new Set(selectedOnlyEditable);
    const banned = new Set<string>([INVENTORY_FOLDER_ID]);

    const walkDescendants = (folderId: string) => {
      for (const item of items) {
        if (item.parentId !== folderId) continue;
        banned.add(item.id);
        if (item.kind === "folder") walkDescendants(item.id);
      }
    };

    for (const id of selectedOnlyEditable) {
      const selected = byId.get(id);
      if (selected?.kind === "folder") {
        banned.add(selected.id);
        walkDescendants(selected.id);
      }
    }

    const folderCandidates: Array<{ id: string | null; name: string }> = sortItems(items)
      .filter((item) => item.kind === "folder" && !selectedSet.has(item.id) && !banned.has(item.id))
      .map((item) => ({ id: item.id, name: item.name }));

    return [rootCandidate, ...folderCandidates];
  }, [byId, items, selectedOnlyEditable]);

  const stats = useMemo(() => {
    const folders = serverItems.filter((item) => item.kind === "folder").length + 1;
    const cloutFiles = serverItems.filter((item) => item.kind === "file").length;
    return {
      folders,
      cloutFiles,
      inventoryFiles: inventoryVirtualFiles.length,
    };
  }, [inventoryVirtualFiles.length, serverItems]);

  if (loading) return null;
  if (!user || !canView) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: 20, display: "grid", gridTemplateColumns: "290px minmax(0,1fr)", gap: 16 }}>
        <CloutSidebar
          stats={stats}
          canCreate={canCreate}
          canEdit={canEdit}
          busy={busy}
          canManageInCurrentFolder={canManageInCurrentFolder}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          selectedCount={selectedOnlyEditable.length}
          onPickUpload={() => uploadInputRef.current?.click()}
          onCreateFolder={createFolder}
          onMoveSelected={() => openMoveDialogFor(selectedOnlyEditable)}
          onBack={() => router.push("/dashboard")}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleUploadPick}
        />

        <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid #dbe3ee", background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 8px 30px rgba(15,23,42,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {breadcrumbs.map((crumb, index) => (
                  <button
                    key={`${crumb.id || "root"}_${index}`}
                    onClick={() => {
                      setCurrentFolderId(crumb.id);
                      setSelectedIds([]);
                    }}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 999,
                      padding: "6px 11px",
                      fontSize: 12,
                      background: crumb.id === currentFolderId ? "#e0f2fe" : "#fff",
                      color: crumb.id === currentFolderId ? "#0c4a6e" : "#334155",
                      cursor: "pointer",
                    }}
                  >
                    {crumb.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search in this folder"
                  style={{ width: 220, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                />
                <button
                  onClick={() => setViewMode("grid")}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", background: viewMode === "grid" ? "#e0f2fe" : "#fff", cursor: "pointer", fontSize: 12 }}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", background: viewMode === "list" ? "#e0f2fe" : "#fff", cursor: "pointer", fontSize: 12 }}
                >
                  List
                </button>
              </div>
            </div>
            {message ? <div style={{ marginTop: 10, color: "#0f766e", fontSize: 13 }}>{message}</div> : null}
          </div>

          <div style={{ border: "1px solid #dbe3ee", background: "#fff", borderRadius: 16, padding: 12, flex: 1, minHeight: 420, boxShadow: "0 8px 30px rgba(15,23,42,0.05)" }}>
            {allVisibleInFolder.length === 0 ? (
              <div style={{ padding: 24, color: "#64748b", fontSize: 14 }}>No items found in this folder.</div>
            ) : viewMode === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {allVisibleInFolder.map((item) => {
                  const isInventory = isInventoryVirtualFile(item.id) || isInventoryVirtualFolder(item.id);
                  const selectable = !isInventory;
                  return (
                    <div key={item.id} style={{ border: selectedIds.includes(item.id) ? "1px solid #38bdf8" : "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                      <button
                        onClick={() => {
                          if (item.kind === "folder") {
                            setCurrentFolderId(item.id);
                            setSelectedIds([]);
                          } else if (item.s3Url) {
                            window.open(getRenderableUrl(item), "_blank", "noopener,noreferrer");
                          }
                        }}
                        style={{ width: "100%", border: "none", background: "#f8fafc", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        {item.kind === "file" && item.s3Url ? (
                          <SmartImage src={getRenderableUrl(item)} alt={item.name} zoomable={false} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ height: 140, display: "grid", placeItems: "center", color: "#475569", fontSize: 28 }}>{item.kind === "folder" ? "[DIR]" : "[FILE]"}</div>
                        )}
                      </button>

                      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>{item.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: isInventory ? "#0369a1" : "#64748b" }}>{isInventory ? "Inventory Linked" : item.kind}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            {item.kind === "file" && item.s3Url ? (
                              <button
                                onClick={() => void copyUrl(getShareableUrl(item))}
                                style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: copiedUrl === getShareableUrl(item) ? "#dcfce7" : "#fff", padding: "2px 7px", fontSize: 11, cursor: "pointer" }}
                              >
                                {copiedUrl === getShareableUrl(item) ? "Copied" : "Copy URL"}
                              </button>
                            ) : null}
                            {item.kind === "file" && selectable ? (
                              <button
                                onClick={() => void handleDeleteItem(item)}
                                style={{ border: "1px solid #fecaca", borderRadius: 7, background: "#fff1f2", color: "#b91c1c", padding: "2px 7px", fontSize: 11, cursor: "pointer" }}
                              >
                                Delete
                              </button>
                            ) : null}
                            {selectable ? (
                              <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} />
                            ) : null}
                            {item.kind === "folder" && canEdit && !isInventory ? (
                              <button onClick={() => beginRenameFolder(item)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", padding: "2px 7px", fontSize: 11, cursor: "pointer" }}>
                                Rename
                              </button>
                            ) : null}
                            {selectable ? (
                              <button
                                onClick={() => openMoveDialogFor([item.id])}
                                style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", padding: "2px 7px", fontSize: 11, cursor: "pointer" }}
                              >
                                Move
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                {allVisibleInFolder.map((item) => {
                  const isInventory = isInventoryVirtualFile(item.id) || isInventoryVirtualFolder(item.id);
                  const selectable = !isInventory;
                  return (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "36px 64px 1fr auto", gap: 10, alignItems: "center", padding: "9px 10px", borderBottom: "1px solid #f1f5f9" }}>
                      <div>{selectable ? <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /> : null}</div>
                      <button
                        onClick={() => {
                          if (item.kind === "folder") {
                            setCurrentFolderId(item.id);
                            setSelectedIds([]);
                          } else if (item.s3Url) {
                            window.open(getRenderableUrl(item), "_blank", "noopener,noreferrer");
                          }
                        }}
                        style={{ width: 64, height: 48, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: 0, cursor: "pointer", overflow: "hidden" }}
                      >
                        {item.kind === "file" && item.s3Url ? (
                          <SmartImage src={getRenderableUrl(item)} alt={item.name} zoomable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 11 }}>{item.kind === "folder" ? "[DIR]" : "[FILE]"}</span>
                        )}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: isInventory ? "#0369a1" : "#64748b" }}>{isInventory ? "Inventory Linked" : item.kind}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {item.kind === "file" && item.s3Url ? <a href={getRenderableUrl(item)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0369a1" }}>Open</a> : null}
                        {item.kind === "file" && item.s3Url ? (
                          <button
                            onClick={() => void copyUrl(getShareableUrl(item))}
                            style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: copiedUrl === getShareableUrl(item) ? "#dcfce7" : "#fff", padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                          >
                            {copiedUrl === getShareableUrl(item) ? "Copied" : "Copy URL"}
                          </button>
                        ) : null}
                        {item.kind === "file" && selectable ? (
                          <button
                            onClick={() => void handleDeleteItem(item)}
                            style={{ border: "1px solid #fecaca", borderRadius: 7, background: "#fff1f2", color: "#b91c1c", padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        ) : null}
                        {item.kind === "folder" && canEdit && !isInventory ? (
                          <button onClick={() => beginRenameFolder(item)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>Rename</button>
                        ) : null}
                        {selectable ? (
                          <button onClick={() => openMoveDialogFor([item.id])} style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>Move</button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <CloutModals
        renameFolderId={renameFolderId}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        onCloseRename={() => setRenameFolderId(null)}
        onSaveRename={saveRenameFolder}
        showMoveDialog={showMoveDialog}
        onCloseMove={() => setShowMoveDialog(false)}
        onMove={moveSelection}
        moveTargetId={moveTargetId}
        setMoveTargetId={setMoveTargetId}
        moveCandidates={moveCandidates}
        movingCount={selectedOnlyEditable.length}
      />
    </div>
  );
}
