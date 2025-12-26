import { model } from "@medusajs/framework/utils"

/**
 * PendingRole model - stores role assignments for pending invites
 * When a user is invited with a role, we store it here.
 * When the user accepts the invite, we auto-assign the role.
 */
export const PendingRole = model.define("rbac_pending_role", {
  id: model.id().primaryKey(),
  // The email of the invited user
  email: model.text(),
  // The role to assign when they accept
  role_id: model.text(),
})
