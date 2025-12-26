import { model } from "@medusajs/framework/utils"

/**
 * Role model - a named collection of policies
 * e.g., "Editor", "Viewer", "Order Manager"
 */
export const Role = model.define("rbac_role", {
  id: model.id().primaryKey(),
  // Role name (unique)
  name: model.text(),
  // Description of the role
  description: model.text().nullable(),
  // Whether this is a system role (immutable)
  is_system: model.boolean().default(false),
})
