/* ── ERM Leads – Shared helpers ── */

const ERM_LEADS_CACHE_KEY = "eurus_cache_erm_leads";
const ERM_LEAD_CALLS_CACHE_KEY = "eurus_cache_erm_lead_calls";

export { ERM_LEADS_CACHE_KEY, ERM_LEAD_CALLS_CACHE_KEY };

/* ── Sorting ── */
export const sortByUpdatedAtDesc = <T extends { updatedAt?: number }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));

export const sortByCalledAtDesc = <T extends { calledAt?: number }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => (Number(b.calledAt) || 0) - (Number(a.calledAt) || 0));

/* ── LocalStorage cache ── */
export const parseCachedArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const saveCachedArray = (key: string, value: unknown[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* no-op */ }
};

/* ── Entity ID ── */
export const generateEntityId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/* ── CSV parsing ── */
export const parseCsvRows = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ""; });
    return row;
  });
};

export const normalizeHeader = (value: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const pickFromRow = (row: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const val = row[normalizeHeader(key)] ?? row[key] ?? "";
    if (String(val || "").trim()) return String(val).trim();
  }
  return "";
};

/* ── Date formatting ── */
export const fmtDate = (ts?: number) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (ts?: number) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

/* ── Excel export ── */
export const exportLeadsToExcel = async (
  leads: Array<Record<string, unknown>>,
  fileName = "erm_leads_export"
) => {
  const XLSX = await import("xlsx");
  const rows = leads.map((l, i) => ({
    "SR. No.": i + 1,
    "Date / Time": l.createdAt ? new Date(Number(l.createdAt)).toLocaleString("en-IN") : "",
    "Source": l.source || "",
    "POC Name": l.name || "",
    "Phone No.": l.phone || "",
    "Address": l.address || "",
    "Email ID": l.email || "",
    "Company Name": l.company || "",
    "City": l.city || "",
    "State": l.state || "",
    "Pincode": l.pincode || "",
    "Status": String(l.status || "").replace(/_/g, " "),
    "Assign To": l.assignedToName || "",
    "Notes": l.notes || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/* ── Template download ── */
/* ── Template download ── */
export const downloadLeadsTemplate = async (staff: { uid: string; name: string }[] = []) => {
  const exceljsLib = await import("exceljs");
  const ExcelJS = exceljsLib.default || exceljsLib;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Leads Template");

  const headers = ["Source", "POC Name", "Phone No.", "Address", "Email ID", "Company Name", "City", "State", "Pincode", "Assign To"];
  ws.addRow(headers);
  
  // Apply bold header
  ws.getRow(1).font = { bold: true };
  ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(h.length + 4, 16) }));

  // Sample row
  ws.addRow({
    "Source": "Website",
    "POC Name": "Rahul Sharma",
    "Phone No.": "9876543210",
    "Address": "123 MG Road",
    "Email ID": "rahul@example.com",
    "Company Name": "ABC Pvt Ltd",
    "City": "Mumbai",
    "State": "Maharashtra",
    "Pincode": "400001",
    "Assign To": ""
  });

  // Data Validation for 'Assign To'
  if (staff.length > 0) {
    const staffNames = staff.map(s => s.name.replace(/,/g, "")); // remove commas from names just in case
    const formula = `"${staffNames.join(",")}"`;
    
    // Apply validation to column J (Assign To is the 10th column) from row 2 to 1000
    for (let i = 2; i <= 1000; i++) {
      ws.getCell(`J${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula]
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "erm_leads_template.xlsx";
  a.click();
  window.URL.revokeObjectURL(url);
};
