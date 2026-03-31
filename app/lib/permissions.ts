/**
 * Permission helper utilities for Eurus Lifestyle
 * 
 * Available permissions: 
 * - Inventory: inventory_view, inventory_create, inventory_edit, inventory_delete
 * - Retail Dispatch: retail_view, retail_create, retail_edit, retail_delete
 * - Ecom Dispatch: ecom_view, ecom_create, ecom_edit, ecom_delete
 * - Others: reports, settings, party-rates
 * 
 * Admin role always has full access to everything.
 */

export const PERMISSION_GROUPS = [
  {
    name: "Inventory",
    prefix: "inventory",
    actions: ["view", "create", "edit", "delete"]
  },
  {
    name: "Retail Dispatch",
    prefix: "retail",
    actions: ["view", "create", "edit", "delete"]
  },
  {
    name: "Ecom Dispatch",
    prefix: "ecom",
    actions: ["view", "create", "edit", "delete"]
  },
  {
    name: "General",
    prefix: "general",
    permissions: ["reports", "settings", "party-rates"]
  }
] as const;

// Flatten permissions for types and constants
export const ALL_PERMISSIONS = [
  "inventory_view", "inventory_create", "inventory_edit", "inventory_delete",
  "retail_view", "retail_create", "retail_edit", "retail_delete",
  "ecom_view", "ecom_create", "ecom_edit", "ecom_delete",
  "reports", "settings", "party-rates",
  // Legacy keys for migration support
  "inventory", "dispatch"
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

interface UserLike {
  role?: string;
  permissions?: string[];
}

/**
 * Check if a user has a specific permission.
 * Admin users always return true.
 * Handles backward compatibility for 'inventory' and 'dispatch' legacy keys.
 */
export function hasPermission(user: UserLike | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  
  const userPerms = user.permissions || [];

  // 1. Check direct match
  if (userPerms.includes(permission)) return true;

  // 2. Handle Migration / Legacy Keys
  // If user has 'inventory', they have all 'inventory_*' permissions
  if (permission.startsWith("inventory_") && userPerms.includes("inventory")) return true;

  // If user has 'dispatch', they have all 'retail_*' and 'ecom_*' permissions
  if ((permission.startsWith("retail_") || permission.startsWith("ecom_")) && userPerms.includes("dispatch")) return true;

  // 3. Implied permissions (e.g., if you can edit, you can view)
  if (permission.endsWith("_view")) {
    const base = permission.replace("_view", "");
    if (userPerms.includes(`${base}_create`) || userPerms.includes(`${base}_edit`) || userPerms.includes(`${base}_delete`)) {
      return true;
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
