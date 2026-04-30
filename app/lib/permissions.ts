/**
 * Granular Sub-Module Permission System - Eurus Lifestyle ERP
 *
 * Permissions follow the pattern: {module}_{submodule}_{action}
 * Actions: view, create, edit (delete is admin-only, not assignable)
 */

export const PERMISSION_GROUPS = [
  {
    id: "inventory",
    name: "Inventory",
    icon: "INV",
    subModules: [
      { id: "inv_items", name: "Items", actions: ["view", "create", "edit"] as const },
      { id: "inv_bulk", name: "Bulk Upload", actions: ["create"] as const },
      { id: "inv_collections", name: "Collections & Categories", actions: ["view", "create", "edit"] as const },
      { id: "inv_grouping", name: "Item Grouping", actions: ["view", "create", "edit"] as const },
      { id: "inv_barcode", name: "Barcode", actions: ["view", "create", "edit"] as const },
    ],
  },
  {
    id: "retail",
    name: "Retail Dispatch",
    icon: "RTL",
    subModules: [
      { id: "retail_packing", name: "Packing", actions: ["view", "create", "edit"] as const },
      { id: "retail_dispatch", name: "Dispatch", actions: ["view", "create", "edit"] as const },
      { id: "retail_box", name: "Box Management", actions: ["view", "create", "edit"] as const },
    ],
  },
  {
    id: "ecom",
    name: "Ecommerce Dispatch",
    icon: "ECM",
    subModules: [
      { id: "ecom_packing", name: "Packing", actions: ["view", "create", "edit"] as const },
      { id: "ecom_dispatch", name: "Dispatch", actions: ["view", "create", "edit"] as const },
      { id: "ecom_box", name: "Box Management", actions: ["view", "create", "edit"] as const },
    ],
  },
  {
    id: "party_rate",
    name: "Party Wise Rate",
    icon: "PR",
    subModules: [
      { id: "party_rate", name: "Party Rate", actions: ["view", "create", "edit"] as const },
    ],
  },
  {
    id: "erm",
    name: "CRM Workspace",
    icon: "ERM",
    subModules: [
      { id: "erm_dashboard", name: "ERM Dashboard", actions: ["view", "create", "edit"] as const },
      { id: "erm_inventory", name: "Inventory", actions: ["view", "create", "edit"] as const },
      { id: "erm_leads", name: "Leads", actions: ["view", "create", "edit"] as const },
      { id: "erm_orders", name: "Orders", actions: ["view", "create", "edit"] as const },
      { id: "erm_catalog", name: "Catalog Sharing", actions: ["view", "create", "edit"] as const },
    ],
  },
  {
    id: "clout",
    name: "Clout",
    icon: "CLT",
    subModules: [
      { id: "clout_drive", name: "Clout Drive", actions: ["view", "create", "edit"] as const },
    ],
  },
] as const;

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
    "erm_view", "erm_create", "erm_edit",
    "clout_view", "clout_create", "clout_edit",
    "crm_view", "crm_create", "crm_edit",
    "reports", "settings", "party-rates",
    "inventory", "dispatch", "erm", "crm", "clout"
  );

  return perms;
}

export const ALL_PERMISSIONS = buildAllPermissions();
export type Permission = string;

