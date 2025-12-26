import { MedusaService } from "@medusajs/framework/utils"
import { Permission, Role, Policy, UserRole, PendingRole } from "./models"

type PermissionAction = "read" | "write" | "delete"
type PolicyDecision = "allow" | "deny"

export class RBACModuleService extends MedusaService({
  Permission,
  Role,
  Policy,
  UserRole,
  PendingRole,
}) {
  /**
   * Check if a user has permission to perform an action on a resource
   * Returns true if allowed, false if denied
   *
   * Logic:
   * 1. If user has no role assigned, they have full access (default behavior)
   * 2. Find all roles assigned to the user
   * 3. For each role, check policies for the requested action/resource
   * 4. DENY takes precedence over ALLOW
   * 5. If no matching policy, deny by default (when user has a role)
   */
  async checkPermission(
    userId: string,
    action: PermissionAction,
    resource: string
  ): Promise<{ allowed: boolean; reason: string }> {
    // Get user's roles
    const userRoles = await this.listUserRoles({ user_id: userId })

    // If user has no roles, allow everything (default Medusa behavior)
    if (!userRoles || userRoles.length === 0) {
      return { allowed: true, reason: "No role assigned - full access" }
    }

    const roleIds = userRoles.map((ur) => ur.role_id)

    // Find matching permission for this action/resource
    // Support wildcard matching for resources
    const permissions = await this.listPermissions({})
    const matchingPermission = permissions.find((p) => {
      if (p.action !== action) return false
      // Exact match or wildcard match
      if (p.resource === resource) return true
      // Check if permission resource is a prefix (e.g., /admin/products matches /admin/products/123)
      if (resource.startsWith(p.resource)) return true
      // Check wildcard patterns
      if (p.resource.endsWith("/*")) {
        const prefix = p.resource.slice(0, -2)
        if (resource.startsWith(prefix)) return true
      }
      return false
    })

    if (!matchingPermission) {
      // No permission defined for this action/resource - deny by default when role exists
      return { allowed: false, reason: `No permission defined for ${action} ${resource}` }
    }

    // Get all policies for user's roles that match this permission
    const policies = await this.listPolicies({
      role_id: roleIds,
      permission_id: matchingPermission.id,
    })

    if (!policies || policies.length === 0) {
      // User's role has no policy for this permission - deny
      return { allowed: false, reason: `Role has no policy for ${action} ${resource}` }
    }

    // Check for explicit DENY (takes precedence)
    const hasDeny = policies.some((p) => p.decision === "deny")
    if (hasDeny) {
      return { allowed: false, reason: "Explicitly denied by policy" }
    }

    // Check for ALLOW
    const hasAllow = policies.some((p) => p.decision === "allow")
    if (hasAllow) {
      return { allowed: true, reason: "Allowed by policy" }
    }

    // Fallback: deny
    return { allowed: false, reason: "No matching allow policy" }
  }

  /**
   * Get all permissions for a user (combined from all roles)
   */
  async getUserPermissions(userId: string): Promise<{
    permissions: Array<{
      permission: typeof Permission.$inferSelect
      decision: PolicyDecision
    }>
    roles: Array<typeof Role.$inferSelect>
  }> {
    const userRoles = await this.listUserRoles({ user_id: userId })

    if (!userRoles || userRoles.length === 0) {
      return { permissions: [], roles: [] }
    }

    const roleIds = userRoles.map((ur) => ur.role_id)
    const roles = await this.listRoles({ id: roleIds })
    const policies = await this.listPolicies({ role_id: roleIds })
    const allPermissions = await this.listPermissions({})

    // Build permission map with decisions
    const permissionMap = new Map<
      string,
      { permission: typeof Permission.$inferSelect; decision: PolicyDecision }
    >()

    for (const policy of policies) {
      const permission = allPermissions.find((p) => p.id === policy.permission_id)
      if (!permission) continue

      const existing = permissionMap.get(permission.id)
      // DENY takes precedence
      if (!existing || policy.decision === "deny") {
        permissionMap.set(permission.id, {
          permission,
          decision: policy.decision as PolicyDecision,
        })
      }
    }

    return {
      permissions: Array.from(permissionMap.values()),
      roles,
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, roleId: string): Promise<typeof UserRole.$inferSelect> {
    // Check if already assigned
    const existing = await this.listUserRoles({ user_id: userId, role_id: roleId })
    if (existing && existing.length > 0) {
      return existing[0]
    }

    const [userRole] = await this.createUserRoles([
      {
        user_id: userId,
        role_id: roleId,
      },
    ])
    return userRole
  }

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRoles = await this.listUserRoles({ user_id: userId, role_id: roleId })
    if (userRoles && userRoles.length > 0) {
      await this.deleteUserRoles(userRoles.map((ur) => ur.id))
    }
  }

  /**
   * Create a role with policies
   */
  async createRoleWithPolicies(
    name: string,
    description: string | null,
    policies: Array<{ permissionId: string; decision: PolicyDecision }>
  ): Promise<typeof Role.$inferSelect> {
    const [role] = await this.createRoles([
      {
        name,
        description,
        is_system: false,
      },
    ])

    if (policies.length > 0) {
      await this.createPolicies(
        policies.map((p) => ({
          role_id: role.id,
          permission_id: p.permissionId,
          decision: p.decision,
        }))
      )
    }

    return role
  }

  /**
   * Update role policies (replace all)
   */
  async updateRolePolicies(
    roleId: string,
    policies: Array<{ permissionId: string; decision: PolicyDecision }>
  ): Promise<void> {
    // Delete existing policies
    const existingPolicies = await this.listPolicies({ role_id: roleId })
    if (existingPolicies && existingPolicies.length > 0) {
      await this.deletePolicies(existingPolicies.map((p) => p.id))
    }

    // Create new policies
    if (policies.length > 0) {
      await this.createPolicies(
        policies.map((p) => ({
          role_id: roleId,
          permission_id: p.permissionId,
          decision: p.decision,
        }))
      )
    }
  }

  /**
   * Get all categories with their permissions
   */
  async getPermissionsByCategory(): Promise<
    Map<string, Array<typeof Permission.$inferSelect>>
  > {
    const permissions = await this.listPermissions({})
    const categoryMap = new Map<string, Array<typeof Permission.$inferSelect>>()

    for (const permission of permissions) {
      const category = permission.category || "General"
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      categoryMap.get(category)!.push(permission)
    }

    return categoryMap
  }

  /**
   * Get role with all its policies and permissions
   */
  async getRoleWithPolicies(roleId: string): Promise<{
    role: typeof Role.$inferSelect
    policies: Array<{
      policy: typeof Policy.$inferSelect
      permission: typeof Permission.$inferSelect
    }>
  } | null> {
    const [role] = await this.listRoles({ id: roleId })
    if (!role) return null

    const policies = await this.listPolicies({ role_id: roleId })
    const allPermissions = await this.listPermissions({})

    const policiesWithPermissions = policies.map((policy) => ({
      policy,
      permission: allPermissions.find((p) => p.id === policy.permission_id)!,
    })).filter((p) => p.permission)

    return { role, policies: policiesWithPermissions }
  }

  /**
   * Get all users with their roles
   */
  async getUsersWithRoles(): Promise<
    Map<string, Array<typeof Role.$inferSelect>>
  > {
    const userRoles = await this.listUserRoles({})
    const allRoles = await this.listRoles({})

    const userRoleMap = new Map<string, Array<typeof Role.$inferSelect>>()

    for (const ur of userRoles) {
      if (!userRoleMap.has(ur.user_id)) {
        userRoleMap.set(ur.user_id, [])
      }
      const role = allRoles.find((r) => r.id === ur.role_id)
      if (role) {
        userRoleMap.get(ur.user_id)!.push(role)
      }
    }

    return userRoleMap
  }

  /**
   * Create a pending role for an invited user
   * This will be auto-assigned when they accept the invite
   */
  async createPendingRoleForInvite(
    email: string,
    roleId: string
  ): Promise<typeof PendingRole.$inferSelect> {
    // Remove any existing pending role for this email
    const existing = await this.listPendingRoles({ email })
    if (existing && existing.length > 0) {
      await this.deletePendingRoles(existing.map((p) => p.id))
    }

    const [pendingRole] = await this.createPendingRoles([
      {
        email: email.toLowerCase(),
        role_id: roleId,
      },
    ])
    return pendingRole
  }

  /**
   * Get pending role for an email
   */
  async getPendingRoleForEmail(
    email: string
  ): Promise<typeof PendingRole.$inferSelect | null> {
    const pendingRoles = await this.listPendingRoles({ email: email.toLowerCase() })
    return pendingRoles && pendingRoles.length > 0 ? pendingRoles[0] : null
  }

  /**
   * Process pending role when user accepts invite
   * Assigns the role and deletes the pending record
   */
  async processPendingRole(userId: string, email: string): Promise<boolean> {
    const pendingRole = await this.getPendingRoleForEmail(email)
    if (!pendingRole) {
      return false
    }

    // Assign the role
    await this.assignRole(userId, pendingRole.role_id)

    // Delete the pending role
    await this.deletePendingRoles([pendingRole.id])

    return true
  }
}
