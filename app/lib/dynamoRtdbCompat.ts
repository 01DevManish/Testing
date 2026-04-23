import { DATA_ENTITIES, type DataEntity } from "./dataEntities";

type JsonObject = Record<string, any>;

const ENTITY_SET = new Set<string>(DATA_ENTITIES as readonly string[]);

type RefObject = { path: string };
type QueryConstraint =
  | { kind: "orderByChild"; key: string }
  | { kind: "equalTo"; value: any }
  | { kind: "orderByKey" }
  | { kind: "limitToLast"; count: number };
type QueryObject = { ref: RefObject; constraints: QueryConstraint[] };

export class DataSnapshot {
  constructor(private readonly data: any) {}
  exists() {
    if (this.data == null) return false;
    if (typeof this.data === "object") return Object.keys(this.data).length > 0;
    return true;
  }
  val() {
    return this.data;
  }
  forEach(cb: (child: { key: string; val: () => any }) => void) {
    if (!this.data || typeof this.data !== "object") return;
    Object.entries(this.data).forEach(([key, value]) => {
      cb({ key, val: () => value });
    });
  }
  child(path: string) {
    const parts = splitPath(path);
    let current: any = this.data;
    for (const p of parts) {
      current = current?.[p];
      if (current === undefined) break;
    }
    return new DataSnapshot(current);
  }
}

const splitPath = (path: string): string[] =>
  String(path || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

const fetchEntityRows = async (entity: string): Promise<JsonObject[]> => {
  const res = await fetch(`/api/data/${entity}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return Array.isArray(json?.items) ? json.items : [];
};

const replaceEntityRows = async (entity: string, rows: JsonObject[]) => {
  await fetch(`/api/data/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replace", items: rows }),
  });
};

