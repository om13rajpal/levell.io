import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

// Role IDs matching team_roles table
export const ROLES = {
  ADMIN: 1,
  SALES_MANAGER: 2,
  MEMBER: 3,
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

// Permission actions
export type Permission =
  | "invite_member"
  | "remove_member"
  | "create_team"
  | "delete_team"
  | "view_team_analytics"
  | "manage_prompts"
  | "change_member_role"
  | "move_member"
  | "view_own_data"
  | "view_team_data"
  | "manage_billing";

// Permission matrix: which roles can perform which actions
const PERMISSION_MATRIX: Record<Permission, RoleId[]> = {
  invite_member: [ROLES.ADMIN, ROLES.SALES_MANAGER],
  remove_member: [ROLES.ADMIN, ROLES.SALES_MANAGER],
  create_team: [ROLES.ADMIN],
  delete_team: [ROLES.ADMIN],
  view_team_analytics: [ROLES.ADMIN, ROLES.SALES_MANAGER],
  manage_prompts: [ROLES.ADMIN],
  change_member_role: [ROLES.ADMIN],
  move_member: [ROLES.ADMIN, ROLES.SALES_MANAGER],
  view_own_data: [ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.MEMBER],
  view_team_data: [ROLES.ADMIN, ROLES.SALES_MANAGER],
  manage_billing: [ROLES.ADMIN],
};

/**
 * Get user's role in a team
 */
export async function getUserRole(
  userId: string,
  teamId: number
): Promise<{ roleId: RoleId | null; roleName: string | null; isSalesManager: boolean }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("team_org")
    .select("team_role_id, is_sales_manager, team_roles(role_name)")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return { roleId: null, roleName: null, isSalesManager: false };
  }

  return {
    roleId: data.team_role_id as RoleId,
    roleName: (data as any).team_roles?.role_name || null,
    isSalesManager: data.is_sales_manager || false,
  };
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  teamId: number,
  permission: Permission
): Promise<boolean> {
  const { roleId } = await getUserRole(userId, teamId);
  if (!roleId) return false;

  const allowedRoles = PERMISSION_MATRIX[permission];
  return allowedRoles.includes(roleId);
}

/**
 * Check permission synchronously when role is already known
 */
export function checkPermission(roleId: RoleId, permission: Permission): boolean {
  const allowedRoles = PERMISSION_MATRIX[permission];
  return allowedRoles.includes(roleId);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(roleId: RoleId): Permission[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([, roles]) => roles.includes(roleId))
    .map(([permission]) => permission as Permission);
}
