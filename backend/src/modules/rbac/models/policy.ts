import { model } from "@medusajs/framework/utils"

/**
 * Policy model - links a permission to a role with an ALLOW or DENY decision
 */
export const Policy = model.define("rbac_policy", {
  id: model.id().primaryKey(),
  // The role this policy belongs to
  role_id: model.text(),
  // The permission this policy applies to
  permission_id: model.text(),
  // The decision: allow or deny
  decision: model.enum(["allow", "deny"]),
})
