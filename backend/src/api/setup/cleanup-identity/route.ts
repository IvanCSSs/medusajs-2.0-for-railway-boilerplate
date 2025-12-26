import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { IAuthModuleService, IUserModuleService } from "@medusajs/framework/types"

/**
 * POST /setup/cleanup-identity
 * Clean up orphaned auth identities for a specific email
 *
 * SECURITY WARNING: This endpoint is intentionally unauthenticated for initial setup.
 * It should be disabled or removed after fixing orphaned identities.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { email, setup_key } = req.body as { email: string; setup_key?: string }

    // Simple protection - require a setup key that matches an env var
    const expectedKey = process.env.SETUP_KEY || "initial-setup-2024"
    if (setup_key !== expectedKey) {
      return res.status(403).json({
        message: "Invalid setup key",
      })
    }

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

    console.log(`[setup/cleanup-identity] Deleted ${identityIds.length} orphaned auth identities for ${email}:`, identityIds)

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
