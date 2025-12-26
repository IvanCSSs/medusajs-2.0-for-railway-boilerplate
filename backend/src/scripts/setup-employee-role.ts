/**
 * Setup Employee role and assign to Nikola and Ana
 *
 * Run with: npx medusa exec ./src/scripts/setup-employee-role.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { RBAC_MODULE, RBACModuleService } from "../modules/rbac"
import { Modules } from "@medusajs/framework/utils"

export default async function setupEmployeeRole({ container }: ExecArgs) {
  const rbacService = container.resolve<RBACModuleService>(RBAC_MODULE)
  const userService = container.resolve(Modules.USER)

  console.log("=== Setting up Employee Role ===\n")

  // Get all permissions
  const allPermissions = await rbacService.listPermissions({})
  console.log(`Found ${allPermissions.length} total permissions`)

  // Employee role: Allow everything EXCEPT user management and RBAC
  const restrictedResources = [
    "/admin/users",      // Can't manage users
    "/admin/invites",    // Can't send invites
    "/admin/rbac",       // Can't manage RBAC
    "/admin/api-keys",   // Can't manage API keys
  ]

  const employeePermissions = allPermissions.filter(p => {
    // Deny user deletion and user management
    const isRestricted = restrictedResources.some(r => p.resource.startsWith(r))
    return !isRestricted
  })

  console.log(`Employee role will have ${employeePermissions.length} permissions (excluding user management)`)

  // Check if Employee role exists
  const existingRoles = await rbacService.listRoles({})
  const existingEmployee = existingRoles.find(r => r.name === "Employee")

  let employeeRole: any

  if (existingEmployee) {
    console.log("Employee role already exists, updating policies...")
    await rbacService.updateRolePolicies(
      existingEmployee.id,
      employeePermissions.map(p => ({ permissionId: p.id, decision: "allow" as const }))
    )
    employeeRole = existingEmployee
  } else {
    console.log("Creating Employee role...")
    employeeRole = await rbacService.createRoleWithPolicies(
      "Employee",
      "Full access except user management and admin settings",
      employeePermissions.map(p => ({ permissionId: p.id, decision: "allow" as const }))
    )
  }

  console.log(`Employee role ID: ${employeeRole.id}`)

  // Find Nikola and Ana
  const users = await userService.listUsers({})

  const nikola = users.find((u: any) => u.email === "nikola@radicalz.io")
  const ana = users.find((u: any) => u.email === "ana@radicalz.io")

  if (nikola) {
    console.log(`\nAssigning Employee role to Nikola (${nikola.email})...`)
    await rbacService.assignRole(nikola.id, employeeRole.id)
    console.log("Done!")
  } else {
    console.log("Nikola not found")
  }

  if (ana) {
    console.log(`Assigning Employee role to Ana (${ana.email})...`)
    await rbacService.assignRole(ana.id, employeeRole.id)
    console.log("Done!")
  } else {
    console.log("Ana not found")
  }

  console.log("\n=== Employee Role Setup Complete ===")
  console.log("\nNikola and Ana can now:")
  console.log("  ✓ Manage products, orders, customers, inventory")
  console.log("  ✓ Use bulk editor")
  console.log("  ✓ Access all store features")
  console.log("\nThey CANNOT:")
  console.log("  ✗ Delete or create users")
  console.log("  ✗ Send invites")
  console.log("  ✗ Manage RBAC settings")
  console.log("  ✗ Manage API keys")
}
