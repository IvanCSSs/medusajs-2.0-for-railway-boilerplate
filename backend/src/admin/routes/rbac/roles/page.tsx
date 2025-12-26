import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  Input,
  Textarea,
  Label,
  Checkbox,
  toast,
} from "@medusajs/ui"
import { Users, Plus, Trash, PencilSquare, XMark } from "@medusajs/icons"
import { useEffect, useState } from "react"

type Permission = {
  id: string
  name: string
  action: "read" | "write" | "delete"
  resource: string
  category: string
  is_system: boolean
}

type Policy = {
  policy: { id: string; decision: "allow" | "deny" }
  permission: Permission
}

type Role = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  policies: Policy[]
}

type UserWithRoles = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  roles: Role[]
}

const RolesPage = () => {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPolicies, setFormPolicies] = useState<Record<string, "allow" | "deny" | null>>({})

  // User assignment modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
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
        setHasAccess(false)
        setLoading(false)
      }
    } catch {
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
        setPermissions(data.permissions || [])
        setPermissionsByCategory(data.by_category || {})
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingRole(null)
    setFormName("")
    setFormDescription("")
    setFormPolicies({})
    setShowModal(true)
  }

  const openEditModal = (role: Role) => {
    setEditingRole(role)
    setFormName(role.name)
    setFormDescription(role.description || "")

    // Build policies map
    const policiesMap: Record<string, "allow" | "deny" | null> = {}
    for (const p of role.policies) {
      policiesMap[p.permission.id] = p.policy.decision as "allow" | "deny"
    }
    setFormPolicies(policiesMap)
    setShowModal(true)
  }

  const handleSaveRole = async () => {
    if (!formName.trim()) {
      toast.error("Role name is required")
      return
    }

    const policies = Object.entries(formPolicies)
      .filter(([_, decision]) => decision !== null)
      .map(([permissionId, decision]) => ({
        permission_id: permissionId,
        decision: decision!,
      }))

    try {
      const url = editingRole
        ? `/admin/rbac/roles/${editingRole.id}`
        : "/admin/rbac/roles"

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          policies,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save role")
      }

      toast.success(editingRole ? "Role updated" : "Role created")
      setShowModal(false)
      fetchData()
    } catch (error) {
      toast.error("Failed to save role")
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? Users with this role will lose their permissions.`)) {
      return
    }

    try {
      const response = await fetch(`/admin/rbac/roles/${role.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to delete role")
      }

      toast.success("Role deleted")
      fetchData()
    } catch (error) {
      toast.error("Failed to delete role")
    }
  }

  const openUserAssignment = (role: Role) => {
    setSelectedRole(role)
    setShowUserModal(true)
  }

  const toggleUserRole = async (userId: string, hasRole: boolean) => {
    if (!selectedRole) return

    try {
      const response = await fetch(`/admin/rbac/users/${userId}/roles`, {
        method: hasRole ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role_id: selectedRole.id }),
      })

      if (!response.ok) {
        throw new Error("Failed to update user role")
      }

      toast.success(hasRole ? "Role removed from user" : "Role assigned to user")
      fetchData()
    } catch (error) {
      toast.error("Failed to update user role")
    }
  }

  const togglePolicy = (permissionId: string) => {
    setFormPolicies((prev) => {
      const current = prev[permissionId]
      // Cycle: null -> allow -> deny -> null
      if (current === null || current === undefined) {
        return { ...prev, [permissionId]: "allow" }
      } else if (current === "allow") {
        return { ...prev, [permissionId]: "deny" }
      } else {
        const { [permissionId]: _, ...rest } = prev
        return rest
      }
    })
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Text className="text-ui-fg-subtle">Loading...</Text>
      </Container>
    )
  }

  if (hasAccess === false) {
    return (
      <Container className="p-8">
        <div className="flex flex-col items-center justify-center h-64 bg-ui-bg-subtle rounded-lg">
          <Users className="w-16 h-16 text-ui-fg-muted mb-4" />
          <Heading level="h2" className="mb-2">Access Denied</Heading>
          <Text className="text-ui-fg-subtle text-center max-w-md">
            You don't have permission to manage roles. Contact your administrator if you need access.
          </Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-ui-fg-interactive" />
          <div>
            <Heading level="h1">Roles</Heading>
            <Text className="text-ui-fg-subtle">
              Create and manage user roles with specific permissions
            </Text>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles List */}
      {roles.length === 0 ? (
        <div className="text-center py-16 bg-ui-bg-subtle rounded-lg">
          <Users className="w-12 h-12 mx-auto text-ui-fg-muted mb-4" />
          <Text className="text-ui-fg-subtle mb-4">No roles created yet</Text>
          <Button onClick={openCreateModal}>Create First Role</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const usersWithThisRole = users.filter((u) =>
              u.roles.some((r) => r.id === role.id)
            )
            const allowCount = role.policies.filter(
              (p) => p.policy.decision === "allow"
            ).length
            const denyCount = role.policies.filter(
              (p) => p.policy.decision === "deny"
            ).length

            return (
              <div
                key={role.id}
                className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Heading level="h3">{role.name}</Heading>
                      {role.is_system && <Badge color="grey">System</Badge>}
                    </div>
                    {role.description && (
                      <Text className="text-ui-fg-subtle mb-3">
                        {role.description}
                      </Text>
                    )}
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Badge color="green">{allowCount} Allow</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge color="red">{denyCount} Deny</Badge>
                      </div>
                      <Text className="text-ui-fg-subtle">
                        {usersWithThisRole.length} users assigned
                      </Text>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => openUserAssignment(role)}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Assign Users
                    </Button>
                    {!role.is_system && (
                      <>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => openEditModal(role)}
                        >
                          <PencilSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDeleteRole(role)}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Policies Preview */}
                {role.policies.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-ui-border-base">
                    <Text className="text-sm font-medium mb-2">Policies:</Text>
                    <div className="flex flex-wrap gap-2">
                      {role.policies.slice(0, 8).map((p) => (
                        <Badge
                          key={p.policy.id}
                          color={p.policy.decision === "allow" ? "green" : "red"}
                        >
                          {p.policy.decision === "allow" ? "✓" : "✗"}{" "}
                          {p.permission.name}
                        </Badge>
                      ))}
                      {role.policies.length > 8 && (
                        <Badge color="grey">
                          +{role.policies.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ui-bg-base rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-ui-border-base">
              <Heading level="h2">
                {editingRole ? "Edit Role" : "Create Role"}
              </Heading>
              <Button variant="transparent" onClick={() => setShowModal(false)}>
                <XMark className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Editor, Viewer, Order Manager"
                  />
                </div>
                <div>
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="What can users with this role do?"
                  />
                </div>
              </div>

              <div>
                <Heading level="h3" className="mb-4">
                  Permissions
                </Heading>
                <Text className="text-sm text-ui-fg-subtle mb-4">
                  Click to toggle: <Badge color="grey">None</Badge> →{" "}
                  <Badge color="green">Allow</Badge> →{" "}
                  <Badge color="red">Deny</Badge>
                </Text>

                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="mb-6">
                    <Text className="font-medium mb-2">{category}</Text>
                    <div className="space-y-2">
                      {perms.map((permission) => {
                        const decision = formPolicies[permission.id]
                        return (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded cursor-pointer hover:bg-ui-bg-subtle-hover"
                            onClick={() => togglePolicy(permission.id)}
                          >
                            <div>
                              <Text className="font-medium">
                                {permission.name}
                              </Text>
                              <Text className="text-sm text-ui-fg-subtle">
                                {permission.action} {permission.resource}
                              </Text>
                            </div>
                            <Badge
                              color={
                                decision === "allow"
                                  ? "green"
                                  : decision === "deny"
                                  ? "red"
                                  : "grey"
                              }
                            >
                              {decision === "allow"
                                ? "Allow"
                                : decision === "deny"
                                ? "Deny"
                                : "None"}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-ui-border-base">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole}>
                {editingRole ? "Save Changes" : "Create Role"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Assignment Modal */}
      {showUserModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ui-bg-base rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-ui-border-base">
              <Heading level="h2">
                Assign Users to "{selectedRole.name}"
              </Heading>
              <Button variant="transparent" onClick={() => setShowUserModal(false)}>
                <XMark className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {users.length === 0 ? (
                <Text className="text-ui-fg-subtle">No users found</Text>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => {
                    const hasRole = user.roles.some(
                      (r) => r.id === selectedRole.id
                    )
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded"
                      >
                        <div>
                          <Text className="font-medium">
                            {user.first_name} {user.last_name}
                          </Text>
                          <Text className="text-sm text-ui-fg-subtle">
                            {user.email}
                          </Text>
                        </div>
                        <Checkbox
                          checked={hasRole}
                          onCheckedChange={() => toggleUserRole(user.id, hasRole)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-ui-border-base">
              <Button onClick={() => setShowUserModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Roles",
})

export default RolesPage
