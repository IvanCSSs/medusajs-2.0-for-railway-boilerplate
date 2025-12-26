import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE, RBACModuleService } from "../modules/rbac"

/**
 * Subscriber that auto-assigns pending roles when a user accepts an invite
 * This ensures invited users get their designated role immediately upon account creation
 */
export default async function userCreatedRBACHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const rbacService = container.resolve<RBACModuleService>(RBAC_MODULE)
    const userService = container.resolve(Modules.USER)

    // Get the newly created user
    const user = await userService.retrieveUser(data.id)
    if (!user || !user.email) {
      return
    }

    console.log(`[RBAC] Checking pending role for new user: ${user.email}`)

    // Process any pending role for this email
    const roleAssigned = await rbacService.processPendingRole(user.id, user.email)

    if (roleAssigned) {
      console.log(`[RBAC] Auto-assigned pending role to user: ${user.email}`)
    } else {
      console.log(`[RBAC] No pending role found for user: ${user.email} - user has full access`)
    }
  } catch (error) {
    console.error("[RBAC] Failed to process pending role for new user:", error)
  }
}

export const config: SubscriberConfig = {
  event: "user.created",
}
