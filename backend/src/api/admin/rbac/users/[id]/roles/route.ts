import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../../../modules/rbac"

// GET /admin/rbac/users/:id/roles - Get user's roles
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id: userId } = req.params

  try {
    const userRoles = await rbacService.listUserRoles({ user_id: userId })
    const roleIds = userRoles.map((ur) => ur.role_id)

    let roles: any[] = []
    if (roleIds.length > 0) {
      roles = await rbacService.listRoles({ id: roleIds })
    }

    return res.json({ roles })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// POST /admin/rbac/users/:id/roles - Assign a role to user
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id: userId } = req.params
  const { role_id } = req.body as { role_id: string }

  if (!role_id) {
    return res.status(400).json({ message: "role_id is required" })
  }

  try {
    // Verify role exists
    const [role] = await rbacService.listRoles({ id: role_id })
    if (!role) {
      return res.status(404).json({ message: "Role not found" })
    }

    const userRole = await rbacService.assignRole(userId, role_id)
    return res.status(201).json({ user_role: userRole, role })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// DELETE /admin/rbac/users/:id/roles - Remove a role from user
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id: userId } = req.params
  const { role_id } = req.body as { role_id: string }

  if (!role_id) {
    return res.status(400).json({ message: "role_id is required" })
  }

  try {
    await rbacService.removeRole(userId, role_id)
    return res.json({ success: true })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
