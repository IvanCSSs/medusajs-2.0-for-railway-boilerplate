import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../modules/rbac"

// GET /admin/rbac/permissions - List all permissions
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)

  try {
    const permissions = await rbacService.listPermissions({})

    // Group by category
    const byCategory: Record<string, typeof permissions> = {}
    for (const permission of permissions) {
      const category = permission.category || "General"
      if (!byCategory[category]) {
        byCategory[category] = []
      }
      byCategory[category].push(permission)
    }

    return res.json({
      permissions,
      by_category: byCategory,
      count: permissions.length,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// POST /admin/rbac/permissions - Create a custom permission
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { action, resource, name, description, category } = req.body as {
    action: "read" | "write" | "delete"
    resource: string
    name: string
    description?: string
    category?: string
  }

  if (!action || !resource || !name) {
    return res.status(400).json({
      message: "action, resource, and name are required",
    })
  }

  try {
    const [permission] = await rbacService.createPermissions([
      {
        action,
        resource,
        name,
        description: description || null,
        category: category || "Custom",
        is_system: false,
      },
    ])

    return res.status(201).json({ permission })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
