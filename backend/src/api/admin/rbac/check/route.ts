import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"

/**
 * POST /admin/rbac/check - Check if current user has permission
 *
 * This endpoint allows frontend code to check permissions before
 * showing UI elements or making API calls.
 *
 * Body: { action: "read" | "write" | "delete", resource: "/admin/products" }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { action, resource } = req.body as {
    action: "read" | "write" | "delete"
    resource: string
  }

  if (!action || !resource) {
    return res.status(400).json({
      message: "action and resource are required",
    })
  }

  // Get current user from auth context
  const userId = (req as any).auth_context?.actor_id

  if (!userId) {
    return res.status(401).json({
      allowed: false,
      reason: "Not authenticated",
    })
  }

  try {
    const result = await rbacService.checkPermission(userId, action, resource)
    return res.json(result)
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * GET /admin/rbac/check - Get all permissions for current user
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)

  // Get current user from auth context
  const userId = (req as any).auth_context?.actor_id

  if (!userId) {
    return res.status(401).json({
      allowed: false,
      reason: "Not authenticated",
    })
  }

  try {
    const result = await rbacService.getUserPermissions(userId)
    return res.json(result)
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
