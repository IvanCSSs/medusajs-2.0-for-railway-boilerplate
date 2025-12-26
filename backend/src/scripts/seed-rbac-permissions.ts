/**
 * Seed script for RBAC default permissions
 *
 * Run with: npx medusa exec ./src/scripts/seed-rbac-permissions.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { RBAC_MODULE, RBACModuleService } from "../modules/rbac"

// Default permissions covering Medusa admin routes
const DEFAULT_PERMISSIONS = [
  // Products
  { action: "read", resource: "/admin/products", name: "View Products", category: "Products" },
  { action: "write", resource: "/admin/products", name: "Create/Edit Products", category: "Products" },
  { action: "delete", resource: "/admin/products", name: "Delete Products", category: "Products" },

  // Categories
  { action: "read", resource: "/admin/product-categories", name: "View Categories", category: "Products" },
  { action: "write", resource: "/admin/product-categories", name: "Create/Edit Categories", category: "Products" },
  { action: "delete", resource: "/admin/product-categories", name: "Delete Categories", category: "Products" },

  // Collections
  { action: "read", resource: "/admin/collections", name: "View Collections", category: "Products" },
  { action: "write", resource: "/admin/collections", name: "Create/Edit Collections", category: "Products" },
  { action: "delete", resource: "/admin/collections", name: "Delete Collections", category: "Products" },

  // Orders
  { action: "read", resource: "/admin/orders", name: "View Orders", category: "Orders" },
  { action: "write", resource: "/admin/orders", name: "Update Orders", category: "Orders" },
  { action: "delete", resource: "/admin/orders", name: "Cancel Orders", category: "Orders" },

  // Draft Orders
  { action: "read", resource: "/admin/draft-orders", name: "View Draft Orders", category: "Orders" },
  { action: "write", resource: "/admin/draft-orders", name: "Create/Edit Draft Orders", category: "Orders" },
  { action: "delete", resource: "/admin/draft-orders", name: "Delete Draft Orders", category: "Orders" },

  // Customers
  { action: "read", resource: "/admin/customers", name: "View Customers", category: "Customers" },
  { action: "write", resource: "/admin/customers", name: "Create/Edit Customers", category: "Customers" },
  { action: "delete", resource: "/admin/customers", name: "Delete Customers", category: "Customers" },

  // Customer Groups
  { action: "read", resource: "/admin/customer-groups", name: "View Customer Groups", category: "Customers" },
  { action: "write", resource: "/admin/customer-groups", name: "Create/Edit Customer Groups", category: "Customers" },
  { action: "delete", resource: "/admin/customer-groups", name: "Delete Customer Groups", category: "Customers" },

  // Discounts / Promotions
  { action: "read", resource: "/admin/promotions", name: "View Promotions", category: "Marketing" },
  { action: "write", resource: "/admin/promotions", name: "Create/Edit Promotions", category: "Marketing" },
  { action: "delete", resource: "/admin/promotions", name: "Delete Promotions", category: "Marketing" },

  // Gift Cards
  { action: "read", resource: "/admin/gift-cards", name: "View Gift Cards", category: "Marketing" },
  { action: "write", resource: "/admin/gift-cards", name: "Create/Edit Gift Cards", category: "Marketing" },
  { action: "delete", resource: "/admin/gift-cards", name: "Delete Gift Cards", category: "Marketing" },

  // Price Lists
  { action: "read", resource: "/admin/price-lists", name: "View Price Lists", category: "Pricing" },
  { action: "write", resource: "/admin/price-lists", name: "Create/Edit Price Lists", category: "Pricing" },
  { action: "delete", resource: "/admin/price-lists", name: "Delete Price Lists", category: "Pricing" },

  // Inventory
  { action: "read", resource: "/admin/inventory-items", name: "View Inventory", category: "Inventory" },
  { action: "write", resource: "/admin/inventory-items", name: "Update Inventory", category: "Inventory" },

  // Stock Locations
  { action: "read", resource: "/admin/stock-locations", name: "View Stock Locations", category: "Inventory" },
  { action: "write", resource: "/admin/stock-locations", name: "Create/Edit Stock Locations", category: "Inventory" },
  { action: "delete", resource: "/admin/stock-locations", name: "Delete Stock Locations", category: "Inventory" },

  // Reservations
  { action: "read", resource: "/admin/reservations", name: "View Reservations", category: "Inventory" },
  { action: "write", resource: "/admin/reservations", name: "Create/Edit Reservations", category: "Inventory" },
  { action: "delete", resource: "/admin/reservations", name: "Delete Reservations", category: "Inventory" },

  // Regions
  { action: "read", resource: "/admin/regions", name: "View Regions", category: "Settings" },
  { action: "write", resource: "/admin/regions", name: "Create/Edit Regions", category: "Settings" },
  { action: "delete", resource: "/admin/regions", name: "Delete Regions", category: "Settings" },

  // Currencies
  { action: "read", resource: "/admin/currencies", name: "View Currencies", category: "Settings" },
  { action: "write", resource: "/admin/currencies", name: "Update Currencies", category: "Settings" },

  // Tax Rates
  { action: "read", resource: "/admin/tax-rates", name: "View Tax Rates", category: "Settings" },
  { action: "write", resource: "/admin/tax-rates", name: "Create/Edit Tax Rates", category: "Settings" },
  { action: "delete", resource: "/admin/tax-rates", name: "Delete Tax Rates", category: "Settings" },

  // Shipping Options
  { action: "read", resource: "/admin/shipping-options", name: "View Shipping Options", category: "Settings" },
  { action: "write", resource: "/admin/shipping-options", name: "Create/Edit Shipping Options", category: "Settings" },
  { action: "delete", resource: "/admin/shipping-options", name: "Delete Shipping Options", category: "Settings" },

  // Fulfillment Providers
  { action: "read", resource: "/admin/fulfillment-providers", name: "View Fulfillment Providers", category: "Settings" },
  { action: "write", resource: "/admin/fulfillment-providers", name: "Configure Fulfillment Providers", category: "Settings" },

  // Payment Providers
  { action: "read", resource: "/admin/payment-providers", name: "View Payment Providers", category: "Settings" },
  { action: "write", resource: "/admin/payment-providers", name: "Configure Payment Providers", category: "Settings" },

  // Users
  { action: "read", resource: "/admin/users", name: "View Users", category: "Administration" },
  { action: "write", resource: "/admin/users", name: "Create/Edit Users", category: "Administration" },
  { action: "delete", resource: "/admin/users", name: "Delete Users", category: "Administration" },

  // Invites
  { action: "read", resource: "/admin/invites", name: "View Invites", category: "Administration" },
  { action: "write", resource: "/admin/invites", name: "Send Invites", category: "Administration" },
  { action: "delete", resource: "/admin/invites", name: "Delete Invites", category: "Administration" },

  // RBAC
  { action: "read", resource: "/admin/rbac", name: "View RBAC Settings", category: "Administration" },
  { action: "write", resource: "/admin/rbac", name: "Manage RBAC Settings", category: "Administration" },

  // Store Settings
  { action: "read", resource: "/admin/store", name: "View Store Settings", category: "Settings" },
  { action: "write", resource: "/admin/store", name: "Update Store Settings", category: "Settings" },

  // API Keys
  { action: "read", resource: "/admin/api-keys", name: "View API Keys", category: "Administration" },
  { action: "write", resource: "/admin/api-keys", name: "Create/Revoke API Keys", category: "Administration" },

  // Sales Channels
  { action: "read", resource: "/admin/sales-channels", name: "View Sales Channels", category: "Settings" },
  { action: "write", resource: "/admin/sales-channels", name: "Create/Edit Sales Channels", category: "Settings" },
  { action: "delete", resource: "/admin/sales-channels", name: "Delete Sales Channels", category: "Settings" },

  // Uploads
  { action: "write", resource: "/admin/uploads", name: "Upload Files", category: "General" },

  // Bulk Editor (Custom)
  { action: "read", resource: "/admin/bulk-editor", name: "View Bulk Editor", category: "Custom" },
  { action: "write", resource: "/admin/bulk-editor", name: "Use Bulk Editor", category: "Custom" },

  // Email Templates (Custom)
  { action: "read", resource: "/admin/email-templates", name: "View Email Templates", category: "Custom" },
  { action: "write", resource: "/admin/email-templates", name: "Edit Email Templates", category: "Custom" },
] as const

// Default roles
const DEFAULT_ROLES = [
  {
    name: "Super Admin",
    description: "Full access to all features",
    policies: "all-allow",
  },
  {
    name: "Editor",
    description: "Can view and edit products, orders, and customers",
    policies: [
      { resource: "/admin/products", actions: ["read", "write"] },
      { resource: "/admin/product-categories", actions: ["read", "write"] },
      { resource: "/admin/collections", actions: ["read", "write"] },
      { resource: "/admin/orders", actions: ["read", "write"] },
      { resource: "/admin/customers", actions: ["read", "write"] },
      { resource: "/admin/inventory-items", actions: ["read", "write"] },
      { resource: "/admin/uploads", actions: ["write"] },
      { resource: "/admin/bulk-editor", actions: ["read", "write"] },
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to most features",
    policies: [
      { resource: "/admin/products", actions: ["read"] },
      { resource: "/admin/product-categories", actions: ["read"] },
      { resource: "/admin/collections", actions: ["read"] },
      { resource: "/admin/orders", actions: ["read"] },
      { resource: "/admin/customers", actions: ["read"] },
      { resource: "/admin/inventory-items", actions: ["read"] },
      { resource: "/admin/promotions", actions: ["read"] },
      { resource: "/admin/bulk-editor", actions: ["read"] },
    ],
  },
  {
    name: "Order Manager",
    description: "Full access to orders and customers",
    policies: [
      { resource: "/admin/orders", actions: ["read", "write", "delete"] },
      { resource: "/admin/draft-orders", actions: ["read", "write", "delete"] },
      { resource: "/admin/customers", actions: ["read", "write"] },
      { resource: "/admin/customer-groups", actions: ["read", "write"] },
    ],
  },
] as const

export default async function seedRBACPermissions({ container }: ExecArgs) {
  const rbacService = container.resolve<RBACModuleService>(RBAC_MODULE)

  console.log("=== Seeding RBAC Permissions ===\n")

  // Check existing permissions
  const existingPermissions = await rbacService.listPermissions({})
  const existingKeys = new Set(
    existingPermissions.map((p) => `${p.action}:${p.resource}`)
  )

  console.log(`Found ${existingPermissions.length} existing permissions`)

  // Create missing permissions
  const permissionsToCreate = DEFAULT_PERMISSIONS.filter(
    (p) => !existingKeys.has(`${p.action}:${p.resource}`)
  )

  if (permissionsToCreate.length > 0) {
    console.log(`Creating ${permissionsToCreate.length} new permissions...`)

    await rbacService.createPermissions(
      permissionsToCreate.map((p) => ({
        action: p.action,
        resource: p.resource,
        name: p.name,
        category: p.category,
        description: null,
        is_system: true,
      }))
    )

    console.log("Permissions created successfully!")
  } else {
    console.log("All permissions already exist")
  }

  // Get all permissions for role creation
  const allPermissions = await rbacService.listPermissions({})
  const permissionByKey = new Map(
    allPermissions.map((p) => [`${p.action}:${p.resource}`, p])
  )

  // Check existing roles
  const existingRoles = await rbacService.listRoles({})
  const existingRoleNames = new Set(existingRoles.map((r) => r.name))

  console.log(`\nFound ${existingRoles.length} existing roles`)

  // Create missing roles
  for (const roleDef of DEFAULT_ROLES) {
    if (existingRoleNames.has(roleDef.name)) {
      console.log(`Role "${roleDef.name}" already exists, skipping`)
      continue
    }

    console.log(`Creating role "${roleDef.name}"...`)

    let policies: Array<{ permissionId: string; decision: "allow" | "deny" }> = []

    if (roleDef.policies === "all-allow") {
      // Super Admin: allow everything
      policies = allPermissions.map((p) => ({
        permissionId: p.id,
        decision: "allow" as const,
      }))
    } else {
      // Build policies from definition
      for (const policyDef of roleDef.policies) {
        for (const action of policyDef.actions) {
          const key = `${action}:${policyDef.resource}`
          const permission = permissionByKey.get(key)
          if (permission) {
            policies.push({
              permissionId: permission.id,
              decision: "allow",
            })
          }
        }
      }
    }

    await rbacService.createRoleWithPolicies(
      roleDef.name,
      roleDef.description,
      policies
    )

    console.log(`Role "${roleDef.name}" created with ${policies.length} policies`)
  }

  console.log("\n=== RBAC Seeding Complete ===")
  console.log(`Total permissions: ${allPermissions.length}`)
  console.log(`Total roles: ${(await rbacService.listRoles({})).length}`)
}
