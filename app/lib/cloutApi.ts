import { CloutItem } from "./cloutTypes";

const assertOk = async (res: Response, context: string): Promise<void> => {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const message = typeof body?.error === "string" ? body.error : `${context} failed (${res.status})`;
  throw new Error(message);
};

export const fetchCloutItems = async (): Promise<CloutItem[]> => {
  const res = await fetch("/api/clout/items", { cache: "no-store" });
  await assertOk(res, "Fetch Clout items");
  const json = await res.json();
  return Array.isArray(json?.items) ? (json.items as CloutItem[]) : [];
};

export const createCloutFolder = async (payload: {
  name: string;
  parentId: string | null;
}): Promise<CloutItem> => {
  const res = await fetch("/api/clout/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await assertOk(res, "Create folder");
  const json = await res.json();
  return json.item as CloutItem;
};

export const renameCloutFolder = async (id: string, name: string): Promise<CloutItem> => {
  const res = await fetch(`/api/clout/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  await assertOk(res, "Rename folder");
  const json = await res.json();
  return json.item as CloutItem;
};

export const renameCloutItem = async (id: string, name: string): Promise<CloutItem> => {
  const res = await fetch(`/api/clout/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  await assertOk(res, "Rename item");
  const json = await res.json();
  return json.item as CloutItem;
};

export const moveCloutItems = async (payload: {
  itemIds: string[];
  targetParentId: string | null;
}): Promise<CloutItem[]> => {
  const res = await fetch("/api/clout/items/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await assertOk(res, "Move items");
  const json = await res.json();
  return Array.isArray(json?.items) ? (json.items as CloutItem[]) : [];
};

export const uploadToClout = async (file: File, parentId: string | null): Promise<CloutItem> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("parentId", parentId || "");

  const res = await fetch("/api/clout/upload", {
    method: "POST",
    body: formData,
  });

  await assertOk(res, "Upload file");
  const json = await res.json();
  return json.item as CloutItem;
};

export const deleteCloutItem = async (id: string): Promise<void> => {
  const res = await fetch(`/api/clout/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await assertOk(res, "Delete item");
};
