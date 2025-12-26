import { model } from "@medusajs/framework/utils"

/**
 * Permission model - describes an action that can be performed
 * e.g., "read /admin/products", "write /admin/orders"
 */
export const Permission = model.define("rbac_permission", {
  id: model.id().primaryKey(),
  // Action type: read, write, delete
  action: model.enum(["read", "write", "delete"]),
  // Target resource (API path like /admin/products)
  resource: model.text(),
  // Human-readable name
  name: model.text(),
  // Description of what this permission allows
  description: model.text().nullable(),
  // Category for grouping (e.g., "Products", "Orders", "Customers")
  category: model.text().default("General"),
  // Whether this is a system permission (immutable) or custom
  is_system: model.boolean().default(false),
})
