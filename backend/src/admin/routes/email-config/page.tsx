import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Container, Heading, Table, Text, Badge, Button, Input, toast, Toaster } from "@medusajs/ui"
import { useState } from "react"

type EmailTemplate = {
  id: string
  name: string
  description: string
  event: string
  status: "active" | "inactive"
}

const emailTemplates: EmailTemplate[] = [
  {
    id: "invite-user",
    name: "User Invitation",
    description: "Sent when a new admin user is invited to the store",
    event: "invite.created, invite.resent",
    status: "active",
  },
  {
    id: "password-reset",
    name: "Password Reset",
    description: "Sent when a user requests a password reset",
    event: "auth.password_reset",
    status: "active",
  },
  {
    id: "order-placed",
    name: "Order Confirmation",
    description: "Sent to customers when an order is placed",
    event: "order.placed",
    status: "active",
  },
]

const EmailConfigPage = () => {
  const [testEmail, setTestEmail] = useState("")
  const [sending, setSending] = useState<string | null>(null)

  const sendTestEmail = async (templateId: string) => {
    if (!testEmail) {
      toast.error("Please enter a test email address")
      return
    }

    setSending(templateId)
    try {
      const response = await fetch(`/admin/email-config/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ template: templateId, email: testEmail }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to send test email")
      }

      toast.success(`Test email sent to ${testEmail}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email")
    } finally {
      setSending(null)
    }
  }

  return (
    <>
      <Toaster />
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Email Configuration</Heading>
            <Text className="text-ui-fg-subtle">
              Manage transactional email templates and settings
            </Text>
          </div>
        </div>

        {/* Provider Status */}
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-4">Email Provider</Heading>
          <div className="flex items-center gap-4 rounded-lg border border-ui-border-base p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ui-bg-subtle">
              <EnvelopeSolid className="text-ui-fg-subtle" />
            </div>
            <div className="flex-1">
              <Text className="font-medium">Resend</Text>
              <Text className="text-ui-fg-subtle text-sm">Transactional email provider</Text>
            </div>
            <Badge color="green">Connected</Badge>
          </div>
        </div>

        {/* Test Email */}
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-4">Send Test Email</Heading>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="Enter test email address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>

        {/* Templates */}
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-4">Email Templates</Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Template</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Trigger Event</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {emailTemplates.map((template) => (
                <Table.Row key={template.id}>
                  <Table.Cell>
                    <Text className="font-medium">{template.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-ui-fg-subtle">{template.description}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <code className="rounded bg-ui-bg-subtle px-2 py-1 text-xs">
                      {template.event}
                    </code>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={template.status === "active" ? "green" : "grey"}>
                      {template.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => sendTestEmail(template.id)}
                      disabled={sending === template.id || !testEmail}
                    >
                      {sending === template.id ? "Sending..." : "Send Test"}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {/* Email Events Reference */}
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-4">Available Email Events</Heading>
          <Text className="text-ui-fg-subtle mb-4">
            These are the Medusa events that can trigger transactional emails:
          </Text>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text className="font-medium mb-2">Authentication</Text>
              <ul className="text-sm text-ui-fg-subtle space-y-1">
                <li><code>auth.password_reset</code> - Password reset requested</li>
                <li><code>invite.created</code> - User invited</li>
                <li><code>invite.resent</code> - Invitation resent</li>
              </ul>
            </div>
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text className="font-medium mb-2">Orders</Text>
              <ul className="text-sm text-ui-fg-subtle space-y-1">
                <li><code>order.placed</code> - Order confirmed</li>
                <li><code>order.canceled</code> - Order canceled</li>
                <li><code>order.shipment_created</code> - Shipment created</li>
              </ul>
            </div>
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text className="font-medium mb-2">Customers</Text>
              <ul className="text-sm text-ui-fg-subtle space-y-1">
                <li><code>customer.created</code> - New customer registered</li>
                <li><code>customer.password_reset</code> - Customer password reset</li>
              </ul>
            </div>
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text className="font-medium mb-2">Fulfillment</Text>
              <ul className="text-sm text-ui-fg-subtle space-y-1">
                <li><code>fulfillment.created</code> - Fulfillment started</li>
                <li><code>fulfillment.shipment_created</code> - Shipped</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}

export const config = defineRouteConfig({
  label: "Email Config",
  icon: EnvelopeSolid,
})

export default EmailConfigPage
