import { model } from "@medusajs/framework/utils"

/**
 * UserRole model - assigns a role to a user
 */
export const UserRole = model.define("rbac_user_role", {
  id: model.id().primaryKey(),
  // The user ID (from Medusa's user table)
  user_id: model.text(),
  // The role assigned to this user
  role_id: model.text(),
})
