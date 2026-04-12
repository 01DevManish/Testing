/**
 * Granular Sub-Module Permission System — Eurus Lifestyle ERP
 * 
 * Permissions follow the pattern: {module}_{submodule}_{action}
 * Actions: view, create, edit  (delete is admin-only, not assignable)
 * 
 * Admin role always has FULL access to everything including delete.
 */

// ── Permission Group Definitions ──────────────────────────────
export const PERMISSION_GROUPS = [
  {
    id: "inventory",
    name: "Inventory",
    icon: "📦",
    subModules: [
      { id: "inv_items", name: "Items", actions: ["view", "create", "edit"] as const },
      { id: "inv_bulk", name: "Bulk Upload", actions: ["create"] as const },
      { id: "inv_collections", name: "Collections & Categories", actions: ["view", "create", "edit"] as const },
      { id: "inv_grouping", name: "Item Grouping", actions: ["view", "create", "edit"] as const },
      { id: "inv_barcode", name: "Barcode", actions: ["view", "create", "edit"] as const },
    ]
  },
  {
    id: "retail",
    name: "Retail Dispatch",
    icon: "🚚",
    subModules: [
      { id: "retail_packing", name: "Packing", actions: ["view", "create", "edit"] as const },
      { id: "retail_dispatch", name: "Dispatch", actions: ["view", "create", "edit"] as const },
      { id: "retail_box", name: "Box Management", actions: ["view", "create", "edit"] as const },
    ]
  },
  {
    id: "ecom",
    name: "Ecommerce Dispatch",
    icon: "🛒",
    subModules: [
      { id: "ecom_packing", name: "Packing", actions: ["view", "create", "edit"] as const },
      { id: "ecom_dispatch", name: "Dispatch", actions: ["view", "create", "edit"] as const },
      { id: "ecom_box", name: "Box Management", actions: ["view", "create", "edit"] as const },
    ]
  },
  {
    id: "party_rate",
    name: "Party Wise Rate",
    icon: "💰",
    subModules: [
      { id: "party_rate", name: "Party Rate", actions: ["view", "create", "edit"] as const },
    ]
  }
] as const;

// ── Flatten all possible permission keys ──────────────────────
function buildAllPermissions(): string[] {
  const perms: string[] = [];
  for (const group of PERMISSION_GROUPS) {
    for (const sub of group.subModules) {
      for (const action of sub.actions) {
        perms.push(`${sub.id}_${action}`);
      }
    }
  }
  // Legacy keys for backward compatibility
  perms.push(
    "inventory_view", "inventory_create", "inventory_edit", "inventory_delete",
    "retail_view", "retail_create", "retail_edit", "retail_delete",
    "ecom_view", "ecom_create", "ecom_edit", "ecom_delete",
    "reports", "settings", "party-rates",
    "inventory", "dispatch"
  );
  return perms;
}

export const ALL_PERMISSIONS = buildAllPermissions();
export type Permission = string; // Flexible for granular + legacy

// ── Legacy → Granular Mapping ─────────────────────────────────
const LEGACY_MAP: Record<string, string[]> = {
  // Old broad 'inventory_view' → all inventory sub-module views
  "inventory_view":   ["inv_items_view", "inv_collections_view", "inv_grouping_view", "inv_barcode_view"],
  "inventory_create": ["inv_items_create", "inv_bulk_create", "inv_collections_create", "inv_grouping_create", "inv_barcode_create"],
  "inventory_edit":   ["inv_items_edit", "inv_collections_edit", "inv_grouping_edit", "inv_barcode_edit"],
  "inventory_delete": [], // delete is admin-only now

  // Old broad 'retail_view' → all retail sub-module views
  "retail_view":   ["retail_packing_view", "retail_dispatch_view", "retail_box_view"],
  "retail_create": ["retail_packing_create", "retail_dispatch_create", "retail_box_create"],
  "retail_edit":   ["retail_packing_edit", "retail_dispatch_edit", "retail_box_edit"],
  "retail_delete": [],

  // Old broad 'ecom_view' → all ecom sub-module views
  "ecom_view":   ["ecom_packing_view", "ecom_dispatch_view", "ecom_box_view"],
  "ecom_create": ["ecom_packing_create", "ecom_dispatch_create", "ecom_box_create"],
  "ecom_edit":   ["ecom_packing_edit", "ecom_dispatch_edit", "ecom_box_edit"],
  "ecom_delete": [],

  // Very old legacy keys
  "inventory": [
    "inv_items_view", "inv_items_create", "inv_items_edit",
    "inv_bulk_create",
    "inv_collections_view", "inv_collections_create", "inv_collections_edit",
    "inv_grouping_view", "inv_grouping_create", "inv_grouping_edit",
    "inv_barcode_view", "inv_barcode_create", "inv_barcode_edit",
  ],
  "dispatch": [
    "retail_packing_view", "retail_packing_create", "retail_packing_edit",
    "retail_dispatch_view", "retail_dispatch_create", "retail_dispatch_edit",
    "retail_box_view", "retail_box_create", "retail_box_edit",
    "ecom_packing_view", "ecom_packing_create", "ecom_packing_edit",
    "ecom_dispatch_view", "ecom_dispatch_create", "ecom_dispatch_edit",
    "ecom_box_view", "ecom_box_create", "ecom_box_edit",
  ],

  // party-rates legacy
  "party-rates": ["party_rate_view", "party_rate_create", "party_rate_edit"],
};

interface UserLike {
  role?: string;
  permissions?: string[];
}

/**
 * Check if a user has a specific permission.
 * Admin users always return true (including delete).
 * Handles backward compatibility via LEGACY_MAP.
 */
export function hasPermission(user: UserLike | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  const userPerms = user.permissions || [];

  // 1. Direct match
  if (userPerms.includes(permission)) return true;

  // 2. Check if any of the user's legacy permissions grant this new granular permission
  for (const userPerm of userPerms) {
    const mapped = LEGACY_MAP[userPerm];
    if (mapped && mapped.includes(permission)) return true;
  }

  // 3. Implied: if you can edit, you can view
  if (permission.endsWith("_view")) {
    const base = permission.replace(/_view$/, "");
    if (userPerms.includes(`${base}_create`) || userPerms.includes(`${base}_edit`)) {
      return true;
    }
    // Also check legacy implication
    for (const userPerm of userPerms) {
      const mapped = LEGACY_MAP[userPerm];
      if (mapped && (mapped.includes(`${base}_create`) || mapped.includes(`${base}_edit`))) {
        return true;
      }
    }
  }

  // 4. Reverse Mapping: If the requested permission is a legacy broad group (e.g., "retail_view"),
  // return true if the user has ANY of the granular permissions that belong to it.
  if (LEGACY_MAP[permission]) {
    const requiredGranularPerms = LEGACY_MAP[permission];
    for (const m of requiredGranularPerms) {
      if (
        userPerms.includes(m) || 
        (m.endsWith("_view") && (userPerms.includes(m.replace(/_view$/, "_edit")) || userPerms.includes(m.replace(/_view$/, "_create"))))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(user: UserLike | null | undefined, permissions: Permission[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permissions.some(p => hasPermission(user, p));
}

/**
 * Check if user can delete. Only admin can delete.
 */
export function canDelete(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin";
}

/**
 * Get all granular permission keys for "select all" in admin UI
 */
export function getAllGranularPermissions(): string[] {
  const perms: string[] = [];
  for (const group of PERMISSION_GROUPS) {
    for (const sub of group.subModules) {
      for (const action of sub.actions) {
        perms.push(`${sub.id}_${action}`);
      }
    }
  }
  return perms;
}
