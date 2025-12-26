import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../../modules/rbac"

// GET /admin/rbac/roles/:id - Get a role with policies
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params

  try {
    const result = await rbacService.getRoleWithPolicies(id)
    if (!result) {
      return res.status(404).json({ message: "Role not found" })
    }
    return res.json(result)
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// POST /admin/rbac/roles/:id - Update a role
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params
  const { name, description, policies } = req.body as {
    name?: string
    description?: string
    policies?: Array<{ permission_id: string; decision: "allow" | "deny" }>
  }

  try {
    const [existing] = await rbacService.listRoles({ id })
    if (!existing) {
      return res.status(404).json({ message: "Role not found" })
    }

    if (existing.is_system) {
      return res.status(400).json({ message: "Cannot modify system roles" })
    }

    // Update role info
    if (name || description !== undefined) {
      await rbacService.updateRoles([
        {
          id,
          name: name || existing.name,
          description: description !== undefined ? description : existing.description,
        },
      ])
    }

    // Update policies if provided
    if (policies) {
      await rbacService.updateRolePolicies(
        id,
        policies.map((p) => ({
          permissionId: p.permission_id,
          decision: p.decision,
        }))
      )
    }

    const result = await rbacService.getRoleWithPolicies(id)
    return res.json(result)
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// DELETE /admin/rbac/roles/:id - Delete a role
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params

  try {
    const [existing] = await rbacService.listRoles({ id })
    if (!existing) {
      return res.status(404).json({ message: "Role not found" })
    }

    if (existing.is_system) {
      return res.status(400).json({ message: "Cannot delete system roles" })
    }

    // Delete all policies for this role first
    const policies = await rbacService.listPolicies({ role_id: id })
    if (policies.length > 0) {
      await rbacService.deletePolicies(policies.map((p) => p.id))
    }

    // Delete all user-role assignments
    const userRoles = await rbacService.listUserRoles({ role_id: id })
    if (userRoles.length > 0) {
      await rbacService.deleteUserRoles(userRoles.map((ur) => ur.id))
    }

    // Delete the role
    await rbacService.deleteRoles([id])

    return res.json({ success: true })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