const upsertEntityRows = async (entity: string, rows: JsonObject[]) => {
  await fetch(`/api/data/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "upsert", items: rows }),
  });
};

const toMap = (rows: JsonObject[]): JsonObject => {
  const out: JsonObject = {};
  rows.forEach((row) => {
    const id = String(row?.id || "");
    if (!id) return;
    out[id] = row;
  });
  return out;
};

const applyConstraints = (input: JsonObject, constraints: QueryConstraint[]): JsonObject => {
  let entries = Object.entries(input || {});

  constraints.forEach((c) => {
    if (c.kind === "equalTo") {
      const orderBy = constraints.find((x) => x.kind === "orderByChild") as
        | { kind: "orderByChild"; key: string }
        | undefined;
      if (!orderBy) return;
      entries = entries.filter(([, row]) => row?.[orderBy.key] === c.value);
      return;
    }
    if (c.kind === "orderByKey") {
      entries = entries.sort(([a], [b]) => a.localeCompare(b));
      return;
    }
    if (c.kind === "limitToLast") {
      entries = entries.slice(Math.max(0, entries.length - c.count));
    }
  });

  return Object.fromEntries(entries);
};

const isQueryObject = (v: any): v is QueryObject =>
  Boolean(v && typeof v === "object" && v.ref && Array.isArray(v.constraints));

const resolveMap = async (target: RefObject | QueryObject): Promise<JsonObject> => {
  const refObj = isQueryObject(target) ? target.ref : target;
  const parts = splitPath(refObj.path);
  if (parts.length === 0) return {};

  const root = parts[0];
  if (!ENTITY_SET.has(root)) return {};
  const entity = root as DataEntity;
  const rows = await fetchEntityRows(entity);
  let map = toMap(rows);

  if (parts.length === 1) {
    if (isQueryObject(target)) map = applyConstraints(map, target.constraints);
    return map;
  }

  const id = parts[1];
  const row = map[id];
  if (!row) return {};
  if (parts.length === 2) return { [id]: row };

  const nestedPath = parts.slice(2);
  let current: any = row;
  for (const p of nestedPath) {
    current = current?.[p];
    if (current === undefined) break;
  }
  return { [id]: current };
};

const setByPath = (obj: JsonObject, path: string[], value: any) => {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
};

const mergeByPath = (obj: JsonObject, path: string[], patch: JsonObject) => {
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
    if (i === path.length - 1) {
      cur[key] = { ...cur[key], ...patch };
    } else {
      cur = cur[key];
    }
  }
};

export const ref = (_db: unknown, path: string = ""): RefObject => ({ path });

export const query = (baseRef: RefObject, ...constraints: QueryConstraint[]): QueryObject => ({
  ref: baseRef,
  constraints,
});

export const orderByChild = (key: string): QueryConstraint => ({ kind: "orderByChild", key });
export const equalTo = (value: any): QueryConstraint => ({ kind: "equalTo", value });
export const orderByKey = (): QueryConstraint => ({ kind: "orderByKey" });
export const limitToLast = (count: number): QueryConstraint => ({ kind: "limitToLast", count });

export const get = async (target: RefObject | QueryObject): Promise<DataSnapshot> => {
  const map = await resolveMap(target);
  if (isQueryObject(target)) return new DataSnapshot(map);

  const parts = splitPath(target.path);
  if (parts.length <= 1) return new DataSnapshot(map);
  const id = parts[1];
  const value = map[id];
  return new DataSnapshot(value ?? null);
};

export const set = async (target: RefObject, value: any): Promise<void> => {
  const parts = splitPath(target.path);
  if (parts.length < 1) return;
  const [entity, id, ...rest] = parts;
  if (!ENTITY_SET.has(entity)) return;

  if (!id) {
    if (value && typeof value === "object") {
      const rows = Object.entries(value).map(([rowId, rowValue]) => ({
        ...(typeof rowValue === "object" && rowValue ? (rowValue as JsonObject) : {}),
        id: rowId,
      }));
      await replaceEntityRows(entity, rows);
    } else {
      await replaceEntityRows(entity, []);
    }
    return;
  }

  if (rest.length === 0) {
    await upsertEntityRows(entity, [{ ...(value || {}), id }]);
    return;
  }

  const rows = await fetchEntityRows(entity);
  const existing = rows.find((r) => String(r.id) === id) || { id };
  const next = { ...existing };
  setByPath(next, rest, value);
  const out = rows.filter((r) => String(r.id) !== id);
  out.push(next);
  await replaceEntityRows(entity, out);
};

export const update = async (target: RefObject, patch: JsonObject): Promise<void> => {
  const parts = splitPath(target.path);
  if (parts.length < 1) return;
  const [entity, id, ...rest] = parts;
  if (!ENTITY_SET.has(entity)) return;

  if (!id) {
    const entries = Object.entries(patch || {});
    for (const [key, val] of entries) {
      await set(ref(null, key), val);
    }
    return;
  }

  const rows = await fetchEntityRows(entity);
  const existing = rows.find((r) => String(r.id) === id) || { id };
  const next = { ...existing };
  if (rest.length === 0) {
    Object.assign(next, patch);
  } else {
    mergeByPath(next, rest, patch);
  }
  const out = rows.filter((r) => String(r.id) !== id);
  out.push(next);
  await replaceEntityRows(entity, out);
};

export const remove = async (target: RefObject): Promise<void> => {
  const parts = splitPath(target.path);
  if (parts.length === 0) return;
  const [entity, id] = parts;
  if (!ENTITY_SET.has(entity)) return;

  if (!id) {
    await replaceEntityRows(entity, []);
    return;
  }
  const rows = await fetchEntityRows(entity);
  const out = rows.filter((r) => String(r.id) !== id);
  await replaceEntityRows(entity, out);
};

export const push = (target: RefObject, value?: any): (RefObject & { key: string }) => {
  const key = `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${target.path}/${key}`;
  const out = { path, key };
  if (value !== undefined) {
    void set(out, value);
  }
  return out;
};

export const onValue = (
  target: RefObject | QueryObject,
  callback: (snapshot: DataSnapshot) => void,
  _onError?: (error: unknown) => void
) => {
  let active = true;
  let lastSerialized = "";
  const isScreenActive = () =>
    typeof document === "undefined" || (document.visibilityState === "visible" && document.hasFocus());
  const run = async () => {
    if (!active) return;
    if (!isScreenActive()) return;
    const snap = await get(target);
    const serialized = JSON.stringify(snap.val() ?? null);
    if (serialized !== lastSerialized) {
      lastSerialized = serialized;
      callback(snap);
    }
  };
  void run();
  const interval = window.setInterval(run, 7000);
  const handleActivityChange = () => {
    if (!active) return;
    if (!isScreenActive()) return;
    void run();
  };
  document.addEventListener("visibilitychange", handleActivityChange);
  window.addEventListener("focus", handleActivityChange);
  return () => {
    active = false;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", handleActivityChange);
    window.removeEventListener("focus", handleActivityChange);
  };
};

export const onChildAdded = (
  target: RefObject | QueryObject,
  callback: (snapshot: DataSnapshot) => void
) => {
  let knownKeys = new Set<string>();
  const unsubscribe = onValue(target, (snap) => {
    const value = snap.val() || {};
    Object.entries(value).forEach(([key, row]) => {
      if (knownKeys.has(key)) return;
      knownKeys.add(key);
      callback(new DataSnapshot(row));
    });
  });
  return unsubscribe;
};

export const off = (..._args: any[]) => {
  // No-op in polling-based compat layer
};

export const onDisconnect = (..._args: any[]) => ({
  set: async (_value: any) => {},
  cancel: async () => {},
});

export const serverTimestamp = () => Date.now();
