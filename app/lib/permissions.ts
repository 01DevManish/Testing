/**
 * Permission helper utilities for Eurus Lifestyle
 * 
 * Available permissions: "dispatch", "inventory", "reports", "settings"
 * Admin role always has full access to everything.
 */

export const ALL_PERMISSIONS = ["dispatch", "inventory", "reports", "settings"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

interface UserLike {
  role?: string;
  permissions?: string[];
}

/**
 * Check if a user has a specific permission.
 * Admin users always return true.
 */
export function hasPermission(user: UserLike | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(user: UserLike | null | undefined, permissions: Permission[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permissions.some(p => user.permissions?.includes(p));
}
