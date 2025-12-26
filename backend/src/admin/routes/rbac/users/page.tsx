import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  Input,
  Select,
  toast,
} from "@medusajs/ui"
import { Users, Key, Plus, Trash, XMark, CheckCircleSolid, EnvelopeSolid } from "@medusajs/icons"
import { useEffect, useState } from "react"

type Role = {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

type UserWithRoles = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  roles: Role[]
}

const UsersRolesPage = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState("")
  const [inviting, setInviting] = useState(false)

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
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/admin/rbac/users", { credentials: "include" }),
        fetch("/admin/rbac/roles", { credentials: "include" }),
      ])

      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users || [])
      }

      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.roles || [])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const openAssignModal = (user: UserWithRoles) => {
    setSelectedUser(user)
    setSelectedRoleId("")
    setShowModal(true)
  }

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) {
      toast.error("Please select a role")
      return
    }

    try {
      const response = await fetch(`/admin/rbac/users/${selectedUser.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role_id: selectedRoleId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to assign role")
      }

      toast.success("Role assigned successfully")
      setShowModal(false)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to assign role")
    }
  }

  const handleRemoveRole = async (userId: string, roleId: string, roleName: string) => {
    if (!confirm(`Remove role "${roleName}" from this user?`)) {
      return
    }

    try {
      const response = await fetch(`/admin/rbac/users/${userId}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role_id: roleId }),
      })

      if (!response.ok) {
        throw new Error("Failed to remove role")
      }

      toast.success("Role removed")
      fetchData()
    } catch (error) {
      toast.error("Failed to remove role")
    }
  }

  const openInviteModal = () => {
    setInviteEmail("")
    setInviteRoleId("")
    setShowInviteModal(true)
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required")
      return
    }

    if (!inviteRoleId) {
      toast.error("You must select a role for the new user")
      return
    }

    setInviting(true)
    try {
      // Send invite with role using our RBAC endpoint
      const response = await fetch("/admin/rbac/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail,
          role_id: inviteRoleId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to send invite")
      }

      const data = await response.json()
      toast.success(data.message || `Invite sent to ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail("")
      setInviteRoleId("")
    } catch (error: any) {
      toast.error(error.message || "Failed to send invite")
    } finally {
      setInviting(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    return (
      user.email.toLowerCase().includes(query) ||
      (user.first_name?.toLowerCase() || "").includes(query) ||
      (user.last_name?.toLowerCase() || "").includes(query)
    )
  })

  const usersWithRoles = filteredUsers.filter((u) => u.roles.length > 0)
  const usersWithoutRoles = filteredUsers.filter((u) => u.roles.length === 0)

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
          <Key className="w-16 h-16 text-ui-fg-muted mb-4" />
          <Heading level="h2" className="mb-2">Access Denied</Heading>
          <Text className="text-ui-fg-subtle text-center max-w-md">
            You don't have permission to view user roles. Contact your administrator if you need access.
          </Text>
        </div>
      </Container>
    )
  }

  // Get available roles for the selected user (exclude already assigned)
  const getAvailableRoles = () => {
    if (!selectedUser) return roles
    const assignedIds = selectedUser.roles.map((r) => r.id)
    return roles.filter((r) => !assignedIds.includes(r.id))
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-ui-fg-interactive" />
          <div>
            <Heading level="h1">User Roles</Heading>
            <Text className="text-ui-fg-subtle">
              View and manage role assignments for users
            </Text>
          </div>
        </div>
        <Button onClick={openInviteModal}>
          <EnvelopeSolid className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Total Users</Text>
          <Heading level="h3">{users.length}</Heading>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">With Roles (Restricted)</Text>
          <Heading level="h3">{users.filter((u) => u.roles.length > 0).length}</Heading>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Full Access (No Role)</Text>
          <Heading level="h3">{users.filter((u) => u.roles.length === 0).length}</Heading>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-ui-bg-subtle border-b border-ui-border-base">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-ui-fg-subtle">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-ui-fg-subtle">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-ui-fg-subtle">Role(s)</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-ui-fg-subtle">Access Level</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-ui-fg-subtle">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border-base">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-ui-bg-subtle-hover">
                <td className="px-4 py-3">
                  <Text className="font-medium">
                    {user.first_name || user.last_name
                      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                      : "No name"}
                  </Text>
                </td>
                <td className="px-4 py-3">
                  <Text className="text-ui-fg-subtle">{user.email}</Text>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length === 0 ? (
                      <Badge color="grey">None</Badge>
                    ) : (
                      user.roles.map((role) => (
                        <div key={role.id} className="flex items-center gap-1">
                          <Badge color="blue">{role.name}</Badge>
                          <button
                            onClick={() => handleRemoveRole(user.id, role.id, role.name)}
                            className="text-ui-fg-muted hover:text-ui-fg-error"
                            title="Remove role"
                          >
                            <XMark className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user.roles.length === 0 ? (
                    <div className="flex items-center gap-1">
                      <CheckCircleSolid className="w-4 h-4 text-green-500" />
                      <Text className="text-green-600 font-medium">Full Access</Text>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Key className="w-4 h-4 text-ui-fg-muted" />
                      <Text className="text-ui-fg-subtle">Restricted</Text>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => openAssignModal(user)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Assign Role
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <Text className="text-ui-fg-subtle">No users found</Text>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-ui-bg-subtle border border-ui-border-base rounded-lg p-4">
        <Text className="text-sm text-ui-fg-subtle">
          <strong>Note:</strong> Users without roles have full admin access (default Medusa behavior).
          Assign a role to restrict access to specific permissions.
        </Text>
      </div>

      {/* Assign Role Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="bg-ui-bg-base rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-border-base">
              <Heading level="h2">Assign Role</Heading>
              <Button variant="transparent" onClick={() => setShowModal(false)}>
                <XMark className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6">
              <Text className="text-ui-fg-subtle mb-4">
                Assign a role to <strong>{selectedUser.email}</strong>
              </Text>

              {getAvailableRoles().length === 0 ? (
                <Text className="text-ui-fg-muted">
                  This user already has all available roles assigned.
                </Text>
              ) : (
                <Select
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select a role" />
                  </Select.Trigger>
                  <Select.Content>
                    {getAvailableRoles().map((role) => (
                      <Select.Item key={role.id} value={role.id}>
                        {role.name}
                        {role.description && (
                          <span className="text-ui-fg-muted ml-2">
                            - {role.description}
                          </span>
                        )}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-ui-border-base">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignRole}
                disabled={!selectedRoleId || getAvailableRoles().length === 0}
              >
                Assign Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="bg-ui-bg-base rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-border-base">
              <Heading level="h2">Invite New User</Heading>
              <Button variant="transparent" onClick={() => setShowInviteModal(false)}>
                <XMark className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Text className="text-sm font-medium mb-2">Email Address</Text>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div>
                <Text className="text-sm font-medium mb-2">
                  Assign Role <span className="text-ui-fg-error">*</span>
                </Text>
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="w-full px-3 py-2 bg-ui-bg-field border border-ui-border-base rounded-lg text-ui-fg-base focus:outline-none focus:border-ui-border-interactive"
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <Text className="text-xs text-ui-fg-muted mt-1">
                  This role will be automatically assigned when the user accepts the invite.
                </Text>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-ui-border-base">
              <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteUser} disabled={inviting || !inviteEmail.trim() || !inviteRoleId}>
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "User Roles",
})

export default UsersRolesPage
