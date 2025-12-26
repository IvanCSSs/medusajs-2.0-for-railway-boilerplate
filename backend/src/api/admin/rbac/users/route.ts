import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"
import { Modules } from "@medusajs/framework/utils"

// GET /admin/rbac/users - List all users with their roles
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const userService = req.scope.resolve(Modules.USER)

  try {
    // Get all admin users
    const users = await userService.listUsers({})

    // Get role assignments
    const userRolesMap = await rbacService.getUsersWithRoles()

    // Combine data
    const usersWithRoles = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      roles: userRolesMap.get(user.id) || [],
    }))

    return res.json({
      users: usersWithRoles,
      count: users.length,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
