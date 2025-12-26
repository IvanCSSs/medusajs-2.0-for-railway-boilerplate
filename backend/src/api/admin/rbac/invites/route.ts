import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { IEventBusModuleService } from "@medusajs/framework/types"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"

/**
 * POST /admin/rbac/invites
 * Create an invite with an assigned role
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { email, role_id } = req.body as { email: string; role_id: string }

    if (!email || !role_id) {
      return res.status(400).json({
        message: "Email and role_id are required",
      })
    }

    const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
    const userService = req.scope.resolve(Modules.USER)
    const eventBus = req.scope.resolve<IEventBusModuleService>(Modules.EVENT_BUS)

    // Verify role exists
    const roles = await rbacService.listRoles({ id: role_id })
    if (!roles || roles.length === 0) {
      return res.status(400).json({
        message: "Invalid role_id",
      })
    }

    // Create the pending role (will be assigned when user accepts)
    await rbacService.createPendingRoleForInvite(email, role_id)

    // Create the actual invite using Medusa's invite system
    const invite = await userService.createInvites({ email })

    // Emit the invite.created event to trigger email sending
    await eventBus.emit({
      name: "invite.created",
      data: { id: invite.id },
    })

    res.json({
      invite,
      pending_role: {
        email,
        role_id,
        role_name: roles[0].name,
      },
      message: `Invite sent to ${email}. Role "${roles[0].name}" will be assigned when they accept.`,
    })
  } catch (error: any) {
    console.error("Failed to create invite with role:", error)
    res.status(500).json({
      message: error.message || "Failed to create invite",
    })
  }
}

/**
 * GET /admin/rbac/invites
 * List all pending invites with their assigned roles
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
    const userService = req.scope.resolve(Modules.USER)

    // Get all pending roles
    const pendingRoles = await rbacService.listPendingRoles({})
    const allRoles = await rbacService.listRoles({})

    // Get all invites
    const invites = await userService.listInvites({})

    // Combine the data
    const invitesWithRoles = invites.map((invite: any) => {
      const pendingRole = pendingRoles.find(
        (pr) => pr.email.toLowerCase() === invite.email.toLowerCase()
      )
      const role = pendingRole
        ? allRoles.find((r) => r.id === pendingRole.role_id)
        : null

      return {
        ...invite,
        pending_role: role
          ? { id: role.id, name: role.name }
          : null,
      }
    })

    res.json({
      invites: invitesWithRoles,
    })
  } catch (error: any) {
    console.error("Failed to list invites:", error)
    res.status(500).json({
      message: error.message || "Failed to list invites",
    })
  }
}
