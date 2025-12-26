import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../../../../modules/rbac"

// GET /admin/rbac/permissions/:id - Get a permission
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params

  try {
    const [permission] = await rbacService.listPermissions({ id })
    if (!permission) {
      return res.status(404).json({ message: "Permission not found" })
    }
    return res.json({ permission })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// POST /admin/rbac/permissions/:id - Update a permission
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params
  const { name, description, category } = req.body as {
    name?: string
    description?: string
    category?: string
  }

  try {
    const [existing] = await rbacService.listPermissions({ id })
    if (!existing) {
      return res.status(404).json({ message: "Permission not found" })
    }

    if (existing.is_system) {
      return res.status(400).json({ message: "Cannot modify system permissions" })
    }

    const [permission] = await rbacService.updatePermissions([
      {
        id,
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        category: category || existing.category,
      },
    ])

    return res.json({ permission })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}

// DELETE /admin/rbac/permissions/:id - Delete a permission
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
  const { id } = req.params

  try {
    const [existing] = await rbacService.listPermissions({ id })
    if (!existing) {
      return res.status(404).json({ message: "Permission not found" })
    }

    if (existing.is_system) {
      return res.status(400).json({ message: "Cannot delete system permissions" })
    }

    await rbacService.deletePermissions([id])
    return res.json({ success: true })
  } catch (error: any) {
    return res.status(500).json({ message: error.message })
  }
}
