import type { DataEntity } from "./dataEntities";

type RowWithId = { id: string };

const assertOk = async (res: Response, context: string): Promise<void> => {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const message = typeof body?.error === "string" ? body.error : `${context} failed (${res.status})`;
  throw new Error(message);
};

export const fetchDataItems = async <T,>(entity: DataEntity): Promise<T[]> => {
  const res = await fetch(`/api/data/${entity}`, { cache: "no-store" });
  await assertOk(res, `Fetch ${entity}`);
  const json = await res.json();
  return Array.isArray(json?.items) ? (json.items as T[]) : [];
};

export const upsertDataItems = async <T extends RowWithId>(
  entity: DataEntity,
  items: T[]
): Promise<void> => {
  if (!items.length) return;
  const res = await fetch(`/api/data/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "upsert", items }),
  });
  await assertOk(res, `Upsert ${entity}`);
};

export const replaceDataItems = async <T extends RowWithId>(
  entity: DataEntity,
  items: T[]
): Promise<void> => {
  const res = await fetch(`/api/data/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replace", items }),
  });
  await assertOk(res, `Replace ${entity}`);
};

export const deleteDataItemById = async <T extends RowWithId>(
  entity: DataEntity,
  id: string
): Promise<void> => {
  const rows = await fetchDataItems<T>(entity);
  const next = rows.filter((row) => String(row.id) !== String(id));
  await replaceDataItems(entity, next);
};
