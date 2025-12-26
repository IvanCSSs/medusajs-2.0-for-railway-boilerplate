import { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RBAC_MODULE, RBACModuleService } from "../../modules/rbac"

type PermissionAction = "read" | "write" | "delete"

/**
 * Maps HTTP methods to RBAC actions
 */
function getActionFromMethod(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case "GET":
      return "read"
    case "POST":
    case "PUT":
    case "PATCH":
      return "write"
    case "DELETE":
      return "delete"
    default:
      return "read"
  }
}

/**
 * Normalizes a path for permission matching
 * e.g., /admin/products/prod_123 -> /admin/products
 */
function normalizePathForPermission(path: string): string {
  // Remove query string
  const pathWithoutQuery = path.split("?")[0]

  // Split into segments
  const segments = pathWithoutQuery.split("/").filter(Boolean)

  // For admin routes, keep only the first 2-3 segments
  // e.g., /admin/products/prod_123/variants -> /admin/products
  if (segments[0] === "admin" && segments.length > 2) {
    // Check if third segment looks like an ID
    const thirdSegment = segments[2]
    if (
      thirdSegment &&
      (thirdSegment.startsWith("prod_") ||
        thirdSegment.startsWith("order_") ||
        thirdSegment.startsWith("cust_") ||
        thirdSegment.startsWith("var_") ||
        thirdSegment.match(/^[a-f0-9-]{20,}$/i))
    ) {
      return `/${segments[0]}/${segments[1]}`
    }
  }

  return "/" + segments.slice(0, 3).join("/")
}

/**
 * RBAC middleware factory
 *
 * Creates middleware that checks if the current user has permission
 * to access the requested route.
 *
 * Options:
 * - enabled: Whether RBAC is enabled (default: true)
 * - excludePaths: Paths to exclude from RBAC checks
 */
export function createRBACMiddleware(options?: {
  enabled?: boolean
  excludePaths?: string[]
}) {
  const { enabled = true, excludePaths = [] } = options || {}

  // Default paths that should always be accessible
  const defaultExcludePaths = [
    "/admin/auth",
    "/admin/rbac/check", // Always allow permission checks
    "/admin/users/me", // Always allow getting current user
    "/health",
    "/store",
  ]

  const allExcludePaths = [...defaultExcludePaths, ...excludePaths]

  return async function rbacMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) {
    // Skip if disabled
    if (!enabled) {
      return next()
    }

    // Skip for non-admin routes
    if (!req.path.startsWith("/admin")) {
      return next()
    }

    // Skip excluded paths
    const normalizedPath = normalizePathForPermission(req.path)
    if (allExcludePaths.some((p) => normalizedPath.startsWith(p))) {
      return next()
    }

    // Get current user
    const userId = (req as any).auth_context?.actor_id

    // If not authenticated, let the auth middleware handle it
    if (!userId) {
      return next()
    }

    try {
      const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
      const action = getActionFromMethod(req.method)

      const result = await rbacService.checkPermission(userId, action, normalizedPath)

      if (!result.allowed) {
        return res.status(403).json({
          message: "Access denied",
          reason: result.reason,
          action,
          resource: normalizedPath,
        })
      }

      // User has permission, continue
      return next()
    } catch (error) {
      // If RBAC module fails, log and continue (fail open)
      console.error("RBAC middleware error:", error)
      return next()
    }
  }
}

/**
 * Simple middleware for checking specific permissions
 * Use in route-specific middleware configuration
 */
export function requirePermission(action: PermissionAction, resource: string) {
  return async function (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) {
    const userId = (req as any).auth_context?.actor_id

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    try {
      const rbacService = req.scope.resolve<RBACModuleService>(RBAC_MODULE)
      const result = await rbacService.checkPermission(userId, action, resource)

      if (!result.allowed) {
        return res.status(403).json({
          message: "Access denied",
          reason: result.reason,
        })
      }

      return next()
    } catch (error) {
      console.error("RBAC permission check error:", error)
      return next()
    }
  }
}
