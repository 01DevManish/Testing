type CrmWorkspaceUserLike = {
  role?: string;
  crmWorkspaceCreated?: boolean;
};

export function hasCrmWorkspace(user: CrmWorkspaceUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(user.crmWorkspaceCreated);
}

