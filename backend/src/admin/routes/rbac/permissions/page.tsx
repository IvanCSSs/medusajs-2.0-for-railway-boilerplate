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
  Select,
  toast,
} from "@medusajs/ui"
import { Key, Plus, Trash, XMark } from "@medusajs/icons"
import { useEffect, useState } from "react"

type Permission = {
  id: string
  name: string
  action: "read" | "write" | "delete"
  resource: string
  description: string | null
  category: string
  is_system: boolean
}

const PermissionsPage = () => {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "category">("category")
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formAction, setFormAction] = useState<"read" | "write" | "delete">("read")
  const [formResource, setFormResource] = useState("")
  const [formCategory, setFormCategory] = useState("")

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
      const response = await fetch("/admin/rbac/permissions", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setPermissions(data.permissions || [])
        setPermissionsByCategory(data.by_category || {})
      }
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
      toast.error("Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setFormName("")
    setFormDescription("")
    setFormAction("read")
    setFormResource("")
    setFormCategory("Custom")
    setShowModal(true)
  }

  const handleCreatePermission = async () => {
    if (!formName.trim() || !formResource.trim()) {
      toast.error("Name and resource are required")
      return
    }

    try {
      const response = await fetch("/admin/rbac/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          action: formAction,
          resource: formResource,
          category: formCategory || "Custom",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create permission")
      }

      toast.success("Permission created")
      setShowModal(false)
      fetchData()
    } catch (error) {
      toast.error("Failed to create permission")
    }
  }

  const handleDeletePermission = async (permission: Permission) => {
    if (!confirm(`Delete permission "${permission.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/admin/rbac/permissions/${permission.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to delete permission")
      }

      toast.success("Permission deleted")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete permission")
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "read":
        return "blue"
      case "write":
        return "orange"
      case "delete":
        return "red"
      default:
        return "grey"
    }
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
          <Key className="w-16 h-16 text-ui-fg-muted mb-4" />
          <Heading level="h2" className="mb-2">Access Denied</Heading>
          <Text className="text-ui-fg-subtle text-center max-w-md">
            You don't have permission to view permissions. Contact your administrator if you need access.
          </Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Key className="w-8 h-8 text-ui-fg-interactive" />
          <div>
            <Heading level="h1">Permissions</Heading>
            <Text className="text-ui-fg-subtle">
              View and manage available permissions
            </Text>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-ui-border-base rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${
                viewMode === "list"
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "bg-ui-bg-base"
              }`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${
                viewMode === "category"
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "bg-ui-bg-base"
              }`}
              onClick={() => setViewMode("category")}
            >
              By Category
            </button>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Permission
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Total</Text>
          <Heading level="h3">{permissions.length}</Heading>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Read</Text>
          <Heading level="h3">
            {permissions.filter((p) => p.action === "read").length}
          </Heading>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Write</Text>
          <Heading level="h3">
            {permissions.filter((p) => p.action === "write").length}
          </Heading>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-4">
          <Text className="text-ui-fg-subtle text-sm">Delete</Text>
          <Heading level="h3">
            {permissions.filter((p) => p.action === "delete").length}
          </Heading>
        </div>
      </div>

      {/* Permissions List */}
      {viewMode === "category" ? (
        <div className="space-y-6">
          {Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div
              key={category}
              className="bg-ui-bg-base border border-ui-border-base rounded-lg"
            >
              <div className="p-4 border-b border-ui-border-base">
                <Heading level="h3">{category}</Heading>
                <Text className="text-sm text-ui-fg-subtle">
                  {perms.length} permissions
                </Text>
              </div>
              <div className="divide-y divide-ui-border-base">
                {perms.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Text className="font-medium">{permission.name}</Text>
                        <Badge color={getActionColor(permission.action)}>
                          {permission.action}
                        </Badge>
                        {permission.is_system && (
                          <Badge color="grey">System</Badge>
                        )}
                      </div>
                      <Text className="text-sm text-ui-fg-subtle">
                        {permission.resource}
                      </Text>
                      {permission.description && (
                        <Text className="text-sm text-ui-fg-muted mt-1">
                          {permission.description}
                        </Text>
                      )}
                    </div>
                    {!permission.is_system && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => handleDeletePermission(permission)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-ui-bg-base border border-ui-border-base rounded-lg divide-y divide-ui-border-base">
          {permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Text className="font-medium">{permission.name}</Text>
                  <Badge color={getActionColor(permission.action)}>
                    {permission.action}
                  </Badge>
                  <Badge color="grey">{permission.category}</Badge>
                  {permission.is_system && (
                    <Badge color="purple">System</Badge>
                  )}
                </div>
                <Text className="text-sm text-ui-fg-subtle">
                  {permission.resource}
                </Text>
              </div>
              {!permission.is_system && (
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => handleDeletePermission(permission)}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Permission Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ui-bg-base rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-ui-border-base">
              <Heading level="h2">Add Custom Permission</Heading>
              <Button variant="transparent" onClick={() => setShowModal(false)}>
                <XMark className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="perm-name">Name</Label>
                <Input
                  id="perm-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., View Reports"
                />
              </div>

              <div>
                <Label htmlFor="perm-description">Description</Label>
                <Textarea
                  id="perm-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this permission allow?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="perm-action">Action</Label>
                  <Select
                    value={formAction}
                    onValueChange={(v) => setFormAction(v as "read" | "write" | "delete")}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select action" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="read">Read</Select.Item>
                      <Select.Item value="write">Write</Select.Item>
                      <Select.Item value="delete">Delete</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="perm-category">Category</Label>
                  <Input
                    id="perm-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g., Custom, Reports"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="perm-resource">Resource (API Path)</Label>
                <Input
                  id="perm-resource"
                  value={formResource}
                  onChange={(e) => setFormResource(e.target.value)}
                  placeholder="/admin/custom-route"
                />
                <Text className="text-xs text-ui-fg-muted mt-1">
                  The API path this permission applies to
                </Text>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-ui-border-base">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePermission}>Create Permission</Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Permissions",
})

export default PermissionsPage