const LEGACY_MAP: Record<string, string[]> = {
  // Inventory
  "inventory_view": ["inv_items_view", "inv_collections_view", "inv_grouping_view", "inv_barcode_view"],
  "inventory_create": ["inv_items_create", "inv_bulk_create", "inv_collections_create", "inv_grouping_create", "inv_barcode_create"],
  "inventory_edit": ["inv_items_edit", "inv_collections_edit", "inv_grouping_edit", "inv_barcode_edit"],
  "inventory_delete": [],

  // Retail
  "retail_view": ["retail_packing_view", "retail_dispatch_view", "retail_box_view"],
  "retail_create": ["retail_packing_create", "retail_dispatch_create", "retail_box_create"],
  "retail_edit": ["retail_packing_edit", "retail_dispatch_edit", "retail_box_edit"],
  "retail_delete": [],

  // Ecom
  "ecom_view": ["ecom_packing_view", "ecom_dispatch_view", "ecom_box_view"],
  "ecom_create": ["ecom_packing_create", "ecom_dispatch_create", "ecom_box_create"],
  "ecom_edit": ["ecom_packing_edit", "ecom_dispatch_edit", "ecom_box_edit"],
  "ecom_delete": [],

  // Older broad keys
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

  // Party rates
  "party-rates": ["party_rate_view", "party_rate_create", "party_rate_edit"],

  // ERM / CRM
  "erm_view": ["erm_dashboard_view", "erm_inventory_view", "erm_leads_view", "erm_orders_view", "erm_catalog_view"],
  "erm_create": ["erm_dashboard_create", "erm_inventory_create", "erm_leads_create", "erm_orders_create", "erm_catalog_create"],
  "erm_edit": ["erm_dashboard_edit", "erm_inventory_edit", "erm_leads_edit", "erm_orders_edit", "erm_catalog_edit"],
  "erm": [
    "erm_dashboard_view", "erm_dashboard_create", "erm_dashboard_edit",
    "erm_inventory_view", "erm_inventory_create", "erm_inventory_edit",
    "erm_leads_view", "erm_leads_create", "erm_leads_edit",
    "erm_orders_view", "erm_orders_create", "erm_orders_edit",
    "erm_catalog_view", "erm_catalog_create", "erm_catalog_edit",
  ],
  "crm_view": ["erm_dashboard_view", "erm_inventory_view", "erm_leads_view", "erm_orders_view", "erm_catalog_view"],
  "crm_create": ["erm_dashboard_create", "erm_inventory_create", "erm_leads_create", "erm_orders_create", "erm_catalog_create"],
  "crm_edit": ["erm_dashboard_edit", "erm_inventory_edit", "erm_leads_edit", "erm_orders_edit", "erm_catalog_edit"],
  "crm": [
    "erm_dashboard_view", "erm_dashboard_create", "erm_dashboard_edit",
    "erm_inventory_view", "erm_inventory_create", "erm_inventory_edit",
    "erm_leads_view", "erm_leads_create", "erm_leads_edit",
    "erm_orders_view", "erm_orders_create", "erm_orders_edit",
    "erm_catalog_view", "erm_catalog_create", "erm_catalog_edit",
  ],

  // Clout
  "clout_view": ["clout_drive_view"],
  "clout_create": ["clout_drive_create"],
  "clout_edit": ["clout_drive_edit"],
  "clout": ["clout_drive_view", "clout_drive_create", "clout_drive_edit"],
};

interface UserLike {
  role?: string;
  permissions?: string[];
  email?: string;
}

const EMAIL_PERMISSION_OVERRIDES: Record<string, Permission[]> = {
  "tannu.mahindra@euruslifestyle.in": [
    "retail_packing_view",
    "retail_packing_create",
    "retail_packing_edit",
    "retail_dispatch_view",
    "retail_dispatch_create",
    "retail_dispatch_edit",
  ],
};

export function hasPermission(
  user: UserLike | null | undefined,
  permission: Permission,
  ignoreAdminRole: boolean = false
): boolean {
  if (!user) return false;

  if (user.role === "admin" && !ignoreAdminRole) return true;

  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const emailOverrides = normalizedEmail ? EMAIL_PERMISSION_OVERRIDES[normalizedEmail] : undefined;
  if (emailOverrides?.includes(permission)) return true;

  const userPerms = user.permissions || [];

  // 1) Direct match
  if (userPerms.includes(permission)) return true;

  // 2) Legacy permission grants granular key
  for (const userPerm of userPerms) {
    const mapped = LEGACY_MAP[userPerm];
    if (mapped && mapped.includes(permission)) return true;
  }

  // 3) Implied: edit/create implies view
  if (permission.endsWith("_view")) {
    const base = permission.replace(/_view$/, "");
    if (userPerms.includes(`${base}_create`) || userPerms.includes(`${base}_edit`)) {
      return true;
    }
    for (const userPerm of userPerms) {
      const mapped = LEGACY_MAP[userPerm];
      if (mapped && (mapped.includes(`${base}_create`) || mapped.includes(`${base}_edit`))) {
        return true;
      }
    }
  }

  // 4) If requested key itself is legacy broad key
  if (LEGACY_MAP[permission]) {
    const requiredGranularPerms = LEGACY_MAP[permission];
    for (const m of requiredGranularPerms) {
      if (
        userPerms.includes(m) ||
        (m.endsWith("_view") &&
          (userPerms.includes(m.replace(/_view$/, "_edit")) || userPerms.includes(m.replace(/_view$/, "_create"))))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function hasAnyPermission(user: UserLike | null | undefined, permissions: Permission[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permissions.some((p) => hasPermission(user, p));
}

export function canDelete(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin";
}

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
