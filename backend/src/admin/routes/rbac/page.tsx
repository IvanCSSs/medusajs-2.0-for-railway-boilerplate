import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"
import { ShieldCheck, Users, Key, ArrowRight } from "@medusajs/icons"
import { useEffect, useState } from "react"

type Role = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  policies: Array<{
    policy: { id: string; decision: string }
    permission: { id: string; name: string; action: string; resource: string }
  }>
}

type UserWithRoles = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  roles: Role[]
}

const RBACDashboard = () => {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [permissionCount, setPermissionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      // Check if user has permission to view RBAC
      const response = await fetch("/admin/rbac/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "read", resource: "/admin/rbac" }),
      })

      if (response.ok) {
        const data = await response.json()
        setHasAccess(data.allowed)
        if (data.allowed) {
          fetchData()
        } else {
          setLoading(false)
        }
      } else {
        // If check fails, assume no access
        setHasAccess(false)
        setLoading(false)
      }
    } catch (error) {
      console.error("Failed to check RBAC access:", error)
      setHasAccess(false)
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [rolesRes, usersRes, permissionsRes] = await Promise.all([
        fetch("/admin/rbac/roles", { credentials: "include" }),
        fetch("/admin/rbac/users", { credentials: "include" }),
        fetch("/admin/rbac/permissions", { credentials: "include" }),
      ])

      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.roles || [])
      }

      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users || [])
      }

      if (permissionsRes.ok) {
        const data = await permissionsRes.json()
        setPermissionCount(data.count || 0)
      }
    } catch (error) {
      console.error("Failed to fetch RBAC data:", error)
    } finally {
      setLoading(false)
    }
  }

  const navigateTo = (path: string) => {
    window.location.href = `/app${path}`
  }

  const usersWithRoles = users.filter((u) => u.roles.length > 0)
  const usersWithoutRoles = users.filter((u) => u.roles.length === 0)

  return (
    <Container className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-8 h-8 text-ui-fg-interactive" />
        <div>
          <Heading level="h1">Role-Based Access Control</Heading>
          <Text className="text-ui-fg-subtle">
            Manage user permissions and access levels
          </Text>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      ) : hasAccess === false ? (
        <div className="flex flex-col items-center justify-center h-64 bg-ui-bg-subtle rounded-lg">
          <ShieldCheck className="w-16 h-16 text-ui-fg-muted mb-4" />
          <Heading level="h2" className="mb-2">Access Denied</Heading>
          <Text className="text-ui-fg-subtle text-center max-w-md">
            You don't have permission to view RBAC settings. Contact your administrator if you need access.
          </Text>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-ui-fg-subtle" />
                <Text className="text-ui-fg-subtle font-medium">Roles</Text>
              </div>
              <Heading level="h2" className="text-3xl">
                {roles.length}
              </Heading>
              <Button
                variant="secondary"
                size="small"
                className="mt-4"
                onClick={() => navigateTo("/rbac/roles")}
              >
                Manage Roles <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Key className="w-5 h-5 text-ui-fg-subtle" />
                <Text className="text-ui-fg-subtle font-medium">Permissions</Text>
              </div>
              <Heading level="h2" className="text-3xl">
                {permissionCount}
              </Heading>
              <Button
                variant="secondary"
                size="small"
                className="mt-4"
                onClick={() => navigateTo("/rbac/permissions")}
              >
                View Permissions <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-ui-fg-subtle" />
                <Text className="text-ui-fg-subtle font-medium">Users with Roles</Text>
              </div>
              <Heading level="h2" className="text-3xl">
                {usersWithRoles.length}
                <span className="text-lg text-ui-fg-subtle ml-2">
                  / {users.length}
                </span>
              </Heading>
              <Button
                variant="secondary"
                size="small"
                className="mt-4"
                onClick={() => navigateTo("/rbac/users")}
              >
                Manage User Roles <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Quick Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Roles Overview */}
            <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
              <Heading level="h2" className="mb-4">
                Roles Overview
              </Heading>
              {roles.length === 0 ? (
                <div className="text-center py-8">
                  <Text className="text-ui-fg-subtle mb-4">
                    No roles created yet
                  </Text>
                  <Button onClick={() => navigateTo("/rbac/roles")}>
                    Create First Role
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.slice(0, 5).map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg"
                    >
                      <div>
                        <Text className="font-medium">{role.name}</Text>
                        <Text className="text-sm text-ui-fg-subtle">
                          {role.policies.length} permissions
                        </Text>
                      </div>
                      {role.is_system && (
                        <Badge color="grey">System</Badge>
                      )}
                    </div>
                  ))}
                  {roles.length > 5 && (
                    <button
                      onClick={() => navigateTo("/rbac/roles")}
                      className="text-ui-fg-interactive text-sm hover:underline"
                    >
                      View all {roles.length} roles →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Users with Roles */}
            <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
              <Heading level="h2" className="mb-4">
                User Role Assignments
              </Heading>
              {usersWithRoles.length === 0 ? (
                <div className="text-center py-8">
                  <Text className="text-ui-fg-subtle mb-2">
                    No users have roles assigned
                  </Text>
                  <Text className="text-sm text-ui-fg-muted">
                    All users currently have full access
                  </Text>
                </div>
              ) : (
                <div className="space-y-3">
                  {usersWithRoles.slice(0, 5).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg"
                    >
                      <div>
                        <Text className="font-medium">
                          {user.first_name} {user.last_name}
                        </Text>
                        <Text className="text-sm text-ui-fg-subtle">
                          {user.email}
                        </Text>
                      </div>
                      <div className="flex gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role.id} color="blue">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 bg-ui-bg-subtle border border-ui-border-base rounded-lg p-6">
            <Heading level="h3" className="mb-2">
              How RBAC Works
            </Heading>
            <ul className="list-disc list-inside space-y-2 text-ui-fg-subtle">
              <li>
                <strong>Users without roles</strong> have full access (default Medusa behavior)
              </li>
              <li>
                <strong>Roles</strong> contain policies that allow or deny specific permissions
              </li>
              <li>
                <strong>DENY</strong> policies take precedence over ALLOW policies
              </li>
              <li>
                Assign roles to users to restrict their access to specific areas
              </li>
            </ul>
          </div>
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "RBAC",
  icon: ShieldCheck,
})

export default RBACDashboard
