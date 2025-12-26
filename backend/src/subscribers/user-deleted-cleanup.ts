import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { IAuthModuleService } from "@medusajs/framework/types"
import { RBAC_MODULE, RBACModuleService } from "../modules/rbac"

/**
 * Subscriber that cleans up auth identities and RBAC data when a user is deleted.
 * This prevents "Identity with email already exists" errors when re-inviting users.
 *
 * Known MedusaJS bug: https://github.com/medusajs/medusa/issues/11791
 * Provider identity information is not being removed when deleting users/customers.
 */
export default async function userDeletedCleanupHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
    const rbacService = container.resolve<RBACModuleService>(RBAC_MODULE)

    // data.id is the user ID that was deleted
    console.log(`[user-deleted-cleanup] Processing deletion for user ID: ${data.id}`)

    // Find auth identities linked to this user ID
    // The user_id is stored in app_metadata.user_id
    // We need to list all and filter since app_metadata filtering may not work directly
    const allAuthIdentities = await authService.listAuthIdentities(
      {},
      { relations: ["provider_identities"] }
    )

    // Filter to find identities linked to this user
    const userAuthIdentities = allAuthIdentities.filter((identity) => {
      const appMetadata = identity.app_metadata as Record<string, unknown> | undefined
      return appMetadata?.user_id === data.id
    })

    if (userAuthIdentities.length > 0) {
      const identityIds = userAuthIdentities.map((identity) => identity.id)
      const emails = userAuthIdentities.map((identity) => {
        const providerIdentity = identity.provider_identities?.[0]
        return providerIdentity?.entity_id || "unknown"
      })

      console.log(`[user-deleted-cleanup] Found ${userAuthIdentities.length} auth identities to delete:`, identityIds)
      console.log(`[user-deleted-cleanup] Associated emails:`, emails)

      // Delete the auth identities (this should cascade to provider_identities)
      await authService.deleteAuthIdentities(identityIds)
      console.log(`[user-deleted-cleanup] Successfully deleted auth identities for user: ${data.id}`)

      // Also clean up any pending roles for these emails
      for (const email of emails) {
        if (email && email !== "unknown") {
          try {
            const pendingRoles = await rbacService.listPendingRoles({ email: email.toLowerCase() })
            if (pendingRoles.length > 0) {
              await rbacService.deletePendingRoles(pendingRoles.map((p) => p.id))
              console.log(`[user-deleted-cleanup] Deleted pending role for email: ${email}`)
            }
          } catch {
            // Ignore pending role cleanup errors
          }
        }
      }
    } else {
      console.log(`[user-deleted-cleanup] No auth identities found for user: ${data.id}`)
    }

    // Clean up any user roles in RBAC
    try {
      const userRoles = await rbacService.listUserRoles({ user_id: data.id })
      if (userRoles.length > 0) {
        const roleIds = userRoles.map((ur) => ur.id)
        await rbacService.deleteUserRoles(roleIds)
        console.log(`[user-deleted-cleanup] Deleted ${roleIds.length} RBAC role assignments for user: ${data.id}`)
      }
    } catch (rbacError) {
      // RBAC cleanup is optional - log but don't fail
      console.warn(`[user-deleted-cleanup] Failed to clean up RBAC roles:`, rbacError)
    }

  } catch (error) {
    console.error("[user-deleted-cleanup] Failed to clean up user data:", error)
    // Don't throw - we don't want to block the deletion
  }
}

export const config: SubscriberConfig = {
  event: "user.deleted",
}
