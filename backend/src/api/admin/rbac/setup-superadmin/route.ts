import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"

/**
 * POST /admin/rbac/setup-superadmin
 * One-time setup to create superadmin role and assign it to a user
 * This endpoint should be removed or protected after initial setup
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { email } = req.body as { email: string }

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      })
    }

    const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
    const userService = req.scope.resolve(Modules.USER)

    // Find the user by email
    const users = await userService.listUsers({ email: email.toLowerCase() })
    if (!users || users.length === 0) {
      return res.status(404).json({
        message: `User with email ${email} not found`,
      })
    }

    const user = users[0]

    // Check if superadmin role exists
    let superadminRole = await rbacService.listRoles({ name: "Superadmin" })

    if (!superadminRole || superadminRole.length === 0) {
      // Create superadmin role
      const [newRole] = await rbacService.createRoles([
        {
          name: "Superadmin",
          description: "Full access to all resources",
          is_system: true,
        },
      ])
      superadminRole = [newRole]
      console.log("[setup-superadmin] Created Superadmin role:", newRole.id)
    }

    // Assign the role to the user
    await rbacService.assignRole(user.id, superadminRole[0].id)

    console.log(`[setup-superadmin] Assigned Superadmin role to ${email} (${user.id})`)

    res.json({
      message: `Successfully made ${email} a superadmin`,
      user_id: user.id,
      role_id: superadminRole[0].id,
    })
  } catch (error: any) {
    console.error("Failed to setup superadmin:", error)
    res.status(500).json({
      message: error.message || "Failed to setup superadmin",
    })
  }
}
