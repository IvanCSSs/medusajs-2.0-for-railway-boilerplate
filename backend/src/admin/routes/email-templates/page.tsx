import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid, PlusMini, PencilSquare, Trash } from "@medusajs/icons"
import { Container, Heading, Table, Text, Badge, Button, toast, Toaster } from "@medusajs/ui"
import { useEffect, useState } from "react"

type EmailTemplate = {
  id: string
  name: string
  subject: string
  description: string | null
  event_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const navigateTo = (path: string) => {
  window.location.href = `/app${path}`
}

const EmailTemplatesPage = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch("/admin/email-templates", {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to fetch templates")
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const deleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const response = await fetch(`/admin/email-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to delete")
      toast.success("Template deleted")
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to delete template")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <>
      <Toaster />
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Email Templates</Heading>
            <Text className="text-ui-fg-subtle">
              Create and manage transactional email templates
            </Text>
          </div>
          <Button onClick={() => navigateTo("/email-templates/new")}>
            <PlusMini />
            Create Template
          </Button>
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Text>Loading templates...</Text>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <EnvelopeSolid className="text-ui-fg-muted mb-2 h-10 w-10" />
              <Text className="text-ui-fg-muted mb-4">No email templates yet</Text>
              <Button variant="secondary" onClick={() => navigateTo("/email-templates/new")}>
                Create your first template
              </Button>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Event</Table.HeaderCell>
                  <Table.HeaderCell>Subject</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Updated</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {templates.map((template) => (
                  <Table.Row key={template.id}>
                    <Table.Cell>
                      <Text className="font-medium">{template.name}</Text>
                      {template.description && (
                        <Text className="text-ui-fg-subtle text-xs">{template.description}</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <code className="rounded bg-ui-bg-subtle px-2 py-1 text-xs">
                        {template.event_name}
                      </code>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-ui-fg-subtle">{template.subject}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={template.is_active ? "green" : "grey"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-ui-fg-subtle">{formatDate(template.updated_at)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => navigateTo(`/email-templates/${template.id}`)}
                        >
                          <PencilSquare />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>

        {/* Available Events Reference */}
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-4">Available Trigger Events</Heading>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <Text className="font-medium mb-2">Authentication</Text>
              <ul className="text-ui-fg-subtle space-y-1">
                <li><code>invite.created</code></li>
                <li><code>invite.resent</code></li>
                <li><code>auth.password_reset</code></li>
              </ul>
            </div>
            <div>
              <Text className="font-medium mb-2">Orders</Text>
              <ul className="text-ui-fg-subtle space-y-1">
                <li><code>order.placed</code></li>
                <li><code>order.canceled</code></li>
                <li><code>order.shipment_created</code></li>
              </ul>
            </div>
            <div>
              <Text className="font-medium mb-2">Customers</Text>
              <ul className="text-ui-fg-subtle space-y-1">
                <li><code>customer.created</code></li>
                <li><code>customer.password_reset</code></li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}

export const config = defineRouteConfig({
  label: "Email Templates",
  icon: EnvelopeSolid,
})

export default EmailTemplatesPage
