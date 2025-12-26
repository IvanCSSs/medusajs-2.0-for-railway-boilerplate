import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { IAuthModuleService, IUserModuleService } from "@medusajs/framework/types"

/**
 * POST /admin/rbac/cleanup
 * Clean up orphaned auth identities for a specific email
 * This is useful when a user was deleted but their auth identity remains
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { email } = req.body as { email?: string }

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      })
    }

    const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
    const userService = req.scope.resolve<IUserModuleService>(Modules.USER)

    // First check if there's an existing user with this email
    const existingUsers = await userService.listUsers({ email: email.toLowerCase() })
    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: `Cannot clean up - a user with email ${email} still exists`,
        user_id: existingUsers[0].id,
      })
    }

    // Find auth identities with this email
    const allAuthIdentities = await authService.listAuthIdentities(
      {},
      { relations: ["provider_identities"] }
    )

    // Filter to find identities with this email
    const orphanedIdentities = allAuthIdentities.filter((identity) => {
      const providerIdentity = identity.provider_identities?.[0]
      return providerIdentity?.entity_id?.toLowerCase() === email.toLowerCase()
    })

    if (orphanedIdentities.length === 0) {
      return res.json({
        message: `No orphaned auth identities found for ${email}`,
        cleaned_up: 0,
      })
    }

    // Delete the orphaned identities
    const identityIds = orphanedIdentities.map((i) => i.id)
    await authService.deleteAuthIdentities(identityIds)

    console.log(`[cleanup] Deleted ${identityIds.length} orphaned auth identities for ${email}:`, identityIds)

    res.json({
      message: `Successfully cleaned up ${identityIds.length} orphaned auth identities for ${email}`,
      cleaned_up: identityIds.length,
      identity_ids: identityIds,
    })
  } catch (error: any) {
    console.error("Failed to clean up orphaned identities:", error)
    res.status(500).json({
      message: error.message || "Failed to clean up orphaned identities",
    })
  }
}

/**
 * GET /admin/rbac/cleanup
 * List all orphaned auth identities (identities without associated users)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
    const userService = req.scope.resolve<IUserModuleService>(Modules.USER)

    // Get all users
    const allUsers = await userService.listUsers({})
    const userIds = new Set(allUsers.map((u) => u.id))

    // Get all auth identities
    const allAuthIdentities = await authService.listAuthIdentities(
      {},
      { relations: ["provider_identities"] }
    )

    // Find orphaned identities (those linked to non-existent users)
    const orphanedIdentities = allAuthIdentities.filter((identity) => {
      const appMetadata = identity.app_metadata as Record<string, unknown> | undefined
      const userId = appMetadata?.user_id as string | undefined

      // If it has a user_id but that user doesn't exist, it's orphaned
      if (userId && !userIds.has(userId)) {
        return true
      }

      return false
    })

    // Format the response
    const orphanedData = orphanedIdentities.map((identity) => {
      const appMetadata = identity.app_metadata as Record<string, unknown> | undefined
      const providerIdentity = identity.provider_identities?.[0]

      return {
        id: identity.id,
        email: providerIdentity?.entity_id || "unknown",
        provider: providerIdentity?.provider || "unknown",
        orphaned_user_id: appMetadata?.user_id || null,
      }
    })

    res.json({
      orphaned_identities: orphanedData,
      total: orphanedData.length,
    })
  } catch (error: any) {
    console.error("Failed to list orphaned identities:", error)
    res.status(500).json({
      message: error.message || "Failed to list orphaned identities",
    })
  }
}

/**
 * DELETE /admin/rbac/cleanup
 * Clean up ALL orphaned auth identities
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
    const userService = req.scope.resolve<IUserModuleService>(Modules.USER)

    // Get all users
    const allUsers = await userService.listUsers({})
    const userIds = new Set(allUsers.map((u) => u.id))

    // Get all auth identities
    const allAuthIdentities = await authService.listAuthIdentities(
      {},
      { relations: ["provider_identities"] }
    )

    // Find orphaned identities
    const orphanedIdentities = allAuthIdentities.filter((identity) => {
      const appMetadata = identity.app_metadata as Record<string, unknown> | undefined
      const userId = appMetadata?.user_id as string | undefined

      if (userId && !userIds.has(userId)) {
        return true
      }

      return false
    })

    if (orphanedIdentities.length === 0) {
      return res.json({
        message: "No orphaned auth identities found",
        cleaned_up: 0,
      })
    }

    // Delete all orphaned identities
    const identityIds = orphanedIdentities.map((i) => i.id)
    const emails = orphanedIdentities.map((i) => i.provider_identities?.[0]?.entity_id || "unknown")

    await authService.deleteAuthIdentities(identityIds)

    console.log(`[cleanup] Deleted ${identityIds.length} orphaned auth identities:`, emails)

    res.json({
      message: `Successfully cleaned up ${identityIds.length} orphaned auth identities`,
      cleaned_up: identityIds.length,
      emails: emails,
    })
  } catch (error: any) {
    console.error("Failed to clean up orphaned identities:", error)
    res.status(500).json({
      message: error.message || "Failed to clean up orphaned identities",
    })
  }
}
