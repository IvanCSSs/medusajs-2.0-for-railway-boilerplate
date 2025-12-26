import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"

// GET /admin/rbac/roles - List all roles
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)

  try {
    const roles = await rbacService.listRoles({})

    // Get policies for each role
    const rolesWithPolicies = await Promise.all(
      roles.map(async (role) => {
        const result = await rbacService.getRoleWithPolicies(role.id)
        return {
          ...role,
          policies: result?.policies || [],
        }
      })
    )

    return res.json({
      roles: rolesWithPolicies,
      count: roles.length,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// POST /admin/rbac/roles - Create a role
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { name, description, policies } = req.body as {
    name: string
    description?: string
    policies?: Array<{ permission_id: string; decision: "allow" | "deny" }>
  }

  if (!name) {
    return res.status(400).json({ message: "name is required" })
  }

  try {
    const role = await rbacService.createRoleWithPolicies(
      name,
      description || null,
      (policies || []).map((p) => ({
        permissionId: p.permission_id,
        decision: p.decision,
      }))
    )

    const roleWithPolicies = await rbacService.getRoleWithPolicies(role.id)
    return res.status(201).json({ role: roleWithPolicies })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
